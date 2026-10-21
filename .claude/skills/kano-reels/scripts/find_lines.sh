#!/usr/bin/env bash
# Prints where each spoken line starts in a voiceover, from its pauses.
# Long pauses (>= 0.45s) are line breaks; shorter ones are pauses inside a line.
#   bash find_lines.sh voiceover.mp3
set -euo pipefail
VO="$1"
LINE_BREAK=${LINE_BREAK:-0.45}
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VO")
echo "duration: ${dur}s"
ffmpeg -hide_banner -i "$VO" -af silencedetect=noise=-40dB:d=0.15 -f null - 2>&1 \
  | grep -oE "silence_(start|end): [0-9.]+|silence_duration: [0-9.]+" \
  | awk -v lb="$LINE_BREAK" '
      /silence_end/ { end=$2 }
      /silence_duration/ { d=$2; kind=(d>=lb)?"LINE":"pause"; if (kind=="LINE") printf("line starts at %.2fs (after %.2fs pause)\n", end, d); else printf("   short pause %.2fs, speech resumes %.2fs\n", d, end) }'
echo "(line 1 starts at 0.00s)"
