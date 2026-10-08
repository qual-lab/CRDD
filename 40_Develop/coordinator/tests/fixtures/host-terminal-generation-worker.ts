/**
 * Nativeとの排他試験で、既存Nodeの世代Lockを保持・解放する。
 *
 * @packageDocumentation
 * @responsibility 新しい試験用世代だけを取得し、固定応答と制御EOFを通じて終端を確認する。
 * @trace ERB-IT-001
 * @level IT
 * @scope WindowsのNode／Native世代排他の双方向相互運用。
 * @boundary 実Windows Named Pipe。Host Directory、DockerおよびProviderは使用しない。
 */
import assert from "node:assert/strict";
import {
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
} from "../../src/host-execution/kernel-lock.ts";

const [rootName, nonce, mode, extra] = process.argv.slice(2);
assert.equal(extra, undefined);
assert.equal(typeof nonce, "string");
assert.match(
  nonce ?? "",
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u,
);
assert.equal(rootName, `crdd-coordinator-doctor-${nonce}`);
assert.ok(
  mode === "once" ||
    mode === "hold" ||
    mode === "supervisor-once" ||
    mode === "supervisor-hold",
);

if (mode === "supervisor-once" || mode === "supervisor-hold") {
  await runSupervisorFixture(rootName, nonce, mode);
} else {
  const lock = acquireRuntimeOwnedHostOperationKernelLock(rootName, nonce);
  if (!lock) {
    process.stdout.write("busy\n");
  } else if (mode === "once") {
    process.stdout.write(lock.release() ? "released\n" : "release-unknown\n");
  } else {
    let isFinished = false;
    const deadline = setTimeout(() => finish(), 10_000);

    /**
     * 試験用Lockを一回だけ解放し、入力と期限の待機を終了する。
     *
     * @responsibility 制御入力・EOF・期限の競合でも重複解放せず、解放未確認を保持する。
     * @trace ERB-IT-001
     * @precondition このfixtureが取得したLockだけを保持している。
     * @stimulus Native側Ownerの解放要求、制御EOFまたは10秒の期限。
     * @observation 本番Lockのrelease返答と固定stdout。
     * @oracle 確認済みだけreleased。不明はrelease-unknown。
     * @cleanup 期限と入力監視を解除し、stdinをpauseする。別世代は変更しない。
     * @boundary 同じNodeのproduction Lock Workerと制御stdin。
     */
    function finish() {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(deadline);
      process.stdin.removeAllListeners();
      process.stdin.pause();
      process.stdout.write(
        lock?.release() ? "released\n" : "release-unknown\n",
      );
    }

    process.stdin.once("data", finish);
    process.stdin.once("end", finish);
    process.stdin.resume();
    process.stdout.write("held\n");
  }
}

/**
 * 通常実行と同じ非同期Supervisorを、Nativeとの排他試験で使用する。
 *
 * @responsibility 取得、往復確認、解放と子Process終了を本番関数で観測し、失敗を競合へ畳まない。
 * @trace ERB-IT-001
 * @precondition 固定Ownerがfresh世代と二つのSupervisor用modeを指定している。
 * @stimulus 単発取得、または制御入力・EOF・10秒期限までの保持。
 * @observation 本番の取得結果、confirmReadyとexit確認付きreleaseの固定返答。
 * @oracle unavailableだけbusy。ready後のreleasedだけ解放成功とし、他の結果はexit 2。
 * @cleanup 保持期限とstdin監視を解除し、本番releaseの完了を待つ。
 * @boundary 本番Supervisor子ProcessとWindows Named Pipe。実Host DirectoryとProviderは使用しない。
 */
async function runSupervisorFixture(
  rootName: unknown,
  nonce: unknown,
  mode: "supervisor-once" | "supervisor-hold",
) {
  const outcome = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  if (outcome.status === "unavailable") {
    assert.equal(outcome.lock, null);
    process.stdout.write("busy\n");
    return;
  }
  if (outcome.status !== "acquired" || !outcome.lock) {
    process.stdout.write(`${outcome.status}\n`);
    process.exitCode = 2;
    return;
  }
  const lock = outcome.lock;
  const readiness = await lock.confirmReady();
  if (readiness !== "ready") {
    const cleanup = await lock.release();
    process.stdout.write(`${readiness}:${cleanup}\n`);
    process.exitCode = 2;
    return;
  }
  if (mode === "supervisor-once") {
    const cleanup = await lock.release();
    process.stdout.write(`${cleanup}\n`);
    if (cleanup !== "released") process.exitCode = 2;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    let isFinished = false;
    const deadline = setTimeout(() => void finish(), 10_000);

    /**
     * Supervisorの制御入力を閉じ、終了確認付き解放を一度だけ待つ。
     *
     * @responsibility EOF・期限・解放要求の競合を一回の本番releaseへ収束する。
     * @trace ERB-IT-001
     * @precondition このfixtureのSupervisorがreadyで、専用stdinだけを監視している。
     * @stimulus Native側の制御入力、EOFまたは10秒の期限。
     * @observation 本番releaseの終端結果、固定stdoutとfixture終了。
     * @oracle released以外はexit 2。例外は保持待機をrejectし成功へ変換しない。
     * @cleanup 期限とstdin監視を解除し、release完了後に保持待機を終える。
     * @boundary このfixtureが所有するSupervisor子Processと制御stdin。
     */
    async function finish() {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(deadline);
      process.stdin.removeAllListeners();
      process.stdin.pause();
      try {
        const cleanup = await lock.release();
        process.stdout.write(`${cleanup}\n`);
        if (cleanup !== "released") process.exitCode = 2;
        resolve();
      } catch (error) {
        reject(error);
      }
    }

    process.stdin.once("data", () => void finish());
    process.stdin.once("end", () => void finish());
    process.stdin.resume();
    process.stdout.write("held\n");
  });
}
