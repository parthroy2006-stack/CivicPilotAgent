import asyncio
import os
import base64
import json
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

# Load environment variables from backend/.env
BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

# Project directories
APP_DIR = Path(__file__).resolve().parents[1]
PROMPTS_DIR = APP_DIR / "prompts"


def get_gemini_config() -> tuple[str | None, str, str]:
    """Retrieve up-to-date Gemini API key, model name, and endpoint URL."""
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    return api_key, model, url


def load_prompt(filename: str) -> str:
    """Load a prompt from the backend/app/prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


# Load all three CivicPilot prompts
ASSISTANT_PROMPT = load_prompt("civicpilot_assistant_prompt.txt")
DOCUMENT_INTAKE_PROMPT = load_prompt("civicpilot_document_intake_prompt.txt")
AGENT_PLANNER_PROMPT = load_prompt("civicpilot_agent_planner_prompt.txt")


def clean_and_parse_json(raw_text: str) -> dict:
    """Safely parse JSON response from Gemini, handling code blocks, smart quotes, and formatting."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Normalize smart quotes to standard ASCII double quotes
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Fallback regex extraction if there is extra text around JSON
        match = re.search(r"(\{.*\})", text, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
        else:
            raise

    # Normalize response schema fields
    if not isinstance(data, dict):
        raise ValueError("Document analysis response is not a JSON object")

    normalized = {
        "is_relevant_document": bool(data.get("is_relevant_document", False)),
        "document_type": data.get("document_type"),
        "summary": data.get("summary") or "No summary available.",
        "extracted_fields": data.get("extracted_fields") if isinstance(data.get("extracted_fields"), list) else [],
        "missing_information": data.get("missing_information") if isinstance(data.get("missing_information"), list) else [],
        "warnings": data.get("warnings") if isinstance(data.get("warnings"), list) else [],
    }

    # Ensure each extracted field has a standard structure
    for field in normalized["extracted_fields"]:
        if isinstance(field, dict):
            if "confidence" not in field:
                field["confidence"] = "High" if field.get("value") else "Low"
            if "evidence" not in field:
                field["evidence"] = None

    return normalized


async def analyze_document(file_bytes: bytes, mime_type: str) -> dict:
    """Analyze an uploaded document or image using Gemini."""
    api_key, model, api_url = get_gemini_config()

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    encoded_file = base64.b64encode(file_bytes).decode("utf-8")

    # Reload prompt in case of live updates
    prompt = load_prompt("civicpilot_document_intake_prompt.txt")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": encoded_file,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            api_url,
            headers=headers,
            params=params,
            json=payload,
        )

        if response.status_code != 200:
            error_detail = response.text[:1000]
            raise RuntimeError(
                f"Gemini API error ({response.status_code}): {error_detail}"
            )

        result = response.json()

    candidates = result.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned no candidates in response.")

    candidate = candidates[0]
    finish_reason = candidate.get("finish_reason")
    if finish_reason in {"SAFETY", "RECITATION"}:
        raise RuntimeError(f"Document analysis was blocked by safety filter: {finish_reason}")

    parts = candidate.get("content", {}).get("parts", [])
    response_text = "".join(part.get("text", "") for part in parts if "text" in part)

    if not response_text.strip():
        raise RuntimeError("Gemini returned an empty document analysis.")

    try:
        return clean_and_parse_json(response_text)
    except Exception as exc:
        raise RuntimeError(
            f"Could not parse Gemini's document analysis response: {exc}"
        ) from exc


async def batch_analyze_documents(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Analyze multiple documents concurrently.
    Tolerates individual file errors so partial failures do not discard successful files.
    """
    async def _analyze_single(item: dict[str, Any]) -> dict[str, Any]:
        file_id = item.get("file_id") or item.get("filename", "unknown")
        filename = item.get("filename", "document")
        mime_type = item.get("mime_type", "image/png")
        file_bytes = item.get("file_bytes", b"")
        try:
            analysis = await analyze_document(file_bytes=file_bytes, mime_type=mime_type)
            return {
                "file_id": file_id,
                "filename": filename,
                "content_type": mime_type,
                "success": True,
                "analysis": analysis,
                "error": None,
            }
        except Exception as exc:
            return {
                "file_id": file_id,
                "filename": filename,
                "content_type": mime_type,
                "success": False,
                "analysis": {
                    "is_relevant_document": False,
                    "document_type": None,
                    "summary": f"Could not analyze file: {str(exc)}",
                    "extracted_fields": [],
                    "missing_information": [],
                    "warnings": [f"File processing error: {str(exc)}"],
                },
                "error": str(exc),
            }

    tasks = [_analyze_single(item) for item in files]
    return await asyncio.gather(*tasks)
