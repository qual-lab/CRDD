import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildNativeBootstrap,
  NATIVE_BOOTSTRAP_BUILD_ARGUMENTS,
} from "../scripts/build-native-bootstrap.ts";

test("native bootstrap buildは固定toolchain、offline dependency、link argvだけを使う", () => {
  assert.deepEqual(NATIVE_BOOTSTRAP_BUILD_ARGUMENTS, [
    "+1.94.1-x86_64-pc-windows-msvc",
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
    "link-arg=/Brepro",
  ]);
});

test("native bootstrap buildは外部Rust overrideとcrate外targetを拒否する", () => {
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
