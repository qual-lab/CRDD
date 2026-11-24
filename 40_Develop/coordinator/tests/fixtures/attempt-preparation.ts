/**
 * 上位準備の試験に、下位の固定構成検査を有限投影として添える。
 * @responsibility 製品のPlan公開を復活させず、既存のCommand反証を内部準備へ接続する。
 * @trace PRL-UT-014
 * @level UT
 * @scope 合成値と固定設定の読取りのみ。実AI・Docker操作なし。
 * @boundary tests専用。製品の保存・実行契約ではない。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { isDeepStrictEqual } from "node:util";
import { compileFunction } from "node:vm";
import { planExecution, type Provider } from "../../../ai-adapter/src/index.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import type { TestAttemptPlan } from "../../../executor/tests/support/executor-test.ts";
import { prepareAttempt } from "../../../executor/tests/support/executor-test.ts";
import {
  createExecutor,
  type Executor,
  type ExecutorRequest,
} from "../../../executor/src/index.ts";
import {
  capturePreparationInput,
  createPreparationFailure,
} from "../../src/lifecycle/selection.ts";
import { readOwnedReviewerWorkspace } from "../../src/lifecycle/host.ts";
import type {
  AdvicePacket,
  AttemptBinding,
  ConsumedTaskPacket,
  PreparationInput,
  PreparationResult,
  PreparedAttemptPlan,
} from "../../src/lifecycle/types.ts";

export type AttemptPreparation<P extends Provider = Provider> = Readonly<{
  productionAuthority: false;
  prepare: (input: PreparationInput) => PreparationResult<P>;
}>;

export const reviewerSnapshotId = "c".repeat(64);
export const reviewerWorkspaceRoot = "C:\\crdd\\operation\\execution-workspace";

type PreparationFixture<P extends Provider> = {
  verifyOperationMount: (management: unknown, mount: unknown) => AttemptBinding;
  consumeTaskPacket?: (
    use: unknown,
    management: unknown,
  ) => ConsumedTaskPacket<P> | null;
  consumeAdvicePacket?: (use: unknown, owner: unknown) => AdvicePacket | null;
  diagnoseTaskPlanning?: typeof planExecution;
  randomBytes: (size: number) => Buffer;
};

const compilePreparation = compileFunction(
  `return (${stripTypeScriptTypes(sourceDeclaration(readFileSync(new URL("../../src/lifecycle/selection.ts", import.meta.url), "utf8"), "prepareProviderAttempt"))});`,
  [
    "createPreparationFailure",
    "verifyProviderOperationMount",
    "consumeProviderTaskPacket",
    "consumeAttemptAdvicePacket",
    "planExecution",
    "isDeepStrictEqual",
    "readOwnedReviewerWorkspace",
    "createExecutor",
    "borrowOwnedDockerExecutionPaths",
    "getIsolationSettings",
    "randomBytes",
  ],
);

/** Reviewer作業領域の観測だけを差し替え、準備本体は実装を使う。 @trace PRL-UT-014 */
export function createReviewerWorkspaceReader(getManagement: () => object) {
  return (management: unknown, snapshotId: unknown) => {
    assert.strictEqual(management, getManagement());
    assert.equal(snapshotId, reviewerSnapshotId);
    return Object.freeze({
      directory: reviewerWorkspaceRoot,
      masks: Object.freeze([
        Object.freeze({ relativePath: ".env", kind: "file" as const }),
        Object.freeze({ relativePath: "private", kind: "directory" as const }),
      ]),
      protection: Object.freeze({
        gitSourcePath: "C:\\crdd\\operation\\mask-git",
        internalSourcePath: "C:\\crdd\\operation\\mask-crdd",
      }),
    });
  };
}

/**
 * 同じ乱数列の内部構成を検査用に保持し、上位準備自体は本番関数へ渡す。
 * @responsibility 公開metadataと実行Planを混同せず、従来の技術構成反証を維持する。
 * @trace PRL-UT-014
 * @effect 試験内のMapのみ。Home取得・Command発行・永続化は行わない。
 * @invariant 上位記録と下位Planは合成せず、試験の観測callbackで別々に渡す。
 */
export function createAttemptPreparation<P extends Provider>(
  provider: P,
  dependencies: PreparationFixture<P>,
  observePlan?: (
    plan: PreparedAttemptPlan<P>,
    technicalPlan: TestAttemptPlan,
  ) => void,
  readReviewerWorkspace = readOwnedReviewerWorkspace,
): AttemptPreparation<P> {
  const plans = new WeakMap<Executor<"attempt">, TestAttemptPlan>();
  const create = (
    request: ExecutorRequest<"attempt">,
    _options: unknown,
    random: Readonly<{ randomBytes: (size: number) => Buffer }>,
  ) => {
    const values: Buffer[] = [];
    const replay = () => {
      let index = 0;
      return {
        randomBytes: (size: number) => {
          const value = values[index++];
          if (!value || value.length !== size)
            throw Error("fixture_random_mismatch");
          return value;
        },
      };
    };
    const plan = prepareAttempt(
      {
        randomBytes(size) {
          const value = random.randomBytes(size);
          values.push(value);
          return value;
        },
      },
      request,
    );
    if (!plan) return null;
    const executor = createExecutor(
      request,
      {
        settings: Object.freeze({
          windowsDirectory: "C:\\Windows",
          userHomeDirectory: "C:\\Users\\test",
        }),
        paths: {
          tmp: request.target.temporarySourcePath,
          management: "synthetic-management",
        },
      },
      replay(),
    );
    if (executor) plans.set(executor, plan);
    return executor;
  };
  const prepare = compilePreparation(
    createPreparationFailure,
    dependencies.verifyOperationMount,
    dependencies.consumeTaskPacket ?? (() => null),
    dependencies.consumeAdvicePacket ?? (() => null),
    dependencies.diagnoseTaskPlanning ?? planExecution,
    isDeepStrictEqual,
    readReviewerWorkspace,
    create,
    () => undefined,
    () => undefined,
    dependencies.randomBytes,
  ) as (provider: P, input: PreparationInput) => PreparationResult<P>;
  return Object.freeze({
    productionAuthority: false as const,
    prepare: (input: Parameters<AttemptPreparation<P>["prepare"]>[0]) => {
      const captured = capturePreparationInput(input);
      if (!captured)
        return createPreparationFailure(
          `${provider}_docker_runtime_input_mode_ambiguous`,
        );
      const prepared = prepare(provider, captured);
      if (prepared.status !== "prepared") return prepared;
      const plan = plans.get(prepared.plan.executor);
      if (!plan) throw Error("fixture_plan_missing");
      observePlan?.(prepared.plan, plan);
      return prepared;
    },
  });
}
