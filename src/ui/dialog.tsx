import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "./button";
import { colors, fonts, radius, space } from "./theme";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  // The main action; leave it out for a message that only needs closing.
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel: string;
  onCancel: () => void;
};

// A centred alert over a dimmed screen, for confirmations and short notices.
export function Dialog({ visible, title, message, confirmLabel, onConfirm, cancelLabel, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel} />
        <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            {confirmLabel && onConfirm ? <Button label={confirmLabel} onPress={onConfirm} /> : null}
            <Button label={cancelLabel} variant={confirmLabel ? "secondary" : "primary"} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    backgroundColor: colors.scrim,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.sheet,
    backgroundColor: colors.paper,
  },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  message: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  actions: { gap: space.sm, paddingTop: space.sm },
});
