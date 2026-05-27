import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock Logo so we don't need Supabase context ───────────────────────────────
vi.mock("../components/Common/Logo", () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

import ApproveResult from "../components/Approve/ApproveResult";

function renderWithPath(pathname, search = "") {
  Object.defineProperty(window, "location", {
    value: { pathname, search, href: `http://localhost${pathname}${search}` },
    writable: true,
    configurable: true,
  });
  return render(<ApproveResult />);
}

describe("ApproveResult — success", () => {
  it("shows posts approved heading with count from query param", () => {
    renderWithPath("/approve/success", "?count=3");
    expect(screen.getByText(/3 posts approved/i)).toBeInTheDocument();
  });

  it("handles singular post count", () => {
    renderWithPath("/approve/success", "?count=1");
    expect(screen.getByText(/1 post approved/i)).toBeInTheDocument();
  });

  it("defaults to 0 when count param is missing", () => {
    renderWithPath("/approve/success");
    expect(screen.getByText(/0 posts approved/i)).toBeInTheDocument();
  });

  it("mentions scheduling in body text", () => {
    renderWithPath("/approve/success", "?count=2");
    expect(screen.getByText(/queued for scheduling/i)).toBeInTheDocument();
  });
});

describe("ApproveResult — expired", () => {
  it("shows expired heading", () => {
    renderWithPath("/approve/expired");
    expect(screen.getByText(/link has expired/i)).toBeInTheDocument();
  });

  it("mentions 7 days in body", () => {
    renderWithPath("/approve/expired");
    expect(screen.getByText(/7 days/i)).toBeInTheDocument();
  });
});

describe("ApproveResult — already-used", () => {
  it("shows already approved heading", () => {
    renderWithPath("/approve/already-used");
    expect(screen.getByText(/already approved/i)).toBeInTheDocument();
  });
});

describe("ApproveResult — invalid", () => {
  it("shows invalid link heading", () => {
    renderWithPath("/approve/invalid");
    expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
  });
});

describe("ApproveResult — unknown segment", () => {
  it("falls back to invalid variant for unknown paths", () => {
    renderWithPath("/approve/unknown-segment");
    expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
  });
});

describe("ApproveResult — shared UI", () => {
  it("renders the logo", () => {
    renderWithPath("/approve/success", "?count=1");
    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });

  it("shows powered-by footer", () => {
    renderWithPath("/approve/success", "?count=1");
    expect(screen.getByText(/powered by socio/i)).toBeInTheDocument();
  });
});
