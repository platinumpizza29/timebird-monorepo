import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

// Theme provider wrapper to share theme context app-wide.
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { useTheme } from "next-themes";
