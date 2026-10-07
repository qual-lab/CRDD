/**
 * coordinator:integration:docker-desktop-native-helperの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-desktop-native-helperが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope docker、desktop、repair、native-helper
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { describeDockerDesktopCurrentArtifactTrustContract } from "../../src/docker-desktop/docker-desktop-current-artifact-trust.ts";
import { describeDockerDesktopRepairNativeHelperContract } from "../../src/docker-desktop/docker-desktop-repair-native-process.ts";
import { createDockerDesktopRepairNativeHelperLifecycle } from "../../src/docker-desktop/docker-desktop-repair-native-process-lifecycle.ts";

for (const status of ["N", "T", "P", "X"] as const) {
  /**
   * restart S distinguishes command outcome ${status} from Docker completionを検証する。
   *
   * @responsibility restart S distinguishes command outcome ${status} from Docker completionの合否判定を所有する。
   * @trace ERB-IT-001
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart S distinguishes command outcome ${status} from Docker completionの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`restart S distinguishes command outcome ${status} from Docker completion`, async () => {
    const source = `const frame=s=>Buffer.concat([Buffer.from("CRDDDS01"),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(frame("R"));process.stdin.on("data",c=>{const k=c.toString();if(k==="S")process.stdout.write(frame("${status}"));else if(k==="Q"){process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),25)}else process.exit(3)});`;
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      "a".repeat(64),
      "restart",
    );
    assert.equal(await created.waitForInitial(), "R");
    assert.equal(
      await created.session.stopDesktop(),
      status === "N"
        ? "not_issued"
        : status === "T"
          ? "command_completed"
          : "outcome_unknown",
    );
    assert.equal((await created.session.release()).cleanup, "confirmed");
  });
}

/**
 * repairは公式停止を発行せず残存Process終了へ責務を渡すことを検証する。
 *
 * @responsibility repair Protocolで`S`をNative Helperへ送らず、意図的な未発行を返す境界を検証する。
 * @trace ERB-IT-001
 * @precondition repair ProtocolのNative Helper Sessionが確立している。
 * @stimulus stopDesktopを呼び出す。
 * @observation 返却値とNative Helperへ送信されたCommandを観測する。
 * @oracle `not_issued`を返し、Helperが`Q`以外のCommandを受信しない。
 * @cleanup releaseが子Processを回収する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("repairは公式停止を発行せず残存Process終了へ責務を渡す", async () => {
  const source = `const frame=s=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(frame("R"));process.stdin.on("data",c=>{const k=c.toString();if(k==="Q"){process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),25)}else process.exit(3)});`;
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(
    child,
    "a".repeat(64),
    "repair",
  );
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.stopDesktop(), "not_issued");
  assert.equal((await created.session.release()).cleanup, "confirmed");
});

for (const status of ["A", "V", "U"] as const) {
  /**
   * restart B client observation maps ${status} without issuing terminationを検証する。
   *
   * @responsibility restart B client observation maps ${status} without issuing terminationの合否判定を所有する。
   * @trace ERB-IT-001
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus restart B client observation maps ${status} without issuing terminationの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`restart B client observation maps ${status} without issuing termination`, async () => {
    const source = `const frame=s=>Buffer.concat([Buffer.from("CRDDDS01"),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(frame("R"));process.stdin.on("data",c=>{const k=c.toString();if(k==="B")process.stdout.write(frame("${status}"));else if(k==="Q"){process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),25)}else process.exit(3)});`;
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      "a".repeat(64),
      "restart",
    );
    assert.equal(await created.waitForInitial(), "R");
    assert.equal(
      await created.session.inspectClientProcesses(),
      status === "A" ? "absent" : status === "V" ? "verified" : "unknown",
    );
    assert.deepEqual(await created.session.release(), {
      cleanup: "confirmed",
      protocol: "completed",
    });
  });
}

for (const entry of [
  {
    protocol: "restart" as const,
    magic: "CRDDDS01",
    correctHash: true,
    accepted: true,
  },
  {
    protocol: "repair" as const,
    magic: "CRDDDR05",
    correctHash: true,
    accepted: true,
  },
  {
    protocol: "restart" as const,
    magic: "CRDDDR05",
    correctHash: true,
    accepted: false,
  },
  {
    protocol: "repair" as const,
    magic: "CRDDDS01",
    correctHash: true,
    accepted: false,
  },
  {
    protocol: "repair" as const,
    magic: "CRDDDR04",
    correctHash: true,
    accepted: false,
  },
  {
    protocol: "restart" as const,
    magic: "CRDDDS01",
    correctHash: false,
    accepted: false,
  },
]) {
  /**
   * Native protocol separation ${JSON.stringify(entry)}を検証する。
   *
   * @responsibility Native protocol separation ${JSON.stringify(entry)}の合否判定を所有する。
   * @trace ERB-IT-001
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Native protocol separation ${JSON.stringify(entry)}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`Native protocol separation ${JSON.stringify(entry)}`, async () => {
    const policy =
      "CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs";
    const hash = createHash("sha256").update(policy, "ascii").digest("hex");
    const source = [
      `const hash=Buffer.from(${JSON.stringify(entry.correctHash ? hash : "0".repeat(64))},"hex");`,
      `const frame=(s)=>Buffer.concat([Buffer.from(${JSON.stringify(entry.magic)}),Buffer.from(s),hash]);`,
      'process.stdout.write(frame("R"));',
      'process.stdin.on("data",(c)=>{process.stdout.write(frame(c.toString()==="Q"?"C":"V"));if(c.toString()==="Q")setTimeout(()=>process.exit(0),25);});',
      'process.stdin.on("end",()=>process.exit(0));',
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      hash,
      entry.protocol,
    );
    assert.equal(await created.waitForInitial(), entry.accepted ? "R" : null);
    if (entry.accepted) {
      assert.equal(await created.session.verifyArtifacts(), "verified");
      assert.deepEqual(await created.session.release(), {
        cleanup: "confirmed",
        protocol: "completed",
      });
    } else {
      assert.deepEqual(await created.failProtocol(), {
        cleanup: "confirmed",
        protocol: "failed",
      });
    }
  });
}

/**
 * 署名対象の固定textはWindows checkoutでもLFを維持するを検証する。
 *
 * @responsibility 署名対象の固定textはWindows checkoutでもLFを維持するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名対象の固定textはWindows checkoutでもLFを維持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名対象の固定textはWindows checkoutでもLFを維持する", () => {
  const attributes = fs.readFileSync(
    new URL("../../../../.gitattributes", import.meta.url),
    "utf8",
  );
  const attributeLines = new Set(attributes.trimEnd().split("\n"));
  assert.equal(attributeLines.has("* text=auto eol=lf"), true);
  assert.equal(
    attributeLines.has(
      "40_Develop/coordinator/runtime/general-task-verification.txt text eol=lf",
    ),
    true,
  );
  const bytes = fs.readFileSync(
    new URL("../../runtime/general-task-verification.txt", import.meta.url),
  );
  assert.equal(bytes.includes(0x0d), false);
  assert.equal(bytes.at(-1), 0x0a);
});

/**
 * native helperはPIDでなく同じkernel handleを停止authorityにするを検証する。
 *
 * @responsibility native helperはPIDでなく同じkernel handleを停止authorityにするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native helperはPIDでなく同じkernel handleを停止authorityにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("native helperはPIDでなく同じkernel handleを停止authorityにする", () => {
  const contract = describeDockerDesktopRepairNativeHelperContract();
  assert.equal(contract.pidAsTerminationAuthority, false);
  assert.equal(contract.processTreeTermination, false);
  assert.equal(contract.legacyVersionPolicyUsedForCurrentAuthority, false);
  assert.equal(
    contract.currentRepairAndRestartTrustBoundary,
    "official_fixed_paths_valid_docker_inc_publisher_same_operation_identity_hash",
  );
  assert.equal(
    contract.processTermination,
    "same_verified_kernel_process_handle_query_terminate_wait_close",
  );
  assert.equal(
    contract.parentLoss,
    "stdin_eof_releases_mutex_artifact_and_process_handles",
  );
  assert.equal(
    contract.cancellationCleanup,
    "close_stdin_and_join_exit_child_close_and_all_stdio_within_bound",
  );
});

/**
 * Native終了待機はCoordinatorの応答期限より短い全体期限へ収束することを検証する。
 *
 * @responsibility Process数に応じた逐次待機が外側Protocol期限を超え、Effect完了後の結果だけを不明化しないことを検証する。
 * @trace ERB-IT-001
 * @precondition Native HelperとCoordinator LifecycleのSourceが同じ配布候補に含まれる。
 * @stimulus 両Sourceで宣言したProcess終了全体期限とCommand応答期限を読み取る。
 * @observation Native側の全体期限と外側Command期限の大小関係を観測する。
 * @oracle Native側の全体期限が正数であり、CoordinatorのCommand期限より短い。
 * @cleanup N/A: Sourceを読取るだけで資源を作成しない。
 * @boundary ERB-IT-001=Direct Boundary: Native Process待機→Coordinator Protocol応答期限
 */
test("Native終了待機はCoordinatorの応答期限より短い全体期限へ収束する", () => {
  const nativeSource = fs.readFileSync(
    new URL("../../../platform-access/src/docker_repair.rs", import.meta.url),
    "utf8",
  );
  const lifecycleSource = fs.readFileSync(
    new URL(
      "../../src/docker-desktop/docker-desktop-repair-native-process-lifecycle.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const nativeBudget = nativeSource.match(
    /PROCESS_TERMINATION_TOTAL_WAIT_MS:\s*u32\s*=\s*([\d_]+);/,
  );
  const commandBudget = lifecycleSource.match(
    /COMMAND_TIMEOUT_MS\s*=\s*([\d_]+);/,
  );
  assert.ok(nativeBudget);
  assert.ok(commandBudget);
  const nativeBudgetMs = Number((nativeBudget[1] ?? "").replaceAll("_", ""));
  const commandBudgetMs = Number((commandBudget[1] ?? "").replaceAll("_", ""));
  assert.equal(nativeBudgetMs > 0, true);
  assert.equal(nativeBudgetMs < commandBudgetMs, true);
  assert.match(nativeSource, /termination_started\.elapsed\(\)\.as_millis\(\)/);
  assert.match(nativeSource, /\.min\(PROCESS_WAIT_MS\)/);
});

/**
 * 現在の障害修復と再起動はDocker更新を許容し操作中の実体だけを固定するを検証する。
 *
 * @responsibility 現在の障害修復と再起動はDocker更新を許容し操作中の実体だけを固定するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 現在の障害修復と再起動はDocker更新を許容し操作中の実体だけを固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("現在の障害修復と再起動はDocker更新を許容し操作中の実体だけを固定する", () => {
  const contract = describeDockerDesktopCurrentArtifactTrustContract();
  assert.equal(contract.publisherOrganization, "Docker Inc");
  assert.equal(contract.authenticodeRequired, true);
  assert.equal(contract.exactVersionRequired, false);
  assert.equal(contract.exactHashRequiredAcrossOperations, false);
  assert.equal(contract.sameIdentityAndHashRequiredWithinOperation, true);
  const adapter = fs.readFileSync(
    new URL(
      "../../src/docker-desktop/docker-desktop-repair-native-process.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(adapter.includes("docker-desktop-repair-policy.ts"), false);
  assert.equal(adapter.includes('protocol === "repair"'), true);
  assert.equal(adapter.includes('protocol === "restart"'), false);
  assert.equal(adapter.includes("const helperMode ="), true);
  assert.equal(adapter.includes("spawn(executablePath, [helperMode]"), true);
});

/**
 * native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認するを検証する。
 *
 * @responsibility native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認する", async () => {
  const hash = "a".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xaa);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'const status=command==="I"?"V":command==="K"?"T":command==="L"?"S":command==="V"?"V":command==="Q"?"C":"U";',
    "process.stdout.write(frame(status));",
    'if(command==="Q")setTimeout(()=>process.exit(0),75);',
    "}});",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.inspectClientProcesses(), "unknown");
  assert.equal(await created.session.inspectProcesses(), "verified");
  assert.equal(await created.session.terminateProcesses(), "terminated");
  assert.equal(await created.session.verifyArtifacts(), "verified");
  assert.equal(await created.session.launchDesktop(), "started");
  const releaseStarted = Date.now();
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
  assert.ok(Date.now() - releaseStarted >= 50);
});

/**
 * native helperはC応答後の非0 exitをcleanup成功と分離してprotocol失敗にするを検証する。
 *
 * @responsibility native helperはC応答後の非0 exitをcleanup成功と分離してprotocol失敗にするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native helperはC応答後の非0 exitをcleanup成功と分離してprotocol失敗にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("native helperはC応答後の非0 exitをcleanup成功と分離してprotocol失敗にする", async () => {
  const hash = "6".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x66);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",()=>{process.stdout.write(frame("C"));setTimeout(()=>process.exit(7),50);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
});

/**
 * native helper喪失はcommand失敗とbounded cleanup確認を分離するを検証する。
 *
 * @responsibility native helper喪失はcommand失敗とbounded cleanup確認を分離するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native helper喪失はcommand失敗とbounded cleanup確認を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("native helper喪失はcommand失敗とbounded cleanup確認を分離する", async () => {
  const hash = "b".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xbb);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stderr.write("failure");setTimeout(()=>process.exit(7),75);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.verifyArtifacts(), "unknown");
  const cleanupStarted = Date.now();
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
  assert.ok(Date.now() - cleanupStarted >= 50);
});

/**
 * 正常な取消cleanupはprotocol failureへ変換しないを検証する。
 *
 * @responsibility 正常な取消cleanupはprotocol failureへ変換しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 正常な取消cleanupはprotocol failureへ変換しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("正常な取消cleanupはprotocol failureへ変換しない", async () => {
  const hash = "f".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xff);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("end",()=>setTimeout(()=>process.exit(0),50));',
    "process.stdin.resume();",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.deepEqual(await created.session.abort(), {
    cleanup: "confirmed",
    protocol: "not_applicable",
  });
});

/**
 * helper failure後のabortはprotocol failureを保持するを検証する。
 *
 * @responsibility helper failure後のabortはprotocol failureを保持するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus helper failure後のabortはprotocol failureを保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("helper failure後のabortはprotocol failureを保持する", async () => {
  const hash = "1".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x11);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stderr.write("failure");setTimeout(()=>process.exit(7),50);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.verifyArtifacts(), "unknown");
  assert.deepEqual(await created.session.abort(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
});

/**
 * 不正initial frameはprotocol failureとしてbounded cleanupへ閉じるを検証する。
 *
 * @responsibility 不正initial frameはprotocol failureとしてbounded cleanupへ閉じるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正initial frameはprotocol failureとしてbounded cleanupへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("不正initial frameはprotocol failureとしてbounded cleanupへ閉じる", async () => {
  const hash = "2".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x22);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("X"));',
    'process.stdin.on("end",()=>setTimeout(()=>process.exit(9),50));',
    "process.stdin.resume();",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "X");
  assert.deepEqual(await created.failProtocol(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
});

/**
 * native launcherはCreateProcess後のidentity不明をissued済みとして保持するを検証する。
 *
 * @responsibility native launcherはCreateProcess後のidentity不明をissued済みとして保持するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native launcherはCreateProcess後のidentity不明をissued済みとして保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("native launcherはCreateProcess後のidentity不明をissued済みとして保持する", async () => {
  const hash = "c".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xcc);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'process.stdout.write(frame(command==="L"?"P":command==="Q"?"C":"V"));',
    'if(command==="Q")process.exitCode=0;',
    "}});",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.launchDesktop(), "partial_or_unknown");
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
});

/**
 * native K/NはEffect非発行とProcess不存在を混同しないを検証する。
 *
 * @responsibility native K/NはEffect非発行とProcess不存在を混同しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native K/NはEffect非発行とProcess不存在を混同しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("native K/NはEffect非発行とProcess不存在を混同しない", async () => {
  const hash = "e".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xee);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'process.stdout.write(frame(command==="K"?"N":command==="Q"?"C":"V"));',
    'if(command==="Q")process.exitCode=0;',
    "}});",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(
    await created.session.terminateProcesses(),
    "not_issued_unknown",
  );
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
});

/**
 * release中の不正frameは資源回収完了まで待ちprotocol成功と分離するを検証する。
 *
 * @responsibility release中の不正frameは資源回収完了まで待ちprotocol成功と分離するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus release中の不正frameは資源回収完了まで待ちprotocol成功と分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("release中の不正frameは資源回収完了まで待ちprotocol成功と分離する", async () => {
  const hash = "d".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xdd);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stdout.write(frame("X"));setTimeout(()=>process.exit(9),75);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  const started = Date.now();
  const first = created.session.release();
  const second = created.session.release();
  assert.deepEqual(await first, {
    cleanup: "confirmed",
    protocol: "failed",
  });
  assert.deepEqual(await second, {
    cleanup: "confirmed",
    protocol: "failed",
  });
  assert.ok(Date.now() - started >= 50);
});

/**
 * Q確認後のstdin.end throw／errorはprotocol成功とcleanupを直交させるを検証する。
 *
 * @responsibility Q確認後のstdin.end throw／errorはprotocol成功とcleanupを直交させるの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Q確認後のstdin.end throw／errorはprotocol成功とcleanupを直交させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Q確認後のstdin.end throw／errorはprotocol成功とcleanupを直交させる", async () => {
  for (const mode of ["throw", "error"] as const) {
    const hash = mode === "throw" ? "3".repeat(64) : "4".repeat(64);
    const byte = mode === "throw" ? "0x33" : "0x44";
    const source = [
      `const hash=Buffer.alloc(32,${byte});`,
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
      'process.stdout.write(frame("R"));',
      'process.stdin.on("data",()=>process.stdout.write(frame("C")));',
      'process.stdin.on("end",()=>process.exit(0));',
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
    assert.equal(await created.waitForInitial(), "R");
    Object.defineProperty(child.stdin, "end", {
      configurable: true,
      value: (mode === "throw"
        ? () => {
            throw new Error("synthetic end failure");
          }
        : () => {
            process.nextTick(() =>
              child.stdin.emit("error", new Error("synthetic EPIPE")),
            );
            return child.stdin;
          }) as typeof child.stdin.end,
    });
    const outcome = await created.session.release();
    assert.equal(outcome.protocol, "completed");
    assert.equal(outcome.cleanup, "confirmed");
  }
});

/**
 * active protocol中の全stdio errorは恒久listenerからfailure cleanupへ収束するを検証する。
 *
 * @responsibility active protocol中の全stdio errorは恒久listenerからfailure cleanupへ収束するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus active protocol中の全stdio errorは恒久listenerからfailure cleanupへ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("active protocol中の全stdio errorは恒久listenerからfailure cleanupへ収束する", async () => {
  for (const streamName of ["stdin", "stdout", "stderr"] as const) {
    const hash = "5".repeat(64);
    const source = [
      "const hash=Buffer.alloc(32,0x55);",
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
      'process.stdout.write(frame("R"));',
      "process.stdin.resume();",
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
    assert.equal(await created.waitForInitial(), "R");
    child[streamName].emit("error", new Error("synthetic stdio failure"));
    await created.session.failureDetected;
    const outcome = await created.session.abort();
    assert.equal(outcome.protocol, "failed");
    assert.equal(outcome.cleanup, "confirmed");
  }
});

/**
 * C確認後のstdout／stderr errorもprotocol Evidence不明として失敗するを検証する。
 *
 * @responsibility C確認後のstdout／stderr errorもprotocol Evidence不明として失敗するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus C確認後のstdout／stderr errorもprotocol Evidence不明として失敗するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("C確認後のstdout／stderr errorもprotocol Evidence不明として失敗する", async () => {
  for (const streamName of ["stdout", "stderr"] as const) {
    const hash = "7".repeat(64);
    const source = [
      "const hash=Buffer.alloc(32,0x77);",
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
      'process.stdout.write(frame("R"));',
      'process.stdin.once("data",()=>{process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),75);});',
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
    assert.equal(await created.waitForInitial(), "R");
    child.stdout.once("data", (chunk: Buffer) => {
      if (chunk.subarray(8, 9).toString("ascii") === "C")
        child[streamName].emit(
          "error",
          new Error("synthetic post-C stdio failure"),
        );
    });
    assert.deepEqual(await created.session.release(), {
      cleanup: "confirmed",
      protocol: "failed",
    });
  }
});
