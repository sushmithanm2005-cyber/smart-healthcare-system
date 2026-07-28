# NeuroDetect — Smart Healthcare System for Peripheral Neuropathy Detection Using AI

A full-stack web application that helps clinicians screen patients for peripheral neuropathy using a combination of evidence-based rule scoring and a Claude Sonnet 4.5 powered AI explanation.

## Stack
- **Backend**: FastAPI + MongoDB (Motor)
- **Frontend**: React 19 + TailwindCSS + Framer Motion + Recharts
- **AI**: Claude Sonnet 4.5 via Emergent Universal LLM Key
- **Auth**: JWT + bcrypt

## Features
- User registration / login / logout (JWT)
- Clinician dashboard with animated stat cards, monthly trend chart, risk distribution pie, age distribution and recent activity
- 18-field patient prediction form (demographics, vitals, lifestyle, neurological symptoms)
- Real-time AI explanation, contributing factors and clinical recommendations
- Patient records list with search + detail view
- Dark / light theme toggle (teal/white clinical palette)

## API Routes (prefixed with `/api`)
- `POST /auth/register` — `{full_name, email, password}`
- `POST /auth/login` — `{email, password}`
- `GET  /auth/me` — current user (Bearer token)
- `POST /predictions` — create prediction
- `GET  /predictions` — list user's predictions
- `GET  /predictions/{id}` — get one
- `DELETE /predictions/{id}` — remove
- `GET  /stats` — dashboard analytics

## Environment
`backend/.env`
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=...
EMERGENT_LLM_KEY=...
```
`frontend/.env`
```
REACT_APP_BACKEND_URL=https://<your-preview>.preview.emergentagent.com
```

## Run
Services are supervised — frontend (`:3000`) and backend (`:8001`) auto-restart on file change.
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```
