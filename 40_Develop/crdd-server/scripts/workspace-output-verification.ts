/**
 * 合成Workspace成果の実Byteを検証する。
 * @responsibility Reviewerの判断と独立して、変更Path・UTF-8・改行・長さ・Hashを照合する。
 * @trace ARCH-000015
 * @boundary 検証Tool内の値比較。保存・AI実行・採用・清掃は所有しない。
 */
import { createHash } from "node:crypto";

/**
 * 読み出した成果を固定期待値と照合する。
 * @responsibility 改行の正規化や文字列化でByte差を隠さない。
 * @trace ARCH-000015
 * @input 実Byte、期待UTF-8文字列、実変更Pathと期待Path。
 * @returns 内容を含まない照合値。差がある場合は固定理由でthrowする。
 * @effect N/A: 入力値の比較だけを行う。
 * @failure 未観測Path、Path差、Byte差を成功へ丸めない。
 * @invariant この確認はSource不変・回収・E2E成立の証明ではない。
 */
export function verifyWorkspaceOutputBytes(
  actual: Buffer,
  expected: string,
  changedPaths: readonly string[] | null,
  expectedPath: string,
) {
  if (
    changedPaths === null ||
    changedPaths.length !== 1 ||
    changedPaths[0] !== expectedPath
  )
    throw new Error("workspace_output_changed_paths_mismatch");
  const bytes = Buffer.from(expected, "utf8");
  if (!actual.equals(bytes)) throw new Error("workspace_output_bytes_mismatch");
  const sha256 = createHash("sha256").update(actual).digest("hex");
  if (
    actual.byteLength !== bytes.byteLength ||
    sha256 !== createHash("sha256").update(bytes).digest("hex")
  )
    throw new Error("workspace_output_identity_mismatch");
  return Object.freeze({ byteLength: actual.byteLength, sha256 });
}
