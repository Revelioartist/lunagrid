const RAW_API_BASE = import.meta.env.VITE_API_BASE || "";

export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

export function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}
