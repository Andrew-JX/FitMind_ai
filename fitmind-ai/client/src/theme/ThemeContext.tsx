/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { darkTheme, lightTheme, type Theme } from "./tokens";

export interface ThemeContextValue {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provides the mobile UI theme state for the current frontend shell.
 *
 * @param props - Child tree that should receive the current theme
 * @returns Theme provider wrapper
 */
export function ThemeProvider(props: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      isDark,
      setIsDark,
      theme,
      toggleTheme: () => setIsDark((currentValue) => !currentValue),
    };
  }, [isDark, theme]);

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

/**
 * Reads the current frontend theme context.
 *
 * @returns Current theme, mode flag, and toggler
 */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return value;
}
