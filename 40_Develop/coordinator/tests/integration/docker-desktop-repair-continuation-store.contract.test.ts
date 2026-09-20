import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createDockerDesktopRepairContinuation,
  dockerDesktopRepairContinuationPaths,
  inspectDockerDesktopRepairContinuation,
  persistDockerDesktopRepairContinuationIntent,
  persistDockerDesktopRepairContinuationRecovered,
  persistDockerDesktopRepairContinuationSettlement,
} from "../../src/security/docker-desktop-repair-continuation-store.ts";
import type {
  DockerDesktopRepairDirectoryIdentity,
  DockerDesktopRepairOperation,
  DockerDesktopRepairRecordBoundary,
} from "../../src/security/docker-desktop-repair-record-store.ts";

const identity = (value: string): DockerDesktopRepairDirectoryIdentity =>
  Object.freeze({ dev: value, ino: value, birthtimeNs: value });

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-repair-continuation-"),
  );
  const operationId = "a".repeat(32);
  const operationDirectory = path.join(
    root,
    `docker-desktop-repair-${operationId}`,
  );
  fs.mkdirSync(operationDirectory);
  const boundary: DockerDesktopRepairRecordBoundary = Object.freeze({
    runtimeStateRoot: root,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    runtimeStateBindingHash: "4".repeat(64),
    dockerPolicySha256: "5".repeat(64),
    crddManifestHash: "6".repeat(64),
    crddReleaseSequence: 1,
    runtimeExecutionIdentitySha256: "7".repeat(64),
    localAppData: path.join(root, "local"),
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId,
    repairId: `docker-desktop-repair.${operationId}`,
    operationDirectory,
    staleName: `run.crdd-stale-${operationId}`,
    staleDirectory: path.join(
      boundary.localAppData,
      "Docker",
      `run.crdd-stale-${operationId}`,
    ),
    runIdentity: identity("10"),
    stage: "renamed",
    sequence: 11,
    previousRecordSha256: "8".repeat(64),
    ledger: Object.freeze({
      processEffects: Object.freeze([]),
      processEffectIssued: false,
      processEffectConfirmation: "not_issued",
      filesystemEffects: Object.freeze([]),
      filesystemEffectIssued: false,
      filesystemEffectConfirmation: "not_issued",
      engineReady: false,
      staleState: "retained",
      hostSafety: "safe",
      evidenceState: "preserved",
      disposition: "not_applicable",
      liveRunIdentity: null,
    }),
  });
  return { root, boundary, operation };
}

test("失敗起動後の複数Runtime領域は同じ復旧IDへ追記し、Effectごとの意図と結果を保持する", () => {
  const { root, boundary, operation } = fixture();
  try {
    let continuation = createDockerDesktopRepairContinuation(
      boundary,
      operation,
      identity("20"),
      identity("30"),
    );
    assert.ok(continuation);
    assert.equal(continuation.stage, "prepared");
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      continuation = persistDockerDesktopRepairContinuationIntent(
        boundary,
        operation,
        continuation,
        action,
      );
      assert.ok(continuation);
      assert.equal(continuation.effects[action]?.phase, "intent_recorded");
      continuation = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        action,
        Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(continuation);
      assert.equal(continuation.effects[action]?.phase, "settled");
    }
    continuation = persistDockerDesktopRepairContinuationRecovered(
      boundary,
      operation,
      continuation,
    );
    assert.ok(continuation);
    assert.equal(continuation.stage, "recovered");
    const inspected = inspectDockerDesktopRepairContinuation(
      boundary,
      operation,
    );
    assert.equal(inspected.status, "valid");
    assert.equal(inspected.continuation?.sequence, 7);
    const paths = dockerDesktopRepairContinuationPaths(boundary, continuation);
    assert.equal(
      paths.failedRunStaleDirectory.endsWith(
        `run.crdd-stale-${operation.operationId}-restart`,
      ),
      true,
    );
    assert.equal(
      paths.secretsEngineStaleDirectory.endsWith(
        `docker-secrets-engine.crdd-stale-${operation.operationId}`,
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("継続記録の改ざん・余分な項目・途中欠落はvalidへ昇格しない", () => {
  for (const mutation of ["hash", "extra", "missing"] as const) {
    const { root, boundary, operation } = fixture();
    try {
      const continuation = createDockerDesktopRepairContinuation(
        boundary,
        operation,
        identity("20"),
        identity("30"),
      );
      assert.ok(continuation);
      const directory = path.join(
        operation.operationDirectory,
        "runtime-continuation",
      );
      const target = path.join(directory, "continuation-00-prepared.json");
      if (mutation === "missing") fs.unlinkSync(target);
      else {
        const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
        if (mutation === "hash") parsed.operationTipSha256 = "f".repeat(64);
        else parsed.extra = true;
        fs.writeFileSync(target, `${JSON.stringify(parsed)}\n`, "utf8");
      }
      assert.equal(
        inspectDockerDesktopRepairContinuation(boundary, operation).status,
        "invalid",
        mutation,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("全Host Effectがconfirmedでなければrecoveredを記録しない", () => {
  const { root, boundary, operation } = fixture();
  try {
    let continuation = createDockerDesktopRepairContinuation(
      boundary,
      operation,
      identity("20"),
      identity("30"),
    );
    assert.ok(continuation);
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      continuation = persistDockerDesktopRepairContinuationIntent(
        boundary,
        operation,
        continuation,
        action,
      );
      assert.ok(continuation);
      continuation = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        action,
        action === "desktop_relaunch"
          ? Object.freeze({ issued: false, confirmation: "not_issued" })
          : Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(continuation);
    }
    assert.equal(
      persistDockerDesktopRepairContinuationRecovered(
        boundary,
        operation,
        continuation,
      ),
      null,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
