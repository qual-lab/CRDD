/**
 * Host Lock取得待機後の失効拒否と、新取得Lockだけの回収を検証する。
 *
 * @packageDocumentation
 * @responsibility 非Authority依存で本番settlementの後着・失効・回収不明を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope coordinator、host-operation-lock、activation
 * @boundary PRL-UT-006=Direct Boundary: Test→Host Lock取得settlement
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedHostOperationLockActivationCandidate } from "../../src/security/execution-environment.ts";

/**
 * 後着取得を制御する非Authorityのfixtureを構築する。
 *
 * @responsibility 取得、再検証、公開、解放、停止の回数と順序を観測する。
 * @trace PRL-UT-006
 * @precondition OS Process・Filesystem・本番Capabilityを使わない。
 * @stimulus 取得を保留し、現在性と解放結果を変更してから結果を渡す。
 * @observation 取得Lockの公開・保持・解放とprocess停止の呼出しを記録する。
 * @oracle 呼出し元が同じLockの一回搬送または一回回収を判定する。
 * @cleanup 保留した取得・解放Promiseを終端化する。未使用通知PromiseのstubはI/O・handleを持たない。
 * @boundary PRL-UT-006=Direct Boundary: Test依存→本番settlement
 */
function createLockActivationFixture() {
  const events: string[] = [];
  let shouldFailValidation = false;
  let releaseResult:
    | "released"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown" = "released";
  let shouldFailRelease = false;
  let finishRelease: (() => void) | null = null;
  let releaseBarrier: Promise<void> | null = null;
  const lock = Object.freeze({
    assertLive: () => true,
    onFailureDetected: () => () => undefined,
    failureDetected: new Promise<void>(() => {}),
    loss: new Promise<"cleanup_confirmed_failure" | "cleanup_unknown">(
      () => {},
    ),
    confirmReady: async () => "ready" as const,
    release: async () => {
      events.push("release");
      if (releaseBarrier) await releaseBarrier;
      if (shouldFailRelease) throw new Error("release_failed");
      events.push("release_settled");
      return releaseResult;
    },
  });
  let existingReleaseCount = 0;
  const existingLock = Object.freeze({
    ...lock,
    release: async () => {
      existingReleaseCount += 1;
      return "released" as const;
    },
  });
  const before = Object.freeze({
    binding: {},
    identity: {},
    generation: {},
    recordHash: "original_hash",
    retired: false,
    lock: null,
  });
  let current: Readonly<{
    binding: object;
    identity: object;
    generation: object;
    recordHash: string;
    retired: boolean;
    lock: typeof lock | null;
  }> = before;
  /**
   * 非Authority fixtureで搬送する取得結果を定義する。
   *
   * @responsibility 取得状態と試験Lockの有無を保持する。
   * @trace PRL-UT-006
   * @shape 固定statusと局所Lockまたはnullを持つ。
   * @invariant 本番のOS Lockを含めない。
   * @boundary PRL-UT-006=Direct Boundary: fixture→取得settlement
   * @security 回復Authorityを発行しない。
   * @compatibility 本番Supervisorの状態語彙を使う。
   */
  type Outcome = Readonly<{
    status:
      | "acquired"
      | "unavailable"
      | "cleanup_confirmed_failure"
      | "cleanup_unknown";
    lock: typeof lock | null;
  }>;
  let complete: (value: Outcome) => void = () => {
    throw new Error("not_initialized");
  };
  let reject: (error: Error) => void = () => {
    throw new Error("not_initialized");
  };
  const acquisition = new Promise<Outcome>((resolve, rejectPromise) => {
    complete = resolve;
    reject = rejectPromise;
  });
  const candidate = createIsolatedHostOperationLockActivationCandidate({
    before,
    acquire: () => acquisition,
    readCurrent: () => {
      events.push("revalidate");
      if (shouldFailValidation) throw new Error("observation_unknown");
      return current;
    },
    publish: (actual) => {
      assert.equal(actual, lock);
      events.push("publish");
    },
    retainUnknown: (actual) => {
      assert.ok(actual === lock || actual === null);
      events.push(actual === null ? "retire_without_lock" : "retain_unknown");
    },
    poison: () => {
      events.push("poison");
    },
  });
  return {
    candidate,
    events,
    lock,
    complete,
    reject,
    /**
     * 現在世代へ単独の不一致を与える。
     *
     * @responsibility 指定した現在性の反例だけを設定する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 失効または参照・Hash・Lockの差分を与える。
     * @observation 次のreadCurrentが返すsnapshot。
     * @oracle 捕捉値は変えずcurrentだけ変更する。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    invalidate: (
      kind:
        | "retired"
        | "replacement"
        | "identity"
        | "generation"
        | "record_hash_changed"
        | "existing_lock" = "retired",
    ) => {
      if (kind === "retired") current = { ...current, retired: true };
      if (kind === "replacement") current = { ...current, binding: {} };
      if (kind === "identity") current = { ...current, identity: {} };
      if (kind === "generation") current = { ...current, generation: {} };
      if (kind === "record_hash_changed")
        current = { ...current, recordHash: "changed_hash" };
      if (kind === "existing_lock")
        current = { ...current, lock: existingLock };
    },
    /**
     * 既存Lockへの解放回数を読む。
     *
     * @responsibility 新取得Lockと既存Lockの操作を区別する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus カウンタを同期取得する。
     * @observation 既存Lockのrelease呼出し回数。
     * @oracle 正常な拒否処理では0である。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    readExistingReleaseCount: () => existingReleaseCount,
    /**
     * 現在世代の再観測を失敗させる。
     *
     * @responsibility 観測不能を一致と誤認させない反例を作る。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 次のreadCurrentでthrowする。
     * @observation revalidateイベントと公開・回収結果。
     * @oracle 失敗を現在性成立へ畳まない。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    failValidation: () => {
      shouldFailValidation = true;
    },
    /**
     * 新取得Lockの解放結果を指定する。
     *
     * @responsibility 回収確認と不明の分類を準備する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 固定されたrelease結果を設定する。
     * @observation releaseの返すstatus。
     * @oracle 本番と同じ状態語彙以外を作らない。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    setRelease: (result: typeof releaseResult) => {
      releaseResult = result;
    },
    /**
     * 新取得Lockの解放を例外終了させる。
     *
     * @responsibility 回収要求と回収完了を分離する反例を作る。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus releaseをthrowさせる。
     * @observation releaseイベントとpoison。
     * @oracle 例外を解放成功と扱わない。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    failRelease: () => {
      shouldFailRelease = true;
    },
    /**
     * 新取得Lockの解放終端を保留する。
     *
     * @responsibility 実終端前にactivateが完了しないことを準備する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 局所releaseBarrierを設定する。
     * @observation releaseイベントと保留Promise。
     * @oracle 外部資源なしで終端を保留する。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    pauseRelease: () => {
      releaseBarrier = new Promise<void>((resolve) => {
        finishRelease = resolve;
      });
    },
    /**
     * 保留した新取得Lockの解放を終端化する。
     *
     * @responsibility 試験が保留した局所Promiseを解決する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 保持したresolveを一回呼ぶ。
     * @observation release_settledとactivateの終端。
     * @oracle 保留解除後にだけactivateが終わる。
     * @cleanup 保留した取得・解放PromiseはCase終端までに解決する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    finishRelease: () => {
      assert.ok(finishRelease);
      finishRelease();
    },
  };
}

/**
 * 後着取得の有限な成立・拒否・観測不能の母集団を検証する。
 *
 * @responsibility 公開一回、後着回収一回、回収実終端待ち、unknown停止を判定する。
 * @trace PRL-UT-006
 * @precondition 非Authority fixtureだけを使用し、既存Root・Processには操作しない。
 * @stimulus 現在性、取得結果、再検証throw、解放結果、遅延解放を組み合わせる。
 * @observation events、公開結果、保留中のPromise状態を観測する。
 * @oracle 不一致では公開・保持0。回収不明はpoison。実終端前には返却しない。
 * @cleanup 保留した取得・解放Promiseを全て終端させる。
 * @boundary PRL-UT-006=Direct Boundary: Test→本番取得settlement
 */
test("Host Lockの後着取得を再検証し、新取得Lockだけを回収する", async (t) => {
  /**
   * 取得成功を現在世代へ一回だけ搬送する。
   *
   * @responsibility 取得成功を現在世代へ一回だけ搬送する。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus 未変更世代へacquiredを返す。
   * @observation revalidateとpublishの順序。
   * @oracle 公開一回、解放・停止0。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("同じ現在世代へ一回だけ公開する", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    assert.equal(h.candidate.productionAuthority, false);
    h.complete({ status: "acquired", lock: h.lock });
    assert.equal(await result, "activated");
    assert.deepEqual(h.events, ["revalidate", "publish"]);
  });
  for (const invalidation of [
    "retired",
    "replacement",
    "identity",
    "generation",
    "record_hash_changed",
    "existing_lock",
  ] as const) {
    /**
     * 六種類の失効差分を個別に拒否する。
     *
     * @responsibility 六種類の失効差分を個別に拒否する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 取得待機中に現在snapshotを変更する。
     * @observation release回数、公開回数、既存Lock操作。
     * @oracle 新Lock一回解放、公開0、既存Lock操作0。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(`${invalidation}: 待機中の失効後は公開しない`, async () => {
      const h = createLockActivationFixture();
      const result = h.candidate.activate();
      h.invalidate(invalidation);
      h.complete({ status: "acquired", lock: h.lock });
      assert.equal(await result, "cleanup_confirmed_failure");
      assert.deepEqual(h.events, ["revalidate", "release", "release_settled"]);
      assert.equal(h.readExistingReleaseCount(), 0);
    });
  }
  /**
   * 観測不能な後着取得を公開しない。
   *
   * @responsibility 観測不能な後着取得を公開しない。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus readCurrentをthrowさせる。
   * @observation 公開とreleaseのイベント。
   * @oracle 新取得Lockだけを回収する。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("再検証の観測不能も後着Lockを回収する", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    h.failValidation();
    h.complete({ status: "acquired", lock: h.lock });
    assert.equal(await result, "cleanup_confirmed_failure");
    assert.deepEqual(h.events, ["revalidate", "release", "release_settled"]);
  });
  for (const outcome of ["unavailable", "cleanup_confirmed_failure"] as const) {
    /**
     * 既知の非取得分類を保持する。
     *
     * @responsibility 既知の非取得分類を保持する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus Lockなしで非取得結果を返す。
     * @observation 返却statusとイベント。
     * @oracle 元分類を維持し状態変更0。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(`${outcome}: Lockなしの元分類を保持する`, async () => {
      const h = createLockActivationFixture();
      const result = h.candidate.activate();
      h.complete({ status: outcome, lock: null });
      assert.equal(await result, outcome);
      assert.deepEqual(h.events, []);
    });
  }
  for (const failure of ["unknown", "throw"] as const) {
    /**
     * 解放不明またはthrowを停止へ収束する。
     *
     * @responsibility 解放不明またはthrowを停止へ収束する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 失効後の解放結果を不明にする。
     * @observation release回数、poison、公開有無。
     * @oracle 一回回収要求、公開0、poison。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(
      `${failure}: 後着Lock回収不明はprocessを停止対象にする`,
      async () => {
        const h = createLockActivationFixture();
        const result = h.candidate.activate();
        h.invalidate();
        if (failure === "unknown") h.setRelease("cleanup_unknown");
        else h.failRelease();
        h.complete({ status: "acquired", lock: h.lock });
        assert.equal(await result, "cleanup_unknown");
        assert.equal(h.events.filter((event) => event === "release").length, 1);
        assert.equal(h.events.at(-1), "poison");
        assert.equal(h.events.includes("publish"), false);
      },
    );
  }
  for (const isCurrentGeneration of [true, false]) {
    /**
     * Lockを伴う不明結果の保持先を再照合する。
     *
     * @responsibility Lockを伴う不明結果の保持先を再照合する。
     * @trace PRL-UT-006
     * @precondition 非Authority fixtureを使い、OS資源を作成しない。
     * @stimulus 現在または失効世代へ不明結果を返す。
     * @observation 保持・解放・停止の順序。
     * @oracle 現在だけ保持、staleは新Lockだけ回収。
     * @cleanup 保留した取得・解放Promiseを終端まで処置する。
     * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
     */
    await t.test(
      `Lockを伴うcleanup_unknown: 現在性=${isCurrentGeneration}`,
      async () => {
        const h = createLockActivationFixture();
        const result = h.candidate.activate();
        if (!isCurrentGeneration) h.invalidate();
        h.complete({ status: "cleanup_unknown", lock: h.lock });
        assert.equal(await result, "cleanup_unknown");
        assert.deepEqual(
          h.events,
          isCurrentGeneration
            ? ["revalidate", "retain_unknown", "poison"]
            : ["revalidate", "release", "release_settled", "poison"],
        );
      },
    );
  }

  for (const acquisitionKind of ["unknown_result", "throw"] as const) {
    for (const generationState of [
      "current",
      "retired",
      "replacement",
      "identity",
      "generation",
      "record_hash_changed",
      "existing_lock",
      "unobservable",
    ] as const) {
      /**
       * Lockなし不明でも現在世代の失効を維持する。
       *
       * @responsibility Lockなし不明でも現在世代の失効を維持する。
       * @trace PRL-UT-006
       * @precondition 非Authority fixtureを使い、OS資源を作成しない。
       * @stimulus 不明結果または取得throwに八種類の現在性を与える。
       * @observation retire_without_lock、poison、既存Lock操作。
       * @oracle 現在だけ失効、他は状態変更0、全件停止。
       * @cleanup 保留した取得・解放Promiseを終端まで処置する。
       * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
       */
      await t.test(
        `${acquisitionKind}: Lockなし不明・現在性=${generationState}`,
        async () => {
          const h = createLockActivationFixture();
          const result = h.candidate.activate();
          if (generationState === "unobservable") h.failValidation();
          else if (generationState !== "current") h.invalidate(generationState);
          if (acquisitionKind === "throw")
            h.reject(new Error("acquisition_unknown"));
          else h.complete({ status: "cleanup_unknown", lock: null });
          assert.equal(await result, "cleanup_unknown");
          assert.deepEqual(
            h.events,
            generationState === "current"
              ? ["revalidate", "retire_without_lock", "poison"]
              : ["revalidate", "poison"],
          );
          assert.equal(h.readExistingReleaseCount(), 0);
        },
      );
    }
  }
  /**
   * 確認付き失敗を回収不明へ強めない。
   *
   * @responsibility 確認付き失敗を回収不明へ強めない。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus releaseがcleanup_confirmed_failureを返す。
   * @observation 返却statusとrelease終端。
   * @oracle 元の失敗分類を保ちpoison0。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("後着Lockの回収確認付き失敗分類を保持する", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    h.invalidate();
    h.setRelease("cleanup_confirmed_failure");
    h.complete({ status: "acquired", lock: h.lock });
    assert.equal(await result, "cleanup_confirmed_failure");
    assert.deepEqual(h.events, ["revalidate", "release", "release_settled"]);
    assert.equal(h.readExistingReleaseCount(), 0);
  });
  /**
   * 取得例外時もfreshな現在世代を失効させる。
   *
   * @responsibility 取得例外時もfreshな現在世代を失効させる。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus 取得Promiseをrejectする。
   * @observation 再照合、失効、poisonの順序。
   * @oracle 現在世代の失効と停止を維持する。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test("取得Promise例外を正常・非取得へ畳まない", async () => {
    const h = createLockActivationFixture();
    const result = h.candidate.activate();
    h.reject(new Error("acquisition_outcome_unknown"));
    assert.equal(await result, "cleanup_unknown");
    assert.deepEqual(h.events, ["revalidate", "retire_without_lock", "poison"]);
  });
  /**
   * 後着Lockの実終端待機を保持する。
   *
   * @responsibility 後着Lockの実終端待機を保持する。
   * @trace PRL-UT-006
   * @precondition 非Authority fixtureを使い、OS資源を作成しない。
   * @stimulus 取得後のreleaseを保留する。
   * @observation activateの保留とrelease_settled。
   * @oracle 実終端前に結果を返さない。
   * @cleanup 保留した取得・解放Promiseを終端まで処置する。
   * @boundary PRL-UT-006=Direct Boundary: fixture→本番取得settlement
   */
  await t.test(
    "呼出側の待機が終わっても後着回収の実終端まで処理を保持する",
    async () => {
      const h = createLockActivationFixture();
      h.pauseRelease();
      let activationSettled = false;
      const result = h.candidate.activate().then((value) => {
        activationSettled = true;
        return value;
      });
      h.invalidate();
      h.complete({ status: "acquired", lock: h.lock });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(activationSettled, false);
      assert.deepEqual(h.events, ["revalidate", "release"]);
      h.finishRelease();
      assert.equal(await result, "cleanup_confirmed_failure");
    },
  );
});
