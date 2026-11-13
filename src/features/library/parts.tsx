import { useTranslation } from "react-i18next";
import type React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/ui/icon";
import { colors, fonts, radius, space, tints } from "@/ui/theme";

import { SHELVES, type Shelf } from "./api";

export const SHELF_LABEL: Record<Shelf, string> = { to_read: "library.toRead", reading: "library.reading", read: "library.read" };

// The same book always gets the same colour.
function hash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function authorLine(names: string[]) {
  return names.join(", ");
}

export function ShelfChips({ value, onChange }: { value: Shelf; onChange: (shelf: Shelf) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.chips}>
      {SHELVES.map((shelf) => {
        const selected = shelf === value;
        return (
          <Pressable
            key={shelf}
            accessibilityRole="button"
            accessibilityLabel={t(SHELF_LABEL[shelf])}
            accessibilityState={{ selected }}
            onPress={() => onChange(shelf)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{t(SHELF_LABEL[shelf])}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrivacyBanner() {
  const { t } = useTranslation();
  return (
    <View style={styles.banner}>
      <Icon name="lock" color={colors.burgundy} size={22} />
      <Text style={styles.bannerText}>{t("library.privateBanner")}</Text>
    </View>
  );
}

// A small cover drawn from the title's first letter, until covers exist (v6 S-60 list).
const COVERS = [
  { fill: colors.surfaceMuted, line: colors.burgundy, text: colors.ink },
  { fill: tints[0], line: colors.burgundy, text: colors.ink },
  { fill: colors.burgundy, line: colors.gold, text: colors.paper },
  { fill: tints[1], line: colors.burgundy, text: colors.ink },
];

export function BookCover({ title, width = 52 }: { title: string; width?: number }) {
  const look = COVERS[hash(title) % COVERS.length];
  const height = Math.round(width * 1.4);
  return (
    <View style={[styles.cover, { width, height, backgroundColor: look.fill }]}>
      <View style={[styles.coverFrame, { borderColor: look.line }]}>
        <Text style={[styles.coverLetter, { color: look.text, fontSize: width * 0.42 }]}>
          {title.trim().charAt(0).toUpperCase()}
        </Text>
        <Text style={[styles.coverStar, { color: look.line }]}>✦</Text>
      </View>
    </View>
  );
}

const SPINES = [
  { fill: colors.burgundy, text: colors.paper },
  { fill: colors.ink, text: colors.paper },
  { fill: colors.gold, text: colors.ink },
  { fill: colors.nightBurgundy, text: colors.paper },
  { fill: "#C9858F", text: colors.ink },
  { fill: colors.inkMuted, text: colors.paper },
  { fill: "#E6CF9A", text: colors.ink },
];
// One spine with its title running up it. With onPress it opens the entry (S-60 web bookcase).
function Spine({
  title,
  index,
  width,
  height,
  onPress,
}: {
  title: string;
  index: number;
  width: number;
  height: number;
  onPress?: () => void;
}) {
  const look = SPINES[(hash(title) + index) % SPINES.length];
  const label = height - 28;
  const body = (
    <>
      <View style={[styles.band, styles.bandTop]} />
      <View style={[styles.spineLabel, { width: label, left: (width - label) / 2, top: (height - 22) / 2 }]}>
        <Text numberOfLines={1} style={[styles.spineTitle, { color: look.text, fontSize: width < 32 ? 12 : 14 }]}>
          {title}
        </Text>
      </View>
      <View style={[styles.band, styles.bandBottom]} />
    </>
  );
  const style = [styles.spine, { width, height, backgroundColor: look.fill }];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

// The shelf drawing from v6 S-60: one spine per book, with its title running up the spine.
export function ShelfDrawing({ titles }: { titles: string[] }) {
  return (
    <View style={styles.shelf} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.spines}>
        {/* Eight 30 px spines fit the narrowest phones (320 px of content). */}
        {titles.slice(0, 8).map((title, i) => (
          <Spine key={`${title}-${i}`} title={title} index={i} width={30} height={150 + (hash(title) % 4) * 15} />
        ))}
      </View>
      <View style={styles.board} />
    </View>
  );
}

const PER_SHELF = 14;

// Books spread over the shelves as in the design (six above, four below for ten): the top shelf
// takes about 60 %, and more shelves are added only past two full ones.
function shelvesFor<T>(entries: T[]): T[][] {
  if (entries.length <= 3) return [entries, []];
  if (entries.length <= PER_SHELF * 2) {
    const top = Math.ceil(entries.length * 0.6);
    return [entries.slice(0, top), entries.slice(top)];
  }
  const rows: T[][] = [];
  for (let i = 0; i < entries.length; i += PER_SHELF) rows.push(entries.slice(i, i + PER_SHELF));
  return rows;
}

// The arched bookcase of v6 S-60 web: the shelf's books on gold planks, at least two of them. Each
// spine opens the entry's controls; `empty` is shown inside when the shelf has no books.
export function Bookcase<T extends { workId: string; title: string }>({
  entries,
  onOpen,
  empty,
}: {
  entries: T[];
  onOpen: (entry: T) => void;
  empty?: React.ReactNode;
}) {
  const rows = shelvesFor(entries);
  let index = 0;
  return (
    <View style={styles.bookcase}>
      {entries.length === 0 && empty ? <View style={styles.bookcaseEmpty}>{empty}</View> : null}
      {rows.map((row, r) => (
        <View key={r} style={styles.bookcaseShelf}>
          <View style={[styles.bookcaseBooks, { minHeight: r === 0 ? 136 : 96 }]}>
            {row.map((entry) => (
              <Spine
                key={entry.workId}
                title={entry.title}
                index={index++}
                width={30}
                height={r === 0 ? 112 + (hash(entry.title) % 4) * 8 : 88 + (hash(entry.title) % 2) * 8}
                onPress={() => onOpen(entry)}
              />
            ))}
          </View>
          <View style={styles.plank} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.md + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipSelected: { backgroundColor: colors.primarySoft },
  chipLabel: { fontFamily: fonts.ui, fontSize: 16, color: colors.inkMuted },
  chipLabelSelected: { fontFamily: fonts.uiSemiBold, color: colors.burgundy },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.goldSoft,
  },
  bannerText: { flex: 1, fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.ink },
  cover: { borderRadius: 4, padding: 3 },
  coverFrame: { flex: 1, alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderTopWidth: 3, paddingVertical: 2 },
  coverLetter: { fontFamily: fonts.heading },
  coverStar: { fontSize: 8 },
  shelf: { borderRadius: radius.card, backgroundColor: colors.surfaceMuted, paddingTop: space.lg, overflow: "hidden" },
  spines: { flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: space.lg },
  spine: { borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: "hidden" },
  spineLabel: { position: "absolute", height: 22, justifyContent: "center", transform: [{ rotate: "-90deg" }] },
  spineTitle: { textAlign: "center", fontFamily: fonts.heading, fontSize: 14 },
  band: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: colors.gold },
  bandTop: { top: 10 },
  bandBottom: { bottom: 10 },
  bookcase: {
    minHeight: 460,
    gap: 56,
    paddingTop: 100,
    paddingBottom: space.xxl + 16,
    paddingHorizontal: space.md - 2,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  bookcaseEmpty: { alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, marginTop: -60, marginBottom: -40 },
  bookcaseShelf: { alignItems: "stretch" },
  bookcaseBooks: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 4, minHeight: 20 },
  plank: { height: 5, backgroundColor: colors.gold },
  board: { height: 14, backgroundColor: "#A47A55", borderTopWidth: 0, borderBottomWidth: 4, borderBottomColor: "#7E5A3C" },
});
