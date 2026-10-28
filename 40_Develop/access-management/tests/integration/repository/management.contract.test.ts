/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-002
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RFD-IT-021
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  initializeRuntimeState,
  queryPlan,
  savePlan,
} from "../../../../domain-model/src/index.ts";
import { readCurrentAccessState as readCurrentAccess } from "../../../src/authorization/current.ts";
import {
  resolveRepositoryAccess,
  resolveRuntimeContentAccess,
  resolveRepositoryAccessCollection,
  sameAccessCollection,
} from "../../../src/index.ts";
import { saveExposure as updateExposure } from "../../../src/repository/exposure.ts";
import {
  saveRepositoryRegistration as registerRepository,
  saveRepositoryRemoval as unregisterRepository,
} from "../../../src/repository/register.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import { readAccessManagementState } from "../../../src/storage/store.ts";
import { saveUserRegistration as registerUser } from "../../../src/user/crud.ts";
import {
  bytes,
  contentFixture,
  managementFixture,
  prepare,
  repositoryFixture,
} from "../storage/fixture.ts";

/**
 * 同要求の資格照合再利用が失敗・取消・解放不明を迂回しない。
 * @responsibility 実Storeを未解放にせず、制御境界の故障を反証する。
 * @trace RFD-IT-013
 * @precondition 同じ実関数をVMへ読み、各I/Oだけを合成値へ固定する。
 * @stimulus 同版byte差、Root差、pending故障、解放不明、読取り中取消を与える。
 * @observation KDF・Lock・読取り回数とContext結果。
 * @oracle KDFは初回一回だけ、反例は全て拒否、対応外操作でI/O零。
 * @cleanup N/A: 外部資源・実Lockを作らない。
 * @boundary 現在認可Contextの分岐。実認証／実Filesystemの証拠とは区別する。
 */
test("Core定義Contextの要求内照合は解放不明・byte差・取消で拒否する", async (t) => {
  const source = fs.readFileSync(
    new URL("../../../src/repository/resolve.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export function resolveRuntimeContentAccess(");
  const end = source.indexOf("/**", start + 1);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end)).replace(
    "export function",
    "function",
  );
  for (const fault of [
    "release",
    "bytes",
    "root",
    "pending",
    "abort",
  ] as const) {
    await t.test(fault, () => {
      const controller = new AbortController();
      const root = {};
      const changedRoot = {};
      let activeFault: string | null = null;
      let kdf = 0,
        reads = 0,
        locks = 0;
      const actor = { revision: 3, userId: "user", credentialId: "credential" };
      const factory = runInNewContext(`${body};resolveRuntimeContentAccess`, {
        locked: (_root: unknown, invoke: () => unknown) => {
          locks++;
          const result = invoke();
          return activeFault === "release" ? { status: "unavailable" } : result;
        },
        readCurrent: () => {
          reads++;
          if (activeFault === "abort") controller.abort();
          return {
            state: { revision: 3 },
            bytes: Buffer.from(
              activeFault === "bytes" ? "changed" : "original",
            ),
          };
        },
        readCredentialId: () => "credential",
        resolveCredentialAuthentication: () => {
          kdf++;
          return actor;
        },
        selectConnectionAuthentication: () => ({ status: "normal" }),
        selectRepositoryAccess: () => ({}),
        settlePending: () => {
          if (activeFault === "pending") throw new Error("pending");
        },
        observeRepositoryAccess: () => ({
          root: activeFault === "root" ? changedRoot : root,
          revision: 3,
          repositoryId: "repository",
          workspaceId: "development",
          bindingId: "binding",
          manifest: { projectId: "project" },
        }),
        resolveVerifiedRepositoryRoot: (value: unknown) =>
          value === root ? "/initial" : "/changed",
        hash: (bytes: Buffer) =>
          createHash("sha256").update(bytes).digest("hex"),
      });
      const access = factory({}, "token", "repository", controller.signal);
      assert.ok(access);
      const target = { projectId: "project", milestoneId: "milestone" };
      assert.equal(access.revalidate("definition.read", target), true);
      assert.equal(access.revalidate("definition.write", target), true);
      assert.equal(kdf, 1);
      const before = { reads, locks, kdf };
      assert.equal(access.revalidate("queue.enqueue", target), false);
      assert.equal(
        access.revalidate("definition.write", {
          ...target,
          projectId: "foreign",
        }),
        false,
      );
      assert.deepEqual({ reads, locks, kdf }, before);
      activeFault = fault;
      assert.equal(access.revalidate("definition.write", target), false);
      assert.equal(kdf, 1);
    });
  }
});

/**
 * 通常の開発権限をCoreの現在認可へ結合する。
 * @responsibility 主体・対象・現在版と取消を要求内に固定する。
 * @trace RFD-IT-013
 * @precondition 自己生成の管理Storeと公開済みRepository。
 * @stimulus 定義操作、対象差、未許可操作、取消、資格失効を与える。
 * @observation Context・再確認結果と管理Store本文。
 * @oracle developmentだけで定義編集可能、承認／Queue投入は不可、変更後は拒否する。
 * @cleanup 既存Fixtureが今回の管理RootとRepositoryだけを回収する。
 * @boundary 公開AM APIと実Filesystem／Domain Context。
 */
test("Core定義Contextは既存開発権限・同じ主体・現在版に限定する", (t) => {
  const f = contentFixture(t);
  const controller = new AbortController();
  const target = {
    projectId: f.target.manifest.projectId,
    milestoneId: "milestone.test",
  };
  const before = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
  );
  const kdf = t.mock.method(crypto, "scryptSync");
  const access = resolveRuntimeContentAccess(
    f.root,
    f.tokens.developer,
    f.target.manifest.repositoryId,
    controller.signal,
  );
  assert.ok(access);
  assert.equal(kdf.mock.callCount(), 1);
  assert.equal(
    access.principalId,
    f.state.users.find((user) => user.role === "developer")?.userId,
  );
  for (const operation of [
    "definition.read",
    "definition.write",
    "decision.read",
    "queue.read",
    "runtime.read",
  ] as const)
    assert.equal(access.revalidate(operation, target), true, operation);
  assert.equal(kdf.mock.callCount(), 1);
  assert.ok(
    resolveRuntimeContentAccess(
      f.root,
      f.tokens.developer,
      f.target.manifest.repositoryId,
      controller.signal,
    ),
  );
  assert.equal(kdf.mock.callCount(), 2);
  kdf.mock.restore();
  const open = t.mock.method(fs, "openSync");
  assert.equal(access.revalidate("decision.record", target), false);
  assert.equal(access.revalidate("queue.enqueue", target), false);
  assert.equal(
    access.revalidate("definition.write", { ...target, projectId: "other" }),
    false,
  );
  assert.equal(open.mock.callCount(), 0);
  open.mock.restore();
  assert.equal(
    resolveRuntimeContentAccess(
      f.root,
      f.tokens.administrator,
      f.target.manifest.repositoryId,
      controller.signal,
    ),
    null,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(f.directory, "access-management.json")),
    before,
  );
  controller.abort();
  assert.equal(access.revalidate("definition.write", target), false);
  assert.equal(
    resolveRuntimeContentAccess(
      f.root,
      f.tokens.developer,
      f.target.manifest.repositoryId,
      controller.signal,
    ),
    null,
  );
});

/**
 * 認可済みContextを後の資格・内容変更へ流用させない。
 * @responsibility 権限確認を構築時だけで終えない。
 * @trace RFD-IT-013
 * @precondition 自己生成資格とRepositoryで一Contextを作る。
 * @stimulus 資格失効又はManifest変更を行う。
 * @observation 既存Contextの再確認と保存本文。
 * @oracle どちらもfalseで、再確認は状態を変更しない。
 * @cleanup Fixtureが今回のRootだけを回収する。
 * @boundary 現在認証・公開対象観測とCore操作前の再確認。
 */
test("Core定義Contextは失効とManifest差替えで拒否する", async (t) => {
  for (const fault of [
    "revoked",
    "same-revision",
    "role",
    "exposure",
    "manifest",
    "pending",
  ] as const) {
    await t.test(fault, (current) => {
      const f = contentFixture(current);
      const access = resolveRuntimeContentAccess(
        f.root,
        f.tokens.developer,
        f.target.manifest.repositoryId,
        new AbortController().signal,
      );
      assert.ok(access);
      if (["revoked", "same-revision", "role", "exposure"].includes(fault)) {
        const stored = readAccessManagementState(f.root);
        assert.equal(stored.status, "completed");
        if (stored.status !== "completed") return;
        const state = structuredClone(stored.value);
        const user = state.users.find(
          (candidate) => candidate.role === "developer",
        );
        assert.ok(user);
        if (fault === "revoked") {
          for (const credential of state.credentials)
            if (credential.userId === user.userId) credential.revoked = true;
          state.revision++;
        } else if (fault === "same-revision") user.username = "changed";
        else if (fault === "role") user.role = "manager";
        else state.exposure = [];
        fs.writeFileSync(
          path.join(f.directory, "access-management.json"),
          bytes(state),
        );
      } else if (fault === "manifest") {
        fs.writeFileSync(
          f.target.manifestPath,
          JSON.stringify({ ...f.target.manifest, displayName: "changed" }),
        );
      } else {
        fs.writeFileSync(
          path.join(f.directory, "access-management.pending.json"),
          "{}",
        );
      }
      const before = fs.readFileSync(
        path.join(f.directory, "access-management.json"),
      );
      assert.equal(
        access.revalidate("definition.write", {
          projectId: f.target.manifest.projectId,
          milestoneId: "milestone.test",
        }),
        false,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(f.directory, "access-management.json")),
        before,
      );
    });
  }
});

/**
 * 現在内容認可からDomainの実保存までを結合する。
 * @responsibility 認可Contextの模擬成功と本番Writer接続を区別する。
 * @trace RFD-IT-013
 * @precondition 自己生成の管理StoreとGit構造だけを使う。
 * @stimulus 明示初期化・Plan保存・再読取りを同じ要求Contextで行う。
 * @observation 保存結果、再読取り、各操作の有限計測。
 * @oracle 開発権限だけで同じDomain Writerへ接続し、認可区画を変更しない。
 * @cleanup 既存Fixtureが今回のRootだけを回収する。
 * @boundary AM現在権限→Domain実Writerと既存OS排他。
 */
test("Core定義Contextを実Writerの初期化・Plan保存・再読取りへ接続する", (t) => {
  const f = contentFixture(t);
  fs.writeFileSync(
    path.join(f.target.directory, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(f.target.directory, ".git", "refs", "heads", "main"),
    `${"1".repeat(40)}\n`,
  );
  const access = resolveRuntimeContentAccess(
    f.root,
    f.tokens.developer,
    f.target.manifest.repositoryId,
    new AbortController().signal,
  );
  assert.ok(access);
  const target = {
    projectId: f.target.manifest.projectId,
    milestoneId: "milestone.test",
  };
  const before = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
  );
  const started = performance.now();
  const initial = initializeRuntimeState(access, {
    ...target,
    expectedAbsence: true,
  });
  const initializedAt = performance.now();
  assert.equal(initial.status, "saved", JSON.stringify(initial));
  if (initial.status !== "saved") return;
  const saved = savePlan(access, {
    ...target,
    expected: initial.version,
    expectedDefinitionHash: null,
    definition: {
      milestoneAcceptanceCriteria: ["確認"],
      objectives: [{ id: "objective", acceptanceCriteria: ["確認"] }],
      tasks: [
        {
          id: "task",
          objectiveId: "objective",
          dependencies: [],
          allowedPaths: ["src/code.ts"],
          conflictKeys: [],
        },
      ],
    },
  });
  const savedAt = performance.now();
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  const read = queryPlan(access, target);
  assert.equal(read.status, "available", JSON.stringify(read));
  assert.deepEqual(
    fs.readFileSync(path.join(f.directory, "access-management.json")),
    before,
  );
  t.diagnostic(
    JSON.stringify({
      initializeMs: Math.round(initializedAt - started),
      saveMs: Math.round(savedAt - initializedAt),
      readMs: Math.round(performance.now() - savedAt),
    }),
  );
});

/**
 * 三Roleの本人表示と内容・公開範囲の交差を確認する。
 * @responsibility 固定管理候補を内容閲覧・現在実行許可へ転用しないことを検証する。
 * @trace RFD-IT-013
 * @precondition 三Role資格と複数登録・公開範囲を自己生成Rootに保存する。
 * @stimulus 各資格で本人読取り後、Role内容範囲を変更して再読取りする。
 * @observation DTO全field、対象制約、交差集合、凍結状態、current byte。
 * @oracle 本人以外・内部Path・資格材料0、空交差0、改訂一致、保存不変更。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 公開本人読取り→現在認証・保存Lock→非秘密DTO。
 */
test("本人権限は管理候補と内容・Exposure交差を分離する", (t) => {
  const f = managementFixture(t);
  for (const [id, workspaces] of [
    ["dev", ["development"]],
    ["mgmt", ["management"]],
    ["both", ["development", "management"]],
    ["empty", []],
  ] as const) {
    const root = path.resolve(f.directory, id);
    const normalized = process.platform === "win32" ? root.toLowerCase() : root;
    f.state.registeredRepositories.push({
      repositoryId: id,
      repositoryRoot: root,
      bindingId: `binding-${createHash("sha256").update(`${id}\n${normalized}`).digest("hex").slice(0, 32)}`,
    });
    f.state.exposure.push({ repositoryId: id, workspaceIds: [...workspaces] });
  }
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, bytes(f.state));
  const before = fs.readFileSync(current);
  for (const role of ["developer", "manager", "administrator"] as const) {
    const result = readCurrentAccess(f.root, f.tokens[role]);
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    const dto = result.snapshot;
    assert.deepEqual(Object.keys(dto).sort(), [
      "contentAccess",
      "managementOperations",
      "permittedRepositories",
      "revision",
      "user",
    ]);
    assert.equal(dto.user.role, role);
    assert.deepEqual(Object.keys(dto.user).sort(), [
      "role",
      "userId",
      "username",
    ]);
    assert.equal(dto.revision, 1);
    assert.deepEqual(
      dto.contentAccess.workspaceIds,
      f.state.roleContentAccess.find((item) => item.role === role)
        ?.workspaceIds,
    );
    assert.deepEqual(
      dto.permittedRepositories,
      role === "developer"
        ? [
            { repositoryId: "dev", workspaceIds: ["development"] },
            { repositoryId: "both", workspaceIds: ["development"] },
          ]
        : role === "manager"
          ? [
              { repositoryId: "dev", workspaceIds: ["development"] },
              { repositoryId: "mgmt", workspaceIds: ["management"] },
              {
                repositoryId: "both",
                workspaceIds: ["development", "management"],
              },
            ]
          : [],
    );
    for (const repository of dto.permittedRepositories)
      assert.deepEqual(Object.keys(repository).sort(), [
        "repositoryId",
        "workspaceIds",
      ]);
    assert.equal(
      dto.managementOperations.length,
      role === "developer" ? 0 : role === "manager" ? 15 : 25,
    );
    const expected = [];
    if (role !== "developer") {
      const allRoles = ["developer", "manager", "administrator"];
      const editableRoles =
        role === "manager" ? allRoles.slice(0, 2) : allRoles;
      for (const targetRole of allRoles)
        expected.push({ operation: "updateUserName", targetRole });
      for (const targetRole of editableRoles) {
        expected.push(
          { operation: "registerUser", plannedRole: targetRole },
          { operation: "updateRoleContentAccess", targetRole },
        );
        for (const nextRole of editableRoles)
          expected.push({
            operation: "updateUserRole",
            currentRole: targetRole,
            nextRole,
          });
      }
      for (const operation of [
        "registerRepository",
        "unregisterRepository",
        "updateExposure",
        "manageAiProfiles",
      ])
        expected.push({ operation });
      if (role === "administrator")
        for (const operation of [
          "issueCredential",
          "revokeCredential",
          "exchangeCredentials",
        ])
          expected.push({ operation });
    }
    assert.deepEqual(
      dto.managementOperations.map((item) => JSON.stringify(item)).sort(),
      expected.map((item) => JSON.stringify(item)).sort(),
    );
    if (role === "manager") {
      assert.ok(
        dto.managementOperations.some(
          (item) =>
            item.operation === "updateUserName" &&
            item.targetRole === "administrator",
        ),
      );
      assert.ok(
        dto.managementOperations.every(
          (item) =>
            item.operation !== "issueCredential" &&
            item.operation !== "revokeCredential" &&
            item.operation !== "exchangeCredentials" &&
            (item.operation !== "updateUserRole" ||
              (item.currentRole !== "administrator" &&
                item.nextRole !== "administrator")) &&
            (item.operation !== "updateRoleContentAccess" ||
              item.targetRole !== "administrator") &&
            (item.operation !== "registerUser" ||
              item.plannedRole !== "administrator"),
        ),
      );
    }
    for (const value of [
      dto,
      dto.user,
      dto.managementOperations,
      dto.contentAccess,
      dto.contentAccess.workspaceIds,
      dto.permittedRepositories,
      ...dto.managementOperations,
      ...dto.permittedRepositories,
      ...dto.permittedRepositories.map((item) => item.workspaceIds),
    ])
      assert.equal(Object.isFrozen(value), true);
  }
  assert.deepEqual(fs.readFileSync(current), before);
  const manager = f.state.users[1];
  assert.ok(manager);
  manager.role = "developer";
  f.state.revision = 2;
  f.state.operationId = crypto.randomUUID();
  fs.writeFileSync(current, bytes(f.state));
  const changed = readCurrentAccess(f.root, f.tokens.manager);
  assert.equal(changed.status, "completed");
  if (changed.status === "completed") {
    assert.equal(changed.snapshot.revision, 2);
    assert.equal(changed.snapshot.user.role, "developer");
    assert.deepEqual(changed.snapshot.managementOperations, []);
  }
});

/**
 * 登録UUIDの生成前に正確な容量境界で停止する。
 * @responsibility 上限内currentから上限超過nextを作る前処置を確認する。
 * @trace RFD-IT-021
 * @precondition Schema-validな上限直前Snapshotを自己生成Rootに置く。
 * @stimulus 128文字の新User登録を要求する。
 * @observation current byte容量、UUID件数、固定容量失敗、byte不変、材料不存在。
 * @oracle UUID生成0、出版0、上限の引上げ・入力切捨てなし。
 * @cleanup 差替えを復元しFixtureがRoot不存在を確認する。
 * @boundary 公開登録→容量予約→実保存前停止。
 */
test("User登録の容量超過はUUID生成前に拒否する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const repository = {
    repositoryId: "capacity-fixture",
    repositoryRoot: `${path.parse(f.directory).root.replaceAll("\\", "/")}x`,
    bindingId: `binding-${"0".repeat(32)}`,
  };
  f.state.registeredRepositories.push(repository);
  repository.repositoryRoot += "x".repeat(
    16_777_216 - 64 - bytes(f.state).byteLength,
  );
  const normalized = path
    .resolve(repository.repositoryRoot)
    .replace(/[\\/]+$/u, "");
  repository.bindingId = `binding-${createHash("sha256")
    .update(
      `${repository.repositoryId}\n${process.platform === "win32" ? normalized.toLowerCase() : normalized}`,
      "utf8",
    )
    .digest("hex")
    .slice(0, 32)}`;
  const before = bytes(f.state);
  assert.equal(before.byteLength, 16_777_216 - 64);
  assert.equal(parseAccessManagementState(before).status, "parsed");
  fs.writeFileSync(currentPath, before);
  const originalUUID = crypto.randomUUID;
  let generated = 0;
  crypto.randomUUID = () => {
    generated++;
    return originalUUID();
  };
  try {
    const result = registerUser(
      f.root,
      f.tokens.manager,
      1,
      "00000000-0000-4000-8000-000000000090",
      "x".repeat(128),
      "developer",
    );
    assert.equal(result.status, "unavailable");
    if (
      result.status === "unavailable" &&
      result.reason === "management_operation_unavailable"
    ) {
      assert.equal(result.primaryFailure, "state_store_capacity_exceeded");
      assert.equal(result.publication, "not_attempted");
      assert.equal(result.cleanupConfirmed, true);
    } else assert.fail("容量拒否が欠落した");
    assert.equal(generated, 0);
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    crypto.randomUUID = originalUUID;
  }
});

/**
 * 同改訂の許可集合を全範囲と一意な実体へ結合する。
 * @responsibility 複数範囲を落とさず、認証済み空集合、次要求の再認可、公開前の集合比較を確認する。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition 自己生成管理Storeと二つのGit Repository。
 * @stimulus 複数範囲公開・三Role読取り・公開解除を行う。
 * @observation 集合改訂・全範囲・要素一意性・manifest open回数・凍結を確認する。
 * @oracle 各許可Repositoryは一回観測。空内容範囲は認証済み空集合。次要求は変更を反映する。
 * @cleanup 既存Fixtureが全自己生成Rootを削除し不存在確認する。
 * @boundary AM公開入口と実Git／Filesystem。
 */
test("許可Repository集合は同改訂・全範囲・一意な実体を保持", (t) => {
  const f = contentFixture(t),
    second = repositoryFixture(t);
  const secondManifest = {
    ...second.manifest,
    repositoryId: "repository.second",
  };
  fs.writeFileSync(second.manifestPath, JSON.stringify(secondManifest));
  fs.writeFileSync(
    path.join(second.directory, "PROJECT_CONTEXT.md"),
    second.context.replaceAll("repository.fixture", "repository.second"),
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      3,
      crypto.randomUUID(),
      f.target.manifest.repositoryId,
      ["development", "management"],
    ).status,
    "completed",
  );
  assert.equal(
    registerRepository(
      f.root,
      f.tokens.manager,
      4,
      crypto.randomUUID(),
      secondManifest.repositoryId,
      second.directory,
    ).status,
    "completed",
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      5,
      crypto.randomUUID(),
      secondManifest.repositoryId,
      ["management"],
    ).status,
    "completed",
  );
  const open = fs.openSync,
    counts = new Map<string, number>();
  t.after(() => {
    fs.openSync = open;
  });
  fs.openSync = (target, flags, mode) => {
    const name = String(target);
    if ([f.target.manifestPath, second.manifestPath].includes(name))
      counts.set(name, (counts.get(name) ?? 0) + 1);
    return open(target, flags, mode);
  };
  try {
    const developer = resolveRepositoryAccessCollection(
      f.root,
      f.tokens.developer,
    );
    assert.equal(developer.status, "completed");
    if (developer.status !== "completed")
      throw new Error("collection unavailable");
    assert.equal(developer.managementRevision, 6);
    assert.deepEqual(
      developer.repositories.map((item) => [
        item.repositoryId,
        item.workspaceIds,
      ]),
      [["repository.fixture", ["development"]]],
    );
    assert.equal(counts.get(f.target.manifestPath), 1);
    assert.equal(counts.has(second.manifestPath), false);
    counts.clear();
    const manager = resolveRepositoryAccessCollection(f.root, f.tokens.manager);
    assert.equal(manager.status, "completed");
    if (manager.status !== "completed")
      throw new Error("collection unavailable");
    assert.equal(manager.managementRevision, 6);
    assert.equal(
      sameAccessCollection(manager, {
        ...manager,
        repositories: [...manager.repositories].reverse().map((item) => ({
          ...item,
          workspaceIds: [...item.workspaceIds].reverse(),
        })),
      }),
      true,
    );
    assert.equal(
      sameAccessCollection(manager, {
        ...manager,
        managementRevision: manager.managementRevision + 1,
      }),
      false,
    );
    assert.equal(
      sameAccessCollection(manager, {
        ...manager,
        repositories: manager.repositories.slice(1),
      }),
      false,
    );
    const firstRepository = manager.repositories[0];
    assert.ok(firstRepository);
    for (const changed of [
      { ...firstRepository, workspaceIds: [] },
      { ...firstRepository, bindingId: "changed-binding" },
      {
        ...firstRepository,
        manifest: {
          ...firstRepository.manifest,
          displayName: "changed-name",
        },
      },
    ]) {
      assert.equal(
        sameAccessCollection(manager, {
          ...manager,
          repositories: [changed, ...manager.repositories.slice(1)],
        }),
        false,
      );
    }
    assert.equal(
      sameAccessCollection(manager, {
        status: "unavailable",
        reason: "repository_access_observation_unknown",
      }),
      false,
    );
    assert.deepEqual(
      manager.repositories.map((item) => [
        item.repositoryId,
        item.workspaceIds,
      ]),
      [
        ["repository.fixture", ["development", "management"]],
        ["repository.second", ["management"]],
      ],
    );
    assert.ok(Object.isFrozen(manager));
    assert.ok(Object.isFrozen(manager.repositories));
    for (const item of manager.repositories) {
      assert.ok(Object.isFrozen(item));
      assert.ok(Object.isFrozen(item.workspaceIds));
      assert.deepEqual(Object.keys(item).sort(), [
        "bindingId",
        "manifest",
        "repositoryId",
        "root",
        "workspaceIds",
      ]);
    }
    assert.equal(counts.get(f.target.manifestPath), 1);
    assert.equal(counts.get(second.manifestPath), 1);
    counts.clear();
    assert.deepEqual(
      resolveRepositoryAccessCollection(f.root, f.tokens.administrator),
      { status: "completed", managementRevision: 6, repositories: [] },
    );
    assert.equal(counts.size, 0);
  } finally {
    fs.openSync = open;
  }
  fs.rmSync(second.manifestPath);
  assert.deepEqual(
    resolveRepositoryAccessCollection(f.root, f.tokens.manager),
    { status: "unavailable", reason: "repository_access_observation_unknown" },
  );
  assert.equal(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer).status,
    "completed",
  );
  fs.writeFileSync(second.manifestPath, JSON.stringify(secondManifest));
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      6,
      crypto.randomUUID(),
      f.target.manifest.repositoryId,
      [],
    ).status,
    "completed",
  );
  assert.deepEqual(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer),
    { status: "completed", managementRevision: 7, repositories: [] },
  );
  const manager = resolveRepositoryAccessCollection(f.root, f.tokens.manager);
  assert.equal(manager.status, "completed");
  if (manager.status === "completed")
    assert.deepEqual(
      manager.repositories.map((item) => item.repositoryId),
      ["repository.second"],
    );
});

/**
 * 非許可と材料不明で対象Repositoryを観測しない。
 * @responsibility 拒否前の清掃・存在漏洩・未知入力の実行を防ぐ。
 * @trace RFD-IT-013
 * @precondition 公開済み対象と破損pendingを準備する。
 * @stimulus 誤鍵・未知ID・範囲外・Proxy・許可後材料不明を要求する。
 * @observation 対象Rootのlstat回数、Proxy trap、pending byteと固定結果。
 * @oracle 全要求の対象Root観測0、拒否ではpending不変、許可後はcleanup_pending。
 * @cleanup 観測差替えを復元しFixtureを清掃する。
 * @boundary AM認可・材料処置と外部Root観測の前境界。
 */
test("内容拒否とpending異常では対象Repository観測0", (t) => {
  const f = contentFixture(t),
    id = f.target.manifest.repositoryId;
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{");
  const lstat = fs.lstatSync;
  let observations = 0,
    traps = 0;
  t.after(() => {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
  });
  /**
   * 対象Repositoryへの実体観測件数を計測する。
   * @responsibility 認可拒否前に対象Rootへ到達していないことを反証する。
   * @trace RFD-IT-013
   * @precondition 元lstatと自己生成対象Directoryを保持している。
   * @stimulus 保存Ownerからのlstat要求。
   * @observation 対象Directoryへの呼出し数と元lstat結果。
   * @oracle 観測不能を不存在に変換せず元処理へ委譲する。
   * @cleanup t.afterと正常終端で元lstatへ戻す。
   * @boundary 試験の観測差替え。認可判定自体は変更しない。
   */
  const observedLstat: typeof fs.lstatSync = ((target, ...args) => {
    if (String(target).startsWith(f.target.directory)) observations++;
    return lstat(target, ...args);
  }) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", { value: observedLstat });
  const proxy = new Proxy(
    {},
    {
      get() {
        traps++;
        throw new Error("not invoked");
      },
    },
  );
  for (const [token, repositoryId, workspaceId] of [
    ["bad", id, "development"],
    [f.tokens.developer, "unknown.repository", "development"],
    [f.tokens.developer, id, "management"],
    [f.tokens.administrator, id, "development"],
    [f.tokens.developer, proxy, "development"],
    [f.tokens.developer, id, proxy],
  ]) {
    assert.deepEqual(
      resolveRepositoryAccess(
        f.root,
        token as string,
        repositoryId,
        workspaceId,
      ),
      { status: "unavailable", reason: "repository_access_rejected" },
    );
    assert.equal(fs.readFileSync(pending, "utf8"), "{");
  }
  assert.deepEqual(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development"),
    { status: "unavailable", reason: "repository_access_cleanup_pending" },
  );
  assert.equal(observations, 0);
  assert.equal(traps, 0);
  fs.rmSync(pending);
  assert.equal(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development")
      .status,
    "completed",
  );
  assert.ok(observations > 0);
  Object.defineProperty(fs, "lstatSync", { value: lstat });
});

/**
 * 通常登録・明示公開・解除の別責務を確認する。
 * @responsibility managerとadministratorで現在改訂を更新し対象外を保持する。
 * @trace RFD-IT-021
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus 登録→範囲設定→空範囲→Git消失後解除。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 登録は公開0、解除は両管理情報除去・本文不変。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
test("Repository登録と公開は独立し旧Root不成立でも解除できる", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const before = structuredClone(f.state);
  /**
   * 登録と公開設定の別操作に固定UUIDを割り当てる。
   * @responsibility 操作番号から重複しない試験Identityを生成する。
   * @trace RFD-IT-021
   * @precondition 呼出し側が操作ごとに異なる番号を渡す。
   * @stimulus 整数の操作番号。
   * @observation 固定形式のUUID。
   * @oracle 同じ操作の再観測以外でIdentityを共有しない。
   * @cleanup N/A: 純粋な文字列生成。
   * @boundary 試験入力。Authorityを生成しない。
   */
  const op = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const registered = registerRepository(
    f.root,
    f.tokens.manager,
    1,
    op(90),
    target.manifest.repositoryId,
    target.directory,
  );
  assert.equal(registered.status, "completed");
  let current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.equal(current.value.registeredRepositories.length, 1);
  assert.deepEqual(current.value.exposure, []);
  assert.deepEqual(current.value.users, before.users);
  assert.deepEqual(current.value.credentials, before.credentials);
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      2,
      op(91),
      target.manifest.repositoryId,
      ["development"],
    ).status,
    "completed",
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.administrator,
      3,
      op(92),
      target.manifest.repositoryId,
      [],
    ).status,
    "completed",
  );
  current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.deepEqual(current.value.exposure, [
    { repositoryId: target.manifest.repositoryId, workspaceIds: [] },
  ]);
  fs.rmSync(path.join(target.directory, ".git"), { recursive: true });
  const contextBefore = fs.readFileSync(
    path.join(target.directory, "PROJECT_CONTEXT.md"),
  );
  const manifestBefore = fs.readFileSync(target.manifestPath);
  assert.equal(
    unregisterRepository(
      f.root,
      f.tokens.manager,
      4,
      op(93),
      target.manifest.repositoryId,
    ).status,
    "completed",
  );
  current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.deepEqual(current.value.registeredRepositories, []);
  assert.deepEqual(current.value.exposure, []);
  assert.deepEqual(current.value.users, before.users);
  assert.deepEqual(current.value.credentials, before.credentials);
  assert.deepEqual(current.value.initialization, before.initialization);
  assert.deepEqual(
    fs.readFileSync(path.join(target.directory, "PROJECT_CONTEXT.md")),
    contextBefore,
  );
  assert.deepEqual(fs.readFileSync(target.manifestPath), manifestBefore);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 登録拒否の外部Root観測0とIdentity不一致を確認する。
 * @responsibility 不許可・競合・不正対象の拒否が外部観測を発火しない。
 * @trace RFD-IT-002
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus 誤鍵・developer・改訂競合・不正ID、正本と表示の不一致を要求する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 認可前は観測0・保存0、認可後Identity不正も保存0。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
test("登録は認可前にRootを観測せずIdentity差を保存しない", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const originalStat = fs.lstatSync;
  let observed = 0;
  Object.defineProperty(fs, "lstatSync", {
    value: ((...args: Parameters<typeof fs.lstatSync>) => {
      if (String(args[0]).startsWith(target.directory)) observed++;
      return originalStat(...args);
    }) as typeof fs.lstatSync,
    configurable: true,
    writable: true,
  });
  try {
    for (const [token, revision, id] of [
      ["invalid", 1, target.manifest.repositoryId],
      [f.tokens.developer, 1, target.manifest.repositoryId],
      [f.tokens.manager, 2, target.manifest.repositoryId],
      [f.tokens.manager, 1, "invalid id"],
    ] as const) {
      assert.deepEqual(
        registerRepository(
          f.root,
          token,
          revision,
          operationId,
          id,
          target.directory,
        ),
        { status: "unavailable", reason: "management_operation_rejected" },
      );
      assert.deepEqual(fs.readFileSync(currentPath), before);
    }
    assert.equal(observed, 0);
    assert.deepEqual(
      registerRepository(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        target.manifest.repositoryId,
        `${target.directory}/${"x".repeat(32_769)}`,
      ),
      {
        status: "unavailable",
        reason: "management_operation_rejected",
      },
    );
    assert.equal(observed, 0, "Root長超過はPath観測前に拒否する");
    assert.equal(
      registerRepository(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        target.manifest.repositoryId,
        target.directory,
      ).status,
      "completed",
    );
    assert.ok(observed > 0, "観測計測が許可例で発火する");
    fs.writeFileSync(currentPath, before);
  } finally {
    Object.defineProperty(fs, "lstatSync", {
      value: originalStat,
      configurable: true,
      writable: true,
    });
  }
  for (const variant of ["id", "manifest", "context", "git"]) {
    fs.writeFileSync(
      target.manifestPath,
      JSON.stringify(
        variant === "manifest"
          ? { ...target.manifest, projectId: "other.project" }
          : target.manifest,
      ),
    );
    fs.writeFileSync(
      path.join(target.directory, "PROJECT_CONTEXT.md"),
      variant === "context"
        ? target.context.replace(
            "Repository Role: development",
            "Repository Role: management",
          )
        : target.context,
    );
    if (variant === "git")
      fs.rmSync(path.join(target.directory, ".git"), { recursive: true });
    const result = registerRepository(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      variant === "id" ? "other.repository" : target.manifest.repositoryId,
      target.directory,
    );
    assert.equal(result.status, "unavailable");
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 登録固定Fileの容量上限とdescriptor解放を確認する。
 * @responsibility manifestとContextの個別超過で出版しない。
 * @trace RFD-IT-002
 * @precondition 非秘密の自己生成StoreとGit Repository。
 * @stimulus 各固定Fileを1 MiB+1とし、Contextの1 MiB正常例も比較する。
 * @observation current完全byte、pending／replace、開閉descriptor件数。
 * @oracle 超過はpublication not_attempted・保存0、上限内正常例は登録成功。
 * @cleanup 観測関数を復元しFixtureが自己生成Rootを削除する。
 * @boundary AM公開登録とDomain上限付き実File観測。
 */
test("登録固定Fileは各1 MiB上限と開閉の一致を守る", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const contextPath = path.join(target.directory, "PROJECT_CONTEXT.md");
  const op = "00000000-0000-4000-8000-000000000090";
  const originalOpen = fs.openSync,
    originalClose = fs.closeSync;
  const live = new Set<number>();
  let opened = 0,
    closed = 0;
  Object.defineProperty(fs, "openSync", {
    configurable: true,
    writable: true,
    value: ((...args: Parameters<typeof fs.openSync>) => {
      const fd = originalOpen(...args);
      if (String(args[0]).startsWith(target.directory)) {
        opened++;
        live.add(fd);
      }
      return fd;
    }) as typeof fs.openSync,
  });
  fs.closeSync = (fd) => {
    originalClose(fd);
    if (live.delete(fd)) closed++;
  };
  try {
    for (const file of [target.manifestPath, contextPath]) {
      fs.writeFileSync(target.manifestPath, JSON.stringify(target.manifest));
      fs.writeFileSync(contextPath, target.context);
      fs.writeFileSync(file, "x".repeat(1_048_577));
      const result = registerRepository(
        f.root,
        f.tokens.manager,
        1,
        op,
        target.manifest.repositoryId,
        target.directory,
      );
      assert.equal(result.status, "unavailable");
      if (
        result.status === "unavailable" &&
        result.reason === "management_operation_unavailable"
      )
        assert.equal(result.publication, "not_attempted");
      else assert.fail("容量拒否が欠測");
      assert.deepEqual(fs.readFileSync(currentPath), before);
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
      assert.equal(live.size, 0);
      assert.equal(opened, closed);
    }
    fs.writeFileSync(target.manifestPath, JSON.stringify(target.manifest));
    fs.writeFileSync(
      contextPath,
      target.context +
        " ".repeat(1_048_576 - Buffer.byteLength(target.context, "utf8")),
    );
    assert.equal(
      registerRepository(
        f.root,
        f.tokens.manager,
        1,
        op,
        target.manifest.repositoryId,
        target.directory,
      ).status,
      "completed",
    );
    assert.ok(opened > 0);
    assert.equal(live.size, 0);
    assert.equal(opened, closed);
  } finally {
    Object.defineProperty(fs, "openSync", {
      value: originalOpen,
      configurable: true,
      writable: true,
    });
    fs.closeSync = originalClose;
  }
});

/**
 * Exposure拒否と出版後清掃失敗を分離する。
 * @responsibility 未登録・不正範囲を保存せず既知出版を失わない。
 * @trace RFD-IT-021
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus 登録後の不許可・未知範囲・重複を入力しpending削除失敗を注入する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 拒否はcurrent不変、出版後故障はconfirmedの未完了。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
test("Exposure入力拒否と出版後清掃不明を区別する", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const id = target.manifest.repositoryId;
  const op = "00000000-0000-4000-8000-000000000090",
    nextOp = "00000000-0000-4000-8000-000000000091";
  assert.equal(
    registerRepository(
      f.root,
      f.tokens.administrator,
      1,
      op,
      id,
      target.directory,
    ).status,
    "completed",
  );
  const currentPath = path.join(f.directory, "access-management.json"),
    before = fs.readFileSync(currentPath);
  for (const [token, repo, ranges] of [
    [f.tokens.developer, id, []],
    [f.tokens.manager, "missing", []],
    [f.tokens.manager, id, ["unknown"]],
    [f.tokens.manager, id, ["development", "development"]],
  ] as const) {
    assert.deepEqual(updateExposure(f.root, token, 2, nextOp, repo, ranges), {
      status: "unavailable",
      reason: "management_operation_rejected",
    });
    assert.deepEqual(fs.readFileSync(currentPath), before);
  }
  assert.deepEqual(
    registerRepository(
      f.root,
      f.tokens.manager,
      2,
      nextOp,
      id,
      target.directory,
    ),
    { status: "unavailable", reason: "management_operation_rejected" },
  );
  const originalRemove = fs.rmSync;
  fs.rmSync = (p, options) => {
    if (String(p).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return originalRemove(p, options);
  };
  let result: ReturnType<typeof updateExposure>;
  try {
    result = updateExposure(f.root, f.tokens.manager, 2, nextOp, id, [
      "management",
    ]);
  } finally {
    fs.rmSync = originalRemove;
  }
  assert.equal(result.status, "unavailable");
  if (
    result.status === "unavailable" &&
    result.reason === "management_operation_unavailable"
  ) {
    assert.equal(result.publication, "confirmed");
    assert.equal(result.observedRevision, 3);
    assert.equal(result.cleanupConfirmed, false);
  } else assert.fail("出版後失敗が欠測");
  const current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status === "completed") {
    assert.deepEqual(current.value.exposure, [
      { repositoryId: id, workspaceIds: ["management"] },
    ]);
    const next = structuredClone(current.value);
    next.revision = 4;
    next.operationId = "00000000-0000-4000-8000-000000000092";
    prepare({ ...f, state: current.value }, next);
    const materialNames = [
      "access-management.json",
      "access-management.pending.json",
      "access-management.replace.json",
    ];
    const materialBytes = materialNames.map((name) =>
      fs.readFileSync(path.join(f.directory, name)),
    );
    for (const [token, revision] of [
      [f.tokens.developer, 3],
      ["invalid", 3],
      [f.tokens.manager, 2],
    ] as const) {
      assert.deepEqual(updateExposure(f.root, token, revision, op, id, []), {
        status: "unavailable",
        reason: "management_operation_rejected",
      });
      materialNames.forEach((name, index) => {
        assert.deepEqual(
          fs.readFileSync(path.join(f.directory, name)),
          materialBytes[index],
        );
      });
    }
    const settled = updateExposure(f.root, f.tokens.manager, 3, op, id, []);
    assert.equal(settled.status, "unavailable");
    if (
      settled.status === "unavailable" &&
      settled.reason === "management_operation_unavailable"
    ) {
      assert.equal(
        settled.primaryFailure,
        "state_store_previous_pending_settled",
      );
      assert.equal(settled.publication, "not_attempted");
    } else assert.fail("先行清掃の相関が欠測");
    assert.deepEqual(fs.readFileSync(currentPath), materialBytes[0]);
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});
