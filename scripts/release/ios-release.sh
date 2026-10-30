#!/usr/bin/env bash
# Builds the iOS release archive and uploads it to App Store Connect (TestFlight), from this Mac.
#
#   APPLE_TEAM_ID=XXXXXXXXXX ADMOB_APP_ID_IOS=ca-app-pub-…~… ADMOB_REWARDED_IOS=ca-app-pub-…/… \
#     bash scripts/release/ios-release.sh [build-number]
#   bash scripts/release/ios-release.sh --check        # unsigned Release archive, no account needed
#
# Options (env): TEST_ADS=1 allows Google test ads when the AdMob ids are missing (TestFlight only).
# Uploading uses the Apple ID signed in under Xcode > Settings > Accounts, or an App Store Connect
# API key when ASC_KEY_PATH, ASC_KEY_ID and ASC_ISSUER_ID are set.
set -euo pipefail

cd "$(dirname "$0")/../.."
OUT="build/ios"
VERSION="$(node -p "require('./package.json').version")"
PROJECT=(-project ios/App/App.xcodeproj -scheme App -configuration Release -destination generic/platform=iOS)

if [[ "${1:-}" == "--check" ]]; then
  npm run build
  npx cap sync ios
  xcodebuild "${PROJECT[@]}" -archivePath "$OUT/check.xcarchive" archive \
    CODE_SIGNING_ALLOWED=NO MARKETING_VERSION="$VERSION" -quiet
  echo "Unsigned Release archive OK: $OUT/check.xcarchive"
  exit 0
fi

BUILD="${1:-$(date '+%Y%m%d%H%M')}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID (developer.apple.com > Membership details > Team ID)}"
[[ "$BUILD" =~ ^[0-9]{1,12}$ ]] || { echo "Build number must be digits only"; exit 1; }

ADMOB_ARGS=()
if [[ -n "${ADMOB_APP_ID_IOS:-}" && -n "${ADMOB_REWARDED_IOS:-}" ]]; then
  [[ "$ADMOB_APP_ID_IOS" =~ ^ca-app-pub-[0-9]{16}~[0-9]{10}$ ]] || { echo "ADMOB_APP_ID_IOS looks wrong"; exit 1; }
  export VITE_ADMOB_REWARDED_IOS="$ADMOB_REWARDED_IOS"
  ADMOB_ARGS=(ADMOB_APP_ID="$ADMOB_APP_ID_IOS")
elif [[ "${TEST_ADS:-}" == "1" ]]; then
  echo "WARNING: Google test ads (no revenue) - TestFlight only"
else
  echo "Set ADMOB_APP_ID_IOS and ADMOB_REWARDED_IOS, or TEST_ADS=1"; exit 1
fi

AUTH=()
if [[ -n "${ASC_KEY_PATH:-}" ]]; then
  AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "${ASC_KEY_ID:?}" -authenticationKeyIssuerID "${ASC_ISSUER_ID:?}")
fi

npm test
npm run build
npx cap sync ios

ARCHIVE="$OUT/BREAKER3D-$VERSION-$BUILD.xcarchive"
xcodebuild "${PROJECT[@]}" -archivePath "$ARCHIVE" archive -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
  ${ADMOB_ARGS[@]+"${ADMOB_ARGS[@]}"} -quiet

mkdir -p "$OUT"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export-$BUILD" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}
echo "Uploaded $VERSION ($BUILD) to App Store Connect - it appears in TestFlight after processing."
