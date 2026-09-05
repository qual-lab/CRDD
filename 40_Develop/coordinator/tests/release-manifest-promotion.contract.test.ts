import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  beginReleaseManifestPromotionSession,
  describeReleaseManifestPromotionContract,
  promoteReleaseManifestBytes,
  ReleaseManifestPromotionError,
  verifyPromotedReleaseManifestBytes,
} from "../scripts/release-manifest-promotion.ts";
import {
  executeReleaseManifestPromotionCompositionForVerification,
  promoteVerifiedReleaseManifest,
  resolveReleaseManifestPromotionTopologyForVerification,
} from "../scripts/promote-release-manifest.ts";

const manifestRelativePath = path.join(
  "template",
  "tools",
  "coordinator",
  "coordinator-package-manifest.json",
);

function fixture(bytes = Buffer.from('{"exact":true}', "utf8")) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-promotion-"));
  const sourceRoot = path.join(parent, "source");
  const destinationRoot = path.join(parent, "destination");
  const sourceManifest = path.join(sourceRoot, manifestRelativePath);
  const destinationManifest = path.join(destinationRoot, manifestRelativePath);
  fs.mkdirSync(path.dirname(sourceManifest), { recursive: true });
  fs.mkdirSync(path.dirname(destinationManifest), { recursive: true });
  fs.writeFileSync(sourceManifest, bytes);
  return {
    parent,
    sourceRoot,
    destinationRoot,
    sourceManifest,
    destinationManifest,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function begin(value: ReturnType<typeof fixture>) {
  return beginReleaseManifestPromotionSession(
    value.sourceRoot,
    value.destinationRoot,
    value.sha256,
  );
}

type RacerHandle = Readonly<{
  child: ChildProcess;
  result: Promise<Record<string, unknown>>;
  closed: Promise<void>;
}>;

function startRacer(
  id: string,
  value: ReturnType<typeof fixture>,
  barrierRoot: string,
  timeoutMilliseconds = 10_000,
): RacerHandle {
  const racer = path.join(
    import.meta.dirname,
    "fixtures",
    "release-manifest-promotion-racer.ts",
  );
  const child = spawn(
    process.execPath,
    [
      racer,
      id,
      value.sourceRoot,
      value.destinationRoot,
      value.sha256,
      barrierRoot,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const closed = new Promise<void>((resolve, reject) => {
    child.once("close", () => resolve());
    child.once("error", (error) => {
      if (child.pid === undefined) resolve();
      else reject(error);
    });
  });
  const result = new Promise<Record<string, unknown>>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timeoutError: Error | null = null;
    const deadline = setTimeout(() => {
      timeoutError = new Error(`racer_timeout:${id}`);
      child.kill();
    }, timeoutMilliseconds);
    child.stdout?.setEncoding("utf8").on("data", (part) => (stdout += part));
    child.stderr?.setEncoding("utf8").on("data", (part) => (stderr += part));
    child.once("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(deadline);
      if (timeoutError) reject(timeoutError);
      else if (code !== 0) reject(new Error(`racer_failed:${code}:${stderr}`));
      else {
        try {
          resolve(JSON.parse(stdout) as Record<string, unknown>);
        } catch (error) {
          reject(new Error(`racer_output_invalid:${id}`, { cause: error }));
        }
      }
    });
  });
  return Object.freeze({ child, result, closed });
}

async function stopAndConfirmRacers(handles: readonly RacerHandle[]) {
  for (const handle of handles)
    if (handle.child.exitCode === null && handle.child.signalCode === null)
      handle.child.kill();
  await Promise.all(
    handles.map((handle) =>
      Promise.race([
        handle.closed,
        new Promise<never>((_resolve, reject) =>
          setTimeout(
            () => reject(new Error("racer_cleanup_close_unconfirmed")),
            2_000,
          ),
        ),
      ]),
    ),
  );
}

test("署名済みManifestを途中byteを公開せずatomicに昇格する", () => {
  const value = fixture();
  try {
    const session = begin(value);
    assert.ok(session);
    assert.equal(session.mode, "ready");
    const result = promoteReleaseManifestBytes(session.token);
    assert.equal(result.status, "promoted");
    assert.equal(result.resumed, false);
    assert.equal(result.byteLength, value.bytes.length);
    assert.equal(fs.existsSync(value.sourceManifest), true);
    assert.deepEqual(fs.readFileSync(value.destinationManifest), value.bytes);
    assert.equal(verifyPromotedReleaseManifestBytes(session.token), true);
    assert.deepEqual(describeReleaseManifestPromotionContract(), {
      contract: "crdd-coordinator/release-manifest-promotion",
      contractRevision: 3,
      manifestRelativePath:
        "template/tools/coordinator/coordinator-package-manifest.json",
      sourceTreatment: "opaque_stable_bytes",
      destinationPublish: "exclusive_same_volume_hard_link",
      partialCanonicalFilePossible: false,
      processLossReentry:
        "source_only_linked_or_destination_only_exact_identity",
      stagingCleanup: "separate_explicit_owned_staging_discard",
      automaticRollbackAfterPublish: false,
      textParsingOrSerializationDuringPromotion: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("既存の別file、偽token、開始後source変更をEffect前に拒否する", () => {
  const existing = fixture();
  try {
    fs.writeFileSync(existing.destinationManifest, existing.bytes);
    assert.equal(begin(existing), null);
    assert.throws(
      () => promoteReleaseManifestBytes({}),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        !error.repositoryFilesystemEffectIssued &&
        error.cleanupConfirmed &&
        !error.reentryRequired,
    );
  } finally {
    fs.rmSync(existing.parent, { recursive: true, force: true });
  }

  const changed = fixture();
  try {
    const session = begin(changed);
    assert.ok(session);
    fs.writeFileSync(changed.sourceManifest, '{"changed":true}');
    assert.throws(
      () => promoteReleaseManifestBytes(session.token),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        !error.repositoryFilesystemEffectIssued &&
        error.cleanupConfirmed,
    );
    assert.equal(fs.existsSync(changed.destinationManifest), false);
  } finally {
    fs.rmSync(changed.parent, { recursive: true, force: true });
  }
});

test("link直前に同byteの別fileへ置換されても別主体のsourceを削除しない", {
  concurrency: false,
}, () => {
  const value = fixture();
  const originalLinkSync = fs.linkSync;
  try {
    const session = begin(value);
    assert.ok(session);
    fs.linkSync = ((source: fs.PathLike, destination: fs.PathLike) => {
      fs.unlinkSync(source);
      fs.writeFileSync(source, value.bytes);
      originalLinkSync(source, destination);
    }) as typeof fs.linkSync;
    assert.throws(
      () => promoteReleaseManifestBytes(session.token),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        error.repositoryFilesystemEffectIssued &&
        !error.cleanupConfirmed &&
        error.reentryRequired,
    );
    assert.deepEqual(fs.readFileSync(value.sourceManifest), value.bytes);
    assert.deepEqual(fs.readFileSync(value.destinationManifest), value.bytes);
  } finally {
    fs.linkSync = originalLinkSync;
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("atomic publish後のlinked状態をfresh sessionから成功として再観測する", () => {
  const value = fixture();
  try {
    fs.linkSync(value.sourceManifest, value.destinationManifest);
    const resumed = begin(value);
    assert.ok(resumed);
    assert.equal(resumed.mode, "linked_pending");
    const result = promoteReleaseManifestBytes(resumed.token);
    assert.equal(result.status, "promoted");
    assert.equal(result.resumed, true);
    assert.equal(fs.existsSync(value.sourceManifest), true);
    assert.deepEqual(fs.readFileSync(value.destinationManifest), value.bytes);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("明示的なstaging破棄後はdestination-only状態を再観測できる", () => {
  const value = fixture();
  try {
    const session = begin(value);
    assert.ok(session);
    promoteReleaseManifestBytes(session.token);
    fs.rmSync(value.sourceRoot, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(value.sourceManifest), { recursive: true });
    const resumed = begin(value);
    assert.ok(resumed);
    assert.equal(resumed.mode, "transferred");
    const result = promoteReleaseManifestBytes(resumed.token);
    assert.equal(result.status, "promoted");
    assert.equal(result.resumed, true);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("linked状態の同byte別identityと転送後の内容変更を再開しない", () => {
  const different = fixture();
  try {
    fs.writeFileSync(different.destinationManifest, different.bytes);
    assert.equal(begin(different), null);
  } finally {
    fs.rmSync(different.parent, { recursive: true, force: true });
  }

  const changed = fixture();
  try {
    const first = begin(changed);
    assert.ok(first);
    promoteReleaseManifestBytes(first.token);
    fs.writeFileSync(changed.destinationManifest, '{"changed":true}');
    assert.equal(begin(changed), null);
    assert.equal(verifyPromotedReleaseManifestBytes(first.token), false);
  } finally {
    fs.rmSync(changed.parent, { recursive: true, force: true });
  }
});

test("二つのProcessがprecheck後に競合しても一方だけがEffectを発行する", async () => {
  const value = fixture();
  const handles: RacerHandle[] = [];
  try {
    const barrierRoot = path.join(value.parent, "barrier");
    fs.mkdirSync(barrierRoot);
    const first = startRacer("first", value, barrierRoot);
    const second = startRacer("second", value, barrierRoot);
    handles.push(first, second);
    const readyDeadline = Date.now() + 5_000;
    for (const id of ["first", "second"]) {
      const ready = path.join(barrierRoot, `${id}.ready`);
      while (!fs.existsSync(ready)) {
        if (Date.now() >= readyDeadline)
          throw new Error(`racer_ready_timeout:${id}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    fs.writeFileSync(path.join(barrierRoot, "go"), "go");
    const results = await Promise.all([first.result, second.result]);
    assert.equal(
      results.filter((result) => result.status === "promoted").length,
      1,
    );
    assert.equal(
      results.filter(
        (result) =>
          result.status === "blocked" &&
          result.repositoryFilesystemEffectIssued === false &&
          result.cleanupConfirmed === true &&
          result.reentryRequired === false,
      ).length,
      1,
    );
    const resumed = begin(value);
    assert.ok(resumed);
    assert.equal(resumed.mode, "linked_pending");
    assert.equal(promoteReleaseManifestBytes(resumed.token).status, "promoted");
  } finally {
    await stopAndConfirmRacers(handles);
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("競合fixtureはready前停止、出力破損、ready後停止を有限時間で回収する", async () => {
  for (const mode of ["hang-before-ready", "malformed", "hang-after-ready"]) {
    const value = fixture();
    const barrierRoot = path.join(value.parent, "barrier");
    fs.mkdirSync(barrierRoot);
    const handle = startRacer(mode, value, barrierRoot, 250);
    try {
      if (mode !== "hang-before-ready") {
        const ready = path.join(barrierRoot, `${mode}.ready`);
        const deadline = Date.now() + 2_000;
        while (!fs.existsSync(ready)) {
          if (Date.now() >= deadline)
            throw new Error("fault_racer_ready_timeout");
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        fs.writeFileSync(path.join(barrierRoot, "go"), "go");
      }
      await assert.rejects(handle.result, /racer_(?:timeout|output_invalid)/u);
      await handle.closed;
    } finally {
      await stopAndConfirmRacers([handle]);
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

test("開始後のRoot置換と完了後の親Directory置換を同一Sessionへ流用しない", () => {
  const before = fixture();
  try {
    const session = begin(before);
    assert.ok(session);
    const moved = `${before.sourceRoot}-moved`;
    fs.renameSync(before.sourceRoot, moved);
    fs.mkdirSync(path.dirname(before.sourceManifest), { recursive: true });
    fs.writeFileSync(before.sourceManifest, before.bytes);
    assert.throws(
      () => promoteReleaseManifestBytes(session.token),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        !error.repositoryFilesystemEffectIssued &&
        error.cleanupConfirmed,
    );
  } finally {
    fs.rmSync(before.parent, { recursive: true, force: true });
  }

  const after = fixture();
  try {
    const session = begin(after);
    assert.ok(session);
    promoteReleaseManifestBytes(session.token);
    const parent = path.dirname(after.destinationManifest);
    const moved = `${parent}-moved`;
    fs.renameSync(parent, moved);
    fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(after.destinationManifest, after.bytes);
    assert.equal(verifyPromotedReleaseManifestBytes(session.token), false);
  } finally {
    fs.rmSync(after.parent, { recursive: true, force: true });
  }
});

test("productionと同じ合成順序で前段検証、atomic昇格、後段検証を実行する", () => {
  const value = fixture();
  const phases: string[] = [];
  const release = Object.freeze({
    expected: Object.freeze({
      manifestHash: "1".repeat(64),
      releaseSequence: 1,
      crddVersion: "v0.19.0",
      crddCommit: "2".repeat(40),
      crddTree: "3".repeat(40),
      packageContentRootSha256: "4".repeat(64),
      runtimeExecutionIdentitySha256: "5".repeat(64),
    }),
    manifestFileSha256: value.sha256,
  });
  try {
    const result = executeReleaseManifestPromotionCompositionForVerification(
      value.sourceRoot,
      value.destinationRoot,
      "2026-09-03T00:00:00.000Z",
      {
        inspectRelease(root, time) {
          phases.push(`inspect:${root}:${time}`);
          return release;
        },
        verifyRepository(phase) {
          phases.push(phase);
          return phase === "before"
            ? fs.existsSync(value.sourceManifest) &&
                !fs.existsSync(value.destinationManifest)
            : fs.existsSync(value.sourceManifest) &&
                fs.readFileSync(value.destinationManifest).equals(value.bytes);
        },
      },
    );
    assert.equal(result.status, "promoted");
    assert.deepEqual(phases, [
      `inspect:${value.sourceRoot}:2026-09-03T00:00:00.000Z`,
      "before",
      "after",
    ]);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("合成後段の不成立は公開済みfileを推測削除せず再入場を要求する", () => {
  const value = fixture();
  const release = Object.freeze({
    expected: Object.freeze({
      manifestHash: "1".repeat(64),
      releaseSequence: 1,
      crddVersion: "v0.19.0",
      crddCommit: "2".repeat(40),
      crddTree: "3".repeat(40),
      packageContentRootSha256: "4".repeat(64),
      runtimeExecutionIdentitySha256: "5".repeat(64),
    }),
    manifestFileSha256: value.sha256,
  });
  try {
    assert.throws(
      () =>
        executeReleaseManifestPromotionCompositionForVerification(
          value.sourceRoot,
          value.destinationRoot,
          "2026-09-03T00:00:00.000Z",
          {
            inspectRelease: () => release,
            verifyRepository: (phase) => phase === "before",
          },
        ),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        error.repositoryFilesystemEffectIssued &&
        !error.cleanupConfirmed &&
        error.reentryRequired,
    );
    assert.equal(fs.existsSync(value.sourceManifest), true);
    assert.deepEqual(fs.readFileSync(value.destinationManifest), value.bytes);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("production昇格入口はGit CLIやtext再serializeを使わず固定検証を合成する", () => {
  assert.equal(typeof promoteVerifiedReleaseManifest, "function");
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, "../scripts/promote-release-manifest.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /node:child_process|\b(?:spawn|execFile)Sync\b/u);
  assert.doesNotMatch(source, /JSON\.stringify\([^\n]*envelope|writeFileSync/u);
  for (const required of [
    "verifyHistoricalPlatformProvisionerManifestCandidate",
    "inspectVerifiedNativeDistributionCandidate",
    "inspectPlatformProvisionerReleaseIdentityCandidate",
    "inspectRepositoryIdentityCandidate",
    "beginReleaseManifestPromotionSession",
    "promoteReleaseManifestBytes",
    "verifyPromotedReleaseManifestBytes",
    "executeReleaseManifestPromotionCompositionForVerification",
    "executionDistributionRoot",
    "process.cwd()",
  ])
    assert.equal(source.includes(required), true, required);
  assert.doesNotMatch(source, /--distribution-root/u);
});

test("昇格入口は配置先Repository直下の署名候補自身だけを実行元にする", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-topology-"));
  const destinationRoot = path.join(parent, "repository");
  const stagingRoot = path.join(destinationRoot, ".crdd", "release-staging");
  const candidateRoot = path.join(stagingRoot, "candidate-01");
  const siblingRoot = path.join(parent, "candidate-01");
  try {
    fs.mkdirSync(candidateRoot, { recursive: true });
    fs.mkdirSync(siblingRoot);
    fs.mkdirSync(
      path.join(destinationRoot, "node_modules", "ignored-package"),
      {
        recursive: true,
      },
    );
    fs.writeFileSync(
      path.join(destinationRoot, "node_modules", "ignored-package", "index.js"),
      "ignored",
    );
    assert.deepEqual(
      resolveReleaseManifestPromotionTopologyForVerification(
        candidateRoot,
        destinationRoot,
      ),
      {
        distributionRoot: candidateRoot,
        destinationRepositoryRoot: destinationRoot,
      },
    );
    assert.throws(
      () =>
        resolveReleaseManifestPromotionTopologyForVerification(
          siblingRoot,
          destinationRoot,
        ),
      /release_manifest_promotion_execution_source_invalid/u,
    );
    assert.throws(
      () =>
        resolveReleaseManifestPromotionTopologyForVerification(
          candidateRoot,
          path.join(destinationRoot, "node_modules"),
        ),
      /release_manifest_promotion_execution_source_invalid/u,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("作業Checkout内の未署名Launcherからは昇格を開始しない", () => {
  assert.throws(
    () => promoteVerifiedReleaseManifest(),
    /release_manifest_promotion_execution_source_invalid/u,
  );
});
