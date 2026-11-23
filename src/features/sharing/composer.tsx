import { sectionHeading } from "@/ui/section-heading";
import { segmentedStyles } from "@/ui/segmented";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { PdfReader } from "@/features/manuscripts/pdf-reader";
import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/button";
import { Toggle } from "@/ui/toggle";
import { ErrorText, Screen, TopBar } from "@/ui/screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/ui/icon";
import { WorkCover } from "@/features/manuscripts/work-cover";
import { coverColumns } from "./formatting";
import { RichEditor } from "./rich-editor";
import { ImageTiles } from "@/features/community/image-tiles";
import { PostPreview, PreviewModal, PublishBar } from "@/features/community/post-preview";
import * as ImagePicker from "expo-image-picker";
import { prepareImage, uploadImage, type PreparedImage } from "@/features/community/api";
import { useSession } from "@/features/account/session";
import { ExcerptFrame, joinExcerpt, pageRangeBody, plainText, toHtml } from "./rich-text";
import { colors, fonts, radius, space } from "@/ui/theme";

type Source = "own_work" | "own_book" | "received_manuscript";
type Work = { id: string; title: string; source: Source; submissionId: string | null; versions: { id: string; label: string | null; pages: number }[]; restrictions: { publisher: string; policy: string }[] };
type Kind = "excerpt" | "synopsis" | "beta_pages";
export function FragmentComposer({ switcher, workId, submissionId }: { switcher: ReactNode; workId?: string; submissionId?: string }) {
 const { t } = useTranslation();
 const [works, setWorks] = useState<Work[] | null>(null); const [work, setWork] = useState<Work | null>(null); const [choosingWork, setChoosingWork] = useState(true);
 const [versionId, setVersionId] = useState(""); const [versionsOpen, setVersionsOpen] = useState(false); const [kind, setKind] = useState<Kind>("excerpt");
 const [audience, setAudience] = useState<"public" | "followers">("public"); const [comment, setComment] = useState(""); const [excerpt, setExcerpt] = useState(""); const [synopsis, setSynopsis] = useState("");
 const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [reader, setReader] = useState(false); const [append, setAppend] = useState(false);
 const [gridWidth, setGridWidth] = useState(320);
 const columns = coverColumns(gridWidth); const coverWidth = (gridWidth - (columns - 1) * space.sm) / columns;
 const insets = useSafeAreaInsets(); const userId = useSession()?.userId ?? ""; const [image, setImage] = useState<PreparedImage | null>(null); const [preview, setPreview] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
 const choose = useCallback((w: Work) => { setWork(w); setChoosingWork(false); setVersionId(w.versions[0]?.id ?? ""); setVersionsOpen(false); setStart(""); setEnd(""); if (w.source !== "own_work") setKind("excerpt"); }, []);
 useFocusEffect(useCallback(() => { let active = true; void supabase.rpc("sharing_workspace").then(({ data, error: problem }) => {
   if (!active) return; if (problem) { setError(true); return; } const list = (data?.works ?? []) as Work[]; setWorks(list);
   const selected = list.find((w) => w.id === workId && (submissionId ? w.submissionId === submissionId : w.source === "own_work")); if (selected) choose(selected);
 }); return () => { active = false; }; }, [workId, submissionId, choose]));
 const names = work?.source === "own_book" ? [] : (work?.restrictions ?? []).filter((r) => r.policy === "synopsis_and_excerpt_approval" || (kind === "synopsis" && r.policy === "synopsis_approval")).map((r) => r.publisher);
 const needsApproval = names.length > 0 || work?.source === "received_manuscript";
 // The comment is the author's own words; an excerpt or synopsis follows it in its own card.
 const body = kind === "excerpt" ? joinExcerpt(comment, excerpt) : kind === "synopsis" ? joinExcerpt(comment, synopsis) : comment;
 const versionIndex = work ? work.versions.findIndex((v) => v.id === versionId) : -1;
 // Versions are numbered oldest first (the list comes newest first); the upload note is shown apart.
 const versionNumber = (i: number) => `${t("sharing.version")} ${(work?.versions.length ?? 0) - i}`;
 const versionName = work && versionIndex >= 0 && work.source !== "own_book" ? versionNumber(versionIndex) : null;
 const versionNote = work && versionIndex >= 0 ? work.versions[versionIndex].label : null;
 const pages = work?.versions.find((v) => v.id === versionId)?.pages ?? 0;
 const first = Number(start), last = Number(end);
 const validRange = Number.isInteger(first) && first > 0 && Number.isInteger(last) && last >= first && last <= pages && (kind !== "beta_pages" || first !== 1 || last !== pages);
 // Fragments and synopses need their card's text; the comment around it is optional.
 const filled = kind === "beta_pages" ? validRange : !!plainText(kind === "excerpt" ? excerpt : synopsis);
 async function pickImage() {
   const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
   if (!picked.canceled) try { setImage(await prepareImage(picked.assets[0])); } catch { setError(true); }
 }
 async function save() {
   if (!work || !filled) return;
   setBusy(true); setError(false);
   let imagePath: string | null = null;
   if (image) try { imagePath = await uploadImage(userId, image, "excerpt-images", "excerpts"); } catch { setBusy(false); setError(true); return; }
   const result = await supabase.functions.invoke("manuscript-file", { body: { purpose: "create_share", workId: work.id, source: work.source, submissionId: work.submissionId, kind, audience, body: kind === "beta_pages" && !plainText(comment) ? pageRangeBody(first, last) : body.trimEnd(), versionId: kind === "synopsis" || work.source === "own_book" ? null : versionId || null, pageStart: kind !== "synopsis" && validRange ? first : null, pageEnd: kind !== "synopsis" && validRange ? last : null, imagePath } });
   setBusy(false); if (result.error) { setError(true); return; } setComment(""); setExcerpt(""); setSynopsis(""); setStart(""); setEnd(""); setImage(null); if (router.canGoBack()) router.back(); else router.replace("/home");
 }
 return <Screen title={t("community.composerTitle")} backLabel={t("common.back")}>
 {switcher}
 <Section label={(work && !choosingWork) || works?.length === 0 ? undefined : t("sharing.sourceLabel")}>
 {work && !choosingWork ? <View style={styles.sourceCard}><View style={styles.sourceTop}><WorkCover title={work.title} size={52} /><View style={styles.sourceText}><Text style={styles.workTitle} numberOfLines={2}>{work.title}</Text><Text style={styles.sourceMeta}>{[t(`sharing.source_${work.source}`), pages ? t("sharing.pageCount", { count: pages }) : null].filter(Boolean).join(" · ")}</Text></View></View><View style={styles.sourceBottom}>{work.source !== "own_book" && versionName ? <View style={styles.versions}><Pressable accessibilityRole="button" accessibilityLabel={t("sharing.chooseVersion")} accessibilityState={{ expanded: versionsOpen }} disabled={work.versions.length < 2} hitSlop={{ top: 6, bottom: 6 }} onPress={() => setVersionsOpen((open) => !open)} style={styles.versionButton}><Text style={styles.versionLabel}>{versionName}</Text>{work.versions.length > 1 ? <View style={versionsOpen && styles.flipped}><Icon name="chevronDown" color={colors.burgundy} size={16} /></View> : null}</Pressable>{versionsOpen ? <View style={styles.dropdown}>{work.versions.map((v, i) => { const current = v.id === versionId; return <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={versionNumber(i)} accessibilityState={{ selected: current }} onPress={() => { if (!current) { setVersionId(v.id); setStart(""); setEnd(""); } setVersionsOpen(false); }} style={[styles.versionOption, current && styles.optionCurrent]}><View style={styles.versionOptionText}><Text style={[styles.optionLabel, current && styles.versionLabel]}>{versionNumber(i)}</Text>{v.label ? <Text style={styles.versionNote} numberOfLines={2}>{v.label}</Text> : null}</View>{current ? <Icon name="check" color={colors.burgundy} size={16} /> : null}</Pressable>; })}</View> : versionNote ? <Text style={styles.versionNote} numberOfLines={2}>{versionNote}</Text> : null}</View> : <View />}<Pressable accessibilityRole="button" accessibilityLabel={t("common.change")} hitSlop={8} onPress={() => setChoosingWork(true)} style={styles.change}><Text style={styles.link}>{t("common.change")}</Text></Pressable></View></View> : !works ? (error ? null : <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.burgundy} style={styles.loading} />) : !works.length ? <View style={styles.empty}><Image source={require("../../../assets/illustrations/semn-scrie.svg")} style={styles.emptyImage} contentFit="contain" accessibilityIgnoresInvertColors /><Text style={styles.emptyText}>{t("sharing.noWorks")}</Text><Button size="compact" style={styles.emptyButton} label={t("manuscripts.upload")} onPress={() => router.push("/upload")} /></View> : <View style={styles.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>{works.map((item) => { const selected = work?.id === item.id && work.source === item.source && work.submissionId === item.submissionId; return <Pressable key={`${item.source}-${item.id}-${item.submissionId}`} accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint={t(`sharing.source_${item.source}`)} accessibilityState={{ selected }} onPress={() => choose(item)} style={{ width: coverWidth, alignItems: "center" }}><View style={[styles.coverFrame, selected && styles.coverSelected]}><WorkCover title={item.title} size={Math.max(1, coverWidth - 4)} />{selected ? <View style={styles.coverCheck}><Icon name="check" color={colors.onBurgundy} size={16} /></View> : null}</View></Pressable>; })}</View>}
 </Section>
 {work && !choosingWork ? <>
 <RichEditor key={kind} label={t(kind === "synopsis" ? "sharing.commentSynopsis" : kind === "beta_pages" ? "sharing.commentPages" : "sharing.comment")} value={comment} onChange={setComment} reading={false} />
 <View style={styles.tiles}>
 {([{ value: "excerpt", icon: "manuscript" }, { value: "synopsis", icon: "edit" }, ...(work.source === "own_work" ? [{ value: "beta_pages", icon: "book" }] : [])] as { value: Kind; icon: IconName }[]).map((option) => <Option key={option.value} label={t(option.value === "excerpt" ? "sharing.excerpt" : option.value === "synopsis" ? "sharing.synopsis" : "sharing.pages")} icon={option.icon} selected={kind === option.value} onPress={() => setKind(option.value)} />)}
 </View>
 <View style={styles.section}>
 {kind === "beta_pages" ? <><Text style={styles.rangeHint}>{t("sharing.rangeHint")}</Text><View style={styles.range}><TextInput accessibilityLabel={t("sharing.fromPage")} style={styles.pageInput} value={start} onChangeText={(value) => setStart(value.replace(/\D/g, ""))} keyboardType="number-pad" /><Text style={styles.dash}>—</Text><TextInput accessibilityLabel={t("sharing.toPage")} style={styles.pageInput} value={end} onChangeText={(value) => setEnd(value.replace(/\D/g, ""))} keyboardType="number-pad" /></View>{(start || end) && !validRange ? <ErrorText>{first === 1 && last === pages ? t("sharing.wholeRangeError") : t("sharing.rangeError", { pages })}</ErrorText> : null}{versionId ? <View style={styles.pdfRow}><PdfAction label={t("sharing.selectPdf")} icon="manuscript" onPress={() => setReader(true)} /></View> : null}
 {validRange && versionId ? <View style={styles.folio}><Thumbnail versionId={versionId} submissionId={work.submissionId ?? undefined} page={first} />{last - first > 1 ? <Text style={styles.morePages}>{t("sharing.morePages", { count: last - first - 1 })}</Text> : null}{last !== first ? <Thumbnail versionId={versionId} submissionId={work.submissionId ?? undefined} page={last} /> : null}</View> : null}</> : <>
 {kind === "excerpt" ? <ExcerptFrame title={work.title} pages={start ? (start === end ? start : `${start}–${end}`) : null} footer={versionId ? <><PdfAction label={t("sharing.selectPdf")} icon="manuscript" onPress={() => { setAppend(false); setReader(true); }} />{start ? <PdfAction label={t("sharing.nextPage")} icon="plus" onPress={() => { setAppend(true); setReader(true); }} /> : null}</> : undefined}><RichEditor label={t("sharing.text")} value={excerpt} onChange={setExcerpt} toolbar={false} bare /></ExcerptFrame> : <ExcerptFrame title={work.title} synopsis><RichEditor label={t("sharing.text")} value={synopsis} onChange={setSynopsis} toolbar={false} bare /></ExcerptFrame>}
 </>}
 <ImageTiles images={image ? [image] : []} max={1} onAdd={() => void pickImage()} onRemove={() => setImage(null)} />
 </View>
 {names.length ? <Text style={styles.meta}>{t("sharing.mustApprove", { names: names.join(", ") })}</Text> : null}
 </> : null}
 {error ? <ErrorText>{t("errors.generic")}</ErrorText> : null}
 {work && !choosingWork ? <>
 <PublishBar left={<View style={styles.toggle}>
 <AudienceOption label={t("sharing.everyone")} icon="globe" selected={audience === "public"} onPress={() => setAudience("public")} />
 <View style={styles.switchBox}><Toggle accessibilityLabel={t("sharing.audienceLabel")} value={audience === "followers"} onValueChange={(value) => setAudience(value ? "followers" : "public")} /></View>
 <AudienceOption label={t("sharing.followers")} icon="users" selected={audience === "followers"} onPress={() => setAudience("followers")} />
 </View>} previewDisabled={!filled} onPreview={() => setPreview(true)} label={needsApproval ? t("sharing.sendApproval") : t("sharing.publish")} busy={busy} disabled={!work || !filled} onPublish={() => void save()} />
 <Text style={styles.caption}>{t(audience === "public" ? "sharing.everyoneCaption" : "sharing.followersCaption")}</Text>
 </> : null}
 <PreviewModal visible={preview} onClose={() => setPreview(false)}><PostPreview userId={userId} body={body} imageUri={image?.uri} shareKind={kind} title={work?.title} pageStart={kind !== "synopsis" && start ? first : null} pageEnd={kind !== "synopsis" && end ? last : null} reading={kind !== "beta_pages"} /></PreviewModal>
 {/* A Modal is its own Android window, where SafeAreaView reads zero insets and the header slid under the status bar; pad with the app's insets instead. */}<Modal visible={reader} statusBarTranslucent onRequestClose={() => setReader(false)}><View style={[styles.reader, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><TopBar><Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} hitSlop={12} onPress={() => setReader(false)}><Icon name="arrowLeft" color={colors.ink} size={28} /></Pressable></TopBar>{reader && versionId ? <PdfReader versionId={versionId} submissionId={work?.submissionId ?? undefined} selection={kind !== "beta_pages"} pageSelection={kind === "beta_pages"} selectionLabel={t(kind === "beta_pages" ? "sharing.usePages" : "sharing.useSelection")} onMessage={(message) => { if (message.type === "pageSelection") { setStart(String(message.start)); setEnd(String(message.end)); setReader(false); } else if (message.type === "selection") { if (append && message.page !== Number(end) + 1) return; setExcerpt((current) => append ? current + toHtml(message.text) : toHtml(message.text)); setStart((current) => append ? current : String(message.page)); setEnd(String(message.page)); setReader(false); } else if (message.type === "error") { setReader(false); setError(true); } }} /> : null}</View></Modal>
 </Screen>;
}
function Section({ label, children }: { label?: string; children: ReactNode }) {
 return <View style={styles.section}>{label ? <Text accessibilityRole="header" style={styles.sectionLabel}>{label}</Text> : null}{children}</View>;
}
function Option({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress(): void }) {
 return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.tile, selected && styles.tileSelected]}><Icon name={icon} color={selected ? colors.burgundy : colors.inkMuted} size={16} /><Text numberOfLines={1} style={[segmentedStyles.label, styles.tileLabel, selected && segmentedStyles.labelSelected]}>{label}</Text></Pressable>;
}
function AudienceOption({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress(): void }) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={styles.audienceOption}><View style={[styles.audienceDot, selected && styles.audienceDotSelected]}><Icon name={icon} color={selected ? colors.onBurgundy : colors.inkMuted} size={18} /></View></Pressable>;
}
// An outlined pill with icon and words, so "take the text from the PDF" reads as an action.
function PdfAction({ label, icon, onPress }: { label: string; icon: IconName; onPress(): void }) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.pdfAction, pressed && styles.pdfActionPressed]}><Icon name={icon} color={colors.burgundy} size={18} /><Text style={styles.link}>{label}</Text></Pressable>;
}
function Thumbnail({ versionId, submissionId, page }: { versionId: string; submissionId?: string; page: number }) {
 const [opacity] = useState(() => new Animated.Value(0));
 const [shown, setShown] = useState({ versionId, page });
 const [previous, setPrevious] = useState<{ versionId: string; page: number } | null>(null);
 const [ratio, setRatio] = useState(0.707); const [reduced, setReduced] = useState(true);
 useEffect(() => { let active = true; void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }); const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced); return () => { active = false; subscription.remove(); }; }, []);
 // Keep the last rendered page mounted until its replacement is ready to cross-fade.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => { if (shown.page !== page || shown.versionId !== versionId) { setPrevious(shown); setShown({ page, versionId }); opacity.setValue(0); } }, [page, versionId, shown, opacity]);
 const reader = (item: { versionId: string; page: number }, current: boolean) => <PdfReader key={`${item.versionId}-${item.page}`} versionId={item.versionId} submissionId={submissionId} thumbnailPage={item.page} onMessage={(message) => { if (!current) return; if (message.type === "aspect") setRatio(message.ratio); if (message.type === "rendered") Animated.timing(opacity, { toValue: 1, duration: reduced ? 0 : 200, useNativeDriver: true }).start(({ finished }) => { if (finished) setPrevious(null); }); }} />;
 return <View style={styles.thumbnail}><View pointerEvents="none" style={[styles.thumbnailPaper, { aspectRatio: ratio }]}>{previous ? <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>{reader(previous, false)}</Animated.View> : null}<Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>{reader(shown, true)}</Animated.View></View><Text style={styles.pageNumber}>{page}</Text></View>;
}
const styles = StyleSheet.create({ tools: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, pdfAction: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, borderWidth: 1.5, borderColor: colors.burgundy, borderRadius: radius.pill }, pdfActionPressed: { backgroundColor: colors.primarySoft }, loading: { paddingVertical: space.xl }, empty: { alignItems: "center", gap: space.md, paddingVertical: space.lg }, emptyImage: { width: 140, height: 140 }, emptyButton: { alignSelf: "center" }, emptyText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.inkMuted, textAlign: "center" }, previewImage: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.field, backgroundColor: colors.surfaceMuted }, switchBox: { height: 44, justifyContent: "center", marginHorizontal: space.xs }, audienceDot: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }, audienceDotSelected: { backgroundColor: colors.burgundy },
 grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, coverFrame: { borderWidth: 2, borderColor: "transparent", borderRadius: 7 }, coverSelected: { borderColor: colors.burgundy }, coverCheck: { position: "absolute", top: 4, right: 4, backgroundColor: colors.burgundy, borderRadius: radius.pill, padding: 3 },
 tiles: { flexDirection: "row", gap: space.xs }, tile: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.field, paddingHorizontal: space.xs }, tileSelected: { backgroundColor: colors.primarySoft, borderColor: colors.burgundy }, tileLabel: { fontSize: 14 },  toggle: { flexDirection: "row", alignItems: "center" }, audienceOption: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, caption: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.ink, marginTop: -space.sm }, divider: { height: 1, backgroundColor: colors.lineSoft, marginVertical: space.md },
 editorContent: { gap: space.md }, reading: { fontFamily: fonts.reading, fontSize: 17, lineHeight: 27, color: colors.ink, minHeight: 90, textAlignVertical: "top", padding: 0 }, badge: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, color: colors.burgundy, fontFamily: fonts.uiMedium, fontSize: 13, padding: space.xs, borderRadius: radius.field }, paperFolio: { fontFamily: fonts.ui, color: colors.inkMuted, fontSize: 13 },
 section: { gap: space.sm }, sectionLabel: sectionHeading, card: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, borderRadius: radius.card, padding: space.md, gap: space.sm },
 sourceCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, padding: space.md, gap: space.md }, sourceTop: { flexDirection: "row", alignItems: "center", gap: space.md }, sourceText: { flex: 1, gap: 2 }, sourceBottom: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm }, versions: { flexShrink: 1, alignItems: "flex-start", gap: 4 }, versionNote: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkMuted, paddingHorizontal: space.xs }, change: { minHeight: 32, justifyContent: "center" }, flipped: { transform: [{ rotate: "180deg" }] }, dropdown: { minWidth: 220, padding: space.xs, gap: 2, borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, backgroundColor: colors.paper }, versionOption: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.field }, optionCurrent: { backgroundColor: colors.primarySoft }, versionOptionText: { flexShrink: 1, gap: 2 }, optionLabel: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.ink }, versionButton: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.burgundy, backgroundColor: colors.primarySoft }, versionLabel: { fontFamily: fonts.uiSemiBold, fontSize: 13, color: colors.burgundy }, sourceMeta: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted }, workTitle: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, color: colors.ink },
 option: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, borderLeftWidth: 3, borderLeftColor: colors.hairline, borderRadius: radius.field, backgroundColor: colors.surface }, optionCompact: { minHeight: 52, paddingVertical: space.sm }, optionSelected: { borderLeftColor: colors.burgundy, backgroundColor: colors.primarySoft }, optionPressed: { backgroundColor: colors.pressed }, optionText: { flex: 1 }, optionTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink }, description: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMuted },
 rangeHint: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: colors.inkMuted, textAlign: "center" }, range: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.md }, dash: { fontFamily: fonts.heading, fontSize: 30, color: colors.inkMuted }, pageInput: { width: 64, minHeight: 52, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.field, backgroundColor: colors.field, paddingHorizontal: space.md, paddingTop: 14, paddingBottom: 14, textAlignVertical: "center", textAlign: "center", fontFamily: fonts.ui, fontSize: 17, color: colors.ink }, pdfRow: { alignItems: "center" }, link: { fontFamily: fonts.uiSemiBold, color: colors.burgundy }, folio: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.md, paddingVertical: space.md }, thumbnail: { width: 96, alignItems: "center", gap: space.xs }, thumbnailPaper: { width: 96, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: "hidden" }, pageNumber: { fontFamily: fonts.heading, fontSize: 13, color: colors.inkMuted }, morePages: { fontFamily: fonts.headingItalic, color: colors.inkMuted, fontSize: 14 }, meta: { fontFamily: fonts.ui, color: colors.ink }, reader: { flex: 1, backgroundColor: colors.paper },
});
