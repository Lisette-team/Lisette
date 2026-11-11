import { SvgXml } from "react-native-svg";

import type { ReactionKind } from "./api";

// The bookmark mascot's three reaction faces, copied from docs/design/assets/illustrations/reactie-*.svg.
const ART: Record<ReactionKind, string> = {
  love:
    '<svg viewBox="0 0 48 48"><path d="M13 4.5h22a2.5 2.5 0 0 1 2.5 2.5v37l-13.5-8.5-13.5 8.5V7a2.5 2.5 0 0 1 2.5-2.5z" fill="#7A2233" stroke="#2E1F1A" stroke-width="2" stroke-linejoin="round"/><path d="M11.5 10.5h25" stroke="#C99A4E" stroke-width="2.5"/><path d="M11.5 13.5h25" stroke="#C99A4E" stroke-width="1"/><circle cx="16" cy="27" r="2.3" fill="#E9A3AE"/><circle cx="32" cy="27" r="2.3" fill="#E9A3AE"/><path d="M18.5 24.6l-3-2.8a1.9 1.9 0 0 1 3-2.4 1.9 1.9 0 0 1 3 2.4z" fill="#F6EFE3"/><path d="M29.5 24.6l-3-2.8a1.9 1.9 0 0 1 3-2.4 1.9 1.9 0 0 1 3 2.4z" fill="#F6EFE3"/><path d="M18.5 28.5q5.5 7 11 0z" fill="#F6EFE3" stroke="#F6EFE3" stroke-width="1.2" stroke-linejoin="round"/><path d="M42 9.5l-2.6-2.4a1.6 1.6 0 0 1 2.6-2 1.6 1.6 0 0 1 2.6 2z" fill="#C99A4E"/><path d="M5.5 15l-1.9-1.8a1.2 1.2 0 0 1 1.9-1.5 1.2 1.2 0 0 1 1.9 1.5z" fill="#C99A4E"/></svg>',
  okay:
    '<svg viewBox="0 0 48 48"><path d="M13 4.5h22a2.5 2.5 0 0 1 2.5 2.5v37l-13.5-8.5-13.5 8.5V7a2.5 2.5 0 0 1 2.5-2.5z" fill="#7A2233" stroke="#2E1F1A" stroke-width="2" stroke-linejoin="round"/><path d="M11.5 10.5h25" stroke="#C99A4E" stroke-width="2.5"/><path d="M11.5 13.5h25" stroke="#C99A4E" stroke-width="1"/><circle cx="16" cy="27" r="2.3" fill="#E9A3AE"/><circle cx="32" cy="27" r="2.3" fill="#E9A3AE"/><circle cx="18.5" cy="21.5" r="2.8" fill="#F6EFE3"/><circle cx="29.5" cy="21.5" r="2.8" fill="#F6EFE3"/><circle cx="19" cy="22.2" r="1.4" fill="#2E1F1A"/><circle cx="30" cy="22.2" r="1.4" fill="#2E1F1A"/><path d="M15.5 17.5h5.5M27 17h5.5" stroke="#F6EFE3" stroke-width="1.6" stroke-linecap="round"/><path d="M20 30.5h8" stroke="#F6EFE3" stroke-width="2" stroke-linecap="round"/></svg>',
  dislike:
    '<svg viewBox="0 0 48 48"><path d="M13 4.5h22a2.5 2.5 0 0 1 2.5 2.5v37l-13.5-8.5-13.5 8.5V7a2.5 2.5 0 0 1 2.5-2.5z" fill="#7A2233" stroke="#2E1F1A" stroke-width="2" stroke-linejoin="round"/><path d="M11.5 10.5h25" stroke="#C99A4E" stroke-width="2.5"/><path d="M11.5 13.5h25" stroke="#C99A4E" stroke-width="1"/><circle cx="18.5" cy="22" r="2.8" fill="#F6EFE3"/><circle cx="29.5" cy="22" r="2.8" fill="#F6EFE3"/><circle cx="18.5" cy="23" r="1.4" fill="#2E1F1A"/><circle cx="29.5" cy="23" r="1.4" fill="#2E1F1A"/><path d="M15 16.5l6 2.2M33 16.5l-6 2.2" stroke="#F6EFE3" stroke-width="1.8" stroke-linecap="round"/><path d="M19 32q5-5 10 0" fill="none" stroke="#F6EFE3" stroke-width="2" stroke-linecap="round"/><path d="M34.5 25.5c0 1.6-1 2.6-2.2 2.6s-2.2-1-2.2-2.6c0-1.5 2.2-4.2 2.2-4.2s2.2 2.7 2.2 4.2z" fill="#BFD3E0" stroke="#2E1F1A" stroke-width=".8"/></svg>',
};

export function ReactionFace({ kind, size = 24 }: { kind: ReactionKind; size?: number }) {
  return <SvgXml xml={ART[kind]} width={size} height={size} />;
}
