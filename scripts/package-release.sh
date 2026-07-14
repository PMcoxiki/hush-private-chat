#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
stage=$(mktemp -d "${TMPDIR:-/tmp}/hush-release.XXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM

cd "$root"
npm run verify:install-target
npm run build:fallback

cp distribution/ChatGPT.mobileconfig "$stage/ChatGPT.mobileconfig"
cp distribution/安装与使用说明.md "$stage/INSTALL.md"
cp -R outputs/github-pages "$stage/website-backup"

(
  cd "$stage"
  zip -FSqry "$root/outputs/ChatGPT-好友安装包.zip" .
)

cp distribution/ChatGPT.mobileconfig outputs/ChatGPT.mobileconfig
cp distribution/安装与使用说明.md outputs/安装与使用说明.md
zip -FSqry outputs/Hush-iOS-source.zip ios -x '*.DS_Store' -x '__MACOSX/*'

if command -v plutil >/dev/null 2>&1; then
  plutil -lint outputs/ChatGPT.mobileconfig
fi

shasum -a 256 \
  outputs/ChatGPT-好友安装包.zip \
  outputs/Hush-iOS-source.zip \
  outputs/ChatGPT.mobileconfig \
  > outputs/SHA256SUMS.txt
