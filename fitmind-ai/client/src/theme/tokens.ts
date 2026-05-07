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
  blue: string;
  red: string;
  orange: string;
  green: string;
  purple: string;
  pink: string;
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

export interface Theme {
  colors: ThemeColors;
  fonts: ThemeFonts;
  isDark: boolean;
  radius: {
    card: string;
    control: string;
    pill: string;
    soft: string;
  };
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
}

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
    ac: "#c8f035",
    acText: "#0f0f0f",
    blue: "#4a9eff",
    red: "#ff5c5c",
    orange: "#ff9b42",
    green: "#4ade80",
    purple: "#a78bfa",
    pink: "#f472b6",
  },
  fonts: sharedFonts,
  radius: {
    card: "14px",
    control: "12px",
    pill: "20px",
    soft: "10px",
  },
  shadows: {
    card: "none",
  },
  spacing: sharedSpacing,
};

export const lightTheme: Theme = {
  isDark: false,
  colors: {
    bg: "#f0f0ee",
    surf: "#ffffff",
    surf2: "#e8e8e6",
    surf3: "#dededc",
    bdr: "rgba(0,0,0,0.08)",
    bdr2: "rgba(0,0,0,0.15)",
    tx: "#111111",
    tx2: "#666666",
    tx3: "#aaaaaa",
    ac: "#4a8c00",
    acText: "#ffffff",
    blue: "#1a6fd4",
    red: "#c93030",
    orange: "#c06010",
    green: "#1a9a46",
    purple: "#6d28d9",
    pink: "#c0306a",
  },
  fonts: sharedFonts,
  radius: {
    card: "14px",
    control: "12px",
    pill: "20px",
    soft: "10px",
  },
  shadows: {
    card: "0 1px 3px rgba(0,0,0,0.04)",
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

export function getToneColors(theme: Theme, tone: SemanticTone): {
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
