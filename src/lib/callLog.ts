import type { CallKind } from "@/lib/voiceCall";

/** A "📞 Missed voice call" note the server adds to the chat when a call isn't answered (see end_call). */
export interface CallLogNote {
  status: "missed" | "declined";
  kind: CallKind;
}

const CALL_LOG_PATTERN = /^\s*(?:📞|📹)?\s*(Missed|Declined) (voice|video) call\s*$/u;

export function parseCallLog(body: string | null | undefined): CallLogNote | null {
  const match = CALL_LOG_PATTERN.exec(body ?? "");
  if (!match) return null;
  return { status: match[1] === "Declined" ? "declined" : "missed", kind: match[2] === "video" ? "video" : "voice" };
}

/** How the note reads for each side: the caller (who the note is from) or the person called. */
export function callLogLabel(note: CallLogNote, iAmCaller: boolean): string {
  const type = note.kind === "video" ? "video call" : "voice call";
  if (note.status === "declined") return iAmCaller ? `Declined ${type}` : `You declined a ${type}`;
  return iAmCaller ? `No answer · ${type}` : `Missed ${type}`;
}
