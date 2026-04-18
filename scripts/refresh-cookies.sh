#!/bin/bash
# YouTube 쿠키 갱신 스크립트
# Chrome에서 쿠키 추출 → YouTube/Google만 필터 → base64 → Railway 환경변수 업로드

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
YT_DLP="$PROJECT_DIR/node_modules/.bin/yt-dlp"
TMP_COOKIES="/tmp/yt-cookies-raw.txt"
TMP_FILTERED="/tmp/yt-cookies-filtered.txt"

echo "1. Chrome에서 쿠키 추출 중..."
"$YT_DLP" --cookies-from-browser chrome --cookies "$TMP_COOKIES" --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>/dev/null || true

if [ ! -f "$TMP_COOKIES" ]; then
  echo "❌ 쿠키 파일 생성 실패. Chrome이 실행 중인지 확인하세요."
  exit 1
fi

echo "2. YouTube/Google 쿠키 필터링..."
grep -E "^#|^$|youtube\.com|google\.com|\.youtube\.|\.google\." "$TMP_COOKIES" > "$TMP_FILTERED"

LINES=$(wc -l < "$TMP_FILTERED")
echo "   → $LINES줄 추출"

echo "3. Railway 환경변수 업로드 중..."
COOKIE_B64=$(base64 -w0 "$TMP_FILTERED")
railway variables set "YT_COOKIES_BASE64=$COOKIE_B64" -s web

echo "4. 임시 파일 정리..."
rm -f "$TMP_COOKIES" "$TMP_FILTERED"

echo "✅ 쿠키 갱신 완료! Railway가 자동 재배포합니다."
