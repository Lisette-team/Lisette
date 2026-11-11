import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { Screen } from "./screen";
import { colors, fonts } from "./theme";

// Stand-in for a menu entry whose screen isn't built yet.
export function ComingSoon({ title, action }: { title: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Screen title={title} action={action}>
      <Text style={styles.body}>{t("common.comingSoon")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, color: colors.inkMuted },
});
