/**
 * CROS Context PackageとRuntime HandoffのSystem境界を検証する。
 *
 * @packageDocumentation
 * @responsibility provenance付き最小PackageとSource／Destination間の安全な再開を検証する。
 * @trace RFD-ST-010
 * @trace ERB-ST-013
 * @level ST
 * @scope cros、context-package、provenance、handoff、recovery
 * @boundary RFD-ST-010／ERB-ST-013=System/E2E。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  resumeHandoff,
  type ContextPackage,
  type CrosHandoff,
} from "../../src/index.ts";

/**
 * 許可ScopeだけをPackage化し欠測・競合・制限を補完しないことを検証する。
 * @responsibility 複数Sourceのprovenance、Scopeおよび不完全状態をConsumer結果へ保持する。
 * @trace RFD-ST-010
 * @precondition 許可・Scope外・restricted・conflictingの項目を用意する。
 * @stimulus 目的限定Context Packageを生成してConsumer相当の読取りを行う。
 * @observation 項目、Source、Revision、Scope、状態および正本属性を観測する。
 * @oracle Scope外を含めず、制限値をnull、競合をconflictingのまま保ち、正本化しない。
 * @cleanup Packageは不変値として消費し外部Storeへ残さない。
 * @boundary RFD-ST-010=Related 2 Blocks: Projection→Package→Consumer。
 */
test("許可された最小Contextだけをprovenance付きでConsumerへ渡す", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-context-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const credentialFile = path.join(root, "credential.json");
  const sessionFile = path.join(root, "session.json");
  const exposureFile = path.join(root, "exposures.json");
  const devRepositoryFile = path.join(root, "repo-dev.json");
  const qaRepositoryFile = path.join(root, "repo-qa.json");
  const otherProjectRepositoryFile = path.join(root, "repo-project-2.json");
  const restrictedRepositoryFile = path.join(root, "must-not-be-read.json");
  const configurationFile = path.join(root, "context-source.json");
  const packageFile = path.join(root, "context-package.json");
  const receiptFile = path.join(root, "receipt.json");
  const worker = path.resolve("tests/fixtures/durable-boundary-worker.ts");
  fs.writeFileSync(
    credentialFile,
    JSON.stringify({
      credential: {
        credentialId: "cred-dev",
        workspaceIds: ["development"],
        systemAdmin: false,
        revoked: false,
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
      tokenSha256: crypto
        .createHash("sha256")
        .update("context-token", "utf8")
        .digest("hex"),
    }),
  );
  fs.writeFileSync(
    exposureFile,
    JSON.stringify([
      {
        workspaceId: "development",
        repositoryId: "REPO-DEV",
        repositoryRevision: "r1",
        registryRevision: "registry-1",
        active: true,
      },
      {
        workspaceId: "development",
        repositoryId: "REPO-QA",
        repositoryRevision: "r2",
        registryRevision: "registry-1",
        active: true,
      },
      {
        workspaceId: "development",
        repositoryId: "REPO-PROJECT-2",
        repositoryRevision: "r3",
        registryRevision: "registry-1",
        active: true,
      },
    ]),
  );
  fs.writeFileSync(
    devRepositoryFile,
    JSON.stringify([
      {
        projectId: "PRJ-1",
        repositoryId: "REPO-DEV",
        bindingId: "BIND-DEV",
        revision: "r1",
        content: { topic: "open", status: "green" },
      },
    ]),
  );
  fs.writeFileSync(
    qaRepositoryFile,
    JSON.stringify([
      {
        projectId: "PRJ-1",
        repositoryId: "REPO-QA",
        bindingId: "BIND-QA",
        revision: "r2",
        content: { status: "red" },
      },
    ]),
  );
  fs.writeFileSync(
    otherProjectRepositoryFile,
    JSON.stringify([
      {
        projectId: "PRJ-2",
        repositoryId: "REPO-PROJECT-2",
        bindingId: "BIND-PROJECT-2",
        revision: "r3",
        content: { portfolio: "attention" },
      },
    ]),
  );
  execFileSync(process.execPath, [
    worker,
    "create-session",
    credentialFile,
    sessionFile,
    "context-session",
    "context-token",
  ]);
  fs.writeFileSync(
    configurationFile,
    JSON.stringify({
      sessionFile,
      exposureFile,
      allowedScopes: ["development"],
      requests: [
        {
          key: "topic",
          scope: "development",
          repositoryId: "REPO-DEV",
          repositoryRelativePath: devRepositoryFile,
          contentKey: "topic",
        },
        {
          key: "status",
          scope: "development",
          repositoryId: "REPO-DEV",
          repositoryRelativePath: devRepositoryFile,
          contentKey: "status",
        },
        {
          key: "status",
          scope: "development",
          repositoryId: "REPO-QA",
          repositoryRelativePath: qaRepositoryFile,
          contentKey: "status",
        },
        {
          key: "missing",
          scope: "development",
          repositoryId: "REPO-DEV",
          repositoryRelativePath: devRepositoryFile,
          contentKey: "not-present",
        },
        {
          key: "restricted",
          scope: "development",
          repositoryId: "REPO-MGMT",
          repositoryRelativePath: restrictedRepositoryFile,
          contentKey: "commercial",
        },
        {
          key: "portfolio",
          scope: "development",
          repositoryId: "REPO-PROJECT-2",
          repositoryRelativePath: otherProjectRepositoryFile,
          contentKey: "portfolio",
        },
      ],
    }),
  );
  execFileSync(process.execPath, [
    worker,
    "write-context-federated",
    packageFile,
    configurationFile,
    "pkg-1",
  ]);
  const pack = JSON.parse(
    execFileSync(
      process.execPath,
      [worker, "consume-context", packageFile, receiptFile, "reviewer-1"],
      { encoding: "utf8" },
    ),
  ) as ContextPackage;
  assert.deepEqual(
    pack.items.map((item) => item.key),
    ["topic", "status", "missing", "restricted", "portfolio"],
  );
  assert.equal(pack.items[1]?.state, "conflicting");
  assert.equal(pack.items[2]?.state, "missing");
  assert.equal(pack.items[3]?.state, "restricted");
  assert.equal(pack.items[3]?.sourceId, null);
  assert.equal(pack.items[4]?.value, "attention");
  assert.equal(pack.retainedAsSourceOfTruth, false);
  assert.equal(fs.existsSync(packageFile), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(receiptFile, "utf8")), {
    packageId: "pkg-1",
    consumerId: "reviewer-1",
    itemCount: 5,
  });
});

/**
 * Runtime切断後も同じHandoff Identityで再開しAuthority差を拒否することを検証する。
 * @responsibility Source終了、Destination再開、拒否および二重実行0を一つのScenarioで相関する。
 * @trace ERB-ST-013
 * @precondition Source Runtimeが固定Contextとread AuthorityのHandoffを発行する。
 * @stimulus Destinationで正常再開し、別入力でAuthority追加を要求する。
 * @observation Source状態、Handoff Identity、Destination状態、理由およびEffectを観測する。
 * @oracle 正常時は同じIdentityで再開し、Authority追加はEffect 0、Sourceはinactiveのままとなる。
 * @cleanup Source二重実行0、拒否時Destination Effect 0を確認する。
 * @boundary ERB-ST-013=System/E2E: Source Runtime→Handoff→Destination Runtime。
 */
test("切断後に同じIdentityで再開しAuthority差をEffect前で拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-handoff-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const handoffFile = path.join(root, "handoff.json");
  const settlementFile = path.join(root, "settlement.json");
  const worker = path.resolve("tests/fixtures/durable-boundary-worker.ts");
  const handoff = JSON.parse(
    execFileSync(process.execPath, [worker, "write-handoff", handoffFile], {
      encoding: "utf8",
    }),
  ) as CrosHandoff;
  const destination = {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "revision-1",
    authorities: ["read"],
    requiredContext: { requirement: "REQ-1" },
  };
  const normal = JSON.parse(
    execFileSync(
      process.execPath,
      [
        worker,
        "resume-handoff",
        handoffFile,
        settlementFile,
        JSON.stringify(destination),
      ],
      { encoding: "utf8" },
    ),
  ) as ReturnType<typeof resumeHandoff>;
  const expanded = resumeHandoff(handoff, {
    taskId: "task-1",
    projectId: "PRJ-1",
    revision: "revision-1",
    authorities: ["read", "write"],
    requiredContext: { requirement: "REQ-1" },
  });
  assert.equal(handoff.sourceActive, false);
  assert.equal(normal.handoffId, handoff.handoffId);
  assert.equal(normal.status, "resumed");
  assert.equal(expanded.destinationEffectIssued, false);
  const replay = JSON.parse(
    execFileSync(
      process.execPath,
      [
        worker,
        "resume-handoff",
        handoffFile,
        settlementFile,
        JSON.stringify(destination),
      ],
      { encoding: "utf8" },
    ),
  ) as ReturnType<typeof resumeHandoff>;
  assert.equal(replay.status, "blocked");
  assert.equal(replay.destinationEffectIssued, false);
});
