/**
 * 明示実境界試験だけが使う認証Command接続。
 * @responsibility 作成途中・別Process再入場の試験を本番公開APIから分離する。
 * @trace ARCH-000010
 * @boundary scripts/tests専用。呼出し自体は計画を結合し、runだけが実Dockerを操作する。
 */
import {
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationCommand,
  type DockerAuthenticationExecution,
  planDockerAuthenticationResourceRecovery,
} from "../../docker-isolation/src/index.ts";
import { getAuthenticationTechnicalPlan } from "../src/authentication/operations.ts";
import type {
  AuthenticationPlan,
  AuthenticationProjection,
} from "../src/authentication/types.ts";

/**
 * 作成途中の資源を限定試験が直接確認するための接続を作る。
 * @responsibility 既存DIの元計画と実ID照合を維持する。
 * @trace ARCH-000010
 * @input plan: 試験専用の元固定Plan。
 * @returns 元計画に閉じたrunと実IDの回収計画選択。
 * @precondition 実行側が別途明示許可された限定試験である。
 * @postcondition 本番RootやCoordinatorへ任意Command実行を公開しない。
 * @effect Factoryで既存CLIを読取り確認し、runで固定DI処理を行う。
 * @failure コピーPlan・終了不明は追加処置を拒否する。
 * @invariant 終了不明を試験側で成功へ変換しない。
 * @boundary 自己生成試験資源と既存DI。
 * @security 生出力は試験Oracle内へ限定し保存しない。
 * @concurrency 元PlanのRuntimeを再利用する。
 */
export function createAuthenticationCommandTestRuntime(
  plan: AuthenticationPlan,
) {
  const technical = getAuthenticationTechnicalPlan(plan);
  if (!technical) throw Error("authentication_test_plan_unbound");
  const runtime = createDockerAuthenticationRuntimeFactory()(technical);
  let unsettled = false;
  return {
    async run(
      command: DockerAuthenticationCommand,
      live: () => boolean,
      expected: AuthenticationPlan,
    ): Promise<DockerAuthenticationExecution> {
      if (expected !== plan || unsettled)
        throw Error("authentication_test_runtime_unavailable");
      const result = await runtime.execute(command, live);
      unsettled ||= !result.processCompletionConfirmed;
      return command.purpose.startsWith("observe_") &&
        result.resourceConfigurationConfirmed
        ? { ...result, stdout: plan.ownershipLabel.split("=")[1] ?? "" }
        : result;
    },
    recoveryCommands(
      receipts: AuthenticationProjection["resources"],
      expected: AuthenticationPlan,
      index: number,
    ) {
      if (expected !== plan || unsettled) return null;
      const receipt = receipts[index],
        absenceCommand = plan.absenceCommands[index];
      if (!receipt || !absenceCommand) return null;
      return receipt.dockerId === null
        ? {
            ownershipCommand: absenceCommand,
            cleanupCommand: null,
            absenceCommand,
          }
        : planDockerAuthenticationResourceRecovery(
            technical,
            receipt.name,
            receipt.dockerId,
          );
    },
  };
}
