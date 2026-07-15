#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
destination="$root/ios/Hush/WebApp"

cd "$root"
npm run build:fallback
mkdir -p "$destination"
rsync -a --delete outputs/github-pages/ "$destination/"
