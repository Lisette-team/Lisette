// Day and short month, as the designs write dates ("30 nov. 2026").
export function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(language, { day: "numeric", month: "short", year: "numeric" });
}
