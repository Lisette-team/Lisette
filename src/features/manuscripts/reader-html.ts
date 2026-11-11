import { useEffect, useState } from "react";

import { colors } from "@/ui/theme";

import { gatewayRequest } from "./api";

// PDF.js 6.4.299 (2026-10-03) from cdnjs, pinned by subresource integrity hashes computed from the files.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299";
const PDFJS_SRI = "sha384-QCvhu/UPp22U/TNLVbQNONL82ES2yY717GAiqP9VVu37Y7+m9VPKvadGx9XlFvcp";
const WORKER_SRI = "sha384-NfW/OTMWezITv4oaALvfH7MFLwzPxEvpySmDpoALa1mtTY8MC200l0ZNFD+SOlrM";

export type ReaderMessage = { type: "loaded"; pages: number } | { type: "error"; status: number };

// A self-contained read-only viewer. It fetches the PDF from the gateway itself, so the bytes stay in
// this page's memory: nothing is written to app storage, and the response is `no-store`. Pages are
// drawn on canvases (no text layer, no download control) only as they scroll into view.
export function readerHtml(request: Awaited<ReturnType<typeof gatewayRequest>>, paper: string): string {
  // `<` is escaped so the JSON cannot close the script tag.
  const config = JSON.stringify(request).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; background: ${paper}; }
  body { padding: 12px 0; -webkit-user-select: none; user-select: none; }
  .page { margin: 0 auto 12px; max-width: 900px; width: calc(100% - 24px); background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  canvas { display: block; width: 100%; }
</style>
</head><body oncontextmenu="return false">
<script type="module">
  const config = ${config};
  const send = (message) => {
    const text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(text, "*");
  };
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
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { observer.unobserve(entry.target); draw(entry.target); }
      }
    }, { rootMargin: "100% 0px" });
    const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
    for (let n = 1; n <= pdf.numPages; n++) {
      const div = document.createElement("div");
      div.className = "page";
      div.dataset.page = String(n);
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

// Builds the viewer page for one version with a fresh access token.
export function useReaderHtml(versionId: string): string | null {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void gatewayRequest(versionId).then((request) => {
      if (active) setHtml(readerHtml(request, colors.paper));
    });
    return () => {
      active = false;
    };
  }, [versionId]);
  return html;
}
