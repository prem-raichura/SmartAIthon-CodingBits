"""
train_production_v6.py — fit the COMPLETE v6 ensemble once on the most recent
TRAIN_WINDOW_WEEKS of history and pickle everything the Flask app needs.

Run:  python3 train_production_v6.py [path/to/training.csv]

Produces serving_v6/production_v6.pkl with:
  - xgb24, xgb48 (XGBoost Poisson, count)        - clf (hurdle classifier P(y>0))
  - cat (CatBoost Poisson on positives)          - quant (LightGBM quantile-0.85)
  - rank (LambdaMART)                            - glm + scaler + target-encode maps
  - ridge weights (24h & 48h)                    - severity quantiles, station cats, best_params
"""
import sys, os, json, time, joblib
import numpy as np, pandas as pd
import xgboost as xgb, lightgbm as lgb
from catboost import CatBoostRegressor
from sklearn.linear_model import Ridge, PoissonRegressor
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import features_v6 as F

TRAIN_WINDOW_WEEKS = 12
RANDOM_STATE = 42
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.join(HERE, '..', 'jan to may police violation_anonymized791b166.csv')

# tuned params from the v6 Optuna run (model_artifacts_v6/model_v6_meta.pkl)
BEST = {
 'xgb':  {'max_depth':8,'min_child_weight':8,'gamma':0.2327,'subsample':0.8724,
          'colsample_bytree':0.9258,'reg_alpha':0.6637,'reg_lambda':2.3677},
 'cat':  {'depth':8,'min_data_in_leaf':7,'l2_leaf_reg':2.3562,'subsample':0.8833},
 'quant':{'num_leaves':59,'min_child_samples':9,'feature_fraction':0.5619,'bagging_fraction':0.9442},
 'rank': {'num_leaves':62,'min_child_samples':18,'feature_fraction':0.7150,'learning_rate':0.02144},
}


def fit_glm(tr, target):
    enc = {}
    out = tr.copy()
    for col in ['station_s','junction_s','center_s']:
        m = tr.groupby(col)[target].mean(); gm = tr[target].mean()
        out[col+'_te'] = out[col].map(m).fillna(gm); enc[col] = (m.to_dict(), gm)
    cols = F.FEATS_NUM + [c+'_te' for c in ['station_s','junction_s','center_s']]
    X = out[cols].replace([np.inf,-np.inf],0).fillna(0).values
    sc = StandardScaler().fit(X)
    glm = PoissonRegressor(alpha=1e-3, max_iter=400).fit(sc.transform(X), out[target].values)
    return glm, sc, enc, cols


def main():
    csv = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    t0 = time.time()
    print(f'loading {csv}')
    df = F.load_clean(csv)
    panel, keep, attrs = F.build_panel(df)
    print(f'panel {panel.shape} | cells {len(keep)} | {round(time.time()-t0,1)}s')

    data = panel.dropna(subset=['y_t1']).copy()
    wmax = data.week_idx.max()
    tr = data[data.week_idx >= wmax - TRAIN_WINDOW_WEEKS].copy()   # most-recent window = production model
    tr['station'] = tr['station'].astype('category')
    station_cats = tr['station'].cat.categories
    print(f'training rows {len(tr):,} (weeks {tr.week_idx.min()}..{tr.week_idx.max()})')

    bundle = {'feats_num':F.FEATS_NUM,'feats_xgb':F.FEATS_XGB,'feats_lgb':F.FEATS_LGB,
              'feats_cat':F.FEATS_CAT,'cat_idx':F.CAT_IDX,'station_cats':list(station_cats),
              'best_params':BEST}

    def fit_heads(dd, tgt):
        mx = xgb.XGBRegressor(objective='count:poisson',n_estimators=700,learning_rate=0.02,
            tree_method='hist',enable_categorical=True,random_state=RANDOM_STATE,verbosity=0,**BEST['xgb'])
        mx.fit(dd[F.FEATS_XGB], dd[tgt])
        clf = lgb.LGBMClassifier(objective='binary',n_estimators=400,learning_rate=0.03,num_leaves=31,
            bagging_freq=5,random_state=RANDOM_STATE,verbose=-1)
        clf.fit(dd[F.FEATS_LGB], (dd[tgt]>0).astype(int))
        pos = dd[dd[tgt]>0]
        cat = CatBoostRegressor(loss_function='Poisson',iterations=900,learning_rate=0.02,
            cat_features=F.CAT_IDX,random_seed=RANDOM_STATE,verbose=0,**BEST['cat'])
        cat.fit(pos[F.FEATS_CAT], pos[tgt])
        mq = lgb.LGBMRegressor(objective='quantile',alpha=0.85,n_estimators=900,learning_rate=0.02,
            bagging_freq=5,random_state=RANDOM_STATE,verbose=-1,**BEST['quant'])
        mq.fit(dd[F.FEATS_LGB], dd[tgt])
        glm, sc, enc, glm_cols = fit_glm(dd, tgt)
        return dict(xgb=mx,clf=clf,cat=cat,quant=mq,glm=glm,scaler=sc,glm_enc=enc,glm_cols=glm_cols)

    def head_preds(h, fr):
        xp = np.clip(h['xgb'].predict(fr[F.FEATS_XGB]),0,None)
        hp = np.clip(h['clf'].predict_proba(fr[F.FEATS_LGB])[:,1]*np.clip(h['cat'].predict(fr[F.FEATS_CAT]),0,None),0,None)
        e = fr.copy()
        for col,(mp,gm) in h['glm_enc'].items(): e[col+'_te']=e[col].map(mp).fillna(gm)
        Xg=e[h['glm_cols']].replace([np.inf,-np.inf],0).fillna(0).values
        gp = np.clip(h['glm'].predict(h['scaler'].transform(Xg)),0,None)
        qp = np.clip(h['quant'].predict(fr[F.FEATS_LGB]),0,None)
        return np.column_stack([xp,hp,gp,qp])

    for hz, tgt in [('24h','y_t1'), ('48h','y_t2')]:
        d = tr.dropna(subset=[tgt]).copy()
        # blend weights from held-out last week (weight-finder bases trained on the rest)
        vw = d.week_idx.max(); d2 = d[d.week_idx < vw]; dv = d[d.week_idx == vw]
        if len(d2) and len(dv) > 20:
            wf = fit_heads(d2, tgt)
            meta = Ridge(alpha=1.0,positive=True,fit_intercept=False)
            meta.fit(head_preds(wf, dv), dv[tgt].values)
            wts = meta.coef_/(meta.coef_.sum()+1e-9)
        else:
            wts = np.array([0.25,0.45,0.15,0.15])
        # production bases on the FULL window, saved with the held-out weights
        h = fit_heads(d, tgt)
        h['ridge_w'] = wts.tolist()
        bundle[hz] = h
        print(f'{hz}: ridge weights xgb/hurdle/glm/quant = {np.round(wts,3).tolist()}')

    # rank head (24h only — drives risk ordering)
    trs = tr.sort_values('date'); grp = trs.groupby('date').size().values
    rel = np.minimum(trs['y_t1'].values.astype(int),31)
    mr = lgb.LGBMRanker(objective='lambdarank',n_estimators=500,bagging_freq=5,
        label_gain=list(range(32)),random_state=RANDOM_STATE,verbose=-1,**BEST['rank'])
    mr.fit(trs[F.FEATS_LGB], rel, group=grp)
    bundle['rank'] = mr

    bundle['severity_quantiles'] = data.y_t1.quantile([0.5,0.8,0.95]).values.tolist()
    bundle['attrs'] = {
        'name': attrs['name'].to_dict(), 'violation': attrs['violation'].to_dict(),
        'vehicle': attrs['vehicle'].to_dict(), 'blockage': attrs['blockage'].to_dict(),
        'four_wheel': attrs['four_wheel'].to_dict(), 'cell_events': attrs['cell_events'].to_dict(),
        'density_p90': attrs['density_p90'],
    }
    out = os.path.join(HERE, 'production_v6.pkl')
    joblib.dump(bundle, out)
    print(f'saved {out} ({round(os.path.getsize(out)/1e6,1)} MB) | total {round(time.time()-t0,1)}s')


if __name__ == '__main__':
    main()
