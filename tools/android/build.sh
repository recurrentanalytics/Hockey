#!/usr/bin/env bash
# Builds the Android app (APK) of the game.
#   ANDROID_HOME   Android SDK with platforms;android-35 and build-tools;35.0.0
#   BONI_KEYSTORE / BONI_KEYSTORE_PASS   optional release keystore (otherwise debug-signed)
# Output: android/app/build/outputs/apk/release/app-release.apk
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$PWD
WWW=android/app/src/main/assets/www
CESIUM_VERSION=1.147.0

rm -rf "$WWW"; mkdir -p "$WWW"
cp intro.html index.html manifest.webmanifest "$WWW/"
cp -r css src audio "$WWW/"
mkdir -p "$WWW/assets"; cp -r assets/intro assets/app "$WWW/assets/"

# CesiumJS inside the app, so only the Google 3D tiles need the network
if [ ! -f android/.cesium/node_modules/cesium/Build/Cesium/Cesium.js ]; then
  mkdir -p android/.cesium && (cd android/.cesium && echo '{"name":"boni-cesium","private":true}' > package.json && npm i "cesium@$CESIUM_VERSION" --silent)
fi
mkdir -p "$WWW/vendor/cesium"
for d in Cesium.js Workers ThirdParty Assets Widgets; do cp -r "android/.cesium/node_modules/cesium/Build/Cesium/$d" "$WWW/vendor/cesium/"; done

echo "sdk.dir=${ANDROID_HOME:?set ANDROID_HOME}" > android/local.properties
(cd android && gradle --quiet assembleRelease)
ls -la android/app/build/outputs/apk/release/
