import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { accountName } from "@/features/community/api";
import { Icon, type IconName } from "@/ui/icon";
import { colors, fonts, radius, space } from "@/ui/theme";

import { useSession } from "./session";

type Item = { name: string; href: "/home" | "/discover" | "/library" | "/manuscripts" | "/profile"; icon: IconName };

const ITEMS: Item[] = [
  { name: "home", href: "/home", icon: "home" },
  { name: "discover", href: "/discover", icon: "compass" },
  { name: "library", href: "/library", icon: "library" },
  { name: "manuscripts", href: "/manuscripts", icon: "manuscript" },
  { name: "profile", href: "/profile", icon: "user" },
];

// Screens outside the tabs belong to the menu entry they were opened from.
const SECTION: Record<string, string> = {
  book: "library",
  post: "home",
  create: "home",
  reader: "manuscripts",
  settings: "profile",
  role: "profile",
};

// The gold sparkles next to the active entry, as in the v6 web screens.
const SPARKLES = [
  [8, -6, 4.5],
  [-4, 2, 2.5],
  [11, 7, 1.6],
  [1, 11, 1.6],
] as const;
const star = ([x, y, r]: readonly number[]) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

// The left sidebar of the v6 web screens (S-20, S-28, S-40, S-60 web): the wordmark, the account name
// and the menu. It replaces the bottom bar on wide screens. Writers get Manuscripts and Profile;
// readers get Profile only. "Create" has no place in the web designs, so it is the last action here.
export function SideNav() {
  const { t } = useTranslation();
  const session = useSession();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const userId = session?.userId ?? "";

  useEffect(() => {
    let active = true;
    if (userId) {
      accountName(userId)
        .then((value) => active && setName(value))
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [userId]);

  const first = pathname.split("/").filter(Boolean)[0] ?? "home";
  const current = SECTION[first] ?? first;
  const items = ITEMS.filter((item) => item.name !== "manuscripts" || session?.authorEnabled);

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>Lisette</Text>
        {name ? (
          <Text style={styles.account} numberOfLines={1}>
            {name}
          </Text>
        ) : null}
      </View>
      <View style={styles.items}>
        {items.map((item) => {
          const focused = current === item.name;
          const tint = focused ? colors.burgundy : colors.inkMuted;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityLabel={t(`nav.${item.name}`)}
              accessibilityState={{ selected: focused }}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Icon name={item.icon} color={tint} size={20} />
              <Text style={[styles.label, { color: focused ? colors.burgundy : colors.inkMuted }]}>{t(`nav.${item.name}`)}</Text>
              {focused ? (
                <Svg width={30} height={30} viewBox="-12 -15 30 30" style={styles.sparkles} pointerEvents="none">
                  {SPARKLES.map((sparkle) => (
                    <Path key={sparkle.join()} d={star(sparkle)} fill={colors.gold} />
                  ))}
                </Svg>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("nav.create")}
          onPress={() => router.navigate("/create")}
          style={styles.create}
        >
          <Icon name="plus" color={colors.onBurgundy} size={18} />
          <Text style={styles.createLabel}>{t("nav.create")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 248,
    paddingTop: 36,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
  brand: { gap: space.xs, marginBottom: space.lg },
  wordmark: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  account: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkMuted },
  items: { gap: space.xs },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.field,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  label: { flex: 1, fontFamily: fonts.ui, fontSize: 16 },
  sparkles: { marginRight: -4 },
  create: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.sm,
    minHeight: 44,
    marginTop: space.lg,
    marginLeft: space.sm,
    paddingHorizontal: space.md + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.burgundy,
  },
  createLabel: { fontFamily: fonts.uiSemiBold, fontSize: 15, color: colors.onBurgundy },
});
