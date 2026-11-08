export type EventItem = { id: string; name: string };
export type CategoryItem = { id: string; name: string };
export type NoteItem = { id: string; content: string };

/** URL上のIDは、正のJava Longを精度を失わず文字列として扱う。 */
export function isEntryId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
}
