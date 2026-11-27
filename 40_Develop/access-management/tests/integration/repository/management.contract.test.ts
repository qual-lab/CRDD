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
import { parseRepositoryProjectContextMarkdown } from "@qual-lab/crdd-document-model";
import { readCurrentAccessState } from "../../../src/authorization/current.ts";
import {
  readHostedAccessCandidates,
  resolveHostedAccessCollection,
  resolveHostedAccessDirectories,
} from "../../../src/index.ts";
import {
  saveRepositoryRegistration,
  saveRepositoryRemoval,
} from "../../../src/repository/register.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import {
  readAccessManagementState,
  readCurrent,
} from "../../../src/storage/store.ts";
import {
  bytes,
  attachHostedContentFixture,
  contentFixture,
  hostedContentFixture,
  managementFixture,
  observeFixtureDirectory,
  prepare,
  saveUserRegistrationFixture,
  repositoryFixture,
} from "../storage/fixture.ts";

/** 連携登録は旧公開範囲・ロールの内容範囲とは別に照合する。 @trace RFD-IT-013 */
test("Gitホスト結合の確定は現在の本人と登録だけを照合し旧内容範囲を返さない", (t) => {
  const f = contentFixture(t);
  const state = readCurrent(f.root).state;
  const user = state.users.find(({ role }) => role === "developer");
  const registration = state.registeredRepositories[0];
  assert.ok(user && registration);
  const bindingId = crypto.randomUUID();
  const link = {
    issuer: "https://accounts.google.com",
    subject: "synthetic-developer",
    bindingId,
  };
  user.accountLinks = [link];
  delete registration.hostedRepository;
  const filename = path.join(f.directory, "access-management.json");
  const save = () => fs.writeFileSync(filename, bytes(state));
  save();
  const principal = {
    kind: "account" as const,
    userId: user.userId,
    bindingId,
    expiresAt: Date.now() + 60_000,
  };
  const unlinked = readHostedAccessCandidates(f.root, principal);
  assert.equal(unlinked.status, "current");
  if (unlinked.status !== "current") assert.fail("missing valid principal");
  assert.deepEqual(unlinked.candidates, []);

  registration.hostedRepository = {
    host: "github.com",
    provider: "github",
    providerData: { installationId: "24" },
    repositoryId: "92",
  };
  state.revision++;
  save();
  const read = readHostedAccessCandidates(f.root, principal);
  assert.equal(read.status, "current");
  if (read.status !== "current") assert.fail("missing valid principal");
  assert.deepEqual(read.candidates, [
    {
      repositoryId: registration.repositoryId,
      bindingId: registration.bindingId,
      hostedRepository: registration.hostedRepository,
    },
  ]);
  assert.equal(
    Object.isFrozen(read.candidates[0]?.hostedRepository.providerData),
    true,
  );
  const { host, repositoryId } = registration.hostedRepository;
  const legacy = {
    ...state,
    registeredRepositories: state.registeredRepositories.map((item) =>
      item === registration
        ? {
            ...item,
            hostedRepository: { host, repositoryId, installationId: "24" },
          }
        : item,
    ),
  };
  assert.equal(parseAccessManagementState(bytes(legacy)).status, "invalid");
  const checked = {
    managementRevision: read.managementRevision,
    candidates: read.candidates,
    allowUnrelatedRevision: true as const,
  };
  assert.deepEqual(resolveHostedAccessDirectories(f.root, principal, checked), [
    {
      repositoryId: registration.repositoryId,
      root: registration.repositoryRoot,
    },
  ]);
  const resolved = resolveHostedAccessCollection(f.root, principal, checked);
  assert.equal(resolved.status, "completed");
  if (resolved.status !== "completed")
    assert.fail("missing verified repository");
  assert.equal("workspaceIds" in (resolved.repositories[0] ?? {}), false);

  user.role = "manager";
  state.revision++;
  save();
  assert.equal(
    resolveHostedAccessCollection(f.root, principal, checked).status,
    "completed",
  );
  const previous = registration.hostedRepository;
  for (const changed of [
    { ...previous, repositoryId: "93" },
    { ...previous, provider: "other" },
    { ...previous, providerData: { installationId: "25" } },
  ]) {
    registration.hostedRepository = changed;
    state.revision++;
    save();
    assert.equal(
      resolveHostedAccessDirectories(f.root, principal, checked),
      null,
    );
  }
  link.bindingId = crypto.randomUUID();
  state.revision++;
  save();
  assert.deepEqual(readHostedAccessCandidates(f.root, principal), {
    status: "revoked",
  });
});

/** 許可候補の一部だけを返したり、認可失効後に対象を観測したりしない。 */
test("Gitホスト認可の観測不能は空・部分成功にせず、期限切れと対象差を拒否する", (t) => {
  const f = hostedContentFixture(t);
  const sibling = repositoryFixture(t);
  const siblingId = "repository.sibling";
  fs.writeFileSync(
    sibling.manifestPath,
    JSON.stringify({ ...sibling.manifest, repositoryId: siblingId }),
  );
  fs.writeFileSync(
    path.join(sibling.directory, "PROJECT_CONTEXT.md"),
    sibling.context.replaceAll("repository.fixture", siblingId),
  );
  assert.equal(
    saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      f.state.revision,
      crypto.randomUUID(),
      siblingId,
      sibling.directory,
      observeFixtureDirectory,
    ).status,
    "completed",
  );
  const state = readCurrent(f.root).state;
  const registration = state.registeredRepositories.find(
    (item) => item.repositoryId === siblingId,
  );
  assert.ok(registration);
  registration.hostedRepository = {
    ...f.candidate.hostedRepository,
    repositoryId: "93",
  };
  fs.writeFileSync(f.currentPath, bytes(state));
  const read = readHostedAccessCandidates(f.root, f.principal);
  assert.equal(read.status, "current");
  if (read.status !== "current")
    assert.fail("hosted registration fixture unavailable");
  const checked = {
    managementRevision: read.managementRevision,
    candidates: [...read.candidates].reverse(),
  };
  const resolve = () =>
    resolveHostedAccessCollection(f.root, f.principal, checked);
  const complete = resolve();
  assert.equal(complete.status, "completed");
  if (complete.status !== "completed") assert.fail();
  assert.deepEqual(
    complete.repositories.map((entry) => entry.repositoryId),
    [f.candidate.repositoryId, siblingId],
  );
  const siblingManifest = fs.readFileSync(sibling.manifestPath);
  fs.rmSync(sibling.manifestPath);
  assert.deepEqual(resolve(), {
    status: "unavailable",
    reason: "repository_access_observation_unknown",
  });
  fs.writeFileSync(sibling.manifestPath, siblingManifest);

  const open = fs.openSync;
  let manifestReads = 0;
  const spy = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      if (
        [f.target.manifestPath, sibling.manifestPath].includes(String(args[0]))
      )
        manifestReads++;
      return open(...args);
    },
  );
  try {
    assert.equal(resolve().status, "completed");
    assert.equal(manifestReads, 2);
    manifestReads = 0;
    const expired = { ...f.principal, expiresAt: Date.now() - 1 };
    assert.deepEqual(resolveHostedAccessCollection(f.root, expired, checked), {
      status: "unavailable",
      reason: "repository_access_rejected",
    });
    assert.deepEqual(
      resolveHostedAccessCollection(f.root, f.principal, {
        ...checked,
        candidates: [f.candidate, f.candidate],
      }),
      { status: "unavailable", reason: "repository_access_rejected" },
    );
    const pending = path.join(f.directory, "access-management.pending.json");
    fs.writeFileSync(pending, "unknown-material");
    assert.deepEqual(resolve(), {
      status: "unavailable",
      reason: "repository_access_rejected",
    });
    assert.equal(fs.readFileSync(pending, "utf8"), "unknown-material");
    fs.rmSync(pending);
    assert.equal(manifestReads, 0);
  } finally {
    spy.mock.restore();
  }
  const remove = fs.rmSync;
  const lockedRelease = t.mock.method(
    fs,
    "rmSync",
    (...args: Parameters<typeof remove>) => {
      if (String(args[0]).endsWith("access-management.state.lock"))
        throw new Error("fixture_release_unknown");
      return remove(...args);
    },
  );
  try {
    assert.deepEqual(resolve(), {
      status: "unavailable",
      reason: "repository_access_release_unknown",
    });
  } finally {
    lockedRelease.mock.restore();
  }
});

/**
 * 三Roleの本人表示と内容・公開範囲の交差を確認する。
 * @responsibility 固定管理候補を内容閲覧・現在実行許可へ転用しないことを検証する。
 * @trace RFD-IT-013
 * @precondition 三Role資格と複数登録・公開範囲を自己生成Rootに保存する。
 * @stimulus 各資格で本人読取り後、Role内容範囲を変更して再読取りする。
 * @observation DTO全field、対象制約、凍結状態、current byte。
 * @oracle 本人以外・旧公開範囲・内部Path・資格材料0、改訂一致、保存不変更。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 公開本人読取り→現在認証・保存Lock→非秘密DTO。
 */
test("本人権限は旧公開範囲を投影せず、現在の管理候補を返す", (t) => {
  const f = managementFixture(t);
  for (const id of ["dev", "mgmt", "both", "empty"] as const) {
    const root = path.resolve(f.directory, id);
    const normalized = process.platform === "win32" ? root.toLowerCase() : root;
    f.state.registeredRepositories.push({
      repositoryId: id,
      repositoryRoot: root,
      bindingId: `binding-${createHash("sha256").update(`${id}\n${normalized}`).digest("hex").slice(0, 32)}`,
    });
  }
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, bytes(f.state));
  const before = fs.readFileSync(current);
  for (const role of ["developer", "manager", "administrator"] as const) {
    const result = readCurrentAccessState(f.root, f.principals[role]);
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    const dto = result.snapshot;
    assert.deepEqual(Object.keys(dto).sort(), [
      "managementOperations",
      "revision",
      "user",
    ]);
    assert.equal(dto.user.role, role);
    assert.deepEqual(Object.keys(dto.user).sort(), [
      "role",
      "userId",
      "username",
    ]);
    assert.equal(dto.revision, 2);
    const expected = [];
    if (role !== "developer") {
      const allRoles = ["developer", "manager", "administrator"];
      const editableRoles =
        role === "manager" ? allRoles.slice(0, 2) : allRoles;
      for (const targetRole of editableRoles) {
        expected.push({ operation: "updateUserName", targetRole });
        expected.push({ operation: "registerUser", plannedRole: targetRole });
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
        "manageAiProfiles",
      ])
        expected.push({ operation });
    }
    assert.deepEqual(
      dto.managementOperations.map((item) => JSON.stringify(item)).sort(),
      expected.map((item) => JSON.stringify(item)).sort(),
    );
    if (role === "manager") {
      assert.ok(
        dto.managementOperations.every(
          (item) =>
            item.operation !== "updateUserName" ||
            item.targetRole !== "administrator",
        ),
      );
      assert.ok(
        dto.managementOperations.every(
          (item) =>
            (item.operation !== "updateUserRole" ||
              (item.currentRole !== "administrator" &&
                item.nextRole !== "administrator")) &&
            (item.operation !== "registerUser" ||
              item.plannedRole !== "administrator"),
        ),
      );
    }
    for (const value of [
      dto,
      dto.user,
      dto.managementOperations,
      ...dto.managementOperations,
    ])
      assert.equal(Object.isFrozen(value), true);
  }
  assert.deepEqual(fs.readFileSync(current), before);
  const manager = f.state.users[1];
  assert.ok(manager);
  manager.role = "developer";
  f.state.revision = 3;
  f.state.operationId = crypto.randomUUID();
  fs.writeFileSync(current, bytes(f.state));
  const changed = readCurrentAccessState(f.root, f.principals.manager);
  assert.equal(changed.status, "completed");
  if (changed.status === "completed") {
    assert.equal(changed.snapshot.revision, 3);
    assert.equal(changed.snapshot.user.role, "developer");
    assert.deepEqual(changed.snapshot.managementOperations, []);
  }
});

/**
 * 旧容量上限を超えても通常の登録・保存・再読取りが成立する。
 * @responsibility 容量を異常条件にせず、Schema・改訂・保存手順を維持する。
 * @trace RFD-IT-021
 * @precondition Schema-validな上限直前Snapshotを自己生成Rootに置く。
 * @stimulus 128文字の新User登録を要求する。
 * @observation current byte容量、UUID件数、出版結果と次改訂、材料不存在。
 * @oracle UUID生成1、出版成功、容量を理由に内容を切り捨てない。
 * @cleanup 差替えを復元しFixtureがRoot不存在を確認する。
 * @boundary 公開登録→実保存→再読取り。
 */
test("旧容量上限を超えるUser登録を保存し再読取りできる", (t) => {
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
    const result = saveUserRegistrationFixture(
      f.root,
      f.principals.manager,
      2,
      "00000000-0000-4000-8000-000000000090",
      "x".repeat(128),
      "developer",
    );
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.equal(generated, 1);
    const published = fs.readFileSync(currentPath);
    assert.ok(published.byteLength > 16_777_216);
    const parsed = parseAccessManagementState(published);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") throw Error("published_invalid");
    assert.equal(parsed.state.revision, 3);
    assert.equal(parsed.state.users.at(-1)?.username, "x".repeat(128));
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    crypto.randomUUID = originalUUID;
  }
});

/**
 * 通常登録・明示公開・解除の別責務を確認する。
 * @responsibility managerとadministratorで現在改訂を更新し対象外を保持する。
 * @trace RFD-IT-021
 * @precondition Repository-localな自己生成Storeと内容ディレクトリ。
 * @stimulus 登録→範囲設定→空範囲→対象ディレクトリ不在で解除。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 登録は公開0、解除は両管理情報除去・本文不変。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と内容ディレクトリのFilesystem。
 */
test("Repository登録と公開は独立し旧Root不成立でも解除できる", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const fullContext = fs
    .readFileSync(
      new URL("../../../../../PROJECT_CONTEXT.md", import.meta.url),
      "utf8",
    )
    .replace(
      /^Project ID:.*$/mu,
      `Project ID: \`${target.manifest.projectId}\``,
    )
    .replace(
      /^Repository ID:.*$/mu,
      `Repository ID: \`${target.manifest.repositoryId}\``,
    )
    .replace(
      /^Repository Role:.*$/mu,
      `Repository Role: \`${target.manifest.repositoryRole}\``,
    );
  assert.equal(
    parseRepositoryProjectContextMarkdown(fullContext).status,
    "complete",
  );
  const partialContext = fullContext.replace(/^- \[x\]/mu, "- [ ]");
  const intake = parseRepositoryProjectContextMarkdown(partialContext);
  assert.equal(intake.status, "partial");
  assert.ok(intake.result);
  assert.ok(
    intake.issues.every(
      (issue) => issue.reason === "project-context-projection-contract-invalid",
    ),
  );
  fs.writeFileSync(
    path.join(target.directory, "PROJECT_CONTEXT.md"),
    partialContext,
  );
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
  const original = readCurrent(f.root).bytes;
  let getterCalls = 0;
  for (const providerData of [
    new Map([["installationId", "24"]]),
    { installationId: undefined },
    {
      get installationId() {
        getterCalls++;
        return "24";
      },
    },
  ]) {
    const rejected = saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      2,
      crypto.randomUUID(),
      target.manifest.repositoryId,
      target.directory,
      (directory) => ({
        directory,
        isCurrent: () => true,
        hostedRepository: {
          provider: "github",
          host: "github.com",
          repositoryId: "92",
          providerData: providerData as unknown as Readonly<
            Record<string, string>
          >,
        },
      }),
    );
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.reason, "management_operation_unavailable");
    assert.equal(rejected.publication, "not_attempted");
    assert.deepEqual(readCurrent(f.root).bytes, original);
  }
  assert.equal(getterCalls, 0);
  const registered = saveRepositoryRegistration(
    f.root,
    f.principals.manager,
    2,
    op(90),
    target.manifest.repositoryId,
    target.directory,
    observeFixtureDirectory,
  );
  assert.equal(registered.status, "completed");
  assert.equal(
    fs.readFileSync(path.join(target.directory, "PROJECT_CONTEXT.md"), "utf8"),
    partialContext,
  );
  let current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.equal(current.value.registeredRepositories.length, 1);
  assert.equal(Object.hasOwn(current.value, "exposure"), false);
  assert.deepEqual(current.value.users, before.users);
  assert.deepEqual(current.value.users, before.users);
  const contextBefore = fs.readFileSync(
    path.join(target.directory, "PROJECT_CONTEXT.md"),
  );
  const manifestBefore = fs.readFileSync(target.manifestPath);
  const heldDirectory = `${target.directory}-held`;
  fs.renameSync(target.directory, heldDirectory);
  try {
    assert.equal(
      saveRepositoryRemoval(
        f.root,
        f.principals.manager,
        3,
        op(93),
        target.manifest.repositoryId,
      ).status,
      "completed",
    );
  } finally {
    fs.renameSync(heldDirectory, target.directory);
  }
  current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.deepEqual(current.value.registeredRepositories, []);
  assert.equal(Object.hasOwn(current.value, "exposure"), false);
  assert.deepEqual(current.value.users, before.users);
  assert.deepEqual(current.value.users, before.users);
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
 * @precondition Repository-localな自己生成Storeと内容ディレクトリ。
 * @stimulus 誤鍵・developer・改訂競合・不正ID、正本と表示の不一致を要求する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 認可前は観測0・保存0、認可後Identity不正も保存0。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と内容ディレクトリのFilesystem。
 */
test("登録は認可前にRootを観測せずIdentity差を保存しない", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const originalStat = fs.lstatSync;
  let observed = 0;
  let directoryRequests = 0;
  const observeDirectory = (directory: string) => {
    directoryRequests++;
    return observeFixtureDirectory(directory);
  };
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
      ["invalid" as never, 2, target.manifest.repositoryId],
      [f.principals.developer, 2, target.manifest.repositoryId],
      [f.principals.manager, 3, target.manifest.repositoryId],
      [f.principals.manager, 2, "invalid id"],
    ] as const) {
      assert.deepEqual(
        saveRepositoryRegistration(
          f.root,
          token,
          revision,
          operationId,
          id,
          target.directory,
          observeDirectory,
        ),
        { status: "unavailable", reason: "management_operation_rejected" },
      );
      assert.deepEqual(fs.readFileSync(currentPath), before);
    }
    assert.equal(observed, 0);
    assert.equal(directoryRequests, 0);
    assert.deepEqual(
      saveRepositoryRegistration(
        f.root,
        f.principals.manager,
        2,
        operationId,
        target.manifest.repositoryId,
        `${target.directory}/${"x".repeat(32_769)}`,
        observeDirectory,
      ),
      {
        status: "unavailable",
        reason: "management_operation_rejected",
      },
    );
    assert.equal(observed, 0, "Root長超過はPath観測前に拒否する");
    assert.equal(directoryRequests, 0);
    assert.equal(
      saveRepositoryRegistration(
        f.root,
        f.principals.manager,
        2,
        operationId,
        target.manifest.repositoryId,
        target.directory,
        observeDirectory,
      ).status,
      "completed",
    );
    assert.ok(observed > 0, "観測計測が許可例で発火する");
    assert.equal(directoryRequests, 1);
    fs.writeFileSync(currentPath, before);
  } finally {
    Object.defineProperty(fs, "lstatSync", {
      value: originalStat,
      configurable: true,
      writable: true,
    });
  }
  for (const variant of [
    "id",
    "manifest",
    "context",
    "unavailable",
    "changed",
  ]) {
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
    const result = saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      2,
      operationId,
      variant === "id" ? "other.repository" : target.manifest.repositoryId,
      target.directory,
      (directory) =>
        variant === "unavailable"
          ? null
          : { directory, isCurrent: () => variant !== "changed" },
    );
    assert.equal(result.status, "unavailable");
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 登録固定Fileの旧容量上限撤去とdescriptor解放を確認する。
 * @responsibility 容量と不正内容を区別し、通常の設定増加で登録を拒否しない。
 * @trace RFD-IT-002
 * @precondition 非秘密の自己生成Storeと内容ディレクトリ。
 * @stimulus 各固定Fileの1MiB超の不正例と、有効Schema／Contextを1MiB超へ拡大した正常例を比較する。
 * @observation current完全byte、pending／replace、登録後の現在アクセス・集合再観測、開閉descriptor件数。
 * @oracle 不正内容はpublication not_attempted・保存0、旧上限超過の正常例は登録成功。
 * @cleanup 観測関数を復元しFixtureが自己生成Rootを削除する。
 * @boundary AM公開登録とDomainの実File観測。
 */
test("登録固定Fileは旧1MiB超も内容を検査し開閉の一致を守る", (t) => {
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
      const result = saveRepositoryRegistration(
        f.root,
        f.principals.manager,
        2,
        op,
        target.manifest.repositoryId,
        target.directory,
        observeFixtureDirectory,
      );
      assert.equal(result.status, "unavailable");
      if (
        result.status === "unavailable" &&
        result.reason === "management_operation_unavailable"
      )
        assert.equal(result.publication, "not_attempted");
      else assert.fail("内容拒否が欠測");
      assert.deepEqual(fs.readFileSync(currentPath), before);
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
      assert.equal(live.size, 0);
      assert.equal(opened, closed);
    }
    fs.writeFileSync(
      target.manifestPath,
      JSON.stringify(target.manifest) + " ".repeat(1_048_577),
    );
    fs.writeFileSync(contextPath, target.context + " ".repeat(1_048_577));
    assert.equal(
      saveRepositoryRegistration(
        f.root,
        f.principals.manager,
        2,
        op,
        target.manifest.repositoryId,
        target.directory,
        observeFixtureDirectory,
      ).status,
      "completed",
    );
    assert.ok(opened > 0);
    const { principal, candidate, state } = attachHostedContentFixture(f);
    const collection = resolveHostedAccessCollection(f.root, principal, {
      managementRevision: state.revision,
      candidates: [candidate],
    });
    assert.equal(collection.status, "completed");
    if (collection.status !== "completed") throw Error("collection_failed");
    assert.ok(
      collection.repositories.some(
        (entry) => entry.repositoryId === target.manifest.repositoryId,
      ),
    );
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
 * @precondition Repository-localな自己生成Storeと内容ディレクトリ。
 * @stimulus 登録後の不許可・未知範囲・重複を入力しpending削除失敗を注入する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 拒否はcurrent不変、出版後故障はconfirmedの未完了。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と内容ディレクトリのFilesystem。
 */
test("登録解除の拒否と出版後清掃不明を区別する", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const id = target.manifest.repositoryId;
  const op = "00000000-0000-4000-8000-000000000090",
    nextOp = "00000000-0000-4000-8000-000000000091";
  assert.equal(
    saveRepositoryRegistration(
      f.root,
      f.principals.administrator,
      2,
      op,
      id,
      target.directory,
      observeFixtureDirectory,
    ).status,
    "completed",
  );
  const currentPath = path.join(f.directory, "access-management.json"),
    before = fs.readFileSync(currentPath);
  for (const [token, repo] of [
    [f.principals.developer, id],
    [f.principals.manager, "repository.missing"],
    [f.principals.manager, "not a repository id"],
  ] as const) {
    assert.deepEqual(saveRepositoryRemoval(f.root, token, 2, nextOp, repo), {
      status: "unavailable",
      reason: "management_operation_rejected",
    });
    assert.deepEqual(fs.readFileSync(currentPath), before);
  }
  assert.deepEqual(
    saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      3,
      nextOp,
      id,
      target.directory,
      observeFixtureDirectory,
    ),
    { status: "unavailable", reason: "management_operation_rejected" },
  );
  const originalRemove = fs.rmSync;
  fs.rmSync = (p, options) => {
    if (String(p).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return originalRemove(p, options);
  };
  let result: ReturnType<typeof saveRepositoryRemoval>;
  try {
    result = saveRepositoryRemoval(f.root, f.principals.manager, 3, nextOp, id);
  } finally {
    fs.rmSync = originalRemove;
  }
  assert.equal(result.status, "unavailable");
  if (
    result.status === "unavailable" &&
    result.reason === "management_operation_unavailable"
  ) {
    assert.equal(result.publication, "confirmed");
    assert.equal(result.observedRevision, 4);
    assert.equal(result.cleanupConfirmed, false);
  } else assert.fail("出版後失敗が欠測");
  const current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status === "completed") {
    assert.deepEqual(current.value.registeredRepositories, []);
    const next = structuredClone(current.value);
    next.revision = 5;
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
      [f.principals.developer, 4],
      ["invalid" as never, 4],
      [f.principals.manager, 3],
    ] as const) {
      assert.deepEqual(
        saveRepositoryRegistration(
          f.root,
          token,
          revision,
          op,
          id,
          target.directory,
          observeFixtureDirectory,
        ),
        revision === 3
          ? {
              status: "unavailable",
              reason: "management_operation_unavailable",
              primaryFailure: "state_store_revision_conflict",
              operationId: op,
              expectedRevision: 3,
              observedRevision: 4,
              publication: "not_attempted",
              cleanupConfirmed: true,
            }
          : { status: "unavailable", reason: "management_operation_rejected" },
      );
      materialNames.forEach((name, index) => {
        assert.deepEqual(
          fs.readFileSync(path.join(f.directory, name)),
          materialBytes[index],
        );
      });
    }
    const settled = saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      4,
      op,
      id,
      target.directory,
      observeFixtureDirectory,
    );
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

    // 先行材料だけを準備し直し、登録要求も対象観測前に終了することを確認する。
    prepare({ ...f, state: current.value }, next);
    let directoryRequests = 0;
    const registration = saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      4,
      op,
      "repository.pending-boundary",
      target.directory,
      (directory) => {
        directoryRequests++;
        return observeFixtureDirectory(directory);
      },
    );
    if (
      registration.status !== "unavailable" ||
      registration.reason !== "management_operation_unavailable"
    )
      assert.fail("登録の先行清掃結果が欠測");
    assert.equal(
      registration.primaryFailure,
      "state_store_previous_pending_settled",
    );
    assert.equal(registration.publication, "not_attempted");
    assert.equal(directoryRequests, 0);
    assert.deepEqual(fs.readFileSync(currentPath), materialBytes[0]);
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});
