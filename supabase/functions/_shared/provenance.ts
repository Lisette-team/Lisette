/** Normalization used to compare a selection with text extracted from its PDF. */
export function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/<\/?(?:p|blockquote|ul|ol|li|h3)\b[^>]*>|<br\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/gi, (_, entity: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " }[entity.toLowerCase()] ?? _))
    .replace(/\*|~~|__/g, "")
    .replace(/-\s*\r?\n\s*/g, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[„“”«»]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ").trim();
}

/** Fraction of the selection's overlapping three-word sequences found in page order. */
/** The quoted part of a body (the PDF excerpt), or the whole body when nothing is quoted. */
export function quotedText(html: string): string {
  const quotes = [...html.matchAll(/<blockquote>([\s\S]*?)<\/blockquote>/g)].map((match) => match[1]);
  return quotes.length ? quotes.join("") : html;
}

export function matchShare(selection: string, page: string): number {
  const words = normalizeText(selection).match(/[\p{L}\p{N}]+/gu) ?? [];
  const source = normalizeText(page).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 3) return 0;
  let matched = 0;
  let position = 0;
  for (let i = 0; i <= words.length - 3; i++) {
    for (let j = position; j <= source.length - 3; j++) {
      if (source[j] === words[i] && source[j + 1] === words[i + 1] && source[j + 2] === words[i + 2]) {
        matched++;
        position = j + 1;
        break;
      }
    }
  }
  return matched / (words.length - 2);
}
