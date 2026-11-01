from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

ALLOWED_SUFFIXES = (".gov.in", ".nic.in", ".india.gov.in", ".gov")

DEFAULT_SOURCES = [
    {
        "name": "National Portal of India",
        "url": "https://www.india.gov.in/",
        "category": "National Directory",
        "description": "Official single-window access to information and services provided by all Indian Government entities.",
    },
    {
        "name": "Passport Seva Portal",
        "url": "https://www.passportindia.gov.in/",
        "category": "Travel & Identity",
        "description": "Consular, Passport & Visa Division (CPV), Ministry of External Affairs for passport applications and appointments.",
    },
    {
        "name": "UIDAI - Unique Identification Authority of India",
        "url": "https://uidai.gov.in/",
        "category": "National Identity",
        "description": "Official Aadhaar issuing authority. Verification, address update, mobile linking, and PVC card services.",
    },
    {
        "name": "National Scholarship Portal (NSP)",
        "url": "https://scholarships.gov.in/",
        "category": "Education & Student Welfare",
        "description": "Central and state government post-matric, pre-matric, and higher education scholarship schemes.",
    },
    {
        "name": "DigiLocker",
        "url": "https://www.digilocker.gov.in/",
        "category": "Digital Documents",
        "description": "Cloud platform for issuance and verification of documents and certificates in a digital way, legally at par with originals.",
    },
    {
        "name": "Income Tax e-Filing & PAN Portal",
        "url": "https://www.incometax.gov.in/",
        "category": "Taxation & Revenue",
        "description": "Central Board of Direct Taxes (CBDT) for instant e-PAN generation, PAN-Aadhaar linking, and returns.",
    },
    {
        "name": "Parivahan Sewa (MoRTH)",
        "url": "https://parivahan.gov.in/",
        "category": "Transport & Licensing",
        "description": "Ministry of Road Transport & Highways for Driving Licence, Learner Licence, and Vehicle Registration.",
    },
    {
        "name": "ServicePlus / State e-District Services",
        "url": "https://serviceonline.gov.in/",
        "category": "Citizen Certificates",
        "description": "Unified meta-framework by NIC for State e-District certificates (Income, Caste, Domicile, Character).",
    },
    {
        "name": "e-Shram Portal",
        "url": "https://eshram.gov.in/",
        "category": "Social Security",
        "description": "Ministry of Labour & Employment national database of unorganised workers for social security benefits.",
    },
    {
        "name": "PM-KISAN Samman Nidhi",
        "url": "https://pmkisan.gov.in/",
        "category": "Agriculture & Rural",
        "description": "Department of Agriculture and Farmers Welfare providing direct income support of ₹6,000 per year.",
    },
    {
        "name": "UMANG (Unified Mobile App for New-age Governance)",
        "url": "https://web.umang.gov.in/",
        "category": "Unified Services",
        "description": "Comprehensive platform accessing 1,200+ central and state government services from a single dashboard.",
    },
    {
        "name": "RTI Online",
        "url": "https://rtionline.gov.in/",
        "category": "Public Transparency",
        "description": "Department of Personnel and Training for filing online Right to Information requests and appeals.",
    },
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
