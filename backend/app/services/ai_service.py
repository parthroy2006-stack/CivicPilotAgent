
import os
import base64
import json
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load environment variables from backend/.env
BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

# Project directories
APP_DIR = Path(__file__).resolve().parents[1]
PROMPTS_DIR = APP_DIR / "prompts"

# Gemini configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/"
    f"models/{GEMINI_MODEL}:generateContent"
)


def load_prompt(filename: str) -> str:
    """Load a prompt from the backend/app/prompts directory."""

    prompt_path = PROMPTS_DIR / filename

    if not prompt_path.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {prompt_path}"
        )

    return prompt_path.read_text(encoding="utf-8")


# Load all three CivicPilot prompts
ASSISTANT_PROMPT = load_prompt(
    "civicpilot_assistant_prompt.txt"
)

DOCUMENT_INTAKE_PROMPT = load_prompt(
    "civicpilot_document_intake_prompt.txt"
)

AGENT_PLANNER_PROMPT = load_prompt(
    "civicpilot_agent_planner_prompt.txt"
)
import base64


async def analyze_document(
    file_bytes: bytes,
    mime_type: str
) -> dict:
    """Analyze an uploaded document using Gemini."""

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    encoded_file = base64.b64encode(file_bytes).decode("utf-8")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": DOCUMENT_INTAKE_PROMPT
                    },
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": encoded_file
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    headers = {
        "Content-Type": "application/json"
    }

    params = {
        "key": GEMINI_API_KEY
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            GEMINI_API_URL,
            headers=headers,
            params=params,
            json=payload
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Gemini API error ({response.status_code}): "
                f"{response.text[:1000]}"
            )

        result = response.json()

    try:
        response_text = (
            result["candidates"][0]["content"]["parts"][0]["text"]
        )

        return json.loads(response_text)

    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            "Gemini returned an invalid document-analysis response."
        ) from exc
    