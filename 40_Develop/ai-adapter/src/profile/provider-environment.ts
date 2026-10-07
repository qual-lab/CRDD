/**
 * 固定Provider計画の環境値を検査する。
 *
 * @responsibility Provider別禁止名と不正値を拒否し、Docker表現を所有しない。
 * @trace ARCH-000010
 */
import type { AiProvider } from "../catalog/types.ts";
import { CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES } from "../claude/claude-execution-plan.ts";
import { CODEX_FORBIDDEN_ENVIRONMENT_NAMES } from "../codex/codex-execution-plan.ts";

const codexForbiddenEnvironmentNames = new Set(
  CODEX_FORBIDDEN_ENVIRONMENT_NAMES,
);
const claudeForbiddenEnvironmentNames = new Set(
  CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES,
);

/**
 * 固定Provider環境の一回Snapshotを検査し、元の順序で返す。
 *
 * @responsibility Provider別禁止環境名、文字列以外の値およびNULを拒否する。
 * @trace ARCH-000010
 * @input provider: 計画のProvider。environment: 固定CLI計画から取得した環境値。
 * @returns 取得順の名前・値組、または拒否時null。
 * @precondition 呼出し側は固定CLI計画を選択済みで、任意環境を実行へ昇格しない。
 * @postcondition 入力を変更せず、一回取得した同じ値を利用側へ返す。
 * @effect N/A: 環境Snapshotを検査するだけでProcessへ設定しない。
 * @failure 禁止名、文字列以外またはNULをnullで拒否する。取得例外は呼出し側の準備境界へ伝播する。
 * @invariant Proxy認証値、Docker引数、MountまたはAuthorityを生成しない。
 * @boundary AI Adapterの固定計画とCoordinatorの環境搬送の間。
 * @security API KeyとProvider接続先の上書きを既存禁止集合で拒否する。
 * @concurrency N/A: 共有集合を変更しない同期検査である。
 */
export function prepareProviderFixedEnvironment(
  provider: AiProvider,
  environment: Readonly<Record<string, string>>,
): readonly (readonly [string, string])[] | null {
  const forbiddenNames =
    provider === "codex"
      ? codexForbiddenEnvironmentNames
      : claudeForbiddenEnvironmentNames;
  const entries = Object.entries(environment);
  if (
    entries.some(
      ([name, value]) =>
        forbiddenNames.has(name) ||
        typeof value !== "string" ||
        value.includes("\0"),
    )
  )
    return null;
  return entries;
}
