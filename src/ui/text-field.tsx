import type { Ref } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { colors, fonts, radius, space } from "./theme";

type Props = Omit<TextInputProps, "style"> & { label: string; hint?: string; inputRef?: Ref<TextInputInstance> };

export function TextField({ label, hint, inputRef, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  label: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.ink },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.field,
    backgroundColor: colors.field,
    paddingHorizontal: space.md,
    // Equal top and bottom space keeps the text in the middle of the box, also when it grows to more lines.
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "center",
    fontFamily: fonts.ui,
    fontSize: 17,
    color: colors.ink,
  },
  hint: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkMuted },
});
