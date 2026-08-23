import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildNativeBootstrap,
  NATIVE_BOOTSTRAP_BUILD_ARGUMENTS,
  validateNativeBootstrapBuildEnvironment,
} from "../scripts/build-native-bootstrap.ts";

test("native bootstrap buildは固定toolchain、offline dependency、link argvだけを使う", () => {
  assert.deepEqual(NATIVE_BOOTSTRAP_BUILD_ARGUMENTS, [
    "rustc",
    "--manifest-path",
    "Cargo.toml",
    "--frozen",
    "--release",
    "--target",
    "x86_64-pc-windows-msvc",
    "--bin",
    "coordinator",
    "--features",
    "native-bootstrap-release",
    "--",
    "-C",
    "link-arg=/ENTRY:crdd_coordinator_entry",
    "-C",
    "link-arg=/SUBSYSTEM:CONSOLE,6.02",
    "-C",
    "link-arg=/NODEFAULTLIB",
    "-C",
    "link-arg=libcmt.lib",
    "-C",
    "link-arg=/Brepro",
  ]);
});

test("native bootstrap buildは外部Rust overrideとcrate外targetを拒否する", () => {
  for (const signer of ["", "A".repeat(64), "0".repeat(63), "g".repeat(64)]) {
    assert.throws(
      () =>
        buildNativeBootstrap(
          path.resolve(import.meta.dirname, "../../platform-access/target"),
          signer,
        ),
      /native_bootstrap_authenticode_signer_invalid/u,
    );
  }
  assert.throws(
    () => buildNativeBootstrap(path.resolve(import.meta.dirname, "outside")),
    /native_bootstrap_build_target_invalid/u,
  );
  const previous = process.env.RUSTFLAGS;
  process.env.RUSTFLAGS = "-C target-cpu=native";
  try {
    assert.throws(
      () =>
        buildNativeBootstrap(
          path.resolve(import.meta.dirname, "../../platform-access/target"),
        ),
      /native_bootstrap_build_environment_invalid:RUSTFLAGS/u,
    );
  } finally {
    if (previous === undefined) delete process.env.RUSTFLAGS;
    else process.env.RUSTFLAGS = previous;
  }
});

test("native bootstrap buildは大小文字aliasとCargo/Rust override母集団を拒否する", () => {
  for (const name of [
    "RUSTC",
    "rustdocflags",
    "RUSTC_BOOTSTRAP",
    "RUSTUP_TOOLCHAIN",
    "CARGO_HOME",
    "cargo_target_dir",
    "CARGO_BUILD_RUSTFLAGS",
    "CARGO_PROFILE_RELEASE_LTO",
    "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER",
    "CARGO_REGISTRIES_CRATES_IO_INDEX",
    "CARGO_NET_OFFLINE",
    "CARGO_HTTP_PROXY",
    "CARGO_ALIAS_BUILD",
  ]) {
    assert.throws(
      () => validateNativeBootstrapBuildEnvironment({ [name]: "override" }),
      /native_bootstrap_build_environment_invalid/u,
    );
  }
  assert.throws(
    () =>
      validateNativeBootstrapBuildEnvironment({
        RUSTFLAGS: "one",
        rustflags: "two",
      }),
    /native_bootstrap_build_environment_duplicate:RUSTFLAGS/u,
  );
  assert.equal(
    validateNativeBootstrapBuildEnvironment({
      SystemRoot: "C:\\Windows",
      PATH: "fixed",
      Path: "fixed",
    }),
    true,
  );
  assert.throws(
    () =>
      validateNativeBootstrapBuildEnvironment({
        PATH: "one",
        Path: "two",
      }),
    /native_bootstrap_build_environment_duplicate:PATH/u,
  );
});
