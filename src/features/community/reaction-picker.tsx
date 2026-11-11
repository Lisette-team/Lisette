import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { colors, fonts, radius, space } from "@/ui/theme";

import { REACTION_KINDS, type ReactionKind } from "./api";
import { ReactionFace } from "./reaction-art";

// The reaction panel, as on Facebook: pressing React opens it right above the button; sliding the finger
// over it enlarges the reaction underneath and lifting the finger there picks it. A plain tap leaves the
// panel open so a reaction can be tapped. It is drawn over the whole app, so it is never clipped by a card.

type Rect = { x: number; y: number; width: number; height: number };

const OPTION = 72;
const PADDING = 8;
const FACE = 44;
const GAP = 10;
// How far above or below the panel a finger can drift and still count as over it.
const SLACK = 48;
const MOVE_THRESHOLD = 10;

export type PanelGeometry = { left: number; top: number; width: number; height: number; option: number; padding: number };

export function panelGeometry(button: Rect, screenWidth: number): PanelGeometry {
  const width = REACTION_KINDS.length * OPTION + 2 * PADDING;
  const height = FACE + 32 + 2 * PADDING;
  const left = Math.min(Math.max(space.sm, button.x), screenWidth - width - space.sm);
  const above = button.y - height - GAP;
  const top = above >= space.xxl ? above : button.y + button.height + GAP;
  return { left, top, width, height, option: OPTION, padding: PADDING };
}

// Index of the reaction under a point on screen, or null when the point is away from the panel.
export function optionAt(x: number, y: number, panel: PanelGeometry): number | null {
  if (y < panel.top - SLACK || y > panel.top + panel.height + SLACK) return null;
  if (x < panel.left || x > panel.left + panel.width) return null;
  const index = Math.floor((x - panel.left - panel.padding) / panel.option);
  return Math.min(Math.max(index, 0), REACTION_KINDS.length - 1);
}

type Session = {
  panel: PanelGeometry;
  current: ReactionKind | null;
  onPick: (kind: ReactionKind | null) => void;
  // True while the finger that opened the panel is still down.
  dragging: boolean;
};

type PickerApi = {
  // Opens at once; place() then moves the panel above the button once it has been measured.
  open(current: ReactionKind | null, onPick: (kind: ReactionKind | null) => void): void;
  place(button: Rect): void;
  move(x: number, y: number): void;
  release(): void;
};

const PickerContext = createContext<PickerApi | null>(null);

export function ReactionPickerProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const screen = useWindowDimensions();
  const [session, setSession] = useState<Session | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  // Read inside touch handlers, which can fire faster than state updates.
  const live = useRef<{ session: Session | null; hovered: number | null; start: { x: number; y: number } | null; moved: boolean }>({
    session: null,
    hovered: null,
    start: null,
    moved: false,
  });

  // The button's own press can arrive just after a slide-and-lift pick; it must not reopen the panel.
  const closedAt = useRef(0);

  const close = useCallback(() => {
    closedAt.current = Date.now();
    live.current = { session: null, hovered: null, start: null, moved: false };
    setSession(null);
    setHovered(null);
  }, []);

  const pick = useCallback(
    (index: number) => {
      const active = live.current.session;
      if (!active) return;
      const kind = REACTION_KINDS[index];
      close();
      active.onPick(kind === active.current ? null : kind);
    },
    [close],
  );

  const api = useMemo<PickerApi>(
    () => ({
      open(current, onPick) {
        if (live.current.session || Date.now() - closedAt.current < 400) return;
        const fallback = { x: space.md, y: screen.height / 2, width: 0, height: 0 };
        const next = { panel: panelGeometry(fallback, screen.width), current, onPick, dragging: true };
        live.current = { session: next, hovered: null, start: null, moved: false };
        setSession(next);
      },
      place(button) {
        const state = live.current;
        if (!state.session) return;
        state.session = { ...state.session, panel: panelGeometry(button, screen.width) };
        setSession(state.session);
      },
      move(x, y) {
        const state = live.current;
        if (!state.session?.dragging) return;
        state.start ??= { x, y };
        if (Math.hypot(x - state.start.x, y - state.start.y) > MOVE_THRESHOLD) state.moved = true;
        const index = optionAt(x, y, state.session.panel);
        if (index !== state.hovered) {
          state.hovered = index;
          setHovered(index);
        }
      },
      release() {
        const state = live.current;
        if (!state.session?.dragging) return;
        if (state.hovered !== null) return pick(state.hovered);
        // Slid away and let go: cancel. A plain tap keeps the panel open for tapping.
        if (state.moved) return close();
        const resting = { ...state.session, dragging: false };
        state.session = resting;
        setSession(resting);
      },
    }),
    [screen.width, screen.height, pick, close],
  );

  return (
    <PickerContext.Provider value={api}>
      {children}
      {session ? (
        <View style={StyleSheet.absoluteFill} pointerEvents={session.dragging ? "none" : "box-none"}>
          {session.dragging ? null : (
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t("common.close")} />
          )}
          <View
            style={[styles.panel, { left: session.panel.left, top: session.panel.top, width: session.panel.width }]}
            accessibilityLabel={t("community.chooseReaction")}
          >
            {REACTION_KINDS.map((kind, index) => {
              const active = hovered === index;
              const mine = session.current === kind;
              const label = t(`community.reaction.${kind}`);
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: mine }}
                  onPress={() => pick(index)}
                  style={styles.option}
                >
                  {active ? (
                    <View style={styles.bubble}>
                      <Text style={styles.bubbleLabel} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.face, mine && styles.faceMine, active && styles.faceActive]}>
                    <ReactionFace kind={kind} size={FACE} />
                  </View>
                  <Text style={[styles.label, mine && styles.labelMine]} numberOfLines={2}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </PickerContext.Provider>
  );
}

export function useReactionPicker(): PickerApi {
  const api = useContext(PickerContext);
  if (!api) throw new Error("useReactionPicker must be used inside ReactionPickerProvider");
  return api;
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    flexDirection: "row",
    padding: PADDING,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    boxShadow: `0px 10px 28px ${colors.shadow}`,
  },
  option: { width: OPTION, alignItems: "center", gap: 4 },
  face: { width: FACE + 8, height: FACE + 8, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  faceMine: { backgroundColor: colors.primarySoft },
  faceActive: { transform: [{ scale: 1.35 }, { translateY: -10 }] },
  label: { fontFamily: fonts.ui, fontSize: 11, lineHeight: 13, color: colors.inkMuted, textAlign: "center" },
  labelMine: { color: colors.burgundy, fontFamily: fonts.uiMedium },
  bubble: {
    position: "absolute",
    top: -36,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    zIndex: 1,
  },
  bubbleLabel: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.paper },
});
