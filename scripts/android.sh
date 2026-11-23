#!/usr/bin/env bash
set -euo pipefail
sdk="${ANDROID_HOME:?Android SDK required}"
tools="$sdk/build-tools/35.0.0"
platform="$sdk/platforms/android-35/android.jar"
build=build/android
mkdir -p "$build/classes" "$build/dex" dist
"$tools/aapt2" link -o "$build/base.apk" -I "$platform" --manifest android/AndroidManifest.xml -A web
javac --release 8 -classpath "$platform" -d "$build/classes" android/*.java
jar cf "$build/classes.jar" -C "$build/classes" .
"$tools/d8" --lib "$platform" --min-api 26 --output "$build/dex" "$build/classes.jar"
cp "$build/base.apk" "$build/app.apk"
(cd "$build/dex" && zip -q ../app.apk classes.dex)
"$tools/zipalign" -f 4 "$build/app.apk" "$build/aligned.apk"
"$tools/apksigner" sign --ks "${KEYSTORE:?release keystore required}" --ks-key-alias keqi --ks-pass env:ANDROID_PASS --out dist/Keqi-Android.apk "$build/aligned.apk"
"$tools/apksigner" verify --verbose dist/Keqi-Android.apk
