import { describe, expect, it } from "vitest";
import { generateOccurrenceDates } from "./recurrence";

describe("recurring occurrence dates", () => {
  it("clamps monthly dates to the last day of short months", () => {
    expect(generateOccurrenceDates({
      frequency: "monthly",
      startsOn: "2024-01-31",
      dueDay: 31,
    }, "2024-04-30")).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
      "2024-04-30",
    ]);
  });

  it("clamps annual leap-day commitments in non-leap years", () => {
    expect(generateOccurrenceDates({
      frequency: "yearly",
      startsOn: "2024-02-29",
      dueDay: 29,
    }, "2028-02-29")).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("keeps weekly dates stable across month and year boundaries", () => {
    expect(generateOccurrenceDates({
      frequency: "weekly",
      startsOn: "2026-12-25",
      dueDay: null,
    }, "2027-01-08")).toEqual(["2026-12-25", "2027-01-01", "2027-01-08"]);
  });

  it("honors the optional end date", () => {
    expect(generateOccurrenceDates({
      frequency: "monthly",
      startsOn: "2026-01-10",
      dueDay: 10,
      endsOn: "2026-02-10",
    }, "2026-04-10")).toEqual(["2026-01-10", "2026-02-10"]);
  });

  it("starts weekly generation at the next occurrence without shifting weekdays", () => {
    expect(generateOccurrenceDates({
      frequency: "weekly",
      startsOn: "2024-01-03",
      dueDay: null,
    }, "2024-02-01", "2024-01-18")).toEqual(["2024-01-24", "2024-01-31"]);
  });

  it("limits monthly generation to a future window", () => {
    expect(generateOccurrenceDates({
      frequency: "monthly",
      startsOn: "2020-01-31",
      dueDay: 31,
    }, "2026-04-30", "2026-02-01")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("supports custom intervals aligned to the start date", () => {
    expect(generateOccurrenceDates({ frequency: "weekly", startsOn: "2026-01-01", dueDay: null, interval: 2 }, "2026-02-01", "2026-01-10"))
      .toEqual(["2026-01-15", "2026-01-29"]);
    expect(generateOccurrenceDates({ frequency: "monthly", startsOn: "2026-01-10", dueDay: 10, interval: 3 }, "2026-12-31", "2026-02-01"))
      .toEqual(["2026-04-10", "2026-07-10", "2026-10-10"]);
    expect(generateOccurrenceDates({ frequency: "yearly", startsOn: "2026-03-01", dueDay: 1, interval: 2 }, "2031-12-31"))
      .toEqual(["2026-03-01", "2028-03-01", "2030-03-01"]);
  });

  it("rejects intervals outside 1 to 12", () => {
    expect(() => generateOccurrenceDates({ frequency: "monthly", startsOn: "2026-01-10", dueDay: 10, interval: 0 }, "2026-12-31")).toThrow(RangeError);
  });
});
