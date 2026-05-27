import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Stubs ─────────────────────────────────────────────────────────────────────
vi.mock("../components/Common/StatusPill", () => ({
  default: ({ status }) => <span data-testid="status-pill">{status}</span>,
}));

vi.mock("../lib/format", () => ({
  fmt: (iso) => (iso ? "May 26, 6:00 PM" : "—"),
}));

import PostCard from "../components/Dashboard/PostCard";

const BASE_POST = {
  id: "post-1",
  caption: "This is a test caption",
  hashtags: ["coffee", "morning"],
  status: "pending_approval",
  media_type: "IMAGE",
  media_urls: ["https://cdn.example.com/photo.jpg"],
  scheduled_at: "2026-05-26T18:00:00Z",
};

function mkPost(overrides = {}) {
  return { ...BASE_POST, ...overrides };
}

function mkHandlers(overrides = {}) {
  return {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onUpload: vi.fn(),
    uploading: false,
    ...overrides,
  };
}

describe("PostCard — content", () => {
  it("renders caption text", () => {
    render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    expect(screen.getByText("This is a test caption")).toBeInTheDocument();
  });

  it("renders hashtags", () => {
    render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    expect(screen.getByText(/#coffee/)).toBeInTheDocument();
  });

  it("renders status pill", () => {
    render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    expect(screen.getByTestId("status-pill")).toHaveTextContent("pending_approval");
  });

  it("renders image from media_urls", () => {
    const { container } = render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    // img has alt="" (decorative) so its ARIA role is "presentation", not "img"
    const img = container.querySelector('img[src="https://cdn.example.com/photo.jpg"]');
    expect(img).toBeInTheDocument();
  });

  it("shows View on Instagram link when ig_permalink present", () => {
    const post = mkPost({ ig_permalink: "https://www.instagram.com/p/abc", status: "published" });
    render(<PostCard post={post} {...mkHandlers()} />);
    expect(screen.getByRole("link", { name: /view on instagram/i })).toBeInTheDocument();
  });

  it("does not show Instagram link when no ig_permalink", () => {
    render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    expect(screen.queryByRole("link", { name: /view on instagram/i })).not.toBeInTheDocument();
  });

  it("shows error message for failed posts", () => {
    const post = mkPost({ status: "failed", error_message: "IG rate limit exceeded" });
    render(<PostCard post={post} {...mkHandlers()} />);
    expect(screen.getByText("IG rate limit exceeded")).toBeInTheDocument();
  });
});

describe("PostCard — actions for pending_approval", () => {
  it("shows edit caption button", () => {
    render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    expect(screen.getByRole("button", { name: /edit caption/i })).toBeInTheDocument();
  });

  it("calls onEdit with post when edit clicked", () => {
    const handlers = mkHandlers();
    render(<PostCard post={BASE_POST} {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /edit caption/i }));
    expect(handlers.onEdit).toHaveBeenCalledWith(BASE_POST);
  });

  it("shows delete button", () => {
    render(<PostCard post={BASE_POST} {...mkHandlers()} />);
    expect(screen.getByRole("button", { name: /delete post/i })).toBeInTheDocument();
  });

  it("calls onDelete with post when delete clicked", () => {
    const handlers = mkHandlers();
    render(<PostCard post={BASE_POST} {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /delete post/i }));
    expect(handlers.onDelete).toHaveBeenCalledWith(BASE_POST);
  });
});

describe("PostCard — actions for published post", () => {
  const published = mkPost({ status: "published", ig_permalink: "https://www.instagram.com/p/x" });

  it("does not show edit caption button", () => {
    render(<PostCard post={published} {...mkHandlers()} />);
    expect(screen.queryByRole("button", { name: /edit caption/i })).not.toBeInTheDocument();
  });

  it("does not show delete button", () => {
    render(<PostCard post={published} {...mkHandlers()} />);
    expect(screen.queryByRole("button", { name: /delete post/i })).not.toBeInTheDocument();
  });
});

describe("PostCard — approved post", () => {
  const approved = mkPost({ status: "approved" });

  it("shows delete button but not edit caption", () => {
    render(<PostCard post={approved} {...mkHandlers()} />);
    expect(screen.getByRole("button", { name: /delete post/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit caption/i })).not.toBeInTheDocument();
  });
});

describe("PostCard — carousel", () => {
  const carousel = mkPost({
    media_type: "CAROUSEL",
    media_urls: [
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
      "https://cdn.example.com/c.jpg",
    ],
  });

  it("renders thumbnail strip", () => {
    render(<PostCard post={carousel} {...mkHandlers()} />);
    // Three slide thumbnail buttons
    const slideButtons = screen.getAllByRole("button", { name: /show .* 1|show .* 2|show .* 3/i });
    expect(slideButtons.length).toBe(3);
  });

  it("shows carousel indicator badge", () => {
    render(<PostCard post={carousel} {...mkHandlers()} />);
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
  });

  it("does not show change media label for carousel", () => {
    render(<PostCard post={carousel} {...mkHandlers()} />);
    expect(screen.queryByText(/change photo/i)).not.toBeInTheDocument();
  });
});

describe("PostCard — no media", () => {
  const noMedia = mkPost({ media_urls: [] });

  it("shows upload prompt for pending post with no media", () => {
    render(<PostCard post={noMedia} {...mkHandlers()} />);
    expect(screen.getByText(/upload photo or video/i)).toBeInTheDocument();
  });

  it("shows 'No media' for non-pending post with no media", () => {
    const post = mkPost({ media_urls: [], status: "approved" });
    render(<PostCard post={post} {...mkHandlers()} />);
    expect(screen.getByText(/no media/i)).toBeInTheDocument();
  });

  it("shows 'Uploading…' when uploading prop is true", () => {
    render(<PostCard post={noMedia} {...mkHandlers({ uploading: true })} />);
    expect(screen.getByText(/uploading…/i)).toBeInTheDocument();
  });
});
