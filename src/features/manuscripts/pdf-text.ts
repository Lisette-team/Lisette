// This source runs inside the PDF viewer on both web and native; keep it self-contained.
// PDF geometry only approximates indentation and paragraph boundaries.
export const pdfTextReconstruction = String.raw`function reconstructPdfText(items, pageLeft) {
 if (!items.length) return "";
 const left = pageLeft ?? Math.min(...items.map((item) => item.transform[4]));
 let result = "";
 let previous;
 for (let index = 0; index < items.length; index++) {
  const item = items[index];
  const x = item.transform[4], y = item.transform[5];
  if (!previous || Math.abs(y - previous.transform[5]) > Math.max(item.height, previous.height) * 0.5) {
   if (previous) {
    const next = items.slice(index + 1).find((candidate) => Math.abs(candidate.transform[5] - y) > item.height * 0.5);
    const indentedParagraph = x - left > item.height && next && Math.abs(next.transform[4] - left) < item.height && Math.abs(y - next.transform[5]) <= item.height * 1.6;
    result += Math.abs(y - previous.transform[5]) > Math.max(item.height, previous.height) * 1.6 || indentedParagraph ? "\n\n" : "\n";
   }
   result += " ".repeat(Math.min(20, Math.max(0, Math.round((x - left) / Math.max(item.height, 1)))));
  }
  const font = item.fontName + " " + (item.style || "");
  const bold = /bold/i.test(font), italic = /italic|oblique/i.test(font);
  const marker = bold && italic ? "***" : bold ? "**" : italic ? "*" : "";
  result += marker ? item.str.replace(/^(\s*)(.*?)(\s*)$/, (_match, before, content, after) => content ? before + marker + content + marker + after : item.str) : item.str;
  previous = item;
 }
 return result;
}`;
