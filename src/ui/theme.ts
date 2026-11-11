// Approved palette and typefaces from brand/brand.yaml (approved 2026-10-17).
// Muted and line tones are working values from docs/design/tokens.json.
export const colors = {
  burgundy: "#7A2233",
  gold: "#C99A4E",
  paper: "#F6EFE3",
  ink: "#2E1F1A",
  nightBurgundy: "#3A121C",
  inkMuted: "#6A5D56",
  line: "#9C8D80",
  field: "#FCF8F1",
  surfaceMuted: "#EFE6D8",
  shadow: "#2E1F1A24",
  onBurgundy: "#FFFFFF",
} as const;

export const fonts = {
  heading: "Newsreader_600SemiBold",
  headingItalic: "Newsreader_400Regular_Italic",
  reading: "Literata_400Regular",
  ui: "Inter_400Regular",
  uiMedium: "Inter_500Medium",
  uiSemiBold: "Inter_600SemiBold",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { field: 12, pill: 999 } as const;

// Content column width on tablets and web, so actions never stretch or clip.
export const contentMaxWidth = 480;
