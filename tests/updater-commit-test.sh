#!/bin/bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# Each fixture gets an isolated HOME. Fake HTTPS responses only; no launchd.
python - "$ROOT" "$TMP" <<'PY'
import json, sys, zipfile
from pathlib import Path
r,t=map(Path,sys.argv[1:]); files=[p for p in r.iterdir() if p.is_file() and p.suffix in ('.json','.js','.html','.css')]+[r/'icons/logo.svg']
(t/'head.json').write_text(json.dumps({'sha':'a'*40})); m=json.loads((r/'manifest.json').read_text());m['version']='1.2.2';(t/'remote.json').write_text(json.dumps(m));
for name in ['repo.zip','wrong.zip','missing.zip']:
 with zipfile.ZipFile(t/name,'w') as z:
  for p in files:
   if name=='missing.zip' and p.name=='auto-reload.js':continue
   b=(t/'remote.json').read_bytes() if p.name=='manifest.json' else p.read_bytes()
   if name=='wrong.zip' and p.name=='manifest.json':b+=b'\n'
   z.writestr('repo-'+('a'*40)+'/'+str(p.relative_to(r)),b)
PY
export ROOT TMP
for mode in success same wrong missing invalid held network; do
  export CASE="$mode" HOME="$TMP/$mode"; mkdir -p "$HOME/Library/Application Support/N360 Support/extension"; cp "$ROOT/manifest.json" "$HOME/Library/Application Support/N360 Support/extension/manifest.json"
  if [ "$mode" = same ]; then cp "$TMP/remote.json" "$HOME/Library/Application Support/N360 Support/extension/manifest.json"; fi
  if [ "$mode" = held ]; then echo 1.2.2 > "$HOME/Library/Application Support/N360 Support/hold-version"; fi
  set +e
  /bin/bash -c 'source "$ROOT/macos/install.command"; notify(){ :; }; fetch(){ case "$1" in "$API") if [ "$CASE" = invalid ]; then echo "{\"sha\":\"main\"}" > "$2"; elif [ "$CASE" = network ]; then return 1; else cp "$TMP/head.json" "$2"; fi;; "$RAW_BASE/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/manifest.json") cp "$TMP/remote.json" "$2";; "$ARCHIVE_BASE/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") case "$CASE" in wrong|missing) cp "$TMP/$CASE.zip" "$2";; *) cp "$TMP/repo.zip" "$2";; esac;; *) echo unexpected-url >&2;return 1;; esac; }; check_update' > "$TMP/$mode.log" 2>&1
  rc=$?
  set -e
  case "$mode" in success|same|held) [ "$rc" -eq 0 ];; *) [ "$rc" -ne 0 ];; esac
  version=$(/usr/bin/perl -MJSON::PP -e 'local $/;print decode_json(<>)->{version}' "$HOME/Library/Application Support/N360 Support/extension/manifest.json")
  case "$mode" in success|same) [ "$version" = 1.2.2 ];; *) [ "$version" = 1.2.1 ];; esac
  if [ "$mode" = success ]; then [ -f "$HOME/Library/Application Support/N360 Support/previous/manifest.json" ]; fi
  printf 'PASS %s\n' "$mode"
done
