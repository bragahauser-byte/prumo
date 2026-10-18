import { describe, expect, it } from "vitest";
import { currencies, currencyDecimals } from "@/domain/currencies";
import { formatCurrency } from "@/lib/formatting";
import { centsToMoneyText, moneyTextToCents, normalizeMoneyText } from "./money-input";
import { nextKeypadValue } from "./money-keypad";

describe("money input", () => {
  it("formats typing with thousand separators and up to two decimals", () => {
    expect(normalizeMoneyText("6000")).toBe("6.000");
    expect(normalizeMoneyText("6.000,5")).toBe("6.000,5");
    expect(normalizeMoneyText("1234567,899")).toBe("1.234.567,89");
    expect(normalizeMoneyText(",5")).toBe("0,5");
    expect(normalizeMoneyText("00012")).toBe("12");
    expect(normalizeMoneyText("abc")).toBe("");
    expect(normalizeMoneyText("1500,75", 0)).toBe("1.500");
  });

  it("converts between text and cents", () => {
    expect(moneyTextToCents("6.000")).toBe(600000);
    expect(moneyTextToCents("6.000,5")).toBe(600050);
    expect(moneyTextToCents("")).toBeNull();
    expect(centsToMoneyText(600050)).toBe("6.000,50");
    expect(centsToMoneyText(600000)).toBe("6.000");
    expect(centsToMoneyText(null)).toBe("");
  });
});

describe("currencies", () => {
  it("lists BRL first followed by the ten international currencies in the defined order", () => {
    expect(currencies.map((item) => item.code)).toEqual(["BRL", "USD", "EUR", "JPY", "GBP", "CNY", "AUD", "CAD", "CHF", "HKD", "NZD"]);
  });

  it("formats values with each currency's decimals without converting them", () => {
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("BRL")).toBe(2);
    expect(formatCurrency(150000, "JPY")).toMatch(/1\.500$/);
    expect(formatCurrency(150050, "BRL")).toMatch(/1\.500,50$/);
    expect(nextKeypadValue("15", ",", 0)).toBeNull();
  });
});
