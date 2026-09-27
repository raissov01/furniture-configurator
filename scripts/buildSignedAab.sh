#!/usr/bin/env bash
set -euo pipefail

for name in AISMEBEL_KEYSTORE_PATH AISMEBEL_KEYSTORE_PASSWORD AISMEBEL_KEY_ALIAS AISMEBEL_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    printf '%s must be set outside the repository\n' "$name" >&2
    exit 2
  fi
done
if [[ ! -f "$AISMEBEL_KEYSTORE_PATH" ]]; then
  printf 'AISMEBEL_KEYSTORE_PATH must point to an existing file\n' >&2
  exit 2
fi

export NODE_OPTIONS=--max-old-space-size=2048
npm run cap:sync
(cd android && ./gradlew bundleRelease --no-daemon --max-workers=2)
printf 'Signed AAB: android/app/build/outputs/bundle/release/app-release.aab\n'
