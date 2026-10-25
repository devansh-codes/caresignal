#!/usr/bin/env bash
# Fail the build if the built site exceeds a size limit (GitHub Pages hard limit is 1 GB).
# Usage: scripts/size_guard.sh [dir=web/dist] [limit_mb=200]
set -euo pipefail
DIR="${1:-web/dist}"
LIMIT_MB="${2:-200}"
if [ ! -d "$DIR" ]; then
  echo "size_guard: $DIR does not exist" >&2
  exit 1
fi
SIZE_KB=$(du -sk "$DIR" | cut -f1)
SIZE_MB=$((SIZE_KB / 1024))
echo "size_guard: $DIR is ${SIZE_MB} MB (limit ${LIMIT_MB} MB)"
if [ "$SIZE_MB" -gt "$LIMIT_MB" ]; then
  echo "size_guard: FAIL — site exceeds ${LIMIT_MB} MB" >&2
  exit 1
fi
