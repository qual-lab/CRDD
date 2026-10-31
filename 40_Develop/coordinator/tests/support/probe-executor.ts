/**
 * Probe移管後の上位Source試験へ実Executor本文と有限DIを接続する。
 * @responsibility 保存・完了Oracleを維持し、移管した技術ループを試験で再実装しない。
 * @trace ERB-IT-004
 * @level IT
 * @scope VMのSourceとメモリだけ。実Docker・Process・保存を使わない。
 * @boundary Coordinator実本文→Executor実本文→既存のDI代役。
 */
import fs from "node:fs";
import { types } from "node:util";
import { runInNewContext as runVm } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";

/**
 * 実上位本文を、移管先の実技術本文へ配線する。
 * @responsibility 旧試験のDI観測点を新Ownerへ接続する。
 * @trace ERB-IT-004
 * @precondition Sourceは現行宣言、依存は各Caseの有限代役だけ。
 * @stimulus 上位本体又は純粋補助のVMコードを評価する。
 * @observation 元の下位要求・通知・結果・私有Mapを観測する。
 * @oracle 技術ループを手書きで成功化せず実宣言を実行する。
 * @cleanup 有限Promiseを呼出し試験が待機する。実資源なし。
 * @boundary 二Packageの実本文とDI代役。
 */
export function runInNewContext(
  code: string,
  context: Record<string, unknown> = {},
): unknown {
  if (!code.includes("return runDockerIsolationScenario"))
    return runVm(code, context);
  const source = fs.readFileSync(
    new URL("../../../executor/src/probe/execute.ts", import.meta.url),
    "utf8",
  );
  const lower = runVm(
    `${sourceDeclaration(source, "captureMounts")}\n${sourceDeclaration(source, "notify")}\n${sourceDeclaration(source, "createIsolationProbe")};createIsolationProbe`,
    {
      ...context,
      types,
      AbortController,
      describeDockerProbeConfiguration: (
        profile: string,
        identity: object,
        mounts: object,
      ) => ({ ...identity, profile, mounts }),
      inspectDockerProbeContainer: (binding: unknown, expected: object) =>
        (context.inspectOwnedContainer as (...args: unknown[]) => unknown)(
          binding,
          expected,
        ),
      cleanupDockerProbeContainer: (binding: unknown, expected: object) =>
        (context.cleanupOwnedContainer as (...args: unknown[]) => unknown)(
          binding,
          expected,
        ),
      runDockerProbeAsync: async (
        binding: unknown,
        profile: string,
        id: string,
      ) => ({
        facts: (
          context.runDockerProbeToCompletion as (...args: unknown[]) => unknown
        )(binding, profile, id),
        cancelled: false,
        processCompletionConfirmed: true,
      }),
    },
  );
  let profile = "normal";
  const run = runVm(code, {
    ...context,
    absenceCapabilities: new WeakMap(),
    createExecutor: (request: object, options: object) =>
      lower(request, options, profile),
  });
  return (owned: unknown, selected: string | null) => {
    profile = selected ?? "normal";
    return run(owned);
  };
}
