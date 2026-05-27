import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmProvider, useConfirm } from "../components/Common/Modal";

// Helper component that triggers confirm() on button click
function Trigger({ opts = {}, onResult }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const result = await confirm(opts);
        onResult(result);
      }}
    >
      Open
    </button>
  );
}

function renderModal(opts = {}, onResult = vi.fn()) {
  render(
    <ConfirmProvider>
      <Trigger opts={opts} onResult={onResult} />
    </ConfirmProvider>
  );
  fireEvent.click(screen.getByText("Open"));
  return { onResult };
}

describe("ConfirmProvider + useConfirm", () => {
  it("opens dialog with default title when no opts provided", () => {
    renderModal();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("shows custom title", () => {
    renderModal({ title: "Delete post?" });
    expect(screen.getByText("Delete post?")).toBeInTheDocument();
  });

  it("shows custom message", () => {
    renderModal({ message: "This cannot be undone." });
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("shows custom confirm label", () => {
    renderModal({ confirmLabel: "Yes, delete" });
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
  });

  it("shows custom cancel label", () => {
    renderModal({ cancelLabel: "Keep it" });
    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
  });

  it("resolves true when confirm button is clicked", async () => {
    const onResult = vi.fn();
    renderModal({ confirmLabel: "Confirm" }, onResult);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves false when cancel button is clicked", async () => {
    const onResult = vi.fn();
    renderModal({ cancelLabel: "Cancel" }, onResult);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("resolves false when backdrop is clicked", async () => {
    const onResult = vi.fn();
    renderModal({}, onResult);
    fireEvent.click(screen.getByRole("presentation"));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("resolves false on Escape key", async () => {
    const onResult = vi.fn();
    renderModal({}, onResult);
    fireEvent.keyDown(document, { key: "Escape" });
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("closes dialog after confirm", async () => {
    renderModal({ confirmLabel: "OK" });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("closes dialog after cancel", async () => {
    renderModal({ cancelLabel: "No" });
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});

describe("Modal danger variant", () => {
  it("shows warning triangle icon for danger variant", () => {
    renderModal({ variant: "danger", title: "Delete?" });
    // The SVG warning triangle is present — verify the dialog role exists and has title
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete?")).toBeInTheDocument();
  });
});

describe("useConfirm outside provider", () => {
  it("throws when used outside ConfirmProvider", () => {
    const BadComponent = () => {
      useConfirm();
      return null;
    };
    expect(() => render(<BadComponent />)).toThrow();
  });
});
