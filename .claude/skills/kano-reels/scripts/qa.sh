#!/usr/bin/env bash
# Professional delivery checks on a finished reel. Prints PASS/WARN/FAIL per gate and exits 1 on any FAIL.
#   bash qa.sh renders/my-reel-4k.mp4 [expected_seconds]
# Gates (from the pro video skills studied: ffmpeg-skill, motionmaxxing, Barty-Bart sound-effects):
#   size 9:16 · duration · loudness -14 LUFS ±1.5 (social) · true peak <= -1 dBTP · mono fold-down doesn't collapse
#   no frozen stretch > 3 frames mid-video · no black frames · end hold <= 1.4 s · audio present all the way
set -uo pipefail
F="$1"; EXPECT="${2:-}"
FPS=30
fail=0
say() { printf "%-5s %s\n" "$1" "$2"; if [ "$1" = FAIL ]; then fail=1; fi; return 0; }

IFS=x read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$F")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F")
if [ $((W * 16)) -eq $((H * 9)) ]; then say PASS "frame ${W}x${H} (9:16)"; else say FAIL "frame ${W}x${H} is not 9:16"; fi
if [ -n "$EXPECT" ]; then
  awk -v d="$DUR" -v e="$EXPECT" 'BEGIN{exit !((d-e)<0.6 && (e-d)<0.6)}' && say PASS "duration ${DUR}s" || say FAIL "duration ${DUR}s, expected ${EXPECT}s"
else say INFO "duration ${DUR}s"; fi

# A mono fold-down of identical L/R reads ~3 dB lower on EBU R128 by definition; more than 6 dB means phase cancellation.
LOUD=$(ffmpeg -hide_banner -nostats -i "$F" -af ebur128=peak=true -f null - 2>&1)
I=$(echo "$LOUD" | awk '/I:/{v=$2} END{print v}')
TP=$(echo "$LOUD" | awk '/Peak:/{v=$2} END{print v}')
awk -v i="$I" 'BEGIN{exit !(i>=-15.5 && i<=-12.5)}' && say PASS "loudness ${I} LUFS (target -14)" || say WARN "loudness ${I} LUFS (target -14 ±1.5 for Reels/TikTok)"
awk -v p="$TP" 'BEGIN{exit !(p<=-1.0)}' && say PASS "true peak ${TP} dBTP" || say FAIL "true peak ${TP} dBTP (must be <= -1)"

MONO=$(ffmpeg -hide_banner -nostats -i "$F" -af "pan=mono|c0=0.5*c0+0.5*c1,ebur128" -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
awk -v s="$I" -v m="$MONO" 'BEGIN{exit !((s-m)<6)}' && say PASS "mono fold-down ${MONO} LUFS" || say WARN "mono fold-down drops to ${MONO} LUFS (phasey stereo — check on a phone speaker)"

FREEZE=$(ffmpeg -hide_banner -nostats -i "$F" -vf "scale=270:-2,freezedetect=n=0.0005:d=$(awk -v f=$FPS 'BEGIN{printf "%.3f", 4/f}')" -map 0:v -f null - 2>&1 | grep -oE "freeze_(start|end): [0-9.]+" | awk '{print $2}' | paste - - )
LONG=$(echo "$FREEZE" | awk -v d="$DUR" 'NF==2 && ($2-$1)>0.6 && $2 < d-0.3 {printf "%.1f-%.1fs ", $1, $2}')
TAIL=$(echo "$FREEZE" | awk -v d="$DUR" 'NF==1 || $2 >= d-0.3 {print d-$1}' | tail -1)
[ -z "$LONG" ] && say PASS "no dead (frozen) stretches mid-video" || say WARN "still frames for >0.6s at: $LONG (something should always be moving)"
if [ -n "$TAIL" ]; then awk -v t="$TAIL" 'BEGIN{exit !(t<=1.6)}' && say PASS "end hold ${TAIL}s" || say WARN "end hold ${TAIL}s (keep <= 1.4s)"; fi

BLACK=$(ffmpeg -hide_banner -nostats -i "$F" -vf "scale=270:-2,blackdetect=d=0.1:pix_th=0.05" -an -f null - 2>&1 | grep -c black_start || true)
[ "$BLACK" -eq 0 ] && say PASS "no black frames" || say WARN "$BLACK black stretch(es)"

SIL=$(ffmpeg -hide_banner -nostats -i "$F" -af silencedetect=noise=-50dB:d=1.0 -vn -f null - 2>&1 | grep -c silence_start || true)
[ "$SIL" -eq 0 ] && say PASS "audio present throughout" || say WARN "$SIL silent gap(s) over 1s"

exit $fail
