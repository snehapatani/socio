import { describe, it, expect } from "vitest";
import { fmt, num } from "../lib/format";

describe("fmt", () => {
  it("returns em-dash for null", () => {
    expect(fmt(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(fmt(undefined)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(fmt("")).toBe("—");
  });

  it("returns a formatted string for a valid ISO date", () => {
    const result = fmt("2026-05-26T18:00:00Z");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });

  it("returns a string for an invalid date (browser doesn't throw)", () => {
    // new Date("not-a-date") doesn't throw — it returns an Invalid Date object
    // whose toLocaleString returns "Invalid Date", so fmt passes that through.
    const result = fmt("not-a-date");
    expect(typeof result).toBe("string");
  });
});

describe("num", () => {
  it("returns '0' for null", () => {
    expect(num(null)).toBe("0");
  });

  it("returns '0' for undefined", () => {
    expect(num(undefined)).toBe("0");
  });

  it("returns locale string for small numbers", () => {
    expect(num(42)).toBe("42");
  });

  it("formats thousands with K suffix", () => {
    expect(num(1500)).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(num(2_500_000)).toBe("2.5M");
  });

  it("formats exactly 1000 as K", () => {
    expect(num(1000)).toBe("1.0K");
  });

  it("formats exactly 1_000_000 as M", () => {
    expect(num(1_000_000)).toBe("1.0M");
  });

  it("returns '0' for zero", () => {
    expect(num(0)).toBe("0");
  });
});
