/**
 * Docker IsolationのNative補助Processの技術契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 固定Protocol、期限、Handleと資源終端の既存Oracleを技術Ownerで実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope docker、desktop、repair、native-helper
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { describeDockerRuntimeArtifactTrustContract } from "../../../docker-isolation/src/index.ts";
import { describeDockerDesktopRepairNativeHelperContract } from "../../src/docker-desktop/native-process.ts";
import { startDockerDesktopRepairHelper } from "../../src/docker-desktop/native-process.ts";
import { observePlatformAccessArtifactCandidate } from "../../src/index.ts";
import { createDockerDesktopRepairNativeHelperLifecycle } from "../../src/docker-desktop/protocol.ts";

/**
 * 故障通知の例外・拒否がNative補助子の失効と終了を止めないことを確認する。
 * @responsibility 通常発行と故障後の即時登録を同じ同期契約で検証する。
 * @trace ERB-IT-001
 * @precondition 固定R frameだけを出す自己所有の合成Node子を使用する。
 * @stimulus throw、即時reject、後着reject、pendingのlistenerと解除済みlistenerを登録する。
 * @observation 通知順序、故障結果、子exitとstdio終了、後着後の通知数。
 * @oracle 他listenerを妨げず、未完了を待たずcleanupを確定し、後着から再実行しない。
 * @cleanup 同じ子の既存failProtocolをjoinする。実Native・Dockerには接続しない。
 * @boundary PA本番Protocolと自己所有の合成子。
 */
test("Native故障listenerは非同期拒否や即時登録でも元の終了を妨げない", async (t) => {
  for (const mode of [
    "normal",
    "throw",
    "reject",
    "late_reject",
    "pending",
  ] as const) {
    await t.test(mode, async (context) => {
      const source =
        'process.stdout.write(Buffer.concat([Buffer.from("CRDDDR06R"),Buffer.alloc(32,0xaa)]));process.stdin.resume();process.stdin.on("end",()=>process.exit(0));';
      const child = spawn(process.execPath, ["-e", source], {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const created = createDockerDesktopRepairNativeHelperLifecycle(
        child,
        "a".repeat(64),
      );
      context.after(async () => {
        await created.failProtocol();
      });
      assert.equal(await created.waitForInitial(), "R");
      const seen: string[] = [];
      const delayed: Array<(error: Error) => void> = [];
      const notify = () => {
        seen.push("notice");
        if (mode === "throw") throw Error("synthetic_listener_failure");
        if (mode === "reject")
          return Promise.reject(Error("synthetic_listener_reject"));
        if (mode === "late_reject")
          return new Promise<void>((_resolve, reject) => {
            delayed.push(reject);
          });
        if (mode === "pending") return new Promise<void>(() => {});
      };
      created.session.onFailureDetected(notify);
      created.session.onFailureDetected(() => {
        seen.push("following");
      });
      const remove = created.session.onFailureDetected(() => {
        seen.push("removed");
      });
      remove();
      assert.doesNotThrow(() =>
        child.emit("error", Error("synthetic_protocol_failure")),
      );
      assert.deepEqual(seen, ["notice", "following"]);
      assert.doesNotThrow(() => {
        const unsubscribe = created.session.onFailureDetected(notify);
        unsubscribe();
      });
      await created.session.failureDetected;
      const outcome = await created.failProtocol();
      assert.deepEqual(outcome, { cleanup: "confirmed", protocol: "failed" });
      assert.equal(created.session.assertLive(), false);
      assert.notEqual(child.exitCode, null);
      assert.deepEqual(child.eventNames(), []);
      for (const reject of delayed)
        reject(Error("synthetic_late_listener_reject"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(seen, ["notice", "following", "notice"]);
      assert.deepEqual(await created.failProtocol(), outcome);
    });
  }
});

/**
 * 配布NativeのV／H／Qだけを実Windowsで照合する。
 * @responsibility 模擬Protocolと実配布物の取得・終了を分ける。
 * @trace ERB-IT-001
 * @precondition 対応Windows、固定NativeとDocker Desktop実行物が配置済み。
 * @stimulus 固定補助子を取得し、Artifact確認・利用者読取り・終了だけ行う。
 * @observation Hash形状とQ／exit／stdioの確認。生Hashは表示しない。
 * @oracle 同じ補助子の非秘密相関を取得し、正常解放する。
 * @cleanup 未解放時は同じ子をabort／joinする。
 * @boundary ERB-IT-001=Direct Boundary: Node→実配布Nativeと利用者Mutex。
 */
test("Host Windows: Repair06の同利用者相関と読取り専用終了", async () => {
  const root = new URL("../../../..", import.meta.url);
  const { fileURLToPath } = await import("node:url");
  const artifact = observePlatformAccessArtifactCandidate(fileURLToPath(root));
  assert.equal(artifact.status, "candidate");
  if (artifact.status !== "candidate") throw new Error("artifact unavailable");
  const acquired = await startDockerDesktopRepairHelper(
    artifact.artifact,
    describeDockerRuntimeArtifactTrustContract().policySha256,
  );
  let released = false;
  try {
    assert.equal(acquired.status, "acquired");
    assert.match(acquired.ownerBindingSha256 ?? "", /^[0-9a-f]{64}$/u);
    assert.ok(acquired.session);
    const result = await acquired.session.release();
    released = true;
    assert.deepEqual(result, { cleanup: "confirmed", protocol: "completed" });
  } finally {
    if (!released && acquired.session)
      assert.equal((await acquired.session.abort()).cleanup, "confirmed");
  }
});

/**
 * Hの応答期限後に届くframeを次の要求へ再利用しない。
 * @responsibility 同じ本番lifecycle本文で期限・後着・sticky拒否を反証する。
 * @trace ERB-IT-001
 * @precondition 所有模擬子と、待機だけ40msへ短縮した本番本文VM。
 * @stimulus H応答を期限後へ遅延させる。
 * @observation Hash null、二度目のH write0、stdio終了と失敗保持。
 * @oracle 期限延長や再実行で不明を成功へ置換しない。
 * @cleanup stdin終端後の子exitと全stdioをjoinする。
 * @boundary ERB-IT-001=Direct Boundary: 計測用VMのAdapter本文→模擬子。
 */
test("Repair06利用者相関: timeout後の遅延frameを拒否する", async () => {
  const text = fs.readFileSync(
    new URL("../../src/docker-desktop/protocol.ts", import.meta.url),
    "utf8",
  );
  assert.equal(text.split("const COMMAND_TIMEOUT_MS = 60_000;").length, 2);
  const body = stripTypeScriptTypes(
    text.replace(
      "const COMMAND_TIMEOUT_MS = 60_000;",
      "const COMMAND_TIMEOUT_MS = 40;",
    ),
  ).replace(
    "export function createDockerDesktopRepairNativeHelperLifecycle",
    "function createDockerDesktopRepairNativeHelperLifecycle",
  );
  const factory = runInNewContext(
    `${body}; createDockerDesktopRepairNativeHelperLifecycle`,
    { Buffer, setTimeout, clearTimeout },
  ) as typeof createDockerDesktopRepairNativeHelperLifecycle;
  const source = `const p=Buffer.alloc(32,0xaa),o=Buffer.alloc(32,0xbb),f=(s,b=p)=>Buffer.concat([Buffer.from('CRDDDR06'),Buffer.from(s),b]);let h=0;process.stdout.write(f('R'));process.stdin.on('data',c=>{for(const k of c.toString()){if(k==='V')process.stdout.write(f('V'));else if(k==='H'){h++;setTimeout(()=>process.stdout.write(f('H',o)),80)}else process.exit(3)}});process.stdin.on('end',()=>setTimeout(()=>process.exit(h===1?0:4),140));`;
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = factory(child, "a".repeat(64));
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.verifyArtifacts(), "verified");
  assert.equal(await created.readOwnerBindingSha256(), null);
  assert.equal(await created.readOwnerBindingSha256(), null);
  const cleanup = await created.failProtocol();
  assert.equal(cleanup.cleanup, "confirmed");
  assert.equal(cleanup.protocol, "failed");
  assert.equal(child.exitCode, 0);
});

/**
 * RestartへRepair専用の利用者読取りを発行しない。
 * @responsibility 既存Restart命令集合を拡張しない。
 * @trace ERB-IT-001
 * @precondition DS01だけの所有模擬子。
 * @stimulus 初期確認・V後にH読取りを試行する。
 * @observation nullとQの正常join。H受信時は子が非0で終了する。
 * @oracle H write0、既存VとQは維持する。
 * @cleanup Q・exit・stdio終了を確認する。
 * @boundary ERB-IT-001=Direct Boundary: Restart Adapter→模擬子。
 */
test("RestartはRepair06のH読取りをwrite前に拒否する", async () => {
  const source = `const f=s=>Buffer.concat([Buffer.from('CRDDDS01'),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(f('R'));process.stdin.on('data',c=>{for(const k of c.toString()){if(k==='V')process.stdout.write(f('V'));else if(k==='Q'){process.stdout.write(f('C'));setTimeout(()=>process.exit(0),20)}else process.exit(3)}});process.stdin.on('end',()=>process.exit(0));`;
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
  assert.equal(await created.session.verifyArtifacts(), "verified");
  assert.equal(await created.readOwnerBindingSha256(), null);
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
  assert.equal(child.exitCode, 0);
});

/**
 * 同じ補助Processの利用者相関を一度だけ読み、既存命令と分離する。
 * @responsibility 相関取得を認可や修復成功へ昇格せず、重複writeを防ぐ。
 * @trace ERB-IT-001
 * @precondition 所有する模擬Node子だけを使う。
 * @stimulus R→V→H、二重取得、並行V、I、Qを順に送る。
 * @observation H一回、競合Vの追加write0、同一Hash、Iの既存分類とjoin。
 * @oracle 同じcommand channelのH応答だけを返し、通常命令を壊さない。
 * @cleanup Q応答・exit・stdio終了を確認する。
 * @boundary ERB-IT-001=Direct Boundary: Native Adapter→模擬子Process。
 */
test("Repair06利用者相関: 一回取得・命令分離・競合write0", async () => {
  const source = `const p=Buffer.alloc(32,0xaa),o=Buffer.alloc(32,0xbb);const f=(s,b=p)=>Buffer.concat([Buffer.from('CRDDDR06'),Buffer.from(s),b]);let h=0,v=0;process.stdout.write(f('R'));process.stdin.on('data',c=>{for(const k of c.toString()){if(k==='V'){v++;process.stdout.write(f('V'))}else if(k==='H'){h++;const b=f('H',o);process.stdout.write(b.subarray(0,7));setTimeout(()=>process.stdout.write(b.subarray(7)),30)}else if(k==='I')process.stdout.write(f('A'));else if(k==='Q'){process.stdout.write(f('C'));setTimeout(()=>process.exit(h===1&&v===2?0:3),25)}else process.exit(4)}});process.stdin.on('end',()=>process.exit(h===1&&v===2?0:3));`;
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(
    child,
    "a".repeat(64),
  );
  assert.equal(await created.readOwnerBindingSha256(), null);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.readOwnerBindingSha256(), null);
  assert.equal(await created.session.verifyArtifacts(), "verified");
  const first = created.readOwnerBindingSha256();
  assert.equal(created.readOwnerBindingSha256(), first);
  assert.equal(await created.session.verifyArtifacts(), "unknown");
  assert.equal(await first, "b".repeat(64));
  assert.equal(await created.session.verifyArtifacts(), "verified");
  assert.equal(await created.readOwnerBindingSha256(), "b".repeat(64));
  assert.equal(await created.session.inspectProcesses(), "absent");
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
  assert.equal(await created.readOwnerBindingSha256(), null);
});

for (const extra of ["frame", "fragment", "notification_missing"] as const) {
  /**
   * H成功後の要求外応答を到着時点で失敗にする。
   * @responsibility 遅延通知でcache済み相関を再利用させない。
   * @trace ERB-IT-001
   * @precondition R／V／Hが正常完了する所有模擬子。
   * @stimulus 後続要求なしで別イベントから余分frameまたは1byteを送る。
   * @observation failure通知、Hash null、後続write 0、子の終了。
   * @oracle 次commandを待たず失効し、V／H以外の要求は発行されない。
   * @cleanup 同じ子のfailure cleanupをjoinする。
   * @boundary ERB-IT-001=Direct Boundary: 本番parser→所有模擬子。
   */
  test(`Repair06利用者相関: H成功後の遅延${extra}を拒否する`, async () => {
    const source = `const f=(s,b=Buffer.alloc(32,0xaa))=>Buffer.concat([Buffer.from('CRDDDR06'),Buffer.from(s),b]);let calls='';process.stdout.write(f('R'));process.stdin.on('data',c=>{for(const k of c.toString()){calls+=k;if(k==='V')process.stdout.write(f('V'));else if(k==='H'){process.stdout.write(f('H',Buffer.alloc(32,0xbb)));setTimeout(()=>process.stdout.write(${extra === "frame" ? "f('H',Buffer.alloc(32,0xbb))" : "Buffer.from([1])"}),100)}else process.exit(3)}});process.stdin.on('end',()=>process.exit(calls==='VH'?0:4));`;
    let factory = createDockerDesktopRepairNativeHelperLifecycle;
    if (extra === "notification_missing") {
      const text = fs.readFileSync(
        new URL("../../src/docker-desktop/protocol.ts", import.meta.url),
        "utf8",
      );
      assert.equal(text.split("    failureDetected,").length, 2);
      const body = stripTypeScriptTypes(
        text.replace(
          "    failureDetected,",
          "    failureDetected: new Promise<void>(() => undefined),",
        ),
      ).replace(
        "export function createDockerDesktopRepairNativeHelperLifecycle",
        "function createDockerDesktopRepairNativeHelperLifecycle",
      );
      factory = runInNewContext(
        `${body}; createDockerDesktopRepairNativeHelperLifecycle`,
        {
          Buffer,
          setTimeout,
          clearTimeout,
        },
      ) as typeof factory;
    }
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = factory(child, "a".repeat(64));
    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    try {
      assert.equal(await created.waitForInitial(), "R");
      assert.equal(await created.session.verifyArtifacts(), "verified");
      assert.equal(await created.readOwnerBindingSha256(), "b".repeat(64));
      const observed = Promise.race([
        created.session.failureDetected,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new Error("synthetic notification timeout"));
          }, 2_000);
        }),
      ]);
      if (extra === "notification_missing") {
        await assert.rejects(observed, /synthetic notification timeout/u);
        assert.equal(timedOut, true);
      } else {
        await observed;
        assert.equal(timedOut, false);
      }
      assert.equal(created.session.assertLive(), false);
      assert.equal(await created.readOwnerBindingSha256(), null);
      assert.equal(await created.session.verifyArtifacts(), "unknown");
      const settled = await created.failProtocol();
      assert.equal(settled.cleanup, "confirmed");
      assert.equal(settled.protocol, "failed");
      assert.equal(child.exitCode, 0);
    } finally {
      clearTimeout(timer);
      assert.equal((await created.session.abort()).cleanup, "confirmed");
      assert.notEqual(child.exitCode, null);
    }
  });
}

for (const scenario of [
  "old_magic",
  "restart_magic",
  "status",
  "zero",
  "policy",
  "short",
  "long",
  "duplicate",
  "extra",
  "stderr",
  "exit",
  "abort",
  "release",
] as const) {
  /**
   * 不正・中断した利用者相関を後続操作へ持ち越さない。
   * @responsibility H専用値と通常Policy応答、取得と清掃を区別する。
   * @trace ERB-IT-001
   * @precondition 異常応答を返す所有模擬子。
   * @stimulus 用途・長さ・magic差、stdio失敗と待機中取消を与える。
   * @observation Hash null、Owner失効、後続H／Vの拒否、子のjoin。
   * @oracle 不明値を再取得・成功へ補完しない。
   * @cleanup 既存abort／failure cleanupで子とstdioをjoinする。
   * @boundary ERB-IT-001=Direct Boundary: 固定Protocol→模擬子Process。
   */
  test(`Repair06利用者相関の拒否: ${scenario}`, async () => {
    const source = `const mode=${JSON.stringify(scenario)},p=Buffer.alloc(32,0xaa),o=Buffer.alloc(32,0xbb);const f=(s,b=p,m='CRDDDR06')=>Buffer.concat([Buffer.from(m),Buffer.from(s),b]);process.stdout.write(f('R'));process.stdin.on('data',c=>{for(const k of c.toString()){if(k==='V')process.stdout.write(f('V'));else if(k==='H'){let b=f('H',o);if(mode==='old_magic')b=f('H',o,'CRDDDR05');if(mode==='restart_magic')b=f('H',o,'CRDDDS01');if(mode==='status')b=f('V',o);if(mode==='zero')b=f('H',Buffer.alloc(32));if(mode==='policy')b=f('H',p);if(mode==='short')b=b.subarray(0,40);if(mode==='long')b=Buffer.concat([b,Buffer.from([1])]);if(mode==='duplicate')b=Buffer.concat([b,b]);if(mode==='extra')b=Buffer.concat([b,Buffer.alloc(41)]);if(mode==='stderr'){process.stderr.write('synthetic');setTimeout(()=>process.stdout.write(b),10)}else if(mode==='exit')process.exit(0);else if(mode!=='abort'&&mode!=='release'){process.stdout.write(b);if(mode==='short')process.exit(0)}}else if(k==='Q'){process.stdout.write(f('C'));setTimeout(()=>process.exit(0),20)}else process.exit(3)}});process.stdin.on('end',()=>process.exit(0));`;
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      "a".repeat(64),
    );
    assert.equal(await created.waitForInitial(), "R");
    assert.equal(await created.session.verifyArtifacts(), "verified");
    const pending = created.readOwnerBindingSha256();
    const cleanup =
      scenario === "abort"
        ? await created.session.abort()
        : scenario === "release"
          ? await created.session.release()
          : null;
    assert.equal(await pending, null);
    assert.equal(await created.readOwnerBindingSha256(), null);
    assert.equal(await created.session.verifyArtifacts(), "unknown");
    const final = cleanup ?? (await created.failProtocol());
    assert.equal(final.cleanup, "confirmed");
    assert.equal(created.session.assertLive(), false);
  });
}

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
   * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("repairは公式停止を発行せず残存Process終了へ責務を渡す", async () => {
  const source = `const frame=s=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(frame("R"));process.stdin.on("data",c=>{const k=c.toString();if(k==="Q"){process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),25)}else process.exit(3)});`;
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
   * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
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
    magic: "CRDDDR06",
    correctHash: true,
    accepted: true,
  },
  {
    protocol: "restart" as const,
    magic: "CRDDDR06",
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
    protocol: "repair" as const,
    magic: "CRDDDR05",
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
   * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
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
 * native helperはPIDでなく同じkernel handleを停止authorityにするを検証する。
 *
 * @responsibility native helperはPIDでなく同じkernel handleを停止authorityにするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus native helperはPIDでなく同じkernel handleを停止authorityにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
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
    new URL(
      "../../src/native/docker_desktop/windows/repair.rs",
      import.meta.url,
    ),
    "utf8",
  );
  const lifecycleSource = fs.readFileSync(
    new URL("../../src/docker-desktop/protocol.ts", import.meta.url),
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("現在の障害修復と再起動はDocker更新を許容し操作中の実体だけを固定する", () => {
  const contract = describeDockerRuntimeArtifactTrustContract();
  assert.equal(contract.publisherOrganization, "Docker Inc");
  assert.equal(contract.authenticodeRequired, true);
  assert.equal(contract.exactVersionRequired, false);
  assert.equal(contract.exactHashRequiredAcrossOperations, false);
  assert.equal(contract.sameIdentityAndHashRequiredWithinOperation, true);
  const adapter = fs.readFileSync(
    new URL("../../src/docker-desktop/native-process.ts", import.meta.url),
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認する", async () => {
  const hash = "a".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xaa);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("native helperはC応答後の非0 exitをcleanup成功と分離してprotocol失敗にする", async () => {
  const hash = "6".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x66);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("native helper喪失はcommand失敗とbounded cleanup確認を分離する", async () => {
  const hash = "b".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xbb);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("正常な取消cleanupはprotocol failureへ変換しない", async () => {
  const hash = "f".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xff);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("helper failure後のabortはprotocol failureを保持する", async () => {
  const hash = "1".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x11);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("不正initial frameはprotocol failureとしてbounded cleanupへ閉じる", async () => {
  const hash = "2".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x22);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("native launcherはCreateProcess後のidentity不明をissued済みとして保持する", async () => {
  const hash = "c".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xcc);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("native K/NはEffect非発行とProcess不存在を混同しない", async () => {
  const hash = "e".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xee);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("release中の不正frameは資源回収完了まで待ちprotocol成功と分離する", async () => {
  const hash = "d".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xdd);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("Q確認後のstdin.end throw／errorはprotocol成功とcleanupを直交させる", async () => {
  for (const mode of ["throw", "error"] as const) {
    const hash = mode === "throw" ? "3".repeat(64) : "4".repeat(64);
    const byte = mode === "throw" ? "0x33" : "0x44";
    const source = [
      `const hash=Buffer.alloc(32,${byte});`,
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("active protocol中の全stdio errorは恒久listenerからfailure cleanupへ収束する", async () => {
  for (const streamName of ["stdin", "stdout", "stderr"] as const) {
    const hash = "5".repeat(64);
    const source = [
      "const hash=Buffer.alloc(32,0x55);",
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→対象契約
 */
test("C確認後のstdout／stderr errorもprotocol Evidence不明として失敗する", async () => {
  for (const streamName of ["stdout", "stderr"] as const) {
    const hash = "7".repeat(64);
    const source = [
      "const hash=Buffer.alloc(32,0x77);",
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR06"),Buffer.from(status),hash]);',
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

/**
 * 公式停止の既存session能力と結果分類を確認する。
 * @responsibility コマンド終了をEngine停止や清掃完了へ昇格しない。
 * @trace ERB-IT-001
 * @precondition 本番停止関数本文と模擬sessionだけを使う。
 * @stimulus 能力欠落、全結果分類、未知結果と例外を渡す。
 * @observation 呼出し件数、発行と確認値。
 * @oracle 欠落は未発行、終了済みだけconfirmed、他はunknown、例外は伝播。
 * @cleanup N/A: Native／Docker要求を発行しない。
 * @boundary ERB-IT-001=Direct Boundary: 停止処理→取得済みsession。
 */
test("公式停止は既存session一回だけを使い分類を維持する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/docker-desktop/native-process.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export async function requestDockerDesktopOfficialShutdown(",
  );
  assert.ok(start >= 0);
  const shutdown = runInNewContext(
    `${stripTypeScriptTypes(source.slice(start).replace("export async function", "async function"))}; requestDockerDesktopOfficialShutdown`,
  ) as (session: object) => Promise<unknown>;
  assert.deepEqual(JSON.parse(JSON.stringify(await shutdown({}))), {
    issued: false,
    confirmation: "not_issued",
  });
  for (const result of [
    "not_issued",
    "command_completed",
    "outcome_unknown",
    "unexpected",
  ]) {
    let calls = 0;
    const observed = await shutdown({
      stopDesktop: async () => {
        calls++;
        return result;
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(observed)), {
      issued: result !== "not_issued",
      confirmation:
        result === "not_issued"
          ? "not_issued"
          : result === "command_completed"
            ? "confirmed"
            : "unknown",
    });
  }
  await assert.rejects(
    shutdown({
      stopDesktop: async () => {
        throw new Error("fixture");
      },
    }),
    /fixture/u,
  );
});
