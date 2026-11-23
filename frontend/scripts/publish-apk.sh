#!/usr/bin/env bash
# Build the Android app from the current website code and publish it.
#
# The APK is a real build of the website (static export packed inside, lessons
# included). It always goes to BOTH places, so the download page's link can't
# fall behind again:
#   app/open-strings-<version>-test.apk   (kept, one per build)
#   app/open-strings-debug.apk            (what /download links to)
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(grep -oP 'versionName "\K[^"]+' android/app/build.gradle)
rm -rf out-build android/app/src/main/assets/public
npm run cap:sync
(cd android && ./gradlew clean assembleDebug -q)
APK=android/app/build/outputs/apk/debug/app-debug.apk
for name in "open-strings-${VERSION}-test.apk" "open-strings-debug.apk"; do
  gcloud storage cp "$APK" "gs://guitar-tutor-prod-2-lessons/app/${name}" \
    --content-type=application/vnd.android.package-archive --cache-control="no-cache" \
    --content-disposition='attachment; filename="open-strings.apk"'
done
echo "Published ${VERSION}: https://storage.googleapis.com/guitar-tutor-prod-2-lessons/app/open-strings-debug.apk"
