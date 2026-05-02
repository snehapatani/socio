const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const headers = { ...opts.headers };

  // If the body is NOT FormData, default to JSON
  // If it IS FormData, don't set Content-Type at all (let the browser do it)
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: headers,
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Businesses
  createBusiness:  (data)           => req("/businesses/",                   { method: "POST", body: JSON.stringify(data) }),
  getBusiness:     (id)             => req(`/businesses/${id}`),
  updateBusiness:  (id, data)       => req(`/businesses/${id}`,              { method: "PATCH", body: JSON.stringify(data) }),
  //uploadMedia:     (id, formData)   => fetch(`${BASE}/businesses/${id}/upload`, { method: "POST", body: formData }).then(r => r.json()),

  // Posts
  generatePosts:   (businessId)     => req(`/posts/generate/${businessId}`,  { method: "POST" }),
  listPosts:       (businessId, status) => req(`/posts/business/${businessId}${status ? `?status=${status}` : ""}`),
  updatePost:      (id, data)       => req(`/posts/${id}`,                   { method: "PATCH", body: JSON.stringify(data) }),
  publishPost:     (id)             => req(`/posts/${id}/publish`,           { method: "POST" }),
  fetchInsights:   (id)             => req(`/posts/${id}/insights`,          { method: "POST" }),

  // Approval
  sendApproval:    (data)           => req("/approve/send",                  { method: "POST", body: JSON.stringify(data) }),

  // Dashboard
  getDashboard:    (businessId)     => req(`/dashboard/${businessId}`),

  // Add to the api object in lib/api.js:
  uploadMedia: (id, formData)    => req(`/businesses/${id}/upload-media`,  {method: "POST", body: formData}),
  mediaLibrary: (id)            => req(`/businesses/${id}/media-library`),
  getPendingMedia:    (id)           => req(`/businesses/${id}/pending-media`),
  uploadPending:      (id, formData) => fetch(`${BASE}/businesses/${id}/upload-pending`, {method: "POST", body: formData}).then(r => r.json()),

  //Generate AI Image
  generateAIImage:   (businessId)     => req(`/posts/generateAIImage/${businessId}`,  { method: "POST" }),
};

export const getConnectUrl = (businessId) =>
  `${BASE}/auth/login?business_id=${businessId}`;
