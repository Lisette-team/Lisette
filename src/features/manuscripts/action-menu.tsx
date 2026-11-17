import { MenuView } from "@expo/ui/community/menu";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/ui/icon";
import { colors, fonts, radius, space } from "@/ui/theme";
type Item = { label: string; destructive?: boolean; disabled?: boolean; note?: string; onPress(): void };
export function ActionMenu({ items }: { items: Item[] }) {
  const { t } = useTranslation(); const [open, setOpen] = useState(false);
  if (Platform.OS === "android") return <MenuView actions={items.flatMap((item, index) => [{ id: String(index), title: item.label, attributes: { disabled: item.disabled, destructive: item.destructive } }, ...(item.note ? [{ id: `note-${index}`, title: item.note, attributes: { disabled: true } }] : [])])} onPressAction={({ nativeEvent }) => { const item = items[Number(nativeEvent.event)]; if (item && !item.disabled) item.onPress(); }}><View style={styles.trigger} accessible accessibilityRole="button" accessibilityLabel={t("manuscripts.menu")}><Icon name="more" color={colors.ink} /></View></MenuView>;
  // shortcut: @expo/ui MenuView does not fire actions on web; use a small sheet there.
  return <><Pressable style={styles.trigger} accessibilityRole="button" accessibilityLabel={t("manuscripts.menu")} onPress={() => setOpen(true)}><Icon name="more" color={colors.ink} /></Pressable>
    <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><View style={styles.overlay}><Pressable accessibilityLabel={t("common.cancel")} style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><View style={styles.sheet}>
      {items.map((item) => <View key={item.label}><Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ disabled: !!item.disabled }} disabled={item.disabled} onPress={() => { setOpen(false); item.onPress(); }} style={styles.item}><Text style={[styles.text, item.destructive && { color: colors.burgundy }, item.disabled && { color: colors.inkMuted }]}>{item.label}</Text></Pressable>{item.note ? <Text style={styles.note}>{item.note}</Text> : null}</View>)}
    </View></View></Modal></>;
}
const styles = StyleSheet.create({ trigger: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }, sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.lg }, item: { minHeight: 48, justifyContent: "center" }, text: { fontFamily: fonts.uiMedium, fontSize: 17, color: colors.ink }, note: { fontFamily: fonts.ui, color: colors.inkMuted, paddingBottom: space.sm } });
