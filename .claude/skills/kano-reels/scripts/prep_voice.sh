#!/usr/bin/env bash
# Cleans and levels an ElevenLabs (or recorded) voiceover for the reel: low rumble cut, -15 LUFS, 48 kHz stereo WAV.
#   bash prep_voice.sh input.mp3 assets/voiceover.wav
set -euo pipefail
ffmpeg -v error -y -i "$1" -af "highpass=f=80,loudnorm=I=-15:TP=-1.5:LRA=9" -ar 48000 -ac 2 "$2"
printf "voice ready: %s (%ss)\n" "$2" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$2")"
