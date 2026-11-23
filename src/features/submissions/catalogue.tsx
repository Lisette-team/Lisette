import { router } from "expo-router";
import { formatDate } from "@/i18n/format";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CALL_LANGUAGES, listGenres, type Genre } from "@/features/calls/api";
import { hash } from "@/ui/avatar";
import { FilterPill } from "@/ui/filter-pill";
import { Icon, type IconName } from "@/ui/icon";
import { ErrorText } from "@/ui/screen";
import { Segmented } from "@/ui/segmented";
import { colors, fonts, radius, space, tints } from "@/ui/theme";

import {
  listOpenCalls,
  listPublications,
  NO_FILTERS,
  type CatalogueFilters,
  type CataloguePublisher,
  type OpenCall,
  type PublisherKind,
} from "./catalogue-api";

type Tab = "calls" | "publications";
const KINDS: PublisherKind[] = ["publishing_house", "literary_magazine", "independent_editor"];

type Props = {
  initialTab: Tab;
  // Only the composer passes this: readers and publications browse without checkboxes. Keyed by call id.
  selectable?: {
    selected: Map<string, OpenCall>;
    onToggle(call: OpenCall): void;
  };
};

// The tick at the right of a selectable call's row. Drawing only: the whole row is the checkbox.
function Tick({ checked }: { checked: boolean }) {
  return (
    <View style={styles.tick}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Icon name="check" color={colors.onBurgundy} size={18} /> : null}
      </View>
    </View>
  );
}

type Chip = { label: string; icon: IconName; tone?: "gold" | "burgundy" };

// A publication's letter on a warm tint, standing in for a logo. Skips a leading "Editura"/"Revista".
function Monogram({ name, muted }: { name: string; muted?: boolean }) {
  const letter = name.replace(/^(editura|revista)\s+/i, "").charAt(0).toUpperCase();
  const tint = tints[hash(name) % tints.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.monogram, { backgroundColor: muted ? colors.surfaceMuted : tint }]}
    >
      <Text style={[styles.monogramText, muted && styles.mutedText]}>{letter}</Text>
    </View>
  );
}

// One call or publication: monogram, serif title, two lines of description and coloured facts as chips.
function Card({ name, title, subtitle, body, chips, muted, selected, right, onPress, ...a11y }: {
  name: string;
  title: string;
  subtitle: string;
  body?: string | null;
  chips: Chip[];
  muted?: boolean;
  selected?: boolean;
  right?: ReactNode;
  onPress(): void;
  accessibilityRole?: "checkbox";
  accessibilityState?: { checked: boolean };
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, ...chips.map((chip) => chip.label)].join(", ")}
      {...a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        muted && styles.cardMuted,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardTop}>
        <Monogram name={name} muted={muted} />
        <View style={styles.cardHeading}>
          <Text style={[styles.cardTitle, muted && styles.mutedText]}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        {right ?? <Icon name="chevron" color={colors.inkMuted} size={20} />}
      </View>
      {body ? (
        <Text style={styles.cardBody} numberOfLines={2}>
          {body}
        </Text>
      ) : null}
      <View style={styles.chips}>
        {chips.map((chip) => (
          <View
            key={chip.label}
            style={[styles.chip, chip.tone === "gold" && styles.chipGold, chip.tone === "burgundy" && styles.chipBurgundy]}
          >
            <Icon name={chip.icon} color={chip.tone === "burgundy" ? colors.burgundy : colors.inkMuted} size={14} />
            <Text style={[styles.chipText, chip.tone === "burgundy" && styles.chipTextBurgundy]}>{chip.label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

// S-24: open calls (soonest deadline first) and publications, with the same filters.
export function Catalogue({ initialTab, selectable }: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filters, setFilters] = useState<CatalogueFilters>(NO_FILTERS);
  const [publisherName, setPublisherName] = useState<string | null>(null);
  const [calls, setCalls] = useState<OpenCall[] | null>(null);
  const [publications, setPublications] = useState<CataloguePublisher[] | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listGenres()
      .then(setGenres)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let current = true;
    // A slower, older answer must not replace the one for the latest filters.
    const load =
      tab === "calls"
        ? listOpenCalls(filters).then((rows) => current && setCalls(rows))
        : listPublications(filters).then((rows) => current && setPublications(rows));
    load.then(
      () => current && setError(null),
      () => {
        if (!current) return;
        // The rows on screen belonged to other filters.
        setCalls(null);
        setPublications(null);
        setError(t("errors.network"));
      },
    );
    return () => {
      current = false;
    };
  }, [tab, filters, t]);

  const set = (patch: Partial<CatalogueFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const date = (iso: string) => formatDate(iso, i18n.language);
  const genreName = (genre: Genre) => (i18n.language === "ro" ? genre.name_ro : genre.name_en);
  const genreList = (ids: string[]) =>
    genres
      .filter((genre) => ids.includes(genre.id))
      .map(genreName)
      .join(", ");
  const languageList = (codes: string[]) => codes.map((code) => t(`submit.lang_${code}`)).join(", ");
  const chips = (...items: (Chip | false)[]) => items.filter((item): item is Chip => !!item && !!item.label);

  function openPublication(publication: CataloguePublisher) {
    setPublisherName(publication.name);
    // No other publication's calls while this one's load.
    setCalls(null);
    set({ publisherId: publication.id });
    setTab("calls");
  }

  const empty = (text: string) => <Text style={styles.empty}>{text}</Text>;

  return (
    <View style={styles.wrapper}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "calls", label: t("submit.tabOpenCalls") },
          { value: "publications", label: t("submit.tabPublications") },
        ]}
      />

      <View style={styles.search}>
        <Icon name="search" color={colors.inkMuted} size={20} />
        <TextInput
          accessibilityLabel={t("common.search")}
          placeholder={t("common.search")}
          placeholderTextColor={colors.inkMuted}
          value={filters.query}
          onChangeText={(query) => set({ query })}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.pills}>
        <FilterPill
          label={t("submit.filterGenre")}
          allLabel={t("submit.filterAll")}
          closeLabel={t("common.close")}
          value={filters.genreId}
          options={genres.map((genre) => ({ value: genre.id, label: genreName(genre) }))}
          onChange={(genreId) => set({ genreId })}
        />
        <FilterPill
          label={t("submit.filterLanguage")}
          allLabel={t("submit.filterAll")}
          closeLabel={t("common.close")}
          value={filters.language}
          options={CALL_LANGUAGES.map((code) => ({ value: code, label: t(`submit.lang_${code}`) }))}
          onChange={(language) => set({ language })}
        />
        <FilterPill
          label={t("submit.filterKind")}
          allLabel={t("submit.filterAll")}
          closeLabel={t("common.close")}
          value={filters.kind}
          options={KINDS.map((kind) => ({ value: kind, label: t(`submit.kind_${kind}`) }))}
          onChange={(kind) => set({ kind })}
        />
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
      {!error && (tab === "calls" ? calls : publications) === null ? (
        <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.burgundy} style={styles.loading} />
      ) : null}

      {tab === "calls" ? (
        <View style={styles.list}>
          {filters.publisherId ? (
            <View style={styles.note}>
              <Text style={styles.noteText} numberOfLines={1}>
                {t("submit.callsFrom", { name: publisherName })}
              </Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => set({ publisherId: null })}
                style={styles.linkTarget}
              >
                <Text style={styles.link}>{t("submit.showAllCalls")}</Text>
              </Pressable>
            </View>
          ) : null}
          {calls?.length === 0
            ? empty(filters.publisherId ? t("submit.notTakingNow", { name: publisherName }) : t("submit.noOpenCalls"))
            : null}
          {calls?.map((call) => {
            const label = `${call.title}, ${call.publisher_name}`;
            const checked = selectable?.selected.has(call.id) ?? false;
            return (
              <Card
                key={call.id}
                name={call.publisher_name}
                title={call.title}
                subtitle={`${call.publisher_name} · ${t(`submit.kind_${call.publisher_kind}`)}`}
                body={call.description}
                chips={chips(
                  {
                    label: call.closes_at ? t("submit.until", { date: date(call.closes_at) }) : t("submit.alwaysOpen"),
                    icon: "calendar",
                    tone: "gold",
                  },
                  { label: languageList(call.accepted_languages), icon: "globe" },
                  { label: call.genre_ids.length ? genreList(call.genre_ids) : t("submit.anyGenre"), icon: "book" },
                )}
                selected={checked}
                onPress={selectable ? () => selectable.onToggle(call) : () => router.push(`/open-call/${call.id}`)}
                right={selectable ? <Tick checked={checked} /> : undefined}
                {...(selectable
                  ? { accessibilityRole: "checkbox" as const, accessibilityState: { checked }, accessibilityLabel: label }
                  : {})}
              />
            );
          })}
        </View>
      ) : (
        <View style={styles.list}>
          {publications?.length === 0 ? empty(t("submit.noPublications")) : null}
          {publications?.map((publication) => (
            <Card
              key={publication.id}
              name={publication.name}
              title={publication.name}
              subtitle={t(`submit.kind_${publication.kind}`)}
              body={publication.intro}
              chips={chips(
                publication.open_call_count > 0
                  ? {
                      label: t("submit.openCallCount", { count: publication.open_call_count }),
                      icon: "send",
                      tone: "burgundy",
                    }
                  : { label: t("submit.notOpen"), icon: "info" },
                publication.genre_ids.length > 0 && { label: genreList(publication.genre_ids), icon: "book" },
                { label: languageList(publication.languages), icon: "globe" },
              )}
              muted={publication.open_call_count === 0}
              onPress={() => openPublication(publication)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.md },
  list: { gap: space.md },
  loading: { paddingVertical: space.xl },
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardMuted: { backgroundColor: "transparent" },
  cardSelected: { borderWidth: 1.5, borderColor: colors.burgundy, backgroundColor: colors.primarySoft },
  cardPressed: { backgroundColor: colors.pressed },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  cardHeading: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, color: colors.ink },
  cardSubtitle: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  cardBody: { fontFamily: fonts.reading, fontSize: 15, lineHeight: 23, color: colors.ink },
  monogram: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  monogramText: { fontFamily: fonts.heading, fontSize: 24, color: colors.burgundy },
  mutedText: { color: colors.inkMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipGold: { backgroundColor: colors.goldSoft },
  chipBurgundy: { backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.ink },
  chipTextBurgundy: { color: colors.burgundy },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.field,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontFamily: fonts.ui,
    fontSize: 16,
    color: colors.ink,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: space.sm, paddingVertical: space.xs },
  note: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: colors.inkMuted,
  },
  linkTarget: { minHeight: 48, justifyContent: "center" },
  link: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.burgundy },
  empty: {
    paddingVertical: space.xl,
    textAlign: "center",
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
  },
  tick: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.field,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.burgundy,
    borderColor: colors.burgundy,
  },
});
