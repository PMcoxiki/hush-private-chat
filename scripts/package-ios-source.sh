#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
stage=$(mktemp -d "${TMPDIR:-/tmp}/hush-ios-source.XXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM

cd "$root"
if [ "${SKIP_FALLBACK_BUILD:-0}" != "1" ]; then
  npm run build:fallback
fi

cp -R ios "$stage/source"
rsync -a --delete outputs/github-pages/ "$stage/source/Hush/WebApp/"
(
  cd "$stage/source"
  zip -FSqry "$root/outputs/Hush-iOS-source.zip" . -x '*.DS_Store' -x '__MACOSX/*'
)

plutil -lint ios/Hush/Info.plist ios/Hush.xcodeproj/project.pbxproj
unzip -tq outputs/Hush-iOS-source.zip
