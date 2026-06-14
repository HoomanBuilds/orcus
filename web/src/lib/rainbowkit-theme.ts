import { lightTheme } from "@rainbow-me/rainbowkit";

export const orcusTheme = lightTheme({
  accentColor: "#111111",
  accentColorForeground: "#ffffff",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

// Patch to match Orcus light design system
const c = orcusTheme.colors as Record<string, string>;

c.modalBackground         = "#ffffff";
c.modalBorder             = "rgba(0,0,0,0.08)";
c.modalBackdrop           = "rgba(0,0,0,0.35)";
c.profileForeground       = "#fafaf8";
c.menuItemBackground      = "rgba(0,0,0,0.03)";
c.generalBorder           = "rgba(0,0,0,0.08)";
c.generalBorderDim        = "rgba(0,0,0,0.05)";
c.connectButtonBackground = "#111111";
c.connectButtonText       = "#ffffff";
c.connectButtonInnerBackground = "#111111";
c.connectButtonTextError  = "#dc2626";
c.actionButtonBorder      = "rgba(0,0,0,0.08)";
c.actionButtonBorderMobile = "rgba(0,0,0,0.08)";
c.actionButtonSecondaryBackground = "rgba(0,0,0,0.04)";
c.closeButton             = "rgba(0,0,0,0.4)";
c.closeButtonBackground   = "rgba(0,0,0,0.05)";
c.error                   = "#dc2626";
c.selectedOptionBorder    = "rgba(0,0,0,0.12)";

// Fonts
(orcusTheme.fonts as Record<string, string>).body =
  "var(--font-ibm-plex), system-ui, sans-serif";

// Shadows - subtle
(orcusTheme.shadows as Record<string, string>).connectButton =
  "0 4px 16px rgba(0,0,0,0.12)";
(orcusTheme.shadows as Record<string, string>).dialog =
  "0 8px 40px rgba(0,0,0,0.12)";
(orcusTheme.shadows as Record<string, string>).profileDetailsAction =
  "0 2px 8px rgba(0,0,0,0.06)";
(orcusTheme.shadows as Record<string, string>).selectedOption =
  "0 0 0 2px rgba(0,0,0,0.1)";
(orcusTheme.shadows as Record<string, string>).selectedWallet =
  "0 0 0 2px rgba(0,0,0,0.08)";
(orcusTheme.shadows as Record<string, string>).walletLogo =
  "0 2px 8px rgba(0,0,0,0.08)";
