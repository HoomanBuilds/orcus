import { darkTheme } from "@rainbow-me/rainbowkit";

export const orcusTheme = darkTheme({
  accentColor: "#4f8ef7",
  accentColorForeground: "#f0f0f0",
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "small",
});

// Patch card and modal backgrounds to match design system
(orcusTheme.colors as Record<string, string>).modalBackground       = "#111113";
(orcusTheme.colors as Record<string, string>).modalBorder           = "#1e1e21";
(orcusTheme.colors as Record<string, string>).profileForeground     = "#111113";
(orcusTheme.colors as Record<string, string>).menuItemBackground    = "#1e1e21";
(orcusTheme.colors as Record<string, string>).generalBorder         = "#1e1e21";
(orcusTheme.colors as Record<string, string>).generalBorderDim      = "#1e1e21";
(orcusTheme.colors as Record<string, string>).connectButtonBackground = "#111113";
(orcusTheme.colors as Record<string, string>).connectButtonText     = "#f0f0f0";
