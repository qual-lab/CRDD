/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-019
 * @trace RFD-IT-021
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createPortfolioProjection,
  type ProjectContextSource,
  readRepositoryProjectContext,
} from "../../../../domain-model/src/index.ts";
import { authenticateCredential } from "../../../src/credential/authentication.ts";
import { createCredentialMaterial } from "../../../src/credential/token.ts";
import {
  type CredentialManagementResult,
  issueCredential,
  resolveRepositoryAccess,
  resolveRepositoryAccessCollection,
  revokeCredential,
} from "../../../src/index.ts";
import { createInitialCredential } from "../../../src/initialization/execution.ts";
import { saveExposure as updateExposure } from "../../../src/repository/exposure.ts";
import {
  saveUserRole as updateUserRole,
  saveRoleContentAccess as updateRoleContentAccess,
} from "../../../src/role/assign.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import {
  readAccessManagementState,
  updateAccessManagementState,
} from "../../../src/storage/store.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import {
  saveUserRegistration as registerUser,
  saveUserName as updateUserName,
} from "../../../src/user/crud.ts";
import type { UserRoleManagementResult } from "../../../src/user/types.ts";
import {
  bytes,
  contentFixture,
  fixture,
  managementFixture,
  prepare,
  prepareInitialUser,
} from "./fixture.ts";

/**
 * 管理4操作の成功と変更対象の閉包を確認する。
 * @responsibility managerの通常許可と現在Role反映を実保存で検証する。
 * @trace RFD-IT-021
 * @precondition 三Role資格と完了初回の自己生成Store。
 * @stimulus 登録・admin名前変更・dev/manager Role変更・内容範囲変更を公開Rootから行う。
 * @observation 保存結果・完全byte・対象外field・次認証・所有材料不存在。
 * @oracle 各処置は一改訂、資格・初回・Repository登録・Exposure・交換は不変、内容0でも固定管理可。
 * @cleanup Fixtureが全Rootを削除し不存在確認する。
 * @boundary 公開管理API→現在認可→実Filesystem保存。
 */
test("通常管理4操作は現在認可で対象fieldだけ保存する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const protectedFields = {
    credentials: f.state.credentials,
    initialization: f.state.initialization,
    registeredRepositories: f.state.registeredRepositories,
    exposure: f.state.exposure,
    unresolvedKeyExchanges: f.state.unresolvedKeyExchanges,
  };
  const manager = f.state.users[1];
  const developer = f.state.users[2];
  const administrator = f.state.users[0];
  assert.ok(manager && developer && administrator);
  let revision = 1;
  const operations = [
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        "追加",
        "developer",
      ),
    () =>
      updateUserName(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        administrator.userId,
        "名前だけ変更",
      ),
    () =>
      updateUserRole(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        developer.userId,
        "developer",
        "manager",
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        "manager",
        [],
      ),
  ];
  for (const operation of operations) {
    const before = JSON.parse(
      fs.readFileSync(currentPath, "utf8"),
    ) as AccessManagementState;
    const result = operation();
    assert.equal(result.status, "completed");
    if (result.status !== "completed") return;
    assert.equal(result.expectedRevision, revision);
    assert.equal(result.revision, ++revision);
    const after = JSON.parse(
      fs.readFileSync(currentPath, "utf8"),
    ) as AccessManagementState;
    for (const [field, value] of Object.entries(protectedFields))
      assert.deepEqual(after[field as keyof AccessManagementState], value);
    assert.equal(after.operationId, result.operationId);
    assert.equal(
      after.users.filter((user) => user.userId === manager.userId).length,
      1,
    );
    assert.equal(
      after.users.find((user) => user.userId === manager.userId)?.username,
      manager.username,
    );
    assert.ok(
      after.users.length === before.users.length ||
        after.users.length === before.users.length + 1,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    assert.equal(JSON.stringify(result).includes(f.tokens.manager), false);
  }
  const next = authenticateCredential(f.root, f.tokens.developer);
  assert.equal(next.status, "completed");
  if (next.status === "completed") assert.equal(next.snapshot.role, "manager");
  const name = authenticateCredential(f.root, f.tokens.administrator);
  assert.equal(name.status, "completed");
  if (name.status === "completed")
    assert.equal(name.snapshot.username, "名前だけ変更");
  assert.equal(
    registerUser(
      f.root,
      f.tokens.manager,
      revision,
      crypto.randomUUID(),
      "内容権限なしでも管理",
      "manager",
    ).status,
    "completed",
  );
});

/**
 * 通常管理の拒否を保存不明へ変換しない。
 * @responsibility 非開示拒否・現在Role・入力境界・UUID非生成を確認する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 禁止対象、誤鍵、競合、不正値、Proxy／accessor、途中初回を入力する。
 * @observation 固定結果・current完全byte・UUID件数・材料不存在・getter件数。
 * @oracle 拒否時は対象情報0、生成・出版0、入力を暗黙変換しない。
 * @cleanup 差替えを復元しFixtureがRoot不存在を確認する。
 * @boundary 公開管理API→認証・入力・固定管理許可→実保存前停止。
 */
test("通常管理拒否は非開示・UUID0・保存0", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const administrator = f.state.users[0];
  assert.ok(administrator);
  const originalUUID = crypto.randomUUID;
  let generated = 0;
  crypto.randomUUID = () => {
    generated++;
    return originalUUID();
  };
  t.after(() => {
    crypto.randomUUID = originalUUID;
  });
  const operationId = "00000000-0000-4000-8000-000000000090";
  let invoked = 0;
  const accessor: unknown[] = [];
  Object.defineProperty(accessor, "0", {
    get() {
      invoked++;
      return "development";
    },
  });
  const proxy = new Proxy([], {
    get() {
      invoked++;
      throw new Error("not_allowed");
    },
  });
  const operations = [
    () =>
      registerUser(
        f.root,
        f.tokens.developer,
        1,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "名前",
        "administrator",
      ),
    () => registerUser(f.root, "invalid", 1, operationId, "名前", "developer"),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        0,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        2,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      registerUser(f.root, f.tokens.manager, 1, "invalid", "名前", "developer"),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        " 名前",
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "x".repeat(129),
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "x".repeat(2_000_000),
        "developer",
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        Array(100_000).fill("development"),
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "a\u0000",
        "developer",
      ),
    () =>
      registerUser(f.root, f.tokens.manager, 1, operationId, "a", "management"),
    () =>
      updateUserName(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "missing",
        "名前",
      ),
    () =>
      updateUserRole(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        administrator.userId,
        "administrator",
        "developer",
      ),
    () =>
      updateUserRole(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        administrator.userId,
        "developer",
        "manager",
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "administrator",
        [],
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        ["unknown"],
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        ["development", "development"],
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        accessor,
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        proxy,
      ),
  ];
  for (const operation of operations) {
    assert.deepEqual(operation(), {
      status: "unavailable",
      reason: "management_operation_rejected",
    });
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
  assert.equal(generated, 0);
  assert.equal(invoked, 0);
  const revoked = structuredClone(f.state);
  const credential = revoked.credentials[1];
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(currentPath, bytes(revoked));
  assert.deepEqual(
    registerUser(f.root, f.tokens.manager, 1, operationId, "名前", "developer"),
    { status: "unavailable", reason: "management_operation_rejected" },
  );
  assert.deepEqual(fs.readFileSync(currentPath), bytes(revoked));
  const initial = fixture(t);
  const attempt = prepareInitialUser(initial);
  const issued = createInitialCredential(initial.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status === "completed" && issued.value.token) {
    const initialPath = path.join(initial.directory, "access-management.json");
    const saved = fs.readFileSync(initialPath);
    assert.deepEqual(
      registerUser(
        initial.root,
        issued.value.token,
        3,
        operationId,
        "名前",
        "developer",
      ),
      { status: "unavailable", reason: "management_operation_rejected" },
    );
    assert.deepEqual(fs.readFileSync(initialPath), saved);
  }
});

/**
 * 非認可要求は先行保存材料を処置しない。
 * @responsibility base／next一致の材料も現在認可前は保持する。
 * @trace RFD-IT-021
 * @precondition 三Role資格と先行pending／replaceを持つ自己生成Store。
 * @stimulus 誤鍵・developer・改訂競合・managerの禁止対象を要求する。
 * @observation current／pending／replaceの完全byte、UUID生成と材料削除件数。
 * @oracle 固定非開示拒否で状態・材料不変、UUID生成0・材料削除0。
 * @cleanup 差替えを復元してFixtureがRoot不存在を確認する。
 * @boundary 公開通常管理入口と認可前のFilesystem境界。
 */
test("非認可の通常管理はbase／nextの先行保存材料を保持する", (t) => {
  const f = managementFixture(t);
  const administrator = f.state.users[0];
  assert.ok(administrator);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000091";
  const operationId = "00000000-0000-4000-8000-000000000090";
  const originalUUID = crypto.randomUUID;
  const originalRemove = fs.rmSync;
  let generated = 0;
  let removed = 0;
  crypto.randomUUID = () => {
    generated++;
    return originalUUID();
  };
  fs.rmSync = (target, options) => {
    if (
      String(target).endsWith("access-management.pending.json") ||
      String(target).endsWith("access-management.replace.json")
    )
      removed++;
    return originalRemove(target, options);
  };
  try {
    for (const current of [f.state, next]) {
      prepare(f, next);
      fs.writeFileSync(
        path.join(f.directory, "access-management.json"),
        bytes(current),
      );
      const names = [
        "access-management.json",
        "access-management.pending.json",
        "access-management.replace.json",
      ];
      const before = names.map((name) =>
        fs.readFileSync(path.join(f.directory, name)),
      );
      const operations: (() => UserRoleManagementResult)[] = [
        () =>
          registerUser(
            f.root,
            "invalid",
            current.revision,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          registerUser(
            f.root,
            f.tokens.developer,
            current.revision,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          registerUser(
            f.root,
            f.tokens.manager,
            current.revision + 1,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          updateUserRole(
            f.root,
            f.tokens.manager,
            current.revision,
            operationId,
            administrator.userId,
            "administrator",
            "developer",
          ),
      ];
      for (const operation of operations) {
        assert.deepEqual(operation(), {
          status: "unavailable",
          reason: "management_operation_rejected",
        });
        names.forEach((name, index) => {
          assert.deepEqual(
            fs.readFileSync(path.join(f.directory, name)),
            before[index],
          );
        });
        assert.deepEqual(fs.readdirSync(f.directory).sort(), [...names].sort());
      }
    }
    assert.equal(generated, 0);
    assert.equal(removed, 0);
  } finally {
    crypto.randomUUID = originalUUID;
    fs.rmSync = originalRemove;
  }
});

/**
 * 現在許可集合から実本文を一回読み中立Sourceへ搬送する。
 * @responsibility 管理改訂と本文版を分離し、許可外RootをReaderへ渡さない。
 * @trace RFD-IT-019
 * @precondition 公開済み一Repositoryと管理者の空内容範囲。
 * @stimulus 各Roleの現在集合を取得して固定本文を読み集約し、本文欠測も観測する。
 * @observation Reader対象open回数、4項目Source、本文版、Portfolio、固定取得不能結果。
 * @oracle developerだけ対象本文一回、administrator空集合は本文0。本文不明は版なしでnull／missingを作らない。
 * @cleanup Hook復元と既存Fixtureによる自己生成Root不存在確認。
 * @boundary AM実認可→Domain実本文Reader→Source→Portfolio。本番Surfaceの完成は対象外。
 */
test("許可集合の実本文と本文版を中立Sourceへ渡す", (t) => {
  const f = contentFixture(t),
    target = path.join(f.target.directory, "PROJECT_CONTEXT.md");
  const open = fs.openSync;
  let opened = 0;
  t.after(() => {
    fs.openSync = open;
  });
  fs.openSync = (file, flags, mode) => {
    if (String(file) === target) opened++;
    return open(file, flags, mode);
  };
  try {
    for (const role of ["developer", "administrator"] as const) {
      opened = 0;
      const collection = resolveRepositoryAccessCollection(
        f.root,
        f.tokens[role],
      );
      assert.equal(collection.status, "completed");
      if (collection.status !== "completed")
        throw new Error("collection unavailable");
      const sources: ProjectContextSource[] = [];
      for (const repository of collection.repositories) {
        const read = readRepositoryProjectContext(
          repository.root,
          repository.manifest,
        );
        assert.equal(read.status, "completed");
        if (read.status !== "completed") throw new Error("context unavailable");
        sources.push(
          Object.freeze({
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            state: "complete",
            revision: read.revision,
            context: read.context,
          }),
        );
      }
      const portfolio = createPortfolioProjection(sources);
      assert.equal(opened, role === "developer" ? 1 : 0);
      if (role === "developer") {
        assert.deepEqual(Object.keys(sources[0] ?? {}).sort(), [
          "context",
          "projectId",
          "repositoryId",
          "revision",
          "state",
        ]);
        assert.equal(portfolio.projects[0]?.state, "complete");
        assert.equal(
          portfolio.projects[0]?.sources[0]?.revision,
          `context-text-sha256:${createHash("sha256").update(f.target.context, "utf8").digest("hex")}`,
        );
        assert.notEqual(
          sources[0]?.revision,
          String(collection.managementRevision),
        );
      } else assert.deepEqual(portfolio.projects, []);
    }
    fs.rmSync(target);
    const collection = resolveRepositoryAccessCollection(
      f.root,
      f.tokens.developer,
    );
    assert.equal(collection.status, "completed");
    if (collection.status !== "completed")
      throw new Error("collection unavailable");
    const repository = collection.repositories[0];
    assert.ok(repository);
    const read = readRepositoryProjectContext(
      repository.root,
      repository.manifest,
    );
    assert.deepEqual(read, {
      status: "unavailable",
      reason: "project_context_observation_unavailable",
    });
    assert.equal(Object.hasOwn(read, "revision"), false);
    assert.equal(Object.hasOwn(read, "context"), false);
  } finally {
    fs.openSync = open;
  }
});

/**
 * 集合取得の拒否・清掃・対象観測・解放不明を区別する。
 * @responsibility 未認証観測と失敗時の部分集合公開を防ぐ。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition 公開済みRepositoryとcredential_storedの有効資格を持つ自己生成Root。
 * @stimulus 初回未完了の有効資格で集合を要求し、不正資格・pending・manifest欠測・解放失敗も注入する。
 * @observation 初回stage、current／pending／replace完全byte・Directory一覧、対象観測数、再入場結果。
 * @oracle 初回未完了は材料処置前に固定拒否・能力0。拒否・清掃不明は対象観測0、対象・解放不明は集合非返却。
 * @cleanup Hookを復元し、既存Fixtureが全自己生成Rootを削除する。
 * @boundary 現在認証・保存Lock・対象Filesystem。
 */
test("許可集合の不明は空成功や部分成功へ変換しない", (t) => {
  const f = contentFixture(t),
    pending = path.join(f.directory, "access-management.pending.json");
  const initial = fixture(t);
  const issued = createInitialCredential(
    initial.root,
    prepareInitialUser(initial),
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("initial credential unavailable");
  assert.equal(
    authenticateCredential(initial.root, issued.value.token).status,
    "completed",
  );
  const initialCurrent = path.join(initial.directory, "access-management.json");
  assert.equal(
    JSON.parse(fs.readFileSync(initialCurrent, "utf8")).initialization.stage,
    "credential_stored",
  );
  const initialPending = path.join(
    initial.directory,
    "access-management.pending.json",
  );
  const initialReplace = path.join(
    initial.directory,
    "access-management.replace.json",
  );
  fs.writeFileSync(initialPending, "{");
  fs.writeFileSync(initialReplace, "untrusted replacement");
  const initialFiles = [initialCurrent, initialPending, initialReplace];
  const initialBytes = initialFiles.map((file) => fs.readFileSync(file));
  const initialNames = fs.readdirSync(initial.directory);
  fs.writeFileSync(pending, "{");
  const lstat = fs.lstatSync;
  let observed = 0;
  t.after(() => {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
  });
  Object.defineProperty(fs, "lstatSync", {
    value: (target: fs.PathLike, options?: never) => {
      if (String(target).startsWith(f.target.directory)) observed++;
      return lstat(target, options);
    },
  });
  try {
    assert.deepEqual(
      resolveRepositoryAccessCollection(initial.root, issued.value.token),
      { status: "unavailable", reason: "repository_access_rejected" },
    );
    assert.equal(observed, 0);
    assert.deepEqual(
      initialFiles.map((file) => fs.readFileSync(file)),
      initialBytes,
    );
    assert.deepEqual(fs.readdirSync(initial.directory), initialNames);
    for (const token of ["invalid", createCredentialMaterial().token])
      assert.deepEqual(resolveRepositoryAccessCollection(f.root, token), {
        status: "unavailable",
        reason: "repository_access_rejected",
      });
    assert.equal(observed, 0);
    assert.equal(fs.readFileSync(pending, "utf8"), "{");
    assert.deepEqual(
      resolveRepositoryAccessCollection(f.root, f.tokens.developer),
      { status: "unavailable", reason: "repository_access_cleanup_pending" },
    );
    assert.equal(observed, 0);
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
  }
  fs.rmSync(pending);
  const manifest = fs.readFileSync(f.target.manifestPath);
  fs.rmSync(f.target.manifestPath);
  assert.deepEqual(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer),
    { status: "unavailable", reason: "repository_access_observation_unknown" },
  );
  fs.writeFileSync(f.target.manifestPath, manifest);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected private detail");
    return remove(target, options);
  };
  try {
    assert.deepEqual(
      resolveRepositoryAccessCollection(f.root, f.tokens.developer),
      { status: "unavailable", reason: "repository_access_release_unknown" },
    );
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer).status,
    "completed",
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.lock")),
    false,
  );
});

/**
 * 現在内容認可と実体検証を同要求へ相関する。
 * @responsibility 管理能力と内容許可を分離し、次要求の再認可を確認する。
 * @trace RFD-IT-013
 * @precondition 公開済み自己生成Repositoryと三Role資格。
 * @stimulus 三Roleの取得、Context削除、公開解除後の次取得を行う。
 * @observation 内部結果の改訂・Binding・manifest・Rootと対象外不変。
 * @oracle developer／managerだけ成功、Context欠測でもRoot解決成功、公開解除後は拒否。
 * @cleanup 既存Fixtureが全自己生成Rootを削除する。
 * @boundary 現在資格→Role内容→Exposure→VC／Domain実体観測。
 */
test("内容認可と実Rootを相関し次要求で公開解除を反映", (t) => {
  const f = contentFixture(t),
    id = f.target.manifest.repositoryId;
  for (const role of ["developer", "manager"] as const) {
    const result = resolveRepositoryAccess(
      f.root,
      f.tokens[role],
      id,
      "development",
    );
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    assert.equal(result.access.revision, 3);
    assert.equal(result.access.repositoryId, id);
    assert.equal(result.access.workspaceId, "development");
    assert.deepEqual(result.access.manifest, f.target.manifest);
    assert.ok(result.access.bindingId.startsWith("binding-"));
    assert.ok(Object.isFrozen(result.access));
    assert.ok(Object.isFrozen(result.access.manifest));
    assert.deepEqual(Object.keys(result.access.root), ["contract"]);
  }
  assert.deepEqual(
    resolveRepositoryAccess(f.root, f.tokens.administrator, id, "development"),
    { status: "unavailable", reason: "repository_access_rejected" },
  );
  fs.rmSync(path.join(f.target.directory, "PROJECT_CONTEXT.md"));
  assert.equal(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development")
      .status,
    "completed",
  );
  assert.equal(
    updateExposure(f.root, f.tokens.manager, 3, crypto.randomUUID(), id, [])
      .status,
    "completed",
  );
  assert.deepEqual(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development"),
    { status: "unavailable", reason: "repository_access_rejected" },
  );
});

/**
 * 実体不成立とLock解放不明で能力を返さない。
 * @responsibility 登録時の成功やRoot観測だけを現在完了へ流用しない。
 * @trace RFD-IT-013
 * @precondition 公開済み自己生成Repository。
 * @stimulus manifest欠測・不正・ID差・容量超過・Git消失と解放失敗を注入する。
 * @observation 固定結果、内部値非返却、復元後成功とLock不存在。
 * @oracle 各不成立はobservation_unknown、解放不明はrelease_unknown、Path／例外なし。
 * @cleanup 差替えを復元しFixtureが全Rootを削除する。
 * @boundary AM実体検証と既存Lock終了。
 */
test("内容実体不成立と解放不明は能力非返却", (t) => {
  const f = contentFixture(t),
    id = f.target.manifest.repositoryId;
  /**
   * 固定した対象と資格で内容解決を繰り返す。
   * @responsibility 故障点以外の入力を同一に保つ。
   * @trace RFD-IT-013
   * @precondition 自己生成の公開対象とdeveloper資格がある。
   * @stimulus 現在の対象実体を解決する。
   * @observation 公開結果と固定理由。
   * @oracle 実体不明とLock終了不明から能力を返さない。
   * @cleanup 外側fixtureがRootと注入処理を回収する。
   * @boundary 同じAM公開解決入口。
   */
  const request = () =>
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development");
  const expected = {
    status: "unavailable",
    reason: "repository_access_observation_unknown",
  };
  const currentPath = path.join(f.directory, "access-management.json");
  const currentBytes = fs.readFileSync(currentPath);
  const tampered = JSON.parse(currentBytes.toString("utf8"));
  tampered.registeredRepositories[0].bindingId =
    "binding-00000000000000000000000000000000";
  const tamperedBytes = bytes(tampered);
  assert.equal(parseAccessManagementState(tamperedBytes).status, "invalid");
  fs.writeFileSync(currentPath, tamperedBytes);
  const lstat = fs.lstatSync;
  let targetObservations = 0;
  /**
   * 破損管理状態で対象Rootの観測が始まらないことを計測する。
   * @responsibility 元lstatを維持し対象呼出しだけを数える。
   * @trace RFD-IT-013
   * @precondition 元関数と自己生成対象Directoryを保持する。
   * @stimulus AMの実体観測要求。
   * @observation 対象Directoryへの呼出し数。
   * @oracle 管理状態不正なら対象観測0、破損状態を変更しない。
   * @cleanup finallyで元関数と管理状態を復元する。
   * @boundary 観測用差替えだけ。元Filesystem結果を変更しない。
   */
  const observe: typeof fs.lstatSync = ((target, ...args) => {
    if (String(target).startsWith(f.target.directory)) targetObservations++;
    return lstat(target, ...args);
  }) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", { value: observe });
  try {
    assert.deepEqual(request(), expected);
    assert.equal(targetObservations, 0);
    assert.ok(fs.readFileSync(currentPath).equals(tamperedBytes));
    assert.equal(
      fs.existsSync(path.join(f.directory, "access-management.pending.json")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(f.directory, "access-management.replace.json")),
      false,
    );
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
    fs.writeFileSync(currentPath, currentBytes);
  }
  const original = fs.readFileSync(f.target.manifestPath);
  fs.rmSync(f.target.manifestPath);
  assert.deepEqual(request(), expected);
  for (const content of [
    "{",
    JSON.stringify({ ...f.target.manifest, repositoryId: "other.repository" }),
    " ".repeat(1_048_577),
  ]) {
    fs.writeFileSync(f.target.manifestPath, content);
    assert.deepEqual(request(), expected);
  }
  fs.writeFileSync(f.target.manifestPath, original);
  const git = path.join(f.target.directory, ".git"),
    backup = path.join(f.target.directory, "git-backup");
  fs.renameSync(git, backup);
  assert.deepEqual(request(), expected);
  fs.renameSync(backup, git);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected secret/path must not escape");
    return remove(target, options);
  };
  assert.deepEqual(request(), {
    status: "unavailable",
    reason: "repository_access_release_unknown",
  });
  fs.rmSync = remove;
  assert.equal(request().status, "completed");
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.lock")),
    false,
  );
});

/**
 * 前操作の清掃と今回出版・解放故障を分離する。
 * @responsibility 相関誤帰属と保存済みEffectの喪失を拒否する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 先行pending、登録UUID衝突、rename故障、出版後pending／Lock削除故障を作る。
 * @observation 操作相関・改訂・publication・current・材料・生成件数。
 * @oracle 先行清掃で今回更新0、生成再試行0、出版後故障はconfirmed保持・未完了。
 * @cleanup 注入を復元し既存入口で材料回収後、FixtureがRoot不存在を確認する。
 * @boundary 公開管理API・Node Filesystem故障・既存Lock。
 */
test("通常管理は先行材料と今回出版・清掃不明を分離する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const administrator = f.state.users[0];
  assert.ok(administrator);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000091";
  prepare(f, next);
  assert.deepEqual(
    updateUserName(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      administrator.userId,
      "更新",
    ),
    {
      status: "unavailable",
      reason: "management_operation_unavailable",
      primaryFailure: "state_store_previous_pending_settled",
      operationId,
      expectedRevision: 1,
      observedRevision: 1,
      publication: "not_attempted",
      cleanupConfirmed: true,
    },
  );
  assert.deepEqual(fs.readFileSync(currentPath), bytes(f.state));
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  const originalUUID = crypto.randomUUID;
  let generated = 0;
  crypto.randomUUID = () => {
    generated++;
    return administrator.userId as `${string}-${string}-${string}-${string}-${string}`;
  };
  try {
    const collision = registerUser(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      "衝突",
      "developer",
    );
    assert.equal(collision.status, "unavailable");
    if (
      collision.status === "unavailable" &&
      collision.reason === "management_operation_unavailable"
    ) {
      assert.equal(collision.publication, "not_attempted");
      assert.equal(collision.cleanupConfirmed, true);
    } else assert.fail("認可後生成故障が欠落した");
    assert.equal(generated, 1);
  } finally {
    crypto.randomUUID = originalUUID;
  }
  const originalRename = fs.renameSync;
  fs.renameSync = () => {
    throw new Error("injected");
  };
  try {
    const failed = updateUserName(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      administrator.userId,
      "更新",
    );
    assert.equal(failed.status, "unavailable");
    if (
      failed.status === "unavailable" &&
      failed.reason === "management_operation_unavailable"
    ) {
      assert.equal(failed.publication, "unconfirmed");
      assert.equal(failed.primaryFailure, "state_store_publish_failed");
    } else assert.fail("出版故障が欠落した");
    assert.deepEqual(fs.readFileSync(currentPath), bytes(f.state));
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(readAccessManagementState(f.root).status, "completed");
  const originalRm = fs.rmSync;
  for (const suffix of [
    "access-management.pending.json",
    "access-management.lock",
  ]) {
    fs.writeFileSync(currentPath, bytes(f.state));
    fs.rmSync = (target, options) => {
      if (String(target).endsWith(suffix)) throw new Error("injected");
      return originalRm(target, options);
    };
    try {
      const failed = updateUserName(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        administrator.userId,
        "保存済み",
      );
      assert.equal(failed.status, "unavailable");
      if (
        failed.status === "unavailable" &&
        failed.reason === "management_operation_unavailable"
      ) {
        assert.equal(failed.publication, "confirmed");
        assert.equal(failed.observedRevision, 2);
        assert.equal(failed.cleanupConfirmed, false);
        assert.equal("lockRecoveryId" in failed, false);
      } else assert.fail("既知出版が欠落した");
      assert.equal(
        (
          JSON.parse(
            fs.readFileSync(currentPath, "utf8"),
          ) as AccessManagementState
        ).users[0]?.username,
        "保存済み",
      );
    } finally {
      fs.rmSync = originalRm;
    }
    assert.equal(readAccessManagementState(f.root).status, "completed");
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 通常更新と改訂競合を確認する。
 * @responsibility 現在値とcallback、出版、清掃を実境界で照合する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 名前変更を保存し、旧期待改訂で再要求する。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 一回だけ出版・読戻しし、競合時callback0・短命材料0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("通常保存・読戻し・改訂競合", (t) => {
  const f = fixture(t);
  const result = updateAccessManagementState(f.root, 1, (current) => {
    assert.equal(current.users[0]?.username, "模擬管理者");
    current.revision++;
    current.operationId = "00000000-0000-4000-8000-000000000004";
    const user = current.users[0];
    assert.ok(user);
    user.username = "更新後";
    return bytes(current);
  });
  assert.equal(result.status, "completed");
  assert.equal(result.publication, "confirmed");
  const read = readAccessManagementState(f.root);
  assert.equal(read.status, "completed");
  if (read.status !== "completed") return;
  assert.equal(read.value.users[0]?.username, "更新後");
  let called = 0;
  const conflict = updateAccessManagementState(f.root, 1, () => {
    called++;
    return Buffer.alloc(0);
  });
  assert.equal(conflict.status, "unavailable");
  assert.equal(called, 0);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 不正候補と対象外の鍵変更を拒否する。
 * @responsibility 検査前の準備File作成を防ぐ。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 巨大bytes、改訂再利用、初回事実・資格・未解決交換・既存User IDの変更を返す。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle current不変・pending/replace不存在。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("不正候補・容量超過・対象外変更は出版しない", (t) => {
  const f = fixture(t);
  f.state.users.push({
    userId: "00000000-0000-4000-8000-000000000009",
    username: "模擬開発者",
    role: "developer",
  });
  const administrator = f.state.users[0];
  assert.ok(administrator);
  f.state.credentials.push({
    credentialId: "0123456789abcdef01234567",
    userId: administrator.userId,
    tokenVersion: 1,
    tokenSalt: "a".repeat(32),
    tokenVerifier: "b".repeat(64),
    revoked: false,
    operationId: f.state.initialization.attemptId,
    presentation: "confirmed",
  });
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const before = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
  );
  const bad = structuredClone(f.state);
  bad.revision = 2;
  bad.operationId = "00000000-0000-4000-8000-000000000005";
  bad.initialization = {
    stage: "correlated",
    attemptId: bad.initialization.attemptId,
  };
  const credential = structuredClone(f.state);
  credential.revision = 2;
  credential.operationId = bad.operationId;
  const changedCredential = credential.credentials[0];
  const originalCredential = f.state.credentials[0];
  assert.ok(changedCredential && originalCredential);
  changedCredential.tokenVerifier = "c".repeat(64);
  const exchange = structuredClone(credential);
  exchange.credentials = structuredClone(f.state.credentials);
  exchange.unresolvedKeyExchanges = [
    {
      stage: "prepared",
      recoveryId: `access-management.key-exchange.${bad.operationId}`,
      operationId: bad.operationId,
      entry: "host",
      scope: "targeted",
      recipientUserId: administrator.userId,
      oldCredentialIds: [originalCredential.credentialId],
    },
  ];
  const removedUser = structuredClone(credential);
  removedUser.credentials = structuredClone(f.state.credentials);
  removedUser.users.pop();
  for (const protectedChange of [credential, exchange, removedUser]) {
    assert.equal(
      parseAccessManagementState(bytes(protectedChange)).status,
      "parsed",
    );
  }
  for (const candidate of [
    Buffer.alloc(16_777_217),
    bytes(f.state),
    bytes(bad),
    bytes(credential),
    bytes(exchange),
    bytes(removedUser),
  ]) {
    assert.equal(
      updateAccessManagementState(f.root, 1, () => candidate).status,
      "unavailable",
    );
    assert.ok(
      fs
        .readFileSync(path.join(f.directory, "access-management.json"))
        .equals(before),
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 未出版材料の再入場を確認する。
 * @responsibility 通常更新だけを破棄し、新更新を同時に実行しない。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus base一致pendingとreplaceから更新入口へ入る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 旧材料だけ回収・current不変・新callback0・元結果不明。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("base一致は通常材料だけ整理して新更新しない", (t) => {
  const f = fixture(t);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000006";
  prepare(f, next);
  let called = 0;
  const result = updateAccessManagementState(f.root, 1, () => {
    called++;
    return bytes(next);
  });
  assert.equal(result.status, "unavailable");
  assert.equal(called, 0);
  assert.equal(result.publication, "not_attempted");
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(f.state)),
  );
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  prepare(f, next, "credential", false);
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  assert.ok(
    fs.existsSync(path.join(f.directory, "access-management.pending.json")),
  );
});

/**
 * 出版済み材料の再入場を確認する。
 * @responsibility 保存済み事実と清掃を別に確認する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus current=nextでpendingを残し読み直す。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle confirmed出版を保持・短命材料だけ回収・改訂再出版0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("next一致は既知出版を保持して清掃する", (t) => {
  const f = fixture(t);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000007";
  prepare(f, next, "credential", false);
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(next),
  );
  const result = readAccessManagementState(f.root);
  assert.equal(result.status, "completed");
  assert.equal(result.publication, "confirmed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(next)),
  );
});

/**
 * 破損・孤立材料・current欠測を停止する。
 * @responsibility 名前だけの清掃と未初期化推定を拒否する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus partial pending、partial replace、孤立replace、破損currentを順に用意する。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 不明材料は保持し、修復・出版・追加作成0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("partial・孤立replace・current欠測を保持停止", (t) => {
  const f = fixture(t);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000008";
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{");
  let called = 0;
  const partial = updateAccessManagementState(f.root, 1, () => {
    called++;
    return bytes(next);
  });
  assert.equal(partial.status, "unavailable");
  assert.equal(partial.publication, "not_attempted");
  assert.equal(called, 0);
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(f.state)),
  );
  assert.deepEqual(fs.readdirSync(f.directory).sort(), [
    "access-management.json",
    "access-management.pending.json",
  ]);
  fs.rmSync(pending);
  prepare(f, next);
  const replacement = path.join(f.directory, "access-management.replace.json");
  fs.writeFileSync(replacement, "{");
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  assert.equal(fs.readFileSync(replacement, "utf8"), "{");
  fs.rmSync(path.join(f.directory, "access-management.pending.json"));
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  fs.rmSync(path.join(f.directory, "access-management.json"));
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  assert.ok(fs.existsSync(replacement));
});

/**
 * 出版要求失敗と後続清掃失敗を区別する。
 * @responsibility 失敗後のcurrentと既知出版を直接観測する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus rename失敗、出版後pending削除失敗を注入する。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 前者current不変、後者confirmed出版保持・未完了。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("rename失敗と出版後清掃失敗の事実を保持", (t) => {
  const f = fixture(t);
  const originalRename = fs.renameSync;
  const originalRemove = fs.rmSync;
  t.after(() => {
    fs.renameSync = originalRename;
    fs.rmSync = originalRemove;
  });
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000009";
  fs.renameSync = () => {
    throw new Error("injected");
  };
  const failed = updateAccessManagementState(f.root, 1, () => bytes(next));
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "unconfirmed");
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(f.state)),
  );
  fs.renameSync = originalRename;
  assert.equal(readAccessManagementState(f.root).status, "completed");
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return originalRemove(target, options);
  };
  const cleanup = updateAccessManagementState(f.root, 1, () => bytes(next));
  assert.equal(cleanup.status, "unavailable");
  assert.equal(cleanup.publication, "confirmed");
  assert.equal(cleanup.revision, 2);
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(next)),
  );
  fs.rmSync = originalRemove;
  assert.equal(readAccessManagementState(f.root).status, "completed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 保存途中の子Process喪失から新Processで再入場する。
 * @responsibility 実Process終了・残存Lockのexact回収・base/nextの処置を接続する。
 * @trace RFD-IT-021
 * @precondition Repository-localな模擬状態と実子Processだけを使用する。
 * @stimulus pending flush後、replace flush後、rename後でexit(23)する。
 * @observation 終了code、残存材料、次読取りの改訂と清掃を確認する。
 * @oracle 前二者は改訂1のまま、後者は改訂2を保持。自動再出版0、子Processはjoin済み。
 * @cleanup 自己生成Rootと所有材料を削除し不存在を確認する。
 * @boundary Node子Process・Filesystem・既存Lockの直接保存境界。
 */
test("実子Process喪失後にbase/nextとLockを再観測する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/storage/store.ts", import.meta.url)
      .href;
    const script = `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { updateAccessManagementState } from ${JSON.stringify(storeUrl)};
      let flushes = 0;
      const flush = fs.fsyncSync;
      fs.fsyncSync = fd => {
        flush(fd); flushes++;
        if ((${JSON.stringify(phase)} === "pending" && flushes === 2) ||
            (${JSON.stringify(phase)} === "replace" && flushes === 3)) process.exit(23);
      };
      const rename = fs.renameSync;
      fs.renameSync = (a,b) => { rename(a,b); if (${JSON.stringify(phase)} === "renamed") process.exit(23); };
      const root = createFilesystemStoreRoot(${JSON.stringify(f.directory)});
      updateAccessManagementState(root, 1, current => {
        current.revision = 2;
        current.operationId = "00000000-0000-4000-8000-000000000010";
        return Buffer.from(JSON.stringify(current));
      });
    `;
    const child = spawnSync(process.execPath, ["--eval", script], {
      timeout: 10_000,
      encoding: "utf8",
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const result = readAccessManagementState(f.root);
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    assert.equal(result.value.revision, phase === "renamed" ? 2 : 1);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 主失敗と後続のLock解放不明を分ける。
 * @responsibility 候補拒否をcleanup結果で上書きせずexact回収参照を保持する。
 * @trace RFD-IT-021
 * @precondition 自己生成Rootと不正候補を使用する。
 * @stimulus 候補拒否後のLock削除を失敗させ、復元後同じRootを読み直す。
 * @observation primary reason、secondary reason、回復参照、現状態を確認する。
 * @oracle 候補不正を保持・出版0・解放未確認。復元後既存exact回収で正常読取りできる。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary AM保存結果と既存Lock回収の直接境界。
 */
test("主失敗をLock清掃失敗で上書きしない", (t) => {
  const f = fixture(t);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  const result = updateAccessManagementState(f.root, 1, () =>
    Buffer.from("{}"),
  );
  fs.rmSync = remove;
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.reason, "state_store_candidate_invalid");
  assert.equal(result.publication, "not_attempted");
  assert.equal(result.cleanupConfirmed, false);
  assert.ok(result.lockRecoveryId?.startsWith("filesystem-store-lock."));
  assert.equal(
    result.secondaryReason,
    "filesystem_store_lock_operation_completed_cleanup_unknown",
  );
  assert.equal(readAccessManagementState(f.root).status, "completed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 非管理者と対象不一致の鍵変更をEffect前に拒否する。
 * @responsibility 拒否で資格生成・失効・保存が行われないことを観測する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 三Roleの試験専用資格と自己生成Root。
 * @stimulus 非管理者、未知User、改訂差、User／資格結合差を渡す。
 * @observation randomBytes回数、state byteと固定非開示結果。
 * @oracle 生成乱数0・新資格0・新失効0・state不変。
 * @cleanup 乱数差替えをfinally復元しFixtureがRootを回収する。
 * @boundary 同Lock現在認可とexact対象。
 */
test("通常鍵変更の非管理者・対象差・改訂差は生成と保存0", (t) => {
  for (const role of ["developer", "manager", "administrator"] as const) {
    const f = fixture(t);
    const actor = createCredentialMaterial();
    const user = f.state.users[0];
    assert.ok(user);
    user.role = role;
    f.state.credentials.push({
      credentialId: actor.credentialId,
      userId: user.userId,
      tokenVersion: 1,
      tokenSalt: actor.tokenSalt,
      tokenVerifier: actor.tokenVerifier,
      revoked: false,
      operationId: "00000000-0000-4000-8000-000000000007",
      presentation: "confirmed",
    });
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    let calls = 0;
    crypto.randomBytes = (() => {
      calls++;
      throw new Error("unexpected_generation");
    }) as typeof crypto.randomBytes;
    try {
      const target =
        role === "administrator"
          ? "00000000-0000-4000-8000-000000000999"
          : user.userId;
      assert.equal(
        issueCredential(
          f.root,
          actor.token,
          1,
          "00000000-0000-4000-8000-000000000008",
          target,
        ).status,
        "unavailable",
      );
      assert.equal(
        revokeCredential(
          f.root,
          actor.token,
          1,
          "00000000-0000-4000-8000-000000000009",
          target,
          actor.credentialId,
        ).status,
        "unavailable",
      );
      assert.equal(
        issueCredential(
          f.root,
          actor.token,
          2,
          "00000000-0000-4000-8000-000000000010",
          user.userId,
        ).status,
        "unavailable",
      );
      assert.equal(calls, 0);
    } finally {
      crypto.randomBytes = random;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 二Processの鍵変更を同じ期待改訂で競合させる。
 * @responsibility 既存Lockだけで一採用と対象外資格保持を確認する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 試験専用Bearerと自己生成Root、通常資格三件。
 * @stimulus 発行／発行、発行／失効、失効／失効を同時開始する。
 * @observation 子Process終了、閉じた非秘密結果、採用改訂・資格集合。
 * @oracle 一採用だけ、敗者の生成0・追加失効0、対象外不変。
 * @cleanup 全子ProcessをcloseまでjoinしてFixture回収。
 * @boundary 実Node Processと同じFilesystem Lock。
 */
test("通常鍵変更の二Process競合は一採用だけに閉じる", async (t) => {
  for (const operations of [
    ["issue", "issue"],
    ["issue", "revoke"],
    ["revoke", "revoke"],
  ] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[1]?.userId;
    const credentialId = f.state.credentials[1]?.credentialId;
    assert.ok(userId && credentialId);
    const worker = path.resolve(
      import.meta.dirname,
      "../../fixtures/credential-management-worker.ts",
    );
    const joined = await Promise.allSettled(
      operations.map(
        (operation, index) =>
          new Promise<{ status: string; generated: number }>(
            (resolve, reject) => {
              const child = spawn(process.execPath, [worker], {
                timeout: 10000,
              });
              let output = "";
              let childFailed = false;
              let inputFailed = false;
              child.stdout.on("data", (chunk) => {
                output += String(chunk);
              });
              child.stderr.resume();
              child.on("error", () => {
                childFailed = true;
              });
              child.stdin.on("error", () => {
                inputFailed = true;
              });
              child.stdin.end(
                JSON.stringify({
                  directory: f.directory,
                  token: f.tokens.administrator,
                  operationId: `00000000-0000-4000-8000-00000000009${index}`,
                  userId,
                  credentialId,
                  operation,
                }),
              );
              child.on("close", (code, signal) => {
                if (code !== 0 || childFailed || inputFailed)
                  reject(new Error(`child_failed:${code}:${signal}`));
                else {
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error("child_result_invalid"));
                  }
                }
              });
            },
          ),
      ),
    );
    const results = joined.map((result) => {
      assert.equal(
        result.status,
        "fulfilled",
        result.status === "rejected" && result.reason instanceof Error
          ? result.reason.message
          : "child_join",
      );
      if (result.status !== "fulfilled") throw new Error("child_failed");
      return result.value;
    });
    assert.equal(
      results.filter((result) => result.status === "completed").length,
      1,
      JSON.stringify(results),
    );
    for (const result of results)
      if (result.status !== "completed") assert.equal(result.generated, 0);
    const saved = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.revision, 2);
    assert.deepEqual(saved.credentials[0], f.state.credentials[0]);
    assert.deepEqual(saved.credentials[2], f.state.credentials[2]);
    assert.equal(
      saved.credentials.length + Number(saved.credentials[1]?.revoked),
      4,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 公開結果型の操作別Secret境界を固定する。
 * @responsibility 型検査の拒否と実行時の資格処置を混同しない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 型検査を含む正式Package試験入口。
 * @stimulus 正しい二結果と、発行の鍵欠落／失効の鍵混入を型へ代入する。
 * @observation 型検査の期待エラーとメモリ値のown-token。
 * @oracle issueはtoken必須、revokeはtoken禁止。保存／提示は本Caseでは検証しない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Package公開Typeの補助契約。IT全体成立ではない。
 */
test("通常鍵結果型は操作別のSecret必須と禁止を区別する", () => {
  const common = {
    status: "completed" as const,
    operationId: "00000000-0000-4000-8000-000000000090",
    expectedRevision: 1,
    revision: 2,
    userId: "00000000-0000-4000-8000-000000000003",
    credentialId: "f".repeat(24),
    publication: "confirmed" as const,
    cleanupConfirmed: true as const,
  };
  const issued: CredentialManagementResult = {
    ...common,
    operation: "issueCredential",
    token: "synthetic-type-value",
  };
  const revoked: CredentialManagementResult = {
    ...common,
    operation: "revokeCredential",
  };
  // @ts-expect-error 発行成功には短命tokenが必須。
  const missing: CredentialManagementResult = {
    ...common,
    operation: "issueCredential",
  };
  const excessive: CredentialManagementResult = {
    ...common,
    operation: "revokeCredential",
    // @ts-expect-error 独立失効の結果へtokenを混入できない。
    token: "synthetic-type-value",
  };
  assert.equal(Object.hasOwn(issued, "token"), true);
  assert.equal(Object.hasOwn(revoked, "token"), false);
  assert.equal(Object.hasOwn(missing, "token"), false);
  assert.equal(Object.hasOwn(excessive, "token"), true);
});
