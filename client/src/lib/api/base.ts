const rawBackendOrigin = (import.meta.env.VITE_BACKEND_URL || "https://canteenconnect-backend.onrender.com").trim();

export const BACKEND_ORIGIN = rawBackendOrigin.replace(/\/+$/, "");

export function withApiOrigin(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (!BACKEND_ORIGIN) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_ORIGIN}${normalizedPath}`;
}
