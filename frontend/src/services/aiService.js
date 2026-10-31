/**
 * CivicPilot AI Service
 *
 * Handles communication between React frontend and FastAPI backend.
 * Multi-Document Intelligence & Application Readiness System.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "/api"
).replace(/\/+$/, "");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

/**
 * Common API request handler
 */
async function apiRequest(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      result && typeof result === "object"
        ? result.detail || result.message
        : result;

    throw new Error(
      detail || `API request failed with status ${response.status}`
    );
  }

  return result;
}

/**
 * AI Assistant chat
 */
export async function chatWithCivicPilot(payload) {
  if (
    !payload ||
    typeof payload.message !== "string" ||
    !payload.message.trim()
  ) {
    throw new Error("Please enter a message.");
  }

  return apiRequest("/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Single document extraction (backward compatibility)
 */
export async function analyzeDocument(file) {
  if (!(file instanceof File)) {
    throw new Error("Please select a document.");
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    throw new Error("Only PDF, PNG and JPG/JPEG files are supported.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File size cannot exceed 10 MB.");
  }

  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/documents/extract", {
    method: "POST",
    body: formData,
  });
}

/**
 * Get catalog of supported government services.
 * GET /api/documents/services
 */
export async function getDocumentServices() {
  return apiRequest("/documents/services", {
    method: "GET",
  });
}

/**
 * Get official document checklist requirements for a service.
 * GET /api/documents/requirements?service={name}
 */
export async function getServiceRequirements(service) {
  const param = encodeURIComponent(service || "Passport Application");
  return apiRequest(`/documents/requirements?service=${param}`, {
    method: "GET",
  });
}

/**
 * Batch extract multiple documents and evaluate application readiness.
 * POST /api/documents/batch-extract
 */
export async function batchExtractDocuments(service, files) {
  if (!files || files.length === 0) {
    throw new Error("Please select at least one document to upload.");
  }

  const formData = new FormData();
  formData.append("service", service || "Passport Application");

  for (const file of files) {
    formData.append("files", file);
  }

  return apiRequest("/documents/batch-extract", {
    method: "POST",
    body: formData,
  });
}

/**
 * Recalculate readiness score and checklist for existing analyzed documents.
 * POST /api/documents/readiness
 */
export async function calculateReadiness(service, documents) {
  return apiRequest("/documents/readiness", {
    method: "POST",
    body: JSON.stringify({
      service: service || "Passport Application",
      documents: documents || [],
    }),
  });
}

/**
 * Retrieve available government sources.
 * GET /api/sources
 */
export async function getSources() {
  return apiRequest("/sources", {
    method: "GET",
  });
}

/**
 * Fetch information from an official source.
 * POST /api/sources/fetch
 */
export async function fetchOfficialSource(payload) {
  return apiRequest("/sources/fetch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Create a new civic-service workflow.
 * POST /api/workflows
 */
export async function createWorkflow(payload) {
  return apiRequest("/workflows", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Retrieve workflow progress.
 * GET /api/workflows/{workflowId}
 */
export async function getWorkflow(workflowId) {
  if (!workflowId) {
    throw new Error("Workflow ID is required.");
  }

  return apiRequest(`/workflows/${encodeURIComponent(workflowId)}`, {
    method: "GET",
  });
}

/**
 * Submit user approval.
 * POST /api/workflows/approval
 */
export async function submitWorkflowApproval(payload) {
  return apiRequest("/workflows/approval", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Check whether CivicPilot backend is running.
 * GET /api/health
 */
export async function getHealth() {
  return apiRequest("/health", {
    method: "GET",
  });
}

const aiService = {
  chatWithCivicPilot,
  analyzeDocument,
  getDocumentServices,
  getServiceRequirements,
  batchExtractDocuments,
  calculateReadiness,
  getSources,
  fetchOfficialSource,
  createWorkflow,
  getWorkflow,
  submitWorkflowApproval,
  getHealth,
};

export default aiService;
