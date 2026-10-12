/** Emoji the app itself used to put in front of system messages ("📷 Photo", "📞 Missed call", "🛍️ Is this available?"). */
const LEADING_SYSTEM_EMOJI = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*\s*)+/u;

/** Drops a leading emoji from app-generated text; what people type themselves is left alone elsewhere. */
export function withoutLeadingEmoji(text: string | null | undefined): string {
  return (text ?? "").replace(LEADING_SYSTEM_EMOJI, "");
}
