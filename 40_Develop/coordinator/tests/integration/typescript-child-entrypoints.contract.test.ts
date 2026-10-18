/**
 * 固定TypeScript子入口の起動前入力拒否を確認する。
 *
 * @packageDocumentation
 * @responsibility 旧署名graphと独立して実Wrapperの不正入力拒否を保全する。
 * @trace ERB-IT-002
 * @level IT
 * @scope unknown role、kind、shell、Worker evalの起動前拒否。
 * @boundary 入力→子生成Wrapper。開始後の搬送・取消・回収は別試験が所有する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  createRuntimeLocalTypeScriptWorker,
  spawnRuntimeLocalTypeScriptChild,
} from "../../src/host-execution/typescript-child-entrypoints.ts";

/**
 * Lock Workerのstdio分離はerror／exit通知を失わない。
 * @trace ERB-IT-002
 * @precondition 固定Workerへ不正な共有状態だけを渡す。
 * @stimulus Worker内の入力例外を起こす。ProviderとDockerは使用しない。
 * @observation 親stderr監視数、errorとexit。
 * @oracle Console pipeは増えず、Worker errorと非0終了を取得できる。
 * @cleanup Workerのexitまで待つ。
 * @boundary Worker stdio分離と親への失敗通知。
 */
test("Lock Workerは親Consoleへpipeせず実errorとexitを通知する", async () => {
  const errors = process.stderr.listenerCount("error");
  const closes = process.stderr.listenerCount("close");
  const worker = createRuntimeLocalTypeScriptWorker(
    "candidate_store_lock_worker",
    {
      stdout: false,
      stderr: false,
      workerData: {
        pipeName: `\\\\.\\pipe\\CRDD.Test.${randomUUID()}`,
        state: null,
      },
    },
  );
  assert.equal(process.stderr.listenerCount("error"), errors);
  assert.equal(process.stderr.listenerCount("close"), closes);
  let errorObserved = false;
  worker.once("error", () => {
    errorObserved = true;
  });
  const code = await new Promise<number>((resolve) =>
    worker.once("exit", resolve),
  );
  assert.equal(errorObserved, true);
  assert.notEqual(code, 0);
  assert.equal(process.stderr.listenerCount("error"), errors);
  assert.equal(process.stderr.listenerCount("close"), closes);
});

/**
 * 子ProcessとWorkerの不正な要求を生成前に拒否する。
 *
 * @responsibility roleとkindの混同、shellとevalの持込みを拒否する。
 * @trace ERB-IT-002
 * @precondition 副作用前に不正入力と判定できる固定値だけを渡す。
 * @stimulus 不明role、kind違い、shellとevalを実Wrapperへ渡す。
 * @observation 六つの固定拒否理由。
 * @oracle 各要求が対応する生成前の理由で例外になる。
 * @cleanup N/A: 正常な生成要求は発行しない。
 * @boundary 六反例は起動前拒否の部分根拠であり開始後の終了保証ではない。
 */
test("TypeScript子Wrapperは不正role・kind・shell・evalを生成前に拒否する", () => {
  assert.throws(
    () => spawnRuntimeLocalTypeScriptChild("unknown" as never, [], {}),
    /runtime_local_typescript_child_entrypoint_unknown/u,
  );
  assert.throws(
    () =>
      spawnRuntimeLocalTypeScriptChild("candidate_store_lock_worker", [], {}),
    /runtime_local_typescript_child_entrypoint_kind_mismatch/u,
  );
  assert.throws(
    () =>
      spawnRuntimeLocalTypeScriptChild("host_operation_lock_supervisor", [], {
        shell: true,
      }),
    /runtime_local_typescript_child_spawn_shell_forbidden/u,
  );
  assert.throws(
    () =>
      createRuntimeLocalTypeScriptWorker("host_operation_lock_supervisor", {}),
    /runtime_local_typescript_child_entrypoint_kind_mismatch/u,
  );
  assert.throws(
    () => createRuntimeLocalTypeScriptWorker("unknown" as never, {}),
    /runtime_local_typescript_child_entrypoint_unknown/u,
  );
  assert.throws(
    () =>
      createRuntimeLocalTypeScriptWorker("candidate_store_lock_worker", {
        eval: true,
      }),
    /runtime_local_typescript_child_worker_eval_forbidden/u,
  );
});
