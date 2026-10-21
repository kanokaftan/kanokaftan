#!/usr/bin/env bash
# Platform copies of a 4K master. Instagram/TikTok re-encode anything above 1080x1920, often badly;
# uploading their native size at a high bitrate keeps it sharper. Loudness to -14 LUFS / -1 dBTP.
#   bash export_social.sh renders/master-4k.mp4
set -euo pipefail
IN="$1"; BASE="${IN%.*}"
AF="loudnorm=I=-14:TP=-1.5:LRA=11"
# Reels / TikTok / Shorts: 1080x1920, 30 fps, H.264 High, BT.709, AAC 48k
ffmpeg -v error -y -i "$IN" -vf "scale=1080:1920:flags=lanczos,format=yuv420p" -r 30 -c:v libx264 -preset slow -crf 17 -maxrate 16M -bufsize 32M \
  -profile:v high -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart -af "$AF" -c:a aac -b:a 256k -ar 48000 "${BASE}-reels-1080.mp4"
# WhatsApp Status: max ~16 MB and 90 s; 720x1280 keeps quality inside the cap
ffmpeg -v error -y -i "$IN" -vf "scale=720:1280:flags=lanczos,format=yuv420p" -r 30 -c:v libx264 -preset slow -crf 23 -maxrate 2.5M -bufsize 5M \
  -profile:v high -movflags +faststart -af "$AF" -c:a aac -b:a 128k -ar 44100 "${BASE}-whatsapp-720.mp4"
ls -la "${BASE}-reels-1080.mp4" "${BASE}-whatsapp-720.mp4"
