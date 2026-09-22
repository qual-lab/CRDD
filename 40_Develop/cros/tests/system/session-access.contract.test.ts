/**
 * CROS Session GrantとRepository非開示を公開lifecycleで検証する。
 *
 * @packageDocumentation
 * @responsibility Credential→Session→Workspace→Exposure→Repositoryの成立と終了後失効を検証する。
 * @trace RFD-ST-003
 * @trace RFD-ST-004
 * @level ST
 * @scope cros、authentication、session、workspace、exposure、non-disclosure
 * @boundary RFD-ST-003／RFD-ST-004=System/E2E。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  CrosExposure,
  CrosRepository,
  CrosSession,
} from "../../src/index.ts";

const repositories: readonly CrosRepository[] = [
  {
    projectId: "PRJ-1",
    repositoryId: "REPO-DEV",
    bindingId: "BIND-DEV",
    revision: "rev-dev",
    content: { topic: "open" },
  },
  {
    projectId: "PRJ-1",
    repositoryId: "REPO-MGMT",
    bindingId: "BIND-MGMT",
    revision: "rev-mgmt",
    content: { commercial: "restricted" },
  },
];
const exposures: readonly CrosExposure[] = [
  {
    workspaceId: "development",
    repositoryId: "REPO-DEV",
    repositoryRevision: "rev-dev",
    registryRevision: "registry-1",
    active: true,
  },
  {
    workspaceId: "management",
    repositoryId: "REPO-MGMT",
    repositoryRevision: "rev-mgmt",
    registryRevision: "registry-1",
    active: true,
  },
];
const CREDENTIAL_TOKEN = "test-token-not-a-production-secret";
const credentialRecord = (credential: Readonly<Record<string, unknown>>) => ({
  credential,
  expiresAt: "2099-01-01T00:00:00.000Z",
  tokenSha256: crypto
    .createHash("sha256")
    .update(CREDENTIAL_TOKEN, "utf8")
    .digest("hex"),
});

/**
 * 認証後に許可Repositoryだけを解決し切断後にGrantを失効することを検証する。
 * @responsibility Session lifecycleと許可済みRepository解決を同じIdentityで観測する。
 * @trace RFD-ST-003
 * @precondition development Workspaceを持つ非失効Credentialと二Repositoryを用意する。
 * @stimulus Sessionを開始しDEVを解決後、Sessionを閉じて再解決する。
 * @observation Session Identity、Grant、解決結果およびclose後結果を観測する。
 * @oracle DEVだけavailableとなり、close後は同じ対象もrestrictedとなる。
 * @cleanup close後にSession Grantの利用可能性が残らない。
 * @boundary RFD-ST-003=System/E2E: Credential→Session Grant→Workspace→Repository。
 */
test("許可Repositoryだけを解決し切断後にSession Grantを失効する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-session-"));
  const worker = path.resolve("tests/fixtures/durable-boundary-worker.ts");
  const credentialFile = path.join(root, "credential.json");
  const sessionFile = path.join(root, "session.json");
  const exposureFile = path.join(root, "exposures.json");
  const repositoryFile = path.join(root, "repositories.json");
  try {
    fs.writeFileSync(
      credentialFile,
      JSON.stringify(
        credentialRecord({
          credentialId: "cred-dev",
          workspaceIds: ["development"],
          systemAdmin: false,
          revoked: false,
        }),
      ),
    );
    fs.writeFileSync(exposureFile, JSON.stringify(exposures));
    fs.writeFileSync(repositoryFile, JSON.stringify(repositories));
    const session = JSON.parse(
      execFileSync(
        process.execPath,
        [
          worker,
          "create-session",
          credentialFile,
          sessionFile,
          "session-1",
          CREDENTIAL_TOKEN,
        ],
        { encoding: "utf8" },
      ),
    ) as CrosSession;
    const available = JSON.parse(
      execFileSync(
        process.execPath,
        [
          worker,
          "resolve-session",
          sessionFile,
          exposureFile,
          repositoryFile,
          "REPO-DEV",
        ],
        { encoding: "utf8" },
      ),
    ) as { status: string };
    const closed = JSON.parse(
      execFileSync(process.execPath, [worker, "close-session", sessionFile], {
        encoding: "utf8",
      }),
    ) as CrosSession;
    const afterClose = JSON.parse(
      execFileSync(
        process.execPath,
        [
          worker,
          "resolve-session",
          sessionFile,
          exposureFile,
          repositoryFile,
          "REPO-DEV",
        ],
        { encoding: "utf8" },
      ),
    ) as { status: string };
    assert.equal(session.active, true);
    assert.equal(available.status, "available");
    assert.equal(closed.active, false);
    assert.equal(afterClose.status, "restricted");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Grant外Repositoryの存在を漏らさず管理能力をContent Accessへ昇格しないことを検証する。
 * @responsibility Grant外、古いExposure相当およびAdmin-only Sessionを同じ非開示拒否へ閉じる。
 * @trace RFD-ST-004
 * @precondition DEVのみGrantしたSessionとWorkspaceなしのAdmin Sessionを用意する。
 * @stimulus MGMT Repositoryの解決を要求する。
 * @observation 公開結果のkey集合と状態を観測する。
 * @oracle 両結果はstatus=restrictedだけを返しRepository Identity・Path・存在を含めない。
 * @cleanup N/A: 読取りだけで対象Repository Effectを発行しない。
 * @boundary RFD-ST-004=System/E2E: Session→Workspace→Exposure→Repository Projection。
 */
test("Grant外Repositoryを非開示で拒否し管理能力を閲覧権限へ昇格しない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-access-"));
  const worker = path.resolve("tests/fixtures/durable-boundary-worker.ts");
  const exposureFile = path.join(root, "exposures.json");
  const repositoryFile = path.join(root, "must-not-be-read.json");
  try {
    fs.writeFileSync(exposureFile, JSON.stringify(exposures));
    const results = [
      {
        id: "dev",
        credential: {
          credentialId: "cred-dev",
          workspaceIds: ["development"],
          systemAdmin: false,
          revoked: false,
        },
      },
      {
        id: "admin",
        credential: {
          credentialId: "cred-admin",
          workspaceIds: [],
          systemAdmin: true,
          revoked: false,
        },
      },
    ].map(({ id, credential }) => {
      const credentialFile = path.join(root, `${id}-credential.json`);
      const sessionFile = path.join(root, `${id}-session.json`);
      fs.writeFileSync(
        credentialFile,
        JSON.stringify(credentialRecord(credential)),
      );
      execFileSync(process.execPath, [
        worker,
        "create-session",
        credentialFile,
        sessionFile,
        `session-${id}`,
        CREDENTIAL_TOKEN,
      ]);
      return JSON.parse(
        execFileSync(
          process.execPath,
          [
            worker,
            "resolve-session",
            sessionFile,
            exposureFile,
            repositoryFile,
            "REPO-MGMT",
          ],
          { encoding: "utf8" },
        ),
      );
    });
    assert.deepEqual(results, [
      { status: "restricted" },
      { status: "restricted" },
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 無効TokenをSession File作成前に拒否することを検証する。
 * @responsibility Credential Recordの存在を認証成功として扱わない。
 * @trace RFD-ST-003
 * @precondition 有効Credential Recordと不一致Tokenを用意する。
 * @stimulus 別ProcessのSession開始入口へ不一致Tokenを渡す。
 * @observation Worker終了状態とSession File不存在を観測する。
 * @oracle 認証は拒否され、Session Effectは0となる。
 * @cleanup 一時Rootを削除する。
 * @boundary RFD-ST-003=System/E2E: Remote入力→Credential Verifier→Session Store。
 */
test("無効・期限切れ・失効・破損CredentialではSessionを作成しない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-auth-"));
  const worker = path.resolve("tests/fixtures/durable-boundary-worker.ts");
  const credentialFile = path.join(root, "credential.json");
  try {
    const valid = credentialRecord({
      credentialId: "cred-dev",
      workspaceIds: ["development"],
      systemAdmin: false,
      revoked: false,
    });
    const cases = [
      { name: "invalid-token", record: valid, token: "invalid-token" },
      {
        name: "expired",
        record: { ...valid, expiresAt: "2020-01-01T00:00:00.000Z" },
        token: CREDENTIAL_TOKEN,
      },
      {
        name: "revoked",
        record: {
          ...valid,
          credential: { ...valid.credential, revoked: true },
        },
        token: CREDENTIAL_TOKEN,
      },
      {
        name: "malformed",
        record: { ...valid, tokenSha256: "invalid" },
        token: CREDENTIAL_TOKEN,
      },
    ];
    for (const entry of cases) {
      const sessionFile = path.join(root, `${entry.name}-session.json`);
      fs.writeFileSync(credentialFile, JSON.stringify(entry.record));
      const result = execFileSync(
        process.execPath,
        [
          worker,
          "create-session",
          credentialFile,
          sessionFile,
          `session-${entry.name}`,
          entry.token,
        ],
        { encoding: "utf8" },
      );
      assert.equal(result, "null");
      assert.equal(fs.existsSync(sessionFile), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 古いExposure Revisionを非開示で拒否することを検証する。
 * @responsibility Session、Exposure、RepositoryのRevision相関を確認する。
 * @trace RFD-ST-004
 * @precondition SessionとRepositoryに対して古いRegistryまたはRepository Revisionを持つExposureを用意する。
 * @stimulus 古いExposure経由でRepository解決を要求する。
 * @observation 公開結果だけを観測する。
 * @oracle 結果はstatus=restrictedだけで、Repositoryの存在を開示しない。
 * @cleanup N/A: 読取りだけで外部資源を生成しない。
 * @boundary RFD-ST-004=System/E2E: Session Snapshot→Exposure Revision→Repository Revision。
 */
test("古いExposure Revisionを非開示で拒否する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cros-stale-"));
  const worker = path.resolve("tests/fixtures/durable-boundary-worker.ts");
  const credentialFile = path.join(root, "credential.json");
  const sessionFile = path.join(root, "session.json");
  const exposureFile = path.join(root, "exposures.json");
  const repositoryFile = path.join(root, "repositories.json");
  try {
    fs.writeFileSync(
      credentialFile,
      JSON.stringify(
        credentialRecord({
          credentialId: "cred-dev",
          workspaceIds: ["development"],
          systemAdmin: false,
          revoked: false,
        }),
      ),
    );
    fs.writeFileSync(
      exposureFile,
      JSON.stringify([{ ...exposures[0], repositoryRevision: "rev-old" }]),
    );
    fs.writeFileSync(repositoryFile, JSON.stringify(repositories));
    execFileSync(process.execPath, [
      worker,
      "create-session",
      credentialFile,
      sessionFile,
      "session-stale",
      CREDENTIAL_TOKEN,
    ]);
    const stale = JSON.parse(
      execFileSync(
        process.execPath,
        [
          worker,
          "resolve-session",
          sessionFile,
          exposureFile,
          repositoryFile,
          "REPO-DEV",
        ],
        { encoding: "utf8" },
      ),
    );
    assert.deepEqual(stale, { status: "restricted" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
