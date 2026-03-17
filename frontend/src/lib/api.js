const RAW_API_BASE = import.meta.env.VITE_API_BASE || "";

export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export function apiFetch(path, init = {}) {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });
}

export async function readApiError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }
  }

  const text = await response.text().catch(() => "");
  return text.trim() || `HTTP ${response.status}`;
}

export function normalizeApiErrorMessage(message) {
  const text = String(message || "").trim();
  if (!text) {
    return "Request failed.";
  }
  if (/Authentication required|Invalid or expired session|User not found/i.test(text)) {
    return "Please log in to continue.";
  }
  return text;
}
