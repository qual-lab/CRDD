#!/bin/bash
# Native試験の最終リンクをGCCへ搬送し、実行物別の観測記録を保持する。
# @responsibility 引数を再解釈せず、試験出力とLink Mapを一意に結合する。
# @trace ERB-IT-024
set -euo pipefail

test "${TARGET:-}" = x86_64-unknown-linux-musl
expected_parent=$(realpath -e "target/$TARGET/release/deps")
map_root=/out/native-link-maps
test -d "$map_root" && test ! -L "$map_root"
test "$(realpath -e "$map_root")" = "$map_root"

args=("$@")
output=''
for ((i=0; i<${#args[@]}; i++)); do
    case "${args[i]}" in
        @*|-Xlinker|--output|--output=*) exit 64 ;;
        -Wl,*)
            IFS=',' read -r -a linker_flags <<< "${args[i]}"
            for flag in "${linker_flags[@]:1}"; do
                case "$flag" in
                    @*|-o|-o?*|--output|--output=*|-Map*|--Map*|--print-map|-M) exit 64 ;;
                esac
            done
            ;;
        *-Map*|*--print-map*|-M|-Wl,-M*) exit 64 ;;
        -o)
            test -z "$output"
            ((i+=1))
            test "$i" -lt "${#args[@]}"
            output="${args[i]}"
            test -n "$output"
            ;;
        -o?*) exit 64 ;;
    esac
done
test -n "$output"
test "$(realpath -e "$(dirname "$output")")" = "$expected_parent"
name=$(basename "$output")
[[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]
test ! -L "$output"
if test -e "$output"; then test -f "$output"; fi

map="$map_root/$name.map"
test ! -e "$map" && test ! -L "$map"
test ! -e "$map_root/$name.output" && test ! -L "$map_root/$name.output"
# Exclusive reservation rejects duplicate concurrent links and retry overwrites.
(set -o noclobber; : > "$map")
(set -o noclobber; printf '%s\n' "$output" > "$map_root/$name.output")
exec /usr/bin/gcc "$@" "-Wl,-Map=$map"
