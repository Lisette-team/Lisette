import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Icon } from "./icon";
import { colors, fonts, space } from "./theme";

// Gold sparkles around the selected icon, as drawn in the v6 screens: [x, y, radius] from the icon centre.
const SPARKLES = [
  [19, -22, 9],
  [-20, -19, 5],
  [24, 0, 4],
  [-24, 3, 3],
] as const;
const star = ([x, y, r]: readonly number[]) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// The bottom bar from the v6 designs. The route named "create" is drawn as the round + button;
// `hidden` is the one tab this person doesn't get (Profile for writers, Manuscripts for readers).
export function TabBar({ state, descriptors, emitter, navigateToTab, insets, hidden }: BottomTabBarProps & { hidden: string }) {
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
      {state.routes.map((route, index) => {
        if (route.name === hidden) return null;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const tint = focused ? colors.burgundy : colors.inkMuted;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        if (route.name === "create") {
          return (
            <Pressable key={route.key} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.create}>
              <Icon name="plus" color={colors.paper} size={28} />
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.tab}
          >
            <View>
              {focused ? (
                <Svg width={64} height={64} viewBox="-32 -32 64 64" style={styles.sparkles} pointerEvents="none">
                  {SPARKLES.map((sparkle) => (
                    <Path key={sparkle.join()} d={star(sparkle)} fill={colors.gold} />
                  ))}
                </Svg>
              ) : null}
              {options.tabBarIcon?.({ focused, color: tint, size: 24 })}
            </View>
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Rounded top and the soft "Umbră/plutitor" shadow, approved for this bar on 2026-10-28.
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: space.sm,
    paddingHorizontal: space.xs,
    backgroundColor: colors.field,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    boxShadow: `0px 10px 28px ${colors.shadow}`,
  },
  tab: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: space.xs },
  sparkles: { position: "absolute", left: -20, top: -20 },
  label: { fontFamily: fonts.uiMedium, fontSize: 11, lineHeight: 13 },
  create: {
    width: 56,
    height: 56,
    marginHorizontal: space.sm,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.burgundy,
    boxShadow: `0px 10px 28px ${colors.shadow}`,
  },
});
