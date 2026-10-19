import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Lock, MessageSquareText, Mic, MicOff, Phone, PhoneOff, RefreshCcw, Send, Video, VideoOff, WifiOff, X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CallView } from "@/contexts/CallContext";
import { cn } from "@/lib/utils";

/** One-tap answers when you can't pick up. */
const QUICK_REPLIES = [
  "Can't talk now. I'll call you back.",
  "I'm busy. Please send me a message.",
  "I'll call you in 10 minutes.",
];
const MAX_REPLY_LENGTH = 300;

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (!startedAt) return null;
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(secs / 3600);
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function statusText(view: CallView, elapsed: string | null): string {
  switch (view.phase) {
    case "outgoing": return "Calling…";
    case "incoming": return view.kind === "video" ? "Kano Kaftan video call" : "Kano Kaftan voice call";
    case "connecting": return "Connecting…";
    case "active": return elapsed ?? "0:00";
    case "ended": return view.endedText ?? "Call ended";
    default: return "";
  }
}

/** Round control with a label underneath (iOS call style). */
function ControlButton({
  label, onClick, tone = "glass", size = "md", children,
}: {
  label: string;
  onClick: () => void;
  tone?: "glass" | "on" | "red" | "green";
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-[72px] flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex items-center justify-center rounded-full transition-all duration-150 active:scale-90",
          size === "lg" ? "h-[72px] w-[72px]" : "h-[60px] w-[60px]",
          tone === "glass" && "bg-white/15 text-white backdrop-blur-xl hover:bg-white/25",
          tone === "on" && "bg-white text-neutral-900",
          tone === "red" && "bg-[#ff3b30] text-white shadow-[0_8px_24px_-6px_rgba(255,59,48,0.7)]",
          tone === "green" && "bg-[#34c759] text-white shadow-[0_8px_24px_-6px_rgba(52,199,89,0.7)]",
        )}
      >
        {children}
      </button>
      <span className="text-[11px] font-medium text-white/85">{label}</span>
    </div>
  );
}

/** Plays a stream in a <video> (or hidden <audio> for voice-only). */
function useStreamElement<T extends HTMLMediaElement>(stream: MediaStream | null) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) el.play().catch((e) => console.warn("[calls] media did not autoplay", e));
  }, [stream]);
  return ref;
}

/** Soft rings that pulse out from the photo while the call is ringing. */
function RingingHalo() {
  return (
    <>
      {[0, 600, 1200].map((delay) => (
        <span
          key={delay}
          className="absolute inset-0 rounded-full border border-white/30 animate-[call-halo_1.8s_ease-out_infinite]"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </>
  );
}

/** "Can't talk now" sheet: pick a ready reply or write your own, then the call is declined. */
function QuickReplySheet({ onSend, onClose }: { onSend: (text: string) => void; onClose: () => void }) {
  const [custom, setCustom] = useState("");
  const sendCustom = () => {
    if (custom.trim()) onSend(custom.trim());
  };
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/40 animate-in fade-in-0 duration-150" onClick={onClose}>
      <div
        className="w-full rounded-t-[28px] border-t border-white/15 bg-neutral-900/85 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur-2xl animate-in slide-in-from-bottom-8 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Reply with a message</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="overflow-hidden rounded-2xl bg-white/10">
          {QUICK_REPLIES.map((text) => (
            <li key={text} className="border-b border-white/10 last:border-b-0">
              <button type="button" onClick={() => onSend(text)} className="w-full px-4 py-3.5 text-left text-[15px] active:bg-white/10">
                {text}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2 rounded-full bg-white/10 py-1 pl-4 pr-1">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, MAX_REPLY_LENGTH))}
            onKeyDown={(e) => e.key === "Enter" && sendCustom()}
            placeholder="Write your own…"
            aria-label="Write your own message"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-white/50"
          />
          <button
            type="button"
            onClick={sendCustom}
            disabled={!custom.trim()}
            aria-label="Send and decline"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#34c759] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The call screen: ringing, connecting, in call (voice or video) and a short "ended" state.
 * During a call it can be shrunk to a bar at the top so the person can keep using the app.
 */
export function CallScreen({
  view,
  remoteStream,
  localStream,
  onAccept,
  onHangUp,
  onDeclineWithMessage,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
}: {
  view: CallView;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  onAccept: () => void;
  onHangUp: () => void;
  onDeclineWithMessage: (text: string) => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
}) {
  const elapsed = useElapsed(view.startedAt);
  const isVideo = view.kind === "video";
  const remoteVideoRef = useStreamElement<HTMLVideoElement>(isVideo ? remoteStream : null);
  const remoteAudioRef = useStreamElement<HTMLAudioElement>(isVideo ? null : remoteStream);
  const localVideoRef = useStreamElement<HTMLVideoElement>(isVideo ? localStream : null);
  const [minimised, setMinimised] = useState(false);
  const [replying, setReplying] = useState(false);

  const ended = view.phase === "ended";
  const incoming = view.phase === "incoming";
  const ringing = incoming || view.phase === "outgoing";
  const reconnecting = view.phase === "active" && view.connection === "reconnecting";
  const hasLocalVideo = !!localStream?.getVideoTracks().length;
  const showRemoteVideo = isVideo && view.phase === "active" && view.remoteCameraOn && !!remoteStream?.getVideoTracks().length;
  // Before the call connects, a video caller sees themselves full screen (like a mirror).
  const localFullScreen = isVideo && hasLocalVideo && view.cameraOn && (view.phase === "outgoing" || view.phase === "connecting");
  const canMinimise = !incoming && !ended;
  const isMinimised = minimised && canMinimise;
  const status = statusText(view, elapsed);

  // A new call always opens full screen; an ended one closes the sheet.
  useEffect(() => {
    if (incoming || ended) setMinimised(false);
    if (!incoming) setReplying(false);
  }, [incoming, ended]);

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Shrunk call: a bar at the top (and the other person's video in a corner). */}
      {isMinimised && (
        <div className="fixed inset-x-0 top-0 z-[200] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] animate-in slide-in-from-top-4 duration-200">
          <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-[#34c759] py-1.5 pl-1.5 pr-1.5 text-white shadow-lg">
            <button type="button" onClick={() => setMinimised(false)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Back to the call">
              <Avatar className="h-8 w-8 border border-white/40">
                <AvatarImage src={view.peerAvatar || undefined} alt="" />
                <AvatarFallback className="bg-white/20 text-sm text-white">{view.peerName.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{view.peerName}</span>
                <span className="block text-[11px] text-white/85 tabular-nums">{reconnecting ? "Reconnecting…" : `${status} · tap to return`}</span>
              </span>
            </button>
            <button type="button" onClick={onToggleMute} aria-label={view.muted ? "Unmute" : "Mute"} className={cn("flex h-8 w-8 items-center justify-center rounded-full", view.muted ? "bg-white text-[#34c759]" : "bg-white/20")}>
              {view.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onHangUp} aria-label="End call" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff3b30]">
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div
        role="dialog"
        aria-label={`${isVideo ? "Video" : "Voice"} call with ${view.peerName}`}
        aria-hidden={isMinimised}
        data-no-pull-refresh
        className={cn(
          "overflow-hidden text-white",
          isMinimised
            ? // The video keeps playing in a small tile; tap it to go back.
              isVideo && showRemoteVideo
              ? "fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-3 z-[199] h-44 w-28 rounded-2xl border border-white/20 shadow-2xl"
              : "pointer-events-none fixed h-0 w-0 opacity-0"
            : "fixed inset-0 z-[200] bg-neutral-950 animate-in fade-in-0 duration-200",
        )}
        onClick={isMinimised ? () => setMinimised(false) : undefined}
      >
        {/* Background: the person's photo, blurred, over the brand colour. */}
        {!isMinimised && (
          <div aria-hidden className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[#3a1a0c] via-[#2A0800] to-black" />
            {view.peerAvatar && (
              <img src={view.peerAvatar} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          </div>
        )}

        {/* Other person's video fills the screen */}
        {isVideo && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={cn("absolute inset-0 h-full w-full bg-black object-cover transition-opacity duration-300", showRemoteVideo ? "opacity-100" : "opacity-0")}
          />
        )}

        {/* Own camera: full screen while ringing, small corner preview once connected */}
        {/* Kept mounted while shrunk so the preview comes straight back. */}
        {isVideo && hasLocalVideo && !ended && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute bg-black object-cover transition-all duration-300",
              view.frontCamera && "-scale-x-100",
              localFullScreen
                ? "inset-0 h-full w-full opacity-70"
                : "right-3 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[1] h-40 w-28 rounded-2xl border border-white/25 shadow-2xl sm:h-48 sm:w-36",
              (!view.cameraOn || isMinimised) && "opacity-0",
              isMinimised && "pointer-events-none",
            )}
          />
        )}

        {!isMinimised && (
          <div className="relative flex h-full flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            {/* Top bar */}
            <div className="flex h-10 items-center justify-between">
              {canMinimise ? (
                <button
                  type="button"
                  onClick={() => setMinimised(true)}
                  aria-label="Shrink call and keep using the app"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-xl active:scale-90"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              ) : (
                <span className="h-10 w-10" />
              )}
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur-xl">
                <Lock className="h-3 w-3" />
                Encrypted · {isVideo ? "HD video" : "HD voice"}
              </span>
              <span className="h-10 w-10" />
            </div>

            {/* Who and status */}
            {showRemoteVideo ? (
              <div className="mt-3 self-start rounded-2xl bg-black/35 px-3 py-2 backdrop-blur-md">
                <p className="text-sm font-semibold">{view.peerName}</p>
                <p className="text-xs tabular-nums text-white/80">{status}</p>
              </div>
            ) : (
              <div className={cn("flex flex-col items-center text-center", localFullScreen ? "mt-10" : "mt-[12vh]")}>
                {!localFullScreen && (
                  <div className="relative mb-6 h-32 w-32">
                    {ringing && <RingingHalo />}
                    <Avatar className="relative h-32 w-32 border border-white/25 shadow-2xl">
                      <AvatarImage src={view.peerAvatar || undefined} alt="" className="object-cover" />
                      <AvatarFallback className="bg-white/15 text-5xl font-light text-white">{view.peerName.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <h2 className="max-w-full truncate text-[32px] font-semibold leading-tight tracking-tight">{view.peerName}</h2>
                <p className={cn("mt-1.5 text-[17px] text-white/75", view.phase === "active" && "tabular-nums text-white/90", ended && "text-white")}>
                  {status}
                </p>
                {isVideo && view.phase === "active" && !view.remoteCameraOn && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-white/60"><VideoOff className="h-3.5 w-3.5" />Their camera is off</p>
                )}
              </div>
            )}

            {reconnecting && (
              <div className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black">
                <WifiOff className="h-3.5 w-3.5" />
                Weak network, reconnecting…
              </div>
            )}

            <div className="flex-1" />

            {/* Controls */}
            {!ended && (incoming ? (
              <div className="space-y-8">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setReplying(true)}
                    className="flex flex-col items-center gap-1.5 text-white/85 active:scale-95"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-xl">
                      <MessageSquareText className="h-5 w-5" />
                    </span>
                    <span className="text-[11px] font-medium">Message</span>
                  </button>
                </div>
                <div className="flex items-end justify-around px-4">
                  <ControlButton label="Decline" onClick={onHangUp} tone="red" size="lg">
                    <PhoneOff className="h-8 w-8" />
                  </ControlButton>
                  <ControlButton label="Accept" onClick={onAccept} tone="green" size="lg">
                    <span className="animate-[call-nudge_1.4s_ease-in-out_infinite]">
                      {isVideo ? <Video className="h-8 w-8" /> : <Phone className="h-8 w-8" />}
                    </span>
                  </ControlButton>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-sm items-start justify-around rounded-[32px] bg-white/10 px-2 pb-3 pt-4 backdrop-blur-2xl">
                <ControlButton label={view.muted ? "Unmute" : "Mute"} onClick={onToggleMute} tone={view.muted ? "on" : "glass"}>
                  {view.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </ControlButton>
                {isVideo && hasLocalVideo && (
                  <>
                    <ControlButton label={view.cameraOn ? "Camera" : "Camera off"} onClick={onToggleCamera} tone={view.cameraOn ? "glass" : "on"}>
                      {view.cameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                    </ControlButton>
                    <ControlButton label="Flip" onClick={onFlipCamera}>
                      <RefreshCcw className="h-6 w-6" />
                    </ControlButton>
                  </>
                )}
                <ControlButton label="End" onClick={onHangUp} tone="red">
                  <PhoneOff className="h-6 w-6" />
                </ControlButton>
              </div>
            ))}

            {view.phase === "active" && view.route && (
              <p className="mt-3 text-center text-[10px] text-white/45">
                {view.route === "direct" ? "Direct connection" : "Connected through relay"}
              </p>
            )}
          </div>
        )}

        {replying && incoming && (
          <QuickReplySheet
            onClose={() => setReplying(false)}
            onSend={(text) => {
              setReplying(false);
              onDeclineWithMessage(text);
            }}
          />
        )}
      </div>
    </>
  );
}
