import { describe, expect, it } from "vitest";
import { jstDateKey, jstDayNumber } from "./jst-date";

describe("jstDateKey", () => {
  it.each([
    ["2026-11-05T00:00:00.000Z", "2026-11-05"],
    ["2026-01-31T15:00:00.000Z", "2026-02-01"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"],
    ["2028-02-28T15:00:00.000Z", "2028-02-29"],
  ])("R-1: %s は JST で %s である", (instant, expected) => {
    expect(jstDateKey(new Date(instant))).toBe(expected);
  });

  it("R-2: JST の 0 時で日付が切り替わる", () => {
    expect(jstDateKey(new Date("2026-11-05T14:59:59.999Z"))).toBe("2026-11-05");
    expect(jstDateKey(new Date("2026-11-05T15:00:00.000Z"))).toBe("2026-11-06");
  });

  it("R-3: 不正な Date はエラーにする", () => {
    expect(() => jstDateKey(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("jstDayNumber", () => {
  it("R-2: JST の 0 時で通算日が 1 増える", () => {
    const before = jstDayNumber(new Date("2026-11-05T14:59:59.999Z"));
    const after = jstDayNumber(new Date("2026-11-05T15:00:00.000Z"));
    expect(after).toBe(before + 1);
  });

  it("R-2: JST の 1970-01-01 が通算日 0 である", () => {
    expect(jstDayNumber(new Date("1969-12-31T15:00:00.000Z"))).toBe(0);
  });

  it("R-3: 不正な Date はエラーにする", () => {
    expect(() => jstDayNumber(new Date(Number.NaN))).toThrow(RangeError);
  });
});
