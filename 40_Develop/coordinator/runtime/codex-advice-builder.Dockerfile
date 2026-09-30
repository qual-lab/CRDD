# Development-only builder. Its context contains only the verified public
# Source archive and the reviewed advice-startup patch; never the repository.
FROM --platform=linux/amd64 rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb AS builder

ENV TARGET=x86_64-unknown-linux-musl \
    RUNNER_TEMP=/build/tmp \
    GITHUB_ENV=/build/toolchain.env \
    AWS_LC_SYS_NO_JITTER_ENTROPY=1 \
    STABLE_GIT_COMMIT=ff6aec96948b70d94983af2641a6b67c94faeff5 \
    CARGO_BUILD_JOBS=4
ENV PATH="/opt/zig:${PATH}"

RUN test "$(rustc --version | cut -d ' ' -f 2)" = 1.95.0 \
    && apt-get update \
    && apt-get install -y --no-install-recommends sudo python3 clang lld \
    && mkdir -p /build/tmp /out \
    && dpkg-query -W > /out/builder-packages.txt

COPY official-source.tar.gz /build/official-source.tar.gz
COPY codex-advice-startup.patch /build/codex-advice-startup.patch
RUN echo 'b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a  /build/official-source.tar.gz' | sha256sum -c - \
    && echo '1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb  /build/codex-advice-startup.patch' | sha256sum -c - \
    && tar -xzf /build/official-source.tar.gz -C /build \
    && echo 'de7eca05b55865c0ef03465a29bfb51e54d1eb78d253533d8b76e88712172f2d  /build/openai-codex-ff6aec9/codex-rs/core/src/session/session.rs' | sha256sum -c - \
    && cd /build/openai-codex-ff6aec9 \
    && git apply --check /build/codex-advice-startup.patch \
    && git apply /build/codex-advice-startup.patch \
    && rustup target add "$TARGET" \
    && curl -fsSL https://ziglang.org/download/0.14.0/zig-linux-x86_64-0.14.0.tar.xz -o /build/zig.tar.xz \
    && echo '473ec26806133cf4d1918caf1a410f8403a13d979726a9045b421b685031a982  /build/zig.tar.xz' | sha256sum -c - \
    && mkdir -p /opt/zig \
    && tar -xJf /build/zig.tar.xz -C /opt/zig --strip-components=1 \
    && test "$(zig version)" = 0.14.0 \
    && bash .github/scripts/install-musl-build-tools.sh \
    && dpkg-query -W > /out/builder-packages.txt

# Match the fixed upstream V8 release workflow. Verify the manifest before
# using either binary dependency, then verify both payloads against it.
RUN mkdir -p /build/v8 \
    && cd /build/v8 \
    && curl -fsSL https://github.com/openai/codex/releases/download/rusty-v8-v150.4.0/rusty_v8_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.sha256 -o checksums.sha256 \
    && echo '9bd5beb3a7bfa4f95bc887476ec3e4d564254c1815efe63296740e09bcc8665b  checksums.sha256' | sha256sum -c - \
    && test "$(wc -l < checksums.sha256)" -eq 2 \
    && curl -fsSL https://github.com/openai/codex/releases/download/rusty-v8-v150.4.0/librusty_v8_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.a.gz -O \
    && curl -fsSL https://github.com/openai/codex/releases/download/rusty-v8-v150.4.0/src_binding_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.rs -O \
    && tr -d '\r' < checksums.sha256 | sha256sum -c - \
    && cp checksums.sha256 /out/v8-checksums.sha256

WORKDIR /build/openai-codex-ff6aec9/codex-rs
RUN /bin/bash -eu <<'LOCK'
verify_release_lock_update() {
    cmp <(awk 'BEGIN { RS="\\[\\[package\\]\\]"; ORS="" } /(^|\n)source = / { print $0 }' "$1") \
        <(awk 'BEGIN { RS="\\[\\[package\\]\\]"; ORS="" } /(^|\n)source = / { print $0 }' "$2") || return 1
    cmp "$1" <(sed 's/^version = "0.159.2"$/version = "0.0.0"/' "$2") || return 1
}
printf '%s\n' 'version = 4' '[[package]]' 'name = "local"' 'version = "0.0.0"' \
    '[[package]]' 'name = "external"' 'version = "0.0.0"' \
    'source = "git+https://example.invalid/source#fixed"' 'checksum = "fixed"' \
    > /build/tmp/lock-before.test
sed '0,/version = "0.0.0"/s//version = "0.159.2"/' /build/tmp/lock-before.test > /build/tmp/lock-after.test
verify_release_lock_update /build/tmp/lock-before.test /build/tmp/lock-after.test
for mutation in 's/version = "0.0.0"/version = "0.159.2"/' \
    's/checksum = "fixed"/checksum = "changed"/' \
    's/#fixed/#changed/' '/name = "external"/d' \
    '$a dependencies = ["unexpected"]' '$a [[package]]'; do
    sed "$mutation" /build/tmp/lock-after.test > /build/tmp/lock-rejected.test
    if verify_release_lock_update /build/tmp/lock-before.test /build/tmp/lock-rejected.test; then
        echo 'Unexpected release lock mutation accepted' >&2; exit 1
    fi
done
cp Cargo.lock /out/Cargo.lock.upstream
cargo update --workspace
verify_release_lock_update /out/Cargo.lock.upstream Cargo.lock
cp Cargo.lock /out/Cargo.lock.resolved
sha256sum /out/Cargo.lock.upstream /out/Cargo.lock.resolved > /out/cargo-locks.sha256
LOCK

RUN /bin/bash -eu <<'BUILD'
load_build_environment() {
    build_env=()
    while IFS='=' read -r key value; do
        case "$key" in
            CFLAGS|CXXFLAGS|CC|TARGET_CC|CC_x86_64_unknown_linux_musl|CXX|TARGET_CXX|CXX_x86_64_unknown_linux_musl|CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER|CMAKE_C_COMPILER|CMAKE_CXX_COMPILER|CMAKE_ARGS|PKG_CONFIG_ALLOW_CROSS|PKG_CONFIG_PATH|PKG_CONFIG_PATH_x86_64_unknown_linux_musl|PKG_CONFIG_LIBDIR_x86_64_unknown_linux_musl|X86_64_UNKNOWN_LINUX_MUSL_OPENSSL_DIR|X86_64_UNKNOWN_LINUX_MUSL_OPENSSL_NO_VENDOR|X86_64_UNKNOWN_LINUX_MUSL_OPENSSL_STATIC|BORING_BSSL_SYSROOT|BORING_BSSL_SYSROOT_x86_64_unknown_linux_musl|PKG_CONFIG_SYSROOT_DIR|PKG_CONFIG_SYSROOT_DIR_x86_64_unknown_linux_musl) ;;
            *) printf 'Rejected build environment key: %s\n' "$key" >&2; return 1 ;;
        esac
        test -n "$value" || return 1
        if test "$key" = CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER; then
            test "$value" = /usr/bin/x86_64-linux-musl-gcc || return 1
            value=/usr/bin/gcc
        fi
        build_env+=("$key=$value")
    done < "$1"
}
# The upstream GitHub environment file is data, never executable shell.
# Preserve spaces and additional equals signs without changing upstream keys.
load_build_environment <(printf '%s\n' 'CMAKE_ARGS=first second=third' 'CC_x86_64_unknown_linux_musl=literal-compiler')
test "$(env "${build_env[@]}" printenv CMAKE_ARGS)" = 'first second=third'
test "$(env "${build_env[@]}" printenv CC_x86_64_unknown_linux_musl)" = 'literal-compiler'
if load_build_environment <(printf '%s\n' 'UNKNOWN=forbidden'); then exit 1; fi
if load_build_environment <(printf '%s\n' 'malformed'); then exit 1; fi
load_build_environment <(printf '%s\n' 'CMAKE_ARGS=$(exit 73)')
test "$(env "${build_env[@]}" printenv CMAKE_ARGS)" = '$(exit 73)'
load_build_environment /build/toolchain.env
test "$(env "${build_env[@]}" printenv CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER)" = /usr/bin/gcc
gcc --version > /out/rust-final-linker-version.txt
sha256sum "$(readlink -f /usr/bin/gcc)" > /out/rust-final-linker.sha256
printf '%s\n' 'upstream=/usr/bin/x86_64-linux-musl-gcc' 'effective=/usr/bin/gcc' > /out/rust-final-linker-adapter.txt
verify_static_pie() {
    local binary="$1" name="$2" map="$3"
    readelf -hW "$binary" > "/out/$name-elf-header.txt"
    readelf -lW "$binary" > "/out/$name-elf-programs.txt"
    readelf -dW "$binary" > "/out/$name-elf-dynamic.txt"
    grep -q 'Class:.*ELF64' "/out/$name-elf-header.txt"
    grep -q 'Machine:.*X86-64' "/out/$name-elf-header.txt"
    grep -q 'Type:.*DYN' "/out/$name-elf-header.txt"
    if grep -q 'INTERP' "/out/$name-elf-programs.txt"; then return 1; fi
    if grep -q '(NEEDED)' "/out/$name-elf-dynamic.txt"; then return 1; fi
    awk '$1 == "GNU_STACK" { found=1; if ($7 != "RW") exit 1 } END { if (!found) exit 1 }' "/out/$name-elf-programs.txt"
    local musl_root="$(rustc --print sysroot)/lib/rustlib/$TARGET/lib/self-contained"
    grep -Fx "LOAD $musl_root/rcrt1.o" "$map"
    grep -Fx "LOAD $musl_root/libc.a" "$map"
    awk -v root="$musl_root/" '$1 == "LOAD" && $2 ~ /\/(.*crt.*\.o|libc\.a)$/ { if (index($2, root) != 1) exit 1 }' "$map"
}
export RUSTY_V8_ARCHIVE=/build/v8/librusty_v8_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.a.gz
export RUSTY_V8_SRC_BINDING_PATH=/build/v8/src_binding_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.rs
env "${build_env[@]}" cargo rustc --locked --target "$TARGET" --release --manifest-path bwrap/Cargo.toml --bin bwrap -- -C link-arg=-Wl,-Map=/out/bwrap-link.map
strip --strip-debug --strip-unneeded "target/$TARGET/release/bwrap"
verify_static_pie "target/$TARGET/release/bwrap" bwrap /out/bwrap-link.map
timeout --signal=TERM --kill-after=5s 10s "target/$TARGET/release/bwrap" --version > /out/bwrap-version.txt
export CODEX_BWRAP_SHA256=$(sha256sum "target/$TARGET/release/bwrap" | cut -d ' ' -f 1)
env "${build_env[@]}" cargo rustc --locked --target "$TARGET" --release --manifest-path cli/Cargo.toml --bin codex -- -C link-arg=-Wl,-Map=/out/codex-link.map
strip --strip-debug --strip-unneeded "target/$TARGET/release/codex"
verify_static_pie "target/$TARGET/release/codex" codex /out/codex-link.map
timeout --signal=TERM --kill-after=5s 10s "target/$TARGET/release/codex" --version > /out/codex-version.txt
cp "target/$TARGET/release/codex" /out/codex-advice
cp "target/$TARGET/release/bwrap" /out/bwrap
sha256sum /out/codex-advice /out/bwrap > /out/artifacts.sha256
BUILD

FROM scratch AS artifacts
COPY --from=builder /out/ /
COPY build-inputs.json /build-inputs.json

# Development-only native tests. The production binary is already fixed above;
# this stage never installs test-patched code into the runtime artifact.
FROM builder AS startup-verification
COPY codex-advice-native-linker.sh /build/codex-advice-native-linker.sh
RUN chmod 0555 /build/codex-advice-native-linker.sh && mkdir -p /out/native-link-maps
COPY codex-advice-startup-test.patch /build/codex-advice-startup-test.patch
COPY codex-advice-startup-test-inputs.sha256 /build/codex-advice-startup-test-inputs.sha256
COPY codex-code-mode-host /build/codex-code-mode-host
RUN echo '03e916f0371b80cf4f7038b54f3b81356218d277acc506dd3f473a4acc15cc31  /build/codex-advice-startup-test.patch' | sha256sum -c - \
    && echo 'f812775b4254a47376adcc99491c7752869daed403df39d7b998ae95cdf51b80  /build/codex-advice-startup-test-inputs.sha256' | sha256sum -c - \
    && echo '5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03  /build/codex-code-mode-host' | sha256sum -c - \
    && test "$(stat -c %s /build/codex-code-mode-host)" -eq 74068880 \
    && chmod 0555 /build/codex-code-mode-host \
    && echo 'e49d60cafaef325fbd85255bef4dd4588eb4418f434b0c0726d519cf420e4723  core/src/session/tests.rs' | sha256sum -c - \
    && echo '91fc8a069b117f91d39ad5af51cbcd52cb715e35a42a58e08ad91aa09faeb590  core/src/tools/registry_tests.rs' | sha256sum -c - \
    && git -C /build/openai-codex-ff6aec9 apply --unidiff-zero --check /build/codex-advice-startup-test.patch \
    && git -C /build/openai-codex-ff6aec9 apply --unidiff-zero /build/codex-advice-startup-test.patch \
    && sha256sum -c /build/codex-advice-startup-test-inputs.sha256 \
    && awk '$2 ~ /\.rs$/ { print $2 }' /build/codex-advice-startup-test-inputs.sha256 | xargs rustfmt --edition 2024 --check
# Fetch locked public test dependencies before entering the network-free stage.
# This step does not compile or run tests and never changes production artifacts.
RUN /bin/bash -eu <<'FETCH_TEST_DEPENDENCIES'
set -o pipefail
cmp Cargo.lock /out/Cargo.lock.resolved
sha256sum Cargo.lock > /out/test-dependency-lock.sha256
sha256sum -c /out/cargo-locks.sha256
sha256sum -c /out/artifacts.sha256
cargo fetch --locked --target "$TARGET" 2>&1 | tee /out/test-dependency-fetch.log
cmp Cargo.lock /out/Cargo.lock.resolved
sha256sum -c /out/test-dependency-lock.sha256
sha256sum -c /out/cargo-locks.sha256
sha256sum -c /out/artifacts.sha256
FETCH_TEST_DEPENDENCIES
RUN --network=none /bin/bash -eu <<'TEST'
build_env=()
while IFS='=' read -r key value; do
    case "$key" in
        CFLAGS|CXXFLAGS|CC|TARGET_CC|CC_x86_64_unknown_linux_musl|CXX|TARGET_CXX|CXX_x86_64_unknown_linux_musl|CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER|CMAKE_C_COMPILER|CMAKE_CXX_COMPILER|CMAKE_ARGS|PKG_CONFIG_ALLOW_CROSS|PKG_CONFIG_PATH|PKG_CONFIG_PATH_x86_64_unknown_linux_musl|PKG_CONFIG_LIBDIR_x86_64_unknown_linux_musl|X86_64_UNKNOWN_LINUX_MUSL_OPENSSL_DIR|X86_64_UNKNOWN_LINUX_MUSL_OPENSSL_NO_VENDOR|X86_64_UNKNOWN_LINUX_MUSL_OPENSSL_STATIC|BORING_BSSL_SYSROOT|BORING_BSSL_SYSROOT_x86_64_unknown_linux_musl|PKG_CONFIG_SYSROOT_DIR|PKG_CONFIG_SYSROOT_DIR_x86_64_unknown_linux_musl) ;;
        *) printf 'Rejected test environment key: %s\n' "$key" >&2; exit 1 ;;
    esac
    test -n "$value"
    if test "$key" = CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER; then
        test "$value" = /usr/bin/x86_64-linux-musl-gcc
        value=/usr/bin/gcc
    fi
    build_env+=("$key=$value")
done < /build/toolchain.env
test "$(env "${build_env[@]}" printenv CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER)" = /usr/bin/gcc
build_env+=("CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER=/build/codex-advice-native-linker.sh")
export RUSTY_V8_ARCHIVE=/build/v8/librusty_v8_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.a.gz
export RUSTY_V8_SRC_BINDING_PATH=/build/v8/src_binding_ptrcomp_sandbox_release_x86_64-unknown-linux-musl.rs
export CODEX_BWRAP_SHA256=$(sha256sum /out/bwrap | cut -d ' ' -f 1)
set -o pipefail
env "${build_env[@]}" cargo test --offline --locked --release --target "$TARGET" -p codex-core -p codex-code-mode --lib --features crdd-lifecycle-observation --no-run 2>&1 | tee /out/startup-verification-compile.log
sha256sum -c /out/artifacts.sha256
sha256sum core/src/session/tests.rs core/src/tools/registry_tests.rs /build/codex-advice-startup-test.patch > /out/startup-verification-inputs.sha256
TEST

FROM startup-verification AS startup-verification-run
RUN --network=none /bin/bash -eu <<'RUN_TEST'
set -o pipefail
mapfile -t test_binaries < <(find "target/$TARGET/release/deps" -maxdepth 1 -type f -name 'codex_core-*' -executable)
test "${#test_binaries[@]}" -eq 1
core_test_binary="${test_binaries[0]}"
verify_test_binary() {
local test_binary="$1" record_prefix="$2"
map="/out/native-link-maps/$(basename "$test_binary").map"
recorded_output="/out/native-link-maps/$(basename "$test_binary").output"
test -f "$map" && test ! -L "$map"
test -f "$recorded_output" && test ! -L "$recorded_output"
test "$(realpath -e "$(< "$recorded_output")")" = "$(realpath -e "$test_binary")"
grep -Fx "OUTPUT($(< "$recorded_output") elf64-x86-64)" "$map"
musl_root="$(rustc --print sysroot)/lib/rustlib/$TARGET/lib/self-contained"
grep -Fx "LOAD $musl_root/rcrt1.o" "$map"
grep -Fx "LOAD $musl_root/libc.a" "$map"
awk -v root="$musl_root/" '$1 == "LOAD" && $2 ~ /\/(.*crt.*\.o|libc\.a)$/ { if (index($2, root) != 1) exit 1 }' "$map"
sha256sum "$test_binary" "$map" "$recorded_output" > "/out/$record_prefix-link.sha256"
readelf -hW "$test_binary" > "/out/$record_prefix-elf-header.txt"
readelf -lW "$test_binary" > "/out/$record_prefix-elf-programs.txt"
readelf -dW "$test_binary" > "/out/$record_prefix-elf-dynamic.txt"
grep -q 'Class:.*ELF64' "/out/$record_prefix-elf-header.txt"
grep -q 'Machine:.*X86-64' "/out/$record_prefix-elf-header.txt"
grep -q 'Type:.*DYN' "/out/$record_prefix-elf-header.txt"
if grep -q 'INTERP' "/out/$record_prefix-elf-programs.txt"; then exit 1; fi
if grep -q '(NEEDED)' "/out/$record_prefix-elf-dynamic.txt"; then exit 1; fi
awk '$1 == "GNU_STACK" { found=1; if ($7 != "RW") exit 1 } END { if (!found) exit 1 }' "/out/$record_prefix-elf-programs.txt"
}
verify_test_binary "$core_test_binary" native-test
test_binary="$core_test_binary"
printf 'Native test binary startup: --list (no test body executes)\n'
timeout --signal=TERM --kill-after=5s 30s "$test_binary" --list 2>&1 | tee /out/startup-verification-list.log
printf 'Native startup-policy tests: selected cases only\n'
startup_test=tools::registry::tests::crdd_advice_startup_tests::crdd_advice_startup_ceiling
grep -Fx "$startup_test: test" /out/startup-verification-list.log
timeout --signal=TERM --kill-after=5s 75s "$test_binary" "$startup_test" --exact --nocapture --test-threads=1 2>&1 | tee /out/startup-verification.log
grep -F 'test result: ok. 1 passed; 0 failed; 0 ignored;' /out/startup-verification.log
echo '5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03  /build/codex-code-mode-host' | sha256sum -c -
for test_name in \
    tools::registry::tests::crdd_advice_host_tests::crdd_advice_host_normal_cell \
    tools::registry::tests::crdd_advice_host_tests::crdd_advice_host_js_capability_rejections \
    tools::registry::tests::crdd_advice_host_tests::crdd_advice_host_forbidden_delegate \
    tools::registry::tests::crdd_advice_host_tests::crdd_advice_host_pending_cell_termination \
    tools::registry::tests::crdd_advice_host_tests::crdd_advice_host_loss \
    tools::registry::tests::crdd_advice_host_tests::crdd_advice_host_reader_endpoint_loss; do
    grep -Fx "$test_name: test" /out/startup-verification-list.log
    log="/out/host-native-${test_name##*::}.log"
    timeout --signal=TERM --kill-after=5s 75s "$test_binary" "$test_name" --exact --nocapture --test-threads=1 2>&1 | tee "$log"
    grep -F 'test result: ok. 1 passed; 0 failed; 0 ignored;' "$log"
done
mapfile -t owner_test_binaries < <(find "target/$TARGET/release/deps" -maxdepth 1 -type f -name 'codex_code_mode-*' -executable)
test "${#owner_test_binaries[@]}" -eq 1
owner_test_binary="${owner_test_binaries[0]}"
verify_test_binary "$owner_test_binary" fault-owner
timeout --signal=TERM --kill-after=5s 30s "$owner_test_binary" --list 2>&1 | tee /out/fault-owner-list.log
for test_name in \
    crdd_fault_injection::tests::exact_pending_and_history \
    crdd_fault_injection::tests::request_removal_is_connection_scoped \
    crdd_fault_injection::tests::startup_owner_is_captured \
    crdd_lifecycle_observation::tests::delegate_correlation_rejects_missing_split_duplicate_and_reordered_events \
    crdd_lifecycle_observation::tests::settled_resources_do_not_prove_scenario_execution \
    crdd_lifecycle_observation::tests::unpolled_inner_drop_inherits_old_scope \
    crdd_lifecycle_observation::tests::inner_drop_must_complete_before_end_is_observed \
    crdd_lifecycle_observation::tests::child_task_inherits_original_scope_after_global_scope_changes \
    crdd_lifecycle_observation::tests::unpolled_wrapped_future_is_registered_and_drop_observed \
    crdd_lifecycle_observation::tests::late_reap_is_bound_to_original_scope_not_reused_pid \
    crdd_lifecycle_observation::tests::installed_scope_registers_future_reservation_before_poll \
    crdd_lifecycle_observation::tests::empty_or_unobserved_is_not_closed \
    crdd_lifecycle_observation::tests::delivery_end_does_not_prove_body_end \
    crdd_lifecycle_observation::tests::failed_reap_and_other_generation_do_not_prove_exit; do
    grep -Fx "$test_name: test" /out/fault-owner-list.log
    log="/out/fault-owner-${test_name##*::}.log"
    timeout --signal=TERM --kill-after=5s 30s "$owner_test_binary" "$test_name" --exact --nocapture --test-threads=1 2>&1 | tee "$log"
    grep -F 'test result: ok. 1 passed; 0 failed; 0 ignored;' "$log"
done
sha256sum -c /out/artifacts.sha256
RUN_TEST

FROM scratch AS startup-verification-artifacts
COPY --from=startup-verification-run /out/ /
COPY build-inputs.json /build-inputs.json
