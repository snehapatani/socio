import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Auth header helper ──────────────────────────────────────────────
// supabase.auth.getSession() is cache-only (no network) — cheap to call.
async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// ── Request wrapper ─────────────────────────────────────────────────
async function req(path, opts = {}) {
  const headers = { ...(await authHeader()), ...opts.headers };

  // If the body is NOT FormData, default to JSON.
  // If it IS FormData, don't set Content-Type at all (let the browser do it).
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  // Global 401 → sign the user out so the app re-routes to landing.
  if (res.status === 401) {
    await supabase.auth.signOut().catch(() => {});
    const err = new Error("Your session expired. Please sign in again.");
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.detail || `API error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── API surface ─────────────────────────────────────────────────────
export const api = {
  // Businesses
  createBusiness:  (data)            => req("/businesses/",                  { method: "POST",  body: JSON.stringify(data) }),
  getMyBusiness:   ()                => req("/businesses/me"),
  getBusiness:     (id)              => req(`/businesses/${id}`),
  updateBusiness:  (id, data)        => req(`/businesses/${id}`,             { method: "PATCH", body: JSON.stringify(data) }),

  // Media
  uploadMedia:     (id, formData)    => req(`/businesses/${id}/upload-media`,    { method: "POST", body: formData }),
  mediaLibrary:    (id)              => req(`/businesses/${id}/media-library`),
  getPendingMedia: (id)              => req(`/businesses/${id}/pending-media`),
  uploadPending:   (id, formData)    => req(`/businesses/${id}/upload-pending`,  { method: "POST", body: formData }),
  deleteMedia: (businessId, mediaId) =>  req(`/businesses/${businessId}/media-library/${mediaId}`, { method: "DELETE" }),
  generateCarousel: (businessId, mediaLibraryIds) =>
  req(`/posts/generate-carousel/${businessId}`, {
    method: "POST",
    body: JSON.stringify({ media_library_ids: mediaLibraryIds }),
  }),

  // Posts
  generatePosts:   (businessId)      => req(`/posts/generate/${businessId}`,     { method: "POST" }),
  generateAIImage: (businessId)      => req(`/posts/generateAIImage/${businessId}`, { method: "POST" }),
  listPosts:       (businessId, status) =>
                                        req(`/posts/business/${businessId}${status ? `?status=${status}` : ""}`),
  updatePost:      (id, data, businessId) => req(`/posts/${id}?business_id=${businessId}`, { method: "PATCH", body: JSON.stringify(data) }),
  publishPost:     (id)              => req(`/posts/${id}/publish`,              { method: "POST" }),
  fetchInsights:   (id)              => req(`/posts/${id}/insights`,             { method: "POST" }),
  deletePost:       (postId)         => req(`/posts/${postId}`, { method: "DELETE" }),

  // Approval
  sendApproval:    (data)            => req("/approve/send",                     { method: "POST", body: JSON.stringify(data) }),

  // Dashboard
  getDashboard:    (businessId)      => req(`/dashboard/${businessId}`),

  // ── Admin (require profiles.role = 'admin' on backend) ──────────
  adminStats:           ()           => req("/admin/stats"),
  adminListBusinesses:  ()           => req("/admin/businesses"),
  adminGetBusiness:     (id)         => req(`/admin/businesses/${id}`),
  adminUpdateBusiness:  (id, data)   => req(`/admin/businesses/${id}`,           { method: "PATCH", body: JSON.stringify(data) }),
  adminSuspendBusiness: (id)         => req(`/admin/businesses/${id}/suspend`,   { method: "POST" }),
  adminDeleteBusiness:  (id) => req(`/admin/businesses/${id}`,         { method: "DELETE" }),
  adminRestoreBusiness: (id) => req(`/admin/businesses/${id}/restore`, { method: "POST" }),
  adminPurgeBusiness:   (id) => req(`/admin/businesses/${id}/purge`,   { method: "DELETE" }),
};

// ── Instagram OAuth connect URL ─────────────────────────────────────
// This is a browser-navigation URL, not a fetch — JWT can't ride along
// in headers. Two options for the backend `/auth/login` route:
//   1. Issue a short-lived signed nonce client-side and include it as a
//      query param; verify it server-side on receipt.
//   2. Require the OAuth callback handler to verify the user owns the
//      business_id (e.g. by reading the JWT from a cookie set elsewhere,
//      or by re-checking ownership when storing the access_token).
export const getConnectUrl = (businessId) =>
  `${BASE}/auth/login?business_id=${businessId}`;
