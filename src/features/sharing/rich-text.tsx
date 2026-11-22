import { Image } from "expo-image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import RenderHtml from "react-native-render-html";

import { WorkCover } from "@/features/manuscripts/work-cover";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/ui/icon";
import { colors, fonts, radius, space } from "@/ui/theme";

import { parseExcerpt } from "./excerpt-text";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TAGS = { bold: "strong", italic: "em", underline: "u", strike: "s" } as const;

// Bodies are HTML from the editor; older bodies and PDF selections are plain text with markers.
export function toHtml(value: string): string {
  if (value.trimStart().startsWith("<")) return value;
  return value.split(/\n{2,}/).map((paragraph) => "<p>" + parseExcerpt(paragraph).map((run, index) => {
    // Indentation (verse) only counts at the start of a line, not where a styled run begins.
    const lineStart = index === 0 ? /(^|\n)( +)/g : /(\n)( +)/g;
    let html = escape(run.text).replace(lineStart, (_all, edge: string, spaces: string) => edge + "&nbsp;".repeat(spaces.length)).replace(/\n/g, "<br>");
    for (const [key, tag] of Object.entries(TAGS)) if (run[key as keyof typeof TAGS]) html = `<${tag}>${html}</${tag}>`;
    return html;
  }).join("") + "</p>").join("");
}

// A body is the author's comment followed by the excerpt in one <blockquote>, which the server checks.
export function splitExcerpt(html: string): { comment: string; excerpt: string } {
  const match = html.match(/<blockquote>([\s\S]*)<\/blockquote>/);
  if (!match) return { comment: html, excerpt: "" };
  return { comment: html.replace(match[0], ""), excerpt: match[1] };
}

export function joinExcerpt(comment: string, excerpt: string): string {
  return (plainText(comment) ? comment : "") + (plainText(excerpt) ? `<blockquote>${excerpt}</blockquote>` : "");
}

// A page share's stored text when the author wrote nothing: the server needs some text, the feed hides it.
export const pageRangeBody = (first: number, last: number) => `p. ${first}–${last}`;
export const isPageRangeBody = (html: string) => /^p\. \d+(–\d+)?$/.test(plainText(html));

export function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

const SYSTEM_FONTS = [fonts.reading, fonts.ui, fonts.uiSemiBold, fonts.heading];

// Rendered natively, never injected as HTML; links open only for http(s).
export function RichHtml({ value, reading = false }: { value: string; reading?: boolean }) {
  const { width } = useWindowDimensions();
  const base = reading
    ? { fontFamily: fonts.reading, fontSize: 17, lineHeight: 27, color: colors.ink }
    : { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: colors.ink };
  return (
    <RenderHtml
      contentWidth={width}
      source={{ html: toHtml(value) }}
      systemFonts={SYSTEM_FONTS}
      baseStyle={base}
      tagsStyles={{
        p: { marginTop: 0, marginBottom: 8 },
        strong: { fontWeight: "bold" },
        // A quote is the PDF excerpt: a paper card in the reading face, as in the v6 fragment screens.
        blockquote: { marginLeft: 0, marginRight: 0, marginVertical: 6, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.field, fontFamily: fonts.reading, fontSize: 17, lineHeight: 27, color: colors.ink },
        h3: { fontFamily: fonts.heading, fontSize: 20, marginTop: 4, marginBottom: 6 },
        a: { color: colors.burgundy },
      }}
      renderersProps={{ a: { onPress: (_event: unknown, href: string) => { if (/^https?:\/\//i.test(href)) void Linking.openURL(href); } } }}
    />
  );
}

// Fragment photos are private: the gateway signs a short-lived URL only for people who may see the text.
export function ExcerptImage({ textVersionId }: { textVersionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.functions.invoke("manuscript-file", { body: { purpose: "excerpt_image_url", textVersionId } })
      .then(({ data }) => { if (active && typeof data?.url === "string") setUrl(data.url); });
    return () => { active = false; };
  }, [textVersionId]);
  if (!url) return null;
  return <Image source={{ uri: url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.field, backgroundColor: colors.surfaceMuted }} contentFit="cover" accessibilityIgnoresInvertColors />;
}

// The PDF excerpt as a page from the book: which work and page, a large opening mark, the reading
// face, and whether the text was found in the uploaded file. Shared by the composer and the feed.
// A synopsis uses the same card, titled as a synopsis and without quote marks: it is not a quote.
export function ExcerptFrame({ title, pages, verified = false, synopsis = false, children, footer }: { title?: string | null; pages?: string | null; verified?: boolean; synopsis?: boolean; children: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={frame.card}>
      <View style={frame.header}>
        {title ? <WorkCover title={title} size={28} /> : null}
        <Text style={frame.title} numberOfLines={1}>{synopsis ? (title ? t("sharing.synopsisOf", { title }) : t("sharing.synopsis")) : title ? t("sharing.fromWork", { title }) : t("sharing.excerpt")}</Text>
        {pages ? <Text style={frame.pages}>{t("sharing.pageShort", { pages })}</Text> : null}
      </View>
      {synopsis ? <View style={frame.synopsisGap} /> : <Text style={frame.mark} accessibilityElementsHidden importantForAccessibility="no">„</Text>}
      {children}
      {synopsis ? null : <Text style={frame.markEnd} accessibilityElementsHidden importantForAccessibility="no">”</Text>}
      {verified || footer ? (
        <View style={frame.footer}>
          {verified ? <View style={frame.verified}><Icon name="check" color={colors.burgundy} size={14} /><Text style={frame.verifiedText}>{t("sharing.verified")}</Text></View> : null}
          {footer}
        </View>
      ) : null}
    </View>
  );
}

// A post body in the feed or a preview: the comment as text, the excerpt in its frame. Older
// excerpts kept their whole body as the excerpt, so a page range alone also means "excerpt".
// A synopsis is the author's comment and the synopsis in its own card; older synopses are all synopsis.
export function PostBody({ body, title, pageStart, pageEnd, verified, reading = false, synopsis = false }: { body: string; title?: string | null; pageStart?: number | null; pageEnd?: number | null; verified?: boolean; reading?: boolean; synopsis?: boolean }) {
  const split = splitExcerpt(body);
  const { comment, excerpt } = split.excerpt || (pageStart == null && !synopsis) ? split : { comment: "", excerpt: body };
  const pages = pageStart == null ? null : pageStart === pageEnd || pageEnd == null ? String(pageStart) : `${pageStart}–${pageEnd}`;
  return (
    <>
      {plainText(comment) ? <RichHtml value={comment} reading={reading && !excerpt} /> : null}
      {plainText(excerpt) ? <ExcerptFrame title={title} pages={synopsis ? null : pages} verified={verified && !synopsis} synopsis={synopsis}><RichHtml value={excerpt} reading /></ExcerptFrame> : null}
    </>
  );
}

const frame = StyleSheet.create({
  // The light cream card with a fine border, as the "Textul ales" box in v6, so it lifts off the paper page.
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.lineSoft, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.ink },
  pages: { fontFamily: fonts.uiSemiBold, fontSize: 12, color: colors.burgundy, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: "hidden" },
  // The Romanian opening mark sits low on a full line; negative margins pull its empty top and the
  // text below closer without clipping the glyph (a fixed height cut it into a closing mark).
  mark: { fontFamily: fonts.heading, fontSize: 48, lineHeight: 48, color: colors.burgundy, marginTop: -space.md, marginBottom: -space.md },
  markEnd: { alignSelf: "flex-end", fontFamily: fonts.heading, fontSize: 48, lineHeight: 48, height: 30, color: colors.burgundy },
  synopsisGap: { height: space.sm },
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, paddingTop: space.sm },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.burgundy },
});
