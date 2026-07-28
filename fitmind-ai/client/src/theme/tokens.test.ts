import { describe, expect, it } from "vitest";

import {
  accentAlpha,
  brandAlpha,
  BRAND_NEON,
  BRAND_NEON_TEXT,
  darkTheme,
  lightTheme,
} from "./tokens";

describe("brand tokens", () => {
  it("pins the design's neon and its foreground", () => {
    expect(BRAND_NEON).toBe("#c8f035");
    expect(BRAND_NEON_TEXT).toBe("#0f0f0f");
  });

  it("stays identical across themes, which is the point of the token", () => {
    // The brand neon is theme-invariant by design (button / FAB / logo / toast
    // / highlighted bar). `ac` is the one that darkens in light mode.
    expect(darkTheme.colors.ac).toBe(BRAND_NEON);
    expect(lightTheme.colors.ac).not.toBe(BRAND_NEON);
  });

  it("builds translucent brand values from the same channels", () => {
    expect(brandAlpha(0.35)).toBe("rgba(200, 240, 53, 0.35)");
    expect(brandAlpha(0)).toBe("rgba(200, 240, 53, 0)");
  });
});

describe("accentAlpha", () => {
  it("follows the theme, unlike brandAlpha", () => {
    expect(accentAlpha(darkTheme, 0.12)).toBe("rgba(200, 240, 53, 0.12)");
    expect(accentAlpha(lightTheme, 0.12)).toBe("rgba(92, 116, 4, 0.12)");
  });

  it("keeps each theme's channels in sync with its accent color", () => {
    expect(darkTheme.colors.accentRgb).toBe("200, 240, 53");
    // #5c7404
    expect(lightTheme.colors.accentRgb).toBe("92, 116, 4");
  });
});
