/**
 * 上位取消試験へ下位の固定Node Tree診断だけを接続する。
 * @responsibility 実Node親子のcloseと不存在を独立に確認する。
 * @trace ERB-IT-002
 * @level IT
 * @scope Task Controller取消
 * @boundary 公開された固定診断API。任意Process起動を公開しない。
 */
import assert from "node:assert/strict";
import {
  startOwnedAttachTerminationFixture,
  type OwnedCommandHandle,
} from "../../../docker-isolation/src/index.ts";
import { createDockerProcessEnvironment } from "../../../docker-isolation/src/index.ts";

/**
 * 観測済みの自己生成PIDについて不存在を確認する。
 * @responsibility ESRCH以外を不存在に畳まない。
 * @trace ERB-IT-002
 * @precondition 固定fixtureが返したPIDだけを渡す。
 * @stimulus PIDへのsignal 0。
 * @observation 存在またはESRCH。
 * @oracle 観測不能は例外。
 * @cleanup N/A: 資源を取得しない。
 * @boundary OS Process観測。
 */
function isPresent(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

/**
 * 固定Tree診断を既存の上位所有Handleへ変換する。
 * @responsibility ready、close、親子不存在を別の事実として保持する。
 * @trace ERB-IT-002
 * @precondition Windows Process制御profileだけで実行する。
 * @stimulus 固定ready_treeを開始し取消する。
 * @observation 元Handleと固定親子PID。
 * @oracle 両PID不存在と元Handle closeが必要。
 * @cleanup 元Handleのtree終端をjoinする。
 * @boundary 下位固定診断と上位Controller試験。
 */
export function createOwnedProcessTreeFixture() {
  let attached: ReturnType<
    typeof startOwnedAttachTerminationFixture<"ready_tree">
  > | null = null;
  let ids: readonly [number, number] | null = null;
  let owned: OwnedCommandHandle | null = null;
  return {
    start() {
      assert.equal(attached, null);
      const current = startOwnedAttachTerminationFixture(
        "ready_tree",
        createDockerProcessEnvironment(),
      );
      attached = current;
      owned = Object.freeze({
        started: async (timeoutMs: number) =>
          (await bounded(current.started, timeoutMs)) === true,
        wait: (timeoutMs: number) => bounded(current.completion, timeoutMs),
        closed: current.isClosed,
        terminationRequested: () => current.getTerminationRequestCount() > 0,
        terminateAndWait: async (_graceMs: number) =>
          (await current.terminateAndWait()) !== null && current.isClosed(),
      });
      return owned;
    },
    async ready() {
      const startDeadline = Date.now() + 5_000;
      while (!attached) {
        assert.ok(Date.now() < startDeadline, "fixture_start_timeout");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(await bounded(attached.ready, 5_000), true);
      const deadline = Date.now() + 5_000;
      ids = attached.observedTreeProcessIds();
      while (!ids) {
        assert.ok(Date.now() < deadline, "fixture_pid_observation_timeout");
        await new Promise((resolve) => setTimeout(resolve, 10));
        ids = attached.observedTreeProcessIds();
      }
      assert.ok(ids.every(isPresent));
      return [...ids];
    },
    assertAbsent() {
      assert.ok(ids);
      assert.ok(ids.every((pid) => !isPresent(pid)));
      assert.equal(owned?.closed(), true);
    },
    async dispose() {
      if (!attached) return;
      assert.ok(await attached.terminateAndWait());
      assert.equal(attached.isClosed(), true);
      if (ids) assert.ok(ids.every((pid) => !isPresent(pid)));
    },
  };
}

/**
 * 試験待機を上限付きにし、timeoutをnullとして返す。
 * @responsibility 成功Promiseと期限を混同せずtimerを回収する。
 * @trace ERB-IT-002
 * @precondition 非負の有限期限を渡す。
 * @stimulus 元観測Promiseを待つ。
 * @observation 元結果またはnull。
 * @oracle timeoutは成功ではない。
 * @cleanup timerをfinallyで解除する。
 * @boundary 同一Process内の試験待機。
 */
async function bounded<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
