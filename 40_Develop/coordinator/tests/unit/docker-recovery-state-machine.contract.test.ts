/**
 * coordinator:unit:docker-recovery-state-machineの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-recovery-state-machineが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、recovery、state、machine
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createIsolatedDockerRecoveryLockControllerCandidate } from "../../src/security/docker-recovery-lock-controller.ts";
import {
  classifyCleanupDirectoryState,
  classifyCommittedPairDeleteState,
  classifyCommittedPairMoveState,
  classifyCoordinatorSnapshotReentry,
  describeDockerRecoveryStateMachineContract,
  releaseRecoverySynchronizations,
} from "../../src/security/docker-recovery-state-machine.ts";

/**
 * delete state machineは到達可能3状態だけを回復するを検証する。
 *
 * @responsibility delete state machineは到達可能3状態だけを回復するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus delete state machineは到達可能3状態だけを回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("delete state machineは到達可能3状態だけを回復する", () => {
  assert.equal(classifyCommittedPairDeleteState(true, true), "remove_content");
  assert.equal(classifyCommittedPairDeleteState(false, true), "remove_commit");
  assert.equal(classifyCommittedPairDeleteState(false, false), "complete");
  assert.equal(classifyCommittedPairDeleteState(true, false), "third_state");
});

/**
 * move state machineは16組合せ中3状態だけを回復するを検証する。
 *
 * @responsibility move state machineは16組合せ中3状態だけを回復するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus move state machineは16組合せ中3状態だけを回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("move state machineは16組合せ中3状態だけを回復する", () => {
  const known = new Map([
    ["1100", "move_content"],
    ["0110", "move_commit"],
    ["0011", "complete"],
  ]);
  for (let bits = 0; bits < 16; bits += 1) {
    const values = [3, 2, 1, 0].map((shift) => Boolean(bits & (1 << shift)));
    const key = values.map(Number).join("");
    assert.equal(
      classifyCommittedPairMoveState(
        values[0] ?? false,
        values[1] ?? false,
        values[2] ?? false,
        values[3] ?? false,
      ),
      known.get(key) ?? "third_state",
      key,
    );
  }
});

/**
 * cleanup state machineは安全な完全削除とEvidence保持を分離するを検証する。
 *
 * @responsibility cleanup state machineは安全な完全削除とEvidence保持を分離するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup state machineは安全な完全削除とEvidence保持を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanup state machineは安全な完全削除とEvidence保持を分離する", () => {
  assert.equal(
    classifyCleanupDirectoryState(true, false, false, 2),
    "remove_expected_entries",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, false, false, 0),
    "remove_directory",
  );
  assert.equal(
    classifyCleanupDirectoryState(false, false, false, 0),
    "complete",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, true, false, 2),
    "third_state",
  );
  assert.equal(
    classifyCleanupDirectoryState(true, false, true, 2),
    "third_state",
  );
  assert.deepEqual(describeDockerRecoveryStateMachineContract(), {
    deleteKnownStates: ["remove_content", "remove_commit", "complete"],
    moveKnownStates: ["move_content", "move_commit", "complete"],
    cleanupSuccessResidue: 0,
    thirdStateTreatment: "preserve_evidence_and_fail_closed",
    lockReleaseTreatment: "attempt_all_and_report_first_failure",
  });
});

/**
 * lock release state machineは失敗後も全同期境界の解放を試すを検証する。
 *
 * @responsibility lock release state machineは失敗後も全同期境界の解放を試すの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus lock release state machineは失敗後も全同期境界の解放を試すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("lock release state machineは失敗後も全同期境界の解放を試す", () => {
  const attempts: string[] = [];
  assert.equal(
    releaseRecoverySynchronizations([
      {
        release: () => {
          attempts.push("runtime");
          throw new Error("fixture");
        },
        reason: "runtime_release_failed",
      },
      {
        release: () => {
          attempts.push("home");
          return false;
        },
        reason: "home_release_failed",
      },
      {
        release: () => {
          attempts.push("host");
          return true;
        },
        reason: "host_release_failed",
      },
    ]),
    "runtime_release_failed",
  );
  assert.deepEqual(attempts, ["runtime", "home", "host"]);
  assert.equal(releaseRecoverySynchronizations([]), null);
});

/**
 * 解放失敗を反復呼出しで成功へ変えないことを検証する。
 *
 * @responsibility 世代別一回の解放と、失敗後のEffect・再取得0を判定する。
 * @trace PRL-UT-006
 * @precondition OS資源を持たない取得・解放fixtureを使用する。
 * @stimulus outsideLockまたはcloseからfalse・例外・非booleanの解放を与える。
 * @observation 解放・取得・Effect件数と反復closeの返値。
 * @oracle 解放一回、取得一回、Effect0、closeは常にfalse。
 * @cleanup N/A: fixtureはメモリ内の値だけを持つ。
 * @boundary PRL-UT-006=N/A: 合成依存での状態処理。実OS解放を証明しない。
 */
test("controllerは解放失敗を成功へ戻さずOwner世代を再使用しない", () => {
  for (const mode of ["false", "throw", "promise", "object"]) {
    for (const entry of ["outside", "close"]) {
      let acquisitions = 0;
      let releases = 0;
      let effects = 0;
      const candidate = createIsolatedDockerRecoveryLockControllerCandidate(
        () => {
          acquisitions += 1;
          return {
            /**
             * 指定modeの解放失敗を返す合成Owner。
             *
             * @responsibility 解放要求を数え、false・例外・非booleanを一回返す。
             * @trace PRL-UT-006
             * @precondition 取得fixtureが返した現在世代のOwner。
             * @stimulus releaseを呼び出す。
             * @observation 解放件数とmode別の返値・例外。
             * @oracle 呼出し元Caseが解放一回・失敗保持・作業0を判定する。
             * @cleanup N/A: メモリ内Ownerと計数だけで実資源なし。
             * @boundary PRL-UT-006=N/A: 合成Ownerの同期解放。
             */
            release: () => {
              releases += 1;
              if (mode === "throw") throw new Error("fixture");
              const value: unknown =
                mode === "promise"
                  ? Promise.resolve(true)
                  : mode === "object"
                    ? {}
                    : false;
              return value as boolean;
            },
          };
        },
      );
      assert.equal(candidate.productionAuthority, false);
      const controller = candidate.controller;
      assert.ok(controller);
      if (entry === "outside") {
        assert.throws(
          () =>
            controller.outsideLock(() => {
              effects += 1;
            }),
          /docker_task_runtime_state_lock_release_unconfirmed/,
        );
      } else assert.equal(controller.close(), false);
      assert.equal(controller.close(), false);
      assert.equal(controller.close(), false);
      assert.throws(
        () =>
          controller.outsideLock(() => {
            effects += 1;
          }),
        /docker_task_runtime_state_lock_release_unconfirmed/,
      );
      assert.deepEqual(
        { acquisitions, releases, effects },
        { acquisitions: 1, releases: 1, effects: 0 },
      );
    }
  }
});

/**
 * 再取得失敗と作業済みEffect・例外を保持することを検証する。
 *
 * @responsibility 再取得null・例外の後にcloseが成功しないことを判定する。
 * @trace PRL-UT-006
 * @precondition 初回取得は成功し、二回目だけ失敗する局所fixture。
 * @stimulus 正常作業または作業例外の後に再取得を失敗させる。
 * @observation 作業件数、再取得件数、例外causeと反復close。
 * @oracle 作業済み件数一回を保持し、共同失敗の元例外をcauseに残し、再試行0。
 * @cleanup N/A: 実資源を作成しない。
 * @boundary PRL-UT-006=N/A: 同期controllerの局所状態処理。
 */
test("controllerは再取得失敗後のcloseを成功へ変えない", () => {
  for (const mode of ["null", "throw"]) {
    for (const doesEffectThrow of [false, true]) {
      let acquisitions = 0;
      let releases = 0;
      let effects = 0;
      const original = new Error("effect_failed");
      const { controller } =
        createIsolatedDockerRecoveryLockControllerCandidate(() => {
          acquisitions += 1;
          if (acquisitions === 1)
            return {
              /**
               * 再取得失敗前の初回Ownerを正常解放する。
               *
               * @responsibility 初回Ownerの解放件数を増やしtrueを返す。
               * @trace PRL-UT-006
               * @precondition 初回取得だけがこのOwnerを返す。
               * @stimulus 初回Ownerのreleaseを呼び出す。
               * @observation 解放件数とtrueの返値。
               * @oracle 初回解放一回の後、再取得失敗を別の状態として判定する。
               * @cleanup N/A: メモリ内Ownerと計数だけで実資源なし。
               * @boundary PRL-UT-006=N/A: 合成Ownerの同期解放。
               */
              release: () => {
                releases += 1;
                return true;
              },
            };
          if (mode === "throw") throw new Error("acquire_failed");
          return null;
        });
      assert.ok(controller);
      assert.throws(
        () =>
          controller.outsideLock(() => {
            effects += 1;
            if (doesEffectThrow) throw original;
            return "effect_done";
          }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(
            error.message,
            "docker_task_runtime_state_generation_active_or_unknown",
          );
          assert.equal(error.cause, doesEffectThrow ? original : undefined);
          return true;
        },
      );
      assert.equal(controller.close(), false);
      assert.equal(controller.close(), false);
      assert.throws(
        () =>
          controller.outsideLock(() => {
            effects += 1;
          }),
        /docker_task_runtime_state_generation_active_or_unknown/,
      );
      assert.deepEqual(
        { acquisitions, releases, effects },
        { acquisitions: 2, releases: 1, effects: 1 },
      );
    }
  }
});

/**
 * 正常な世代別解放と作業例外後の再取得を検証する。
 *
 * @responsibility 失敗保持の追加が既存の正常世代を壊さないことを判定する。
 * @trace PRL-UT-006
 * @precondition 各取得が異なるメモリ内Ownerを返す。
 * @stimulus 作業例外、正常作業、close反復を順に与える。
 * @observation 各世代の解放回数、作業返値、元例外の同一性。
 * @oracle 三世代を各一回解放し、正常close反復はtrue。
 * @cleanup N/A: 実資源を使用しない。
 * @boundary PRL-UT-006=N/A: 実OS終端ではなく同期状態処理。
 */
test("controllerは正常世代を各一回解放し作業例外後も再取得する", () => {
  const releases: number[] = [];
  const { controller } = createIsolatedDockerRecoveryLockControllerCandidate(
    () => {
      const generation = releases.length;
      releases.push(0);
      return {
        /**
         * 取得した一世代のOwnerを正常解放する。
         *
         * @responsibility 当該世代だけの解放件数を増やしtrueを返す。
         * @trace PRL-UT-006
         * @precondition 取得時の世代番号と計数slotが確定している。
         * @stimulus 当該世代のreleaseを呼び出す。
         * @observation 世代別解放件数とtrueの返値。
         * @oracle 各世代一回の解放と正常close反復を呼出し元Caseで判定する。
         * @cleanup N/A: メモリ内Ownerと計数だけで実資源なし。
         * @boundary PRL-UT-006=N/A: 合成Ownerの同期解放。
         */
        release: () => {
          releases[generation] = (releases[generation] ?? 0) + 1;
          return true;
        },
      };
    },
  );
  assert.ok(controller);
  const original = new Error("effect_failed");
  assert.throws(
    () =>
      controller.outsideLock(() => {
        throw original;
      }),
    (error: unknown) => error === original,
  );
  assert.equal(
    controller.outsideLock(() => 42),
    42,
  );
  assert.equal(controller.close(), true);
  assert.equal(controller.close(), true);
  assert.throws(
    () => controller.outsideLock(() => 0),
    /docker_task_runtime_state_lock_controller_invalid/,
  );
  assert.deepEqual(releases, [1, 1, 1]);
  assert.equal(
    createIsolatedDockerRecoveryLockControllerCandidate(() => null).controller,
    null,
  );
  assert.throws(
    () =>
      createIsolatedDockerRecoveryLockControllerCandidate(() => {
        throw original;
      }),
    (error: unknown) => error === original,
  );
});

/**
 * 同期解放の非boolean返値を失敗として処置する。
 *
 * @responsibility truthy値・Promise・thenableを成功へ畳まないことを判定する。
 * @trace PRL-UT-006
 * @precondition 実資源を持たない返値fixtureを使用する。
 * @stimulus 非booleanの解放返値と、その後の正常解放を与える。
 * @observation 最初の理由、全attempt件数、then getterの呼出し件数。
 * @oracle 最初の理由を保持し、後続解放を行い、thenを読まない。
 * @cleanup N/A: メモリ内fixtureだけを使用する。
 * @boundary PRL-UT-006=N/A: 同期返値集約の局所検証。
 */
test("同期解放集約はtrue以外を失敗としthenを実行しない", () => {
  let thenReads = 0;
  // biome-ignore lint/suspicious/noThenProperty: 未確認返値のthenを実行しないことを反証するfixture。
  const thenable = Object.defineProperty({}, "then", {
    get: () => {
      thenReads += 1;
      throw new Error("forbidden");
    },
  });
  for (const value of [
    false,
    null,
    undefined,
    0,
    1,
    "ok",
    {},
    Promise.resolve(true),
    thenable,
  ]) {
    const attempts: number[] = [];
    assert.equal(
      releaseRecoverySynchronizations([
        {
          release: () => {
            attempts.push(1);
            return value as boolean;
          },
          reason: "first_unknown",
        },
        {
          release: () => {
            attempts.push(2);
            return true;
          },
          reason: "second_unknown",
        },
      ]),
      "first_unknown",
    );
    assert.deepEqual(attempts, [1, 2]);
  }
  assert.equal(thenReads, 0);
  assert.equal(
    releaseRecoverySynchronizations([
      { release: () => true, reason: "unused" },
    ]),
    null,
  );
});

/**
 * Snapshotの元版と次版のexact内容だけを保存再入場へ分類する。
 * @responsibility 版番号だけの一致、異内容、別Repositoryの誤受理を反証する。
 * @trace PRL-UT-006
 * @precondition 合成したSnapshot Identityとexact bytes Hashを使用する。
 * @stimulus 元版・次版・Hash差・結合差・観測不能を判定へ渡す。
 * @observation publish_pending、remove_pending、blockedの返却を取得する。
 * @oracle 元版とHashの一致だけが公開候補、次版exact一致だけが回収候補となる。
 * @cleanup N/A: 純粋判定でFile、Lock、Processを作成しない。
 * @boundary N/A: 保存とDockerを呼ばない局所の状態分類である。
 */
test("Coordinator Snapshotは元版・次版のexact内容と結合を照合する", () => {
  const previousHash = "a".repeat(64);
  const nextHash = "b".repeat(64);
  const pending = {
    revision: 2,
    previous: { revision: 1, payloadSha256: previousHash },
    repositoryBinding: "repository-a",
    payloadSha256: nextHash,
  };
  const current = {
    status: "present" as const,
    revision: 1,
    repositoryBinding: "repository-a",
    payloadSha256: previousHash,
  };
  assert.equal(
    classifyCoordinatorSnapshotReentry(
      current,
      pending,
      "repository-a",
      "existing",
    ),
    "publish_pending",
  );
  assert.equal(
    classifyCoordinatorSnapshotReentry(
      { ...current, revision: 2, payloadSha256: nextHash },
      pending,
      "repository-a",
      "existing",
    ),
    "remove_pending",
  );
  for (const observation of [
    { ...current, payloadSha256: nextHash },
    { ...current, revision: 2 },
    { ...current, revision: 3, payloadSha256: nextHash },
    { ...current, repositoryBinding: "repository-b" },
    { ...current, payloadSha256: "" },
    { ...current, revision: 1.5 },
    { ...current, revision: Number.MAX_SAFE_INTEGER + 1 },
    { status: "unknown" as const },
    { status: "absent" as const },
  ]) {
    assert.equal(
      classifyCoordinatorSnapshotReentry(
        observation,
        pending,
        "repository-a",
        "existing",
      ),
      "blocked",
    );
  }
  assert.equal(
    classifyCoordinatorSnapshotReentry(
      current,
      pending,
      "repository-a",
      "unknown",
    ),
    "blocked",
  );
});

/**
 * 初回保存は新Root・明示不存在・初版という全条件を要求する。
 * @responsibility 旧状態喪失を新しい初回保存へ誤分類しないことを確認する。
 * @trace PRL-UT-006
 * @precondition 初版pendingとRoot条件の閉じた観測を用いる。
 * @stimulus Root三状態と正規Fileの存在／不存在／観測不能を組み合わせる。
 * @observation 初回公開候補、確定済み回収候補、停止を比較する。
 * @oracle 新Rootかつ明示不存在だけを初回公開候補とし、確定済みexact一致は回収候補とする。
 * @cleanup N/A: 合成値だけを使用し、物理Rootは作成しない。
 * @boundary N/A: 初回条件の局所判定。Root検証や清掃成立を証明しない。
 */
test("Coordinator Snapshotの初回条件は不存在と観測不能を区別する", () => {
  const pending = {
    revision: 1,
    previous: null,
    repositoryBinding: "repository-a",
    payloadSha256: "a".repeat(64),
  };
  for (const rootState of ["new", "existing", "unknown"] as const) {
    assert.equal(
      classifyCoordinatorSnapshotReentry(
        { status: "absent" },
        pending,
        "repository-a",
        rootState,
      ),
      rootState === "new" ? "publish_pending" : "blocked",
    );
    assert.equal(
      classifyCoordinatorSnapshotReentry(
        { status: "unknown" },
        pending,
        "repository-a",
        rootState,
      ),
      "blocked",
    );
  }
  assert.equal(
    classifyCoordinatorSnapshotReentry(
      { status: "present", ...pending },
      pending,
      "repository-a",
      "existing",
    ),
    "remove_pending",
  );
});

/**
 * Snapshotの改訂相関とHash形状の不正を停止へ分類する。
 * @responsibility 小数・非安全整数・改訂飛越し・不正Hash・結合差を反証する。
 * @trace PRL-UT-006
 * @precondition 元版の合成観測と次版pendingを使用する。
 * @stimulus 次版とpreviousの各不正variantを同じ観測へ渡す。
 * @observation 判定結果と入力不変を取得する。
 * @oracle 全不正variantがblockedであり、入力値を変更しない。
 * @cleanup N/A: 合成入力だけを扱い、共有状態を持たない。
 * @boundary N/A: Identity相関の局所反証。全Snapshot Schemaの検証は別責務である。
 */
test("Coordinator Snapshotは不正な改訂相関とHashを拒否する", () => {
  const current = {
    status: "present" as const,
    revision: 1,
    repositoryBinding: "repository-a",
    payloadSha256: "a".repeat(64),
  };
  const pending = {
    revision: 2,
    previous: { revision: 1, payloadSha256: "a".repeat(64) },
    repositoryBinding: "repository-a",
    payloadSha256: "b".repeat(64),
  };
  for (const candidate of [
    { ...pending, revision: 0 },
    { ...pending, revision: 2.5 },
    { ...pending, revision: 3 },
    { ...pending, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...pending, previous: null },
    { ...pending, previous: { revision: 0, payloadSha256: "a".repeat(64) } },
    { ...pending, previous: { revision: 1.5, payloadSha256: "a".repeat(64) } },
    {
      ...pending,
      previous: {
        revision: Number.MAX_SAFE_INTEGER,
        payloadSha256: "a".repeat(64),
      },
    },
    { ...pending, previous: { revision: 1, payloadSha256: "" } },
    { ...pending, previous: { revision: 1, payloadSha256: "c".repeat(64) } },
    { ...pending, payloadSha256: "" },
    { ...pending, payloadSha256: "B".repeat(64) },
    { ...pending, repositoryBinding: "repository-b" },
  ]) {
    const before = JSON.stringify(candidate);
    assert.equal(
      classifyCoordinatorSnapshotReentry(
        current,
        candidate,
        "repository-a",
        "existing",
      ),
      "blocked",
    );
    assert.equal(JSON.stringify(candidate), before);
  }
  assert.equal(
    classifyCoordinatorSnapshotReentry(current, pending, "", "existing"),
    "blocked",
  );
});
