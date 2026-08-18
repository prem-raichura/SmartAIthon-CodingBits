FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8077

WORKDIR /app

# libgomp1 = OpenMP runtime needed by lightgbm / xgboost
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py features_v6.py analytics_v6.py production_v6.pkl ./

EXPOSE 8077

# 2 workers; long timeout because cold load of the 44MB bundle + first inference is slow.
# Shell form so $PORT is honoured — the dev server and the container now agree.
CMD gunicorn -w 2 -b 0.0.0.0:$PORT --timeout 180 app:app
