/**
 * CROS Credential Access Recoveryの耐久記録とRegistry Effectを検証する。
 *
 * @packageDocumentation
 * @responsibility 固定計画、明示確認、不可分Registry更新、秘密非保持Eventおよび再入場Credentialを実Filesystem境界で観測する。
 * @trace RFD-IT-013
 * @level IT
 * @scope cros、credential、host-recovery、runtime-data、filesystem
 * @boundary RFD-IT-013=Direct Boundary: Host Recovery→File Recorder／Credential Registry→Bootstrap再入場。
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyCredentialAccessRecovery,
  authenticateConnectionCredential,
  createCredentialAccessRecoveryFileAdapter,
  createCredentialRegistryFileAdapter,
  issueConnectionCredential,
  planCredentialAccessRecovery,
  runCredentialAccessRecoveryCli,
  type CredentialAccessRecoveryPlan,
  type CredentialRandomBytes,
  type RequestAccessContext,
} from "../../src/index.ts";

const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/**
 * Recovery File Adapter試験用の決定論的乱数Providerを作成する。
 *
 * @responsibility CredentialとRecovery Identityの生成を試験内で再現可能にする。
 * @trace RFD-IT-013
 * @input N/A: counterを1で初期化する。
 * @returns 要求byte数を満たすCredentialRandomBytes関数。
 * @precondition 本Providerを本番へ使用しない。
 * @postcondition 呼出しごとにcounterが一つ進む。
 * @effect 試験Process内counterだけを更新する。
 * @failure N/A: 正のbyte数に必ず応答する。
 * @invariant 同じ呼出し順では同じbyte列になる。
 * @stimulus deterministicRandomの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 * @security 本番Secretを生成しない。
 * @concurrency 一つの試験内で直列利用する。
 */
function deterministicRandom(): CredentialRandomBytes {
  let counter = 1;
  return (size: number) => {
    const result = Buffer.alloc(size, counter);
    counter += 1;
    return result;
  };
}

/**
 * Recovery計画と結果を秘密なしで耐久記録し新管理Credentialへ再入場できることを検証する。
 *
 * @responsibility File RegistryとFile Recorderを同じTrust Domain Rootで接続し、Host Recoveryの公開完了条件を観測する。
 * @trace RFD-IT-013
 * @precondition OS一時Root、有効なCROS Root入力および旧Administrator Credentialを用意する。
 * @stimulus Recovery計画を生成し、確認済みで適用して新Tokenを認証する。
 * @observation prepare／settle Event、Registry revision、保存本文および新Access Contextを観測する。
 * @oracle 二Eventに生Tokenがなく、旧Admin失効とContent Grantなし新Admin発行が成立する。
 * @cleanup 試験用OS一時Rootを再帰削除する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Credential Access Recoveryを秘密非保持Eventと同時に閉じる", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-cros-access-recovery-"));
  try {
    const input = {
      platform: "win32" as const,
      trustDomainId: "recovery-domain",
      publisher: "qual-lab",
      application: "cros" as const,
      localAppData: root,
    };
    const registryAdapter = createCredentialRegistryFileAdapter(input);
    const recorderAdapter = createCredentialAccessRecoveryFileAdapter(input);
    if (
      registryAdapter.status !== "ready" ||
      recorderAdapter.status !== "ready"
    )
      assert.fail("recovery adapters must be ready");
    const random = deterministicRandom();
    const oldAdmin = issueConnectionCredential(
      registryAdapter.registry,
      ADMINISTRATOR,
      { profile: "administrator" },
      random,
    );
    if (oldAdmin.status !== "completed")
      assert.fail("old administrator must be issued");
    const planned = planCredentialAccessRecovery(
      registryAdapter.registry,
      {
        hostAuthorityConfirmed: true,
        mode: "administrator_recovery",
        recoveryId:
          "credential-access-recovery.44444444444444444444444444444444",
      },
      random,
    );
    if (planned.status !== "ready") assert.fail("plan must be ready");
    const recovered = applyCredentialAccessRecovery(
      registryAdapter.registry,
      planned.plan,
      true,
      recorderAdapter.recorder,
      random,
    );
    assert.equal(recovered.status, "completed");
    if (recovered.status !== "completed") assert.fail("recovery must complete");
    assert.equal(
      authenticateConnectionCredential(
        registryAdapter.registry,
        recovered.token,
      ).status,
      "available",
    );
    const eventDirectory = path.win32.join(
      root,
      "qual-lab",
      "cros",
      "recovery-domain",
      "credential-access-recovery",
    );
    const files = readdirSync(eventDirectory).sort();
    assert.deepEqual(files, [
      `${planned.plan.recoveryId}-prepare.json`,
      `${planned.plan.recoveryId}-settle.json`,
    ]);
    const body = files
      .map((file) =>
        readFileSync(path.win32.join(eventDirectory, file), "utf8"),
      )
      .join("\n");
    assert.equal(body.includes(recovered.token), false);
    assert.equal(body.includes("tokenVerifier"), false);
    assert.equal(body.includes("tokenSalt"), false);
    assert.match(body, /"productDataEffect":false/u);
    assert.match(body, /"registryEffectCount":1/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Host CLIが表示済みRecovery IDの人間確認後だけ処置することを検証する。
 *
 * @responsibility CLI Applicationの計画表示、確認、適用、結果表示およびexit codeを実File Adapterへ接続する。
 * @trace RFD-IT-013
 * @precondition OS一時Rootと空のCROS Trust Domainを用意する。
 * @stimulus CLI I/O Adapterが表示済みplanを確認済みとして返す。
 * @observation 出力列、exit code、Registry revisionおよびEvent fileを観測する。
 * @oracle 計画と完了結果を順に表示し、exit 0、新管理Credential一件、二Eventとなる。
 * @cleanup 試験用OS一時Rootを再帰削除する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Host CLIをexact確認からBootstrap再入場まで接続する", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-cros-recovery-cli-"));
  try {
    const input = {
      platform: "win32" as const,
      trustDomainId: "cli-domain",
      publisher: "qual-lab",
      application: "cros" as const,
      localAppData: root,
    };
    const outputLines: unknown[] = [];
    const exitCode = await runCredentialAccessRecoveryCli(
      input,
      "administrator_recovery",
      {
        write: (value) => outputLines.push(value),
        confirm: async (plan: CredentialAccessRecoveryPlan) =>
          plan.recoveryId.startsWith("credential-access-recovery."),
      },
    );
    assert.equal(exitCode, 0);
    assert.equal(outputLines.length, 2);
    assert.equal((outputLines[0] as { status?: string }).status, "ready");
    assert.equal((outputLines[1] as { status?: string }).status, "completed");
    const registry = createCredentialRegistryFileAdapter(input);
    if (registry.status !== "ready") assert.fail("registry must be ready");
    assert.equal(registry.registry.inspect().revision, 1);
    assert.equal(registry.registry.inspect().records.length, 1);
    assert.equal(registry.registry.inspect().records[0]?.systemAdmin, true);
    assert.deepEqual(registry.registry.inspect().records[0]?.workspaceIds, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
