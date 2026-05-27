import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabase before importing api.js ─────────────────────────────────────
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-jwt-token" } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { api } from "../lib/api";

function mockFetchOk(body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status, detail) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("api — auth header", () => {
  it("attaches Bearer token from session", async () => {
    mockFetchOk({ id: "biz-1" });
    await api.getMyBusiness();
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer test-jwt-token");
  });

  it("adds Content-Type: application/json for JSON bodies", async () => {
    mockFetchOk({});
    await api.createBusiness({ name: "Acme" });
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does not set Content-Type for FormData bodies", async () => {
    mockFetchOk({ media_url: "https://cdn.test/img.jpg" });
    const fd = new FormData();
    await api.uploadMedia("biz-1", fd);
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBeUndefined();
  });
});

describe("api — error handling", () => {
  it("throws with detail message on API error", async () => {
    mockFetchError(400, "No photos in library.");
    await expect(api.generatePosts("biz-1")).rejects.toThrow("No photos in library.");
  });

  it("thrown error has .status property", async () => {
    mockFetchError(429, "Quota exceeded.");
    let err;
    try { await api.generatePosts("biz-1"); } catch (e) { err = e; }
    expect(err.status).toBe(429);
  });

  it("falls back to generic message when detail is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: () => Promise.resolve({}),
    });
    await expect(api.getMyBusiness()).rejects.toThrow("API error 500");
  });

  it("signs out and throws on 401", async () => {
    const { supabase } = await import("../lib/supabase");
    mockFetchError(401, "Unauthorized");
    await expect(api.getMyBusiness()).rejects.toThrow(/session expired/i);
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});

describe("api — endpoint paths", () => {
  beforeEach(() => mockFetchOk({}));

  it("getMyBusiness calls GET /businesses/me", async () => {
    await api.getMyBusiness();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/businesses/me"),
      expect.any(Object),
    );
  });

  it("generatePosts calls POST /posts/generate/:id", async () => {
    await api.generatePosts("biz-99");
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("/posts/generate/biz-99");
    expect(opts.method).toBe("POST");
  });

  it("listPosts appends status query param when provided", async () => {
    await api.listPosts("biz-1", "pending_approval");
    expect(global.fetch.mock.calls[0][0]).toContain("?status=pending_approval");
  });

  it("listPosts omits query param when status is not provided", async () => {
    await api.listPosts("biz-1");
    expect(global.fetch.mock.calls[0][0]).not.toContain("?status");
  });

  it("deletePost calls DELETE /posts/:id", async () => {
    await api.deletePost("post-42");
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("/posts/post-42");
    expect(opts.method).toBe("DELETE");
  });

  it("sendApproval calls POST /approve/send with body", async () => {
    const body = { business_id: "biz-1", post_ids: ["p1", "p2"] };
    await api.sendApproval(body);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("/approve/send");
    expect(JSON.parse(opts.body)).toEqual(body);
  });

  it("generateCarousel calls POST /posts/generate-carousel/:id", async () => {
    await api.generateCarousel("biz-1", ["m1", "m2"]);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("/posts/generate-carousel/biz-1");
    expect(JSON.parse(opts.body)).toEqual({ media_library_ids: ["m1", "m2"] });
  });

  it("updatePost calls PATCH /posts/:id", async () => {
    await api.updatePost("post-1", { caption: "Updated" });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("/posts/post-1");
    expect(opts.method).toBe("PATCH");
  });

  it("deleteMedia calls DELETE with correct business and media ids", async () => {
    await api.deleteMedia("biz-1", "media-99");
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain("/businesses/biz-1/media-library/media-99");
    expect(opts.method).toBe("DELETE");
  });
});
