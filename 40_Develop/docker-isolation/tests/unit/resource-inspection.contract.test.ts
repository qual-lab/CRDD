/**
 * 共通観測入口と既知実ID照合を有限の技術境界で反証する。
 * @responsibility 用途・保存相関を渡さずSnapshotと明示候補だけで観測する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 同期CLIとconfigは有限代役。実Docker・AI・保持物は使用しない。
 * @packageDocumentation
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  discoverSubmittedDockerResource,
  observeIsolationIdentity,
} from "../../src/cleanup/resource.ts";
import type { ResourceSnapshot, ResourceTarget } from "../../src/index.ts";

const ID = "a".repeat(64);
const LABEL = "crdd.coordinator.runtime=0123456789abcdef";
const NAME = "crdd-codex-0123456789abcdef";

/**
 * 欠測IDから発見した候補を既知Receiptと同じ扱いにしない。
 * @responsibility 名前・Label・実IDの一致を要求し実行構成で所有を代用しない。
 * @trace ERB-UT-023
 * @precondition 元投影の明示候補と有限CLI応答だけを使う。
 * @stimulus 名前・Label・実IDは一致しImage等の構成が異なる応答を返す。
 * @observation 発見結果と削除要求数。
 * @oracle Identity一致の実IDを返し、削除要求0。
 * @cleanup N/A: 外部資源なし。
 * @boundary 実発見処理・完全構成検査→有限Docker読取り。
 */
test("欠測IDの発見は構成差を識別不一致にしない", () => {
  const expected = {
    kind: "container" as const,
    expectedName: NAME,
    ownershipLabel: LABEL,
  };
  const id = discoverSubmittedDockerResource((argv) => {
    assert.notEqual(argv[1], "rm");
    return {
      status: 0,
      signal: null,
      stderr: "",
      error: null,
      stdout:
        argv[1] === "ls"
          ? ID
          : JSON.stringify([
              {
                Id: ID,
                Name: `/${NAME}`,
                Config: {
                  Image: "different-image",
                  Labels: { "crdd.coordinator.runtime": "0123456789abcdef" },
                },
              },
            ]),
    };
  }, expected);
  assert.equal(id, ID);
});

/**
 * 観測の正常・不明・取消・終了失敗を同じ公開入口へ接続する。
 * @responsibility 作成Intentの識別情報で観測し予定構成を実測扱いしない。
 * @trace ERB-UT-023
 * @precondition 低位接続factoryだけを代役へ置換する。
 * @stimulus 未要求・既知ID・欠測ID・二回不存在・取消・close失敗を渡す。
 * @observation 要求数、実ID、三値、Snapshotとconfig終了。
 * @oracle 未要求は接続0、欠測IDは識別情報で探索しunknownとclose失敗はblocked。
 * @cleanup 各観測のcloseとModule代役解除を確認する。
 * @boundary 公開DI→実検査・集約→有限同期Transport。
 */
test("共通観測は用途なしのSnapshotと明示候補だけを使用する", async (t) => {
  let mode = "present",
    reads = 0,
    inspections = 0,
    discoveries = 0,
    setups = 0,
    closes = 0;
  let controller = new AbortController();
  const original = await import("../../src/cleanup/execute.ts");
  const mock = t.mock.module(
    new URL("../../src/cleanup/execute.ts", import.meta.url).href,
    {
      namedExports: {
        ...original,
        createTrustedDockerRecoveryExecutor: () => {
          setups++;
          return {
            status: "ready",
            executor: {
              observeAbsent: () => {
                reads++;
                if (mode === "cancelled") controller.abort();
                return (
                  mode === "absent" ||
                  (mode === "second_unknown" && reads === 1)
                );
              },
              inspectIdentity: (
                identity: { dockerId: string | null },
                key: string,
                options: {
                  allowAlreadyAbsent?: boolean;
                  onObserved?: (snapshot: ResourceSnapshot) => void;
                },
              ) => {
                inspections++;
                assert.equal(identity.dockerId, ID);
                assert.equal(key, "resource_a");
                if (mode === "absent")
                  return options.allowAlreadyAbsent === true;
                if (
                  !["present", "close_failed", "discover_present"].includes(
                    mode,
                  )
                )
                  return false;
                options.onObserved?.({
                  resources: [
                    {
                      key,
                      identity: {
                        kind: "container",
                        dockerId: ID,
                        name: NAME,
                        ownershipLabel: LABEL,
                      },
                      request: "issued",
                      configuration: {
                        image: "observed-image",
                        command: null,
                        environmentNames: [],
                        mounts: [],
                        networks: [],
                        internal: null,
                      },
                    },
                  ],
                });
                return true;
              },
              discoverSubmitted: (expected: { expectedName: string }) => {
                discoveries++;
                assert.equal(expected.expectedName, NAME);
                assert.ok(
                  [
                    "discover_present",
                    "discovery_mismatch",
                    "second_unknown",
                    "empty_discovery",
                  ].includes(mode),
                );
                return mode === "discover_present" ? ID : null;
              },
              recoverObserved(
                expected: { dockerId: string; expectedName: string },
                options: {
                  allowAlreadyAbsent?: boolean;
                  onObserved?: (snapshot: ResourceSnapshot) => void;
                },
              ): boolean {
                assert.equal(expected.expectedName, NAME);
                return this.inspectIdentity(expected, "resource_a", options);
              },
              cleanupObserved: () => {
                throw Error("inspection_must_not_remove");
              },
              close: () => {
                closes++;
                return mode !== "close_failed";
              },
            },
          };
        },
      },
    },
  );
  t.after(() => mock.restore());
  const api = await import("../../src/index.ts");
  for (const current of [
    "not_requested",
    "present",
    "absent",
    "second_unknown",
    "empty_discovery",
    "retain",
    "cancelled",
    "close_failed",
    "discover_present",
    "discovery_mismatch",
    "retain_with_candidate",
  ]) {
    mode = current;
    reads = inspections = discoveries = setups = closes = 0;
    controller = new AbortController();
    const id = ["present", "absent", "close_failed"].includes(mode) ? ID : null;
    const request: ResourceTarget<"snapshot"> = {
      managementDirectory: path.resolve("synthetic-inspection"),
      resources: {
        resources: [
          {
            key: "resource_a",
            identity: {
              kind: "container",
              dockerId: id,
              name: NAME,
              ownershipLabel: LABEL,
            },
            request: mode === "not_requested" ? "not_issued" : "unknown",
            configuration: {
              image: "unobserved-input",
              command: null,
              environmentNames: null,
              mounts: null,
              networks: null,
              internal: null,
            },
          },
        ],
      },
      cleanupOrder: ["resource_a"],
      setupTimeoutMs: 10000,
      unreceiptedAbsence: mode.startsWith("retain") ? "retain" : "observe",
      verifyLabelAbsence: false,
      previouslyAbsent: [],
    };
    const input = request;
    const result = api.inspectIsolation(input, {
      signal: controller.signal,
      stopOnUnknownAbsence: mode.startsWith("retain"),
    });
    assert.equal(
      result.status,
      ["not_requested", "present", "absent", "discover_present"].includes(mode)
        ? "completed"
        : "blocked",
      mode,
    );
    assert.equal("operationId" in result, false);
    assert.equal("recoveryId" in result, false);
    assert.equal(
      discoveries,
      [
        "discover_present",
        "discovery_mismatch",
        "second_unknown",
        "empty_discovery",
      ].includes(mode)
        ? 1
        : 0,
    );
    assert.equal(setups, mode === "not_requested" ? 0 : 1);
    assert.equal(closes, setups);
    if (mode === "not_requested") assert.equal(reads, 0);
    if (mode.startsWith("retain") || mode === "cancelled")
      assert.equal(reads, 1);
    if (mode === "second_unknown")
      assert.deepEqual(result.resources[0]?.absenceObservations, [
        "absent",
        "unknown",
      ]);
    if (["present", "close_failed", "discover_present"].includes(mode))
      assert.equal(
        result.resourceSnapshot.resources[0]?.configuration.image,
        "observed-image",
      );
    else assert.equal(result.resourceSnapshot.resources.length, 0);
    if (mode === "close_failed")
      assert.equal(result.configCleanupConfirmed, false);
  }
});

/**
 * 既知IDの構成差を識別不一致へ戻さない。
 * @responsibility 名前・所有Label・実IDと実測Snapshotを同じinspectから確定する。
 * @trace ERB-UT-023
 * @precondition 固定CLI応答だけを返す有限関数を使う。
 * @stimulus Image・Command・Mount差、別ID・名前・Labelと一覧失敗を渡す。
 * @observation bool、要求列と非秘密Snapshot。
 * @oracle 構成差だけは受理、別実体・観測不能は拒否。削除要求0。
 * @cleanup N/A: 外部資源なし。
 * @boundary 実識別照合→有限Docker読取り。
 */
test("既知実IDの観測は最小Identityを使い構成差を削除条件へ戻さない", () => {
  for (const mode of [
    "configuration_changed",
    "wrong_id",
    "wrong_name",
    "wrong_label",
    "unavailable",
  ]) {
    let snapshot: ResourceSnapshot | null = null;
    const result = observeIsolationIdentity(
      (argv) => {
        assert.notEqual(argv[1], "rm");
        if (mode === "unavailable")
          return {
            status: 1,
            signal: null,
            stdout: "",
            stderr: "unavailable",
            error: null,
          };
        if (argv[1] === "ls")
          return {
            status: 0,
            signal: null,
            stdout: ID,
            stderr: "",
            error: null,
          };
        return {
          status: 0,
          signal: null,
          stderr: "",
          error: null,
          stdout: JSON.stringify([
            {
              Id: mode === "wrong_id" ? "b".repeat(64) : ID,
              Name: mode === "wrong_name" ? "/crdd-other" : `/${NAME}`,
              Config: {
                Image: "different-image",
                Cmd: ["different-command"],
                Env: ["SECRET=value"],
                Labels: {
                  "crdd.coordinator.runtime":
                    mode === "wrong_label"
                      ? "ffffffffffffffff"
                      : "0123456789abcdef",
                },
              },
              Mounts: [],
              NetworkSettings: { Networks: {} },
            },
          ]),
        };
      },
      { kind: "container", dockerId: ID, name: NAME, ownershipLabel: LABEL },
      "any_resource_key",
      {
        allowAlreadyAbsent: false,
        onObserved: (value) => {
          snapshot = value;
        },
      },
    );
    assert.equal(result, mode === "configuration_changed");
    if (snapshot) {
      assert.equal(JSON.stringify(snapshot).includes("SECRET=value"), false);
      assert.equal(
        JSON.stringify(snapshot).includes("different-command"),
        false,
      );
    }
  }
});
