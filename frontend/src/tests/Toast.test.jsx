import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Toast from "../components/Common/Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the message", () => {
    render(<Toast msg="Post saved!" onClose={() => {}} />);
    expect(screen.getByText("Post saved!")).toBeInTheDocument();
  });

  it("shows checkmark icon for ok type", () => {
    render(<Toast msg="Done" type="ok" onClose={() => {}} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("shows exclamation icon for err type", () => {
    render(<Toast msg="Error!" type="err" onClose={() => {}} />);
    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("defaults to ok type when type is not provided", () => {
    render(<Toast msg="Default" onClose={() => {}} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("calls onClose when dismiss button is clicked", () => {
    const onClose = vi.fn();
    render(<Toast msg="Msg" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose automatically after 3.5 seconds", () => {
    const onClose = vi.fn();
    render(<Toast msg="Auto" onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3500); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not auto-close before 3.5 seconds", () => {
    const onClose = vi.fn();
    render(<Toast msg="Wait" onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has status role for screen readers", () => {
    render(<Toast msg="Accessible" onClose={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
