from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pypdf import PdfReader

from .agents import run_workflow
from .requirements import (
    evaluate_application_readiness,
    get_all_services,
    get_service_requirements,
)
from .services.ai_service import analyze_document, batch_analyze_documents
from .sources import DEFAULT_SOURCES, fetch_official_page, is_official_url

load_dotenv()
app = FastAPI(title="CivicPilot API", version="0.2.0", description="GenAI public-service assistant and multi-document readiness system")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=4000)
    location: str = Field(default="", max_length=160)
    history: list[dict[str, str]] = Field(default_factory=list)

class WorkflowRequest(BaseModel):
    request: str = Field(min_length=2, max_length=4000)
    location: str = Field(default="", max_length=160)

class SourceRequest(BaseModel):
    url: str

class ApprovalRequest(BaseModel):
    workflow_id: str
    approved: bool

class ReadinessRequest(BaseModel):
    service: str = Field(min_length=1, max_length=200)
    documents: list[dict[str, Any]] = Field(default_factory=list)

workflows: dict[str, dict[str, Any]] = {}

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "civicpilot-api", "genai_configured": bool(os.getenv("GEMINI_API_KEY"))}

@app.get("/api/sources")
async def list_sources():
    return {"sources": DEFAULT_SOURCES}

@app.post("/api/sources/fetch")
async def fetch_source(payload: SourceRequest):
    try:
        page = await fetch_official_page(payload.url)
        return {"source": {"title": page["title"], "url": page["url"]}, "content": page["text"][:5000]}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not retrieve this official page: {type(exc).__name__}")

async def gemini_reply(message: str, location: str, history: list[dict[str, str]]) -> str | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    prompt = """You are CivicPilot, a careful public-service assistant. Help users understand government services. Ask concise follow-up questions when service, state/district, or required facts are missing. Do not invent rules, eligibility, URLs, fees, deadlines, or status. Distinguish general guidance from verified official information. Encourage checking official sources. Never claim to submit an application. Never ask users to share full Aadhaar/PAN numbers or passwords in chat. Final submission, payments, OTP and CAPTCHA remain under user control.\n\n"""
    conversation = "\n".join([f"{x.get('role','user')}: {x.get('content','')}" for x in history[-8:]])
    body = {"contents": [{"parts": [{"text": prompt + f"Location: {location or 'not supplied'}\nConversation:\n{conversation}\nuser: {message}\nassistant:"}]}], "generationConfig": {"temperature": 0.25, "maxOutputTokens": 700}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.post(url, json=body)
        response.raise_for_status()
        data = response.json()
    return "".join(p.get("text", "") for p in data.get("candidates", [{}])[0].get("content", {}).get("parts", [])).strip() or None

@app.post("/api/chat")
async def chat(payload: ChatRequest):
    try:
        answer = await gemini_reply(payload.message, payload.location, payload.history)
        if answer:
            return {"answer": answer, "mode": "gemini", "notice": "AI-generated guidance; verify requirements against the linked official portal."}
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="The AI service is temporarily unavailable. Please retry.")
    return {
        "answer": "I can help you plan this government-service process. To avoid giving you incorrect guidance, please tell me the exact service or scheme and your state/district. I can then help identify official sources, prepare a checklist, and outline the application steps. This local fallback is not a live AI response; add GEMINI_API_KEY to enable the GenAI assistant.",
        "mode": "guided_fallback",
        "notice": "Gemini is not configured. No eligibility or application facts have been verified.",
    }

@app.post("/api/workflows")
async def create_workflow(payload: WorkflowRequest):
    workflow = run_workflow(payload.request, payload.location)
    workflow_id = str(uuid.uuid4())
    workflow["workflow_id"] = workflow_id
    workflow["status"] = "prepared"
    workflows[workflow_id] = workflow
    return workflow

@app.get("/api/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    if workflow_id not in workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflows[workflow_id]

@app.post("/api/workflows/approval")
async def approve_workflow(payload: ApprovalRequest):
    workflow = workflows.get(payload.workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    workflow["status"] = "approved_for_manual_portal_action" if payload.approved else "cancelled"
    workflow["approval"] = {"approved": payload.approved, "message": "Approval recorded for the next user-supervised step. CivicPilot does not submit the application." if payload.approved else "The user cancelled this workflow."}
    return workflow["approval"]

# ---------------------------------------------------------
# Document Intelligence & Application Readiness Endpoints
# ---------------------------------------------------------

@app.get("/api/documents/services")
async def list_document_services():
    """List standard supported government services and their catalog metadata."""
    return {"services": get_all_services()}

@app.get("/api/documents/requirements")
async def get_service_doc_requirements(service: str = Query("Passport Application")):
    """Get official document requirements for the selected government service."""
    return get_service_requirements(service)

@app.post("/api/documents/extract")
async def extract_single_document(file: UploadFile = File(...)):
    """Single-document extraction endpoint (retained for backward compatibility)."""
    allowed = {"application/pdf", "image/png", "image/jpeg"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=415, detail="Upload a PDF, PNG, or JPG file.")
    max_bytes = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
    raw = await file.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {max_bytes // (1024 * 1024)} MB limit."
        )

    try:
        analysis = await analyze_document(
            file_bytes=raw,
            mime_type=file.content_type
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document analysis failed: {str(exc)}"
        )

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "characters": len(str(analysis)),
        "fields_extracted": len(analysis.get("extracted_fields", [])),
        "is_relevant": analysis.get("is_relevant_document", False),
        "analysis": analysis,
        "warning": (
            "Review extracted information carefully. "
            "AI analysis does not establish document authenticity "
            "or guarantee government acceptance."
        )
    }

@app.post("/api/documents/batch-extract")
async def batch_extract_documents(
    service: str = Form("Passport Application"),
    files: list[UploadFile] = File(...),
):
    """
    Multi-document upload and analysis endpoint.
    - Validates each file independently.
    - Analyzes documents concurrently via Gemini.
    - Tolerates individual file errors without failing the batch.
    - Evaluates overall application readiness against the selected service.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    allowed = {"application/pdf", "image/png", "image/jpeg"}
    max_bytes = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024

    prepared_items = []
    file_errors = []

    for f in files:
        if f.content_type not in allowed:
            file_errors.append({
                "filename": f.filename,
                "error": f"Unsupported format '{f.content_type}'. Upload PDF, PNG, or JPG.",
            })
            continue

        raw = await f.read(max_bytes + 1)
        if len(raw) > max_bytes:
            file_errors.append({
                "filename": f.filename,
                "error": f"File exceeds {max_bytes // (1024 * 1024)} MB limit.",
            })
            continue

        file_id = str(uuid.uuid4())[:8] + "_" + (f.filename or "file")
        prepared_items.append({
            "file_id": file_id,
            "filename": f.filename or "uploaded_document",
            "file_bytes": raw,
            "mime_type": f.content_type,
        })

    # Run batch extraction concurrently
    analyzed_results = await batch_analyze_documents(prepared_items)

    # Attach any immediate validation errors as synthetic failed entries
    for err in file_errors:
        analyzed_results.append({
            "file_id": str(uuid.uuid4())[:8],
            "filename": err["filename"],
            "content_type": "unknown",
            "success": False,
            "analysis": {
                "is_relevant_document": False,
                "document_type": None,
                "summary": err["error"],
                "extracted_fields": [],
                "missing_information": [],
                "warnings": [err["error"]],
            },
            "error": err["error"],
        })

    # Evaluate application readiness against the service requirements
    readiness = evaluate_application_readiness(
        service_name=service,
        analyzed_documents=analyzed_results,
    )

    readiness["batch_summary"] = {
        "total_submitted": len(files),
        "successfully_processed": len([r for r in analyzed_results if r.get("success")]),
        "failed_files": len(file_errors) + len([r for r in analyzed_results if not r.get("success")]),
    }

    return readiness

@app.post("/api/documents/readiness")
async def calculate_readiness(payload: ReadinessRequest):
    """
    Recalculate application readiness instantly for already-analyzed documents.
    Used when documents are deleted, reordered, or when the citizen switches the service.
    """
    return evaluate_application_readiness(
        service_name=payload.service,
        analyzed_documents=payload.documents,
    )
