import { useEffect, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

/** Saved per device; "system" (the default) follows the phone or computer setting. */
export const THEME_STORAGE_KEY = "kk-theme";

/** Browser/status-bar colour for each look (matches --background in index.css). */
const THEME_COLORS = { light: "#FAFAFA", dark: "#0F0F0F" } as const;

/** Keeps the iPhone status bar and Android address bar the same colour as the app. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
    document.documentElement.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
  }, [resolvedTheme]);
  return null;
}

/** Light, dark or "same as my phone", switched with the `dark` class on <html>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey={THEME_STORAGE_KEY} disableTransitionOnChange>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
