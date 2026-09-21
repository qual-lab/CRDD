import { createServer } from "node:net";

const pipeName = process.argv[2];
if (
  process.argv.length !== 3 ||
  !process.connected ||
  typeof process.send !== "function" ||
  !/^\\\\\.\\pipe\\CRDD\.Coordinator\.HostOperation\.[0-9a-f]{32}$/u.test(
    pipeName ?? "",
  )
)
  process.exit(64);

const server = createServer();
let state: "starting" | "acquired" | "ready" | "closing" | "release_pending" =
  "starting";
let closeStarted = false;
let closeExitCode = 0;
let shouldReportRelease = false;
let isFinishScheduled = false;
let isDisconnectCommitted = false;

/**
 * sendの処理を実行する。
 *
 * @responsibility sendに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input status: "acquired" | "ready" | "release-ready" | "released" | "unavailable"
 * @returns sendの計算結果を返す。
 * @precondition 「status: "acquired" | "ready" | "release-ready" | "released" | "unavailable"」がsendの入力契約を満たす。
 * @postcondition sendの責務を完了した結果だけを返す。
 * @effect sendは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure sendは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant sendは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security sendはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sendは共有非同期状態を持たない同期処理である。
 */
function send(
  status: "acquired" | "ready" | "release-ready" | "released" | "unavailable",
) {
  if (!process.connected || typeof process.send !== "function") return false;
  try {
    process.send(Object.freeze({ status }));
    return true;
  } catch {
    return false;
  }
}

/**
 * disconnectAndExitの処理を実行する。
 *
 * @responsibility disconnectAndExitに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input exitCode: number
 * @returns N/A: disconnectAndExitは戻り値を返さない。
 * @precondition 「exitCode: number」がdisconnectAndExitの入力契約を満たす。
 * @postcondition disconnectAndExitの責務を完了して呼出し元へ制御を戻す。
 * @effect disconnectAndExitは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: disconnectAndExitは独自の失敗分岐を所有しない。
 * @invariant disconnectAndExitは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security disconnectAndExitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: disconnectAndExitは共有非同期状態を持たない同期処理である。
 */
function disconnectAndExit(exitCode: number) {
  process.exitCode = exitCode;
  if (process.connected) {
    isDisconnectCommitted = true;
    process.disconnect();
  }
}

/**
 * scheduleFinalExitの処理を実行する。
 *
 * @responsibility scheduleFinalExitに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns scheduleFinalExitの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がscheduleFinalExitの入力契約を満たす。
 * @postcondition scheduleFinalExitの責務を完了した結果だけを返す。
 * @effect N/A: scheduleFinalExitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: scheduleFinalExitは独自の失敗分岐を所有しない。
 * @invariant scheduleFinalExitは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: scheduleFinalExitはProcess内の同一Subsystemで完結する。
 * @security scheduleFinalExitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: scheduleFinalExitは共有非同期状態を持たない同期処理である。
 */
function scheduleFinalExit() {
  if (isFinishScheduled) return;
  isFinishScheduled = true;
  setImmediate(() => {
    setImmediate(() => {
      isFinishScheduled = false;
      if (closeExitCode === 0 && shouldReportRelease && state === "closing") {
        if (!send("released")) {
          closeExitCode = 70;
          shouldReportRelease = false;
        }
      }
      disconnectAndExit(closeExitCode);
    });
  });
}

/**
 * closeAndExitの処理を実行する。
 *
 * @responsibility closeAndExitに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input isReportRelease: boolean、exitCode: number
 * @returns closeAndExitの計算結果を返す。
 * @precondition 「isReportRelease: boolean、exitCode: number」がcloseAndExitの入力契約を満たす。
 * @postcondition closeAndExitの責務を完了した結果だけを返す。
 * @effect N/A: closeAndExitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: closeAndExitは独自の失敗分岐を所有しない。
 * @invariant closeAndExitは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: closeAndExitはProcess内の同一Subsystemで完結する。
 * @security closeAndExitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: closeAndExitは共有非同期状態を持たない同期処理である。
 */
function closeAndExit(isReportRelease: boolean, exitCode: number) {
  if (exitCode !== 0) {
    closeExitCode = exitCode;
    shouldReportRelease = false;
  } else if (!closeStarted) {
    closeExitCode = 0;
    shouldReportRelease = isReportRelease;
  }
  if (closeStarted) {
    if (state === "release_pending" && closeExitCode !== 0)
      disconnectAndExit(closeExitCode);
    return;
  }
  closeStarted = true;
  state = "closing";
  const finish = scheduleFinalExit;
  if (server.listening) server.close(finish);
  else finish();
}

/**
 * beginReleaseの処理を実行する。
 *
 * @responsibility beginReleaseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns beginReleaseの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がbeginReleaseの入力契約を満たす。
 * @postcondition beginReleaseの責務を完了した結果だけを返す。
 * @effect N/A: beginReleaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginReleaseは独自の失敗分岐を所有しない。
 * @invariant beginReleaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginReleaseはProcess内の同一Subsystemで完結する。
 * @security beginReleaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginReleaseは共有非同期状態を持たない同期処理である。
 */
function beginRelease() {
  if (closeStarted) return closeAndExit(false, 65);
  closeStarted = true;
  closeExitCode = 0;
  shouldReportRelease = false;
  state = "closing";
  const prepared = () => {
    setImmediate(() => {
      if (closeExitCode !== 0) return disconnectAndExit(closeExitCode);
      state = "release_pending";
      if (!send("release-ready")) closeAndExit(false, 70);
    });
  };
  if (server.listening) server.close(prepared);
  else prepared();
}

process.on("message", (message: unknown) => {
  if (message === "confirm-ready" && state === "acquired") {
    state = "ready";
    setImmediate(() => {
      if (state === "ready" && !send("ready")) closeAndExit(false, 70);
    });
    return;
  }
  if (message === "release" && (state === "acquired" || state === "ready")) {
    beginRelease();
    return;
  }
  if (message === "confirm-release" && state === "release_pending") {
    state = "closing";
    closeExitCode = 0;
    shouldReportRelease = true;
    scheduleFinalExit();
    return;
  }
  closeAndExit(false, 65);
});
process.once("disconnect", () => {
  if (!isDisconnectCommitted) closeAndExit(false, 66);
});
server.once("error", () => {
  send("unavailable");
  closeAndExit(false, 67);
});
server.listen(pipeName, () => {
  if (state !== "starting" || !send("acquired")) return closeAndExit(false, 70);
  state = "acquired";
});
