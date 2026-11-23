// Text mode turns PDF pages back into flowing paragraphs. This source runs inside the reader page
// (WebView or iframe), so it stays self-contained; tests load it with new Function.
// shortcut: the page's shape comes from line positions only (breaks, indents, gaps, centring);
// italics, bold and columns are flattened. Upgrade with font analysis if authors need them.
export const BOOK_TEXT_JS = String.raw`
// Romanian words that end in a hyphen on purpose ("într-", "s-"): after a line break they join the
// next word with the hyphen kept ("într-un"); any other word split by a hyphen loses it.
const KEEP_HYPHEN = /^(într|dintr|printr|despr|s|l|m|n|i|ne|v|le|c|ce|și|şi|să|nu|ți|ţi|mi|vi|li)$/i;

function joinLines(before, after) {
  const split = before.match(/(\S+)-$/);
  if (split && /^\p{Ll}/u.test(after)) return KEEP_HYPHEN.test(split[1]) ? before + after : before.slice(0, -1) + after;
  return before + " " + after;
}

// pages: [{ page, width, items: [{ str, x, y, h, w }] }] in reading order, y growing upwards as in PDF.
// Returns blocks [{ text, page, indent, heading, center, gap }] that keep the page's own shape:
// a line that stops short of the right margin ends its block (a line break), an indented line
// starts one with its indent kept (in em of its font size), a larger gap is kept as a blank line,
// centred lines stay centred and wide gaps inside a line stay as tab-like spaces. Lines that run to
// the margin are wrapped text and flow together, so they re-flow for the phone.
function buildParagraphs(pages) {
  const blocks = [];
  const heights = [];
  for (const source of pages) for (const item of source.items) if (item.str.trim()) heights.push(item.h);
  heights.sort((a, b) => a - b);
  const body = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
  const tidy = (text) => text.replace(/[ \t\r\n]+/g, " ").replace(/^ | $/g, "");
  const middle = (values, fallback) => { values.sort((a, b) => a - b); return values.length ? values[Math.floor(values.length / 2)] : fallback; };
  // First the lines of every page, so margins and line spacing come from the whole manuscript:
  // a page with two lines cannot tell where its margin is.
  const pageLines = pages.map((source) => {
    const lines = [];
    let line = null;
    for (const item of source.items) {
      if (!line || Math.abs(item.y - line.y) > Math.max(item.h, line.h) * 0.5) {
        line = { text: "", x: item.x, y: item.y, h: item.h, end: item.x };
        lines.push(line);
      } else {
        const space = item.x - line.end;
        // A wide gap inside a line was a tab; em spaces keep it (they do not collapse or wrap).
        if (space > item.h * 1.5 && line.end > line.x) line.text += "\u2003".repeat(Math.min(8, Math.round(space / item.h)));
        else if (space > item.h * 0.15 && !/\s$/.test(line.text) && !/^\s/.test(item.str)) line.text += " ";
      }
      line.text += item.str;
      line.x = Math.min(line.x, item.x);
      line.h = Math.max(line.h, item.h);
      // A blank item can span a tab's width; only visible text marks where the line ends.
      if (item.str.trim()) line.end = Math.max(line.end, item.x + (item.w || 0));
    }
    return { page: source.page, width: source.width, lines: lines
      .map((each) => ({ ...each, text: tidy(each.text) }))
      // Running page numbers ("12", "- 12 -") are not part of the text.
      .filter((each) => each.text && !/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(each.text)) };
  });
  const all = pageLines.flatMap((source) => source.lines);
  if (!all.length) return blocks;
  const left = Math.min(...all.map((each) => each.x));
  // The right margin: the furthest line end, or the page width less the left margin (margins are
  // usually even), whichever is further.
  const widths = pageLines.map((source) => source.width).filter(Boolean);
  const right = Math.max(...all.map((each) => each.end), widths.length ? Math.min(...widths) - left : 0);
  // Without glyph widths every line looks short; then only indents and gaps can end a block.
  const measured = all.some((each) => each.end > each.x + each.h);
  const spacing = pageLines.flatMap((source) => source.lines.slice(1).map((each, index) => Math.abs(source.lines[index].y - each.y))).filter((gap) => gap > 0);
  const usual = Math.min(middle(spacing, body * 1.2), body * 1.5);
  const flat = pageLines.flatMap((source) => source.lines);
  let open = false;
  let at = 0;
  for (const source of pageLines) {
    source.lines.forEach((each, index) => {
      const offset = each.x - left;
      const indented = offset > each.h * 0.8;
      // A line was broken on purpose when the next line's first word would have fitted after it;
      // otherwise the text simply wrapped (also in ragged-right manuscripts).
      const next = flat[at + 1];
      at++;
      const charWidth = each.text.length ? (each.end - each.x) / each.text.length : each.h * 0.5;
      const room = right - each.end;
      // Widths are estimated from the line's average letter, so the word must fit with room to spare.
      const short = measured && (next ? room > ((next.text.split(" ")[0] || "").length + 1) * charWidth * 1.5 : room > each.h * 3);
      const center = measured && offset > each.h * 2 && Math.abs(offset - (right - each.end)) < each.h * 1.5;
      const heading = each.h > body * 1.25;
      const previous = source.lines[index - 1];
      const gap = !!previous && Math.abs(previous.y - each.y) > usual * 1.5;
      const last = blocks[blocks.length - 1];
      // Text runs on (also across a page) only after a line that reached the margin, into a line
      // that starts at the margin.
      if (last && open && !heading && !indented && !center && !gap) last.text = joinLines(last.text, each.text);
      else blocks.push({ text: each.text, page: source.page, indent: indented && !center && !heading ? Math.min(8, Math.round((offset / each.h) * 2) / 2) : 0, heading, center, gap });
      open = !short && !heading && !center;
    });
  }
  return blocks;
}
`;
