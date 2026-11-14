/**
 * 修復の保存結果と技術結果の相関を実Sourceで反証する。
 * @packageDocumentation
 * @responsibility 実DI制御と公開保存操作をつなぎ、技術処置だけを有限代役へ置換する。
 * @trace ERB-IT-014
 * @trace ERB-IT-002
 * @level IT
 * @scope 実EM Reader／Writer・State／History・Lock／CASと有限DI故障。共有対象の直列ケースは新品Repositoryの不変Root／Revision／保存IdentityとSource factoryを共有し、他ケースは従来の実Git境界を保つ。実Docker・Providerなし。
 * @boundary 修復呼出し→保存モデル／DI終了結果。
 */

import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { after, mock, type TestContext } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { runInThisContext } from "node:vm";
import type { RepairDisposalInput } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import { runRepairSessionWithDependencies } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import * as technicalValidation from "../../../docker-isolation/src/docker-desktop/validation.ts";
import type {
  RepairOperationRecord,
  RepairSaveRequest,
} from "../../../execution-model/src/index.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import type {
  Repository,
  RepositoryRevisionObservation,
} from "../../../version-control/src/index.ts";
import * as versionControl from "../../../version-control/src/index.ts";
import type { repairRuntimeOwnedDockerRuntime } from "../../src/execution/recovery.ts";
import { snapshotJsonValue } from "../../src/input/snapshot.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

let fixedRevision: {
  root: Repository;
  path: string;
  revision: unknown;
  hits: number;
  fixedRoot?: boolean;
  resolution?:
    | ReturnType<typeof versionControl.getRepositoryFromWorkingDirectory>
    | undefined;
  storageIdentity?:
    | ReturnType<typeof versionControl.readRepositoryStorageIdentity>
    | undefined;
} | null = null;
let delegatedRevisionReads = 0;
let delegatedRootReads = 0;
let delegatedRepositoryReads = 0;
const revisionMock = mock.module(
  new URL("../../../version-control/src/index.ts", import.meta.url).href,
  {
    namedExports: {
      ...versionControl,
      getRepository(input: unknown) {
        if (fixedRevision?.fixedRoot && input === fixedRevision.path) {
          assert.ok(fixedRevision.resolution);
          return fixedRevision.resolution;
        }
        delegatedRepositoryReads++;
        return versionControl.getRepository(input);
      },
      getRepositoryFromWorkingDirectory(input: unknown) {
        if (fixedRevision?.fixedRoot && input === fixedRevision.path) {
          assert.ok(fixedRevision.resolution);
          return fixedRevision.resolution;
        }
        delegatedRootReads++;
        return versionControl.getRepositoryFromWorkingDirectory(input);
      },
      resolveVerifiedRepositoryRoot(capability: Repository) {
        if (fixedRevision?.fixedRoot && capability === fixedRevision.root)
          return fixedRevision.path;
        return versionControl.resolveVerifiedRepositoryRoot(capability);
      },
      readRepositoryStorageIdentity(capability: Repository) {
        if (fixedRevision?.fixedRoot && capability === fixedRevision.root)
          return fixedRevision.storageIdentity;
        return versionControl.readRepositoryStorageIdentity(capability);
      },
      readRepositoryRevision(...args: unknown[]) {
        const projection = fixedRevision;
        if (
          projection &&
          args[1] === undefined &&
          args[0] &&
          (projection.fixedRoot
            ? args[0] === projection.root
            : versionControl.resolveVerifiedRepositoryRoot(
                args[0] as Repository,
              ) === projection.path)
        ) {
          projection.hits++;
          return projection.revision;
        }
        delegatedRevisionReads++;
        return Reflect.apply(
          versionControl.readRepositoryRevision,
          undefined,
          args,
        );
      },
    },
  },
);
after(() => {
  fixedRevision = null;
  revisionMock.restore();
});
const model = await import("../../../execution-model/src/index.ts");
const stateValues = await import("../../src/state/validation.ts");
const bindings = await import("../../src/execution/operation.ts");
const { createRepository } = await import("../fixtures/decision-state.ts");
const { renderDockerRecoveryDoctorReport } = await import(
  "../../src/cli/recovery-report.ts"
);
const { getRepository } = versionControl;
const projectedVersionControl = await import(
  "../../../version-control/src/index.ts"
);

const repairSource = sourceDeclaration(
  fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  ),
  "repairRuntimeOwnedDockerRuntime",
);

/**
 * 未束縛の試験用factoryをSourceごとに構築する。
 * @responsibility 正常Sourceの一回準備と変異Sourceの独立構築を同じ実装で行う。
 * @trace ERB-IT-014
 * @precondition 本番Source又は明示した試験内変異を入力する。
 * @stimulus 型除去済みのSourceをVMへ渡す。
 * @observation case依存を後から受け取る関数。
 * @oracle Owner・Abort・counterをコンパイル時に束縛しない。
 * @cleanup VMの局所値はProcess終了で破棄する。
 * @boundary 試験内のSource構築のみ。製品の実行入口ではない。
 */
function compileRepair(source: string) {
  return runInThisContext(
    `(function(deps){ const {Date,isDeepStrictEqual,snapshotJsonValue,createHash,randomBytes,randomUUID,observeRepositoryExecutionDataArea,getRepository,runRepairSession,borrowRuntimeOwnedCoordinatorRecoveryRepository,canonicalJson,observeRepairDirectories,readState,saveRecoveryHistory,completeRecovery,resumeRepairRecordSave,saveRepairRecord,cleanupRepairDirectory}=deps; const historyRepositoryInput = root => ({root,historyRetentionDays:30,revalidate:()=>true}); const withHistoryRetention = repository => ({...repository,historyRetentionDays:30}); const getIsolationSettings = () => Object.freeze({windowsDirectory:"C:/Windows",userHomeDirectory:"C:/Users/test"}); const restartDockerEnvironment = request => runRepairSession(request.input); const inspectResources = target => observeRepairDirectories(target.input); const cleanupResources = target => cleanupRepairDirectory(target.input); ${source}; return repairRuntimeOwnedDockerRuntime;})`,
  );
}
const repairFactory = compileRepair(repairSource);

let sharedBase: Readonly<{
  created: ReturnType<typeof createRepository>;
  resolution: ReturnType<
    typeof versionControl.getRepositoryFromWorkingDirectory
  >;
  root: Repository;
  revision: RepositoryRevisionObservation;
  storageIdentity: NonNullable<
    ReturnType<typeof versionControl.readRepositoryStorageIdentity>
  >;
}> | null = null;
let activeSharedCase: object | null = null;
let sharedRootCleanup: (() => void) | null = null;
after(() => {
  assert.equal(activeSharedCase, null, "unfinished_shared_case");
  sharedRootCleanup?.();
});

/**
 * 不変のGit前提を一度だけ構築する。
 * @responsibility 同じRoot・Revision・保存Identityを直列ケースへ渡す。
 * @trace ERB-IT-014
 * @precondition 本Suiteだけが新品Rootを所有する。
 * @stimulus 最初のケースでGit初期化と真正観測を行う。
 * @observation Root・二Identity・明示HEAD取得と最終Root清掃。
 * @oracle 保存IdentityとRevisionが一致し、未知Rootは代役へ入らない。
 * @cleanup file終了hookで現在ケースの清掃完了後だけRootを回収する。
 * @boundary 不変の技術前提。実Git変更検出は別試験。
 */
function sharedRepairBase() {
  if (sharedBase) return sharedBase;
  const created = createRepository({
    after(cleanup) {
      assert.equal(sharedRootCleanup, null);
      sharedRootCleanup = cleanup;
    },
  });
  const verified = versionControl.getRepositoryFromWorkingDirectory(
    created.root,
  );
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw Error("fixture_repository_invalid");
  const root = verified.capability,
    revision = versionControl.readRepositoryRevision(root),
    storageIdentity = versionControl.readRepositoryStorageIdentity(root);
  assert.ok(revision && storageIdentity);
  assert.equal(storageIdentity.repositoryIdentity, revision.repositoryIdentity);
  assert.equal(
    storageIdentity.repositoryInstanceIdentity,
    revision.repositoryInstanceIdentity,
  );
  const delegatedBefore = delegatedRevisionReads;
  const selected = projectedVersionControl.readRepositoryRevision(root, {
    revision: "HEAD",
  });
  assert.ok(selected);
  assert.equal(selected.revisionIdentity, revision.revisionIdentity);
  assert.ok(delegatedRevisionReads > delegatedBefore);
  const projection = {
    root,
    path: created.root,
    revision,
    storageIdentity,
    resolution: verified,
    hits: 0,
    fixedRoot: true,
  };
  const previous = fixedRevision;
  fixedRevision = projection;
  try {
    assert.equal(projectedVersionControl.getRepository(created.root), verified);
    const repositoryReads = delegatedRepositoryReads;
    assert.equal(projectedVersionControl.getRepository(null).status, "blocked");
    assert.equal(delegatedRepositoryReads, repositoryReads + 1);
    assert.equal(
      projectedVersionControl.getRepositoryFromWorkingDirectory(created.root),
      verified,
    );
    const before = delegatedRootReads;
    assert.equal(
      projectedVersionControl.getRepositoryFromWorkingDirectory(null).status,
      "blocked",
    );
    assert.equal(delegatedRootReads, before + 1);
  } finally {
    fixedRevision = previous;
  }
  sharedBase = Object.freeze({
    resolution: verified,
    created,
    root,
    revision,
    storageIdentity,
  });
  return sharedBase;
}

/**
 * 実呼出しSourceを自己生成Rootの公開保存操作へ接続する。
 * @responsibility 保存前拒否と保存後応答不明を分離し、公開Reader／Writerを通す。
 * @trace ERB-IT-014
 * @precondition Sourceは読取りのみ。Git HEADの変更検出は別の実Git試験が担当する。
 * @stimulus 保存・技術終了・取消の局所故障を指定する。
 * @observation 確認済み本文、全保存候補、実Machine結果。
 * @oracle 公開modelが元版・改訂・保存順序を検査し、故障注入の前後Effectを区別する。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 実Filesystem保存と有限DI代役。解放失敗は応答の代役で、実Lock故障の証明ではない。
 */
function fixture(
  t: TestContext,
  transform: (source: string) => string = (source) => source,
  base?: ReturnType<typeof sharedRepairBase>,
) {
  type Input = Parameters<typeof runRepairSessionWithDependencies>[0];
  const created = base?.created ?? createRepository(t);
  let root: Repository, revision: unknown;
  if (base) {
    assert.equal(activeSharedCase, null, "shared_cases_must_be_sequential");
    activeSharedCase = Object.freeze({});
    root = base.root;
    revision = base.revision;
    assert.throws(
      () => fs.lstatSync(path.join(created.root, ".crdd", "domain-model")),
      { code: "ENOENT" },
    );
  } else {
    const verified = getRepository(created.root);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed")
      throw new Error("fixture_repository_invalid");
    root = verified.capability;
    revision = versionControl.readRepositoryRevision(root);
    assert.ok(revision);
    const delegatedBefore = delegatedRevisionReads;
    const selected = projectedVersionControl.readRepositoryRevision(root, {
      revision: "HEAD",
    });
    assert.ok(selected);
    assert.equal(
      selected.revisionIdentity,
      (revision as RepositoryRevisionObservation).revisionIdentity,
    );
    assert.ok(delegatedRevisionReads > delegatedBefore);
  }
  const projection = {
    root,
    path: created.root,
    revision,
    hits: 0,
    fixedRoot: base !== undefined,
    storageIdentity: base?.storageIdentity,
    resolution: base?.resolution,
  };
  fixedRevision = projection;
  t.after(() => {
    assert.ok(projection.hits > 0, "public model must reach the VC projection");
    if (fixedRevision === projection) fixedRevision = null;
  });

  const repository =
    bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(root);
  assert.ok(repository);
  const hitsBefore = projection.hits;
  const initial = model.readState(root, { scope: "recovery" });
  assert.ok(
    projection.hits > hitsBefore,
    "public model must use the bounded revision projection",
  );
  assert.equal(
    initial.value,
    null,
    "uninitialized model must not acquire a saved state",
  );
  assert.equal(
    fs.existsSync(
      path.join(created.root, ".crdd", "domain-model", "state.json"),
    ),
    false,
  );
  const stateFile = path.join(
    created.root,
    ".crdd",
    "domain-model",
    "state.json",
  );
  const historyFile = path.join(
    created.root,
    ".crdd",
    "domain-model",
    "history.jsonl",
  );
  const binding = repository.repositoryBinding;
  const controller = new AbortController();
  const state = {
    alive: true,
    mode: "ready" as
      | "ready"
      | "incomplete"
      | "retained"
      | "cancel"
      | "effect_unknown",
    close: "clean" as "clean" | "cancel" | "unknown" | "cancel_unknown",
    fault: "none" as "none" | "cleanup" | "outcome" | "retention",
    faultKind: "reject" as "reject" | "confirmation" | "release" | "throw",
    faultHits: 0,
    bytes: null as Buffer | null,
    calls: 0,
    joined: 0,
    effects: 0,
    observed: 0,
    observationCleanupUnknown: false,
    faultsAt: 0,
    lossAt: "none" as "none" | "prepared" | "effect",
    losses: 0,
    writesAtLoss: 0,
    bytesAtLoss: null as Buffer | null,
    entries: 0,
    acquired: 0,
    readerReleased: true,
    readers: 0,
    intakeReads: 0,
    intakeReadFaultAt: 0,
    publications: 0,
    publicationCompleted: false,
    publicationFault: "none" as
      | "none"
      | "status"
      | "snapshot"
      | "release"
      | "throw"
      | "owner",
    intakeReadFault: "none" as
      | "none"
      | "status"
      | "storage"
      | "absence"
      | "release"
      | "throw"
      | "owner",
    cancelAfterWrite: false,
    historyBytes: Buffer.alloc(0) as Buffer,
    historyReads: 0,
    historyWrites: 0,
    historyAt: "2026-10-16T00:00:00.000Z",
    historyReadFaultAt: 0,
    historyReadFault: "reject" as "reject" | "release" | "throw" | "owner",
    historyFaultAt: 0,
    historyFault: "reject" as
      | "reject"
      | "release"
      | "throw"
      | "owner"
      | "after_effect",
    completionReads: 0,
    completionWrites: 0,
    retentionReads: 0,
    retentionObservationFails: false,
    completionDeadlineFault: "none" as "none" | "before" | "fresh",
    dateReads: 0,
    // 既存の保持試験は、回収判断の保存拒否で判断待ちを意図的に残す。
    pauseBeforeDisposal: true,
    disposalCalls: [] as string[],
    disposalBlockedPurpose: null as string | null,
    disposalProgressRefused: false,
    completionBefore: null as Buffer | null,
    completionReadFaultAt: 0,
    completionReadFault: "reject" as "reject" | "release" | "throw" | "owner",
    completionFault: "none" as
      | "none"
      | "reject"
      | "release"
      | "throw"
      | "owner"
      | "after_effect",
  };
  Object.defineProperties(state, {
    bytes: {
      get() {
        try {
          return fs.readFileSync(stateFile);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      },
      set(value: Buffer | null) {
        if (value === null) throw new Error("fixture_cannot_reset_current");
        fs.writeFileSync(stateFile, value);
      },
    },
    historyBytes: {
      get() {
        try {
          return fs.readFileSync(historyFile);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT")
            return Buffer.alloc(0);
          throw error;
        }
      },
      set(value: Buffer) {
        // このfixtureの空履歴は「未作成」を表す。製品が拒否する0byte実体は作らない。
        if (value.length === 0) {
          try {
            const metadata = fs.lstatSync(historyFile);
            assert.equal(metadata.isFile(), true);
            assert.equal(metadata.isSymbolicLink(), false);
            assert.equal(metadata.nlink, 1);
            fs.unlinkSync(historyFile);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          return;
        }
        fs.writeFileSync(historyFile, value);
      },
    },
  });
  const saved: Buffer[] = [];
  const historySaved: Buffer[] = [];
  let late: Input["onCheckpoint"] | null = null;
  /**
   * 専用Readerの値分類を実モデルから構成する。
   * @responsibility 履歴未開始と出版対象・拒否を区別する。
   * @trace ERB-IT-014
   * @precondition メモリ上の最新Snapshotと履歴。
   * @stimulus exact参照、読取り故障とOwner失効。
   * @observation 候補・段階・排他確認。
   * @oracle 壊れた履歴を技術状態へ補完しない。
   * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
   * @boundary 公開Readerと実保存物。完成保存内のReader故障は専用Hookで注入する。
   */
  const readHistory = (_root: unknown, id: unknown) => {
    const observed = model.readState(_root, {
      scope: "recovery",
      input: {
        kind: "repair_history",
        recoveryId: id,
      },
    });
    return {
      ...observed,
      lockReleased: observed.lockReleased && state.readerReleased,
    };
  };
  /**
   * 実モデルの完成保存へ実Writer境界の故障だけを注入する。
   * @responsibility checkpoint／出版候補と故障時の既発生事実を保持する。
   * @trace ERB-IT-014
   * @precondition 現在Ownerとexact操作IDが一致する。
   * @stimulus 各段の拒否・発行後失敗・解放不明・例外。
   * @observation 次Snapshot、履歴行、保存件数。
   * @oracle 時刻と両Hashを実モデルから導出する。
   * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
   * @boundary 実モデルと模擬Writer。
   */
  const saveHistory = (
    input: Parameters<typeof model.saveRecoveryHistory>[0],
    id: string,
    owner: () => boolean,
    kind: "runtime_repair",
  ) => {
    assert.equal(kind, "runtime_repair");
    const lockPath = path.join(
      created.root,
      ".crdd",
      "lock",
      "execution-model.state.lock",
    );
    const pending = path.join(path.dirname(stateFile), "state.pending.json");
    const open = fs.openSync,
      remove = fs.rmSync,
      rename = fs.renameSync,
      lstat = fs.lstatSync;
    let boundaries = 0,
      writer = false,
      selectedRead = false,
      selectedWrite = false,
      renamed = false;
    const hooks = [
      t.mock.method(
        fs,
        "openSync",
        (target: fs.PathLike, flags: fs.OpenMode, mode?: fs.Mode) => {
          if (String(target) === lockPath && flags === "wx") {
            boundaries++;
            writer = boundaries % 2 === 0;
            renamed = false;
            selectedRead = false;
            selectedWrite = false;
            if (writer) {
              state.historyWrites++;
              selectedWrite = state.historyWrites === state.historyFaultAt;
              if (selectedWrite && state.historyFault === "owner")
                state.alive = false;
              if (
                selectedWrite &&
                ["reject", "throw"].includes(state.historyFault)
              )
                throw Object.assign(new Error("history_lock_acquire_fault"), {
                  code: "EACCES",
                });
            } else {
              state.historyReads++;
              selectedRead = state.historyReads === state.historyReadFaultAt;
              if (selectedRead && state.historyReadFault === "owner")
                state.alive = false;
              if (
                selectedRead &&
                ["reject", "throw"].includes(state.historyReadFault)
              )
                throw Object.assign(new Error("history_read_acquire_fault"), {
                  code: "EACCES",
                });
            }
          }
          return open(target, flags, mode);
        },
      ),
      t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
        rename(from, to);
        if (writer && String(from) === pending && String(to) === stateFile) {
          renamed = true;
          historySaved.push(fs.readFileSync(stateFile));
        }
      }),
      t.mock.method(fs, "lstatSync", ((
        ...args: Parameters<typeof fs.lstatSync>
      ) => {
        if (
          writer &&
          selectedWrite &&
          state.historyFault === "after_effect" &&
          renamed &&
          String(args[0]) === stateFile
        )
          throw Object.assign(new Error("history_readback_fault"), {
            code: "EACCES",
          });
        return Reflect.apply(lstat, fs, args);
      }) as typeof fs.lstatSync),
      t.mock.method(
        fs,
        "rmSync",
        (target: fs.PathLike, options?: fs.RmOptions) => {
          remove(target, options);
          if (
            String(target) === lockPath &&
            ((writer && selectedWrite && state.historyFault === "release") ||
              (!writer && selectedRead && state.historyReadFault === "release"))
          )
            throw new Error("history_lock_release_unknown");
        },
      ),
    ];
    try {
      return model.saveRecoveryHistory(input, id, owner, kind);
    } finally {
      for (const hook of hooks.reverse()) hook.mock.restore();
    }
  };

  const body = transform(repairSource);
  /**
   * 終了候補と除去済み観測を実モデルで模擬する。
   * @responsibility 空操作集合だけから完了を推定しない。
   * @trace ERB-IT-014
   * @precondition 同じ自己生成Rootとexact履歴。
   * @stimulus Reader故障、対象あり／除去済み。
   * @observation 実候補と正規履歴行。
   * @oracle 対象履歴欠測はblocked。
   * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
   * @boundary 公開Readerと実保存物。Reader応答故障のみ代役。
   */
  const readCompletion = (_root: unknown, id: string) => {
    state.completionReads++;
    if (state.completionReads === state.completionReadFaultAt) {
      if (state.completionReadFault === "throw")
        throw new Error("completion_reader");
      if (state.completionReadFault === "owner") state.alive = false;
      return {
        ...model.readState(null, {
          scope: "recovery",
          input: {
            kind: "repair_completion",
            recoveryId: id,
          },
        }),
        lockReleased: state.completionReadFault !== "release",
      };
    }
    const observed = model.readState(_root, {
      scope: "recovery",
      input: {
        kind: "repair_completion",
        recoveryId: id,
      },
    });
    const deadline = observed.repairRetentionReviewAfter;
    return {
      ...observed,
      repairRetentionReviewAfter:
        deadline !== null &&
        state.completionDeadlineFault ===
          (observed.repairCompletionAbsent ? "fresh" : "before")
          ? new Date(Date.parse(deadline) + 1).toISOString()
          : deadline,
    };
  };
  const run = (body === repairSource ? repairFactory : compileRepair(body))({
    createHash,
    isDeepStrictEqual,
    snapshotJsonValue,
    randomBytes,
    randomUUID,
    ...model,
    ...stateValues,
    canonicalJson,
    Date: class extends Date {
      constructor(value?: string | number) {
        super(value ?? state.historyAt);
        if (value === undefined) state.dateReads++;
      }
    },
    observeRepairDirectories: (
      input: Parameters<
        typeof import("../../../docker-isolation/src/docker-desktop/repair-session.ts").observeRepairDirectories
      >[0],
    ) => {
      state.retentionReads++;
      if (
        !input.canObserve() ||
        input.signal.aborted ||
        state.retentionObservationFails
      )
        return null;
      return {
        primary: input.checkpoint.directories.primary.retained.identity,
        failed: input.checkpoint.directories.failed.retained.identity,
        auxiliary: input.checkpoint.directories.auxiliary.retained.identity,
      };
    },
    cleanupRepairDirectory: async (input: RepairDisposalInput) => {
      state.disposalCalls.push(input.purpose);
      if (input.canIssueEffect() !== true)
        return { request: "not_issued", absence: "unknown" };
      return {
        request:
          input.checkpoint.directories[input.purpose].expected === null
            ? "not_issued"
            : "issued",
        absence:
          state.disposalBlockedPurpose === input.purpose
            ? "unknown"
            : "confirmed_absent",
      };
    },
    readState: (
      root: unknown,
      envelope: {
        scope: "recovery";
        input?: { kind: string; recoveryId?: unknown };
      },
    ) => {
      assert.equal(envelope.scope, "recovery");
      const request = envelope.input ?? {
        kind: "current",
        recoveryId: undefined,
      };
      switch (request.kind) {
        case "history": {
          state.intakeReads++;
          state.readers++;
          const fault =
            state.intakeReadFaultAt === 0 ||
            state.intakeReads === state.intakeReadFaultAt
              ? state.intakeReadFault
              : "none";
          if (fault === "throw") throw new Error("intake_reader_fault");
          if (fault === "owner") state.alive = false;
          const observed = model.readState(root, {
            scope: "recovery",
            input: { kind: "history" },
          });
          return {
            ...observed,
            status: fault === "status" ? "blocked" : observed.status,
            value:
              fault === "storage" || fault === "absence"
                ? null
                : observed.value,
            lockReleased: fault !== "release" && observed.lockReleased,
          };
        }
        case "repair_history":
          if (typeof request.recoveryId !== "string")
            throw new Error("invalid recovery ID");
          return readHistory(root, request.recoveryId);
        case "repair_completion":
          if (typeof request.recoveryId !== "string")
            throw new Error("invalid recovery ID");
          return readCompletion(root, request.recoveryId);
        default:
          return (() => {
            state.readers++;
            const observed = model.readState(root, { scope: "recovery" });
            return {
              ...observed,
              lockReleased: observed.lockReleased && state.readerReleased,
            };
          })();
      }
    },
    saveRecoveryHistory: saveHistory,
    completeRecovery: (
      _root: unknown,
      id: string,
      owner: () => boolean,
      kind: "runtime_repair",
    ) => {
      assert.equal(kind, "runtime_repair");
      state.completionWrites++;
      assert.equal(owner(), true);
      state.completionBefore = Buffer.from(state.bytes as Buffer);
      const fault = state.completionFault;
      if (fault === "throw") throw new Error("completion_writer");
      if (fault === "owner") state.alive = false;
      const effect =
        fault === "none" || fault === "release" || fault === "after_effect";
      if (!effect)
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
          filesystemEffectIssued: false,
        };
      const result = model.completeRecovery(_root, id, owner, "runtime_repair");
      return fault === "none"
        ? result
        : {
            ...result,
            status: "blocked",
            snapshotConfirmed: fault === "release" && result.snapshotConfirmed,
            lockReleased: fault !== "release" && result.lockReleased,
          };
    },
    borrowRuntimeOwnedCoordinatorRecoveryRepository: (value: unknown) =>
      value === root
        ? {
            ...repository,
            revalidate: () => state.alive && repository.revalidate(),
          }
        : null,
    getRepository: () => ({ status: "completed", capability: root }),
    observeRepositoryExecutionDataArea: () => ({
      status: state.bytes ? "ready" : "not_observed",
    }),
    resumeRepairRecordSave: () => {
      state.publications++;
      if (state.publicationFault === "throw")
        throw new Error("publication_fault");
      if (state.publicationFault === "owner") state.alive = false;
      return {
        status:
          state.publicationFault === "none"
            ? state.publicationCompleted
              ? "completed"
              : "no_pending"
            : state.publicationFault === "status"
              ? "blocked"
              : "completed",
        lockReleased: state.publicationFault !== "release",
        snapshotConfirmed: state.publicationFault !== "snapshot",
        filesystemEffectIssued: state.publicationFault !== "none",
      };
    },
    saveRepairRecord: (
      _root: unknown,
      id: string,
      request: RepairSaveRequest,
      owner: () => unknown,
    ) => {
      state.calls++;
      const observed = model.readState(root, { scope: "recovery" });
      assert.equal(observed.lockReleased, true);
      const current = observed.value;
      if (current) {
        assert.equal(observed.status, "completed");
        assert.ok(state.bytes);
        assert.equal(current.sourceText, state.bytes.toString("utf8"));
      } else {
        assert.equal(state.bytes, null);
        assert.equal(observed.status, initial.status);
        assert.equal(observed.reason, initial.reason);
      }
      assert.deepEqual(
        request.expected,
        current
          ? {
              revision: current.snapshot.revision,
              payloadSha256: current.payloadSha256,
            }
          : null,
      );
      const change = request.change;
      if (
        (change.kind === "disposal_decision" && state.pauseBeforeDisposal) ||
        (change.kind === "disposal_progress" &&
          change.purpose === "primary" &&
          state.disposalProgressRefused &&
          change.checkpoint.directories.primary.absence === "confirmed_absent")
      ) {
        if (change.kind === "disposal_progress")
          state.disposalProgressRefused = false;
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
          value: null,
        };
      }
      const match =
        (state.fault === "retention" && change.kind === "retention_handoff") ||
        (change.kind === "checkpoint" &&
          (state.fault === "cleanup"
            ? change.update.checkpoint?.cleanup === "confirmed" &&
              change.update.outcome === null
            : state.fault === "outcome"
              ? change.update.outcome !== null
              : false));
      if (match && state.faultHits === 0) {
        state.faultHits++;
        state.faultsAt = state.calls;
        if (state.faultKind === "throw")
          throw new Error("synthetic_writer_failure");
        return {
          status: state.faultKind === "reject" ? "blocked" : "completed",
          snapshotConfirmed: state.faultKind === "release",
          lockReleased: state.faultKind !== "release",
          value: null,
        };
      }
      const result = model.saveRepairRecord(_root, id, request, owner);
      if (
        result.status !== "completed" ||
        !result.snapshotConfirmed ||
        !result.lockReleased
      )
        return result;
      const bytes = state.bytes;
      assert.ok(bytes);
      assert.ok(result.value);
      assert.equal(
        result.value.checkpointSettled,
        technicalValidation.isRepairCheckpointSettled(
          result.value.operation.checkpoint,
        ),
      );
      assert.equal(
        result.value.disposalSettled,
        technicalValidation.isRepairDisposalSettled(
          result.value.operation.disposal?.checkpoint,
        ),
      );
      saved.push(Buffer.from(bytes));
      if (state.cancelAfterWrite) controller.abort();
      if (state.lossAt === "prepared" && state.calls === 2) {
        state.alive = false;
        state.losses++;
        state.writesAtLoss = state.calls;
        state.bytesAtLoss = Buffer.from(bytes);
      }
      return result;
    },
    runRepairSession: (input: Input) => {
      state.entries++;
      late = input.onCheckpoint;
      /**
       * 技術Session終了時の通知・取消・回収結果を注入する。
       * @responsibility 技術Session終了時の通知・取消・回収結果を注入する。
       * @trace ERB-IT-014
       * @precondition 固定modeと同じSession/controller。
       * @stimulus joinedを増やし選択modeの失敗通知とcleanup/protocolを返す。
       * @observation close回数、一次失敗とcleanup分類。
       * @oracle 後着取消や回収不明が元失敗を消さない。
       * @cleanup 親fixtureが同じSessionの一回joinと購読解除を確認する。
       * @boundary Session終了代役。実Native/Processは生成しない。
       */
      const close = async () => {
        state.joined++;
        if (state.close.startsWith("cancel")) controller.abort();
        return state.close !== "unknown" && state.close !== "cancel_unknown";
      };
      return runRepairSessionWithDependencies(input, {
        acquire: async () => {
          state.acquired++;
          return {
            cleanupConfirmed: true,
            operations: {
              verify: () => true,
              command: async () => {
                throw new Error("unexpected_effect");
              },
              close,
            },
          };
        },
        prepare: async () => ({
          cleanupFailure: () =>
            state.observationCleanupUnknown && state.observed > 0
              ? "observation_cleanup_unknown"
              : null,
          technical: {
            observe: async (checkpoint) => {
              state.observed++;
              if (state.mode === "incomplete")
                throw new Error("synthetic_observation_unknown");
              const id = { dev: "1", ino: "1", birthtimeNs: "3" };
              return {
                ...checkpoint,
                directories: Object.fromEntries(
                  Object.entries(checkpoint.directories).map(([key, pair]) => [
                    key,
                    state.mode === "retained" && key === "primary"
                      ? {
                          expected: id,
                          source:
                            checkpoint.actions.retain_runtime.result ===
                            "confirmed"
                              ? { state: "absent", identity: null }
                              : { state: "present", identity: id },
                          retained:
                            checkpoint.actions.retain_runtime.result ===
                            "confirmed"
                              ? { state: "present", identity: id }
                              : { state: "absent", identity: null },
                        }
                      : {
                          ...pair,
                          source:
                            pair.source.state === "unobserved"
                              ? { state: "absent", identity: null }
                              : pair.source,
                          retained:
                            pair.retained.state === "unobserved"
                              ? { state: "absent", identity: null }
                              : pair.retained,
                        },
                  ]),
                ) as typeof checkpoint.directories,
                engine:
                  state.mode === "retained" &&
                  checkpoint.actions.retain_runtime.result !== "confirmed"
                    ? "unavailable"
                    : "ready",
                hostSafety: "safe",
                stale:
                  state.mode === "retained" &&
                  checkpoint.actions.retain_runtime.result === "confirmed"
                    ? "retained"
                    : "absent",
              };
            },
            precondition: async (action) =>
              (
                state.mode === "retained"
                  ? action === "retain_runtime"
                  : action === "stop_runtime" &&
                    !["ready", "incomplete"].includes(state.mode)
              )
                ? "proceed"
                : "not_required",
            execute: async (_action, checkpoint) => {
              state.effects++;
              if (state.lossAt === "effect") {
                state.alive = false;
                state.losses++;
                state.writesAtLoss = state.calls;
                state.bytesAtLoss =
                  state.bytes === null ? null : Buffer.from(state.bytes);
              }
              if (state.mode === "retained")
                return {
                  issued: true,
                  confirmation: "confirmed",
                  observation: {
                    ...checkpoint,
                    stale: "retained",
                    directories: {
                      ...checkpoint.directories,
                      primary: {
                        expected: checkpoint.directories.primary.expected,
                        source: { state: "absent", identity: null },
                        retained: {
                          state: "present",
                          identity: checkpoint.directories.primary.expected,
                        },
                      },
                    },
                  },
                };
              if (state.mode === "cancel") controller.abort();
              return state.mode === "effect_unknown"
                ? {
                    issued: null,
                    confirmation: "unknown",
                    observation: checkpoint,
                  }
                : {
                    issued: true,
                    confirmation: "confirmed",
                    observation: checkpoint,
                  };
            },
            awaitEngine: async () => ({ state: "ready", continuation: null }),
          },
        }),
      });
    },
  }) as typeof repairRuntimeOwnedDockerRuntime;

  if (base)
    t.after(() => {
      state.alive = false;
      controller.abort();
      // closeの呼出しを確認するだけ。注入したunknownの成功化ではない。
      assert.equal(state.joined, state.acquired, "finite_session_not_joined");
      assert.equal(fs.realpathSync.native(created.root), created.root);
      const area = path.join(created.root, ".crdd", "domain-model");
      for (const file of [
        path.join(created.root, ".crdd", "lock", "execution-model.state.lock"),
        path.join(area, "state.pending.json"),
        path.join(area, "history.pending.jsonl"),
      ])
        assert.throws(() => fs.lstatSync(file), { code: "ENOENT" });
      try {
        const info = fs.lstatSync(area);
        assert.ok(info.isDirectory() && !info.isSymbolicLink());
        assert.equal(fs.realpathSync.native(area), area);
        fs.rmSync(area, { recursive: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      assert.throws(() => fs.lstatSync(area), { code: "ENOENT" });
      activeSharedCase = null;
    });
  return {
    binding,
    root,
    repository,
    stateFile,
    historySaved,

    state,
    saved,
    controller,
    run: (id: string | null = null, purpose: "repair" | "retain" = "repair") =>
      run(root, controller.signal, id, purpose),
    late: () => late,
    snapshot: () =>
      (() => {
        const observed = model.readState(root, { scope: "recovery" });
        assert.equal(observed.status, "completed");
        assert.ok(observed.value);
        assert.equal(
          observed.value.sourceText,
          Buffer.from(
            state.bytes ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        );
        return observed.value;
      })()?.snapshot,
  };
}

/**
 * Source変異とcase依存の非共有を最小の有限入力で反証する。
 * @responsibility 正常factoryのcacheへ変異Sourceや前case依存を混ぜない。
 * @trace ERB-IT-014
 * @precondition 不変baseを使い、実修復操作を発行しない。
 * @stimulus 二種類のSource変異と通常の開始前取消を別caseへ渡す。
 * @observation 返却理由、開始数と各caseの終了hook。
 * @oracle 変異A/Bはそれぞれの値だけを返し、通常caseへ漏れない。
 * @cleanup 各caseのOwnerと保存領域を既存hookで終了する。
 * @boundary 未束縛factoryとcase依存。製品結果の成功を示さない。
 */
test("修復試験factoryはcase依存と変異Sourceを共有しない", async (t) => {
  for (const variant of ["a", "b"])
    await t.test(`変異 ${variant}`, async (t) => {
      const f = fixture(
        t,
        (source) =>
          source +
          "\nrepairRuntimeOwnedDockerRuntime = async () => ({status:'blocked', reason:'fixture_variant_" +
          variant +
          "'});",
        sharedRepairBase(),
      );
      const result = await f.run();
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, `fixture_variant_${variant}`);
      assert.equal(f.state.entries, 0);
    });
  await t.test("通常Source", async (t) => {
    const f = fixture(t, undefined, sharedRepairBase());
    f.controller.abort();
    const result = await f.run();
    assert.equal(result.status, "blocked");
    assert.notEqual(result.reason, "fixture_variant_a");
    assert.notEqual(result.reason, "fixture_variant_b");
    assert.equal(f.state.entries, 0);
  });
});

/**
 * 回収意図・部分結果・再入場を実modelの専用遷移へ接続する。
 * @responsibility 新Sessionを取得せず同IDの回収後に既存履歴を一度だけ確定する。
 * @trace ERB-IT-014
 * @trace ERB-IT-002
 * @precondition 実Caller・実model、WriterとDIはメモリ代役。
 * @stimulus 三用途成功、primary不明、処置後保存拒否からの再入場。
 * @observation 全DI用途列、元checkpoint／outcome、保存された要求履歴と不存在。
 * @oracle 不明で後続0、再入場はunknownを保全、全用途後だけ履歴と終了を確定する。
 * @cleanup 自己生成Rootを終了hookで回収する。実Docker要求0。
 * @boundary ERB-IT-014／ERB-IT-002=Direct Boundary: Caller→公開model／実Writer／有限DI代役。
 */
test("修復回収接続: 三用途と保存失敗後の要求不明を同IDで保持する", async (t) => {
  for (const failure of ["none", "unknown", "save"] as const) {
    const f = fixture(t);
    f.state.mode = "retained";
    f.state.pauseBeforeDisposal = false;
    if (failure === "unknown") f.state.disposalBlockedPurpose = "primary";
    if (failure === "save") f.state.disposalProgressRefused = true;
    const first = await f.run();
    assert.ok(first.recoveryId);
    assert.equal(first.status, failure === "none" ? "observed" : "blocked");
    const original =
      f.snapshot()?.operations[0] ??
      {
        snapshot: JSON.parse(
          Buffer.from(
            f.state.completionBefore ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      }?.snapshot.operations[0];
    assert.ok(original?.kind === "runtime_repair" && original.disposal);
    assert.equal(original.disposition, "discard");
    assert.equal(original.phase, "settling");
    assert.equal(first.completionConfirmed, failure === "none");
    assert.equal(f.state.historyWrites, failure === "none" ? 2 : 0);
    assert.equal(f.state.completionWrites, failure === "none" ? 1 : 0);
    assert.deepEqual(
      f.state.disposalCalls,
      failure === "none" ? ["primary", "failed", "auxiliary"] : ["primary"],
    );
    const before = {
      checkpoint: original.checkpoint,
      outcome: original.outcome,
      primaryFailure: original.primaryFailure,
      identityJson: original.identityJson,
    };
    const entries = f.state.entries;
    f.state.disposalBlockedPurpose = null;
    const again = await f.run(first.recoveryId);
    assert.equal(again.status, "observed");
    assert.equal(f.state.entries, entries);
    const final = {
      snapshot: JSON.parse(
        Buffer.from(
          f.state.completionBefore ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
    }?.snapshot.operations[0];
    assert.ok(final?.kind === "runtime_repair" && final.disposal);
    assert.deepEqual(
      {
        checkpoint: final.checkpoint,
        outcome: final.outcome,
        primaryFailure: final.primaryFailure,
        identityJson: final.identityJson,
      },
      before,
    );
    assert.deepEqual(
      Object.values(final.disposal.checkpoint.directories).map(
        (item) => item.absence,
      ),
      ["confirmed_absent", "confirmed_absent", "confirmed_absent"],
    );
    assert.equal(
      final.disposal.checkpoint.directories.primary.request,
      failure === "save" ? "unknown" : "issued",
    );
    assert.deepEqual(
      f.state.disposalCalls,
      failure === "none"
        ? ["primary", "failed", "auxiliary"]
        : ["primary", "primary", "failed", "auxiliary"],
    );
    assert.equal(f.state.historyWrites, 2);
    assert.equal(f.state.completionWrites, 1);
    assert.equal(f.snapshot()?.operations.length, 0);
    const history = model.readState(f.root, {
      scope: "recovery",
      input: { kind: "history" },
    });
    assert.equal(history.status, "completed", history.reason);
    assert.equal(history.lockReleased, true);
    const rows = history.historyRows;
    assert.ok(rows);
    assert.equal(rows?.length, 1);
    assert.equal(
      JSON.parse(rows?.[0]?.line ?? "null").summary.disposal.checkpoint
        .directories.primary.request,
      failure === "save" ? "unknown" : "issued",
    );
  }
});

/**
 * 修復・保持・exact再入場を履歴確認へ接続する。
 * @responsibility 二段保存と各段後fresh確認を技術処置から分離する。
 * @trace ERB-IT-014
 * @precondition 実compositionと公開保存操作、DIの技術Effectのみ代役。
 * @stimulus 新規成功、明示保持、確認済み再入場、取消済みmetadata確定。
 * @observation 履歴Writer件数、結果相関、技術入口増分。
 * @oracle 最大二段、確認済み再入場のWriter0、同exact・技術再取得0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 本番compositionの処理順。
 */
test("修復履歴接続: 成功・保持・取消後のexact確定を分ける", async (t) => {
  for (const retained of [false, true]) {
    const f = fixture(t);
    f.state.mode = retained ? "retained" : "ready";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    const result = retained
      ? await f.run(repaired.recoveryId, "retain")
      : repaired;
    assert.equal(result.status, "observed");
    assert.equal(result.historyConfirmed, true);
    assert.equal(result.outcomeConfirmed, true);
    assert.equal(result.historyEffectIssued, true);
    assert.equal(f.state.historyWrites, 2);
    const entries = f.state.entries,
      calls = f.state.calls,
      writes = f.state.historyWrites;
    const duplicate = await f.run(repaired.recoveryId);
    assert.equal(duplicate.status, "observed");
    assert.equal(duplicate.historyConfirmed, true);
    assert.equal(duplicate.retentionConfirmed, retained);
    assert.equal(duplicate.historyEffectIssued, false);
    assert.equal(f.state.historyWrites, writes);
    assert.equal(f.state.entries, entries);
    assert.equal(f.state.calls, calls);
  }
  const f = fixture(t);
  const original = await f.run();
  assert.ok(original.recoveryId);
  f.state.bytes = Buffer.from(f.saved.at(-1) ?? []);
  f.state.historyBytes = Buffer.alloc(0);
  f.controller.abort();
  const entries = f.state.entries,
    calls = f.state.calls,
    writes = f.state.historyWrites;
  const resumed = await f.run(original.recoveryId);
  assert.equal(resumed.status, "observed");
  assert.equal(resumed.historyConfirmed, true);
  assert.equal(f.state.historyWrites, writes + 2);
  assert.equal(f.state.entries, entries);
  assert.equal(f.state.calls, calls);
});

/**
 * 失敗履歴の再入場を技術処置と成功終了から分離する。
 * @responsibility 一次理由・回収不明とexact IDを保存故障後も維持する。
 * @trace ERB-IT-014
 * @precondition 実DI Machineと実値モデル、保存I/Oだけメモリ代替。
 * @stimulus 取消・境界故障・作成不明、二段保存の各故障、Abort済み再入場。
 * @observation 同ID履歴、操作本文、Native取得・completion件数。
 * @oracle 失敗理由不変、失敗操作保持、再実行0、再入場後の重複出版0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary compositionの履歴接続。実物保存はHost試験。
 */
{
  for (const mode of ["cancel", "effect_unknown"] as const)
    for (const close of ["clean", "unknown"] as const)
      test(
        "修復失敗履歴接続: 失敗と取消を記録し技術再実行しない — " +
          `失敗履歴 mode=${mode} close=${close}`,
        async (t) => {
          const f = fixture(t, undefined, sharedRepairBase());
          f.state.mode = mode;
          f.state.close = close;
          const first = await f.run();
          assert.ok(first.recoveryId);
          const operation = f.snapshot()?.operations[0];
          assert.ok(operation?.kind === "runtime_repair" && operation.outcome);
          assert.equal(first.reason, operation.outcome.reason);
          assert.equal(first.historyConfirmed, true, `${mode}:${close}`);
          assert.equal(
            first.operationCleanupConfirmed,
            operation.checkpoint?.cleanup === "confirmed",
          );
          assert.equal(first.completionConfirmed, false);
          assert.equal(f.state.completionWrites, 0);
          const history = model.readState(f.root, {
            scope: "recovery",
            input: { kind: "history" },
          });
          assert.equal(history.status, "completed", history.reason);
          assert.equal(history.lockReleased, true);
          const rows = history.historyRows;
          assert.ok(rows);
          assert.equal(rows?.length, 1);
          const counts = {
            entries: f.state.entries,
            effects: f.state.effects,
            acquired: f.state.acquired,
            history: f.state.historyWrites,
            writes: f.state.calls,
          };
          const original = Buffer.from(f.state.bytes as Buffer);
          f.controller.abort();
          const again = await f.run(first.recoveryId);
          assert.equal(again.status, "observed");
          assert.equal(again.reason, first.reason);
          assert.equal(again.historyConfirmed, true);
          assert.equal(again.completionConfirmed, false);
          assert.equal(
            again.operationCleanupConfirmed,
            first.operationCleanupConfirmed,
          );
          assert.ok(f.state.bytes?.equals(original));
          assert.deepEqual(
            {
              entries: f.state.entries,
              effects: f.state.effects,
              acquired: f.state.acquired,
              history: f.state.historyWrites,
              writes: f.state.calls,
            },
            counts,
          );
        },
      );
  for (const stage of [1, 2])
    for (const fault of [
      "reject",
      "release",
      "throw",
      "owner",
      "after_effect",
    ] as const)
      test(
        "修復失敗履歴接続: 失敗と取消を記録し技術再実行しない — " +
          `失敗履歴 stage=${stage} fault=${fault}`,
        async (t) => {
          const f = fixture(t, undefined, sharedRepairBase());
          f.state.mode = "effect_unknown";
          f.state.close = "unknown";
          f.state.historyFaultAt = stage;
          f.state.historyFault = fault;
          const failed = await f.run();
          assert.equal(failed.status, "blocked");
          assert.equal(failed.reason, "runtime_repair_effect_unknown");
          assert.equal(failed.outcomeConfirmed, true);
          assert.equal(failed.historyConfirmed, false);
          assert.equal(failed.operationCleanupConfirmed, false);
          assert.equal(failed.completionConfirmed, false);
          assert.equal(f.state.historyWrites, stage);
          assert.equal(f.state.completionWrites, 0);
          assert.ok(failed.recoveryId);
          const entries = f.state.entries;
          f.state.alive = true;
          f.state.historyFaultAt = 0;
          f.controller.abort();
          const resumed = await f.run(failed.recoveryId);
          assert.equal(resumed.reason, failed.reason);
          assert.equal(resumed.historyConfirmed, true);
          assert.equal(resumed.completionConfirmed, false);
          assert.equal(f.state.entries, entries);
        },
      );
  test(
    "修復失敗履歴接続: 失敗と取消を記録し技術再実行しない — " +
      "失敗履歴 retained cleanup=unknown",
    async (t) => {
      const retained = fixture(t, undefined, sharedRepairBase());
      retained.state.mode = "retained";
      retained.state.close = "unknown";
      const pending = await retained.run();
      const operation = retained.snapshot()?.operations[0];
      assert.ok(operation?.kind === "runtime_repair");
      assert.equal(operation.outcome?.status, "blocked");
      assert.equal(operation.disposition, "pending_human_decision");
      assert.equal(pending.historyConfirmed, false);
      assert.equal(retained.state.historyWrites, 0);
    },
  );
}
/**
 * 個別Native回収と観測資源を含む集約回収を混同しない。
 * @responsibility 同呼出しの既知成功を保持し、freshでは詳細を補完しない。
 * @trace ERB-IT-014
 * @precondition 実Runtimeの観測回収不明とNative回収成功。
 * @stimulus 正規履歴投影と既知trueを上書きする変異。
 * @observation first／freshのNative確認、集約checkpoint、履歴と取得回数。
 * @oracle firstはNative true・集約unknown、freshはNative false・本文不変・再取得0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 個別生涯結果と履歴の有限投影。
 */
test("修復失敗履歴: 既知Native回収と集約不明を別に保持する", async (t) => {
  for (const mutant of [false, true]) {
    const f = fixture(t, (source) => {
      if (!mutant) return source;
      const changed = source.replace(
        /operationCleanupConfirmed =\s*operationCleanupConfirmed \|\|\s*(operation\.checkpoint\?\.cleanup === "confirmed");/u,
        "operationCleanupConfirmed = $1;",
      );
      assert.notEqual(changed, source);
      return changed;
    });
    f.state.observationCleanupUnknown = true;
    const first = await f.run();
    assert.ok(first.recoveryId);
    const operation = f.snapshot()?.operations[0];
    assert.ok(operation?.kind === "runtime_repair");
    assert.equal(operation.checkpoint?.cleanup, "unknown");
    assert.equal(
      operation.checkpoint?.cleanupFailure,
      "observation_cleanup_unknown",
    );
    assert.equal(first.historyConfirmed, true);
    assert.equal(first.completionConfirmed, false);
    /**
     * 同呼出しで観測したNative回収成功を返却値で確認する。
     * @responsibility 正規実装と上書き変異へ同じOracleを適用する。
     * @trace ERB-IT-014
     * @precondition 実Runtimeの返却と集約回収不明を確認済み。
     * @stimulus firstのNative確認field。
     * @observation 同じassertionの成功または拒否。
     * @oracle 集約unknownでも既知Native trueを維持する。
     * @cleanup N/A: 同期の値確認だけ。
     * @boundary 個別回収と集約回収の区別。
     */
    const checkKnown = () =>
      assert.equal(first.operationCleanupConfirmed, true);
    if (mutant) {
      assert.throws(checkKnown);
      continue;
    }
    checkKnown();
    const before = Buffer.from(f.state.bytes as Buffer);
    const entries = f.state.entries,
      acquired = f.state.acquired;
    f.controller.abort();
    const fresh = await f.run(first.recoveryId);
    assert.equal(fresh.reason, first.reason);
    assert.equal(fresh.operationCleanupConfirmed, false);
    assert.equal(fresh.historyConfirmed, true);
    assert.equal(fresh.completionConfirmed, false);
    assert.ok(f.state.bytes?.equals(before));
    assert.equal(f.state.entries, entries);
    assert.equal(f.state.acquired, acquired);
  }
});

/**
 * 現在状態除去と除去後のfresh再確認を本番compositionへ接続する。
 * @responsibility 履歴からNativeや技術結果の詳細を復元しない。
 * @trace ERB-IT-014
 * @precondition 同じ実モデルを使う修復成功。
 * @stimulus 通常終了、取消済み同ID再入場、保持済み。
 * @observation 現在操作、終了確認、技術入口と保存回数。
 * @oracle 対象除去とexact履歴、再入場DI0、保持物除去0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 本番compositionと模擬保存I/O。
 */
{
  test(
    "修復終了接続: 終了保存と除去後再確認を技術再実行から分ける — " +
      "終了 保存前取消",
    async (t) => {
      const cancelled = fixture(t, undefined, sharedRepairBase());
      cancelled.controller.abort();
      const refused = await cancelled.run();
      assert.equal(refused.status, "blocked");
      assert.equal(cancelled.state.entries, 0);
      assert.equal(cancelled.state.calls, 0);
      assert.equal(cancelled.state.effects, 0);
    },
  );
  test(
    "修復終了接続: 終了保存と除去後再確認を技術再実行から分ける — " +
      "終了 正常・取消済み再入場",
    async (t) => {
      const f = fixture(t, undefined, sharedRepairBase());
      const result = await f.run();
      assert.ok(result.recoveryId);
      assert.equal(result.completionConfirmed, true);
      assert.equal(result.historyConfirmed, true);
      assert.equal(result.outcomeConfirmed, true);
      assert.equal(result.completionEffectIssued, true);
      assert.equal(f.snapshot()?.operations.length, 0);
      const history = model.readState(f.root, {
        scope: "recovery",
        input: { kind: "history" },
      });
      assert.equal(history.status, "completed", history.reason);
      assert.equal(history.lockReleased, true);
      assert.equal(history.historyRows?.length, 1);
      const counts = {
        entries: f.state.entries,
        calls: f.state.calls,
        writes: f.state.completionWrites,
        history: f.state.historyWrites,
      };
      f.controller.abort();
      const duplicate = await f.run(result.recoveryId);
      assert.equal(duplicate.status, "observed");
      assert.equal(duplicate.completionConfirmed, true);
      assert.equal(duplicate.historyConfirmed, true);
      assert.equal(duplicate.outcomeConfirmed, false);
      assert.equal(duplicate.operationCleanupConfirmed, false);
      assert.equal(duplicate.finalCheckpointConfirmed, false);
      assert.equal(duplicate.completionEffectIssued, false);
      assert.deepEqual(
        {
          entries: f.state.entries,
          calls: f.state.calls,
          writes: f.state.completionWrites,
          history: f.state.historyWrites,
        },
        counts,
      );
    },
  );
  test(
    "修復終了接続: 終了保存と除去後再確認を技術再実行から分ける — " +
      "終了 保持済み",
    async (t) => {
      const retained = fixture(t, undefined, sharedRepairBase());
      retained.state.mode = "retained";
      const first = await retained.run();
      assert.ok(first.recoveryId);
      const kept = await retained.run(first.recoveryId, "retain");
      assert.equal(kept.completionConfirmed, true);
      assert.equal(retained.state.completionWrites, 1);
      assert.equal(retained.snapshot()?.operations.length, 0);
    },
  );
}
/**
 * 終了Writerの失敗後に先行結果を保持し同IDだけで再入場する。
 * @responsibility 保存不明を技術再試行へ読み替えない。
 * @trace ERB-IT-014
 * @precondition outcomeと履歴は同呼出しで確認済み。
 * @stimulus 拒否・解放不明・例外・Owner喪失・発行後失敗。
 * @observation 各確認値とEffect、再入場のDI／履歴Writer増分。
 * @oracle 先行事実true、completion false、技術再取得0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 本番compositionの終了保存。
 */
{
  for (const fault of [
    "reject",
    "release",
    "throw",
    "owner",
    "after_effect",
  ] as const)
    test(
      "修復終了接続: Writer不明でも先行事実を保持しmetadataだけ再開する — " +
        `終了Writer fault=${fault}`,
      async (t) => {
        const f = fixture(t, undefined, sharedRepairBase());
        f.state.completionFault = fault;
        const result = await f.run();
        assert.ok(result.recoveryId);
        assert.equal(result.status, "blocked", fault);
        assert.equal(result.outcomeConfirmed, true, fault);
        assert.equal(result.historyConfirmed, true, fault);
        assert.equal(result.completionConfirmed, false, fault);
        assert.equal(
          result.completionEffectIssued,
          fault === "throw"
            ? null
            : ["release", "after_effect"].includes(fault),
          fault,
        );
        const counts = {
          entries: f.state.entries,
          calls: f.state.calls,
          history: f.state.historyWrites,
        };
        f.state.alive = true;
        f.state.completionFault = "none";
        f.controller.abort();
        const resumed = await f.run(result.recoveryId);
        assert.equal(resumed.status, "observed", fault);
        assert.equal(resumed.completionConfirmed, true, fault);
        assert.deepEqual(
          {
            entries: f.state.entries,
            calls: f.state.calls,
            history: f.state.historyWrites,
          },
          counts,
        );
      },
    );
}
/**
 * 終了Readerと保存確認の失敗を段階ごとに停止する。
 * @responsibility 解放不明と例外を既知の成功へ補完しない。
 * @trace ERB-IT-014
 * @precondition 同呼出しで履歴確認後の終了処理。
 * @stimulus 初回／除去後Readerと保存の各共同field欠落。
 * @observation 終了確認、先行事実、後段保存／DI件数。
 * @oracle completion false、先行結果保持、失敗後fallback0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary Reader／Writer／Lockの個別lifecycle。
 */
{
  for (const stage of ["before", "after"] as const)
    for (const fault of ["reject", "release", "throw", "owner"] as const)
      test(
        "修復終了接続: Readerと清掃の不明はsticky停止する — " +
          `終了Reader stage=${stage} fault=${fault}`,
        async (t) => {
          const f = fixture(t, undefined, sharedRepairBase());
          // 公開Writer内部のReaderをCaller側の注入回数へ数えない。
          f.state.completionReadFaultAt = stage === "before" ? 1 : 2;
          f.state.completionReadFault = fault;
          const result = await f.run();
          assert.equal(result.status, "blocked");
          assert.equal(result.completionConfirmed, false);
          assert.equal(result.historyConfirmed, true);
          assert.equal(result.outcomeConfirmed, true);
          assert.equal(f.state.completionReads, f.state.completionReadFaultAt);
          assert.equal(f.state.completionWrites, stage === "before" ? 0 : 1);
          assert.equal(f.state.entries, 1);
          assert.equal(f.state.historyWrites, 2);
          assert.equal(
            result.completionLockReleased,
            fault === "throw" ? null : fault !== "release",
          );
        },
      );
  for (const fault of [
    "none",
    "reject",
    "release",
    "throw",
    "owner",
    "after_effect",
  ] as const)
    test(`修復終了接続: markerなしで終端保存の事実を保持する — ${fault}`, async (t) => {
      const f = fixture(t, undefined, sharedRepairBase());
      f.state.completionFault = fault;
      const result = await f.run();
      assert.equal(result.historyConfirmed, true, fault);
      assert.equal(result.outcomeConfirmed, true, fault);
      assert.equal(result.completionConfirmed, fault === "none", fault);
      assert.equal(f.state.completionWrites, 1, fault);
      assert.equal(f.state.entries, 1, fault);
      assert.equal(f.state.historyWrites, 2, fault);
      assert.equal(Object.hasOwn(result, "stateMarkerCleanup"), false);
      assert.equal(
        fs.existsSync(path.join(path.dirname(f.stateFile), "state.lock")),
        false,
      );
    });
}
/**
 * 履歴各段の失敗後に保存済み結果と既知Effectを保持する。
 * @responsibility 表示結果の失敗と技術失敗を混同しない。
 * @trace ERB-IT-014
 * @precondition 技術結果は同呼出し内で保存済み。
 * @stimulus 履歴一段目／二段目の拒否・例外・解放不明・Owner失効・発行後失敗。
 * @observation 確定済みoutcome、保持判断、exact参照と履歴Effect。
 * @oracle 失敗後の次段0、outcome巻戻し0、Native再実行0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary compositionの結果搬送。
 */
{
  for (const retained of [false, true])
    for (const stage of [1, 2])
      for (const fault of [
        "reject",
        "release",
        "throw",
        "owner",
        "after_effect",
      ] as const)
        test(
          "修復履歴接続: 保存失敗でも技術結果と保持判断を失わない — " +
            "retained=" +
            retained +
            " stage=" +
            stage +
            " fault=" +
            fault,
          async (t) => {
            const f = fixture(t, undefined, sharedRepairBase());
            f.state.mode = retained ? "retained" : "ready";
            let id: string | null = null;
            if (retained) id = (await f.run()).recoveryId;
            f.state.historyFaultAt = stage;
            f.state.historyFault = fault;
            const result = await f.run(id, retained ? "retain" : "repair");
            assert.equal(
              result.status,
              "blocked",
              `${retained}:${stage}:${fault}`,
            );
            assert.equal(result.outcomeConfirmed, true);
            assert.equal(result.retentionConfirmed, retained);
            assert.equal(result.historyConfirmed, false);
            assert.equal(result.operationCleanupConfirmed, true);
            assert.equal(result.finalCheckpointConfirmed, true);
            const target = f.snapshot()?.operations[0];
            assert.ok(target?.kind === "runtime_repair");
            assert.equal(target.outcome?.status, "recovered");
            assert.equal(result.recoveryId, target.recoveryId);
            assert.equal(f.state.historyWrites, stage);
            assert.equal(f.state.entries, 1);
            assert.equal(
              result.historyEffectIssued,
              stage === 2 || fault === "release" || fault === "after_effect",
            );
          },
        );
}

/**
 * 各保存後のfresh確認を欠いた成功を拒否する。
 * @responsibility 書込み結果だけで履歴完了としない。
 * @trace ERB-IT-014
 * @precondition 新規recovered結果の保存後。
 * @stimulus 初回・一段後・二段後Readerの拒否・解放不明・例外・Owner失効。
 * @observation 実モデルの保存事実と履歴確認の分離。
 * @oracle 先行outcomeと既知Effect保持、後段0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary fresh観測と呼出し生存。
 */
{
  for (const stage of [1, 2, 3])
    for (const fault of ["reject", "release", "throw", "owner"] as const)
      test(
        "修復履歴接続: 各段後のfresh確認不明で停止する — " +
          `履歴fresh stage=${stage} fault=${fault}`,
        async (t) => {
          const f = fixture(t, undefined, sharedRepairBase());
          f.state.historyReadFaultAt = stage;
          f.state.historyReadFault = fault;
          const result = await f.run();
          assert.equal(result.status, "blocked");
          assert.equal(result.outcomeConfirmed, true);
          assert.equal(result.historyConfirmed, false);
          assert.equal(result.historyEffectIssued, stage > 1);
          assert.equal(f.state.historyWrites, stage - 1);
          assert.equal(f.state.entries, 1);
          assert.equal(
            f.snapshot()?.operations[0]?.outcome?.status,
            "recovered",
          );
        },
      );
}
/**
 * 保持済みのexact再入場で過去の保持確認を落とさない。
 * @responsibility 新しい保持判断と保存済み保持事実の投影を区別する。
 * @trace ERB-IT-014
 * @precondition 保持判断が耐久済みの同exact修復。
 * @stimulus 履歴未開始・一段後・確認済みと一段目／二段目の故障。
 * @observation 保持・outcome・履歴確認と技術入口増分。
 * @oracle 保持事実true、履歴失敗後も事実保持、重複判断の発行0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary metadata再入場と結果搬送。
 */
{
  for (const stage of [
    "unstarted",
    "checkpoint",
    "confirmed",
    "fail_first",
    "fail_second",
  ] as const)
    test(
      "修復履歴接続: 保持済みの再入場でも保持確認を返す — " + stage,
      async (t) => {
        const f = fixture(t, undefined, sharedRepairBase());
        f.state.mode = "retained";
        const repaired = await f.run();
        assert.ok(repaired.recoveryId);
        const retained = await f.run(repaired.recoveryId, "retain");
        assert.equal(
          retained.retentionConfirmed,
          true,
          JSON.stringify(retained),
        );
        const raw = f.saved.at(-1);
        assert.ok(raw);
        if (stage !== "confirmed") {
          f.state.bytes = Buffer.from(raw);
          f.state.historyBytes = Buffer.alloc(0);
          if (stage === "checkpoint") {
            const target = f
              .snapshot()
              ?.operations.find(
                (item) => item.recoveryId === repaired.recoveryId,
              );
            assert.ok(target);
            const owner = {
              ...f.repository,
              historyRetentionDays: 30,
              operationId: JSON.parse(target.identityJson).operationId,
            };
            const saved = model.saveRecoveryHistory(
              owner,
              repaired.recoveryId,
              () =>
                !JSON.parse(
                  fs.readFileSync(f.stateFile, "utf8"),
                ).operations.some(
                  (item: { recoveryId: string; history: unknown }) =>
                    item.recoveryId === repaired.recoveryId &&
                    item.history !== null,
                ),
              "runtime_repair",
            );
            assert.equal(saved.status, "blocked");
            assert.equal(saved.snapshotConfirmed, false);
            assert.equal(saved.lockReleased, true);
            assert.equal(saved.historyConfirmed, false);
          }
        }
        if (stage !== "confirmed") {
          const read = model.readState(
            {
              root: f.repository.root,
              historyRetentionDays: 30,
              revalidate: () => true,
            },
            {
              scope: "recovery",
              input: {
                kind: "repair_history",
                recoveryId: repaired.recoveryId,
              },
            },
          );
          assert.equal(read.status, "completed", `${stage}: ${read.reason}`);
          if (stage === "checkpoint") {
            assert.equal(read.currentHistoryPublication?.stage, "publish");
            assert.equal(
              read.value?.snapshot.operations.find(
                (item) => item.recoveryId === repaired.recoveryId,
              )?.history?.confirmed,
              false,
            );
          }
        }
        const writes = f.state.historyWrites,
          calls = f.state.calls,
          entries = f.state.entries;
        if (stage === "fail_first" || stage === "fail_second") {
          f.state.historyFaultAt = writes + (stage === "fail_first" ? 1 : 2);
          f.state.historyFault = "reject";
        }
        const result = await f.run(repaired.recoveryId);
        assert.equal(
          result.status,
          stage.startsWith("fail_") ? "blocked" : "observed",
          `${stage}: ${JSON.stringify(result)}`,
        );
        assert.equal(result.outcomeConfirmed, stage !== "confirmed");
        assert.equal(result.retentionConfirmed, true);
        assert.equal(result.historyConfirmed, !stage.startsWith("fail_"));
        assert.equal(f.state.calls, calls);
        assert.equal(f.state.entries, entries);
        assert.equal(
          f.state.historyWrites - writes,
          stage === "confirmed"
            ? 0
            : stage === "checkpoint" || stage === "fail_first"
              ? 1
              : 2,
        );
      },
    );
}

/**
 * 前置読取りの解放観測と限定metadata救済の結果を保持する。
 * @responsibility blockedを技術許可へ変換しない。
 * @trace ERB-IT-014
 * @precondition 同exact修復の確認済み履歴。
 * @stimulus 前置Reader拒否と解放不明。
 * @observation lock観測、publisher件数、後続Writer／DI。
 * @oracle 解放不明は全後段0、救済no_pendingはDI0。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 前置観測とmetadataだけの再入場。
 */
test("修復履歴接続: 前置Reader拒否を技術再開に使わない", async (t) => {
  for (const fault of ["reject", "release"] as const) {
    const f = fixture(t);
    f.state.mode = "incomplete";
    const first = await f.run();
    assert.ok(first.recoveryId);
    f.state.historyReadFaultAt = f.state.historyReads + 1;
    f.state.historyReadFault = fault;
    const calls = f.state.calls,
      entries = f.state.entries,
      publications = f.state.publications,
      writes = f.state.historyWrites;
    const result = await f.run(first.recoveryId);
    assert.equal(result.status, "blocked");
    assert.equal(result.historyLockReleased, fault !== "release");
    assert.equal(
      f.state.publications - publications,
      fault === "reject" ? 1 : 0,
    );
    assert.equal(f.state.historyWrites, writes);
    assert.equal(f.state.calls, calls);
    assert.equal(f.state.entries, entries);
  }
});

/**
 * 明示保持の接続が技術Sessionへ再入場しないことを確認する。
 * @responsibility 保存判断と新しいDocker処置を分離する。
 * @trace ERB-IT-014
 * @precondition 実DIモデルの修復成功と保持待ちを保存済み。
 * @stimulus exact保持、保存後の取消、同じ判断の再入力。
 * @observation 保持保存一回と履歴二段、対象外全文・技術入口件数不変。
 * @oracle receipt保存・一行履歴・除去を分け、再入場で日時と観測を再生成しない。
 * @cleanup N/A: 模擬I/Oと自己生成Rootは既存終了hookで回収する。
 * @boundary 実compositionと実モデル。物理Writerは別Host試験。
 */
test("修復保持接続: 明示判断の保存だけを行い技術再操作しない", async (t) => {
  for (const cancelAfterWrite of [false, true]) {
    const f = fixture(t);
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.equal(repaired.outcomeConfirmed, true);
    const before = f.snapshot();
    const target = before?.operations[0];
    assert.ok(before && target?.kind === "runtime_repair");
    assert.equal(target.phase, "awaiting_disposition");
    const counts = {
      writes: f.state.calls,
      entries: f.state.entries,
      acquired: f.state.acquired,
      effects: f.state.effects,
    };
    f.state.cancelAfterWrite = cancelAfterWrite;
    const result = await f.run(target.recoveryId, "retain");
    assert.equal(result.status, "observed");
    assert.equal(
      "retentionConfirmed" in result && result.retentionConfirmed,
      true,
    );
    assert.equal(result.technicalStatus, null);
    assert.equal(f.state.calls, counts.writes + 1);
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.acquired, counts.acquired);
    assert.equal(f.state.effects, counts.effects);
    assert.equal(f.controller.signal.aborted, cancelAfterWrite);
    assert.ok(target.checkpoint);
    const final = f.snapshot();
    assert.ok(final);
    assert.ok(f.state.completionBefore);
    assert.deepEqual(final, {
      ...before,
      revision: before.revision + 4,
      previous: {
        revision: before.revision + 3,
        payloadSha256: createHash("sha256")
          .update(f.state.completionBefore)
          .digest("hex"),
      },
      operations: before.operations.filter(
        (item) => item.recoveryId !== target.recoveryId,
      ),
    });
    const savedRetention = {
      snapshot: JSON.parse(
        Buffer.from(
          f.saved.at(-1) ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
    }?.snapshot.operations.find(
      (item) => item.recoveryId === target.recoveryId,
    );
    assert.equal(savedRetention?.kind, "runtime_repair");
    if (savedRetention?.kind !== "runtime_repair")
      throw new Error("retention_missing");
    assert.deepEqual(savedRetention.retention, {
      decidedAt: f.state.historyAt,
      reviewAfter: "2026-10-23T00:00:00.000Z",
      targets: {
        primary: target.checkpoint.directories.primary.retained.identity,
        failed: target.checkpoint.directories.failed.retained.identity,
        auxiliary: target.checkpoint.directories.auxiliary.retained.identity,
      },
    });
    assert.equal(result.completionConfirmed, true);
    assert.equal(result.retentionReviewAfter, "2026-10-23T00:00:00.000Z");
    assert.equal(result.historyConfirmed, true);
    assert.equal(f.state.historyWrites, 2);
    assert.deepEqual(
      f.snapshot()?.unresolvedRecoveries,
      before.unresolvedRecoveries,
    );
    assert.ok(f.snapshot());
    assert.equal(Object.hasOwn(f.snapshot(), "pendingDeliveries"), false);
    assert.ok(before);
    assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
    const saved = Buffer.from(f.state.bytes ?? []);
    const reads = f.state.retentionReads,
      dates = f.state.dateReads;
    const duplicate = await f.run(target.recoveryId, "retain");
    assert.equal(duplicate.status, "observed");
    assert.equal(duplicate.completionConfirmed, true);
    assert.equal(duplicate.retentionReviewAfter, result.retentionReviewAfter);
    assert.equal(duplicate.operationCleanupConfirmed, false);
    assert.equal(duplicate.finalCheckpointConfirmed, false);
    assert.equal(f.state.retentionReads, reads);
    assert.equal(f.state.dateReads, dates);
    assert.equal(f.state.calls, counts.writes + 1);
    assert.ok(f.state.bytes?.equals(saved));
  }
});

/**
 * 保持観測と保存期限の不一致を成功へ丸めない。
 * @responsibility 旧保持の昇格とReader期限の差を拒否する。
 * @trace ERB-IT-014
 * @precondition 保持待ちの同一修復。
 * @stimulus 保持観測失敗、終了前後の期限差、旧receipt欠測。
 * @observation 保存済み期限、処置・日時生成件数、同ID再入場。
 * @oracle 観測失敗／旧保持は書込み0、期限差後も元receiptだけで再開する。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 模擬Ownerの失効と実composition。
 */
test("修復保持接続: 期限差と旧保持を成功へ補完しない", async (t) => {
  for (const fault of ["observation", "before", "fresh", "legacy"] as const) {
    const f = fixture(t);
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    if (fault === "legacy") {
      const value = f.snapshot();
      assert.ok(value);
      f.state.bytes = Buffer.from(
        `${canonicalJson({ ...value, operations: value.operations.map((operation) => ({ ...operation, phase: "settling", disposition: "retained_by_human_decision" })) })}\n`,
      );
      assert.ok(
        (() => {
          const observed = model.readState(f.root, { scope: "recovery" });
          assert.equal(observed.status, "completed");
          assert.ok(observed.value);
          assert.equal(
            observed.value.sourceText,
            Buffer.from(
              f.state.bytes ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          );
          return observed.value;
        })(),
      );
    }
    const before = Buffer.from(f.state.bytes as Buffer),
      writes = f.state.calls,
      dateReads = f.state.dateReads;
    if (fault === "observation") f.state.retentionObservationFails = true;
    if (fault === "before" || fault === "fresh")
      f.state.completionDeadlineFault = fault;
    const result = await f.run(repaired.recoveryId, "retain");
    assert.equal(result.status, "blocked", fault);
    assert.equal(result.completionConfirmed, false, fault);
    if (fault === "observation" || fault === "legacy") {
      assert.equal(result.retentionConfirmed, false);
      assert.equal(result.retentionReviewAfter, null);
      assert.equal(f.state.calls, writes);
      assert.equal(f.state.dateReads, dateReads);
      assert.ok(f.state.bytes?.equals(before));
    } else {
      assert.equal(result.retentionReviewAfter, "2026-10-23T00:00:00.000Z");
      const reads = f.state.retentionReads,
        dates = f.state.dateReads;
      f.state.completionDeadlineFault = "none";
      const retried = await f.run(repaired.recoveryId, "retain");
      assert.equal(retried.status, "observed");
      assert.equal(retried.completionConfirmed, true);
      assert.equal(retried.retentionReviewAfter, result.retentionReviewAfter);
      assert.equal(f.state.retentionReads, reads);
      assert.equal(f.state.dateReads, dates);
    }
  }
  for (const fault of ["history_intake", "fresh"] as const) {
    const f = fixture(t);
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    const completed = await f.run(repaired.recoveryId, "retain");
    assert.equal(completed.completionConfirmed, true);
    if (fault === "history_intake") f.state.intakeReadFault = "absence";
    else {
      f.state.completionReadFaultAt = f.state.completionReads + 2;
      f.state.completionReadFault = "reject";
    }
    const reads = f.state.retentionReads,
      dates = f.state.dateReads;
    const stopped = await f.run(repaired.recoveryId, "retain");
    assert.equal(stopped.status, "blocked");
    assert.equal(stopped.retentionConfirmed, true);
    assert.equal(stopped.retentionReviewAfter, completed.retentionReviewAfter);
    assert.equal(stopped.completionConfirmed, false);
    assert.equal(stopped.finalCheckpointConfirmed, false);
    assert.equal(stopped.operationCleanupConfirmed, false);
    const report = renderDockerRecoveryDoctorReport(
      {
        ...stopped,
        contract: "crdd-coordinator/current-runtime-repair",
        cliCleanupConfirmed: true,
        cliCleanupReason: null,
      },
      true,
    );
    assert.equal(report.exitCode, 2);
    assert.equal(
      JSON.parse(report.stdout).retentionReviewAfter,
      completed.retentionReviewAfter,
    );
    assert.equal(f.state.retentionReads, reads);
    assert.equal(f.state.dateReads, dates);
  }
});

/**
 * 保持前の明示拒否を新しい技術処置へ変換しない。
 * @responsibility 取消・参照欠測・別参照・Owner失効で保存を止める。
 * @trace ERB-IT-014
 * @precondition 保持待ちの同じ修復。
 * @stimulus 四種類の判断前拒否。
 * @observation 保存要求、技術取得、元本文。
 * @oracle 全処置0で元本文不変。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 模擬I/Oと実composition。
 */
test("修復保持接続: 判断前の拒否では保存も技術取得も行わない", async (t) => {
  for (const fault of [
    "cancel",
    "missing_id",
    "different_id",
    "owner",
  ] as const) {
    const f = fixture(t);
    f.state.mode = "retained";
    await f.run();
    const target = f.snapshot()?.operations[0];
    assert.ok(target?.kind === "runtime_repair");
    const before = Buffer.from(f.state.bytes ?? []);
    const writes = f.state.calls,
      entries = f.state.entries;
    if (fault === "cancel") f.controller.abort();
    if (fault === "owner") f.state.intakeReadFault = "owner";
    const result = await f.run(
      fault === "missing_id"
        ? null
        : fault === "different_id"
          ? `${target.recoveryId}0`
          : target.recoveryId,
      "retain",
    );
    assert.equal(result.status, "blocked", fault);
    assert.equal(f.state.calls, writes, fault);
    assert.equal(f.state.entries, entries, fault);
    assert.ok(f.state.bytes?.equals(before), fault);
  }
});

/**
 * 同じ呼出しの出版確認と保持済みの値を共同で要求する。
 * @responsibility fresh保存確定と単なる重複判断を区別する。
 * @trace ERB-IT-014
 * @precondition 保持済みの正規本文。物理出版の成立は別Host正例。
 * @stimulus completed／no_pendingと出版・Reader・Ownerの部分不成立。
 * @observation 保持確認、WriterとDI増分0、本文不変。
 * @oracle 当該呼出しの出版確認なしでは保持完了を返さない。
 * @cleanup N/A: 模擬I/Oと自己生成Rootは既存終了hookで回収する。
 * @boundary 実compositionと模擬publisherの結果搬送。
 */
test("修復保持接続: fresh出版確認だけを追加保存なしで返す", async (t) => {
  for (const fault of [
    "none",
    "no_pending",
    "reader",
    "different_id",
  ] as const) {
    const f = fixture(t);
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    f.state.historyFaultAt = 1;
    f.state.historyFault = "reject";
    const retained = await f.run(repaired.recoveryId, "retain");
    assert.equal(
      "retentionConfirmed" in retained && retained.retentionConfirmed,
      true,
    );
    assert.equal(retained.status, "blocked");
    f.state.historyFaultAt = 0;
    const before = Buffer.from(f.state.bytes ?? []);
    const writes = f.state.calls,
      entries = f.state.entries;
    f.state.publicationCompleted = fault !== "no_pending";
    if (fault === "reader") f.state.readerReleased = false;
    const result = await f.run(
      fault === "different_id"
        ? `${repaired.recoveryId}0`
        : repaired.recoveryId,
      "retain",
    );
    assert.equal(
      result.status,
      fault === "none" || fault === "no_pending" ? "observed" : "blocked",
      fault,
    );
    assert.equal(
      "retentionConfirmed" in result && result.retentionConfirmed === true,
      fault === "none" || fault === "no_pending",
      fault,
    );
    assert.equal(f.state.calls, writes, fault);
    assert.equal(f.state.entries, entries, fault);
    if (fault === "none" || fault === "no_pending") {
      assert.equal(f.snapshot()?.operations.length, 0);
      assert.equal(result.completionConfirmed, true);
    } else assert.ok(f.state.bytes?.equals(before), fault);
  }
});

/**
 * 保持保存の拒否・不明・解放不明・例外を別に確認する。
 * @responsibility 保存未確認を保持完了へ丸めない。
 * @trace ERB-IT-014
 * @precondition 保存前の保持待ち本文が確定済み。
 * @stimulus 既存Writerの四故障。
 * @observation 保存一回、停止、技術入口増分0、元本文不変。
 * @oracle 不明の自動再保存・技術再実行・終了整理なし。
 * @cleanup N/A: 自己生成Rootは既存終了hookで回収する。
 * @boundary 物理故障の完全性はHost検証に残す。
 */
test("修復保持接続: 保存未確認を保持完了にしない", async (t) => {
  for (const kind of ["reject", "confirmation", "release", "throw"] as const) {
    const f = fixture(t);
    f.state.mode = "retained";
    await f.run();
    const target = f.snapshot()?.operations[0];
    assert.ok(target?.kind === "runtime_repair");
    const before = Buffer.from(f.state.bytes ?? []);
    const writes = f.state.calls,
      entries = f.state.entries;
    f.state.fault = "retention";
    f.state.faultKind = kind;
    const result = await f.run(target.recoveryId, "retain");
    assert.equal(result.status, "blocked", kind);
    assert.equal(result.retentionConfirmed, false);
    assert.equal(f.state.calls, writes + 1, kind);
    assert.equal(f.state.entries, entries, kind);
    assert.ok(f.state.bytes?.equals(before), kind);
  }
});

/**
 * 完了と取消・Native故障・回収失敗を相関判定する。
 * @responsibility 後着取消で技術完了を巻戻さず、後着故障を成功へ畳まない。
 * @trace ERB-IT-014
 * @precondition 実Source・Runtime・Machine・保存model。
 * @stimulus 技術結果と終了時の五分類、取消とNative喪失の両順序。
 * @observation 耐久outcome・primary・cleanup・phase・保存順。
 * @oracle 正常共同条件だけrecovered、一次失敗と回収失敗は別fieldに保持する。
 * @cleanup 同Session join一回、返却後通知の保存0。
 * @boundary 模擬技術境界であり実Docker成功は主張しない。
 */
test("修復結果: 技術完了・first-wins・二版保存を混同しない", async (t) => {
  for (const mode of [
    "ready",
    "incomplete",
    "retained",
    "cancel",
    "effect_unknown",
  ] as const) {
    for (const close of mode === "ready"
      ? (["clean", "cancel", "unknown", "cancel_unknown"] as const)
      : mode === "effect_unknown"
        ? (["clean", "unknown"] as const)
        : (["clean"] as const)) {
      const f = fixture(t);
      f.state.mode = mode;
      f.state.close = close;
      const result = await f.run();
      assert.equal(
        result.status,
        mode === "retained" ? "blocked" : "observed",
        JSON.stringify({
          mode,
          close,
          result,
          calls: f.state.calls,
          observed: f.state.observed,
          snapshot: f.snapshot(),
        }),
      );
      assert.equal(result.finalCheckpointConfirmed, true);
      assert.equal(f.state.joined, 1);
      const target =
        f.snapshot()?.operations[0] ??
        {
          snapshot: JSON.parse(
            Buffer.from(
              f.state.completionBefore ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
        }?.snapshot.operations[0];
      assert.equal(target?.kind, "runtime_repair");
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      assertRepairResultFields(result, target, mode, close);
      if (result.completionConfirmed)
        assert.equal(f.snapshot()?.operations.length, 0);
      const expected =
        mode === "incomplete"
          ? null
          : mode === "retained" ||
              (mode === "ready" && ["clean", "cancel"].includes(close))
            ? "recovered"
            : mode === "cancel"
              ? "cancelled"
              : "blocked";
      assert.equal(
        target.outcome?.status ?? null,
        expected,
        `${mode}:${close}`,
      );
      assert.equal(result.outcomeConfirmed, expected !== null);
      assert.equal(
        target.phase,
        expected === null
          ? "repairing"
          : mode === "retained"
            ? "awaiting_disposition"
            : "settling",
      );
      if (mode === "retained")
        assert.equal(target.disposition, "pending_human_decision");
      assert.equal(
        target.primaryFailure?.reason ?? null,
        mode === "effect_unknown" ? "runtime_repair_effect_unknown" : null,
      );
      if (expected !== null) {
        const previous = {
          snapshot: JSON.parse(
            Buffer.from(
              f.saved.at(-2) ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
        }?.snapshot.operations[0];
        assert.equal(previous?.kind, "runtime_repair");
        if (previous?.kind !== "runtime_repair")
          throw new Error("wrong_previous");
        assert.equal(previous.outcome, null);
        assert.deepEqual(previous.checkpoint, target.checkpoint);
        assert.deepEqual(previous.primaryFailure, target.primaryFailure);
      }
      const beforeCalls = f.state.calls;
      const callback = f.late();
      if (callback && target.checkpoint) {
        const checkpoint = target.checkpoint;
        assert.throws(
          () => callback(checkpoint),
          /docker_repair_record_unconfirmed/u,
        );
      }
      assert.equal(f.state.calls, beforeCalls);
    }
  }
});

/**
 * 結果を決める共同fieldを独立した期待値へ照合する。
 * @responsibility statusだけ合う誤分類を見逃さない。
 * @trace ERB-IT-014
 * @precondition 実codecで復号した対象修復と返却値を使う。
 * @stimulus 技術結果と終了故障の固定組合せ。
 * @observation reason、outcome全文、primary、cleanup、Native回収確認。
 * @oracle 各共同fieldが独立期待値へ一致する。
 * @cleanup N/A: 値検査のみ。
 * @boundary 結果の保存値と利用側の返却値。
 */
function assertRepairResultFields(
  result: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>,
  target: RepairOperationRecord,
  mode: ReturnType<typeof fixture>["state"]["mode"],
  close: ReturnType<typeof fixture>["state"]["close"],
) {
  const unknown = close === "unknown" || close === "cancel_unknown";
  const reason =
    mode === "incomplete"
      ? "runtime_repair_observation_unknown"
      : mode === "effect_unknown"
        ? "runtime_repair_effect_unknown"
        : mode === "cancel"
          ? "runtime_repair_cancelled"
          : unknown
            ? "runtime_repair_cleanup_unknown"
            : "runtime_repair_recovered";
  const status =
    mode === "incomplete"
      ? null
      : reason === "runtime_repair_recovered"
        ? "recovered"
        : reason === "runtime_repair_cancelled"
          ? "cancelled"
          : "blocked";
  assert.equal(
    result.reason,
    mode === "retained" ? "runtime_repair_state_unavailable" : reason,
    "outcome_reason_mismatch",
  );
  assert.equal(
    result.operationCleanupConfirmed,
    !unknown,
    "native_cleanup_mismatch",
  );
  assert.equal(result.finalCheckpointConfirmed, true);
  assert.equal(result.outcomeConfirmed, status !== null);
  assert.deepEqual(
    target.outcome,
    status === null ? null : { status, reason, cleanupConfirmed: !unknown },
  );
  assert.deepEqual(
    target.primaryFailure,
    mode === "effect_unknown"
      ? { stage: "repair", reason: "runtime_repair_effect_unknown" }
      : null,
  );
  assert.equal(target.checkpoint?.cleanup, unknown ? "unknown" : "confirmed");
  assert.equal(
    target.checkpoint?.cleanupFailure,
    unknown ? "operation_cleanup_unknown" : null,
  );
}

/**
 * 返却fieldを誤る変異を既存共同Oracleで拒否する。
 * @responsibility 回収確認と理由を独立に反証する。
 * @trace ERB-IT-014
 * @precondition 実Sourceをメモリ内で一箇所だけ変異する。
 * @stimulus Native確認の常trueと境界失敗理由の置換。
 * @observation 変異生成成立と同じassertRepairResultFieldsの失敗。
 * @oracle 正常Sourceの既存Oracleを弱めず変異を拒否する。
 * @cleanup 本番Source変更0。
 * @boundary 返却・保存共同field。
 */
test("修復結果: 回収確認と理由の誤返却を共同Oracleで検出する", async (t) => {
  for (const field of ["native", "reason"] as const) {
    const f = fixture(t, (source) => {
      const mutated =
        field === "native"
          ? source.replaceAll(
              /^(\s*)operationCleanupConfirmed,$/gmu,
              "$1operationCleanupConfirmed: true,",
            )
          : source.replaceAll(
              '"runtime_repair_cleanup_unknown"',
              '"runtime_repair_failed_closed"',
            );
      assert.notEqual(mutated, source);
      return mutated;
    });
    f.state.close = "unknown";
    const result = await f.run();
    const target = f.snapshot()?.operations[0];
    assert.equal(target?.kind, "runtime_repair");
    if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
    assert.throws(
      () => assertRepairResultFields(result, target, "ready", f.state.close),
      field === "native"
        ? /native_cleanup_mismatch/u
        : /outcome_reason_mismatch/u,
    );
  }
});

/**
 * 保存拒否と独立した呼出しOwner失効を反証する。
 * @responsibility Effect前後で耐久事実と新規発行を区別する。
 * @trace ERB-IT-014
 * @precondition 実Source、失効を観測する模擬Root Owner。
 * @stimulus 準備保存後とEffect直後の失効、revalidate省略変異。
 * @observation 注入一回、Writer要求、既発行Effect、元本文、exact参照。
 * @oracle Effect前0／Effect後1を保持し、失効後Writer・追加Effect0。
 * @cleanup 返却後callbackも保存0、本番Source不変更。
 * @boundary 模擬Owner検証であり実Git失効の証明ではない。
 */
test("修復結果: 現在Owner失効後は既発行事実を推測保存しない", async (t) => {
  for (const point of ["prepared", "effect"] as const) {
    /**
     * Owner喪失後の保存とEffectを同じOracleで拒否する。
     * @responsibility Owner喪失後の保存とEffectを同じOracleで拒否する。
     * @trace ERB-IT-014
     * @precondition 準備前後で失効させるOwnerと対象Source変異。
     * @stimulus 実run本文またはguard変異を固定fixtureで呼ぶ。
     * @observation 保存回数、処置0/1とblocked理由。
     * @oracle 喪失点以降の書込み0、元失敗を保持し変異を検出する。
     * @cleanup fixtureの同じSessionを終了し代役を破棄する。
     * @boundary 実回復本文の局所故障注入。実Dockerなし。
     */
    const verify = async (mutant: boolean) => {
      const f = fixture(t, (source) => {
        if (!mutant) return source;
        const guard = "repository?.revalidate() === true";
        assert.equal(source.split(guard).length, 2);
        return source.replace(guard, "true");
      });
      f.state.mode = "effect_unknown";
      f.state.lossAt = point;
      const result = await f.run();
      assert.equal(f.state.losses, 1);
      assert.equal(
        f.state.calls,
        f.state.writesAtLoss,
        "owner_loss_write_issued",
      );
      assert.equal(f.state.effects, point === "prepared" ? 0 : 1);
      assert.equal(result.status, "blocked");
      assert.equal(result.finalCheckpointConfirmed, false);
      assert.equal(result.outcomeConfirmed, false);
      assert.ok(f.state.bytesAtLoss);
      assert.ok(f.state.bytes?.equals(f.state.bytesAtLoss));
      const target = f.snapshot()?.operations[0];
      assert.equal(target?.recoveryId, result.recoveryId);
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      const before = f.state.calls;
      const callback = f.late();
      if (callback && target.checkpoint) {
        const checkpoint = target.checkpoint;
        assert.throws(
          () => callback(checkpoint),
          /docker_repair_record_unconfirmed/u,
        );
      }
      assert.equal(f.state.calls, before);
    };
    await verify(false);
    await assert.rejects(() => verify(true), /owner_loss_write_issued/u);
  }
});

/**
 * cleanup版とoutcome版の保存不明を独立に反証する。
 * @responsibility 片方の保存成功を全結果の成功へ流用しない。
 * @trace ERB-IT-014
 * @precondition 実遷移modelで各候補を先に検査する。
 * @stimulus 二段階それぞれへ拒否・確認不明・解放不明・例外を一回注入。
 * @observation 注入到達、元本文、保存版、返却field、後続要求。
 * @oracle 最初の未確認保存以降要求0、outcome成功表示0、耐久済み段階を保持する。
 * @cleanup メモリだけ、Source変更0。
 * @boundary 保存結果のConsumer側契約。
 */
test("修復結果: 最終二保存の片側不成立を成功へ補完しない", async (t) => {
  for (const stage of ["cleanup", "outcome"] as const) {
    for (const kind of [
      "reject",
      "confirmation",
      "release",
      "throw",
    ] as const) {
      const f = fixture(t);
      f.state.fault = stage;
      f.state.faultKind = kind;
      const result = await f.run();
      assert.equal(f.state.faultHits, 1);
      assert.equal(f.state.calls, f.state.faultsAt);
      assert.equal(result.status, "blocked");
      assert.equal(result.outcomeConfirmed, false);
      assert.equal(result.finalCheckpointConfirmed, stage === "outcome");
      assert.equal(result.operationCleanupConfirmed, true);
      const target = f.snapshot()?.operations[0];
      assert.equal(target?.kind, "runtime_repair");
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      assert.equal(target.outcome, null);
      assert.equal(
        target.checkpoint?.cleanup,
        stage === "outcome" ? "confirmed" : "pending",
      );
      const beforeCalls = f.state.calls;
      const callback = f.late();
      if (callback && target.checkpoint) {
        const checkpoint = target.checkpoint;
        assert.throws(
          () => callback(checkpoint),
          /docker_repair_record_unconfirmed/u,
        );
      }
      assert.equal(f.state.calls, beforeCalls);
    }
  }
});

/**
 * 一次失敗保存後・outcome保存前の正規切断点を作る。
 * @responsibility 手組み成功値ではなく実Producerの中断状態を使う。
 * @trace ERB-IT-014
 * @precondition 実Source・DI・保存modelのメモリ境界。
 * @stimulus 不可逆なEffect不明とoutcome保存拒否。
 * @observation primaryとcleanupが耐久済み、outcomeだけnullの本文。
 * @oracle 注入一回、exact回復参照、最終checkpoint確認済み。
 * @cleanup 自己生成Rootは既存終了hookで回収する。
 * @boundary 記録確定と技術再実行の分離。
 */
async function interruptedRepairOutcome(
  t: TestContext,
  close: "clean" | "unknown" = "clean",
  transform?: (source: string) => string,
) {
  const f = fixture(t, transform);
  f.state.mode = "effect_unknown";
  f.state.close = close;
  f.state.fault = "outcome";
  const first = await f.run();
  assert.equal(first.status, "blocked");
  assert.equal(first.finalCheckpointConfirmed, true);
  assert.equal(first.outcomeConfirmed, false);
  assert.equal(f.state.faultHits, 1);
  assert.ok(first.recoveryId);
  f.state.fault = "none";
  f.state.faultHits = 0;
  return { f, id: first.recoveryId };
}

/**
 * 保存済みの不可逆失敗を技術再実行なしで確定する。
 * @responsibility 回収不明を正常化せず記録の閉鎖だけを行う。
 * @trace ERB-IT-014
 * @precondition 実Producerの正規切断点と通常Reader成功。
 * @stimulus cleanup confirmed／unknownから同exact参照で再入場。
 * @observation DI入口・Native取得・Effect、全文、revisionとprevious。
 * @oracle 新技術要求0、phase/outcome以外不変、一版だけ進む。
 * @cleanup 終端再入場も新要求0。
 * @boundary 保存済み事実だけを使う限定記録確定。
 */
test("修復記録: 一次失敗が耐久済みなら技術処置なしにblockedへ確定する", async (t) => {
  for (const close of ["clean", "unknown"] as const) {
    const { f, id } = await interruptedRepairOutcome(t, close);
    f.controller.abort();
    const before = f.snapshot();
    const decoded = (() => {
      const observed = model.readState(f.root, { scope: "recovery" });
      assert.equal(observed.status, "completed");
      assert.ok(observed.value);
      assert.equal(
        observed.value.sourceText,
        Buffer.from(
          f.state.bytes ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      );
      return observed.value;
    })();
    assert.ok(before && decoded);
    const old = before.operations[0];
    assert.equal(old?.kind, "runtime_repair");
    const counts = {
      entries: f.state.entries,
      acquired: f.state.acquired,
      effects: f.state.effects,
      writes: f.state.calls,
    };
    const result = await f.run(id);
    assert.equal(result.status, "observed");
    assert.equal(result.reason, "runtime_repair_effect_unknown");
    assert.equal(result.finalCheckpointConfirmed, true);
    assert.equal(result.outcomeConfirmed, true);
    assert.equal(result.operationCleanupConfirmed, close === "clean");
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.acquired, counts.acquired);
    assert.equal(f.state.effects, counts.effects);
    assert.equal(f.state.calls, counts.writes + 1);
    const after = f.snapshot();
    assert.ok(after);
    const target = after.operations[0];
    assert.equal(target?.kind, "runtime_repair");
    if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
    assert.equal(target.phase, "settling");
    assert.deepEqual(target.outcome, {
      status: "blocked",
      reason: "runtime_repair_effect_unknown",
      cleanupConfirmed: close === "clean",
    });
    assert.deepEqual(
      {
        ...target,
        phase: "repairing",
        outcome: null,
        summarySha256: null,
        history: null,
      },
      old,
    );
    assert.equal(result.historyConfirmed, true);
    assert.equal(result.completionConfirmed, false);
    assert.equal(after.revision, before.revision + 3);
    const outcomeBytes = f.saved.at(-1);
    assert.ok(outcomeBytes);
    const priorHistoryBytes = f.historySaved.at(-2);
    assert.ok(priorHistoryBytes);
    assert.deepEqual(after.previous, {
      revision: JSON.parse(priorHistoryBytes.toString()).revision,
      payloadSha256: createHash("sha256")
        .update(priorHistoryBytes)
        .digest("hex"),
    });
    assert.deepEqual(after.unresolvedRecoveries, before.unresolvedRecoveries);
    assert.ok(after);
    assert.equal(Object.hasOwn(after, "pendingDeliveries"), false);
    assert.ok(before);
    assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
    const terminalBytes = Buffer.from(f.state.bytes as Buffer);
    const refused = await f.run(id);
    assert.equal(refused.status, "observed");
    assert.equal(refused.reason, "runtime_repair_effect_unknown");
    assert.equal(refused.historyConfirmed, true);
    assert.equal(refused.completionConfirmed, false);
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.calls, counts.writes + 1);
    assert.ok(f.state.bytes?.equals(terminalBytes));
  }
});

/**
 * 取消による記録確定の遮断を負対照で検出する。
 * @responsibility 技術取消を耐久事実の保存Owner失効と混同しない。
 * @trace ERB-IT-014
 * @precondition 同じ実Producerの正規切断点。
 * @stimulus 入口へ取消拒否を戻すメモリ変異とAbort済み再入場。
 * @observation 変異生成成立、正例と同じoutcome確認Oracle。
 * @oracle 変異では記録確定が欠けるため同じOracleが拒否する。
 * @cleanup 本番Source変更0。
 * @boundary 取消と記録だけの確定。
 */
test("修復記録: 取消guardの早過ぎる適用を検出する", async (t) => {
  const { f, id } = await interruptedRepairOutcome(t, "clean", (source) => {
    const changed = source.replace(
      "if (!repository || !currentOwner())",
      "if (!repository || !currentOwner() || signal.aborted)",
    );
    assert.notEqual(changed, source);
    return changed;
  });
  f.controller.abort();
  const result = await f.run(id);
  assert.throws(() => assert.equal(result.outcomeConfirmed, true));
});

/**
 * 限定記録確定の対象外を通常の技術処理へ紛れ込ませない。
 * @responsibility 既知primaryと回収段階の境界を直接反証する。
 * @trace ERB-IT-014
 * @precondition 正規切断点を基準に、Schema適合する反例だけを使う。
 * @stimulus primary分類差、checkpoint欠測、未回収、別ID、既存終端、Reader／Owner失効。
 * @observation decoder成功、Writer・DI入口・Native取得、元本文。
 * @oracle 記録確定Writer0、本文不変、primaryなしだけDI通常入口へ進む。
 * @cleanup メモリだけ、実Git失効は主張しない。
 * @boundary 値適合と記録確定条件を区別する。
 */
test("修復記録: 対象外の失敗や未回収状態を確定しない", async (t) => {
  for (const mode of [
    "primary_null",
    "primary_other",
    "checkpoint_null",
    "pending",
    "not_requested",
    "wrong_id",
    "reader",
    "owner",
  ] as const) {
    const { f, id } = await interruptedRepairOutcome(t);
    const snapshot = f.snapshot();
    assert.ok(snapshot);
    const prior = snapshot.operations[0];
    if (prior?.kind !== "runtime_repair") throw new Error("wrong_target");
    const changed =
      mode === "primary_null"
        ? { ...prior, primaryFailure: null }
        : mode === "primary_other"
          ? {
              ...prior,
              primaryFailure: {
                stage: "checkpoint",
                reason: "runtime_repair_state_unavailable",
              },
            }
          : mode === "checkpoint_null"
            ? { ...prior, checkpoint: null }
            : mode === "pending" || mode === "not_requested"
              ? {
                  ...prior,
                  checkpoint: {
                    ...prior.checkpoint,
                    cleanup: mode,
                    cleanupFailure: null,
                  },
                }
              : prior;
    f.state.bytes = Buffer.from(
      `${canonicalJson({ ...snapshot, operations: [changed] })}\n`,
    );
    assert.ok(
      (() => {
        const observed = model.readState(f.root, { scope: "recovery" });
        assert.equal(observed.status, "completed");
        assert.ok(observed.value);
        assert.equal(
          observed.value.sourceText,
          Buffer.from(
            f.state.bytes ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        );
        return observed.value;
      })(),
      mode,
    );
    if (mode === "reader") f.state.readerReleased = false;
    if (mode === "owner") f.state.alive = false;
    const before = Buffer.from(f.state.bytes);
    const writes = f.state.calls,
      entries = f.state.entries,
      acquired = f.state.acquired;
    const result = await f.run(mode === "wrong_id" ? `${id}0` : id);
    assert.equal(result.status, "blocked", mode);
    assert.equal(f.state.calls, writes, mode);
    assert.equal(
      f.state.entries,
      entries + (mode === "primary_null" ? 1 : 0),
      mode,
    );
    assert.equal(f.state.acquired, acquired, mode);
    assert.ok(f.state.bytes.equals(before), mode);
    const afterEntries = f.state.entries;
    f.controller.abort();
    const cancelled = await f.run(mode === "wrong_id" ? `${id}0` : id);
    assert.equal(cancelled.status, "blocked", mode);
    assert.equal(f.state.entries, afterEntries, mode);
    assert.equal(f.state.acquired, acquired, mode);
    assert.equal(f.state.calls, writes, mode);
    assert.ok(f.state.bytes.equals(before), mode);
  }
});

/**
 * 記録確定の保存不明でも再試行・復元をしない。
 * @responsibility 通常Writerの三確認条件を終了限定経路でも維持する。
 * @trace ERB-IT-014
 * @precondition 正規切断点、Native新取得を伴わない。
 * @stimulus 拒否・確認不明・解放不明・例外。
 * @observation 注入一回、WriterとDIの回数、元版全文、返却確認。
 * @oracle 一要求だけ、outcome未確認、旧本文とexact ID保持。
 * @cleanup 本番Source不変更。
 * @boundary 記録だけの確定と保存結果。
 */
test("修復記録: 保存不成立では元失敗を保持して停止する", async (t) => {
  for (const kind of ["reject", "confirmation", "release", "throw"] as const) {
    const { f, id } = await interruptedRepairOutcome(t);
    f.state.fault = "outcome";
    f.state.faultKind = kind;
    const before = Buffer.from(f.state.bytes as Buffer);
    const writes = f.state.calls,
      entries = f.state.entries,
      acquired = f.state.acquired;
    const result = await f.run(id);
    assert.equal(f.state.faultHits, 1);
    assert.equal(f.state.calls, writes + 1);
    assert.equal(f.state.entries, entries);
    assert.equal(f.state.acquired, acquired);
    assert.equal(result.status, "blocked");
    assert.equal(result.outcomeConfirmed, false);
    assert.equal(result.finalCheckpointConfirmed, true);
    assert.equal(result.recoveryId, id);
    assert.ok(f.state.bytes?.equals(before));
  }
});

/**
 * 履歴付きReaderの共同条件を技術処置より先に要求する。
 * @responsibility Readerの欠測・解放不明を修復・保存成功へ変換しない。
 * @trace ERB-IT-014
 * @precondition 正規Producerがprimaryとcleanupを保存した切断点。
 * @stimulus 各確認fieldの単独不成立、例外、清掃直後Owner失効。
 * @observation 清掃一回、Reader／DI／Writer増分0、元本文と除去事実。
 * @oracle 失敗後の再試行0、正常再入場だけfresh Readerと記録保存へ進む。
 * @cleanup 実保存物のFilesystem意味は保存再入場試験へ分離する。
 * @boundary 修復Ownerと既存履歴付きReaderの接続。
 */
test("修復再入場: 履歴付きReader確認前は技術処置へ進まない", async (t) => {
  for (const kind of [
    "status",
    "storage",
    "absence",
    "release",
    "throw",
    "owner",
  ] as const) {
    const { f, id } = await interruptedRepairOutcome(t);
    f.controller.abort();
    f.state.intakeReadFault = kind;
    const before = Buffer.from(f.state.bytes as Buffer);
    const counts = {
      intakeReads: f.state.intakeReads,
      readers: f.state.readers,
      entries: f.state.entries,
      calls: f.state.calls,
    };
    const rejected = await f.run(id);
    assert.equal(rejected.status, "blocked", kind);
    assert.equal(f.state.intakeReads, counts.intakeReads + 1, kind);
    assert.equal(f.state.readers, counts.readers + 1, kind);
    assert.equal(f.state.entries, counts.entries, kind);
    assert.equal(f.state.calls, counts.calls, kind);
    assert.ok(f.state.bytes?.equals(before), kind);
    f.state.intakeReadFault = "none";
    f.state.alive = true;
    const resumed = await f.run(id);
    assert.equal(resumed.outcomeConfirmed, true, kind);
    assert.equal(f.state.readers, counts.readers + 2, kind);
    assert.equal(f.state.entries, counts.entries, kind);
    assert.equal(Object.hasOwn(resumed, "stateMarkerCleanup"), false);
  }
});

/**
 * 出版の部分成立を通常Readerや技術再開へ搬送しない。
 * @responsibility no_pendingと保存不明を区別する。
 * @trace ERB-IT-014
 * @precondition 正規Producerの保存済み失敗、現在Owner。
 * @stimulus 出版status・確認・排他解放の不成立、例外、直後Owner失効。
 * @observation 出版一回、後続の受付Reader／DI／Writer増分0、元版全文。
 * @oracle 既発生Effect診断を保持し、後段はfresh確認後だけ進む。
 * @cleanup 実出版の意味は実Host試験へ分離する。
 * @boundary 出版結果と修復Ownerの接続。
 */
test("修復出版: 部分成立の後は新処置へ進まない", async (t) => {
  for (const kind of [
    "status",
    "snapshot",
    "release",
    "throw",
    "owner",
  ] as const) {
    const { f, id } = await interruptedRepairOutcome(t);
    f.controller.abort();
    f.state.publicationFault = kind;
    const bytes = Buffer.from(f.state.bytes as Buffer);
    const counts = {
      publications: f.state.publications,
      intakeReads: f.state.intakeReads,
      readers: f.state.readers,
      entries: f.state.entries,
      calls: f.state.calls,
    };
    const result = await f.run(id);
    assert.equal(result.status, "blocked");
    assert.equal(f.state.publications, counts.publications + 1);
    assert.equal(f.state.intakeReads, counts.intakeReads);
    assert.equal(f.state.readers, counts.readers);
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.calls, counts.calls);
    assert.ok(f.state.bytes?.equals(bytes));
    if (kind !== "throw")
      assert.equal(result.statePublication?.filesystemEffectIssued, true);
  }
});
