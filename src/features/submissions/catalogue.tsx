import { router } from "expo-router";
import { formatDate } from "@/i18n/format";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CALL_LANGUAGES, listGenres, type Genre } from "@/features/calls/api";
import { FilterPill } from "@/ui/filter-pill";
import { Icon } from "@/ui/icon";
import { ListRow } from "@/ui/list-row";
import { ErrorText } from "@/ui/screen";
import { Segmented } from "@/ui/segmented";
import { colors, fonts, radius, space } from "@/ui/theme";

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
  const line = (...parts: (string | false)[]) => parts.filter(Boolean).join(" · ");

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

      {tab === "calls" ? (
        <View>
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
              <ListRow
                key={call.id}
                title={call.title}
                subtitle={line(call.publisher_name, t(`submit.kind_${call.publisher_kind}`))}
                body={call.description ?? undefined}
                meta={line(
                  call.closes_at ? t("submit.until", { date: date(call.closes_at) }) : t("submit.alwaysOpen"),
                  languageList(call.accepted_languages),
                  call.genre_ids.length ? genreList(call.genre_ids) : t("submit.anyGenre"),
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
        <View>
          {publications?.length === 0 ? empty(t("submit.noPublications")) : null}
          {publications?.map((publication) => (
            <ListRow
              key={publication.id}
              title={publication.name}
              subtitle={t(`submit.kind_${publication.kind}`)}
              body={publication.intro ?? undefined}
              meta={line(
                publication.genre_ids.length > 0 && genreList(publication.genre_ids),
                languageList(publication.languages),
                publication.open_call_count > 0
                  ? t("submit.openCallCount", { count: publication.open_call_count })
                  : t("submit.notOpen"),
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
