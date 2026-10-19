import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPlatform, hapticSuccess, hapticTap } from "./haptics";

describe("haptics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("vibrates briefly on the web when supported", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    hapticTap();
    hapticSuccess();
    expect(vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(vibrate).toHaveBeenNthCalledWith(2, [40, 70, 40, 70, 120]);
  });

  it("fails silently without vibration support", () => {
    expect(() => hapticTap()).not.toThrow();
    expect(() => hapticSuccess()).not.toThrow();
  });

  it("uses the native haptics API inside a native shell", () => {
    const impact = vi.fn(() => Promise.resolve());
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: { Haptics: { impact } } };
    expect(detectPlatform()).toBe("native");
    hapticTap();
    expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
  });
});
