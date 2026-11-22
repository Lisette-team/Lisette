import { useEffect, useState } from "react";

import { colors } from "@/ui/theme";

import { gatewayRequest } from "./api";
import { bookHtml, type BookOptions } from "./book-html";
import { pdfTextReconstruction } from "./pdf-text";

// PDF.js 6.4.299 (2026-10-03) from cdnjs, pinned by subresource integrity hashes computed from the files.
export const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299";
export const PDFJS_SRI = "sha384-QCvhu/UPp22U/TNLVbQNONL82ES2yY717GAiqP9VVu37Y7+m9VPKvadGx9XlFvcp";
export const WORKER_SRI = "sha384-NfW/OTMWezITv4oaALvfH7MFLwzPxEvpySmDpoALa1mtTY8MC200l0ZNFD+SOlrM";

export type ReaderMessage = { type: "loaded"; pages: number } | { type: "aspect"; ratio: number } | { type: "rendered" } | { type: "error"; status: number } | { type: "selection"; text: string; page: number } | { type: "pageSelection"; start: number; end: number } | { type: "prefs"; mode: "pages" | "text"; fontSize: number } | { type: "chrome"; visible: boolean };

// Page picking keeps one contiguous range: a tap outside extends it, an end tap shrinks it (the
// last page clears it), a middle tap ends the range there. Kept as source so the WebView runs it.
export const PAGE_RANGE_JS = `function nextRange(range, n) {
  if (!range) return [n, n];
  const [start, end] = range;
  if (n < start) return [n, end];
  if (n > end) return [start, n];
  if (start === end) return null;
  if (n === start) return [start + 1, end];
  if (n === end) return [start, end - 1];
  return [start, n];
}`;

// The viewer fetches the PDF into memory from the gateway and draws pages as they scroll into view.
// A text layer is added only in selection mode; neither mode exposes a download control.
export function readerHtml(request: { url: string; token: string; apikey: string; body: object }, paper: string, selection = false, selectionLabel = "Folosește selecția", pageSelection = false, thumbnailPage?: number): string {
  // `<` is escaped so the JSON cannot close the script tag.
  const config = JSON.stringify(request).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; background: ${paper}; }
  body { padding: ${thumbnailPage ? "0" : "12px 0"}; -webkit-user-select: ${selection ? "text" : "none"}; user-select: ${selection ? "text" : "none"}; }
  .page { position: relative; margin: ${thumbnailPage ? "0" : "0 auto 12px"}; max-width: 900px; width: ${thumbnailPage ? "100%" : "calc(100% - 24px)"}; background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  canvas { display: block; width: 100%; }
  .textLayer { position:absolute; inset:0; overflow:hidden; opacity:1; line-height:1; text-align:initial; transform-origin:0 0; --min-font-size:1; --text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv:calc(1 / var(--min-font-size)); }
  .textLayer span, .textLayer br { color:transparent; position:absolute; white-space:pre; transform-origin:0 0; cursor:text; }
  .textLayer > :not(.markedContent), .textLayer .markedContent span:not(.markedContent) { --font-height:0; font-size:calc(var(--text-scale-factor) * var(--font-height)); --scale-x:1; --rotate:0deg; transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
  .textLayer .markedContent { display:contents; }
  .textLayer ::selection { background:rgba(122,34,51,.3); }
  .page.selected { outline: 4px solid #7A2233; outline-offset: -4px; }
  .use-selection { position:fixed; bottom:12px; left:50%; transform:translateX(-50%); z-index:10; padding:12px; border:0; border-radius:8px; background:#7A2233; color:white; }
</style>
</head><body oncontextmenu="${selection ? "" : "return false"}">
<script type="module">
  const config = ${config};
  const selectionMode = ${selection};
  const pageSelectionMode = ${pageSelection};
  ${PAGE_RANGE_JS}
  let pageRange = null;
  const send = (message) => {
    const text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(text, "*");
  };
  ${pdfTextReconstruction}
  let cachedSelection = null;
  if (selectionMode) document.addEventListener("selectionchange", () => {
    const selected = window.getSelection();
    if (!selected || selected.isCollapsed || !selected.rangeCount) return;
    const range = selected.getRangeAt(0);
    const start = range.startContainer.parentElement?.closest(".page");
    const end = range.endContainer.parentElement?.closest(".page");
    if (!start || start !== end) { cachedSelection = null; return; }
    const items = start.pdfItems;
    let text = selected.toString();
    if (items) {
      const spans = [...start.querySelectorAll(".textLayer span")];
      const chosen = [];
      spans.forEach((span, index) => {
        const item = items[index];
        if (!item || !range.intersectsNode(span)) return;
        let begin = 0, finish = item.str.length;
        if (span.contains(range.startContainer)) begin = range.startOffset;
        if (span.contains(range.endContainer)) finish = range.endOffset;
        if (finish > begin) chosen.push({ ...item, str: item.str.slice(begin, finish) });
      });
      if (chosen.length) text = reconstructPdfText(chosen, Math.min(...items.map(item => item.transform[4])));
    }
    cachedSelection = { type: "selection", text, page: Number(start.dataset.page) };
  });
  if (selectionMode || pageSelectionMode) {
    const button = document.createElement("button");
    button.textContent = ${JSON.stringify(selectionLabel)};
    button.className = "use-selection";
    button.addEventListener("pointerdown", event => event.preventDefault());
    button.addEventListener("click", () => {
      if (pageSelectionMode) { if (pageRange) send({ type: "pageSelection", start: pageRange[0], end: pageRange[1] }); return; }
      if (cachedSelection) send(cachedSelection);
    });
    document.body.append(button);
  }
  // fetch() enforces the integrity hash; import() and Worker() cannot, so they load the checked copies.
  const checked = async (url, integrity) => {
    const response = await fetch(url, { integrity });
    return URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  };
  try {
    const pdfjs = await import(await checked(${JSON.stringify(`${PDFJS}/pdf.min.mjs`)}, ${JSON.stringify(PDFJS_SRI)}));
    // A sandboxed page (opaque origin) cannot start a module worker from a blob, so PDF.js parses on
    // this thread: it uses globalThis.pdfjsWorker instead of spawning a worker when it is set.
    globalThis.pdfjsWorker = await import(await checked(${JSON.stringify(`${PDFJS}/pdf.worker.min.mjs`)}, ${JSON.stringify(WORKER_SRI)}));

    const response = await fetch(config.url, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: "Bearer " + config.token, apikey: config.apikey, "Content-Type": "application/json" },
      body: JSON.stringify(config.body),
    });
    if (!response.ok) { send({ type: "error", status: response.status }); throw null; }
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()), isEvalSupported: false }).promise;
    send({ type: "loaded", pages: pdf.numPages });

    const draw = async (div) => {
      const page = await pdf.getPage(Number(div.dataset.page));
      const scale = (div.clientWidth / page.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      div.style.aspectRatio = "";
      div.replaceChildren(canvas);
      await page.render({ canvas, viewport }).promise;
      ${thumbnailPage ? 'send({ type: "rendered" });' : ""}
      if (selectionMode) {
        const layer = document.createElement("div");
        layer.className = "textLayer";
        const cssScale = div.clientWidth / page.getViewport({ scale: 1 }).width;
        const cssViewport = page.getViewport({ scale: cssScale });
        div.style.setProperty("--total-scale-factor", String(cssScale));
        div.append(layer);
        const content = await page.getTextContent();
        div.pdfItems = content.items.filter(item => "str" in item).map(item => {
          let font;
          try { font = page.commonObjs.get(item.fontName); } catch { /* Font metadata is optional. */ }
          return { ...item, style: [content.styles[item.fontName]?.fontFamily, font?.name, font?.bold ? "Bold" : "", font?.italic ? "Italic" : ""].filter(Boolean).join(" ") };
        });
        await new pdfjs.TextLayer({ textContentSource: content, container: layer, viewport: cssViewport }).render();
      }
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { observer.unobserve(entry.target); draw(entry.target); }
      }
    }, { rootMargin: "100% 0px" });
    const first = (await pdf.getPage(${thumbnailPage ?? 1})).getViewport({ scale: 1 });
    ${thumbnailPage ? 'send({ type: "aspect", ratio: first.width / first.height });' : ""}
    for (let n = ${thumbnailPage ?? 1}; n <= ${thumbnailPage ?? "pdf.numPages"}; n++) {
      const div = document.createElement("div");
      div.className = "page";
      div.dataset.page = String(n);
      if (pageSelectionMode) div.addEventListener("click", () => {
        pageRange = nextRange(pageRange, n);
        document.querySelectorAll(".page").forEach(page => { const p = Number(page.dataset.page); page.classList.toggle("selected", !!pageRange && p >= pageRange[0] && p <= pageRange[1]); });
      });
      div.style.aspectRatio = first.width + " / " + first.height;
      document.body.append(div);
      observer.observe(div);
    }
  } catch (error) {
    if (error !== null) send({ type: "error", status: 0 });
  }
</script>
</body></html>`;
}

// Builds the viewer page for one version with a fresh access token. `book` (BookOptions as JSON, so
// it stays one stable value) asks for the page-turning reader instead of the scrolling one.
export function useReaderHtml(versionId: string, submissionId?: string, materialId?: string, selection = false, selectionLabel?: string, shareVersionId?: string, pageSelection = false, thumbnailPage?: number, book?: string): string | null {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void gatewayRequest(versionId, submissionId, materialId).then((request) => {
      const target = shareVersionId ? { ...request, body: { ...request.body, shareVersionId, versionId: "" } } : request;
      if (active) setHtml(book ? bookHtml(target, JSON.parse(book) as BookOptions) : readerHtml(target, colors.paper, selection, selectionLabel, pageSelection, thumbnailPage));
    });
    return () => {
      active = false;
    };
  }, [versionId, submissionId, materialId, selection, selectionLabel, shareVersionId, pageSelection, thumbnailPage, book]);
  return html;
}
