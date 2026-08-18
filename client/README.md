# ParkVUE — Client

Frontend admin portal for the parking enforcement intelligence system. The
bundled dataset and mock data are drawn from a Bengaluru traffic-violations
export, so station and junction names reflect that city.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

Requires Node >= 20.19.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19 | Component framework |
| TypeScript | 6 | Type safety |
| Vite | 8 | Build tool and dev server |
| Tailwind CSS | 3 | Utility-first styling with a custom brand palette |
| Framer Motion | 12 | Animations and page transitions |
| React Router DOM | 7 | Client-side routing |
| Recharts | 3 | Data visualizations |
| Leaflet 1.9 + React-Leaflet 5 | — | Interactive hotspot map with H3 hexagons |
| H3-JS | 4 | Uber's hexagonal hierarchical spatial indexing |
| Lucide React | 1 | Icon library |
| Sonner | 2 | Toast notifications |

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Public marketing page |
| `/login` | Login | Auth form (requires a running backend) |
| `/dashboard` | Command Center | KPIs, charts, EDI insights, activity feed |
| `/hotspots` | Hotspot Detection | H3 hexagon map with violation cluster overlays |
| `/congestion` | Congestion Impact | Blockage analysis, scatter plots, cascade network |
| `/analytics` | Operational Analytics | Enforcement trends, funnel, violations breakdown |
| `/officers` | Officer Management | Roster, pending approvals, performance table |
| `/csv-upload` | Dataset Management | Upload new datasets with live progress tracking |

## Folder Structure

```
src/
├── components/
│   ├── layout/       # AppShell, Sidebar, Topbar, PageTransition
│   └── ui/           # StatCard, Dialog, Skeleton, RiskBadge, etc.
├── config/
│   └── api.ts        # Backend connection — BASE_URL, PY_URL, ENDPOINTS, IS_LIVE
├── hooks/
│   ├── useMockData.ts    # All data hooks (auto-switches mock ↔ live API)
│   ├── useTheme.tsx      # Theme context (the app ships light-only)
│   └── useMediaQuery.ts  # Responsive breakpoint detection
├── mocks/            # Static JSON mock data files
├── pages/            # One file per route
├── types/            # TypeScript interfaces matching backend schema
├── lib/
│   ├── api.ts        # Typed fetch wrapper + endpoint helpers
│   ├── auth.tsx      # Auth context, token storage, 401 handling
│   └── utils.ts      # cn(), formatNumber(), formatPercent(), haversineKm()
└── index.css         # Global styles and Tailwind layers
```

## Connect to Backend

1. Copy `.env.example` to `.env.local`
2. Point it at your running services:

```env
VITE_API_URL=http://localhost:4000/api
VITE_PY_URL=http://localhost:8077
```

3. Restart `npm run dev`

`IS_LIVE` in `src/config/api.ts` becomes `true` automatically, and every hook in
`src/hooks/useMockData.ts` switches from static JSON mocks to live `fetch()`
calls.

**Mock mode** (no `VITE_API_URL`) renders the charts from `src/mocks/*.json`.
Login, notifications and CSV upload all need a real backend and are unavailable
in that mode.

### Expected Endpoints

See `src/config/api.ts` for the full list. Key ones:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | KPI totals for command center |
| `/hotspots` | GET | Array of H3 hex hotspot records |
| `/officers` | GET | Full officer roster |
| `/officers/pending` | GET | Pending registration requests |
| `/officers/approve/:id` | POST | Approve a registration |
| `/officers/reject/:id` | POST | Reject a registration |
| `/csv/history` | GET | Upload history records |
| `/csv/store` | POST | Persist an analytics bundle for a new run |

CSV upload is two hops: the browser posts the raw file to
`POST {VITE_PY_URL}/analytics` (which returns a small aggregated bundle), then
posts that bundle to `POST {VITE_API_URL}/csv/store`.

## Build for Production

```bash
npm run typecheck  # tsc only
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Theme

The app ships **light-only**: `ThemeProvider` in `src/hooks/useTheme.tsx`
deliberately keeps the `dark` class off the root element. The `dark:` Tailwind
variants throughout the components are inert.

## Troubleshooting

See [SETUP.md](./SETUP.md) for common issues and fixes.
