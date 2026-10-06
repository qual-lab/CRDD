/**
 * Release Runtimeの準備、署名、昇格、終了処理を同じTTY所有権で閉じる契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 固定Snapshotと署名済み配置を同じLifecycleで保持する。
 * @trace AIT-IT-013
 * @level IT
 * @scope 公開引数と注入BindingによるRelease Runtime Lifecycleの順序・保持・終了処理。実TTY、実秘密鍵署名および実Node子Process昇格は未評価。
 * @boundary AIT-IT-013 Binding部分境界: Coordinator Lifecycle→Runtime Data／Signer／Promotion Adapter。実TTY・実署名・実子Process境界へは到達しない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  executeReleaseCandidateLifecycleForVerification,
  parseReleaseCandidateArguments,
} from "../../scripts/prepare-release-candidate.ts";

const COMMIT = "a".repeat(40);
const TREE = "b".repeat(40);
const RECOVERY = Object.freeze({
  operationId: "11111111-1111-4111-8111-111111111111",
  owner: "coordinator-release-runtime",
  identity: "11111111-1111-4111-8111-111111111111",
  generation: 1,
});
const SESSION = Object.freeze({ session: true });

/**
 * 固定Commit/Treeを持つ有効な公開引数解析結果を準備する。
 *
 * @responsibility 各CaseがLifecycle差分だけを刺激できる共通入力を作る。
 * @trace AIT-IT-013
 * @precondition COMMITとTREEは40桁hexである。
 * @stimulus 公開Parserへ期限なし署名引数を渡す。
 * @observation Parserの非null結果を取得する。
 * @oracle 有効な固定Identityが拒否されない。
 * @cleanup N/A: 局所値だけを生成する。
 * @boundary AIT-IT-013 Binding部分境界: 公開引数→Parser。TTYやFilesystemへ到達しない。
 */
function parsed() {
  const result = parseReleaseCandidateArguments([
    "--crdd-version",
    "v0.21.0",
    "--release-sequence",
    "2026100601",
    "--crdd-commit",
    COMMIT,
    "--crdd-tree",
    TREE,
    "--operation-id",
    RECOVERY.operationId,
    "--operation-identity",
    RECOVERY.identity,
    "--no-expiry",
  ]);
  assert.ok(result);
  return result;
}

/**
 * Runtime Data所有者が返す準備成功結果をBinding Fixtureとして構築する。
 *
 * @responsibility 同じSession、work、Recovery Identityを全Lifecycle Caseへ渡す。
 * @trace AIT-IT-013
 * @precondition 固定Fixture IdentityはCase中に変更しない。
 * @stimulus 準備成功結果を要求する。
 * @observation 不透明Session、work Directoryおよびexact回復参照を取得する。
 * @oracle Runtime Authorityを発行しないprepared形を返す。
 * @cleanup N/A: 実Filesystem資源を作成しない。
 * @boundary AIT-IT-013 Binding部分境界: Runtime Dataの返却形を置換し、実Runtime Dataへ到達しない。
 */
function preparedResult() {
  return Object.freeze({
    status: "prepared" as const,
    session: SESSION,
    workDirectory: "C:\\repo\\.crdd\\tmp\\operation\\work",
    recoveryReference: RECOVERY,
    crddCommit: COMMIT,
    crddTree: TREE,
    runtimeContentRootSha256: "c".repeat(64),
    fileCount: 10,
    nativeHash: "d".repeat(64),
    runtimeAuthorityConferred: false,
  });
}

/**
 * TTY Helperが時刻を確定した後のSigner引数を準備する。
 *
 * @responsibility work Directory差替え前の正規化済み引数を各Caseへ渡す。
 * @trace AIT-IT-013
 * @precondition issued-atは固定UTC時刻である。
 * @stimulus 正規化済みSigner引数を要求する。
 * @observation distribution-rootを含む引数列を取得する。
 * @oracle Commit、Treeおよび期限条件を保持する。
 * @cleanup N/A: 局所配列だけを生成する。
 * @boundary AIT-IT-013 Binding部分境界: TTY Helper出力形を置換し、実TTYへ到達しない。
 */
function terminalArguments() {
  return [
    "--distribution-root",
    "C:\\repo",
    "--crdd-version",
    "v0.21.0",
    "--release-sequence",
    "2026100601",
    "--crdd-commit",
    COMMIT,
    "--crdd-tree",
    TREE,
    "--issued-at",
    "2026-10-06T00:00:00.000Z",
    "--no-expiry",
  ];
}

/**
 * 公開引数が固定Identityと署名条件だけへ閉じていることを検証する。
 *
 * @responsibility repository root選択と矛盾する期限指定をEffect前に拒否する。
 * @trace AIT-IT-013
 * @precondition 有効な固定Identityと反証引数を用意する。
 * @stimulus 公開Parserへ正常、旧root指定および二重期限指定を渡す。
 * @observation 正常結果と二つのnull結果を取得する。
 * @oracle 正常だけを受理し、旧公開入力と曖昧な期限を拒否する。
 * @cleanup N/A: Parserは外部Effectを発行しない。
 * @boundary AIT-IT-013 Binding部分境界: 公開引数→Parser。実TTYへ到達しない。
 */
test("公開CLIは固定CommitとTreeを含む署名引数だけを受理する", () => {
  const accepted = parsed();
  assert.equal(accepted.operationId, RECOVERY.operationId);
  assert.equal(accepted.identity, RECOVERY.identity);
  assert.equal(accepted.signerArguments.includes("--operation-id"), false);
  assert.equal(
    accepted.signerArguments.includes("--operation-identity"),
    false,
  );
  const valid = [
    ...accepted.signerArguments,
    "--operation-id",
    RECOVERY.operationId,
    "--operation-identity",
    RECOVERY.identity,
  ];
  assert.equal(parseReleaseCandidateArguments(accepted.signerArguments), null);
  assert.equal(
    parseReleaseCandidateArguments([...valid, "--operation-id", "other"]),
    null,
  );
  for (const invalid of ["../outside", "", "a".repeat(129)]) {
    const input = [...valid];
    input[input.indexOf("--operation-identity") + 1] = invalid;
    assert.equal(parseReleaseCandidateArguments(input), null);
  }
  assert.ok(parsed());
  assert.equal(
    parseReleaseCandidateArguments([
      "--repository-root",
      "C:\\repo",
      "--crdd-version",
      "v0.21.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      COMMIT,
      "--crdd-tree",
      TREE,
      "--no-expiry",
    ]),
    null,
  );
  assert.equal(
    parseReleaseCandidateArguments([
      "--crdd-version",
      "v0.21.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      COMMIT,
      "--crdd-tree",
      TREE,
      "--valid-for-days",
      "1",
      "--no-expiry",
    ]),
    null,
  );
});

/**
 * 同じ準備workが署名と昇格へ渡り、成功後だけ片付くことを検証する。
 *
 * @responsibility 正常Lifecycleの順序、同一workおよびcompleted settlementを判定する。
 * @trace AIT-IT-013
 * @precondition 全外部境界は成功を返す注入Bindingである。
 * @stimulus Lifecycleを一回実行する。
 * @observation 呼出し順、Signer配布Root、Sessionおよびsettlement outcomeを取得する。
 * @oracle prepare→sign→promote→completed settleの順で同じworkを使う。
 * @cleanup 注入settlementがcleanupConfirmed=trueを返し、実資源は作らない。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→4 Binding。実署名TTYと実子Processは未評価。
 */
test("準備した同じworkを署名と昇格へ渡し昇格後に片付ける", async () => {
  const calls: string[] = [];
  let signerRoot = "";
  await executeReleaseCandidateLifecycleForVerification(
    parsed(),
    { repositoryRoot: "C:\\repo" } as never,
    "C:\\repo",
    terminalArguments(),
    {
      prepareRuntime: ((_root: unknown, input: unknown) => {
        calls.push("prepare");
        assert.deepEqual(input, {
          commit: COMMIT,
          tree: TREE,
          operationId: RECOVERY.operationId,
          identity: RECOVERY.identity,
        });
        return preparedResult();
      }) as never,
      runSigner: async (args) => {
        calls.push("sign");
        signerRoot = args[args.indexOf("--distribution-root") + 1] ?? "";
      },
      runPromotion: (workDirectory) => {
        calls.push(`promote:${workDirectory}`);
        return { status: 0, signal: null };
      },
      releaseRuntime: ((session: unknown, outcome: string) => {
        calls.push(`settle:${outcome}`);
        assert.equal(session, SESSION);
        return { cleanupConfirmed: true, recoveryReference: null };
      }) as never,
    },
  );
  assert.equal(signerRoot, preparedResult().workDirectory);
  assert.deepEqual(calls, [
    "prepare",
    "sign",
    `promote:${preparedResult().workDirectory}`,
    "settle:completed",
  ]);
});

/**
 * Signerの不明失敗でManifest不在を推測せずOperationを保持することを検証する。
 *
 * @responsibility 署名Effect不明時の非settlementとexact回復参照を判定する。
 * @trace AIT-IT-013
 * @precondition Runtime準備済みでSignerだけが未知理由を返す。
 * @stimulus Signer Bindingからsigning_result_unknownを送出する。
 * @observation Errorの理由・回復参照とsettlement回数を取得する。
 * @oracle exact回復参照を返し、settlementを一度も呼ばない。
 * @cleanup Operation保持を期待するCaseのため、注入Bindingによる清掃を行わない。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→Signer失敗通知。実Manifest配置は未評価。
 */
test("署名失敗は配置Effectの不在を推測せずexact回復参照を保持する", async () => {
  let settleCount = 0;
  await assert.rejects(
    executeReleaseCandidateLifecycleForVerification(
      parsed(),
      { repositoryRoot: "C:\\repo" } as never,
      "C:\\repo",
      terminalArguments(),
      {
        prepareRuntime: (() => preparedResult()) as never,
        runSigner: async () => {
          throw new Error("signing_result_unknown");
        },
        runPromotion: () => ({ status: 0, signal: null }),
        releaseRuntime: (() => {
          settleCount += 1;
          return { cleanupConfirmed: true, recoveryReference: null };
        }) as never,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const result = JSON.parse(error.message) as Record<string, unknown>;
      assert.equal(result.reason, "signing_result_unknown");
      assert.deepEqual(result.recoveryReference, RECOVERY);
      return true;
    },
  );
  assert.equal(settleCount, 0);
});

/**
 * 明示的なpassphrase拒否だけを署名Effectなしとして片付けることを検証する。
 *
 * @responsibility 固定no-effect理由とfailed settlementの限定対応を判定する。
 * @trace AIT-IT-013
 * @precondition SignerはManifest配置前のexact passphrase理由を返す。
 * @stimulus release_manifest_passphrase_invalidを送出する。
 * @observation Errorとsettlement outcomeを取得する。
 * @oracle 元の失敗を保持し、failed settlementをexactに一回呼ぶ。
 * @cleanup 注入settlementがcleanupConfirmed=trueを返す。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→Signer固定理由→Runtime Data settlement。実暗号処理は未評価。
 */
test("passphrase拒否は署名Effectなしの固定理由としてfailed settlementする", async () => {
  const outcomes: string[] = [];
  await assert.rejects(
    executeReleaseCandidateLifecycleForVerification(
      parsed(),
      { repositoryRoot: "C:\\repo" } as never,
      "C:\\repo",
      terminalArguments(),
      {
        prepareRuntime: (() => preparedResult()) as never,
        runSigner: async () => {
          throw new Error("release_manifest_passphrase_invalid");
        },
        runPromotion: () => ({ status: 0, signal: null }),
        releaseRuntime: ((_session: unknown, outcome: string) => {
          outcomes.push(outcome);
          return { cleanupConfirmed: true, recoveryReference: null };
        }) as never,
      },
    ),
    /release_manifest_passphrase_invalid/u,
  );
  assert.deepEqual(outcomes, ["failed"]);
});

/**
 * 昇格nonzeroでOperationをparent_lostへ変更せず保持することを検証する。
 *
 * @responsibility 子Process nonzero観測時の非settlementとexact回復参照を判定する。
 * @trace AIT-IT-013
 * @precondition Signerは成功し、Promotion Bindingがstatus=2を返す。
 * @stimulus Lifecycleを一回実行する。
 * @observation 停止理由、回復参照およびsettlement outcome集合を取得する。
 * @oracle promotion_failedとexact参照を返し、outcomeを捏造しない。
 * @cleanup Operation保持を期待するCaseのため、注入Bindingによる清掃を行わない。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→Promotion終了結果。実Node子Processは未評価。
 */
test("昇格失敗はparent_lostへ偽装せずexact回復参照を保持する", async () => {
  const outcomes: string[] = [];
  await assert.rejects(
    executeReleaseCandidateLifecycleForVerification(
      parsed(),
      { repositoryRoot: "C:\\repo" } as never,
      "C:\\repo",
      terminalArguments(),
      {
        prepareRuntime: (() => preparedResult()) as never,
        runSigner: async () => undefined,
        runPromotion: () => ({ status: 2, signal: null }),
        releaseRuntime: ((_session: unknown, outcome: string) => {
          outcomes.push(outcome);
          return { cleanupConfirmed: true, recoveryReference: null };
        }) as never,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const result = JSON.parse(error.message) as Record<string, unknown>;
      assert.equal(result.reason, "release_candidate_promotion_failed");
      assert.deepEqual(result.recoveryReference, RECOVERY);
      return true;
    },
  );
  assert.deepEqual(outcomes, []);
});

/**
 * 昇格起動例外でもOperationを片付けず保持することを検証する。
 *
 * @responsibility Promotion Adapterの同期例外をexact回復参照付き停止へ変換する。
 * @trace AIT-IT-013
 * @precondition Signerは成功し、Promotion Bindingが観測例外を送出する。
 * @stimulus Lifecycleを一回実行する。
 * @observation 例外理由、回復参照およびsettlement回数を取得する。
 * @oracle 元の理由とexact参照を返し、settlementを呼ばない。
 * @cleanup Operation保持を期待するCaseのため、注入Bindingによる清掃を行わない。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→Promotion Adapter例外。実Process起動は未評価。
 */
test("昇格起動例外も片付けずexact回復参照を保持する", async () => {
  let settleCount = 0;
  await assert.rejects(
    executeReleaseCandidateLifecycleForVerification(
      parsed(),
      { repositoryRoot: "C:\\repo" } as never,
      "C:\\repo",
      terminalArguments(),
      {
        prepareRuntime: (() => preparedResult()) as never,
        runSigner: async () => undefined,
        runPromotion: () => {
          throw new Error("promotion_observation_failed");
        },
        releaseRuntime: (() => {
          settleCount += 1;
          return { cleanupConfirmed: true, recoveryReference: null };
        }) as never,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const result = JSON.parse(error.message) as Record<string, unknown>;
      assert.equal(result.reason, "promotion_observation_failed");
      assert.deepEqual(result.recoveryReference, RECOVERY);
      return true;
    },
  );
  assert.equal(settleCount, 0);
});

/**
 * timeout相当のsignal結果でもOperationを保持することを検証する。
 *
 * @responsibility status=null、SIGKILLおよびtimeout Errorの相関を失敗として扱う。
 * @trace AIT-IT-013
 * @precondition Signerは成功し、Promotion Bindingがtimeout相当結果を返す。
 * @stimulus status=null、signal=SIGKILL、ETIMEDOUT Errorを返す。
 * @observation 停止理由、回復参照およびsettlement回数を取得する。
 * @oracle promotion_failedとexact参照を返し、settlementを呼ばない。
 * @cleanup Operation保持を期待するCaseのため、注入Bindingによる清掃を行わない。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→Promotion timeout相当結果。実経過時間・停止要求・子Processは未評価。
 */
test("昇格timeout相当のsignal結果でもsettleせずexact回復参照を保持する", async () => {
  let settleCount = 0;
  const timeoutError = Object.assign(new Error("spawnSync timed out"), {
    code: "ETIMEDOUT",
  });
  await assert.rejects(
    executeReleaseCandidateLifecycleForVerification(
      parsed(),
      { repositoryRoot: "C:\\repo" } as never,
      "C:\\repo",
      terminalArguments(),
      {
        prepareRuntime: (() => preparedResult()) as never,
        runSigner: async () => undefined,
        runPromotion: () => ({
          status: null,
          signal: "SIGKILL",
          error: timeoutError,
        }),
        releaseRuntime: (() => {
          settleCount += 1;
          return { cleanupConfirmed: true, recoveryReference: null };
        }) as never,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const result = JSON.parse(error.message) as Record<string, unknown>;
      assert.equal(result.reason, "release_candidate_promotion_failed");
      assert.deepEqual(result.recoveryReference, RECOVERY);
      return true;
    },
  );
  assert.equal(settleCount, 0);
});

/**
 * 昇格後のsettlement未確認を成功へ畳まないことを検証する。
 *
 * @responsibility cleanup未確認時の停止理由とexact回復参照を判定する。
 * @trace AIT-IT-013
 * @precondition SignerとPromotionは成功し、Runtime Dataがcleanup未確認を返す。
 * @stimulus completed settlementからcleanupConfirmed=falseを返す。
 * @observation Errorの理由と回復参照を取得する。
 * @oracle settlement_unconfirmedとexact参照を返す。
 * @cleanup 実資源は作らず、未確認を成功として再清掃しない。
 * @boundary AIT-IT-013 Binding部分境界: Lifecycle→Runtime Data settlement結果。実Filesystem清掃は未評価。
 */
test("昇格成功後の片付けを確認できない場合もexact回復参照を返す", async () => {
  await assert.rejects(
    executeReleaseCandidateLifecycleForVerification(
      parsed(),
      { repositoryRoot: "C:\\repo" } as never,
      "C:\\repo",
      terminalArguments(),
      {
        prepareRuntime: (() => preparedResult()) as never,
        runSigner: async () => undefined,
        runPromotion: () => ({ status: 0, signal: null }),
        releaseRuntime: (() => ({
          cleanupConfirmed: false,
          recoveryReference: RECOVERY,
        })) as never,
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const result = JSON.parse(error.message) as Record<string, unknown>;
      assert.equal(result.reason, "release_candidate_settlement_unconfirmed");
      assert.deepEqual(result.recoveryReference, RECOVERY);
      return true;
    },
  );
});
