import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Number of bars in a voice note waveform. */
const BAR_COUNT = 32;
const SPEEDS = [1, 1.5, 2] as const;
const MIN_BAR = 0.12;

interface LoadedVoice {
  /** Local copy, so playback starts instantly and seeking never waits on the network. */
  objectUrl: string;
  peaks: number[];
  /** From decoding; recorded webm files often don't report their own length. */
  duration: number | null;
}

/** One download per voice note, shared by every player showing it. */
const loads = new Map<string, Promise<LoadedVoice>>();

/** Deterministic stand-in bars when the audio can't be decoded (e.g. older iPhones and webm). */
function placeholderPeaks(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1103515245 + 12345) | 0;
    const wave = 0.5 + 0.35 * Math.sin(i / 2.3);
    return Math.max(MIN_BAR, Math.min(1, wave * (0.6 + ((h >>> 16) % 100) / 250)));
  });
}

async function decode(data: ArrayBuffer): Promise<{ peaks: number[]; duration: number } | null> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(data);
    const channel = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      for (let j = 0; j < block; j++) sum += Math.abs(channel[i * block + j] ?? 0);
      peaks.push(sum / block);
    }
    const max = Math.max(...peaks, 0.0001);
    return { peaks: peaks.map((p) => Math.max(MIN_BAR, p / max)), duration: audio.duration };
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => undefined);
  }
}

function loadVoice(src: string, cacheKey: string): Promise<LoadedVoice> {
  const existing = loads.get(cacheKey);
  if (existing) return existing;
  const promise = (async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Voice note download failed (${res.status})`);
    const blob = await res.blob();
    const decoded = await decode(await blob.arrayBuffer());
    return {
      objectUrl: URL.createObjectURL(blob),
      peaks: decoded?.peaks ?? placeholderPeaks(cacheKey),
      duration: decoded?.duration ?? null,
    };
  })();
  loads.set(cacheKey, promise);
  promise.catch(() => loads.delete(cacheKey)); // allow a retry later
  return promise;
}

const formatTime = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
};

/**
 * Voice note player: play/pause, a waveform you can tap to jump to a point,
 * time and playback speed. `tone` matches the bubble it sits in.
 * `cacheKey` should stay the same for the same file (signed URLs change hourly).
 */
export function VoicePlayer({
  src,
  cacheKey = src,
  tone = "light",
  className,
}: {
  src: string;
  cacheKey?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playWhenReady = useRef(false);
  const [voice, setVoice] = useState<LoadedVoice | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);

  // Local recordings (blob: URLs) need no download.
  const isLocal = src.startsWith("blob:");

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (isLocal) {
      // Still decode for the waveform, without blocking playback.
      fetch(src)
        .then((r) => r.arrayBuffer())
        .then(decode)
        .then((d) => !cancelled && setVoice({ objectUrl: src, peaks: d?.peaks ?? placeholderPeaks(src), duration: d?.duration ?? null }))
        .catch(() => !cancelled && setVoice({ objectUrl: src, peaks: placeholderPeaks(src), duration: null }));
    } else {
      loadVoice(src, cacheKey)
        .then((v) => !cancelled && setVoice(v))
        .catch((error) => {
          console.error("[voice] could not load voice note", error);
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [src, cacheKey, isLocal]);

  const duration = voice?.duration ?? (Number.isFinite(mediaDuration) ? mediaDuration : 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrent(audio.currentTime);
      const total = voice?.duration ?? (Number.isFinite(audio.duration) ? audio.duration : 0);
      if (total) setProgress(Math.min(1, audio.currentTime / total));
    };
    const onMeta = () => setMediaDuration(audio.duration);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    if (audio.readyState >= 1) onMeta();
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, [voice]);

  const start = () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Only one voice note plays at a time.
    document.querySelectorAll<HTMLAudioElement>("audio[data-voice-note]").forEach((a) => a !== audio && a.pause());
    audio.playbackRate = SPEEDS[speedIndex];
    audio.play().catch((e) => console.warn("[voice] play failed", e));
  };

  // Tapped play while still downloading: start as soon as it's ready.
  useEffect(() => {
    if (voice && playWhenReady.current) {
      playWhenReady.current = false;
      setWaiting(false);
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start reads refs/state at call time
  }, [voice]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!voice) {
      playWhenReady.current = true;
      setWaiting(true);
      return;
    }
    if (!audio) return;
    if (audio.paused) start();
    else audio.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setProgress(ratio);
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const dark = tone === "dark";
  const peaks = voice?.peaks ?? placeholderPeaks(cacheKey);
  const loading = !voice && !failed;

  return (
    <div className={cn("flex w-[230px] max-w-full items-center gap-2.5", className)}>
      {voice && <audio ref={audioRef} src={voice.objectUrl} preload="auto" data-voice-note />}
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform active:scale-90 disabled:opacity-50",
          dark ? "bg-white/90 text-[hsl(var(--chat-out))]" : "bg-primary text-primary-foreground",
        )}
      >
        {loading && waiting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label="Voice note position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onClick={seek}
          className={cn("flex h-7 cursor-pointer items-center gap-[2px]", loading && "animate-pulse")}
        >
          {peaks.map((peak, i) => {
            const played = i / peaks.length < progress;
            return (
              <span
                key={i}
                className={cn(
                  "w-[3px] flex-1 rounded-full transition-colors",
                  dark ? (played ? "bg-white" : "bg-white/40") : played ? "bg-primary" : "bg-foreground/20",
                )}
                style={{ height: `${Math.round(peak * 100)}%` }}
              />
            );
          })}
        </div>
        <div className={cn("mt-0.5 flex items-center justify-between text-[10px] tabular-nums", dark ? "text-white/75" : "text-muted-foreground")}>
          <span>{failed ? "Couldn't load" : formatTime(playing || current ? current : duration)}</span>
          <button type="button" onClick={cycleSpeed} className={cn("rounded-full px-1.5 font-semibold", dark ? "bg-white/20" : "bg-foreground/10")}>
            {SPEEDS[speedIndex]}×
          </button>
        </div>
      </div>
    </div>
  );
}
