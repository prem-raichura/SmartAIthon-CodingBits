# Officer App — Backend

Node + TypeScript + Express + Prisma + PostgreSQL

## Setup

```bash
npm install
npm run migrate     # creates tables
npm run seed        # creates admin (admin/admin123) + demo officer (officer/officer123)
npm run dev         # starts server on PORT 4000
```

## Environment

Copy `.env.example` → `.env` and fill in:
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — min 32 chars
- `EMAIL_MODE=stub` — logs credentials to the console; sends nothing, no network
- `PY_SERVICE_URL` — the Flask model service, e.g. `http://localhost:8077`
- `CLOUDINARY_*` — optional; when unset, uploads are written to `server/uploads/`
- `PUSH_MODE=stub` — logs push payloads to console

## Clients

| Client | Role | Notes |
|---|---|---|
| Officer mobile app (React Native) | `officer` | registers, sees patrol map, submits field validation |
| Admin web | `admin` | approves officers, assigns cells, triggers ML runs |

## API — base: `http://localhost:4000/api`

All protected routes: `Authorization: Bearer <jwt>`

### Auth
| Method | Path | Auth | |
|---|---|---|---|
| POST | `/auth/register` | public | officer submits registration request |
| POST | `/auth/login` | public | `{ username, password }` → `{ token, user }` |
| GET | `/auth/me` | any | current user |

### Registration Requests (admin)
| Method | Path | |
|---|---|---|
| GET | `/registration-requests?status=pending` | list |
| POST | `/registration-requests/:id/approve` | creates user, emails credentials |
| POST | `/registration-requests/:id/reject` | rejects |

### Users (admin / officer)
| Method | Path | |
|---|---|---|
| GET | `/users` | admin: list all |
| PATCH | `/users/:id` | admin: toggle `is_active` |
| POST | `/users/me/push-token` | officer: save Expo push token |

### Prediction Runs (admin)
| Method | Path | |
|---|---|---|
| POST | `/prediction-runs` | create run `{ csv_path, model_version, prediction_window, h3_resolution }` |
| POST | `/prediction-runs/:id/ingest` | parse CSV → insert prediction_cells |
| GET | `/prediction-runs` | list |

### Prediction Cells (any)
| Method | Path | |
|---|---|---|
| GET | `/prediction-cells?run_id=&risk_level=&window=` | map data with lat/lng |
| GET | `/prediction-cells/:id` | detail |

### Assignments
| Method | Path | Auth | |
|---|---|---|---|
| POST | `/assignments` | admin | assign officer to cell → push notification |
| GET | `/assignments/me?status=` | officer | own patrol list with embedded cell geo |
| GET | `/assignments?user_id=&status=` | admin | all |
| PATCH | `/assignments/:id` | any | `{ action: "open" \| "complete" \| "expire" }` |

### Notifications (officer)
| Method | Path | |
|---|---|---|
| GET | `/notifications` | own feed |
| PATCH | `/notifications/:id/read` | mark read |

### Field Validations
| Method | Path | Auth | |
|---|---|---|---|
| POST | `/field-validations` | officer | submit ground truth → marks assignment completed |
| GET | `/field-validations?cell_id=&officer_id=` | any | list |

### Model Feedback Batches (admin)
| Method | Path | |
|---|---|---|
| POST | `/model-feedback-batches/generate` | `{ month: "2024-05", model_version: "v1.0" }` |
| GET | `/model-feedback-batches` | list |
| POST | `/model-feedback-batches/:id/submit` | mark submitted |

## Quick curl flow

```bash
# 1. Admin login
TOKEN=$(curl -s -X POST :4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# 2. Officer registers
curl -X POST :4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ravi Kumar","email":"ravi@police.local","number":"9876543210","police_station":"Station 1"}'

# 3. Admin approves (check console for emailed username + temp password)
curl -X POST :4000/api/registration-requests/<request_id>/approve \
  -H "Authorization: Bearer $TOKEN"

# 4. Officer logs in
OFFICER_TOKEN=$(curl -s -X POST :4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<generated_username>","password":"<temp_password>"}' | jq -r .token)

# 5. Admin creates prediction run and ingests sample CSV
RUN_ID=$(curl -s -X POST :4000/api/prediction-runs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"csv_path":"./sample_prediction.csv","model_version":"v1.0","prediction_window":"H24","h3_resolution":8}' | jq -r .run_id)

curl -X POST :4000/api/prediction-runs/$RUN_ID/ingest \
  -H "Authorization: Bearer $TOKEN"

# 6. Admin assigns officer to a cell
curl -X POST :4000/api/assignments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"user_id":"<officer_id>","cell_id":"<cell_id>","run_id":"<run_id>"}'

# 7. Officer sees patrol map (cell lat/lng embedded)
curl :4000/api/assignments/me -H "Authorization: Bearer $OFFICER_TOKEN"

# 8. Officer opens assignment
curl -X PATCH :4000/api/assignments/<assignment_id> \
  -H "Authorization: Bearer $OFFICER_TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"open"}'

# 9. Officer submits field validation
curl -X POST :4000/api/field-validations \
  -H "Authorization: Bearer $OFFICER_TOKEN" -H "Content-Type: application/json" \
  -d '{"assignment_id":"<id>","cell_id":"<id>","has_congestion":true,"congestion_severity":"high"}'

# 10. Admin generates monthly feedback batch
curl -X POST :4000/api/model-feedback-batches/generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"month":"2024-05","model_version":"v1.0"}'
```

## Project structure

```
server/
├── prisma/
│   ├── schema.prisma       — 8 tables (all PDF tables)
│   ├── config.ts           — Prisma 7 datasource config
│   └── seed.ts             — admin user seed
└── src/
    ├── index.ts            — Express app + route mount
    ├── config/env.ts       — zod-validated env
    ├── lib/prisma.ts       — PrismaClient singleton (pg adapter)
    ├── middleware/         — auth (JWT), error handler, validate
    ├── utils/              — jwt, password, email, push, csv parser
    └── modules/
        ├── auth/
        ├── registrationRequests/
        ├── users/
        ├── predictionRuns/
        ├── predictionCells/
        ├── assignments/
        ├── notifications/
        ├── fieldValidations/
        └── modelFeedbackBatches/
```
