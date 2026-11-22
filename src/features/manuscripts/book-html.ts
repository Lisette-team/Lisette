import { colors } from "@/ui/theme";

import { BOOK_TEXT_JS } from "./book-text";
import { PDFJS, PDFJS_SRI, WORKER_SRI } from "./reader-html";

// StPageFlip 2.0.7 (MIT) from jsDelivr, pinned by a subresource integrity hash computed from the file.
const PAGE_FLIP = "https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js";
const PAGE_FLIP_SRI = "sha384-L4eWrYFdqQ+LoGA0MMuqLqzV13x7SKkQaqacy4MED8e815dS37tTKlO/6xBEUpZW";
// Literata, the app's reading face, for Text mode; Georgia stands in until it loads or offline.
const LITERATA = "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600&display=swap";

export type BookMode = "pages" | "text";
export type BookOptions = {
  mode: BookMode;
  fontSize: number;
  reduceMotion: boolean;
  // {page}, {total} and {percent} are filled in by the page.
  labels: { pages: string; text: string; smaller: string; bigger: string; progress: string; pageOf: string; textProgress: string; preparing: string; noText: string };
};

// Height of the bottom bar (mode, text size, progress). The book area stops above it, so showing or
// hiding the bar never changes the page size or re-flows the text.
const BAR = 100;

// The reading view: one page at a time with a page-turn effect, either the PDF's own pages or its
// text re-flowed for the screen with a chosen size. Like the scrolling viewer it keeps the PDF in
// memory only and has no download control.
export function bookHtml(request: { url: string; token: string; apikey: string; body: object }, options: BookOptions): string {
  // `<` is escaped so the JSON cannot close the script tag.
  const config = JSON.stringify(request).replace(/</g, "\\u003c");
  const settings = JSON.stringify(options).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ro"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LITERATA}">
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: ${colors.paper}; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; font-family: system-ui, -apple-system, Roboto, sans-serif; }
  #book { position: absolute; left: 0; right: 0; top: 0; bottom: ${BAR}px; display: flex; align-items: center; justify-content: center; touch-action: none; }
  .pdf-page { background: #fff; }
  .pdf-page canvas { display: block; width: 100%; height: 100%; }
  .text-page { background: ${colors.surface}; box-sizing: border-box; padding: 26px 22px 34px; font-family: Literata, Georgia, serif; line-height: 1.6; color: ${colors.ink}; }
  .text-body { height: 100%; overflow: hidden; }
  .text-body p { margin: 0; text-indent: 0; text-align: justify; -webkit-hyphens: auto; hyphens: auto; }
  .text-body p.split { text-align-last: justify; }
  .text-body p.gap { margin-top: 1em; }
  .text-body p.gap:first-child { margin-top: 0; }
  .text-body p.center { text-align: center; }
  .text-body p.heading { text-align: center; font-weight: 600; margin: 0.4em 0 0.9em; }
  .folio { position: absolute; left: 0; right: 0; bottom: 10px; text-align: center; font: 12px system-ui, sans-serif; color: ${colors.inkMuted}; }
  #bar { position: fixed; left: 0; right: 0; bottom: 0; height: ${BAR}px; box-sizing: border-box; padding: 10px 16px 12px; background: ${colors.paper}; border-top: 1px solid ${colors.lineSoft}; display: flex; flex-direction: column; justify-content: center; gap: 8px; transition: opacity .2s ease-out; }
  #bar.hidden { opacity: 0; pointer-events: none; }
  .row { display: flex; align-items: center; gap: 10px; }
  .seg { display: flex; padding: 3px; border-radius: 999px; background: ${colors.surfaceMuted}; }
  .seg button { min-height: 34px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; font: 500 14px system-ui, sans-serif; color: ${colors.inkMuted}; }
  .seg button.on { background: ${colors.surface}; color: ${colors.burgundy}; box-shadow: 0 1px 2px rgba(46,31,26,.12); }
  .size { margin-left: auto; display: flex; gap: 8px; }
  .size button { width: 44px; height: 36px; border: 1.5px solid ${colors.burgundy}; border-radius: 999px; background: transparent; color: ${colors.burgundy}; font: 600 15px Literata, Georgia, serif; }
  .size button:disabled { opacity: .35; }
  .size.off { visibility: hidden; }
  input[type=range] { flex: 1; min-width: 0; height: 28px; margin: 0; accent-color: ${colors.burgundy}; }
  #label { font: 500 12px system-ui, sans-serif; color: ${colors.inkMuted}; white-space: nowrap; }
  #notice { position: absolute; left: 16px; right: 16px; top: 12px; z-index: 5; padding: 10px 14px; border-radius: 12px; background: ${colors.primarySoft}; color: ${colors.burgundy}; font: 500 13px/1.4 system-ui, sans-serif; text-align: center; display: none; }
</style>
</head><body oncontextmenu="return false">
<div id="book"></div>
<div id="notice" role="status"></div>
<div id="bar">
  <div class="row">
    <div class="seg" role="radiogroup"><button id="mode-pages" role="radio"></button><button id="mode-text" role="radio"></button></div>
    <div class="size" id="size"><button id="smaller">A−</button><button id="bigger">A+</button></div>
  </div>
  <div class="row"><input id="range" type="range" min="1" max="1" value="1"><span id="label"></span></div>
</div>
<script type="module">
  const config = ${config};
  const options = ${settings};
  const L = options.labels;
  const send = (message) => {
    const text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(text, "*");
  };
  ${BOOK_TEXT_JS}
  const fill = (template, values) => template.replace(/\\{(\\w+)\\}/g, (_, key) => String(values[key] ?? ""));
  const $ = (id) => document.getElementById(id);
  const book = $("book"), bar = $("bar"), range = $("range"), label = $("label"), notice = $("notice");
  const STEPS = [14, 16, 18, 20, 23, 26];
  let mode = options.mode;
  let size = STEPS.includes(options.fontSize) ? options.fontSize : 18;
  let pdf = null, total = 0, ratio = 0.707, flip = null, spread = false, busy = false;
  let current = 0, pdfIndex = 0, position = 0, pageWidth = 0;
  let pdfPages = [], textPages = [], paragraphs = null;

  $("mode-pages").textContent = L.pages;
  $("mode-text").textContent = L.text;
  $("smaller").setAttribute("aria-label", L.smaller);
  $("bigger").setAttribute("aria-label", L.bigger);
  range.setAttribute("aria-label", L.progress);

  const showNotice = (text) => { notice.textContent = text; notice.style.display = "block"; setTimeout(() => { notice.style.display = "none"; }, 4000); };
  const paintControls = () => {
    $("mode-pages").classList.toggle("on", mode === "pages");
    $("mode-text").classList.toggle("on", mode === "text");
    $("mode-pages").setAttribute("aria-checked", String(mode === "pages"));
    $("mode-text").setAttribute("aria-checked", String(mode === "text"));
    $("size").classList.toggle("off", mode !== "text");
    $("smaller").disabled = size === STEPS[0];
    $("bigger").disabled = size === STEPS[STEPS.length - 1];
  };

  // One StPageFlip book over the given pages; it is rebuilt whenever the pages or their size change.
  function createFlip(elements, width, height, start) {
    if (flip) { try { flip.destroy(); } catch {} flip = null; }
    const holder = document.createElement("div");
    holder.style.width = (spread ? width * 2 : width) + "px";
    holder.style.height = height + "px";
    holder.append(...elements);
    book.replaceChildren(holder);
    flip = new St.PageFlip(holder, {
      width, height, size: "fixed", autoSize: false, usePortrait: !spread, showCover: false,
      mobileScrollSupport: false, disableFlipByClick: true, swipeDistance: 30,
      flippingTime: options.reduceMotion ? 1 : 650, drawShadow: !options.reduceMotion,
      showPageCorners: !options.reduceMotion, maxShadowOpacity: 0.3, startPage: start,
    });
    flip.loadFromHTML(elements);
    flip.on("flip", (event) => turned(event.data));
  }

  function turned(index) {
    current = index;
    if (mode === "pages") {
      pdfIndex = index;
      range.max = String(total);
      label.textContent = fill(L.pageOf, { page: index + 1, total });
      renderAround(index);
    } else {
      const page = textPages[index];
      if (!page) return;
      position = page.pos;
      pdfIndex = page.page - 1;
      range.max = String(textPages.length);
      label.textContent = fill(L.textProgress, { percent: Math.round(((index + 1) / textPages.length) * 100), page: page.page });
    }
    range.value = String(index + 1);
  }

  // PDF pages: the page's own shape, as large as the area allows; two side by side when wide.
  function showPdf(start) {
    const area = book.getBoundingClientRect();
    const roomWidth = area.width - 16, roomHeight = area.height - 16;
    spread = area.width > area.height && roomWidth / 2 >= 280;
    pageWidth = Math.floor(Math.min(spread ? roomWidth / 2 : roomWidth, roomHeight * ratio));
    pdfPages = Array.from({ length: total }, () => { const page = document.createElement("div"); page.className = "pdf-page"; return page; });
    createFlip(pdfPages, pageWidth, Math.floor(pageWidth / ratio), Math.min(start, total - 1));
    turned(Math.min(start, total - 1));
  }

  // Only the pages near the reader are drawn; far ones are emptied so a long manuscript stays light.
  const drawing = new Set();
  function renderAround(index) {
    pdfPages.forEach((page, i) => {
      const near = i >= index - 2 && i <= index + 3;
      if (!near && page.firstChild && Math.abs(i - index) > 6) page.replaceChildren();
      if (near && !page.firstChild && !drawing.has(i)) {
        drawing.add(i);
        draw(i, page).catch(() => {}).finally(() => drawing.delete(i));
      }
    });
  }
  async function draw(i, holder) {
    const page = await pdf.getPage(i + 1);
    const scale = (pageWidth / page.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    if (pdfPages[i] === holder) holder.replaceChildren(canvas);
  }

  // Text mode: the text of every page, rebuilt into paragraphs once per opening.
  async function readText() {
    if (paragraphs) return paragraphs;
    const pages = [];
    for (let n = 1; n <= total; n++) {
      if (n % 10 === 1) label.textContent = fill(L.preparing, { percent: Math.round((n / total) * 100) });
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push({ page: n, width: page.getViewport({ scale: 1 }).width, items: content.items.filter((item) => "str" in item).map((item) => ({
        str: item.str, x: item.transform[4], y: item.transform[5], w: item.width,
        h: Math.hypot(item.transform[2], item.transform[3]) || item.height || 10,
      })) });
    }
    paragraphs = buildParagraphs(pages);
    // A scanned PDF has (almost) no text to re-flow.
    if (paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0) < total * 40) paragraphs = [];
    return paragraphs;
  }

  // Splits the paragraphs into screen pages by measuring: whole paragraphs while they fit, then as
  // many words as fit (binary search). Each page remembers where it starts, so a new size or a turn
  // of the phone reopens at the same words.
  async function showText(at) {
    const area = book.getBoundingClientRect();
    spread = area.width > area.height && area.width >= 760;
    const width = Math.floor(spread ? Math.min((area.width - 16) / 2, 520) : area.width - 16);
    const height = Math.floor(area.height - 16);
    const sheet = document.createElement("div");
    sheet.className = "text-page";
    sheet.style.cssText = "position:absolute;left:-20000px;top:0;width:" + width + "px;height:" + height + "px";
    const body = document.createElement("div");
    body.className = "text-body";
    // The size sits on the text block: StPageFlip rewrites the page element's own style.
    body.style.fontSize = size + "px";
    sheet.append(body);
    document.body.append(sheet);
    const fits = () => body.scrollHeight <= body.clientHeight + 1;
    const pages = [];
    let start = { pos: 0, page: paragraphs[0].page };
    const finish = () => {
      const page = document.createElement("div");
      page.className = "text-page";
      const copy = document.createElement("div");
      copy.className = "text-body";
      copy.style.fontSize = size + "px";
      copy.append(...body.childNodes);
      const folio = document.createElement("div");
      folio.className = "folio";
      folio.textContent = String(pages.length + 1);
      page.append(copy, folio);
      pages.push({ el: page, pos: start.pos, page: start.page });
    };
    for (let p = 0; p < paragraphs.length; p++) {
      const paragraph = paragraphs[p];
      const words = paragraph.text.split(" ");
      let w = 0;
      while (w < words.length) {
        if (!body.childNodes.length) start = { pos: p * 100000 + w, page: paragraph.page };
        const line = document.createElement("p");
        // The block's first piece keeps the page's indent and blank line; a piece carried onto the
        // next screen page starts flush.
        line.className = paragraph.heading ? "heading" : paragraph.center ? "center" : "";
        if (w === 0 && paragraph.gap) line.classList.add("gap");
        if (w === 0 && paragraph.indent) line.style.textIndent = paragraph.indent + "em";
        line.textContent = words.slice(w).join(" ");
        body.append(line);
        if (fits()) break;
        let low = 0, high = words.length - w - 1;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          line.textContent = words.slice(w, w + mid).join(" ");
          if (fits()) low = mid; else high = mid - 1;
        }
        if (low === 0 && body.childNodes.length > 1) line.remove();
        else {
          const count = Math.max(low, 1);
          line.textContent = words.slice(w, w + count).join(" ");
          line.classList.add("split");
          w += count;
        }
        finish();
      }
      if (pages.length % 25 === 0) await new Promise((resolve) => setTimeout(resolve));
    }
    if (body.childNodes.length) finish();
    sheet.remove();
    textPages = pages;
    let index = 0;
    while (index + 1 < pages.length && pages[index + 1].pos <= at) index++;
    createFlip(pages.map((page) => page.el), width, height, index);
    turned(index);
  }

  async function setMode(next) {
    if (busy || !pdf) return;
    busy = true;
    try {
      if (next === "text") {
        const text = await readText();
        if (!text.length) { showNotice(L.noText); mode = "pages"; if (!flip) showPdf(pdfIndex); return; }
        mode = "text";
        const first = text.findIndex((paragraph) => paragraph.page >= pdfIndex + 1);
        await showText(Math.max(first, 0) * 100000);
      } else {
        mode = "pages";
        showPdf(pdfIndex);
      }
    } finally {
      busy = false;
      paintControls();
      send({ type: "prefs", mode, fontSize: size });
    }
  }

  async function resize(step) {
    const next = STEPS[STEPS.indexOf(size) + step];
    if (!next || busy || mode !== "text") return;
    busy = true;
    size = next;
    paintControls();
    try { await showText(position); } finally { busy = false; send({ type: "prefs", mode, fontSize: size }); }
  }

  $("mode-pages").addEventListener("click", () => { if (mode !== "pages") void setMode("pages"); });
  $("mode-text").addEventListener("click", () => { if (mode !== "text") void setMode("text"); });
  $("smaller").addEventListener("click", () => void resize(-1));
  $("bigger").addEventListener("click", () => void resize(1));
  range.addEventListener("change", () => {
    if (!flip) return;
    const index = Number(range.value) - 1;
    flip.turnToPage(index);
    turned(index);
  });

  // A tap on the outer edges turns the page, a tap in the middle hides or shows the bar; swipes
  // and drags are StPageFlip's own.
  let down = null;
  book.addEventListener("pointerdown", (event) => { down = { x: event.clientX, y: event.clientY, at: Date.now() }; }, true);
  book.addEventListener("pointerup", (event) => {
    if (!down || !flip || busy) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10 || Date.now() - down.at > 500;
    down = null;
    if (moved) return;
    const x = event.clientX / window.innerWidth;
    if (x < 0.28 || x > 0.72) {
      const step = x < 0.28 ? -1 : 1;
      if (options.reduceMotion) {
        const last = (mode === "pages" ? total : textPages.length) - 1;
        const index = Math.max(0, Math.min(last, current + step * (spread ? 2 : 1)));
        flip.turnToPage(index);
        turned(index);
      } else if (step > 0) flip.flipNext();
      else flip.flipPrev();
    } else {
      const hidden = bar.classList.toggle("hidden");
      send({ type: "chrome", visible: !hidden });
    }
  }, true);

  let resizing = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => { if (!pdf || busy) return; if (mode === "text") void showText(position); else showPdf(pdfIndex); }, 250);
  });

  // fetch() enforces the integrity hash; import() and <script> cannot, so they load checked copies.
  const checked = async (url, integrity) => {
    const response = await fetch(url, { integrity });
    return URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  };
  paintControls();
  try {
    const pdfjs = await import(await checked(${JSON.stringify(`${PDFJS}/pdf.min.mjs`)}, ${JSON.stringify(PDFJS_SRI)}));
    // A sandboxed page (opaque origin) cannot start a module worker from a blob, so PDF.js parses on
    // this thread: it uses globalThis.pdfjsWorker instead of spawning a worker when it is set.
    globalThis.pdfjsWorker = await import(await checked(${JSON.stringify(`${PDFJS}/pdf.worker.min.mjs`)}, ${JSON.stringify(WORKER_SRI)}));
    const flipSource = await checked(${JSON.stringify(PAGE_FLIP)}, ${JSON.stringify(PAGE_FLIP_SRI)});
    await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = flipSource; script.onload = resolve; script.onerror = reject; document.head.append(script); });

    const response = await fetch(config.url, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: "Bearer " + config.token, apikey: config.apikey, "Content-Type": "application/json" },
      body: JSON.stringify(config.body),
    });
    if (!response.ok) { send({ type: "error", status: response.status }); throw null; }
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()), isEvalSupported: false }).promise;
    total = pdf.numPages;
    send({ type: "loaded", pages: total });
    const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
    ratio = first.width / first.height;
    // Text pages are measured in Literata, so wait for it (briefly: offline it falls back to Georgia).
    await Promise.race([document.fonts.load(size + "px Literata"), new Promise((resolve) => setTimeout(resolve, 2500))]).catch(() => {});
    if (mode === "text") { mode = "pages"; await setMode("text"); }
    else showPdf(0);
    paintControls();
  } catch (error) {
    if (error !== null) send({ type: "error", status: 0 });
  }
</script>
</body></html>`;
}
