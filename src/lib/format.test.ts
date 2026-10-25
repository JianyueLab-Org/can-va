import { describe, expect, test } from "bun:test";
import {
  formatCredits,
  formatDay,
  formatUtc,
  parseCredits,
  wholeNumber,
} from "./format";

describe("formatCredits", () => {
  test("minor units to two decimals with grouping", () => {
    expect(formatCredits(123456, "en-us")).toBe("1,234.56");
    expect(formatCredits(15_000_000_000, "en-us")).toBe("150,000,000.00");
  });
  test("negative balances keep the sign", () => {
    expect(formatCredits(-5, "en-us")).toBe("-0.05");
  });
});

describe("parseCredits", () => {
  test("whole and fractional credits", () => {
    expect(parseCredits("1500")).toBe(150000);
    expect(parseCredits(" 12.5 ")).toBe(1250);
    expect(parseCredits("0.07")).toBe(7);
  });
  test("rejects what is not a non-negative amount with at most two decimals", () => {
    for (const bad of ["", "abc", "-1", "1.234", "1,000", "1e3"]) {
      expect(parseCredits(bad)).toBeNull();
    }
  });
});

describe("UTC formatting", () => {
  test("formatUtc normalises any offset to UTC minutes", () => {
    expect(formatUtc("2026-10-24T08:05:31+08:00")).toBe("2026-10-24 00:05Z");
    expect(formatUtc("2026-10-24T23:59:59Z")).toBe("2026-10-24 23:59Z");
  });
  test("formatDay is the UTC date", () => {
    expect(formatDay("2026-10-25T01:00:00+08:00")).toBe("2026-10-24");
  });
  test("unparseable input is returned unchanged", () => {
    expect(formatUtc("soon")).toBe("soon");
    expect(formatDay("soon")).toBe("soon");
  });
});

describe("wholeNumber", () => {
  test("accepts non-negative integers, trimmed", () => {
    expect(wholeNumber("0")).toBe(0);
    expect(wholeNumber(" 12 ")).toBe(12);
  });
  test("rejects blank, whitespace, fractions, negatives and words", () => {
    for (const bad of ["", " ", "1.5", "-1", "abc"]) {
      expect(wholeNumber(bad)).toBeNull();
    }
  });
});
