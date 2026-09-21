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
import test from "node:test";
import {
  closeCrosSession,
  createCrosSession,
  resolveRepository,
  type CrosExposure,
  type CrosRepository,
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
  const session = createCrosSession("session-1", {
    credentialId: "cred-dev",
    workspaceIds: ["development"],
    systemAdmin: false,
    revoked: false,
  });
  assert.ok(session);
  assert.equal(
    resolveRepository(session, "REPO-DEV", exposures, repositories).status,
    "available",
  );
  const closed = closeCrosSession(session);
  assert.equal(
    resolveRepository(closed, "REPO-DEV", exposures, repositories).status,
    "restricted",
  );
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
  const developer = createCrosSession("session-dev", {
    credentialId: "cred-dev",
    workspaceIds: ["development"],
    systemAdmin: false,
    revoked: false,
  });
  const administrator = createCrosSession("session-admin", {
    credentialId: "cred-admin",
    workspaceIds: [],
    systemAdmin: true,
    revoked: false,
  });
  assert.ok(developer && administrator);
  const devResult = resolveRepository(
    developer,
    "REPO-MGMT",
    exposures,
    repositories,
  );
  const adminResult = resolveRepository(
    administrator,
    "REPO-MGMT",
    exposures,
    repositories,
  );
  assert.deepEqual(devResult, { status: "restricted" });
  assert.deepEqual(adminResult, { status: "restricted" });
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
  const session = createCrosSession(
    "session-stale",
    {
      credentialId: "cred-dev",
      workspaceIds: ["development"],
      systemAdmin: false,
      revoked: false,
    },
    "registry-2",
  );
  assert.ok(session);
  assert.deepEqual(
    resolveRepository(session, "REPO-DEV", exposures, repositories),
    { status: "restricted" },
  );
  assert.deepEqual(
    resolveRepository(
      { ...session, registryRevision: "registry-1" },
      "REPO-DEV",
      [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "rev-old",
          registryRevision: "registry-1",
          active: true,
        },
      ],
      repositories,
    ),
    { status: "restricted" },
  );
});
