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
import { spawnSync } from "node:child_process";
import {
  acquireNamedPipeKernelLock,
  acquireNamedPipeKernelLockOutcome,
  acquireNamedPipeSupervisorLock,
} from "../../src/index.ts";
import {
  createRuntimeLocalTypeScriptWorker,
  spawnRuntimeLocalTypeScriptChild,
} from "../../src/process/child.ts";

/**
 * 公開Pipe入口は既存用途外と不正待機値を子生成前に拒否する。
 * @responsibility 任意Path・用途外Pipe・無制限待機を公開技術入口へ持ち込まない。
 * @trace ERB-IT-002
 * @precondition 不正入力だけを使用し、正常な資源生成要求は発行しない。
 * @stimulus 同期・非同期・Supervisorの公開入口へ不正値を渡す。
 * @observation nullまたはunavailable、lock:nullを取得する。
 * @oracle 各公開入口が生成前に非取得を返す。
 * @cleanup N/A: 取得要求は拒否される。
 * @boundary ERB-IT-002=Direct Boundary: Package Root→固定用途の起動前検査。
 */
test("公開Pipe入口は任意Path・用途外Pipe・不正待機値を生成前に拒否する", async () => {
  for (const pipeName of [
    "C:\\data",
    "",
    "\\\\.\\pipe\\Other.Product.test",
    "\\\\.\\pipe\\CRDD.Coordinator.HostOperation.bad",
  ]) {
    assert.equal(acquireNamedPipeKernelLock(pipeName), null);
    assert.deepEqual(await acquireNamedPipeKernelLockOutcome(pipeName), {
      status: "unavailable",
      lock: null,
    });
    assert.deepEqual(
      await acquireNamedPipeSupervisorLock({
        pipeName,
        timing: { acquireTimeoutMs: 1_000, releaseTimeoutMs: 1_000 },
      }),
      { status: "unavailable", lock: null },
    );
  }
  for (const acquireTimeoutMs of [0, -1, 1_001, NaN, Infinity]) {
    assert.deepEqual(
      await acquireNamedPipeSupervisorLock({
        pipeName: `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${"a".repeat(32)}`,
        timing: { acquireTimeoutMs, releaseTimeoutMs: 1_000 },
      }),
      { status: "unavailable", lock: null },
    );
  }
});

/**
 * Lock Workerのstdio分離はerror／exit通知を失わない。
 * @trace ERB-IT-002
 * @precondition 固定Workerへ不正な共有状態だけを渡す。
 * @stimulus Worker内の入力例外を起こす。ProviderとDockerは使用しない。
 * @observation 親stderr監視数、errorとexit。
 * @oracle Console pipeは増えず、Worker errorと非0終了を取得できる。
 * @cleanup Workerのexitまで待つ。
 * @boundary Worker stdio分離と親への失敗通知。
 * @responsibility Lock Workerの独立stdioが親Listenerを増やさず実errorとexitを搬送することを確認する。
 */
test("Lock Workerは親Consoleへpipeせず実errorとexitを通知する", async () => {
  const errors = process.stderr.listenerCount("error");
  const closes = process.stderr.listenerCount("close");
  const worker = createRuntimeLocalTypeScriptWorker("kernel_lock_worker", {
    stdout: false,
    stderr: false,
    workerData: {
      pipeName: `\\\\.\\pipe\\CRDD.Test.${randomUUID()}`,
      state: null,
    },
  });
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
 * 実Wrapperの無出力Workerが通信とunref終了を両立する。
 * @responsibility stdioの破棄をWorker停止やLock解放と同一視しない。
 * @trace ERB-IT-002
 * @precondition 実Workerを有限の共有状態・message実装へ差し替え、OS Pipeを作らない。
 * @stimulus release通信、unref親終了、旧resume構成の変異。
 * @observation 共有状態、実exit、親stdoutと終了値。
 * @oracle 通信は正常、無出力、unref親はWorkerの期限終了に拘束されない。
 * @cleanup 子とWorkerは有限終了し、異常時は今回Nodeだけを有界停止する。
 * @boundary 実OS排他の取得・解放成立はこの代役から主張しない。
 */
test("無出力Workerは通信を維持しunref親の終了を妨げない", () => {
  const entry = new URL("../../src/process/child.ts", import.meta.url).href;
  for (const mode of ["release", "unref", "old_resume"]) {
    const source = `
      import assert from 'node:assert/strict';import threads from 'node:worker_threads';import {registerHooks,syncBuiltinESMExports} from 'node:module';
      const RealWorker=threads.Worker;const mode=${JSON.stringify(mode)};
      if(mode==='old_resume')registerHooks({load(u,c,n){const r=n(u,c);if(u===${JSON.stringify(entry)})return {...r,source:String(r.source).replaceAll('worker.stdout.destroy();','worker.stdout.resume();').replaceAll('worker.stderr.destroy();','worker.stderr.resume();')};return r;}});
      threads.Worker=class extends RealWorker{constructor(url,options){assert.ok(url.href.endsWith('/lock/worker.ts'));super(new URL('data:text/javascript,'+encodeURIComponent(
        "import {parentPort,workerData} from 'node:worker_threads';const state=new Int32Array(workerData.state);Atomics.store(state,0,1);parentPort.postMessage('held');const timer=setTimeout(()=>{Atomics.store(state,0,3);parentPort.close();},1000);parentPort.once('message',v=>{if(v==='release'){clearTimeout(timer);Atomics.store(state,0,2);parentPort.postMessage('released');parentPort.close();}});"
      )),options);}};syncBuiltinESMExports();
      const {createRuntimeLocalTypeScriptWorker}=await import(${JSON.stringify(entry)});const state=new Int32Array(new SharedArrayBuffer(4));
      const w=createRuntimeLocalTypeScriptWorker('kernel_lock_worker',{env:{},workerData:{state:state.buffer}});
      let errors=0;w.on('error',()=>errors++);
      if(mode==='release'){assert.equal(w.stdout.destroyed,true);assert.equal(w.stderr.destroyed,true);let held=false,released=false;w.on('message',v=>{if(v==='held'){held=true;assert.equal(Atomics.load(state,0),1);w.postMessage('release');}if(v==='released')released=true;});await new Promise(resolve=>w.once('exit',resolve));assert.equal(errors,0);assert.equal(held,true);assert.equal(released,true);assert.equal(Atomics.load(state,0),2);process.stdout.write('confirmed');}
      else{w.unref();process.on('exit',()=>{if(Atomics.load(state,0)===3)process.exitCode=3;process.stdout.write('confirmed');});}
    `;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", source],
      {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined, mode);
    assert.equal(child.signal, null, mode);
    assert.equal(child.status, mode === "old_resume" ? 3 : 0, child.stderr);
    assert.equal(child.stdout, "confirmed", mode);
  }
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
    () => spawnRuntimeLocalTypeScriptChild("kernel_lock_worker", [], {}),
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
      createRuntimeLocalTypeScriptWorker("kernel_lock_worker", {
        eval: true,
      }),
    /runtime_local_typescript_child_worker_eval_forbidden/u,
  );
});
