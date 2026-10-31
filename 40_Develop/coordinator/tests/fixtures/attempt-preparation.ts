/**
 * 上位準備の試験に、下位の固定構成検査を有限投影として添える。
 * @responsibility 製品のPlan公開を復活させず、既存のCommand反証を内部準備へ接続する。
 * @trace PRL-UT-014
 * @level UT
 * @scope 合成値と固定設定の読取りのみ。実AI・Docker操作なし。
 * @boundary tests専用。製品の保存・実行契約ではない。
 */
import { createAttemptPreparation as createOwner } from "../../src/execution/preparation.ts";
import type {
  AttemptPreparation,
  PreparedAttemptPlan,
  PreparationHost,
} from "../../src/execution/types.ts";
import type { AiProvider } from "../../../ai-adapter/src/index.ts";
import { createExecutor, type Executor } from "../../../executor/src/index.ts";
import { prepareAttempt } from "../../../executor/src/attempt/execute.ts";
import type { AttemptPlan } from "../../../executor/src/attempt/types.ts";

/**
 * 同じ乱数列の内部構成を検査用に保持し、上位準備自体は本番関数へ渡す。
 * @responsibility 公開metadataと実行Planを混同せず、従来の技術構成反証を維持する。
 * @trace PRL-UT-014
 * @effect 試験内のMapのみ。Home取得・Command発行・永続化は行わない。
 * @invariant 上位への内部Plan投影は試験のconsumeだけで、製品Sourceには存在しない。
 */
export function createAttemptPreparation<P extends AiProvider>(
  provider: P,
  dependencies: PreparationHost<P>,
): Omit<AttemptPreparation<P>, "consume"> &
  Readonly<{
    consumeRecord: AttemptPreparation<P>["consume"];
    consume(
      prepared: unknown,
      management: unknown,
    ): (PreparedAttemptPlan<P> & AttemptPlan) | null;
  }> {
  const plans = new WeakMap<Executor, AttemptPlan>();
  const owner = createOwner(provider, dependencies, (request, random) => {
    const values = [random.randomBytes(8), random.randomBytes(32)];
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
    const plan = prepareAttempt(replay(), request);
    if (!plan) return null;
    const executor = createExecutor(
      request,
      {
        borrowPaths: () => {
          throw Error("preparation_only");
        },
        inspectReceipts: () => null,
      },
      replay(),
    );
    if (executor) plans.set(executor, plan);
    return executor;
  });
  return Object.freeze({
    ...owner,
    consumeRecord: owner.consume,
    consume: (prepared: unknown, management: unknown) => {
      const owned = owner.consume(prepared, management);
      if (!owned) return null;
      const plan = plans.get(owned.executor);
      if (!plan) throw Error("fixture_plan_missing");
      return Object.freeze({ ...owned, ...plan }) as PreparedAttemptPlan<P> &
        AttemptPlan;
    },
  });
}
