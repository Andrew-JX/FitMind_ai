/**
 * The design's brand neon.
 *
 * @remarks
 * Deliberately not a per-theme token. The handoff fixes this exact value in
 * both themes for the brand button, the FAB, the logo, the toast outline and
 * the highlighted chart bar. Reach for {@link ThemeColors.ac} instead whenever
 * the element is supposed to darken in light mode.
 */
export const BRAND_NEON = "#c8f035";

/** Foreground on a {@link BRAND_NEON} fill; also theme-invariant. */
export const BRAND_NEON_TEXT = "#0f0f0f";

/** RGB channels of {@link BRAND_NEON}, for translucent derivatives. */
const BRAND_NEON_RGB = "200, 240, 53";

/**
 * Translucent brand neon, for rings, glows, and keyframes on brand chrome.
 *
 * @param alpha - Opacity between 0 and 1
 * @returns An `rgba()` string that is identical in both themes
 */
export function brandAlpha(alpha: number): string {
  return `rgba(${BRAND_NEON_RGB}, ${alpha})`;
}

/**
 * Translucent accent, which unlike {@link brandAlpha} follows the theme.
 *
 * @param theme - Active theme
 * @param alpha - Opacity between 0 and 1
 * @returns An `rgba()` string built from the theme's accent channels
 */
export function accentAlpha(theme: Theme, alpha: number): string {
  return `rgba(${theme.colors.accentRgb}, ${alpha})`;
}

export interface ThemeColors {
  bg: string;
  surf: string;
  surf2: string;
  surf3: string;
  bdr: string;
  bdr2: string;
  tx: string;
  tx2: string;
  tx3: string;
  ac: string;
  acText: string;
  /** RGB channels of {@link ThemeColors.ac}, consumed by `accentAlpha`. */
  accentRgb: string;
  blue: string;
  red: string;
  orange: string;
  green: string;
  purple: string;
  pink: string;
  /** Dimmed accent for supporting accent text (design --fm-accDim). */
  accDim: string;
  /** Translucent inner surface for nested blocks (design --fm-soft). */
  soft: string;
  /** Hairline divider inside cards (design --fm-div). */
  divider: string;
  /** Top inner highlight used in card/inset insets (design --fm-sheen). */
  sheen: string;
  /** Drawer grab-handle color (design --fm-grab). */
  grab: string;
  /** Inactive chart-bar fill (design --fm-bar). */
  bar: string;
  /** Glass slider gradient stops for segmented controls (design --fm-glassA/B/C). */
  glassA: string;
  glassB: string;
  glassC: string;
  /** Elevation shadow tones (design --fm-sh25 / --fm-sh40). */
  sh25: string;
  sh40: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeFonts {
  body: string;
  mono: string;
}

export interface ThemeShadows {
  card: string;
}

export interface ThemeGradients {
  /** Top micro-sheen layered over a card surface (design card range). */
  card: string;
}

export interface Theme {
  colors: ThemeColors;
  fonts: ThemeFonts;
  gradients: ThemeGradients;
  isDark: boolean;
  radius: {
    card: string;
    control: string;
    pill: string;
    soft: string;
    /** Bottom-drawer top corners (design 24px). */
    sheet: string;
    /** True capsule / pill shape (design 999px). */
    capsule: string;
  };
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
}

const sharedCardGradient =
  "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))";

const sharedFonts: ThemeFonts = {
  body: "-apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif",
  mono: "'SF Mono', 'Menlo', 'Consolas', monospace",
};

const sharedSpacing: ThemeSpacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
};

export const darkTheme: Theme = {
  isDark: true,
  colors: {
    bg: "#0f0f0f",
    surf: "#1a1a1a",
    surf2: "#222222",
    surf3: "#2c2c2c",
    bdr: "rgba(255,255,255,0.08)",
    bdr2: "rgba(255,255,255,0.15)",
    tx: "#f0f0f0",
    tx2: "#999999",
    tx3: "#555555",
    ac: BRAND_NEON,
    acText: BRAND_NEON_TEXT,
    accentRgb: BRAND_NEON_RGB,
    blue: "#4a9eff",
    red: "#ff5c5c",
    orange: "#ff9b42",
    green: "#4ade80",
    purple: "#a78bfa",
    pink: "#f472b6",
    accDim: "rgba(200,240,53,0.6)",
    soft: "rgba(255,255,255,0.04)",
    divider: "rgba(255,255,255,0.06)",
    sheen: "rgba(255,255,255,0.06)",
    grab: "rgba(255,255,255,0.18)",
    bar: "rgba(255,255,255,0.14)",
    glassA: "rgba(255,255,255,0.16)",
    glassB: "rgba(255,255,255,0.05)",
    glassC: "rgba(255,255,255,0.22)",
    sh25: "rgba(0,0,0,0.25)",
    sh40: "rgba(0,0,0,0.4)",
  },
  fonts: sharedFonts,
  gradients: {
    card: sharedCardGradient,
  },
  radius: {
    card: "20px",
    control: "12px",
    pill: "20px",
    soft: "10px",
    sheet: "24px",
    capsule: "999px",
  },
  shadows: {
    card: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.25)",
  },
  spacing: sharedSpacing,
};

export const lightTheme: Theme = {
  isDark: false,
  colors: {
    bg: "#f2f2f7",
    surf: "#ffffff",
    surf2: "#e9e9ef",
    surf3: "#dededc",
    bdr: "rgba(0,0,0,0.08)",
    bdr2: "rgba(0,0,0,0.14)",
    tx: "#1c1c1e",
    tx2: "#6d6d72",
    tx3: "#94949a",
    ac: "#5c7404",
    acText: "#ffffff",
    accentRgb: "92, 116, 4",
    blue: "#1a6fd4",
    red: "#c93030",
    orange: "#c06010",
    green: "#1a9a46",
    purple: "#6d28d9",
    pink: "#c0306a",
    accDim: "rgba(92,116,4,0.65)",
    soft: "rgba(0,0,0,0.04)",
    divider: "rgba(0,0,0,0.07)",
    sheen: "rgba(255,255,255,0.6)",
    grab: "rgba(0,0,0,0.18)",
    bar: "rgba(0,0,0,0.12)",
    glassA: "#ffffff",
    glassB: "rgba(255,255,255,0.88)",
    glassC: "rgba(255,255,255,0.95)",
    sh25: "rgba(0,0,0,0.08)",
    sh40: "rgba(0,0,0,0.14)",
  },
  fonts: sharedFonts,
  gradients: {
    card: sharedCardGradient,
  },
  radius: {
    card: "20px",
    control: "12px",
    pill: "20px",
    soft: "10px",
    sheet: "24px",
    capsule: "999px",
  },
  shadows: {
    card: "inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 24px rgba(0,0,0,0.08)",
  },
  spacing: sharedSpacing,
};

export type SemanticTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "analysis"
  | "neutral";

export function getToneColors(
  theme: Theme,
  tone: SemanticTone,
): {
  background: string;
  border: string;
  text: string;
} {
  const alpha = theme.isDark ? 0.18 : 0.12;

  if (tone === "accent") {
    return buildTone(theme.colors.ac);
  }

  if (tone === "success") {
    return buildTone(theme.colors.green);
  }

  if (tone === "warning") {
    return buildTone(theme.colors.orange);
  }

  if (tone === "danger") {
    return buildTone(theme.colors.red);
  }

  if (tone === "info") {
    return buildTone(theme.colors.blue);
  }

  if (tone === "analysis") {
    return buildTone(theme.colors.purple);
  }

  return {
    background: theme.colors.surf2,
    border: theme.colors.bdr,
    text: theme.colors.tx2,
  };

  function buildTone(color: string) {
    return {
      background: withAlpha(color, alpha),
      border: withAlpha(color, alpha + 0.12),
      text: color,
    };
  }
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const safeAlpha = Math.max(0, Math.min(alpha, 1));
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha.toFixed(2)})`;
}
