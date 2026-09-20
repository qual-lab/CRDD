import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  preflightPrivateKeyReference,
  readPrivateKeyReferenceFromEnvironmentFile,
  signEd25519Payload,
} from "../../src/index.ts";
import { readHiddenLineFromTerminal } from "../../src/terminal-secret-input.ts";

const PASSPHRASE = "artifact-signing-test-passphrase";

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-artifact-signing-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const prohibitedRoot = path.join(root, "repository");
  const secretsRoot = path.join(root, "secrets");
  fs.mkdirSync(prohibitedRoot);
  fs.mkdirSync(secretsRoot);
  const pair = generateKeyPairSync("ed25519");
  const privateKeyPath = path.join(secretsRoot, "private.pem");
  fs.writeFileSync(
    privateKeyPath,
    pair.privateKey.export({
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: PASSPHRASE,
    }),
  );
  return { root, pair, privateKeyPath, prohibitedRoot };
}

test("鍵参照を秘密入力前に固定し、任意byte列だけを署名する", (t) => {
  const { pair, privateKeyPath, prohibitedRoot } = fixture(t);
  const payload = Buffer.from("generic-artifact-payload", "utf8");
  const publicKeySpki = createPublicKey(pair.privateKey).export({
    type: "spki",
    format: "der",
  });
  const authorization = preflightPrivateKeyReference({
    privateKeyPath,
    prohibitedRoot,
    maximumBytes: 16 * 1024,
  });
  const result = signEd25519Payload({
    authorization,
    payload,
    passphrase: PASSPHRASE,
    expectedPublicKeySpki: publicKeySpki,
    prohibitedRoot,
    maximumPrivateKeyBytes: 16 * 1024,
  });
  assert.equal(result.algorithm, "Ed25519");
  assert.equal(
    verify(
      null,
      payload,
      pair.publicKey,
      Buffer.from(result.signature, "base64url"),
    ),
    true,
  );
  assert.throws(
    () =>
      signEd25519Payload({
        authorization,
        payload,
        passphrase: PASSPHRASE,
        expectedPublicKeySpki: publicKeySpki,
        prohibitedRoot,
        maximumPrivateKeyBytes: 16 * 1024,
      }),
    /artifact_signing_private_key_authorization_invalid/u,
  );
});

test("CLIとenvに共通の鍵参照preflightが欠落、directory、repository内、差替えを拒否する", (t) => {
  const { root, privateKeyPath, prohibitedRoot } = fixture(t);
  for (const invalidPath of [
    path.join(root, "missing.pem"),
    root,
    path.join(prohibitedRoot, "private.pem"),
  ]) {
    if (invalidPath.endsWith("private.pem") && invalidPath !== privateKeyPath) {
      fs.copyFileSync(privateKeyPath, invalidPath);
    }
    assert.throws(
      () =>
        preflightPrivateKeyReference({
          privateKeyPath: invalidPath,
          prohibitedRoot,
          maximumBytes: 16 * 1024,
        }),
      /artifact_signing_private_key_reference_invalid/u,
    );
  }

  const oversizedPath = path.join(root, "oversized.pem");
  fs.writeFileSync(oversizedPath, Buffer.alloc(16 * 1024 + 1, 1));
  assert.throws(
    () =>
      preflightPrivateKeyReference({
        privateKeyPath: oversizedPath,
        prohibitedRoot,
        maximumBytes: 16 * 1024,
      }),
    /artifact_signing_private_key_reference_invalid/u,
  );

  const symbolicPath = path.join(root, "private-link.pem");
  fs.symlinkSync(privateKeyPath, symbolicPath, "file");
  assert.throws(
    () =>
      preflightPrivateKeyReference({
        privateKeyPath: symbolicPath,
        prohibitedRoot,
        maximumBytes: 16 * 1024,
      }),
    /artifact_signing_private_key_reference_invalid/u,
  );

  const authorization = preflightPrivateKeyReference({
    privateKeyPath,
    prohibitedRoot,
    maximumBytes: 16 * 1024,
  });
  const previous = fs.readFileSync(privateKeyPath);
  fs.writeFileSync(
    privateKeyPath,
    Buffer.concat([previous, Buffer.from("\n")]),
  );
  assert.throws(
    () =>
      signEd25519Payload({
        authorization,
        payload: Buffer.from("payload"),
        passphrase: PASSPHRASE,
        expectedPublicKeySpki: Buffer.alloc(44),
        prohibitedRoot,
        maximumPrivateKeyBytes: 16 * 1024,
      }),
    /artifact_signing_private_key_changed/u,
  );
});

test("preflightは秘密鍵byteを読まず、読取り途中の失敗では確保済みbyteを消去する", (t) => {
  const { pair, privateKeyPath, prohibitedRoot } = fixture(t);
  const expectedPublicKeySpki = createPublicKey(pair.privateKey).export({
    type: "spki",
    format: "der",
  });
  const originalRead = fs.readSync;
  let readCount = 0;
  fs.readSync = (() => {
    readCount += 1;
    throw new Error("unexpected_private_key_read");
  }) as typeof fs.readSync;
  try {
    preflightPrivateKeyReference({
      privateKeyPath,
      prohibitedRoot,
      maximumBytes: 16 * 1024,
    });
    assert.equal(readCount, 0);
  } finally {
    fs.readSync = originalRead;
  }

  for (const failurePoint of ["read", "reobserve", "close"] as const) {
    const authorization = preflightPrivateKeyReference({
      privateKeyPath,
      prohibitedRoot,
      maximumBytes: 16 * 1024,
    });
    const originalAlloc = Buffer.alloc;
    const originalFstat = fs.fstatSync;
    const originalClose = fs.closeSync;
    let allocated: Buffer | null = null;
    let fstatCount = 0;
    Object.defineProperty(Buffer, "alloc", {
      configurable: true,
      value: (size: number, fill?: string | number | Uint8Array) => {
        const value = originalAlloc(size, fill as never);
        allocated = value;
        return value;
      },
    });
    if (failurePoint === "read") {
      fs.readSync = () => {
        throw new Error("injected_read_failure");
      };
    } else if (failurePoint === "reobserve") {
      fs.fstatSync = ((
        ...commandArguments: Parameters<typeof fs.fstatSync>
      ) => {
        fstatCount += 1;
        if (fstatCount === 2) throw new Error("injected_reobserve_failure");
        return originalFstat(...commandArguments);
      }) as typeof fs.fstatSync;
    } else {
      fs.closeSync = (descriptor) => {
        originalClose(descriptor);
        throw new Error("injected_close_failure");
      };
    }
    try {
      assert.throws(() =>
        signEd25519Payload({
          authorization,
          payload: Buffer.from("payload"),
          passphrase: PASSPHRASE,
          expectedPublicKeySpki,
          prohibitedRoot,
          maximumPrivateKeyBytes: 16 * 1024,
        }),
      );
      assert.ok(
        allocated !== null,
        `${failurePoint}: buffer was not allocated`,
      );
      assert.equal(
        (allocated as Buffer).every((byte) => byte === 0),
        true,
        `${failurePoint}: private key bytes were not zeroized`,
      );
    } finally {
      Object.defineProperty(Buffer, "alloc", {
        configurable: true,
        value: originalAlloc,
      });
      fs.readSync = originalRead;
      fs.fstatSync = originalFstat;
      fs.closeSync = originalClose;
    }
  }
});

test("hidden inputはTTYを要求し、取消とEOFで端末状態を必ず復元する", async () => {
  function terminal(
    isInputTTY = true,
    isOutputTTY = true,
    failures: ReadonlySet<string> = new Set(),
  ) {
    let dataListener: ((chunk: string) => void) | null = null;
    let endListener: (() => void) | null = null;
    const rawModes: boolean[] = [];
    const calls: string[] = [];
    let pauseCount = 0;
    const observe = (operation: string) => {
      calls.push(operation);
      if (failures.has(operation)) throw new Error(`injected_${operation}`);
    };
    return {
      adapter: {
        inputIsTTY: isInputTTY,
        outputIsTTY: isOutputTTY,
        write: (value: string) =>
          observe(value === "\n" ? "write-newline" : "write-prompt"),
        setRawMode: (isEnabled: boolean) => {
          rawModes.push(isEnabled);
          observe(isEnabled ? "raw-on" : "raw-off");
        },
        resume: () => observe("resume"),
        pause: () => {
          pauseCount += 1;
          observe("pause");
        },
        setEncoding: (_encoding: BufferEncoding) => observe("encoding"),
        onData: (listener: (chunk: string) => void) => {
          dataListener = listener;
          observe("on-data");
        },
        offData: (listener: (chunk: string) => void) => {
          if (dataListener === listener) dataListener = null;
          observe("off-data");
        },
        onceEnd: (listener: () => void) => {
          endListener = listener;
          observe("on-end");
        },
        offEnd: (listener: () => void) => {
          if (endListener === listener) endListener = null;
          observe("off-end");
        },
      },
      send: (value: string) => dataListener?.(value),
      end: () => endListener?.(),
      rawModes,
      calls,
      pauseCount: () => pauseCount,
    };
  }

  await assert.rejects(
    readHiddenLineFromTerminal("prompt", terminal(false, true).adapter),
    /artifact_signing_interactive_terminal_required/u,
  );

  const cancelled = terminal();
  const cancelledResult = readHiddenLineFromTerminal(
    "prompt",
    cancelled.adapter,
  );
  cancelled.send("\u0003");
  await assert.rejects(cancelledResult, /artifact_signing_cancelled/u);
  assert.deepEqual(cancelled.rawModes, [true, false]);
  assert.equal(cancelled.pauseCount(), 1);

  const ended = terminal();
  const endedResult = readHiddenLineFromTerminal("prompt", ended.adapter);
  ended.end();
  await assert.rejects(endedResult, /artifact_signing_input_closed/u);
  assert.deepEqual(ended.rawModes, [true, false]);
  assert.equal(ended.pauseCount(), 1);

  const newlineFailure = terminal(true, true, new Set(["write-newline"]));
  const newlineResult = readHiddenLineFromTerminal(
    "prompt",
    newlineFailure.adapter,
  );
  newlineFailure.send("secret\r");
  await assert.rejects(
    newlineResult,
    /artifact_signing_terminal_output_failed/u,
  );
  for (const expected of ["off-data", "off-end", "raw-off", "pause"]) {
    assert.ok(newlineFailure.calls.includes(expected));
  }

  for (const setupFailure of [
    "raw-on",
    "resume",
    "encoding",
    "on-data",
    "on-end",
  ]) {
    const failed = terminal(true, true, new Set([setupFailure]));
    await assert.rejects(
      readHiddenLineFromTerminal("prompt", failed.adapter),
      /artifact_signing_terminal_setup_failed|artifact_signing_terminal_cleanup_failed/u,
    );
    assert.ok(failed.calls.includes("raw-off"));
    if (setupFailure !== "raw-on") assert.ok(failed.calls.includes("pause"));
  }

  for (const cleanupFailure of ["off-data", "off-end", "raw-off", "pause"]) {
    const failed = terminal(true, true, new Set([cleanupFailure]));
    const result = readHiddenLineFromTerminal("prompt", failed.adapter);
    failed.send("\u0003");
    await assert.rejects(result, /artifact_signing_terminal_cleanup_failed/u);
    for (const expected of ["off-data", "off-end", "raw-off", "pause"]) {
      assert.ok(
        failed.calls.includes(expected),
        `${cleanupFailure}: ${expected} was not attempted`,
      );
    }
  }
});

test("env fileは鍵Pathの構文と一意性だけを解決し、鍵の存在確認を再定義しない", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-artifact-signing-env-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environmentFile = path.join(root, ".env-crdd");
  const missing = path.join(root, "missing.pem");
  fs.writeFileSync(
    environmentFile,
    `UNRELATED=value\nCRDD_RELEASE_PRIVATE_KEY_PATH="${missing}"\n`,
  );
  assert.equal(
    readPrivateKeyReferenceFromEnvironmentFile(
      environmentFile,
      "CRDD_RELEASE_PRIVATE_KEY_PATH",
    ),
    missing,
  );
  fs.writeFileSync(
    environmentFile,
    `CRDD_RELEASE_PRIVATE_KEY_PATH=${missing}\nCRDD_RELEASE_PRIVATE_KEY_PATH=${missing}\n`,
  );
  assert.throws(
    () =>
      readPrivateKeyReferenceFromEnvironmentFile(
        environmentFile,
        "CRDD_RELEASE_PRIVATE_KEY_PATH",
      ),
    /artifact_signing_environment_invalid/u,
  );
});
