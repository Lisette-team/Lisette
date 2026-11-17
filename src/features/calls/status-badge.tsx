import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "@/ui/theme";

import type { CallStatus } from "./api";

export const STATUS_KEYS: Record<CallStatus, string> = {
  draft: "publisher.statusDraft",
  scheduled: "publisher.statusScheduled",
  open: "publisher.statusOpen",
  closed: "publisher.statusClosed",
  cancelled: "publisher.statusCancelled",
};

// A small pill with the call's status: burgundy only while it is open to authors.
export function StatusBadge({ status }: { status: CallStatus }) {
  const { t } = useTranslation();
  const label = t(STATUS_KEYS[status]);
  return (
    <View
      accessible
      accessibilityLabel={t("publisher.statusLabel", { status: label })}
      style={[styles.badge, status === "open" && styles.open, status === "cancelled" && styles.cancelled]}
    >
      <Text style={[styles.text, status === "draft" && styles.draftText, status === "open" && styles.openText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  open: { backgroundColor: colors.primarySoft },
  cancelled: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.hairline },
  text: { fontFamily: fonts.uiMedium, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  draftText: { color: colors.ink },
  openText: { color: colors.burgundy },
});
