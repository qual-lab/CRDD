import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compileExternalSendConsentBoundaryHash,
  createIsolatedExternalSendConsentRuntimeCandidate,
  describeExternalSendConsentRuntimeContract,
  EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX,
} from "../src/security/external-send-consent-runtime.ts";
import { dockerRecoveryCommitName } from "../src/security/docker-recovery-journal.ts";
import type { ExternalSendPolicy } from "../src/security/external-send-policy-runtime.ts";

function policy(overrides: Partial<ExternalSendPolicy> = {}) {
  return Object.freeze({
    schema: "crdd-coordinator/external-send-policy/v2" as const,
    enabled: true,
    policyId: "fixture/local-personal/v1",
    informationClassification: "public" as const,
    decisionAuthority: "authenticated_local_user" as const,
    candidatePersistenceAllowed: true,
    candidateRetentionHours: 24,
    candidatePhysicalDeletion:
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" as const,
    destinations: Object.freeze([]),
    policyHash: "a".repeat(64),
    sourceRevision: "1".repeat(40),
    sourceFileHash: "b".repeat(64),
    ...overrides,
  }) as ExternalSendPolicy;
}

test("初期同意境界はRepository revisionでなくexact Policy byteとPolicy IDへ結合する", () => {
  const first = compileExternalSendConsentBoundaryHash(policy());
  assert.match(first ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(
    first,
    createHash("sha256")
      .update("crdd-external-send-consent-boundary-v2\0")
      .update(policy().policyId)
      .update("\0")
      .update(policy().sourceFileHash)
      .update("\0")
      .update("bounded-reviewer-defect-claim-transfer-v1")
      .digest("hex"),
  );
  assert.equal(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceRevision: "2".repeat(40) }),
    ),
    first,
  );
  assert.notEqual(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceFileHash: "c".repeat(64) }),
    ),
    first,
  );
  assert.notEqual(
    compileExternalSendConsentBoundaryHash(
      policy({ policyId: "fixture/another-policy/v1" }),
    ),
    first,
  );
  assert.equal(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceFileHash: "not-a-hash" }),
    ),
    null,
  );
});

test("公開契約は選択User・保護Runtime State・Subscription境界と再承認条件を固定する", () => {
  const contract = describeExternalSendConsentRuntimeContract();
  assert.equal(contract.contractRevision, 3);
  assert.match(contract.lifecycle, /one_active_initial_consent/u);
  assert.ok(contract.binding.includes("selected_local_user"));
  assert.ok(contract.binding.includes("subscription_offering"));
  assert.ok(contract.binding.includes("runtime_external_send_semantics_id"));
  assert.equal(
    contract.runtimeExternalSendSemanticsId,
    "bounded-reviewer-defect-claim-transfer-v1",
  );
  assert.equal(contract.exactProviderAccountOrTenantIdentityVerified, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
  assert.equal(contract.callerSuppliedPathAccepted, false);
});

function isolated() {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-external-send-consent-"),
  );
  let now = 1_000_000;
  let releaseWorks = true;
  let lockAvailable = true;
  let rootAvailable = true;
  let nonce = 0;
  const initialRoot = Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    stableLogicalHomeBindingHash: "4".repeat(64),
  });
  let currentRoot = initialRoot;
  const runtime = createIsolatedExternalSendConsentRuntimeCandidate({
    observeRoot: () => (rootAvailable ? currentRoot : null),
    acquireLock: () =>
      lockAvailable ? Object.freeze({ release: () => releaseWorks }) : null,
    now: () => now,
    nonce: () => (++nonce).toString(16).padStart(16, "0"),
  } as unknown as Parameters<
    typeof createIsolatedExternalSendConsentRuntimeCandidate
  >[0]);
  return Object.freeze({
    rootPath,
    runtime,
    advance: (value: number) => {
      now += value;
    },
    replaceRoot: (field: "identity" | "protection" | "user") => {
      currentRoot = Object.freeze({
        ...currentRoot,
        ...(field === "identity"
          ? { runtimeStateIdentityHash: "5".repeat(64) }
          : field === "protection"
            ? { runtimeStateProtectionHash: "6".repeat(64) }
            : { localUserBindingHash: "7".repeat(64) }),
      });
    },
    restoreRoot: () => {
      currentRoot = initialRoot;
    },
    setNow: (value: number) => {
      now = value;
    },
    makeRootUnavailable: () => {
      rootAvailable = false;
    },
    blockLock: () => {
      lockAvailable = false;
    },
    failRelease: () => {
      releaseWorks = false;
    },
  });
}

test("単一Active境界はabsentから保存・再利用しA→B→Aで古い許可を復活させない", () => {
  const fixture = isolated();
  const first = policy();
  const second = policy({
    policyId: "fixture/second/v1",
    sourceFileHash: "c".repeat(64),
  });
  try {
    assert.equal(fixture.runtime.resolve(first).status, "absent");
    assert.equal(fixture.runtime.persist(first).status, "confirmed");
    assert.equal(fixture.runtime.resolve(first).status, "confirmed");
    assert.equal(fixture.runtime.resolve(second).status, "needs_confirmation");
    assert.equal(
      fixture.runtime.persist(second).status,
      "confirmed",
      JSON.stringify(fs.readdirSync(fixture.rootPath)),
    );
    assert.equal(fixture.runtime.resolve(second).status, "confirmed");
    assert.equal(fixture.runtime.resolve(first).status, "needs_confirmation");
    const activeEntries = fs
      .readdirSync(fixture.rootPath)
      .filter((name) => name.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX));
    assert.equal(activeEntries.length, 0);
    assert.equal(
      activeEntries.filter((name) => name.endsWith(".crdd-commit.json")).length,
      0,
    );
  } finally {
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("期限切れ・選択User・Runtime identity/protection変更は再承認を要求する", () => {
  for (const replacement of ["identity", "protection", "user"] as const) {
    const fixture = isolated();
    try {
      assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
      fixture.replaceRoot(replacement);
      assert.equal(
        fixture.runtime.resolve(policy()).status,
        "needs_confirmation",
      );
      fixture.restoreRoot();
      assert.notEqual(fixture.runtime.resolve(policy()).status, "confirmed");
    } finally {
      fs.rmSync(fixture.rootPath, { recursive: true, force: true });
    }
  }
  const fixture = isolated();
  try {
    assert.equal(
      fixture.runtime.persist(policy()).status,
      "confirmed",
      JSON.stringify(fs.readdirSync(fixture.rootPath)),
    );
    fixture.advance(181 * 24 * 60 * 60 * 1_000);
    assert.equal(
      fixture.runtime.resolve(policy()).status,
      "needs_confirmation",
    );
    fixture.setNow(1_000_000);
    assert.notEqual(fixture.runtime.resolve(policy()).status, "confirmed");
  } finally {
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("観測不能Rootとdangling reparse residueを取消成功へ流用しない", () => {
  const unavailable = isolated();
  try {
    unavailable.makeRootUnavailable();
    assert.equal(unavailable.runtime.revoke().status, "recovery_required");
  } finally {
    fs.rmSync(unavailable.rootPath, { recursive: true, force: true });
  }

  const fixture = isolated();
  const boundary = compileExternalSendConsentBoundaryHash(policy());
  assert.ok(boundary);
  const name = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${boundary}-eeeeeeeeeeeeeeee.json`;
  const link = path.join(fixture.rootPath, name);
  const target = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-consent-link-target-"),
  );
  try {
    fs.symlinkSync(target, link, "junction");
    fs.rmSync(target, { recursive: true, force: true });
    assert.equal(fixture.runtime.revoke().status, "recovery_required");
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  } finally {
    fs.rmSync(link, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("部分pairと破損pairは固定Authorityを安全に失効し、明示revokeも残存0にする", () => {
  const fixture = isolated();
  const name = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${compileExternalSendConsentBoundaryHash(policy())}-ffffffffffffffff.json`;
  const file = path.join(fixture.rootPath, name);
  try {
    fs.writeFileSync(file, "{}\n", "utf8");
    assert.equal(fixture.runtime.resolve(policy()).status, "absent");
    assert.equal(fs.existsSync(file), false);
    assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
    const active = fs
      .readdirSync(fixture.rootPath)
      .find(
        (entry) =>
          entry.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX) &&
          entry.endsWith(".json") &&
          !entry.endsWith(".crdd-commit.json"),
      );
    assert.ok(active);
    fs.writeFileSync(
      path.join(fixture.rootPath, dockerRecoveryCommitName(active)),
      "{}\n",
      "utf8",
    );
    assert.equal(fixture.runtime.resolve(policy()).status, "absent");
    assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
    assert.equal(fixture.runtime.revoke().status, "revoked");
    assert.equal(
      fs
        .readdirSync(fixture.rootPath)
        .some((entry) => entry.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX)),
      false,
    );
  } finally {
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("lock競合とrelease失敗はAuthorityを発行せずrecovery requiredに閉じる", () => {
  const locked = isolated();
  try {
    locked.blockLock();
    assert.equal(locked.runtime.persist(policy()).status, "recovery_required");
  } finally {
    fs.rmSync(locked.rootPath, { recursive: true, force: true });
  }
  const release = isolated();
  try {
    release.failRelease();
    assert.equal(release.runtime.persist(policy()).status, "recovery_required");
  } finally {
    fs.rmSync(release.rootPath, { recursive: true, force: true });
  }
});
