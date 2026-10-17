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
import {
  createRuntimeLocalTypeScriptWorker,
  spawnRuntimeLocalTypeScriptChild,
} from "../../src/host-execution/typescript-child-entrypoints.ts";

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
