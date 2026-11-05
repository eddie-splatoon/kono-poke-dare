import { describe, expect, it } from "vitest";
import { isDateKey } from "./date-key";

describe("isDateKey", () => {
  it.each(["2026-11-05", "2028-02-29", "1970-01-01"])(
    "R-19: 実在する日付 %s を受け入れる",
    (value) => {
      expect(isDateKey(value)).toBe(true);
    },
  );

  it.each([
    "2026-02-30",
    "2027-02-29",
    "2026-13-01",
    "2026-11-5",
    "2026-11-05T00:00:00.000Z",
    " 2026-11-05",
    "",
    20261105,
    null,
    undefined,
    {},
  ])("R-19: 不正な値 %j を拒否する", (value) => {
    expect(isDateKey(value)).toBe(false);
  });
});
