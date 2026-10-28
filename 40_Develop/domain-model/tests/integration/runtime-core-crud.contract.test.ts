/**
 * Coreだけの一般CRUDを同じ物理Writerへ接続する。
 * @packageDocumentation
 * @responsibility Coordinator・AI・Dockerなしで初期化・定義変更・CAS・認可を確認する。
 * @trace PRL-IT-012
 * @level IT
 * @scope 自己生成Repositoryの新Schemaだけ。
 * @boundary Domain公開API→実Filesystem・既存短期OS排他。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  decodeRuntimeDomainSnapshot,
  initializeRuntimeState,
  queryPlan,
  queryTasks,
  type RuntimeAccess,
  readStableBoundedFileSnapshot,
  savePlan,
  updateTask,
} from "../../src/index.ts";
import { acquireRuntimeOwnedCoordinatorStateKernelLock } from "../../src/storage/runtime-kernel-lock.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { createRuntimeStorageSourceFixture } from "../support/runtime-storage-source.ts";

/**
 * 旧領域の残置から新しい空状態を作らない。
 * @responsibility 移行の未知と新規Repositoryをmetadata境界で区別する。
 * @trace PRL-IT-012
 * @precondition 既存helperが所有する合成Rootのみ。
 * @stimulus 旧Directory・File・link・観測不能を用意して同じ公開初期化を呼ぶ。
 * @observation 公開拒否、旧内容の保全、新領域とstateの不存在。
 * @oracle 処置前の不明は作成零。出版中の後発出現はunknownとpendingを保持し、再入場で上書きしない。
 * @cleanup mockを復元し、自己生成Rootだけを既存helperで回収する。
 * @boundary 公開Core APIと実Filesystem。過去保持物は使わない。
 */
test("保存先切替は旧領域の存在と観測不能を空初期化へ変換しない", async (t) => {
  for (const kind of [
    "directory",
    "file",
    "link",
    "unobservable",
    "parent_changed",
    "appears_before_publish",
    "absent",
  ])
    await t.test(kind, () => {
      const directory = createRepositoryTestDirectory("runtime-area-switch-");
      try {
        const root = directory.path;
        fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
          recursive: true,
        });
        fs.mkdirSync(path.join(root, ".git", "info"));
        fs.writeFileSync(
          path.join(root, ".git", "info", "exclude"),
          ".crdd/\n",
        );
        fs.writeFileSync(
          path.join(root, ".git", "config"),
          "[core]\nrepositoryformatversion = 0\nbare = false\n",
        );
        fs.writeFileSync(
          path.join(root, ".git", "HEAD"),
          "ref: refs/heads/main\n",
        );
        fs.writeFileSync(
          path.join(root, ".git", "refs", "heads", "main"),
          "1".repeat(40) + "\n",
        );
        fs.mkdirSync(path.join(root, ".crdd"));
        const legacy = path.join(root, ".crdd", "coordinator");
        const current = path.join(root, ".crdd", "domain-model");
        if (kind === "directory") fs.mkdirSync(legacy);
        if (kind === "file") fs.writeFileSync(legacy, "synthetic old state");
        if (kind === "link") {
          const target = path.join(root, "synthetic-old-target");
          fs.mkdirSync(target);
          fs.symlinkSync(target, legacy, "junction");
        }
        const verified = verifyRepositoryRoot(root);
        assert.equal(verified.status, "completed");
        if (verified.status !== "completed") return;
        const access: RuntimeAccess = {
          root: verified.capability,
          principalId: "synthetic",
          revalidate: () => true,
        };
        const request = {
          projectId: "project",
          milestoneId: "milestone",
          expectedAbsence: true,
        } as const;
        const original = fs.lstatSync;
        let mock: ReturnType<typeof t.mock.method> | undefined;
        let legacyObserved = false;
        if (kind === "unobservable" || kind === "parent_changed")
          mock = t.mock.method(fs, "lstatSync", ((
            ...args: Parameters<typeof fs.lstatSync>
          ) => {
            if (String(args[0]) === legacy) {
              legacyObserved = true;
              throw Object.assign(new Error("synthetic"), {
                code: kind === "unobservable" ? "EACCES" : "ENOENT",
              });
            }
            const observed = original(...args);
            if (
              kind === "parent_changed" &&
              legacyObserved &&
              String(args[0]) === path.join(root, ".crdd") &&
              typeof observed?.ino === "bigint"
            ) {
              const changed = Object.create(observed);
              Object.defineProperty(changed, "ino", {
                value: observed.ino + 1n,
              });
              return changed;
            }
            return observed;
          }) as typeof fs.lstatSync);
        const originalOpen = fs.openSync;
        const openMock =
          kind === "appears_before_publish"
            ? t.mock.method(fs, "openSync", ((
                ...args: Parameters<typeof fs.openSync>
              ) => {
                if (
                  String(args[0]) ===
                    path.join(current, "state.pending.json") &&
                  !fs.existsSync(legacy)
                )
                  fs.mkdirSync(legacy);
                return originalOpen(...args);
              }) as typeof fs.openSync)
            : undefined;
        let result: ReturnType<typeof initializeRuntimeState>;
        try {
          result = initializeRuntimeState(access, request);
        } finally {
          mock?.mock.restore();
          openMock?.mock.restore();
        }
        if (kind === "appears_before_publish") {
          assert.equal(result.status, "unknown", JSON.stringify(result));
          assert.equal(result.reason, "publication_unconfirmed");
          assert.equal(fs.existsSync(path.join(current, "state.json")), false);
          assert.equal(fs.existsSync(legacy), true);
          const markerFile = path.join(current, "state.lock");
          const pendingFile = path.join(current, "state.pending.json");
          const marker = fs.readFileSync(markerFile);
          const pending = fs.readFileSync(pendingFile);
          const markerValue = JSON.parse(marker.toString("utf8"));
          assert.equal(markerValue.schema, "crdd-coordinator/state-lock/v1");
          assert.ok(
            decodeRuntimeDomainSnapshot(pending, markerValue.repositoryBinding),
          );
          const repeated = initializeRuntimeState(access, request);
          assert.notEqual(repeated.status, "saved");
          assert.deepEqual(fs.readFileSync(markerFile), marker);
          assert.deepEqual(fs.readFileSync(pendingFile), pending);
          assert.equal(fs.existsSync(path.join(current, "state.json")), false);
        } else if (kind !== "absent") {
          assert.equal(result.status, "blocked", JSON.stringify(result));
          assert.equal(fs.existsSync(current), false);
          if (kind === "file")
            assert.equal(
              fs.readFileSync(legacy, "utf8"),
              "synthetic old state",
            );
        } else {
          assert.equal(result.status, "saved", JSON.stringify(result));
          assert.equal(fs.existsSync(path.join(current, "state.json")), true);
          fs.mkdirSync(legacy);
          const bytes = fs.readFileSync(path.join(current, "state.json"));
          assert.notEqual(
            queryPlan(access, {
              projectId: request.projectId,
              milestoneId: request.milestoneId,
            }).status,
            "blocked",
          );
          assert.equal(
            initializeRuntimeState(access, request).status,
            "blocked",
          );
          assert.deepEqual(
            fs.readFileSync(path.join(current, "state.json")),
            bytes,
          );
        }
      } finally {
        directory.cleanup();
      }
    });
});

/**
 * 新Schemaの一般CRUDが同じReader・Writerへ本番接続していることを確認する。
 * @responsibility 型付き公開API・参照拒否・CAS・解放・状態区画の非捏造を検証する。
 * @trace PRL-IT-012
 * @precondition 新しい合成Gitだけを使う。
 * @stimulus 初期化、Plan保存、個別追加・更新・削除、失効と再送を行う。
 * @observation 公開結果と実際の単一state.json。
 * @oracle 管理実行・Operation・Selectionを作らず、競合・逆依存を拒否する。
 * @cleanup exactな自己生成Rootを既存helperで確認後削除する。
 * @boundary 外部AI・Docker・過去保持物は使用しない。
 */
test("Coreだけで初期化・一般CRUD・現在認可とCASを同じ実Storeへ接続する", (t) => {
  const directory = createRepositoryTestDirectory("runtime-core-crud-");
  t.after(directory.cleanup);
  const root = directory.path;
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "refs", "heads", "main"),
    "1".repeat(40) + "\n",
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("invalid_fixture");
  let allowed = true;
  let checks = 0;
  const access: RuntimeAccess = {
    root: verified.capability,
    principalId: "principal-a",
    revalidate: () => {
      checks++;
      return allowed;
    },
  };
  const target = { projectId: "project-a", milestoneId: "milestone-a" };
  const initialized = initializeRuntimeState(access, {
    ...target,
    expectedAbsence: true,
  });
  assert.equal(initialized.status, "saved", JSON.stringify(initialized));
  if (initialized.status !== "saved") return;
  assert.equal(
    initializeRuntimeState(access, { ...target, expectedAbsence: true }).status,
    "blocked",
  );
  const plan = {
    milestoneAcceptanceCriteria: ["全体確認"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["確認"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/code.ts"],
        conflictKeys: [],
      },
    ],
  };
  const saved = savePlan(access, {
    ...target,
    expected: initialized.version,
    expectedDefinitionHash: null,
    definition: plan,
  });
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  if (saved.status !== "saved") return;
  assert.equal(
    savePlan(access, {
      ...target,
      expected: initialized.version,
      expectedDefinitionHash: null,
      definition: plan,
    }).status,
    "conflict",
  );
  const observed = queryPlan(access, target);
  assert.equal(observed.status, "available");
  if (observed.status !== "available") return;
  assert.deepEqual(observed.value.definition, plan);
  const objective = createObjective(access, {
    ...target,
    expected: saved.version,
    definition: { id: "objective-b", acceptanceCriteria: ["追加確認"] },
  });
  assert.equal(objective.status, "saved", JSON.stringify(objective));
  if (objective.status !== "saved") return;
  assert.equal(
    deleteObjective(access, {
      ...target,
      expected: objective.version,
      objectiveId: "objective-a",
      expectedDefinitionHash: "0".repeat(64),
    }).status,
    "conflict",
  );
  const tasks = queryTasks(access, target);
  assert.equal(tasks.status, "available");
  if (tasks.status !== "available") return;
  const original = tasks.value[0];
  assert.ok(original);
  const added = createTask(access, {
    ...target,
    expected: objective.version,
    definition: {
      id: "task-b",
      objectiveId: "objective-b",
      dependencies: ["task-a"],
      allowedPaths: ["tests/test.ts"],
      conflictKeys: [],
    },
  });
  assert.equal(added.status, "saved", JSON.stringify(added));
  if (added.status !== "saved") return;
  assert.equal(
    deleteTask(access, {
      ...target,
      expected: added.version,
      taskId: "task-a",
      expectedDefinitionHash: original.definitionHash,
    }).status,
    "blocked",
  );
  const changed = updateTask(access, {
    ...target,
    expected: added.version,
    taskId: "task-b",
    expectedDefinitionHash: added.value.definitionHash,
    definition: { ...added.value.definition, dependencies: [] },
  });
  assert.equal(changed.status, "saved", JSON.stringify(changed));
  if (changed.status !== "saved") return;
  const removed = deleteTask(access, {
    ...target,
    expected: changed.version,
    taskId: "task-b",
    expectedDefinitionHash: changed.value.definitionHash,
  });
  assert.equal(removed.status, "saved", JSON.stringify(removed));
  const file = path.join(root, ".crdd", "domain-model", "state.json");
  const before = fs.readFileSync(file);
  const state = JSON.parse(before.toString("utf8"));
  assert.equal(state.schema, "crdd-domain/runtime-state/v1");
  for (const key of [
    "managedExecutions",
    "operations",
    "unresolvedRecoveries",
    "pendingDeliveries",
    "resultReceipts",
  ])
    assert.deepEqual(state[key], []);
  assert.equal(checks > 10, true);
  allowed = false;
  assert.deepEqual(queryPlan(access, target), {
    status: "blocked",
    value: null,
    reason: "not_authorized",
  });
  assert.equal(
    savePlan(access, {
      ...target,
      expected: observed.version,
      expectedDefinitionHash: observed.value.definitionHash,
      definition: plan,
    }).status,
    "blocked",
  );
  assert.deepEqual(fs.readFileSync(file), before);
});
/**
 * 保存途中失敗を自己生成実Storeで反証する。
 * @responsibility 共通pending再入場・出版後不明・解放不明と認可失効を区別する。
 * @trace PRL-IT-012
 * @precondition 一つずつ独立した新SchemaのRepositoryだけを使う。
 * @stimulus 同じSource閉包へrename・読戻し・解放・認可の限定故障を注入する。
 * @observation 公開結果、元版・次版byte、pendingと履歴の保全。
 * @oracle 不明を成功へ丸めず、同じpendingだけが既存再入場で確定する。
 * @cleanup 既存helperで今回Rootだけを確認後清掃する。
 * @boundary 実Filesystem・既存Kernel排他。外部AI・Dockerなし。
 */
test("一般CRUDは既存Writerの失敗・再入場・解放不明をそのまま返す", async (t) => {
  for (const mode of [
    "rename_before",
    "rename_after",
    "readback",
    "release",
    "authorization",
  ] as const) {
    await t.test(mode, (t) => {
      const directory = createRepositoryTestDirectory("runtime-core-failure-");
      t.after(directory.cleanup);
      const root = directory.path;
      fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(root, ".git", "info"));
      fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
      fs.writeFileSync(
        path.join(root, ".git", "config"),
        "[core]\nrepositoryformatversion = 0\nbare = false\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "refs", "heads", "main"),
        "1".repeat(40) + "\n",
      );
      const verified = verifyRepositoryRoot(root);
      assert.equal(verified.status, "completed");
      if (verified.status !== "completed") return;
      let allowed = true;
      const access: RuntimeAccess = {
        root: verified.capability,
        principalId: "principal-a",
        revalidate: () => allowed,
      };
      const target = { projectId: "project-a", milestoneId: "milestone-a" };
      const initial = initializeRuntimeState(access, {
        ...target,
        expectedAbsence: true,
      });
      assert.equal(initial.status, "saved");
      if (initial.status !== "saved") return;
      const plan = {
        milestoneAcceptanceCriteria: ["全体確認"],
        objectives: [{ id: "objective-a", acceptanceCriteria: ["確認"] }],
        tasks: [
          {
            id: "task-a",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["src/code.ts"],
            conflictKeys: [],
          },
        ],
      };
      const file = path.join(root, ".crdd", "domain-model", "state.json");
      const before = fs.readFileSync(file);
      const pending = path.join(
        root,
        ".crdd",
        "domain-model",
        "state.pending.json",
      );
      let injected = 0,
        renamed = false;
      const hostFs = {
        ...fs,
        renameSync: (from: fs.PathLike, to: fs.PathLike) => {
          if (String(to) === file) {
            if (mode === "rename_before") {
              injected++;
              throw Error("synthetic_rename_before");
            }
            fs.renameSync(from, to);
            renamed = true;
            if (mode === "rename_after") {
              injected++;
              throw Error("synthetic_rename_after");
            }
          } else fs.renameSync(from, to);
        },
        openSync: ((...args: Parameters<typeof fs.openSync>) => {
          if (mode === "authorization" && String(args[0]) === pending) {
            injected++;
            allowed = false;
          }
          return fs.openSync(...args);
        }) as typeof fs.openSync,
      };
      const fixture = createRuntimeStorageSourceFixture(undefined, {
        fs: hostFs,
        readStableBoundedFileSnapshot: (
          ...args: Parameters<typeof readStableBoundedFileSnapshot>
        ) => {
          if (mode === "readback" && renamed && String(args[0]) === file) {
            injected++;
            throw Error("synthetic_readback");
          }
          return readStableBoundedFileSnapshot(...args);
        },
        acquireRuntimeOwnedCoordinatorStateKernelLock: (
          ...args: Parameters<
            typeof acquireRuntimeOwnedCoordinatorStateKernelLock
          >
        ) => {
          const lock = acquireRuntimeOwnedCoordinatorStateKernelLock(...args);
          if (!lock || mode !== "release") return lock;
          return {
            ...lock,
            release: () => {
              injected++;
              assert.equal(lock.release(), true);
              return false;
            },
          };
        },
      });
      const request = {
        ...target,
        expected: initial.version,
        expectedDefinitionHash: null,
        definition: plan,
      };
      const result = fixture.savePlan(access, request);
      assert.equal(injected > 0, true);
      assert.equal(result.status, "unknown", JSON.stringify(result));
      if (result.status !== "unknown") return;
      assert.deepEqual(result.recoveryReferences, []);
      assert.equal(
        result.publication,
        mode === "release" ? "confirmed" : "unconfirmed",
      );
      if (mode === "rename_before" || mode === "authorization")
        assert.deepEqual(fs.readFileSync(file), before);
      else assert.notDeepEqual(fs.readFileSync(file), before);
      if (mode === "release") {
        assert.equal(result.reason, "lock_release_unconfirmed");
        assert.equal(queryPlan(access, target).status, "available");
      }
      if (mode === "rename_before") {
        assert.equal(fs.existsSync(pending), true);
        const pendingBytes = fs.readFileSync(pending);
        const resumed = savePlan(access, request);
        assert.equal(resumed.status, "saved", JSON.stringify(resumed));
        assert.deepEqual(fs.readFileSync(file), pendingBytes);
        assert.equal(fs.existsSync(pending), false);
      }
      if (mode === "authorization")
        assert.equal(queryPlan(access, target).status, "blocked");
    });
  }
});

/**
 * 初回出版の失敗を成功や真正不存在へ丸めない。
 * @responsibility 初期化も同じpending・読戻し・解放契約を使うことを確認する。
 * @trace PRL-IT-012
 * @precondition 自己生成Repositoryに現在状態が存在しない。
 * @stimulus 初回renameの前と後に一度だけ故障を注入する。
 * @observation unknown、pending又は確定本文と次の公開読取り。
 * @oracle 初期化成功を返さず、残った正本・未確定候補を削除しない。
 * @cleanup 今回Rootだけを既存helperで確認後削除する。
 * @boundary AI・Dockerなしの実Filesystem。
 */
test("初期化途中の出版不明を保持し二重初期化を拒否する", async (t) => {
  for (const after of [false, true])
    await t.test(after ? "rename後" : "rename前", (t) => {
      const directory = createRepositoryTestDirectory(
        "runtime-core-initialize-",
      );
      t.after(directory.cleanup);
      const root = directory.path;
      fs.mkdirSync(path.join(root, ".git", "refs", "heads"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(root, ".git", "info"));
      fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\n");
      fs.writeFileSync(
        path.join(root, ".git", "config"),
        "[core]\nrepositoryformatversion = 0\nbare = false\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
      fs.writeFileSync(
        path.join(root, ".git", "refs", "heads", "main"),
        "1".repeat(40) + "\n",
      );
      const verified = verifyRepositoryRoot(root);
      assert.equal(verified.status, "completed");
      if (verified.status !== "completed") return;
      const access: RuntimeAccess = {
        root: verified.capability,
        principalId: "test-principal",
        revalidate: () => true,
      };
      const file = path.join(root, ".crdd", "domain-model", "state.json");
      let injected = 0;
      const fixture = createRuntimeStorageSourceFixture(undefined, {
        fs: {
          ...fs,
          renameSync: (from: fs.PathLike, to: fs.PathLike) => {
            if (String(to) !== file) return fs.renameSync(from, to);
            injected++;
            if (after) fs.renameSync(from, to);
            throw Error("synthetic_initial_publication_failure");
          },
        },
      });
      const request = {
        projectId: "project-a",
        milestoneId: "milestone-a",
        expectedAbsence: true,
      } as const;
      const result = fixture.initializeRuntimeState(access, request);
      assert.equal(injected, 1);
      assert.equal(result.status, "unknown", JSON.stringify(result));
      assert.equal(fs.existsSync(file), after);
      assert.equal(
        fs.existsSync(
          path.join(root, ".crdd", "domain-model", "state.pending.json"),
        ),
        !after,
      );
      assert.notEqual(initializeRuntimeState(access, request).status, "saved");
    });
});
