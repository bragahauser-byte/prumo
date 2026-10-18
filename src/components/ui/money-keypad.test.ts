import { describe, expect, it } from "vitest";
import { centsToKeypadValue, keypadValueToCents, nextKeypadValue } from "./money-keypad";

describe("money keypad", () => {
  it("builds values digit by digit with at most two decimals", () => {
    let value = "";
    for (const key of ["1", "2", ",", "5", "0"]) value = nextKeypadValue(value, key) ?? value;
    expect(value).toBe("12,50");
    expect(keypadValueToCents(value)).toBe(1250);
    expect(nextKeypadValue(value, "1")).toBeNull();
    expect(nextKeypadValue(value, ",")).toBeNull();
    expect(nextKeypadValue("0", "7")).toBe("7");
    expect(nextKeypadValue("", ",")).toBe("0,");
    expect(nextKeypadValue("12", "backspace")).toBe("1");
    expect(nextKeypadValue("123456789", "1")).toBeNull();
  });

  it("round-trips cents", () => {
    expect(centsToKeypadValue(150000)).toBe("1500");
    expect(centsToKeypadValue(1205)).toBe("12,05");
    expect(centsToKeypadValue(1250)).toBe("12,5");
    expect(keypadValueToCents("12,5")).toBe(1250);
    expect(keypadValueToCents("")).toBe(0);
  });
});
