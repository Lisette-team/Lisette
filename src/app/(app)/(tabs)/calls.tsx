import { Redirect, router, useFocusEffect } from "expo-router";
import { formatDate } from "@/i18n/format";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/account/session";
import { callStatus, listMyCalls, type Call } from "@/features/calls/api";
import { StatusBadge } from "@/features/calls/status-badge";
import { Button } from "@/ui/button";
import { ListRow } from "@/ui/list-row";
import { ErrorText, Screen } from "@/ui/screen";
import { colors, fonts, space } from "@/ui/theme";

// S-43, list: the publication's own calls, drafts included.
export default function Calls() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const publisherId = session?.kind === "publisher" ? session.userId : null;
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reloads when coming back from the editor.
  useFocusEffect(
    useCallback(() => {
      if (!publisherId) return;
      listMyCalls(publisherId)
        .then(setCalls)
        .catch(() => setError(t("errors.network")));
    }, [publisherId, t]),
  );

  if (session && !publisherId) return <Redirect href="/home" />;

  return (
    <Screen
      title={t("publisher.callsTitle")}
      footer={<Button label={t("publisher.newCall")} onPress={() => router.push("/call/new")} />}
      pinFooter
    >
      {calls?.length === 0 ? <Text style={styles.empty}>{t("publisher.callsEmpty")}</Text> : null}
      {calls?.length ? (
        <View>
          {calls.map((call) => {
            const status = callStatus(call);
            return (
              <ListRow
                key={call.id}
                title={call.title}
                meta={
                  call.closes_at
                    ? t("publisher.until", { date: formatDate(call.closes_at, i18n.language) })
                    : t("publisher.alwaysOpen")
                }
                muted={status === "cancelled"}
                onPress={() => router.push(`/call/${call.id}`)}
                right={<StatusBadge status={status} />}
              />
            );
          })}
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: fonts.reading,
    fontSize: 17,
    lineHeight: 27,
    color: colors.inkMuted,
    paddingVertical: space.lg,
  },
});
