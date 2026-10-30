#!/usr/bin/env bash
# Creates the Google Play *upload* key (PKCS12, RSA 4096, 30 years) with openssl — no JDK needed —
# and, with --secrets, stores it in this repo's GitHub Actions secrets for android-release.yml.
#
#   bash scripts/release/android-keystore.sh            # create ~/.breaker3d-release/upload.p12
#   bash scripts/release/android-keystore.sh --secrets  # create (if missing) + gh secret set
#
# Keep ~/.breaker3d-release backed up (password manager / USB). Losing the upload key is
# recoverable through Play Console support (key reset), but it takes days.
set -euo pipefail

DIR="${BREAKER_RELEASE_DIR:-$HOME/.breaker3d-release}"
P12="$DIR/upload.p12"
PASS_FILE="$DIR/upload.password"
ALIAS="upload"

mkdir -p "$DIR"
chmod 700 "$DIR"

if [[ -f "$P12" ]]; then
  echo "Keystore already exists: $P12 (left untouched)"
else
  umask 077
  openssl rand -base64 24 | tr -d '/+=' > "$PASS_FILE"
  PASS="$(cat "$PASS_FILE")"
  openssl req -x509 -newkey rsa:4096 -sha256 -days 10950 -nodes \
    -subj "/CN=BREAKER 3D upload key/O=breton5797/C=KR" \
    -keyout "$DIR/upload.key" -out "$DIR/upload.crt" 2>/dev/null
  openssl pkcs12 -export -name "$ALIAS" -inkey "$DIR/upload.key" -in "$DIR/upload.crt" \
    -passout "pass:$PASS" -out "$P12"
  rm -f "$DIR/upload.key"
  echo "Created $P12 (password in $PASS_FILE, certificate in $DIR/upload.crt)"
fi

openssl x509 -in "$DIR/upload.crt" -noout -fingerprint -sha256 | sed 's/^/Upload key /'

if [[ "${1:-}" == "--secrets" ]]; then
  base64 < "$P12" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
  gh secret set ANDROID_KEYSTORE_PASSWORD < "$PASS_FILE"
  echo "GitHub secrets ANDROID_KEYSTORE_BASE64 / ANDROID_KEYSTORE_PASSWORD set."
fi
