import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setAudioSession } from "@/lib/callTones";

// Peer-to-peer HD voice (and optional video) for one call. The two browsers exchange connection
// details (offer / answer / network candidates) over a Realtime broadcast
// channel named after the call id; the audio itself goes directly between them,
// or through a relay (TURN) when the network needs one.

/** Opus at 64 kbps mono, full band: wideband "HD voice" quality. */
const HD_VOICE_BITRATE = 64_000;
/** Upper limit for 720p video; the browser lowers it automatically on a weak connection. */
const HD_VIDEO_BITRATE = 1_500_000;
/** Callee repeats "ready" until the caller's offer arrives (the caller may join the channel a moment later). */
const READY_RETRY_MS = 1500;
/** A dropped connection gets this long to recover before the call counts as failed. */
const RECONNECT_GRACE_MS = 15_000;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const HD_MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48_000,
};

const HD_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

export type CallKind = "voice" | "video";
export type CallConnectionState = "connecting" | "connected" | "reconnecting" | "failed" | "closed";
/** How the audio/video travels: straight between the phones, or through a relay server. */
export type CallRoute = "direct" | "relay";
export type CameraFacing = "user" | "environment";

type SignalEvent = "ready" | "offer" | "answer" | "ice" | "hangup" | "camera";

/** STUN plus any relay (TURN) configured on the server; falls back to public STUN only. */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const { data, error } = await supabase.functions.invoke("call-ice", { body: {} });
    if (error) throw error;
    if (Array.isArray(data?.iceServers) && data.iceServers.length) return data.iceServers as RTCIceServer[];
  } catch (error) {
    console.warn("[voiceCall] Using public STUN only; relay config unavailable", error);
  }
  return DEFAULT_ICE_SERVERS;
}

function mediaError(error: unknown, device: "microphone" | "camera"): Error {
  const name = (error as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    const label = device === "camera" ? "Camera" : "Microphone";
    return new Error(
      `${label} access was not allowed. Tap Answer again and choose Allow. If it keeps failing: iPhone Settings → Safari → ${label} → Ask or Allow (Android: Settings → Apps → Chrome → Permissions).`,
    );
  }
  if (name === "NotFoundError") return new Error(`No ${device} was found on this device.`);
  if (name === "NotReadableError" || name === "AbortError") return new Error(`The ${device} is being used by another app or call. Close it and try again.`);
  return new Error(`Could not start the ${device}.`);
}

/** True when the browser refused access (as opposed to a missing or busy device). */
function isRefused(error: unknown): boolean {
  const name = (error as DOMException)?.name;
  return name === "NotAllowedError" || name === "SecurityError";
}

/**
 * Asks for the microphone (and camera). iPhone refuses the microphone while the
 * page's audio is in "playback" mode (used for the ringtone), with the same
 * error as a denied permission, so switch to call mode first. If it is still
 * refused, try once more in the default mode before giving up.
 */
async function requestMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser can't make calls. Try Chrome, or the installed app.");
  }
  setAudioSession("play-and-record");
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (!isRefused(error)) throw error;
    console.warn("[voiceCall] media refused in call mode; retrying in default audio mode", error);
    setAudioSession("auto");
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    setAudioSession("play-and-record");
    return stream;
  }
}

export async function getHdMicrophone(): Promise<MediaStream> {
  try {
    return await requestMedia({ audio: HD_MIC_CONSTRAINTS, video: false });
  } catch (error) {
    console.error("[voiceCall] microphone request failed", error);
    throw error instanceof DOMException ? mediaError(error, "microphone") : error;
  }
}

/** Microphone plus 720p camera. */
export async function getCallMedia(kind: CallKind, facing: CameraFacing = "user"): Promise<MediaStream> {
  if (kind === "voice") return getHdMicrophone();
  try {
    const stream = await requestMedia({
      audio: HD_MIC_CONSTRAINTS,
      video: { ...HD_CAMERA_CONSTRAINTS, facingMode: facing },
    });
    stream.getVideoTracks().forEach((t) => (t.contentHint = "motion"));
    return stream;
  } catch (error) {
    console.error("[voiceCall] camera request failed", error);
    throw error instanceof DOMException ? mediaError(error, "camera") : error;
  }
}

/** Ask Opus for full-band HD voice with loss protection, in both directions. */
function preferHdOpus(sdp: string): string {
  const match = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
  if (!match) return sdp;
  const pt = match[1];
  const params = `minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;maxplaybackrate=48000;maxaveragebitrate=${HD_VOICE_BITRATE};usedtx=0`;
  const fmtp = new RegExp(`a=fmtp:${pt} [^\\r\\n]*`);
  return fmtp.test(sdp)
    ? sdp.replace(fmtp, `a=fmtp:${pt} ${params}`)
    : sdp.replace(match[0], `${match[0]}\r\na=fmtp:${pt} ${params}`);
}

interface VoiceCallOptions {
  callId: string;
  role: "caller" | "callee";
  localStream: MediaStream;
  iceServers: RTCIceServer[];
  onRemoteStream: (stream: MediaStream) => void;
  onStateChange: (state: CallConnectionState) => void;
  /** The other side hung up. */
  onRemoteHangup: () => void;
  /** The other side turned their camera on or off. */
  onRemoteCamera?: (on: boolean) => void;
  /** Known once connected: direct between the phones or through a relay. */
  onRoute?: (route: CallRoute) => void;
}

export class VoiceCall {
  private pc: RTCPeerConnection;
  private channel: RealtimeChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private readyTimer: number | undefined;
  private reconnectTimer: number | undefined;
  private gotOffer = false;
  private closed = false;
  private cameraOn = true;
  private facing: CameraFacing = "user";

  constructor(private readonly opts: VoiceCallOptions) {
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers, bundlePolicy: "max-bundle" });
    opts.localStream.getTracks().forEach((track) => this.pc.addTrack(track, opts.localStream));

    this.pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) opts.onRemoteStream(stream);
    };
    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.send("ice", { candidate: event.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => this.handleConnectionState();
  }

  /** Join the signaling channel. The callee announces itself; the caller answers with an offer. */
  async start(): Promise<void> {
    this.channel = supabase.channel(`call:${this.opts.callId}`, { config: { broadcast: { self: false } } });
    this.channel
      .on("broadcast", { event: "ready" }, () => {
        if (this.opts.role === "caller") this.sendOffer();
      })
      .on("broadcast", { event: "offer" }, ({ payload }) => this.handleOffer(payload.sdp))
      .on("broadcast", { event: "answer" }, ({ payload }) => this.handleAnswer(payload.sdp))
      .on("broadcast", { event: "ice" }, ({ payload }) => this.handleCandidate(payload.candidate))
      .on("broadcast", { event: "hangup" }, () => {
        if (!this.closed) this.opts.onRemoteHangup();
      })
      .on("broadcast", { event: "camera" }, ({ payload }) => this.opts.onRemoteCamera?.(!!payload?.on));

    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error("Could not connect the call"));
      });
    });

    this.opts.onStateChange("connecting");
    if (this.opts.role === "callee") {
      const announce = () => {
        if (this.gotOffer || this.closed) return window.clearInterval(this.readyTimer);
        this.send("ready", {});
      };
      announce();
      this.readyTimer = window.setInterval(announce, READY_RETRY_MS);
    }
  }

  setMuted(muted: boolean) {
    this.opts.localStream.getAudioTracks().forEach((track) => (track.enabled = !muted));
  }

  get hasVideo(): boolean {
    return this.opts.localStream.getVideoTracks().length > 0;
  }

  setCameraEnabled(on: boolean) {
    this.cameraOn = on;
    this.opts.localStream.getVideoTracks().forEach((track) => (track.enabled = on));
    this.send("camera", { on });
  }

  /** Front <-> back camera. Returns the local stream (same object, new video track). */
  async switchCamera(): Promise<MediaStream> {
    const stream = this.opts.localStream;
    const old = stream.getVideoTracks()[0];
    if (!old) return stream;
    const next: CameraFacing = this.facing === "user" ? "environment" : "user";
    let fresh: MediaStream;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({ video: { ...HD_CAMERA_CONSTRAINTS, facingMode: { exact: next } } });
    } catch {
      throw new Error("This phone has only one camera available.");
    }
    const track = fresh.getVideoTracks()[0];
    track.contentHint = "motion";
    track.enabled = this.cameraOn;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    await sender?.replaceTrack(track);
    stream.removeTrack(old);
    old.stop();
    stream.addTrack(track);
    this.facing = next;
    return stream;
  }

  get cameraFacing(): CameraFacing {
    return this.facing;
  }

  /** End the call on this side and tell the other side. */
  hangup() {
    if (this.closed) return;
    this.send("hangup", {});
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.readyTimer);
    window.clearTimeout(this.reconnectTimer);
    this.opts.localStream.getTracks().forEach((track) => track.stop());
    this.pc.close();
    if (this.channel) supabase.removeChannel(this.channel);
    this.opts.onStateChange("closed");
  }

  private send(event: SignalEvent, payload: Record<string, unknown>) {
    this.channel?.send({ type: "broadcast", event, payload }).catch((error) => {
      console.error("[voiceCall] signal send failed", event, error);
    });
  }

  private async sendOffer(iceRestart = false) {
    if (this.closed) return;
    try {
      const offer = await this.pc.createOffer({ iceRestart, offerToReceiveAudio: true });
      const sdp = preferHdOpus(offer.sdp ?? "");
      await this.pc.setLocalDescription({ type: "offer", sdp });
      await this.capSendBitrate();
      this.send("offer", { sdp });
    } catch (error) {
      console.error("[voiceCall] offer failed", error);
    }
  }

  private async handleOffer(sdp: string) {
    if (this.opts.role !== "callee" || this.closed) return;
    this.gotOffer = true;
    window.clearInterval(this.readyTimer);
    try {
      await this.pc.setRemoteDescription({ type: "offer", sdp });
      await this.flushCandidates();
      const answer = await this.pc.createAnswer();
      const hdSdp = preferHdOpus(answer.sdp ?? "");
      await this.pc.setLocalDescription({ type: "answer", sdp: hdSdp });
      await this.capSendBitrate();
      this.send("answer", { sdp: hdSdp });
    } catch (error) {
      console.error("[voiceCall] answering offer failed", error);
    }
  }

  private async handleAnswer(sdp: string) {
    if (this.opts.role !== "caller" || this.closed || this.pc.signalingState !== "have-local-offer") return;
    try {
      await this.pc.setRemoteDescription({ type: "answer", sdp });
      await this.flushCandidates();
    } catch (error) {
      console.error("[voiceCall] applying answer failed", error);
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (this.closed || !candidate) return;
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      console.warn("[voiceCall] bad network candidate", error);
    }
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) await this.handleCandidate(candidate);
  }

  private async capSendBitrate() {
    for (const sender of this.pc.getSenders()) {
      const kind = sender.track?.kind;
      if (kind !== "audio" && kind !== "video") continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = kind === "audio" ? HD_VOICE_BITRATE : HD_VIDEO_BITRATE;
      if (kind === "video") params.degradationPreference = "balanced";
      try {
        await sender.setParameters(params);
      } catch {
        // Some browsers don't allow this; the SDP setting above still applies.
      }
    }
  }

  /** Looks at the connected network path to tell whether a relay is in use. */
  private async reportRoute() {
    try {
      const stats = await this.pc.getStats();
      let pairId: string | undefined;
      stats.forEach((report) => {
        if (report.type === "transport" && report.selectedCandidatePairId) pairId = report.selectedCandidatePairId;
      });
      let pair: RTCIceCandidatePairStats | undefined;
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && (report.id === pairId || (!pairId && report.nominated && report.state === "succeeded"))) {
          pair = report as RTCIceCandidatePairStats;
        }
      });
      if (!pair) return;
      const local = stats.get(pair.localCandidateId);
      const remote = stats.get(pair.remoteCandidateId);
      const relayed = local?.candidateType === "relay" || remote?.candidateType === "relay";
      this.opts.onRoute?.(relayed ? "relay" : "direct");
    } catch (error) {
      console.warn("[voiceCall] could not read connection route", error);
    }
  }

  private handleConnectionState() {
    if (this.closed) return;
    const state = this.pc.connectionState;
    if (state === "connected") {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      this.opts.onStateChange("connected");
      if (this.hasVideo) this.send("camera", { on: this.cameraOn });
      this.reportRoute();
    } else if (state === "disconnected" || state === "failed") {
      this.opts.onStateChange("reconnecting");
      // The caller asks for a fresh network path; give it a while before giving up.
      if (this.opts.role === "caller") this.sendOffer(true);
      if (!this.reconnectTimer) {
        this.reconnectTimer = window.setTimeout(() => {
          if (this.pc.connectionState !== "connected") this.opts.onStateChange("failed");
        }, RECONNECT_GRACE_MS);
      }
    }
  }
}
