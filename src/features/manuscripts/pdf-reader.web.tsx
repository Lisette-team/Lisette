import { useEffect, useRef } from "react";
import { ActivityIndicator } from "react-native";

import { colors } from "@/ui/theme";

import { useReaderHtml, type ReaderMessage } from "./reader-html";

type Props = { versionId: string; onMessage(message: ReaderMessage): void };

// Web: the same PDF.js page in a sandboxed iframe. Without allow-same-origin it cannot reach the
// app's storage or session; it only gets the token it was built with.
export function PdfReader({ versionId, onMessage }: Props) {
  const html = useReaderHtml(versionId);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow) onMessage(JSON.parse(event.data));
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onMessage]);

  if (!html) return <ActivityIndicator color={colors.burgundy} />;
  return (
    <iframe
      ref={frame}
      srcDoc={html}
      sandbox="allow-scripts"
      title="PDF"
      style={{ flex: 1, width: "100%", border: 0, backgroundColor: colors.paper }}
    />
  );
}
