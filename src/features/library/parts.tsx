import { useTranslation } from "react-i18next";
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
const SPINE_WIDTH = 34;

// The shelf drawing from v6 S-60: one spine per book, with its title running up the spine.
export function ShelfDrawing({ titles }: { titles: string[] }) {
  return (
    <View style={styles.shelf} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.spines}>
        {titles.slice(0, 9).map((title, i) => {
          const h = hash(title);
          const look = SPINES[(h + i) % SPINES.length];
          const height = 150 + (h % 4) * 15;
          return (
            <View key={`${title}-${i}`} style={[styles.spine, { height, backgroundColor: look.fill }]}>
              <View style={[styles.band, styles.bandTop]} />
              <View
                style={[
                  styles.spineLabel,
                  { width: height - 40, left: (SPINE_WIDTH - (height - 40)) / 2, top: (height - 22) / 2 },
                ]}
              >
                <Text numberOfLines={1} style={[styles.spineTitle, { color: look.text }]}>
                  {title}
                </Text>
              </View>
              <View style={[styles.band, styles.bandBottom]} />
            </View>
          );
        })}
      </View>
      <View style={styles.board} />
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
  spines: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: space.lg },
  spine: { width: SPINE_WIDTH, borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: "hidden" },
  spineLabel: { position: "absolute", height: 22, justifyContent: "center", transform: [{ rotate: "-90deg" }] },
  spineTitle: { textAlign: "center", fontFamily: fonts.heading, fontSize: 14 },
  band: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: colors.gold },
  bandTop: { top: 10 },
  bandBottom: { bottom: 10 },
  board: { height: 14, backgroundColor: "#A47A55", borderTopWidth: 0, borderBottomWidth: 4, borderBottomColor: "#7E5A3C" },
});
