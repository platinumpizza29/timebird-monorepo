import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

type ThemeName = "light" | "dark" | "system";

type AppThemeContextType = {
  currentTheme: string;
  preferredTheme: ThemeName;
  isLight: boolean;
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useUniwind();
  const systemTheme = useColorScheme() ?? "light";
  const [preferredTheme, setPreferredTheme] = useState<ThemeName>("system");

  const isLight = useMemo(() => {
    return theme === "light";
  }, [theme]);

  const isDark = useMemo(() => {
    return theme === "dark";
  }, [theme]);

  useEffect(() => {
    const resolvedTheme = preferredTheme === "system" ? systemTheme : preferredTheme;
    Uniwind.setTheme(resolvedTheme);
  }, [preferredTheme, systemTheme]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setPreferredTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferredTheme((current) => {
      if (current === "light") return "dark";
      if (current === "dark") return "system";
      return "light";
    });
  }, []);

  const value = useMemo(
    () => ({
      currentTheme: theme,
      preferredTheme,
      isLight,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [theme, preferredTheme, isLight, isDark, setTheme, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
