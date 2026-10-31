from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

ALLOWED_SUFFIXES = (".gov.in", ".nic.in", ".india.gov.in", ".gov")
DEFAULT_SOURCES = [
    {"name": "National Portal of India", "url": "https://www.india.gov.in/", "description": "Official national portal for government information and services."},
    {"name": "National Scholarship Portal", "url": "https://scholarships.gov.in/", "description": "Official portal for scholarship information and applications; availability and scheme rules vary."},
    {"name": "DigiLocker", "url": "https://www.digilocker.gov.in/", "description": "Official platform for accessing issued digital documents, subject to user authorization."},
]


def is_official_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        return parsed.scheme == "https" and any(host == suffix.lstrip(".") or host.endswith(suffix) for suffix in ALLOWED_SUFFIXES)
    except Exception:
        return False


async def fetch_official_page(url: str) -> dict:
    if not is_official_url(url):
        raise ValueError("Only HTTPS pages on approved government domains can be fetched.")
    headers = {"User-Agent": "CivicPilot/0.1 (public-service information assistant)"}
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()
    final_url = str(response.url)
    if not is_official_url(final_url):
        raise ValueError("The page redirected outside the approved government domain list.")
    soup = BeautifulSoup(response.text, "html.parser")
    for node in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        node.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else final_url
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))[:12000]
    return {"title": title, "url": final_url, "text": text}
