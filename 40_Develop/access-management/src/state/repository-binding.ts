/**
 * 登録Bindingの正規化と識別子を導出する。
 * @responsibility 採用済み管理契約を既存Ownerへ接続する。
 * @trace ARCH-000013
 */
import { createHash } from "node:crypto";
import { resolve } from "node:path";

/**
 * Repository IDとRootから既存Binding式を計算する。
 * @responsibility Schemaと登録候補で同じ正規化・hashを使う。
 * @trace ARCH-000013
 * @input 検査済みIDと絶対Root。
 * @returns binding識別子。
 * @precondition 呼出し元がRepository IDと絶対Rootの形式を検査済みである。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect N/A: 文字列とhash計算だけ。
 * @failure Path正規化・hash計算の例外は呼出し元へ伝播する。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary 内部Schemaと登録候補。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency N/A: 外部状態の観測・変更を行わない同期計算。
 */
export function deriveRepositoryBindingId(
  repositoryId: string,
  repositoryRoot: string,
): string {
  const normalizedRoot = resolve(repositoryRoot).replace(/[\\/]+$/u, "");
  const bindingRoot =
    process.platform === "win32"
      ? normalizedRoot.toLowerCase()
      : normalizedRoot;
  return `binding-${createHash("sha256").update(`${repositoryId}\n${bindingRoot}`, "utf8").digest("hex").slice(0, 32)}`;
}
