import assert from "node:assert/strict";
import test from "node:test";
import {
  observeDockerWslState,
  type WslListCompletion,
} from "../../src/security/docker-wsl-state.ts";

const completed = (stdout: Uint8Array): WslListCompletion => ({
  status: 0,
  signal: null,
  stdout,
  stderr: Buffer.alloc(0),
});
const list = (value: string, encoding: BufferEncoding = "utf16le") =>
  completed(Buffer.from(value, encoding));
const registered = list("docker-desktop\r\nUbuntu\r\n");
const empty = completed(Buffer.alloc(0));

test("observes stopped only with successful registered and running lists", () => {
  for (const encoding of ["utf16le", "utf8"] as const) {
    const names = list("docker-desktop\r\nUbuntu\r\n", encoding);
    assert.equal(observeDockerWslState(names, empty), "stopped");
    assert.equal(
      observeDockerWslState(names, list("Ubuntu\n", encoding)),
      "stopped",
    );
    assert.equal(
      observeDockerWslState(names, list("docker-desktop\n", encoding)),
      "running",
    );
  }
  assert.equal(
    observeDockerWslState(list("\ufeffdocker-desktop\r\n"), empty),
    "stopped",
  );
  assert.equal(
    observeDockerWslState(list("\ufeffdocker-desktop\r\n", "utf8"), empty),
    "stopped",
  );
});
test("failed or incomplete processes are never empty successful lists", () => {
  for (const change of [
    { status: 1 },
    { status: null },
    { signal: "SIGTERM" },
    { error: new Error("failure") },
    { stderr: Buffer.from("warning") },
    { stdout: Buffer.alloc(65_537) },
  ]) {
    assert.equal(
      observeDockerWslState(registered, { ...empty, ...change }),
      "unknown",
    );
    assert.equal(
      observeDockerWslState({ ...registered, ...change }, empty),
      "unknown",
    );
  }
});
test("rejects malformed encoding and unsupported lines", () => {
  const invalid = [
    Buffer.from([0xff]),
    Buffer.from([0xff, 0xfe, 0x61]),
    Buffer.from([0xfe, 0xff, 0, 0x61]),
    Buffer.from([0xc0, 0xaf]),
    Buffer.from([0x00, 0xd8]),
    Buffer.from("Ubuntu\0", "utf8"),
  ];
  for (const bytes of invalid)
    assert.equal(
      observeDockerWslState(registered, completed(bytes)),
      "unknown",
    );
  for (const text of [
    "\n",
    "Ubuntu\n\n",
    "* Ubuntu\n",
    " Ubuntu\n",
    "Ubuntu \n",
    "Ubuntu\r",
    "Ubuntu\nubuntu\n",
    "Ubuntu:Running\n",
    "あ\n",
    "x".repeat(129),
    "Ubuntu\ufeff\n",
  ])
    assert.equal(observeDockerWslState(registered, list(text)), "unknown");
});
test("requires docker registration and running subset consistency", () => {
  assert.equal(observeDockerWslState(empty, empty), "unknown");
  assert.equal(observeDockerWslState(list("Ubuntu\n"), empty), "unknown");
  assert.equal(observeDockerWslState(registered, list("Other\n")), "unknown");
  assert.equal(
    observeDockerWslState(list("docker-desktop\nDOCKER-DESKTOP\n"), empty),
    "unknown",
  );
});
