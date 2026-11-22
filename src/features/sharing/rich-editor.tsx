import { CoreBridge, DEFAULT_TOOLBAR_ITEMS, HEADING_ITEMS, PlaceholderBridge, RichText, TenTapStartKit, Toolbar, useEditorBridge, useEditorContent } from "@10play/tentap-editor";
import { useEffect, useRef, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";

import { registerEditor } from "@/ui/editor-focus";
import { colors, radius, space } from "@/ui/theme";

import { toHtml } from "./rich-text";

// The tools the user asked for; the server and RichHtml accept exactly these tags.
const KEEP = ["Bold", "Italic", "Underline", "Strikethrough", "Quote", "Bullet list", "Ordered list", "Heading", "Link"];
const ITEMS = DEFAULT_TOOLBAR_ITEMS.filter((item) => item.label && KEEP.includes(item.label));
const HEADINGS = HEADING_ITEMS.filter((item) => item.label === "Close headings" || item.label === "Heading 3");

// The editor runs in a WebView, where the app's fonts are not loaded: serif and sans fallbacks.
// Page and WebView are transparent, so the colour comes only from the React Native box around
// them (cream for the writing box, the card's paper for a bare one) and always stays in sync.
// Reading text (synopsis, excerpt) is serif like Literata in the feed; a comment or post is sans like Inter.
const css = (reading: boolean) => `
  html, body { background: transparent; }
  body { color: ${colors.ink}; font: ${reading ? '17px/1.6 Georgia, "Times New Roman", serif' : '16px/1.45 Inter, system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif'}; margin: 0; padding: 0; }
  blockquote { margin: 6px 0; padding: 12px 16px; background: ${colors.paper}; border: 1px solid ${colors.lineSoft}; border-radius: 12px; color: ${colors.ink}; }
  blockquote p { margin: 0 0 6px; }
  h3 { font-size: 20px; margin: 4px 0 6px; }
  a { color: ${colors.burgundy}; }
  p { margin: 0 0 8px; }
  p.is-editor-empty:first-child::before { color: ${colors.inkMuted}; }
`;

// Lisette burgundy toolbar: burgundy icons, a soft pink active state, a hairline under the bar.
// Passed `as never`: TenTap's RecursivePartial<StyleProp> theme type is too deep for tsc.
const TOOLBAR_THEME = {
  toolbar: {
    // TenTap defaults to flex: 1 for a toolbar pinned over the keyboard; in normal flow that squashes it to 0 high.
    // Lisette's soft pink strip against the paper text area, so the tools read as their own bar.
    toolbarBody: { flex: 0, height: 44, backgroundColor: colors.primarySoft, borderTopWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, minWidth: "100%" as const },
    toolbarButton: { backgroundColor: colors.primarySoft },
    iconWrapper: { borderRadius: radius.field, backgroundColor: colors.primarySoft },
    iconWrapperActive: { backgroundColor: colors.burgundy },
    iconWrapperDisabled: { opacity: 0.4 },
    icon: { tintColor: colors.burgundy },
    iconActive: { tintColor: colors.onBurgundy },
    iconDisabled: { tintColor: colors.line },
  },
};

type Props = { label: string; value: string; onChange(html: string): void; reading?: boolean; toolbar?: boolean; bare?: boolean };

export function RichEditor({ label, value, onChange, reading = true, toolbar = true, bare = false }: Props) {
  // CSS and placeholder go in at start-up: injectCSS after mount can run before the WebView is ready and be lost.
  const editor = useEditorBridge({ initialContent: toHtml(value), bridgeExtensions: [...TenTapStartKit, CoreBridge.configureCSS(css(reading)), PlaceholderBridge.configureExtension({ placeholder: label })], avoidIosKeyboard: true, theme: { ...TOOLBAR_THEME, webview: { backgroundColor: "transparent" }, webviewContainer: { backgroundColor: "transparent" } } as never });
  const html = useEditorContent(editor, { type: "html" });
  const emitted = useRef(value);
  const box = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => registerEditor({ box: () => box.current, blur: () => editor.blur() }), [editor]);

  useEffect(() => {
    if (typeof html !== "string" || html === emitted.current) return;
    emitted.current = html;
    onChange(html);
  }, [html, onChange]);
  // Text placed from outside (a PDF selection) replaces the editor's content.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    editor.setContent(toHtml(value));
  }, [editor, value]);

  return (
    <View ref={box} style={bare ? undefined : styles.box} accessibilityLabel={label}>
      {toolbar ? <Toolbar editor={editor} items={ITEMS} headingItems={HEADINGS} hidden={false} /> : null}
      <View style={[styles.text, reading && styles.reading, bare && styles.bare]}><RichText editor={editor} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.field, backgroundColor: colors.field, overflow: "hidden" },
  text: { minHeight: 140, paddingHorizontal: space.md, paddingVertical: space.sm },
  reading: { minHeight: 200 },
  bare: { minHeight: 120, paddingHorizontal: 0 },
});
