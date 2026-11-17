import { router, useLocalSearchParams } from "expo-router";
import { formatDate } from "@/i18n/format";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import { listGenres, type Genre } from "@/features/calls/api";
import { getOpenCall, type OpenCall, type SharingPolicy } from "@/features/submissions/catalogue-api";
import { Banner } from "@/ui/banner";
import { Button } from "@/ui/button";
import { ErrorText, Screen } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

const SHARING_KEYS: Record<SharingPolicy, string> = {
  author_controlled: "submit.sharingAuthorControlled",
  synopsis_approval: "submit.sharingSynopsisApproval",
  synopsis_and_excerpt_approval: "submit.sharingApproval",
};

// S-24a: one open call, read-only. Every signed-in account can read it; only writers send from it.
export default function OpenCallPage() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  // undefined while loading, null when the call is closed or not visible.
  const [call, setCall] = useState<OpenCall | null | undefined>(undefined);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    getOpenCall(id).then(setCall, () => setError(true));
    listGenres()
      .then(setGenres)
      .catch(() => undefined);
  }, [id]);

  if (error || call === null) {
    return (
      <Screen>
        <View style={styles.gone}>
          {error ? (
            <ErrorText>{t("errors.network")}</ErrorText>
          ) : (
            <Text style={styles.goneText}>{t("submit.reason_call_not_open")}</Text>
          )}
          <Button variant="link" label={t("submit.backToDiscover")} onPress={() => router.replace("/discover")} />
        </View>
      </Screen>
    );
  }
  if (!call) return <Screen>{null}</Screen>;

  const materials = [
    call.req_full_manuscript && t("publisher.reqFullManuscript"),
    call.req_synopsis && t("publisher.reqSynopsis"),
    call.req_sample && t("publisher.reqSample"),
    call.req_genre && t("publisher.reqGenre"),
    call.req_author_intro && t("publisher.reqAuthorIntro"),
  ].filter((item): item is string => Boolean(item));
  const genreNames = genres
    .filter((genre) => call.genre_ids.includes(genre.id))
    .map((genre) => (i18n.language === "ro" ? genre.name_ro : genre.name_en))
    .join(", ");

  return (
    <Screen title={call.title} backLabel={t("common.back")}>
      <Text style={styles.kind}>
        {call.publisher_name} · {t(`submit.kind_${call.publisher_kind}`)}
      </Text>
      <Banner
        text={
          call.closes_at
            ? t("submit.openUntil", { date: formatDate(call.closes_at, i18n.language) })
            : t("submit.alwaysOpen")
        }
      />
      {call.description ? <Text style={styles.description}>{call.description}</Text> : null}
      {session?.authorEnabled ? (
        <Button label={t("submit.sendToCall")} onPress={() => router.push(`/submit/choose?callId=${call.id}`)} />
      ) : null}

      <Text accessibilityRole="header" style={styles.section}>
        {t("submit.whatToSend")}
      </Text>
      <View>
        {materials.map((material) => (
          <Text key={material} style={styles.item}>
            {material}
          </Text>
        ))}
      </View>

      <Text accessibilityRole="header" style={styles.section}>
        {t("submit.genresAndLanguages")}
      </Text>
      <View>
        <Text style={styles.item}>
          {call.genre_ids.length ? t("submit.genresLine", { list: genreNames }) : t("submit.anyGenre")}
        </Text>
        <Text style={styles.item}>
          {t("submit.languagesLine", {
            list: call.accepted_languages.map((code) => t(`submit.lang_${code}`)).join(", "),
          })}
        </Text>
      </View>

      <Text style={styles.body}>
        {t(SHARING_KEYS[call.sharing_policy], {
          publisher: call.publisher_name,
        })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kind: {
    marginTop: -space.sm,
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 22,
    color: colors.inkMuted,
  },
  description: {
    fontFamily: fonts.reading,
    fontSize: 17,
    lineHeight: 27,
    color: colors.ink,
  },
  section: {
    marginTop: space.lg,
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
  },
  item: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink,
  },
  gone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: space.md,
  },
  goneText: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
    color: colors.ink,
  },
});
