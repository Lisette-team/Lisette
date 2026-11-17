import type { OpenCall } from "./catalogue-api";

// A batch sends one work, and a work can have one active submission per publication, so picking a
// second call from the same publication replaces the first. Keyed by call id.
export function toggleCall(selected: Map<string, OpenCall>, call: OpenCall): Map<string, OpenCall> {
  const next = new Map(selected);
  if (next.delete(call.id)) return next;
  for (const [id, other] of next) if (other.publisher_id === call.publisher_id) next.delete(id);
  return next.set(call.id, call);
}
