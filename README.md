# CivicPilot

CivicPilot is a GenAI-powered digital public-service assistant prototype. It helps citizens discover official government schemes, understand eligibility and document requirements, extract and inspect information from documents, and prepare guided application workflows before taking manual action on official portals.

> **Safety boundary:** This prototype does not submit government applications, make payments, bypass CAPTCHA/OTP, or claim an application was submitted. The citizen remains responsible for authentication, manual portal actions, and final submission.

## Architecture

- `frontend/`: React + Vite citizen workspace and dashboard (`http://localhost:5173`).
- `backend/`: FastAPI backend and API services (`http://127.0.0.1:8000`).
- `backend/app/services/ai_service.py`: Google Gemini API integration for document intake and structured extraction.
- `backend/app/prompts/`: Modular externalized prompt files:
  - `civicpilot_assistant_prompt.txt`
  - `civicpilot_document_intake_prompt.txt`
  - `civicpilot_agent_planner_prompt.txt`
- `backend/app/agents.py`: Specialist-agent workflow orchestration (Intake, Discovery, Eligibility, Document checklist, Portal prep, Human Approval Gate).
- `backend/app/sources.py`: Verified official-source retrieval from an allowlist of government domains (`.gov.in`, `.nic.in`).
- `test_documents/`: Synthetic sample documents (Aadhaar, Income Certificate, Caste Certificate PDF, Irrelevant Image) for end-to-end testing.

## Requirements

- Python 3.11+
- Node.js 20+
- A Google Gemini API key (configured in `backend/.env`)

## Run locally

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Set GEMINI_API_KEY in .env
uvicorn app.main:app --reload --port 8000
```

Interactive API documentation: `http://localhost:8000/docs`

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/api` calls directly to FastAPI on port 8000.

## Environment Variables

Configure `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
FRONTEND_ORIGIN=http://localhost:5173
MAX_UPLOAD_MB=10
```

> **Security Note:** Never commit `.env` or expose API keys. `.env` is excluded in `.gitignore`.

## Key Capabilities

1. **AI Assistant (`/api/chat`):** Live conversational government-service guidance with location awareness and safety guardrails.
2. **Document Analysis (`/api/documents/extract`):** Multimodal document extraction for PDF, PNG, and JPG:
   - Relevance assessment (rejects non-documents with clear explanation).
   - Document type classification (Aadhaar, Income Certificate, Caste Certificate, etc.).
   - Key field extraction with confidence ratings and visual evidence snippets.
   - Automatic privacy masking for sensitive identifiers (e.g. `XXXX-XXXX-1234`).
   - Missing required information detection.
   - User-facing verification and authenticity disclaimers.
3. **Agent Workspace (`/api/workflows`):** Multi-stage workflow planner with human approval and cancellation gates (`/api/workflows/approval`).
4. **Official Sources (`/api/sources/fetch`):** Domain-validated government page retrieval restricted to approved official domains.

## Testing & Quality Checks

Run full project checks:

```bash
# Backend syntax and compile check
cd backend && python -m compileall app

# Frontend build check
cd ../frontend && npm run build
```

Sample test documents are provided in `test_documents/`:
- `sample_aadhaar_card.png`: Tests identity card recognition and Aadhaar number privacy masking.
- `sample_income_certificate.png`: Tests income certificate fields, financial year validity, and missing signature detection.
- `sample_caste_certificate.pdf`: Tests PDF format extraction, category classification, and official notice warnings.
- `sample_unrelated_image.png`: Tests non-document rejection guardrails.
