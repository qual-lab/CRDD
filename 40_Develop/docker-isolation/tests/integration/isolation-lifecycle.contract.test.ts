/**
 * 共通技術入口の開始・通知・取消・終了・回収を検証する。
 * @packageDocumentation
 * @responsibility 共通技術入口の保証を有限代役で反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 模擬CLI・Process・Directory。実Docker・AI・保持物は使用しない。
 * @boundary ERB-IT-004=Direct Boundary: 本番DIから有限CLI／Process／Directoryへの接続。
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { IsolationRequest } from "../../src/execution/types.ts";
import { createIsolationFixture } from "../support/isolation.ts";

const ISOLATION_SETTINGS = Object.freeze({
  windowsDirectory: "C:\\Windows",
  userHomeDirectory: "C:\\Users\\test",
});

/**
 * config終了の明示不存在と観測不能を通常・単独回収で区別する。
 * @responsibility Docker資源の回収成功からFilesystem終了を推定しない。
 * @trace ERB-IT-004
 * @precondition 有限FS代役だけを用いる。
 * @stimulus ENOENT、再出現、権限・I/Oエラー、削除失敗を与える。
 * @observation Completionのconfig終了・全体回収boolと元資源IDを確認する。
 * @oracle ENOENTのみ成功。Docker不存在でも他の条件は未確認。
 * @cleanup 代役を復元し当該実行を終了まで待つ。
 * @boundary 実Docker・AI・保持物を使用しない。
 */
test("config終了はENOENTだけを不存在とし再出現・観測不能・削除失敗を成功にしない", async (t) => {
  for (const mode of ["normal", "standalone"] as const)
    for (const observation of [
      "ENOENT",
      "present",
      "EACCES",
      "EPERM",
      "EIO",
      "remove_failed",
    ])
      await t.test(`${mode}:${observation}`, async (t) => {
        const f = await createIsolationFixture(t);
        const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
        assert.ok(prepared);
        if (mode === "normal") {
          f.configObservation = observation;
          if (observation === "remove_failed") f.configCloseError = "EACCES";
        }
        let result = await f.api.executeIsolation(prepared).completion;
        if (mode === "standalone") {
          assert.equal(result.cleanup.confirmed, true);
          f.configObservation = observation;
          if (observation === "remove_failed") f.configCloseError = "EACCES";
          result = await f.api.cleanupIsolation(
            {
              managementDirectory: f.request.managementDirectory,
              resources: result.resources,
              cleanupOrder: ["container"],
              setupTimeoutMs: 10_000,
              unreceiptedAbsence: "retain",
              verifyLabelAbsence: false,
              previouslyAbsent: [],
            },
            ISOLATION_SETTINGS,
          ).completion;
        }
        assert.equal(
          result.cleanup.configCleanupConfirmed,
          observation === "ENOENT",
        );
        assert.equal(result.cleanup.confirmed, observation === "ENOENT");
        assert.equal(f.ids.size, 0);
        assert.equal(
          result.resources.resources[0]?.identity.dockerId,
          "a".repeat(64),
        );
      });
});

/** 本番と同じ共通Ownerへ固定された有限Transportだけを接続する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */

/**
 * 準備後の実体差をEffect前の型付き失敗へ保持する。
 * @responsibility 初回再検証の拒否時点と一回使用を確認する。
 * @trace ERB-IT-004
 * @precondition 有限CLI・Directory・Process代役を使用する。
 * @stimulus 準備後のCLI既知例外・未知例外・Directory置換を与える。
 * @observation Failure、要求数、元準備の再使用、通知解放。
 * @oracle 要求0、分類保持、再使用拒否、生例外非公開。
 * @cleanup 有限代役を復元しCompletionまで待つ。
 * @boundary 実体の再検証からDocker Effect直前まで。実Docker・AIなし。
 */
test("開始時の再検証失敗はDI結果へ分類し要求を発行しない", async (t) => {
  for (const code of [
    "ENOENT",
    "EACCES",
    "EPERM",
    "private_unknown",
    "directory_changed",
  ]) {
    await t.test(code, async (t) => {
      const f = await createIsolationFixture(t);
      const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
      assert.ok(prepared);
      if (code === "directory_changed") f.directoryIdentity = "replacement";
      else f.cliFailure = code;
      const execution = f.api.executeIsolation(prepared);
      assert.throws(() => f.api.executeIsolation(prepared), /already_started/u);
      const result = await execution.completion;
      assert.equal(result.failure?.stage, "preparation");
      assert.equal(
        result.failure?.exceptionCode,
        code === "private_unknown" || code === "directory_changed"
          ? "unclassified_exception"
          : code,
      );
      if (code === "directory_changed")
        assert.equal(
          result.failure?.reason,
          "docker_isolation_directory_changed",
        );
      assert.equal(result.failure?.commandHandleObtained, false);
      assert.equal(result.failure?.responseObserved, false);
      assert.equal(f.calls.length, 0);
      assert.equal(f.ids.size, 0);
      assert.ok(
        result.resources.resources.every((r) => r.request === "not_issued"),
      );
      assert.equal(result.cleanup.confirmed, true);
      assert.equal(result.callbackRegistrationReleased, true);
      assert.equal(
        JSON.stringify(result).includes("private diagnostic"),
        false,
      );
      assert.throws(
        () => f.api.executeIsolation({ ...prepared }),
        /preparation_invalid/u,
      );
    });
  }
});

/**
 * 元準備の一回性と通知・結果・回収の順序を確認する。
 * @responsibility 共通実行の元値と終了後条件を検証する。
 * @trace ERB-IT-004
 * @precondition 有限Transportだけを接続する。
 * @stimulus 元準備を実行し二回目を拒否させる。
 * @observation Snapshot、通知順、資源不存在。
 * @oracle 一回だけ発行し回収後に完了する。
 * @cleanup 代役を復元する。実Docker・AIは使用しない。
 * @boundary 元準備から共通Lifecycleまで。
 */
test("共通入口は元準備を一回だけ実行し非秘密Snapshotと回収結果を返す", async (t) => {
  const f = await createIsolationFixture(t),
    notices: string[] = [];
  const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  assert.equal(JSON.stringify(prepared).includes("synthetic-secret"), false);
  assert.equal(f.calls.length, 0);
  assert.equal(prepared.resources.resources[0]?.request, "not_issued");
  assert.throws(
    () => f.api.executeIsolation({ ...prepared }),
    /preparation_invalid/u,
  );
  const execution = f.api.executeIsolation(prepared, {
    onSubmitting: (s) => {
      notices.push(`intent:${s.key}`);
    },
    onCreated: (s, r) => {
      notices.push(`receipt:${s.key}`);
      assert.equal(r.resources[0]?.identity.dockerId, "a".repeat(64));
    },
    onCompleted: (s) => {
      notices.push(`completed:${s.key}`);
    },
    onCleanupSubmitting: () => {
      notices.push("cleanup");
    },
  });
  assert.throws(() => f.api.executeIsolation(prepared), /already_started/u);
  const result = await execution.completion;
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(result.processTerminationConfirmed, true);
  assert.equal(result.callbackRegistrationReleased, true);
  assert.equal(result.resources.resources[0]?.request, "issued");
  assert.equal(
    JSON.stringify(result.resources).includes("synthetic-secret"),
    false,
  );
  assert.ok(notices.indexOf("receipt:create") < notices.indexOf("intent:run"));
  assert.equal(notices.at(-1), "cleanup");
  assert.equal(f.ids.size, 0);
  assert.equal((await execution.cancel()).cancellationRequested, false);
});

/** 開始前取消と二重取消を前進・再実行へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口はService開始と資源集合Snapshot・逆順回収を同じOwnerで確定する", async (t) => {
  const f = await createIsolationFixture(t, true);
  const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const receipts: string[] = [],
    cleanup: string[] = [];
  const result = await f.api.executeIsolation(prepared, {
    onCreated: (step, snapshot) => {
      assert.equal(snapshot.resources.length, 2);
      const received = snapshot.resources.find((r) => r.key === step.resource);
      assert.equal(received?.request, "issued");
      assert.ok(received?.identity.dockerId);
      receipts.push(step.resource);
    },
    onCleanupSubmitting: (key) => {
      cleanup.push(key);
    },
  }).completion;
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(result.resources.resources.length, 2);
  assert.ok(
    result.resources.resources.every(
      (r) => r.request === "issued" && r.identity.dockerId,
    ),
  );
  assert.deepEqual(receipts, ["service", "container"]);
  assert.deepEqual(cleanup, ["container", "service"]);
  assert.deepEqual(f.waitTimeouts, [10_000, 300_000]);
  assert.ok(f.calls.some((a) => a[0] === "start" && !a.includes("--attach")));
  assert.equal(f.ids.size, 0);
});

/** 開始前取消と二重取消を前進・再実行へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常と単独Cleanupは同じ元Snapshot・技術回収を使い再実行しない", async (t) => {
  const f = await createIsolationFixture(t),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const first = await f.api.executeIsolation(prepared).completion;
  assert.equal(first.cleanup.confirmed, true);
  const creates = f.calls.filter((a) => a[0] === "create").length;
  const runs = f.calls.filter((a) => a[0] === "start").length;
  f.ids.add("a".repeat(64));
  const resources = {
    resources: first.resources.resources.map((r) => ({
      ...r,
      configuration: {
        ...r.configuration,
        image: "diagnostic-only-different-image",
      },
    })),
  };
  const result = await f.api.cleanupIsolation(
    {
      managementDirectory: f.request.managementDirectory,
      resources,
      cleanupOrder: ["container"],
      setupTimeoutMs: 10_000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
      previouslyAbsent: [],
    },
    ISOLATION_SETTINGS,
  ).completion;
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(
    result.resources.resources[0]?.identity.dockerId,
    "a".repeat(64),
  );
  assert.equal(
    result.resources.resources[0]?.configuration.image,
    "diagnostic-only-different-image",
  );
  assert.equal(f.calls.filter((a) => a[0] === "create").length, creates);
  assert.equal(f.calls.filter((a) => a[0] === "start").length, runs);
  assert.equal(f.ids.size, 0);
});

/** 保存済み不存在を、再出現した資源への削除許可へ変えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("単独Cleanupは既不存在Checkpointと現在残存の矛盾で削除しない", async (t) => {
  const f = await createIsolationFixture(t, true),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const first = await f.api.executeIsolation(prepared).completion;
  f.ids.add("a".repeat(64));
  f.ids.add("b".repeat(64));
  const removals = f.calls.filter((a) => a.includes("rm")).length;
  const result = await f.api.cleanupIsolation(
    {
      managementDirectory: f.request.managementDirectory,
      resources: first.resources,
      cleanupOrder: ["container", "service"],
      setupTimeoutMs: 10_000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
      previouslyAbsent: ["container"],
    },
    ISOLATION_SETTINGS,
  ).completion;
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(f.calls.filter((a) => a.includes("rm")).length, removals);
  assert.equal(f.ids.size, 2);
  assert.equal(result.cleanup.configCleanupConfirmed, true);
});

/** 単独回収取消後の追加削除を止め、自作configだけは終了する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("単独Cleanupは取消後の次資源を削除せずconfig終了を確認する", async (t) => {
  const f = await createIsolationFixture(t, true),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const first = await f.api.executeIsolation(prepared).completion;
  f.ids.add("a".repeat(64));
  f.ids.add("b".repeat(64));
  const before = f.calls.filter((argv) => argv.includes("rm")).length;
  const execution = f.api.cleanupIsolation(
    {
      managementDirectory: f.request.managementDirectory,
      resources: first.resources,
      cleanupOrder: ["container", "service"],
      setupTimeoutMs: 10_000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
      previouslyAbsent: [],
    },
    ISOLATION_SETTINGS,
    {
      onCleanupCompleted: async (key) => {
        if (key === "container") await execution.cancel();
      },
    },
  );
  const result = await execution.completion;
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(result.cleanup.configCleanupConfirmed, true);
  assert.equal(
    f.calls.filter((argv) => argv.includes("rm")).length - before,
    1,
  );
  assert.equal(f.ids.has("b".repeat(64)), true);
});

/** 発見前のID欠測という由来を保持し、構成差を削除拒否にせず、必須発見通知の完了を要求する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("単独Cleanupは構成差を識別不一致にせず発見通知欠測では削除しない", async (t) => {
  for (const mode of [
    "normal",
    "changed",
    "changed_name",
    "changed_label",
    "rejected_notice",
    "missing_notice",
  ] as const)
    await t.test(mode, async (t) => {
      const f = await createIsolationFixture(t),
        id = "a".repeat(64);
      f.ids.add(id);
      const identity = {
        kind: "network" as const,
        name: "crdd-internal-0123456789abcdef",
        dockerId: null,
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      };
      const result = await f.api.cleanupIsolation(
        {
          managementDirectory: f.request.managementDirectory,
          resources: {
            resources: [
              {
                key: "network",
                identity,
                request: "unknown",
                configuration: {
                  image: null,
                  command: null,
                  environmentNames: null,
                  mounts: null,
                  networks: null,
                  internal: null,
                },
              },
            ],
          },
          cleanupOrder: ["network"],
          setupTimeoutMs: 10_000,
          unreceiptedAbsence: "retain",
          verifyLabelAbsence: false,
          previouslyAbsent: [],
        },
        ISOLATION_SETTINGS,
        mode === "missing_notice"
          ? {}
          : {
              onResourceIdentified: async (_key, snapshot) => {
                assert.equal(snapshot.resources[0]?.identity.dockerId, id);
                assert.equal(snapshot.resources[0]?.request, "unknown");
                if (mode === "changed") f.networkInternal = false;
                if (mode === "changed_name")
                  f.networkName = "crdd-foreign-0123456789abcdef";
                if (mode === "changed_label")
                  f.networkLabel = "fedcba9876543210";
                if (mode === "rejected_notice") throw Error("record_failed");
              },
            },
      ).completion;
      assert.equal(result.resources.resources[0]?.identity.dockerId, id);
      assert.equal(
        result.cleanup.confirmed,
        ["normal", "changed"].includes(mode),
      );
      if (mode === "missing_notice" || mode === "rejected_notice")
        assert.equal(result.failure?.stage, "notification");
      assert.equal(
        f.calls.filter((argv) => argv.includes("rm")).length,
        ["normal", "changed"].includes(mode) ? 1 : 0,
      );
      assert.equal(result.cleanup.configCleanupConfirmed, true);
    });
});

/** 開始前取消と二重取消を前進・再実行へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口は開始前取消でDocker要求0を維持する", async (t) => {
  const f = await createIsolationFixture(t),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const execution = f.api.executeIsolation(prepared);
  assert.equal((await execution.cancel()).cancellationRequested, true);
  assert.equal((await execution.cancel()).cancellationRequested, false);
  const result = await execution.completion;
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(f.calls.length, 0);
});

/** 既定config・直接constructor・疎配列の経路で準備検査を迂回しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通準備は全構築入口で検査し疎配列とconfig省略を拒否する", async (t) => {
  const f = await createIsolationFixture(t),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const missingConfig = {
    ...f.request,
    managementDirectory: null,
  } as unknown as IsolationRequest;
  assert.equal(f.api.prepareIsolation(missingConfig, ISOLATION_SETTINGS), null);
  const resource = f.request.resources[0];
  assert.ok(resource?.kind === "container");
  const wrongImage = {
    ...f.request,
    resources: [{ ...resource, image: "unknown" }],
  };
  assert.throws(
    () =>
      Reflect.construct(prepared.constructor, [wrongImage, ISOLATION_SETTINGS]),
    /isolation_container_invalid/u,
  );
  assert.equal(Object.isFrozen(Object.getPrototypeOf(prepared)), true);
  assert.throws(
    () =>
      Object.defineProperty(Object.getPrototypeOf(prepared), "take", {
        value: () => undefined,
      }),
    TypeError,
  );
  const sparse = Array<string>(2);
  sparse[0] = "synthetic";
  Object.defineProperty(sparse, "4294967295", {
    value: "outside",
    enumerable: true,
  });
  assert.equal(
    f.api.prepareIsolation(
      {
        ...f.request,
        resources: [{ ...resource, argv: sparse }],
      },
      ISOLATION_SETTINGS,
    ),
    null,
  );
  assert.equal(f.calls.length, 0);
});

/** request起算は開始観測が停止しても起動要求からの期限を一回だけ使用する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("起動要求起算の期限は開始観測待機でリセットしない", {
  timeout: 2_000,
}, async (t) => {
  const f = await createIsolationFixture(t);
  f.pendingStarted = true;
  const steps = f.request.steps.map((s) =>
    s.action === "run"
      ? { ...s, timeoutMs: 250, deadlineOrigin: "request" as const }
      : s,
  );
  const prepared = f.api.prepareIsolation(
    { ...f.request, steps },
    ISOLATION_SETTINGS,
  );
  assert.ok(prepared);
  let notices = 0;
  const result = await f.api.executeIsolation(prepared, {
    onStarted: () => {
      notices++;
    },
  }).completion;
  assert.equal(result.failure, null);
  assert.equal(f.startedCalls, 1);
  assert.deepEqual(f.waitTimeouts, [250]);
  f.releaseStarted(true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(notices, 0);
});

/** 期限起算と開始通知を分離し、登録済み通知の一回完了を確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("要求起算でも観測できた開始は一回通知する", async (t) => {
  const f = await createIsolationFixture(t);
  const steps = f.request.steps.map((s) =>
    s.action === "run" ? { ...s, deadlineOrigin: "request" as const } : s,
  );
  const prepared = f.api.prepareIsolation(
    { ...f.request, steps },
    ISOLATION_SETTINGS,
  );
  assert.ok(prepared);
  let notices = 0;
  const result = await f.api.executeIsolation(prepared, {
    onStarted: () => {
      notices++;
    },
  }).completion;
  assert.equal(notices, 1);
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.deepEqual(f.waitTimeouts, [300_000]);
});

/** 要求起算の開始通知拒否も後続Effectを止め、回収を完了する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("要求起算の開始通知失敗は捕捉され回収結果へ接続される", async (t) => {
  const f = await createIsolationFixture(t);
  const steps = f.request.steps.map((s) =>
    s.action === "run" ? { ...s, deadlineOrigin: "request" as const } : s,
  );
  const prepared = f.api.prepareIsolation(
    { ...f.request, steps },
    ISOLATION_SETTINGS,
  );
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared, {
    onStarted: () => {
      throw Error("notification_failed");
    },
  }).completion;
  assert.equal(result.failure?.stage, "notification");
  assert.equal(result.notificationDeliveryConfirmed, false);
  assert.equal(result.cleanup.confirmed, true);
});

/** 通知が拒否しても元IDを保持し、後続runを停止し補償回収する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口はReceipt通知失敗後に前進せず元IDだけを回収する", async (t) => {
  const f = await createIsolationFixture(t),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared, {
    onCreated: async () => {
      throw Error("save_failed");
    },
  }).completion;
  assert.equal(result.failure?.stage, "notification");
  assert.equal(result.notificationDeliveryConfirmed, false);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(
    f.calls.some((a) => a[0] === "start"),
    false,
  );
  assert.equal(
    result.resources.resources[0]?.identity.dockerId,
    "a".repeat(64),
  );
});

/** 回収通知が失敗すれば元IDがあっても削除を発行しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口は回収前通知の失敗を削除許可へ変換しない", async (t) => {
  const f = await createIsolationFixture(t),
    prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared, {
    onCleanupSubmitting: () => {
      throw Error("save_failed");
    },
  }).completion;
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(
    f.calls.some((a) => a.includes("rm")),
    false,
  );
  assert.equal(result.notificationDeliveryConfirmed, false);
});

/** 実行中取消は一回配送し、Process終了未確認では削除しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口の実行中取消は終了確認と回収可否を分離する", async (t) => {
  for (const confirmed of [true, false])
    await t.test(String(confirmed), async (t) => {
      const f = await createIsolationFixture(t);
      f.pendingRun = true;
      f.processTermination = confirmed;
      const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
      assert.ok(prepared);
      let ready: () => void = () => undefined;
      const started = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const execution = f.api.executeIsolation(prepared, {
        onStarted: () => {
          ready();
        },
      });
      await started;
      const cancelled = await execution.cancel();
      assert.equal(cancelled.processTerminationObserved, confirmed);
      const result = await execution.completion;
      assert.equal(result.processTerminationConfirmed, confirmed);
      assert.equal(result.cleanup.confirmed, confirmed);
      assert.equal(
        f.calls.some((a) => a.includes("rm")),
        confirmed,
      );
      assert.equal(f.terminateCount, 1);
    });
});

/**
 * 共通実行Ownerが同じ観測から分類し同期通知へ渡すことを反証する。
 * @responsibility byte上限・Signal・終了値・未観測を別軸で保持する。
 * @trace ERB-IT-004
 * @precondition CLI・Processはfixtureの有限代役のみ。
 * @stimulus null、UTF-8、byte境界、超過とSignal、126／127、通知の例外とPromise返却。
 * @observation 通知の元結果・分類・終了値分類と回収状態。
 * @oracle errorCodeとは独立した分類を元結果から一度生成し通知する。
 * @cleanup 共通OwnerのCompletionを待ち、fixtureの代役を復元する。
 * @boundary 実Docker・実AI・過去保持物は扱わない。
 */
test("共通観測通知は出力分類と終了分類を保持し通知失敗でも回収する", async (t) => {
  const normal = {
    status: 0,
    signal: null,
    stdout: "あ",
    stderr: "",
    outputExceeded: false,
  };
  const cases = [
    {
      name: "not_observed",
      value: null,
      category: "deadline_exceeded",
      exit: "not_observed",
    },
    { name: "utf8", value: normal, category: "completed", exit: "zero" },
    {
      name: "stdout_boundary",
      value: { ...normal, stdout: "x".repeat(1_048_576) },
      category: "completed",
      exit: "zero",
    },
    {
      name: "stdout_exceeded",
      value: { ...normal, stdout: "x".repeat(1_048_577) },
      category: "output_limit_exceeded",
      exit: "zero",
    },
    {
      name: "stderr_exceeded",
      value: { ...normal, stderr: "x".repeat(262_145) },
      category: "output_limit_exceeded",
      exit: "zero",
    },
    {
      name: "signal_zero",
      value: { ...normal, signal: "SIGTERM" },
      category: "signalled",
      exit: "signal",
    },
    {
      name: "limit_signal",
      value: { ...normal, signal: "SIGTERM", outputExceeded: true },
      category: "output_limit_exceeded",
      exit: "signal",
    },
    {
      name: "126",
      value: { ...normal, status: 126 },
      category: "nonzero_exit",
      exit: "one_two_six",
    },
    {
      name: "127",
      value: { ...normal, status: 127 },
      category: "nonzero_exit",
      exit: "one_two_seven",
    },
  ];
  for (const c of cases)
    await t.test(c.name, async (t) => {
      const f = await createIsolationFixture(t);
      f.observation = c.value;
      const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
      assert.ok(prepared);
      let observed = false;
      const result = await f.api.executeIsolation(prepared, {
        onObserved: (step, commandResult) => {
          assert.equal(Object.isFrozen(commandResult), true);
          const {
            observation: value,
            classification,
            exitClass,
          } = commandResult;
          if (step.key !== "run") return;
          observed = true;
          assert.strictEqual(value, c.value);
          assert.equal(classification.category, c.category);
          assert.equal(exitClass, c.exit);
          assert.ok(Object.isFrozen(classification));
          if (c.value && "stdoutBytes" in classification) {
            assert.equal(
              classification.stdoutBytes,
              Buffer.byteLength(c.value.stdout, "utf8"),
            );
            assert.equal(
              classification.stderrBytes,
              Buffer.byteLength(c.value.stderr, "utf8"),
            );
          } else assert.equal("stdoutBytes" in classification, false);
        },
      }).completion;
      assert.equal(observed, true);
      assert.equal(result.cleanup.confirmed, true);
      assert.equal(f.ids.size, 0);
    });
  for (const mode of ["throw", "promise"])
    await t.test(mode, async (t) => {
      const f = await createIsolationFixture(t),
        prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
      assert.ok(prepared);
      const result = await f.api.executeIsolation(prepared, {
        onObserved: (step) => {
          if (step.key !== "run") return;
          if (mode === "throw") throw Error("synthetic");
          return Promise.reject(Error("synthetic"));
        },
      }).completion;
      assert.equal(result.failure?.stage, "notification");
      assert.equal(result.cleanup.confirmed, true);
      assert.equal(f.ids.size, 0);
    });
});

/**
 * 新用途を既存技術構成で実行・回収できることを確認する。
 * @responsibility DIの用途一覧変更なしで安全な独自key・Name・Labelを処理する。
 * @trace ERB-IT-004
 * @precondition 共通Ownerと有限CLI・Process代役を使う。
 * @stimulus 既存Container構成をutilityの相関・Namespaceへ変更して実行する。
 * @observation 元Snapshot、受付・回収、全資源不存在。
 * @oracle 共通入口で完了し、所有Labelは期待したキー・値のまま照合される。
 * @cleanup Completionまで待ち、有限代役を復元する。実Docker・AIなし。
 * @boundary 公開DIの準備・実行・回収。
 */
test("用途一覧の変更なしで新しい相関key・Labelを実行回収する", async (t) => {
  const f = await createIsolationFixture(t);
  const resource = f.request.resources[0];
  assert.ok(resource);
  const request: IsolationRequest = {
    ...f.request,
    resources: [
      {
        ...resource,
        key: "utility",
        name: "crdd-utility-0123456789abcdef",
        ownershipLabel: "crdd.utility=0123456789abcdef",
      },
    ],
    steps: f.request.steps.map((step) => ({ ...step, resource: "utility" })),
    cleanupOrder: ["utility"],
  };
  f.useRequest(request, "codex");
  const prepared = f.api.prepareIsolation(request, ISOLATION_SETTINGS);
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared).completion;
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(
    result.resources.resources[0]?.identity.ownershipLabel,
    "crdd.utility=0123456789abcdef",
  );
  assert.equal(result.resources.resources[0]?.key, "utility");
  assert.equal(f.ids.size, 0);
});
