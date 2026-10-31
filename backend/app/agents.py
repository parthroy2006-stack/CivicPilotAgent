from __future__ import annotations

from typing import Any

AGENT_STEPS = [
    ("intake", "Citizen Intake Agent", "Understand the citizen's request and identify missing details."),
    ("discovery", "Service Discovery Agent", "Identify a relevant public service and official source."),
    ("eligibility", "Eligibility Assessment Agent", "Compare supplied facts with retrieved official criteria."),
    ("documents", "Document Preparation Agent", "Create a service-specific checklist and review uploaded material."),
    ("portal", "Portal Preparation Agent", "Prepare a safe navigation and form-filling plan for a supported portal."),
    ("review", "Human Approval Gate", "Present the prepared information for citizen review and authorization."),
]


def run_workflow(request: str, location: str = "", sources: list[dict] | None = None) -> dict[str, Any]:
    """Transparent workflow plan. It never submits a government application."""
    text = f"{request} {location}".lower()
    service = "Government service (needs clarification)"
    if "scholarship" in text:
        service = "Scholarship application"
    elif "income certificate" in text or "income cert" in text:
        service = "Income certificate"
    elif "caste certificate" in text:
        service = "Caste certificate"
    elif "birth certificate" in text:
        service = "Birth certificate"
    elif "pan" in text:
        service = "PAN-related service"

    docs = ["Service-specific application form", "Identity/address proof (only if required by the official service rules)"]
    if "scholarship" in service.lower():
        docs += ["Current academic/enrolment proof", "Income certificate (if required by the selected scheme)", "Bank account details (only where the official scheme requires them)"]
    elif "income" in service.lower():
        docs += ["Income supporting documents specified by the relevant state authority", "Address/residence proof if required"]
    elif "caste" in service.lower():
        docs += ["Caste/community supporting evidence specified by the relevant state authority", "Residence proof if required"]
    else:
        docs += ["Supporting documents listed by the relevant official portal"]

    activities = []
    for key, name, description in AGENT_STEPS:
        status = "completed" if key in {"intake", "discovery"} else "needs_input"
        detail = description
        if key == "discovery":
            detail = f"Potential service identified: {service}. Confirm the state and exact scheme/service before relying on requirements."
        if key == "eligibility":
            detail = "Eligibility cannot be determined until the user provides required facts and official criteria are retrieved."
        if key == "documents":
            detail = "Draft checklist prepared; each item must be checked against the selected official service."
        if key == "portal":
            detail = "Portal automation is not started. A specific supported portal and user authorization are required."
        if key == "review":
            detail = "No submission will occur without explicit citizen review and approval."
        activities.append({"id": key, "agent": name, "description": detail, "status": status})

    return {
        "service": service,
        "location": location or "Not provided",
        "summary": "CivicPilot has prepared an initial service workflow. Confirm the exact service and location, then verify all requirements against official sources.",
        "document_checklist": docs,
        "eligibility": {"status": "needs_information", "message": "This is not an official eligibility decision. Provide the scheme/service name and required facts; criteria must be verified against an official source."},
        "activities": activities,
        "sources": sources or [],
        "approval_required": True,
        "submission_enabled": False,
        "next_steps": ["Confirm the exact service/scheme and state or district.", "Review official eligibility and document requirements.", "Provide only the information needed for this service.", "Review any prepared form before taking action on the official portal."],
    }
