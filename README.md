# CivicPilot

CivicPilot is a GenAI-powered public-service assistant prototype. It helps citizens discover official services, understand eligibility and document requirements, prepare applications, and review a guided workflow before any consequential action.

> **Safety boundary:** This prototype does not submit government applications, make payments, bypass CAPTCHA/OTP, or claim an application was submitted. Browser automation is limited to user-approved navigation and preparation on explicitly supported portals. The citizen remains responsible for authentication and final submission.

## Architecture

- `frontend/`: React + Vite citizen workspace and agent activity dashboard.
- `backend/`: FastAPI API, Gemini-powered assistant, service/eligibility/document workflow orchestration.
- `backend/app/agents.py`: transparent specialist-agent workflow (service discovery, eligibility, documents, portal preparation, tracking readiness).
- `backend/app/sources.py`: official-source retrieval from an allowlist of government domains.

## Requirements

- Python 3.11+
- Node.js 20+
- A Google Gemini API key for live LLM responses (optional for local fallback mode)

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Windows: copy .env.example .env
# Add GEMINI_API_KEY to .env for live GenAI
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite development server proxies `/api` to FastAPI on port 8000.

## Environment variables

See `backend/.env.example`. Never commit `.env` or real credentials.

## Current capabilities

- Conversational service-intake interface.
- Official-source retrieval for configured government domains and user-supplied official URLs.
- Gemini-powered response generation when `GEMINI_API_KEY` is configured; clear non-LLM fallback otherwise.
- Multi-stage workflow with visible agent activity, eligibility checklist, document checklist, and human approval gate.
- PDF/image upload endpoint with file validation and optional OCR extraction.
- Application preparation record and status tracking; no automatic final submission.

## Important limitations

- Government portals vary by state/service and may require login, OTP, CAPTCHA, fees, or in-person verification. These are not automated or bypassed.
- Official-source retrieval is best-effort and only fetches allowlisted government domains. A failed fetch is shown as unavailable, not treated as verified.
- Eligibility output is preliminary guidance, not an official determination.
- The initial workflow is a reusable prototype. Before a live demo, select one service and validate its exact current official portal process.

## Checks

```bash
cd backend && python -m compileall app
cd ../frontend && npm run build
```
# CivicPilotAgent
Autonomous GenAI Agent for Public Services and Government Procedures
