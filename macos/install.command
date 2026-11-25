#!/bin/bash
# N360 Support - macOS per-user updater. No sudo, git, Node or Homebrew required.
# Downloads extension assets, never runs a downloaded updater or shell script.
set -euo pipefail
umask 077
BASE="$HOME/Library/Application Support/N360 Support"
ACTIVE="$BASE/extension"
PREVIOUS="$BASE/previous"
SWAP="$BASE/.swap-old"
HOLD="$BASE/hold-version"
LOCK="$BASE/.lock"
LABEL="com.hungdeniubeo.n360-support-updater"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
API="https://api.github.com/repos/hungdeniubeo/extension-Nail360/commits/main"
RAW_BASE="https://raw.githubusercontent.com/hungdeniubeo/extension-Nail360"
ARCHIVE_BASE="https://codeload.github.com/hungdeniubeo/extension-Nail360/zip"
STAGE=""
say(){ printf '%s\n' "$*"; }
die(){ say "N360: $*" >&2; exit 1; }
notify(){
  if [ -x /usr/bin/osascript ]; then
    /usr/bin/osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "N360 Support"' -e 'end run' "$1" >/dev/null 2>&1 || true
  fi
}
fetch(){
  /usr/bin/curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --header "Cache-Control: no-cache" --user-agent "N360-Updater/2" --connect-timeout 15 --max-time 60 --retry 1 --max-filesize 20000000 --output "$2" "$1"
}
# Reject permission/config changes instead of silently expanding Chrome access.
manifest_version(){
  /usr/bin/perl -MJSON::PP -e '
    local $/; my $m=decode_json(<>);
    die "Unexpected manifest\n" unless ref($m) eq "HASH" && $m->{manifest_version} == 3 && $m->{name} eq "Nail360PRO Support Toolkit";
    my %keys=map {$_=>1} qw(manifest_version name short_name version version_name description minimum_chrome_version permissions host_permissions action background side_panel icons);
    die "Manifest fields changed; review manually\n" if grep {!$keys{$_}} keys %$m;
    my $json=JSON::PP->new->canonical;
    my $p=$m->{permissions};
    die "Permission scope changed; review manually\n" unless ref($p) eq "ARRAY" && ($json->encode([sort @$p]) eq $json->encode([sort qw(activeTab scripting sidePanel storage)]) || $json->encode([sort @$p]) eq $json->encode([sort qw(activeTab scripting sidePanel storage alarms)]));
    for my $pair ([host_permissions=>["https://dev.nail360.info/*"]]) {
      my($k,$expected)=@$pair;
      die "Permission scope changed: $k; review manually\n" unless ref($m->{$k}) eq "ARRAY" && $json->encode([sort @{$m->{$k}}]) eq $json->encode([sort @$expected]);
    }
    for my $pair ([background=>{service_worker=>"background.js"}],[side_panel=>{default_path=>"panel.html"}]){
      die "Entrypoint changed; review manually\n" unless $json->encode($m->{$pair->[0]}) eq $json->encode($pair->[1]);
    }
    die "Action config changed; review manually\n" unless ref($m->{action}) eq "HASH" && !grep {$_ ne "default_title" && $_ ne "default_icon"} keys %{$m->{action}};
    my $v=$m->{version}//"";
    die "Invalid Chrome version\n" unless $v =~ /\A(?:0|[1-9][0-9]{0,4})(?:\.(?:0|[1-9][0-9]{0,4})){0,3}\z/ && !grep {$_>65535} split /\./,$v;
    print "$v\n";
  ' "$1"
}
# Return success only if the first Chrome version is strictly newer.
newer(){
  /usr/bin/perl -e 'my @a=split /\./,$ARGV[0];my @b=split /\./,$ARGV[1];for my $i(0..3){my $d=($a[$i]//0)<=>($b[$i]//0);exit($d>0?0:1) if $d}exit 1' "$1" "$2"
}
cleanup(){
  [ -z "$STAGE" ] || rm -rf "$STAGE"
  rm -rf "$LOCK"
}
lock(){
  mkdir -p "$BASE"
  if ! mkdir "$LOCK" 2>/dev/null; then
    local pid=""
    [ ! -f "$LOCK/pid" ] || read -r pid < "$LOCK/pid" || true
    if [[ "$pid" =~ ^[0-9]+$ ]] && ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$LOCK/pid"; rmdir "$LOCK" || die "Another update is running."
      mkdir "$LOCK" || die "Another update is running."
    else
      die "Another update is running (or lock needs review)."
    fi
  fi
  printf '%s\n' "$$" > "$LOCK/pid"
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}
recover_swap(){
  [ -d "$SWAP" ] || return 0
  if [ ! -e "$ACTIVE" ]; then
    mv "$SWAP" "$ACTIVE"
  else
    rm -rf "$PREVIOUS"
    mv "$SWAP" "$PREVIOUS"
  fi
}
# Preserve the prior folder even if interrupted during promotion.
promote(){
  recover_swap
  [ ! -e "$ACTIVE" ] || mv "$ACTIVE" "$SWAP"
  if ! mv "$1" "$ACTIVE"; then
    recover_swap
    die "Could not replace extension; previous version restored."
  fi
  recover_swap
}
stage_archive(){
  local zip="$1" dest="$2" entry rel root size count total
  mkdir -p "$dest"
  /usr/bin/unzip -Z1 "$zip" > "$STAGE/entries"
  root=$(/usr/bin/perl -ne 'chomp;print "$1\n" if /\A([A-Za-z0-9][A-Za-z0-9._-]*)\/manifest\.json\z/' "$STAGE/entries")
  [[ "$root" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "Invalid archive root."
  # Extract exact files by name, not by expanding the archive onto disk.
  # Only extension runtime assets under the root / known asset directories.
  /usr/bin/perl -e '
    my $root=shift; while (<>) {chomp;
      next unless s/^\Q$root\E\///;
      next unless /\A(?:(?:icons|assets|lib|src)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*)?[A-Za-z0-9][A-Za-z0-9._-]*\.(?:js|mjs|css|html|json|svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf)\z/;
      die "Duplicate runtime asset: $_\n" if $seen{$_}++;
      print "$_\n";
    }
  ' "$root" "$STAGE/entries" > "$STAGE/assets"
  count=0; total=0
  while IFS= read -r rel; do
    count=$((count+1)); [ "$count" -le 300 ] || die "Too many assets."
    entry="$root/$rel"
    mkdir -p "$(dirname "$dest/$rel")"
    (ulimit -f 40960; /usr/bin/unzip -p "$zip" "$entry" > "$dest/$rel")
    size=$(wc -c < "$dest/$rel")
    total=$((total+size)); [ "$total" -le 20000000 ] || die "Archive exceeds runtime size limit."
  done < "$STAGE/assets"
  for rel in manifest.json background.js capture.js core.js panel.html panel.css panel.js icons/logo.svg; do
    [ -s "$dest/$rel" ] || die "Missing runtime asset: $rel"
  done
}
check_update(){
  local current="0" candidate actual hold="0" commit rel
  lock
  recover_swap
  STAGE=$(mktemp -d "$BASE/.stage.XXXXXX")
  if [ -f "$ACTIVE/manifest.json" ]; then
    current=$(manifest_version "$ACTIVE/manifest.json")
  fi
  [ ! -f "$HOLD" ] || read -r hold < "$HOLD"
  # Resolve main once, then read both manifest and ZIP from the same immutable commit.
  fetch "$API" "$STAGE/head.json"
  commit=$(/usr/bin/perl -MJSON::PP -e 'local $/;my $m=decode_json(<>);my $s=$m->{sha}//"";die "Invalid GitHub commit\n" unless $s =~ /\A[0-9a-f]{40}\z/;print "$s\n"' "$STAGE/head.json")
  fetch "$RAW_BASE/$commit/manifest.json" "$STAGE/remote.json"
  candidate=$(manifest_version "$STAGE/remote.json")
  say "N360: GitHub $candidate ($commit); disk $current."
  if ! newer "$candidate" "$current"; then say "N360: no newer version; disk kept."; return 0; fi
  if ! newer "$candidate" "$hold"; then say "N360: held version $hold; disk kept."; return 0; fi
  fetch "$ARCHIVE_BASE/$commit" "$STAGE/repo.zip"
  stage_archive "$STAGE/repo.zip" "$STAGE/new"
  actual=$(manifest_version "$STAGE/new/manifest.json")
  [ "$actual" = "$candidate" ] && cmp -s "$STAGE/remote.json" "$STAGE/new/manifest.json" || die "Commit manifest mismatch; disk kept."
  if newer "$actual" "1.2.0"; then
    for rel in qa-core.js qa-page.js studio.js admin.html admin.css admin.js updates.js audit-core.js audit-dom.js auto-reload.js; do
      [ -s "$STAGE/new/$rel" ] || die "Missing runtime asset: $rel"
    done
  fi
  # Chrome panel reads this local marker to detect staged updates.
  printf '{"version":"%s"}\n' "$actual" > "$STAGE/new/update-status.json"
  promote "$STAGE/new"
  rm -f "$HOLD"
  say "N360: downloaded $actual (previous: $current)."
  if [ "$current" != "0" ]; then
    notify "Version $actual is ready. N360 reloads automatically when idle; finish QA work first."
  fi
}
rollback(){
  local previous current
  lock; recover_swap
  [ -f "$PREVIOUS/manifest.json" ] || die "No previous version saved."
  [ -f "$ACTIVE/manifest.json" ] || die "No active version."
  previous=$(manifest_version "$PREVIOUS/manifest.json")
  current=$(manifest_version "$ACTIVE/manifest.json")
  STAGE=$(mktemp -d "$BASE/.stage.XXXXXX")
  cp -R "$PREVIOUS" "$STAGE/new"
  # Don't reinstall the rejected version at the next scheduled check.
  local hold="$current" oldhold="0"
  [ ! -f "$HOLD" ] || read -r oldhold < "$HOLD"
  if newer "$oldhold" "$hold"; then hold="$oldhold"; fi
  printf '%s\n' "$hold" > "$HOLD"
  printf '{"version":"%s"}\n' "$previous" > "$STAGE/new/update-status.json"
  promote "$STAGE/new"
  say "N360: restored $previous; automatic updates resume above $hold."
  notify "Restored version $previous. Reload the extension."
}
install_agent(){
  local uid
  uid=$(id -u)
  mkdir -p "$BASE" "$HOME/Library/LaunchAgents"
  if [ "$0" != "$BASE/updater.sh" ]; then
    cp "$0" "$BASE/updater.sh"
  fi
  chmod 700 "$BASE/updater.sh"
  # On a fresh install, require a successful download. Existing installs can
  # schedule a retry if the network is temporarily unavailable.
  if ! /bin/bash "$BASE/updater.sh" check; then
    [ -f "$ACTIVE/manifest.json" ] || die "Initial download failed."
    say "N360: GitHub check failed; installed version retained, retry scheduled."
  fi
  register_agent
  say "N360 installed at: $ACTIVE"
  say "Load this folder once in Chrome if not already loaded."
  /usr/bin/open "$ACTIVE" >/dev/null 2>&1 || true
  /usr/bin/open -a "Google Chrome" "chrome://extensions" >/dev/null 2>&1 || true
}
register_agent(){
  local uid
  uid=$(id -u)
  mkdir -p "$BASE" "$HOME/Library/LaunchAgents"
  /usr/bin/perl -e '
    sub x {my $s=shift;$s=~s/&/&amp;/g;$s=~s/</&lt;/g;$s=~s/>/&gt;/g;return $s}
    my($label,$script,$log)=map{x($_)}@ARGV;
    print qq{<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>$label</string><key>ProgramArguments</key><array><string>/bin/bash</string><string>$script</string><string>check</string></array><key>RunAtLoad</key><true/><key>StartInterval</key><integer>300</integer><key>StandardOutPath</key><string>$log</string><key>StandardErrorPath</key><string>$log</string></dict></plist>\n};
  ' "$LABEL" "$BASE/updater.sh" "$BASE/updater.log" > "$PLIST"
  /usr/bin/plutil -lint "$PLIST"
  /bin/launchctl bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
  /bin/launchctl enable "gui/$uid/$LABEL"
  /bin/launchctl bootstrap "gui/$uid" "$PLIST"
  say "N360: update agent registered (every 5 minutes)."
}
main(){
  [ "$(uname -s)" = "Darwin" ] || die "This installer is for macOS."
  /usr/bin/perl -MJSON::PP -e 1 || die "System Perl JSON::PP is unavailable."
  case "${1:-install}" in
    install) install_agent ;;
    check) check_update ;;
    rollback) rollback ;;
    status)
      if [ -f "$ACTIVE/manifest.json" ]; then manifest_version "$ACTIVE/manifest.json"; else say "Not installed"; fi
      /bin/launchctl print "gui/$(id -u)/$LABEL" || true
      ;;
    stop)
      /bin/launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
      rm -f "$PLIST"
      say "Auto updater stopped. Extension and previous version preserved."
      ;;
    *) die "Usage: bash install.command [install|check|rollback|status|stop]" ;;
  esac
}
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
