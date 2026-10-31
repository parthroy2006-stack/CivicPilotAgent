/**
 * CivicPilot AI Service
 *
 * Handles communication between React frontend
 * and Python FastAPI backend.
 *
 * Gemini API calls happen on the backend.
 * Never expose your Gemini API key in frontend code.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"
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

  const contentType =
    response.headers.get("content-type") || "";

  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      result && typeof result === "object"
        ? result.detail || result.message
        : result;

    throw new Error(
      detail || `API request failed: ${response.status}`
    );
  }

  return result;
}
/**
 * CivicPilot AI Assistant
 *
 * Backend route: POST /api/chat
 *
 * Uses civicpilot_assistant_prompt.txt
 * through the Python backend.
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
 * CivicPilot Document Intelligence
 *
 * Backend route: POST /api/documents/extract
 *
 * Uses civicpilot_document_intake_prompt.txt
 * through the Python backend.
 */

export async function analyzeDocument(file) {

  if (!(file instanceof File)) {
    throw new Error("Please select a document.");
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    throw new Error(
      "Only PDF, PNG and JPG/JPEG files are supported."
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "File size cannot exceed 10 MB."
    );
  }

  const formData = new FormData();

  formData.append("file", file);

  return apiRequest("/documents/extract", {
    method: "POST",
    body: formData,
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

  return apiRequest(
    `/workflows/${encodeURIComponent(workflowId)}`,
    {
      method: "GET",
    }
  );
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

  getSources,

  fetchOfficialSource,

  createWorkflow,

  getWorkflow,

  submitWorkflowApproval,

  getHealth,

};

export default aiService;