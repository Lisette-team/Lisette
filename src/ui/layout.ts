import { useWindowDimensions } from "react-native";

// From this width (web, tablets in landscape) the app uses the v6 web layout: the left sidebar
// instead of the bottom bar, and wide screens of their own where the designs have them (S-60 web).
export const wideBreakpoint = 960;

export function useWide(): boolean {
  return useWindowDimensions().width >= wideBreakpoint;
}
