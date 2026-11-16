/**
 * Reality照合に使う試験登録のPath対応を検査する。
 * @responsibility 取得済みJSON本文の解析・限定的な登録条件と中立Issueを所有する。
 * @trace ARCH-000008
 */
import type {
  ArtifactSource,
  DocumentIssue,
  DocumentResult,
} from "../artifact/types.ts";
import { createRealityDomainIssue } from "./issue.ts";

/**
 * Realityが照合する登録PathからOwner・試験IDへの限定モデル。
 * @trace ARCH-000008
 * @invariant 空値・未知field・ID重複を追加拒否せずPathを一意に保持する。
 */
export type RealityTestCatalog = ReadonlyMap<
  string,
  Readonly<{ owner: string; testId: string }>
>;

/**
 * Test CatalogのJSON本文からReality用の限定登録モデルを構築する。
 * @responsibility tests配列、文字列三field、Path重複だけを照合する。
 * @trace ARCH-000008
 * @input source: 既存位置で取得したJSON本文と診断位置。
 * @returns 正常時の登録Pathからowner／testIdへのMap、またはnullと順序付きIssue。
 * @precondition 呼出し元が従来どおり本文を一回取得している。
 * @postcondition 不正を最後まで収集し、一つでもあれば部分Mapを返さない。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期検査。
 * @failure JSON解析失敗と構造不正を別Issueにし、いずれも結果はnullとする。
 * @invariant 空文字・未知field・空配列・ID重複を新たに拒否しない。
 * @boundary N/A: 取得済みJSON本文とReality Graph入力の境界。
 * @security 実行済みEvidenceや実行許可・認可を発行しない。
 * @concurrency N/A: 呼出し間で共有可変状態を持たない。
 */
export function parseRealityTestCatalog(
  source: ArtifactSource,
): DocumentResult<RealityTestCatalog> {
  const sourcePath = source.path;
  let value: unknown;
  try {
    value = JSON.parse(source.content);
  } catch {
    return {
      status: "invalid",
      result: null,
      issues: [
        createRealityDomainIssue(
          "catalog.json.invalid",
          sourcePath,
          sourcePath,
          "catalog_json_invalid",
          {},
        ),
      ],
    };
  }

  const issues: DocumentIssue[] = [];
  const testsByPath = new Map<
    string,
    Readonly<{ owner: string; testId: string }>
  >();
  if (
    typeof value !== "object" ||
    value === null ||
    !("tests" in value) ||
    !Array.isArray(value.tests)
  )
    return {
      status: "invalid",
      result: null,
      issues: [
        createRealityDomainIssue(
          "catalog.tests.array-missing",
          sourcePath,
          sourcePath,
          "tests_array_required",
          {},
        ),
      ],
    };
  for (const entry of value.tests) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("id" in entry) ||
      typeof entry.id !== "string" ||
      !("owner" in entry) ||
      typeof entry.owner !== "string" ||
      !("path" in entry) ||
      typeof entry.path !== "string"
    ) {
      issues.push(
        createRealityDomainIssue(
          "catalog.entry.fields-invalid",
          sourcePath,
          sourcePath,
          "registration_string_fields_required",
          {},
        ),
      );
      continue;
    }
    if (testsByPath.has(entry.path)) {
      issues.push(
        createRealityDomainIssue(
          "catalog.path.duplicate",
          sourcePath,
          sourcePath,
          "registration_path_not_unique",
          { testPath: entry.path },
        ),
      );
      continue;
    }
    testsByPath.set(entry.path, { owner: entry.owner, testId: entry.id });
  }
  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result: issues.length === 0 ? testsByPath : null,
    issues,
  };
}
