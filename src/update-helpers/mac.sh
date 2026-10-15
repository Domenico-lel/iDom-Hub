#!/bin/sh
# This helper owns only the staged launcher, its backup and the private update job.
set -eu
target=$1; stage=$2; backup=$3; parent=$4; parent_started=$5; job=$6; version=$7; bundle_id=$8; timeout=$9; token=${10}
result="$(dirname "$job")/last-result.json"
exec >> "$job/helper.log" 2>&1
moved=0; placed=0; success=0; candidate=''; phase='Attesa della chiusura'
log() { printf '%s %s\n' "$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
log "Avvio aggiornamento $version"
printf '{"token":"%s"}\n' "$token" > "$job/ready.json"
write_result() {
  printf '{"version":"%s","token":"%s","success":%s,"message":"%s"}\n' "$version" "$token" "$1" "$2" > "$result.tmp"
  mv "$result.tmp" "$result"
}
rollback() {
  code=$?
  log "Uscita: fase=$phase codice=$code sostituita=$placed confermata=$success"
  trap - EXIT
  if [ "$success" -eq 1 ]; then exit 0; fi
  if [ -n "$candidate" ]; then
    kill -TERM "$candidate" 2>/dev/null || true
    sleep 1
  fi
  if [ "$placed" -eq 1 ]; then rm -rf "$target"; fi
  if [ "$moved" -eq 1 ]; then mv "$backup" "$target" || true; fi
  rm -rf "$stage"
  write_result false 'Aggiornamento del launcher non riuscito. La versione precedente è stata conservata.'
  /usr/bin/open "$target" || true
  exit "$code"
}
trap rollback EXIT
trap 'exit 1' HUP INT TERM
tries=0
while [ "$tries" -lt 60 ]; do
  running=$(/bin/ps -p "$parent" -o lstart= 2>/dev/null | /usr/bin/sed 's/^[[:space:]]*//; s/[[:space:]]*$//' || true)
  [ -n "$running" ] && [ "$running" = "$parent_started" ] || break
  sleep 1; tries=$((tries + 1))
done
[ "$tries" -lt 60 ] || exit 1
old_executable="$target/Contents/MacOS/iDom Launcher"
if /bin/ps -axo comm= | /usr/bin/grep -Fxq "$old_executable"; then exit 1; fi
phase='Verifica del pacchetto'; log "$phase"
# Revalidate staging after the parent has exited.
/usr/bin/codesign --verify --deep --strict "$stage"
[ "$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$stage/Contents/Info.plist")" = "$bundle_id" ]
[ "$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$stage/Contents/Info.plist")" = "$version" ]
phase='Sostituzione'; log "$phase"
mv "$target" "$backup"; moved=1
mv "$stage" "$target"; placed=1
phase='Riavvio'; log "$phase"
/usr/bin/open -n "$target" --args "--idom-update-job=$job"
tries=0
while [ "$tries" -lt "$timeout" ]; do
  if [ -f "$job/ack.json" ]; then
    ack_version=$(/usr/bin/plutil -extract version raw -o - "$job/ack.json" 2>/dev/null || true)
    ack_token=$(/usr/bin/plutil -extract token raw -o - "$job/ack.json" 2>/dev/null || true)
    if [ "$ack_version" = "$version" ] && [ "$ack_token" = "$token" ]; then
      success=1
      log "Avvio confermato"
      write_result true 'iDom Launcher è stato aggiornato e riavviato.'
      rm -rf "$backup"
      rm -f "$job/iDom-Launcher-macOS.dmg"
      exit 0
    fi
  fi
  sleep 1; tries=$((tries + 1))
done
# Stop only the failed candidate carrying this exact private job argument.
candidate=$(/bin/ps -axo pid=,command= | /usr/bin/awk -v exe="$old_executable" -v marker="--idom-update-job=$job" 'index($0,exe) && index($0,marker) {print $1; exit}')
exit 1
