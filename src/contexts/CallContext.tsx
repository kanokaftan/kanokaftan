import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CALL_HISTORY_QUERY_KEY } from "@/hooks/useCallHistory";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  VoiceCall, fetchIceServers, getCallMedia, getHdMicrophone,
  type CallConnectionState, type CallKind, type CallRoute,
} from "@/lib/voiceCall";
import { installAudioUnlock, playSound, primeAudio, setAudioSession, startTone } from "@/lib/callTones";
import { CallScreen } from "@/components/calls/CallScreen";
import { setUpdateBlocker } from "@/lib/registerServiceWorker";
import type { Tables } from "@/integrations/supabase/types";

type CallRow = Tables<"calls">;

/** Must match public.call_ring_seconds() so both sides give up together. */
const RING_SECONDS = 45;
/** Backup check of the call row in case a realtime update is missed. */
const STATUS_POLL_MS = 3000;
/** How long "Call ended" stays on screen. */
const ENDED_SCREEN_MS = 1800;
const OVER_STATUSES = new Set(["declined", "missed", "cancelled", "ended", "failed"]);
const MAX_QUICK_REPLY_LENGTH = 300;

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";

export interface CallView {
  phase: CallPhase;
  kind: CallKind;
  peerName: string;
  peerAvatar: string | null;
  muted: boolean;
  connection: CallConnectionState | null;
  startedAt: number | null;
  endedText: string | null;
  cameraOn: boolean;
  /** Front camera: show the self-view mirrored, like a mirror. */
  frontCamera: boolean;
  remoteCameraOn: boolean;
  route: CallRoute | null;
}

interface CallContextValue {
  view: CallView;
  /** Start a voice or video call with the other person in a chat. */
  startCall: (conversationId: string, peer: { name: string; avatar?: string | null }, kind?: CallKind) => Promise<void>;
  inCall: boolean;
}

const IDLE: CallView = {
  phase: "idle", kind: "voice", peerName: "", peerAvatar: null, muted: false, connection: null,
  startedAt: null, endedText: null, cameraOn: true, frontCamera: true, remoteCameraOn: true, route: null,
};

const CallContext = createContext<CallContextValue | undefined>(undefined);

function endedTextFor(status: string, iAmCaller: boolean): string {
  switch (status) {
    case "declined": return iAmCaller ? "Call declined" : "Call ended";
    case "missed": return iAmCaller ? "No answer" : "Missed call";
    case "cancelled": return iAmCaller ? "Call cancelled" : "Missed call";
    case "failed": return "Call dropped (poor connection)";
    default: return "Call ended";
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const [view, setView] = useState<CallView>(IDLE);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const callRef = useRef<CallRow | null>(null);
  const roleRef = useRef<"caller" | "callee">("caller");
  const sessionRef = useRef<VoiceCall | null>(null);
  const stopToneRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<number[]>([]);
  const rowChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const phaseRef = useRef<CallPhase>("idle");
  phaseRef.current = view.phase;

  const stopTone = () => {
    stopToneRef.current?.();
    stopToneRef.current = null;
  };

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.forEach((t) => window.clearInterval(t));
    timersRef.current = [];
  };

  /** Tear everything down and show the ended screen briefly. */
  const finish = useCallback((text: string) => {
    stopTone();
    setAudioSession("auto");
    playSound("callEnded");
    clearTimers();
    sessionRef.current?.close();
    sessionRef.current = null;
    if (rowChannelRef.current) supabase.removeChannel(rowChannelRef.current);
    rowChannelRef.current = null;
    callRef.current = null;
    setRemoteStream(null);
    setLocalStream(null);
    setView((v) => ({ ...v, phase: "ended", endedText: text, connection: null }));
    timersRef.current.push(window.setTimeout(() => setView(IDLE), ENDED_SCREEN_MS));
    // The server records the end a moment later; refresh the call list after that.
    timersRef.current.push(window.setTimeout(() => queryClient.invalidateQueries({ queryKey: CALL_HISTORY_QUERY_KEY }), ENDED_SCREEN_MS));
  }, [queryClient]);

  const endOnServer = useCallback(async (callId: string, reason: "hangup" | "timeout" | "failed") => {
    const { error } = await supabase.rpc("end_call", { p_call_id: callId, p_reason: reason });
    if (error) console.error("[calls] end_call failed", { callId, reason, error });
  }, []);

  const onSessionState = useCallback((state: CallConnectionState) => {
    setView((v) => {
      if (state === "connected" && v.phase !== "active") {
        playSound("callConnected");
        return { ...v, phase: "active", connection: state, startedAt: v.startedAt ?? Date.now() };
      }
      return { ...v, connection: state };
    });
    if (state === "failed" && callRef.current) {
      const id = callRef.current.id;
      endOnServer(id, "failed");
      finish("Call dropped (poor connection)");
    }
  }, [endOnServer, finish]);

  const openSession = useCallback(async (call: CallRow, role: "caller" | "callee", stream: MediaStream) => {
    setAudioSession("play-and-record");
    const iceServers = await fetchIceServers();
    const session = new VoiceCall({
      callId: call.id,
      role,
      localStream: stream,
      iceServers,
      onRemoteStream: setRemoteStream,
      onStateChange: onSessionState,
      onRemoteHangup: () => {
        if (callRef.current?.id === call.id) {
          endOnServer(call.id, "hangup");
          finish("Call ended");
        }
      },
      onRemoteCamera: (on) => setView((v) => ({ ...v, remoteCameraOn: on })),
      onRoute: (route) => setView((v) => ({ ...v, route })),
    });
    sessionRef.current = session;
    await session.start();
  }, [endOnServer, finish, onSessionState]);

  /** Follow the call row (realtime, plus a slow poll as a backup). */
  const watchCall = useCallback((callId: string) => {
    const apply = (row: CallRow | null) => {
      if (callRef.current?.id !== callId) return;
      const iAmCaller = roleRef.current === "caller";
      // Not visible any more (another admin took a support call) or finished.
      if (!row || OVER_STATUSES.has(row.status) || (row.callee_id && row.callee_id !== userId && !iAmCaller)) {
        finish(row ? endedTextFor(row.status, iAmCaller) : "Answered by someone else");
        return;
      }
      callRef.current = row;
      if (row.status === "accepted" && iAmCaller && phaseRef.current === "outgoing") {
        stopTone();
        setView((v) => ({ ...v, phase: "connecting" }));
      }
    };

    rowChannelRef.current = supabase
      .channel(`call-row-${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        (payload) => apply(payload.new as CallRow))
      .subscribe();

    const poll = window.setInterval(async () => {
      if (phaseRef.current !== "outgoing" && phaseRef.current !== "incoming") return;
      const { data, error } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
      if (error) return console.error("[calls] status poll failed", error);
      apply(data as CallRow | null);
    }, STATUS_POLL_MS);
    timersRef.current.push(poll);
  }, [finish, userId]);

  const startCall = useCallback(async (
    conversationId: string,
    peer: { name: string; avatar?: string | null },
    kind: CallKind = "voice",
  ) => {
    if (phaseRef.current !== "idle" && phaseRef.current !== "ended") { toast.error("You are already in a call"); return; }
    primeAudio();
    let stream: MediaStream;
    try {
      stream = await getCallMedia(kind);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the call");
      return;
    }

    const { data, error } = await supabase.rpc("start_call_with", { p_conversation_id: conversationId, p_kind: kind });
    if (error || !data) {
      stream.getTracks().forEach((t) => t.stop());
      { toast.error(error?.message || "Could not start the call"); return; }
    }
    const call = data as unknown as CallRow;
    callRef.current = call;
    roleRef.current = "caller";
    clearTimers();
    setView({ ...IDLE, phase: "outgoing", kind, peerName: peer.name, peerAvatar: peer.avatar ?? null });
    setLocalStream(stream);
    stopToneRef.current = startTone("ringback");
    watchCall(call.id);
    timersRef.current.push(window.setTimeout(() => {
      if (callRef.current?.id === call.id && phaseRef.current === "outgoing") {
        endOnServer(call.id, "timeout");
        finish("No answer");
      }
    }, RING_SECONDS * 1000));

    try {
      await openSession(call, "caller", stream);
    } catch (e) {
      console.error("[calls] could not open call session", e);
      endOnServer(call.id, "failed");
      finish("Could not connect the call");
    }
  }, [endOnServer, finish, openSession, watchCall]);

  /** Seeing the ringing screen in the app stops the repeat phone alerts for this call. */
  const markSeenIfVisible = useCallback((callId: string) => {
    if (document.visibilityState !== "visible") return;
    supabase.rpc("mark_call_seen" as never, { p_call_id: callId } as never).then(({ error }) => {
      if (error) console.error("[calls] mark_call_seen failed", { callId, error });
    });
  }, []);

  /** Shows the caller's photo on the ringing screen (support calls show the Kano Kaftan logo). */
  const loadCallerPhoto = useCallback(async (call: CallRow) => {
    const { data, error } = await supabase.from("profiles").select("avatar_url").eq("id", call.caller_id).maybeSingle();
    if (error) return console.warn("[calls] caller photo unavailable", error);
    if (callRef.current?.id === call.id && data?.avatar_url) setView((v) => ({ ...v, peerAvatar: data.avatar_url }));
  }, []);

  const showIncoming = useCallback((call: CallRow) => {
    if (phaseRef.current !== "idle" && phaseRef.current !== "ended") return; // busy: let it ring out
    if (call.caller_id === userId) return;
    const age = (Date.now() - new Date(call.created_at).getTime()) / 1000;
    if (call.status !== "ringing" || age > RING_SECONDS) return;
    clearTimers();
    callRef.current = call;
    roleRef.current = "callee";
    setView({ ...IDLE, phase: "incoming", kind: call.kind === "video" ? "video" : "voice", peerName: call.caller_name, peerAvatar: null });
    stopToneRef.current = startTone("ringtone");
    watchCall(call.id);
    markSeenIfVisible(call.id);
    loadCallerPhoto(call);
    timersRef.current.push(window.setTimeout(() => {
      if (callRef.current?.id === call.id && phaseRef.current === "incoming") finish("Missed call");
    }, Math.max(1, RING_SECONDS - age) * 1000));
  }, [finish, userId, watchCall, markSeenIfVisible, loadCallerPhoto]);

  // Ringing in the background and then opened: the person has now seen it.
  useEffect(() => {
    const onVisible = () => {
      if (phaseRef.current === "incoming" && callRef.current) markSeenIfVisible(callRef.current.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markSeenIfVisible]);

  const answeringRef = useRef(false);

  /**
   * A microphone problem must never turn into "declined" for the caller: the
   * call keeps ringing so the person can allow access and tap Answer again
   * (or decline it themselves).
   */
  const keepRingingAfterMediaError = useCallback((callId: string, error: unknown) => {
    console.error("[calls] could not open the microphone to answer", { callId, error });
    toast.error(error instanceof Error ? error.message : "Could not start the microphone", { duration: 8000 });
    if (callRef.current?.id === callId && phaseRef.current === "incoming") {
      stopToneRef.current ??= startTone("ringtone");
    }
  }, []);

  const answer = useCallback(async (call: CallRow) => {
    primeAudio();
    stopTone();
    const kind: CallKind = call.kind === "video" ? "video" : "voice";
    let stream: MediaStream;
    try {
      stream = await getCallMedia(kind);
    } catch (error) {
      // No camera? Still answer with voice rather than missing the call.
      if (kind !== "video") return keepRingingAfterMediaError(call.id, error);
      try {
        stream = await getHdMicrophone();
        toast.info("Camera unavailable. Joined with voice only.");
      } catch (micError) {
        return keepRingingAfterMediaError(call.id, micError);
      }
    }
    // The caller may have hung up while the permission prompt was open.
    if (callRef.current?.id !== call.id || phaseRef.current !== "incoming") {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    setLocalStream(stream);
    if (kind === "video" && stream.getVideoTracks().length === 0) setView((v) => ({ ...v, cameraOn: false }));
    const { data, error } = await supabase.rpc("answer_call", { p_call_id: call.id });
    if (error || !data) {
      stream.getTracks().forEach((t) => t.stop());
      if (error) console.error("[calls] answer_call failed", { callId: call.id, error });
      return finish(error?.message || "This call has ended");
    }
    callRef.current = data as unknown as CallRow;
    setView((v) => ({ ...v, phase: "connecting" }));
    try {
      await openSession(callRef.current, "callee", stream);
    } catch (e) {
      console.error("[calls] could not open call session", e);
      endOnServer(call.id, "failed");
      finish("Could not connect the call");
    }
  }, [endOnServer, finish, openSession, keepRingingAfterMediaError]);

  const accept = useCallback(async () => {
    const call = callRef.current;
    if (!call || answeringRef.current) return;
    answeringRef.current = true;
    try {
      await answer(call);
    } finally {
      answeringRef.current = false;
    }
  }, [answer]);

  const acceptRef = useRef(accept);
  acceptRef.current = accept;

  const hangUp = useCallback(() => {
    const call = callRef.current;
    if (!call) return setView(IDLE);
    sessionRef.current?.hangup();
    endOnServer(call.id, "hangup");
    const iAmCaller = roleRef.current === "caller";
    finish(phaseRef.current === "incoming" ? "Call declined" : phaseRef.current === "outgoing" && iAmCaller ? "Call cancelled" : "Call ended");
  }, [endOnServer, finish]);

  /** Decline and send a short chat message, e.g. "Can't talk now, I'll call you back". */
  const declineWithMessage = useCallback(async (text: string) => {
    const call = callRef.current;
    if (!call || phaseRef.current !== "incoming" || !userId) return;
    const conversationId = call.conversation_id;
    hangUp();
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: text.trim().slice(0, MAX_QUICK_REPLY_LENGTH),
      message_type: "text",
    });
    if (error) {
      console.error("[calls] quick reply failed", { callId: call.id, error });
      toast.error("Call declined, but the message didn't send. Open the chat to reply.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    toast.success("Message sent");
  }, [hangUp, userId, queryClient]);

  const toggleCamera = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.hasVideo) return;
    setView((v) => {
      session.setCameraEnabled(!v.cameraOn);
      return { ...v, cameraOn: !v.cameraOn };
    });
  }, []);

  const flipCamera = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.hasVideo) return;
    try {
      const stream = await session.switchCamera();
      // New object so the preview element picks up the new track.
      setLocalStream(new MediaStream(stream.getTracks()));
      setView((v) => ({ ...v, frontCamera: session.cameraFacing === "user" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not switch camera");
    }
  }, []);

  const toggleMute = useCallback(() => {
    setView((v) => {
      sessionRef.current?.setMuted(!v.muted);
      return { ...v, muted: !v.muted };
    });
  }, []);

  // Incoming calls: new rows addressed to me (and support calls for admins),
  // plus any call already ringing when the app opens (e.g. from a notification).
  useEffect(() => {
    if (!userId) return;
    const onInsert = (payload: { new: unknown }) => showIncoming(payload.new as CallRow);
    let channel = supabase
      .channel(`calls-in-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${userId}` }, onInsert);
    if (isAdmin) {
      channel = channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: "to_support=eq.true" }, onInsert);
    }
    channel.subscribe();

    (async () => {
      const since = new Date(Date.now() - RING_SECONDS * 1000).toISOString();
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .eq("status", "ringing")
        .neq("caller_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) return console.error("[calls] could not check ringing calls", error);

      // Opened from the call notification: "Answer" joins straight away.
      const params = new URLSearchParams(window.location.search);
      const answerId = params.get("answer_call");
      const notifiedId = answerId ?? params.get("ring_call");
      if (notifiedId) {
        params.delete("answer_call");
        params.delete("ring_call");
        const query = params.toString();
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      }
      const call = (data ?? []).find((c) => c.id === notifiedId) ?? data?.[0];
      if (!call) {
        if (notifiedId) toast.info("That call has already ended");
        return;
      }
      showIncoming(call as CallRow);
      if (answerId && call.id === answerId) acceptRef.current();
    })();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isAdmin, showIncoming]);

  // Get sound ready on the first tap so an incoming call can ring (iPhone).
  useEffect(() => {
    installAudioUnlock();
  }, []);

  // Signing out ends any call.
  useEffect(() => {
    if (!userId && callRef.current) finish("Call ended");
  }, [userId, finish]);

  useEffect(() => () => {
    stopTone();
    clearTimers();
    sessionRef.current?.close();
  }, []);

  const inCall = view.phase !== "idle" && view.phase !== "ended";

  // Never reload into a new version in the middle of a call.
  useEffect(() => {
    setUpdateBlocker("call", inCall);
  }, [inCall]);

  return (
    <CallContext.Provider value={{ view, startCall, inCall }}>
      {children}
      {view.phase !== "idle" && (
        <CallScreen
          view={view}
          remoteStream={remoteStream}
          localStream={localStream}
          onAccept={accept}
          onHangUp={hangUp}
          onDeclineWithMessage={declineWithMessage}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onFlipCamera={flipCamera}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within a CallProvider");
  return context;
}
