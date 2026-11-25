/**
 * 現在の回復開始・終了Capabilityと入力契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 操作Binding、一度だけの終了、不正計画と環境観測前の拒否を確認する。
 * @trace PRL-IT-013
 * @level IT
 * @scope 現在開始／終了Capability、固定計画とConsumer。
 * @boundary PRL-IT-013=Related 2 Blocks: 現在開始Owner→操作確認・状態保存依存。物理回収・fresh再入場は別Suite。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { types } from "node:util";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { beginDockerRecovery } from "../../src/lifecycle/environment.ts";
import { recoveryEnvironmentFixtureUrl } from "../support/recovery.ts";

/**
 * 保存Identityの拒否後にProvider Homeを観測しない。
 * @responsibility Domainの既存候補検査をNative観測・保存Effectより前へ接続する。
 * @trace PRL-IT-013
 * @precondition 本番開始本文と、Domain拒否を返す有限の入力準備境界。
 * @stimulus Identity候補が不成立または例外となる計画を渡す。
 * @observation 結果、Native Home観測数、診断段階・回数。
 * @oracle Home観測・耐久保存なし。例外は理由を秘匿して停止し、診断は一回。
 * @cleanup N/A: メモリ内のみ。実Native・Docker・File操作なし。
 * @boundary 本番開始順とDomainの候補結果。Domain自体は別試験で反証する。
 */
test("保存Identity拒否はNative Home観測より前に停止する", () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  let homeObservations = 0;
  let identityThrows = false;
  const diagnostics: unknown[] = [];
  const begin = runInNewContext(
    [
      sourceDeclaration(
        fs.readFileSync(
          new URL("../../src/lifecycle/validation.ts", import.meta.url),
          "utf8",
        ),
        "safeRecoveryReason",
      ),
      sourceDeclaration(source, "beginDockerRecovery"),
    ].join("\n") + "\nbeginDockerRecovery",
    {
      Error,
      validProductionPlan: () => true,
      randomBytes: () => Buffer.alloc(32, 1),
      prepareRepositoryDockerOperationIdentity: () => {
        if (identityThrows) throw Error("unpublished host path");
        return null;
      },
      inspectWindowsProviderHomeCandidate: () => {
        homeObservations++;
        throw Error("must_not_observe");
      },
    },
  );
  assert.equal(
    begin({ consumer: "coordinator_cli" }, {}, (d: unknown) =>
      diagnostics.push(d),
    ),
    null,
  );
  assert.equal(homeObservations, 0);
  assert.equal((diagnostics[0] as { stage: string }).stage, "plan_validation");
  identityThrows = true;
  diagnostics.length = 0;
  const stopped = begin({ consumer: "coordinator_cli" }, {}, (d: unknown) =>
    diagnostics.push(d),
  );
  assert.equal(stopped.status, "blocked");
  assert.equal(stopped.reason, "docker_task_recovery_begin_failed_closed");
  assert.equal(stopped.recoveryId, null);
  assert.equal(stopped.manualRecoveryRequired, true);
  assert.equal(homeObservations, 0);
  assert.equal(diagnostics.length, 1);
  assert.equal((diagnostics[0] as { stage: string }).stage, "plan_validation");
  assert.equal((diagnostics[0] as { recoveryId: unknown }).recoveryId, null);
});

/**
 * 非文字列の資源IdentityをJSON変換前に拒否する。
 * @responsibility 入力変換による保存Identity検査の迂回を防ぐ。
 * @trace PRL-IT-013
 * @precondition 本番の開始判定と開始本文をメモリ内で実行する。
 * @stimulus 八項目へtoJSON付きObjectまたはboxed Stringを渡す。
 * @observation 結果、変換回数、環境観測・保存準備回数。
 * @oracle null拒否、変換・環境観測・保存準備は0回。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary 開始入口からJSON変換前の型検査まで。
 */
test("資源Identityの非文字列は変換・環境観測・保存前に拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  let conversions = 0;
  let effects = 0;
  let nonces = 0;
  const begin = runInNewContext(
    `${[
      "validProductionPlan",
      "prepareRepositoryDockerOperationIdentity",
      "beginDockerRecovery",
    ]
      .map((name) => sourceDeclaration(source, name))
      .join("\n")}\nbeginDockerRecovery`,
    {
      getConsumerCompletionPolicy: () => ({}),
      types,
      Object,
      HEX64: /^[a-f0-9]{64}$/u,
      randomBytes: () => {
        nonces++;
        return Buffer.alloc(32, 1);
      },
      inspectWindowsProviderHomeCandidate: () => {
        effects++;
      },
      borrowCoordinatorStateRepository: () => {
        effects++;
        return null;
      },
    },
  );
  const valid = {
    ...productionPlan("OP-123456", "5".repeat(64)),
    executionSelection: Object.freeze({ provider: "claude" }),
    taskAttempt: 0,
  };
  assert.equal(begin(valid, {}), null);
  assert.equal(effects, 1);
  effects = 0;
  assert.equal(nonces, 1);
  nonces = 0;
  for (const key of [
    "authContainerName",
    "providerContainerName",
    "proxyContainerName",
    "internalNetworkName",
    "egressNetworkName",
    "ownershipLabel",
    "providerImageDigest",
    "proxyImageDigest",
  ] as const) {
    const value = valid[key];
    for (const replacement of [
      {
        toJSON() {
          conversions++;
          return value;
        },
      },
      new String(value),
    ]) {
      assert.equal(begin({ ...valid, [key]: replacement }, {}), null);
    }
  }
  const dynamic = {
    ...valid,
    get executionSelection() {
      conversions++;
      return valid.executionSelection;
    },
  };
  assert.equal(begin(dynamic, {}), null);
  assert.equal(
    begin(
      {
        ...valid,
        executionSelection: new Proxy(valid.executionSelection, {
          ownKeys() {
            conversions++;
            return [];
          },
        }),
      },
      {},
    ),
    null,
  );
  assert.equal(conversions, 0);
  assert.equal(effects, 0);
  assert.equal(nonces, 0);
});

/**
 * productionPlanのTest準備責務を実行する。
 *
 * @responsibility productionPlanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus productionPlanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function productionPlan(operationId: string, stableHome: string) {
  return Object.freeze({
    provider: "claude" as const,
    consumer: "coordinator" as const,
    operationId,
    profileId: "PROFILE-123456",
    providerHomeIdentityHash: "8".repeat(64),
    stableLogicalHomeBindingHash: stableHome,
    authContainerName: "crdd-auth-0123456789abcdef",
    providerContainerName: "crdd-claude-0123456789abcdef",
    proxyContainerName: "crdd-proxy-0123456789abcdef",
    internalNetworkName: "crdd-internal-0123456789abcdef",
    egressNetworkName: "crdd-egress-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    operationMode: "isolated_task" as const,
    workspaceMountMode: "read_write" as const,
  });
}

/**
 * Production Docker Recoveryは不完全なTask planをEffect前に拒否するを検証する。
 *
 * @responsibility Production Docker Recoveryは不完全なTask planをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Production Docker Recoveryは不完全なTask planをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Production Docker Recoveryは不完全なTask planをEffect前に拒否する", () => {
  assert.equal(
    beginDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
});

/**
 * 固定利用形態が欠けた計画を環境観測前に拒否する。
 * @responsibility 下位Ownerまでの利用形態伝播と観測未発行を検証する。
 * @trace PRL-IT-013
 * @precondition 他項目が有効な計画と観測回数を記録するModule差替えを使用する。
 * @stimulus 欠落・未知・非文字列のconsumerで本番開始を呼ぶ。
 * @observation 拒否結果とProvider Home観測回数を取得する。
 * @oracle 全負例がnullとなり、観測は0回である。
 * @cleanup Module差替えを復元する。外部資源は生成しない。
 * @boundary PRL-IT-013=本番開始入口→環境観測前の計画判定。
 */
test("Production Docker Recoveryは不正Consumerを環境観測前に拒否する", async (t) => {
  let observations = 0;
  /**
   * 不正Consumer時の環境観測を例外で検出する。
   *
   * @responsibility 観測の呼出しがないことを回数と例外で確認する。
   * @trace PRL-IT-013
   * @precondition observationsを0にしHome観測をこの関数へ差し替える。
   * @stimulus 欠落、未知、非文字列のconsumerで本番開始を呼ぶ。
   * @observation 開始のnull結果とobservationsを取得する。
   * @oracle 全負例でobservationsは0となり観測例外は発生しない。
   * @cleanup TestContextのModule差替えを復元する。外部資源は生成しない。
   * @boundary 開始前の計画判定と環境観測未発行の境界。
   */
  const observe = () => {
    observations += 1;
    throw new Error("unexpected_environment_observation");
  };
  const providerMock = t.mock.module("../../src/lifecycle/environment.ts", {
    namedExports: {
      ...(await import("../../src/lifecycle/environment.ts")),
      inspectWindowsProviderHomeCandidate: observe,
    },
  });
  try {
    const runtime = await import(
      recoveryEnvironmentFixtureUrl(
        new URL("../../src/lifecycle/environment.ts", import.meta.url),
      )
    );
    const valid = productionPlan("OP-123456", "5".repeat(64));
    for (const consumer of [undefined, null, "unknown", 1, {}, true]) {
      const plan = { ...valid, consumer };
      if (consumer === undefined) Reflect.deleteProperty(plan, "consumer");
      assert.equal(
        runtime.beginDockerRecovery(Object.freeze(plan), Object.freeze({})),
        null,
      );
    }
    assert.equal(observations, 0);
  } finally {
    providerMock.restore();
  }
});
