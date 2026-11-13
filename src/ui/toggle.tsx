import { Switch, type SwitchProps } from "react-native";

import { colors } from "./theme";

// Off must stay visible on light sheets: iOS paints the off track with ios_backgroundColor and
// ignores trackColor.false, and the default white thumb disappears on Paper (round 2, iPhone test).
export const toggleColors = {
  trackColor: { false: colors.line, true: colors.burgundy },
  ios_backgroundColor: colors.line,
  thumbColor: colors.paper,
} as const;

type Props = Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor"> & { accessibilityLabel: string };

export function Toggle(props: Props) {
  return (
    <Switch
      {...props}
      trackColor={toggleColors.trackColor}
      ios_backgroundColor={toggleColors.ios_backgroundColor}
      thumbColor={toggleColors.thumbColor}
      // react-native-web: the thumb keeps the same colour when on.
      {...({ activeThumbColor: toggleColors.thumbColor } as object)}
    />
  );
}
