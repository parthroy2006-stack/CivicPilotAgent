"""
CivicPilot - Government Service Document Requirements & Readiness Engine
Grounded in official Indian public-service requirements (Passport Seva, State e-District, NSP, etc.)
"""

from __future__ import annotations

import re
from typing import Any


SERVICE_CATALOG: dict[str, dict[str, Any]] = {
    "Passport Application": {
        "title": "Passport Application (Fresh Ordinary Passport)",
        "category": "Identity & Travel",
        "description": "Standard Indian 36/60 page passport application for adult citizens via Passport Seva.",
        "official_source": {
            "title": "Passport Seva - Document Advisor",
            "url": "https://www.passportindia.gov.in/",
        },
        "requirements": [
            {
                "id": "req_address",
                "name": "Proof of Present Address",
                "description": "Valid document proving current residential address for police verification jurisdiction.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Electricity Bill",
                    "Water Bill",
                    "Telephone Bill",
                    "Bank Account Passbook / Statement",
                    "Rent Agreement",
                    "Gas Connection Bill",
                ],
                "official_note": "Aadhaar, electricity/water bill (last 3 months), or scheduled bank passbook are preferred by PSK.",
            },
            {
                "id": "req_dob",
                "name": "Proof of Date of Birth",
                "description": "Official record substantiating applicant's exact date and place of birth.",
                "mandatory": True,
                "accepted_types": [
                    "Birth Certificate",
                    "Aadhaar Card",
                    "PAN Card",
                    "School Leaving / Matriculation Certificate",
                    "Driving Licence",
                ],
                "official_note": "Birth Certificate issued by Registrar of Births & Deaths or Municipal Authority under RBD Act is primary.",
            },
            {
                "id": "req_identity",
                "name": "Proof of Identity",
                "description": "Government-issued photo identification confirming citizen identity.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Voter ID / EPIC Card",
                    "PAN Card",
                    "Driving Licence",
                ],
                "official_note": "Photo identity must clearly match applicant full name and facial features.",
            },
            {
                "id": "req_nonecr",
                "name": "Proof of Non-ECR Category",
                "description": "Required if applicant qualifies for Emigration Check Not Required status.",
                "mandatory": False,
                "accepted_types": [
                    "10th Standard / Matriculation Certificate",
                    "Higher Educational Degree / Marksheet",
                    "Income Tax Assessment / Taxpayer Proof",
                ],
                "official_note": "Applicants possessing educational qualification of matriculation (10th) or higher are eligible for Non-ECR.",
            },
        ],
    },
    "Income Certificate": {
        "title": "Income Certificate (Aay Praman Patra)",
        "category": "State Revenue",
        "description": "Official certification of gross family annual income issued by Revenue Department / Tehsildar.",
        "official_source": {
            "title": "State e-District / ServicePlus Portal",
            "url": "https://serviceonline.gov.in/",
        },
        "requirements": [
            {
                "id": "req_identity",
                "name": "Identity Proof of Applicant",
                "description": "Valid photo ID of applicant or parent/guardian.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Voter ID / EPIC Card",
                    "PAN Card",
                ],
                "official_note": "Aadhaar Card or Voter ID is standard across state e-District portals.",
            },
            {
                "id": "req_residence",
                "name": "Proof of Residence / Address",
                "description": "Document establishing residence in the issuing Circle / Tehsil jurisdiction.",
                "mandatory": True,
                "accepted_types": [
                    "Electricity Bill",
                    "Ration Card",
                    "Aadhaar Card",
                    "Domicile Certificate",
                    "Municipal Tax Receipt",
                ],
                "official_note": "Establishes local jurisdiction of the verifying Circle Officer.",
            },
            {
                "id": "req_income_proof",
                "name": "Proof of Family Income",
                "description": "Documentary evidence substantiating declared family income from all sources.",
                "mandatory": True,
                "accepted_types": [
                    "Salary Slip",
                    "Form 16",
                    "Income Tax Return (ITR) Acknowledgment",
                    "Employer Income Certificate",
                    "Land Revenue / Agricultural Record (Khatiyan / RoR)",
                    "Gram Panchayat / Ward Councillor Income Report",
                ],
                "official_note": "Salary certificate for salaried applicants; Patwari/Revenue report or ITR for self-employed/farming.",
            },
            {
                "id": "req_self_declaration",
                "name": "Self-Declaration / Income Affidavit",
                "description": "Signed affidavit or self-declaration affirming household annual income under penalty of law.",
                "mandatory": True,
                "accepted_types": [
                    "Self-Declaration Form",
                    "Prescribed Income Affidavit",
                ],
                "official_note": "Must be signed by applicant or household head as per state e-District format.",
            },
        ],
    },
    "Caste Certificate": {
        "title": "Caste / Community Certificate (SC / ST / OBC / EWS)",
        "category": "State Revenue & Welfare",
        "description": "Official caste verification certificate issued by Sub-Divisional Officer / Tehsildar.",
        "official_source": {
            "title": "State e-District Portal",
            "url": "https://serviceonline.gov.in/",
        },
        "requirements": [
            {
                "id": "req_identity",
                "name": "Applicant Identity Proof",
                "description": "Government-recognized photo identification.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Voter ID / EPIC Card",
                    "PAN Card",
                ],
                "official_note": "Required for applicant verification.",
            },
            {
                "id": "req_residence",
                "name": "Proof of Residence in State",
                "description": "Proof showing continuous stay in the state.",
                "mandatory": True,
                "accepted_types": [
                    "Domicile Certificate",
                    "Ration Card",
                    "Electricity Bill",
                    "Aadhaar Card",
                ],
                "official_note": "State-level caste certificates require residency proof within the issuing state boundary.",
            },
            {
                "id": "req_lineage_caste",
                "name": "Paternal Caste Proof / Land Record (Khatiyan)",
                "description": "Document proving ancestral community status of applicant's father or blood relative.",
                "mandatory": True,
                "accepted_types": [
                    "Father's Caste Certificate",
                    "Blood Relative Caste Certificate",
                    "Land Record (Khatiyan / RoR) showing caste",
                    "School Transfer Certificate of Father",
                ],
                "official_note": "Paternal lineage is mandatory for caste certificates under constitutional rules.",
            },
            {
                "id": "req_income_ncl",
                "name": "Income Certificate (for OBC Non-Creamy Layer / EWS)",
                "description": "Current financial year income certificate to verify non-creamy layer criteria.",
                "mandatory": False,
                "accepted_types": [
                    "Income Certificate",
                    "ITR Acknowledgment",
                ],
                "official_note": "Mandatory only if applying for OBC-NCL or EWS category reservation.",
            },
        ],
    },
    "Domicile Certificate": {
        "title": "Domicile / Residence Certificate (Niwas Praman Patra)",
        "category": "State Revenue",
        "description": "Proof of permanent or continuous residence in a specific state/district.",
        "official_source": {
            "title": "State Citizen Services Portal",
            "url": "https://serviceonline.gov.in/",
        },
        "requirements": [
            {
                "id": "req_identity",
                "name": "Identity Proof",
                "description": "Photo identity of applicant or guardian.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Voter ID / EPIC Card",
                ],
                "official_note": "Photo ID for applicant.",
            },
            {
                "id": "req_continuous_stay",
                "name": "Proof of Continuous Stay / Ancestral Land",
                "description": "Evidence showing continuous domicile or ancestral property in the state.",
                "mandatory": True,
                "accepted_types": [
                    "Land Deed / Registry / Khatiyan",
                    "Municipal Tax Receipt",
                    "Electricity Bills (Consecutive Years)",
                    "Long-term Registered Lease Agreement",
                ],
                "official_note": "States mandate minimum stay periods (typically 3 to 10+ years) or ancestral land ownership.",
            },
            {
                "id": "req_schooling",
                "name": "Proof of Schooling in State",
                "description": "School passing or transfer certificates from educational institutions within the state.",
                "mandatory": False,
                "accepted_types": [
                    "School Leaving Certificate",
                    "10th / 12th Board Marksheet",
                    "Bonafide Student Certificate",
                ],
                "official_note": "Highly recommended for students seeking state quota admissions.",
            },
            {
                "id": "req_self_declaration",
                "name": "Resident Self-Declaration / Affidavit",
                "description": "Signed declaration affirming permanent residence.",
                "mandatory": True,
                "accepted_types": [
                    "Self-Declaration Form",
                    "Resident Affidavit",
                ],
                "official_note": "Standard e-District self-declaration format.",
            },
        ],
    },
    "Scholarship Application": {
        "title": "Scholarship Application (National Scholarship Portal - NSP)",
        "category": "Education & Student Welfare",
        "description": "Pre-Matric, Post-Matric, and Merit-cum-Means scholarship schemes on NSP.",
        "official_source": {
            "title": "National Scholarship Portal (NSP)",
            "url": "https://scholarships.gov.in/",
        },
        "requirements": [
            {
                "id": "req_student_aadhaar",
                "name": "Student Aadhaar Card (DBT Seeded)",
                "description": "Aadhaar number seeded with bank account for Direct Benefit Transfer.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                ],
                "official_note": "Mandatory biometric identification for DBT scholarship fund dispersal.",
            },
            {
                "id": "req_academic_marksheet",
                "name": "Previous Qualifying Exam Marksheet",
                "description": "Marksheet of the most recently passed examination.",
                "mandatory": True,
                "accepted_types": [
                    "10th Standard / Matriculation Certificate",
                    "12th Standard Marksheet",
                    "College / Degree Marksheet",
                    "Academic Marksheet",
                ],
                "official_note": "Minimum qualifying percentage varies by scheme (typically 50-60%).",
            },
            {
                "id": "req_income_cert",
                "name": "Family Income Certificate",
                "description": "Current income certificate issued by competent state authority.",
                "mandatory": True,
                "accepted_types": [
                    "Income Certificate",
                ],
                "official_note": "Required for all means-tested schemes (typically ceiling of Rs. 2.5 Lakhs/year).",
            },
            {
                "id": "req_bank_passbook",
                "name": "Student Bank Account Passbook",
                "description": "Copy of bank passbook showing student name, account number, and IFSC code.",
                "mandatory": True,
                "accepted_types": [
                    "Bank Account Passbook / Statement",
                ],
                "official_note": "Account must be in the student's own name and active.",
            },
            {
                "id": "req_community_cert",
                "name": "Community / Caste Certificate",
                "description": "Required for SC / ST / OBC / Minority specific scholarship schemes.",
                "mandatory": False,
                "accepted_types": [
                    "Caste Certificate",
                    "Minority Community Certificate",
                ],
                "official_note": "Mandatory only for category-specific quotas.",
            },
        ],
    },
    "PAN Card Application": {
        "title": "PAN Card Application (Form 49A)",
        "category": "Tax & Financial Identity",
        "description": "Allotment of Permanent Account Number for Indian citizens via Protean (NSDL) / UTIITSL.",
        "official_source": {
            "title": "Income Tax Department of India",
            "url": "https://www.incometax.gov.in/",
        },
        "requirements": [
            {
                "id": "req_identity",
                "name": "Proof of Identity (POI)",
                "description": "Document confirming full legal name and photograph.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Voter ID / EPIC Card",
                    "Passport",
                    "Driving Licence",
                ],
                "official_note": "Must match applicant name exactly as declared in Form 49A.",
            },
            {
                "id": "req_address",
                "name": "Proof of Address (POA)",
                "description": "Document establishing communication address for physical card delivery.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Electricity Bill",
                    "Water Bill",
                    "Bank Account Passbook / Statement",
                    "Passport",
                    "Driving Licence",
                ],
                "official_note": "Utility bills must not be older than 3 months.",
            },
            {
                "id": "req_dob",
                "name": "Proof of Date of Birth (PODOB)",
                "description": "Document establishing exact date of birth for tax records.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Birth Certificate",
                    "10th Standard / Matriculation Certificate",
                    "Passport",
                    "Driving Licence",
                ],
                "official_note": "Birth record under Rule 114 of Income Tax Rules.",
            },
        ],
    },
}


def get_all_services() -> list[dict[str, Any]]:
    """Return catalog of standard services."""
    results = []
    for key, val in SERVICE_CATALOG.items():
        results.append({
            "key": key,
            "title": val["title"],
            "category": val["category"],
            "description": val["description"],
            "official_source": val["official_source"],
            "total_requirements": len(val["requirements"]),
            "mandatory_requirements": len([r for r in val["requirements"] if r["mandatory"]]),
        })
    return results


def get_service_requirements(service_name: str) -> dict[str, Any]:
    """Get requirements for a specific service, with dynamic fallback for custom services."""
    matched_key = None
    service_clean = service_name.strip().lower()

    for key in SERVICE_CATALOG:
        if key.lower() == service_clean or key.lower() in service_clean or service_clean in key.lower():
            matched_key = key
            break

    if matched_key:
        data = SERVICE_CATALOG[matched_key]
        return {
            "service": matched_key,
            "title": data["title"],
            "category": data["category"],
            "description": data["description"],
            "official_source": data["official_source"],
            "requirements": data["requirements"],
            "is_custom": False,
        }

    # Dynamic fallback for custom or unlisted government services
    custom_title = service_name.strip() or "Custom Government Service"
    return {
        "service": custom_title,
        "title": custom_title,
        "category": "General Public Service",
        "description": f"Guided document checklist and preparation assessment for {custom_title}.",
        "official_source": {
            "title": "National Portal of India",
            "url": "https://www.india.gov.in/",
        },
        "requirements": [
            {
                "id": "req_custom_identity",
                "name": "Applicant Identity Proof",
                "description": f"Standard photo identity verification required for {custom_title}.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Voter ID / EPIC Card",
                    "PAN Card",
                    "Passport",
                    "Driving Licence",
                ],
                "official_note": "Government photo identity proof.",
            },
            {
                "id": "req_custom_address",
                "name": "Proof of Address / Residence",
                "description": "Document establishing communication or local residential address.",
                "mandatory": True,
                "accepted_types": [
                    "Aadhaar Card",
                    "Electricity Bill",
                    "Water Bill",
                    "Ration Card",
                    "Domicile Certificate",
                    "Bank Account Passbook / Statement",
                ],
                "official_note": "Proof of local address under jurisdiction.",
            },
            {
                "id": "req_custom_supporting",
                "name": "Service-Specific Supporting Documentation",
                "description": f"Official certificate, eligibility proof, or application form relevant to {custom_title}.",
                "mandatory": True,
                "accepted_types": [
                    "Income Certificate",
                    "Caste Certificate",
                    "Birth Certificate",
                    "Academic Marksheet",
                    "Self-Declaration Form",
                    "Land Record (Khatiyan / RoR)",
                ],
                "official_note": "Check exact supporting evidence required on official portal.",
            },
            {
                "id": "req_custom_declaration",
                "name": "Self-Declaration / Prescribed Application Form",
                "description": "Completed application form or signed declaration.",
                "mandatory": False,
                "accepted_types": [
                    "Self-Declaration Form",
                    "Application Form",
                ],
                "official_note": "Signed statement confirming supplied details are true.",
            },
        ],
        "is_custom": True,
    }


def normalize_type_for_matching(raw_type: str | None) -> str:
    """Normalize a document type string to a standard category keyword."""
    if not raw_type:
        return "Unknown"
    text = raw_type.lower()
    if "aadhaar" in text:
        return "Aadhaar Card"
    if "pan" in text:
        return "PAN Card"
    if "income" in text:
        return "Income Certificate"
    if "caste" in text or "community" in text or "jati" in text:
        return "Caste Certificate"
    if "birth" in text:
        return "Birth Certificate"
    if "domicile" in text or "residence" in text or "niwas" in text:
        return "Domicile Certificate"
    if "electric" in text or "power" in text:
        return "Electricity Bill"
    if "water" in text:
        return "Water Bill"
    if "bank" in text or "passbook" in text:
        return "Bank Account Passbook / Statement"
    if "10th" in text or "matric" in text or "marksheet" in text or "academic" in text or "degree" in text or "diploma" in text:
        return "Academic Marksheet"
    if "voter" in text or "epic" in text:
        return "Voter ID / EPIC Card"
    if "ration" in text:
        return "Ration Card"
    if "rent" in text or "lease" in text:
        return "Rent Agreement"
    if "declaration" in text or "affidavit" in text:
        return "Self-Declaration Form"
    return raw_type.strip()


def matches_requirement(doc_normalized: str, raw_doc_type: str, requirement: dict[str, Any]) -> bool:
    """
    Check if a recognized document category satisfies a requirement.
    Enforces strict rules:
    - PAN card satisfies Identity and DOB, but NEVER Address.
    - Aadhaar satisfies Identity, Address, and DOB.
    - Utility bills satisfy Address, but NEVER Identity.
    """
    accepted = [a.lower() for a in requirement.get("accepted_types", [])]
    doc_lower = doc_normalized.lower()
    raw_lower = (raw_doc_type or "").lower()

    # Rule: PAN card NEVER satisfies address proof
    req_name_lower = requirement.get("name", "").lower()
    if "address" in req_name_lower or "residence" in req_name_lower:
        if "pan" in doc_lower or "pan" in raw_lower:
            return False

    # Check direct or partial inclusion
    for acc in accepted:
        if acc in doc_lower or doc_lower in acc:
            return True
        if acc in raw_lower or raw_lower in acc:
            return True

    # Common aliases
    if doc_normalized == "Aadhaar Card":
        if any(term in req_name_lower for term in ["address", "residence", "identity", "date of birth", "dob", "student aadhaar"]):
            return True

    if doc_normalized == "PAN Card":
        if any(term in req_name_lower for term in ["identity", "date of birth", "dob", "poi", "podob"]):
            return True

    if doc_normalized == "Academic Marksheet":
        if any(term in req_name_lower for term in ["marksheet", "academic", "nonecr", "qualifying", "schooling"]):
            return True

    return False


def evaluate_application_readiness(service_name: str, analyzed_documents: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compare recognized document categories against service requirements.
    - Handles duplicates (same document category or same masked identifier).
    - Checks confidence and missing fields to distinguish satisfied vs review_required.
    - Calculates readiness percentage and structured checklist.
    """
    service_info = get_service_requirements(service_name)
    requirements = service_info["requirements"]

    # Deduplicate and organize uploaded documents
    processed_docs: list[dict[str, Any]] = []
    seen_identifiers: set[str] = set()
    seen_types: set[str] = set()

    for item in analyzed_documents:
        analysis = item.get("analysis", {})
        is_relevant = analysis.get("is_relevant_document", False)
        raw_type = analysis.get("document_type") or "Unrecognized Document"
        normalized_type = normalize_type_for_matching(raw_type) if is_relevant else "Unrelated Document"
        filename = item.get("filename", "document")
        file_id = item.get("file_id") or filename

        # Extract identifier fingerprint (e.g. masked Aadhaar/PAN value) for duplicate detection
        identifier_fingerprint = ""
        for field in analysis.get("extracted_fields", []):
            fname = field.get("field", "").lower()
            if any(k in fname for k in ["aadhaar", "pan", "certificate no", "passport", "voter"]):
                fval = str(field.get("value") or "").strip()
                if fval:
                    identifier_fingerprint = f"{normalized_type}:{fval}"
                    break

        is_duplicate = False
        if identifier_fingerprint and identifier_fingerprint in seen_identifiers:
            is_duplicate = True
        elif not identifier_fingerprint and normalized_type in seen_types and normalized_type not in {"Academic Marksheet", "Unknown"}:
            is_duplicate = True

        if not is_duplicate:
            if identifier_fingerprint:
                seen_identifiers.add(identifier_fingerprint)
            seen_types.add(normalized_type)

        # Assess document-level quality
        confidence = "High"
        for field in analysis.get("extracted_fields", []):
            if field.get("confidence") in {"Medium", "Low"}:
                confidence = field.get("confidence")
                break

        has_critical_missing = len(analysis.get("missing_information", [])) > 0
        has_warnings = len(analysis.get("warnings", [])) > 0

        processed_docs.append({
            "file_id": file_id,
            "filename": filename,
            "content_type": item.get("content_type", "image/png"),
            "document_type": raw_type,
            "normalized_type": normalized_type,
            "is_relevant": is_relevant,
            "is_duplicate": is_duplicate,
            "confidence": confidence,
            "summary": analysis.get("summary", ""),
            "extracted_fields_count": len(analysis.get("extracted_fields", [])),
            "extracted_fields": analysis.get("extracted_fields", []),
            "missing_information": analysis.get("missing_information", []),
            "warnings": analysis.get("warnings", []),
            "has_critical_missing": has_critical_missing,
            "matched_requirements": [],
        })

    # Match documents against checklist requirements
    checklist: list[dict[str, Any]] = []
    satisfied_req_ids: set[str] = set()
    review_req_ids: set[str] = set()

    for req in requirements:
        req_id = req["id"]
        req_name = req["name"]
        matching_docs: list[dict[str, Any]] = []

        for doc in processed_docs:
            if not doc["is_relevant"]:
                continue
            if matches_requirement(doc["normalized_type"], doc["document_type"], req):
                matching_docs.append(doc)
                if req_name not in doc["matched_requirements"]:
                    doc["matched_requirements"].append(req_name)

        # Determine status of this requirement
        status = "missing"
        review_reasons: list[str] = []

        if matching_docs:
            # Filter non-duplicates first
            valid_matches = [d for d in matching_docs if not d["is_duplicate"]]
            if not valid_matches:
                valid_matches = matching_docs

            primary = valid_matches[0]
            if primary["confidence"] == "Low":
                status = "review_required"
                review_reasons.append("Document text has low readability confidence.")
            elif primary["has_critical_missing"]:
                status = "review_required"
                review_reasons.extend(primary["missing_information"][:2])
            else:
                status = "satisfied"
                satisfied_req_ids.add(req_id)

            if status == "review_required":
                review_req_ids.add(req_id)

        checklist.append({
            "id": req_id,
            "document": req_name,
            "description": req["description"],
            "mandatory": req["mandatory"],
            "status": status,
            "matched_files": [d["filename"] for d in matching_docs],
            "review_reasons": review_reasons,
            "official_note": req.get("official_note", ""),
        })

    # Review required documents list (documents uploaded that need inspection or are unassigned)
    review_required_docs: list[dict[str, Any]] = []
    for doc in processed_docs:
        if not doc["is_relevant"]:
            review_required_docs.append({
                "filename": doc["filename"],
                "reason": "Unrelated or non-document file detected. Does not satisfy requirements.",
                "type": "Irrelevant",
            })
        elif doc["is_duplicate"]:
            review_required_docs.append({
                "filename": doc["filename"],
                "reason": f"Duplicate document detected ({doc['normalized_type']}). Already applied once.",
                "type": "Duplicate",
            })
        elif not doc["matched_requirements"]:
            review_required_docs.append({
                "filename": doc["filename"],
                "reason": f"Recognized as '{doc['document_type']}', but does not match any current requirement for {service_name}.",
                "type": "Unmatched",
            })
        elif doc["has_critical_missing"] or doc["confidence"] in {"Medium", "Low"}:
            review_required_docs.append({
                "filename": doc["filename"],
                "reason": "Document has readability or missing authority signature notes requiring citizen verification.",
                "type": "Quality / Incomplete",
            })

    # Calculate readiness metrics based on mandatory requirements
    mandatory_reqs = [r for r in checklist if r["mandatory"]]
    total_mandatory = len(mandatory_reqs)
    satisfied_mandatory = len([r for r in mandatory_reqs if r["status"] == "satisfied"])
    review_mandatory = len([r for r in mandatory_reqs if r["status"] == "review_required"])
    missing_mandatory = len([r for r in mandatory_reqs if r["status"] == "missing"])

    if total_mandatory > 0:
        readiness_pct = int(round((satisfied_mandatory / total_mandatory) * 100))
    else:
        readiness_pct = 100

    overall_status = "Ready for official portal" if (missing_mandatory == 0 and review_mandatory == 0) else \
                     "Needs review" if (missing_mandatory == 0 and review_mandatory > 0) else \
                     "Missing required documents"

    # Compile user-facing warnings and advisory
    advisory_warnings: list[str] = [
        "AI-assisted preparation assessment only. Does not guarantee government acceptance or legal eligibility.",
        "Verify final mandatory requirements on the official government portal before manual submission.",
    ]
    if review_mandatory > 0:
        advisory_warnings.append(f"{review_mandatory} mandatory requirement(s) have quality or missing field notices needing your review.")
    if missing_mandatory > 0:
        advisory_warnings.append(f"{missing_mandatory} mandatory requirement(s) are still missing.")

    return {
        "application": {
            "service": service_info["service"],
            "title": service_info["title"],
            "total_requirements": len(checklist),
            "total_mandatory": total_mandatory,
            "satisfied_mandatory": satisfied_mandatory,
            "missing_mandatory": missing_mandatory,
            "review_mandatory": review_mandatory,
            "readiness_percentage": readiness_pct,
            "overall_status": overall_status,
            "total_uploaded": len(processed_docs),
            "relevant_uploaded": len([d for d in processed_docs if d["is_relevant"]]),
        },
        "checklist": checklist,
        "uploaded_documents": processed_docs,
        "review_required": review_required_docs,
        "official_source": service_info["official_source"],
        "warnings": advisory_warnings,
    }
