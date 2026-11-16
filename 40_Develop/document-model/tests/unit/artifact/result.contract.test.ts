/**
 * 実際の文書解析・観測結果の共通契約を検証する。
 * @packageDocumentation
 * @responsibility 部分内容・診断・観測不能を実Producerで確認し、不要な結果受付を復活させない。
 * @trace RCM-UT-016
 * @level UT
 * @scope 文書結果、Parse結果、共通型
 * @boundary RCM-UT-016=N/A: 同期値処理だけを扱う。
 */

import assert from "node:assert/strict";
import test from "node:test";
import { validateArtifactSchema } from "../../../src/artifact/validate-schema.ts";
import type { DocumentIssue, ParseResult } from "../../../src/index.ts";
import * as documentModel from "../../../src/index.ts";

/**
 * 完全・部分の解析結果を実受付から確認する。
 * @responsibility 内容と全診断field、入力不変を一組で検証する。
 * @trace RCM-UT-016
 * @precondition ID本文と手動改訂だけが異なる二つの取得済み本文を使う。
 * @stimulus 文書Identityの内容受付へ渡す。
 * @observation status、result、issuesと受付前後の入力を比較する。
 * @oracle 部分結果でも本文を保持し、既存診断を一件だけ返す。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-016=N/A: 同期Parse。
 */
test("文書の完全・部分結果は内容と診断を分離して保持する", () => {
  for (const [content, status] of [
    ["id: REQ-000001", "complete"],
    ["id: REQ-000001\nREQ-000001@2", "partial"],
  ] as const) {
    const source = { path: "requirement.md", content };
    const before = structuredClone(source);
    const outcome: ParseResult<
      NonNullable<ReturnType<typeof documentModel.parseArtifact>["result"]>
    > = documentModel.parseArtifact(source);
    assert.equal(outcome.status, status);
    assert.deepEqual(outcome.result?.source, before);
    assert.deepEqual(source, before);
    assert.deepEqual(
      outcome.issues,
      status === "complete"
        ? []
        : [
            {
              kind: "artifact.document-identity.stable-id-manual-revision",
              targetIdentity: "requirement.md",
              location: { path: "requirement.md" },
              reason: "stable-id-manual-revision",
              details: { value0: "REQ-000001@2" },
            },
          ],
    );
  }
});

/**
 * 文書不正と未観測を別の実Producerで確認する。
 * @responsibility 不正結果と観測不能を同一視しないことを検証する。
 * @trace RCM-UT-016
 * @precondition 不足節を持つ文書と、観測側から明示された取得失敗を使う。
 * @stimulus Schema検査とRealityモデル探索へ渡す。
 * @observation status、null結果、全診断fieldと入力不変を比較する。
 * @oracle invalidとunobservableを区別し、未知kindを表示判断で拒否しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-016=N/A: 取得済み値。
 */
test("文書不正と観測不能は結果を補完せず異なる状態で返す", () => {
  const source = { path: "item.md", content: "# Item\n" };
  const artifact = documentModel.parseArtifact(source).result;
  const before = structuredClone(artifact);
  const invalid = validateArtifactSchema(artifact, {
    id: "fixture",
    matches: () => true,
    requiredSections: ["Missing"],
  });
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.result, null);
  assert.deepEqual(invalid.issues, [
    {
      kind: "artifact.schema.section-missing",
      targetIdentity: "item.md",
      location: artifact.sourceLocation,
      reason: "required_section_missing",
      details: { schemaId: "fixture", section: "Missing" },
    },
  ]);
  assert.deepEqual(artifact, before);

  const issue: DocumentIssue = {
    kind: "future.document.observation",
    targetIdentity: "sample",
    location: { path: "symbol.json", line: 2 },
    reason: "source_unobservable",
    details: { count: 1, observed: false, missing: null, text: "value" },
  };
  const request = { sources: [], prerequisiteIssues: [issue] };
  const requestBefore = structuredClone(request);
  assert.deepEqual(documentModel.discoverRealitySymbols(request), {
    status: "unobservable",
    result: null,
    issues: [issue],
  });
  assert.deepEqual(request, requestBefore);
});

/**
 * 廃止した結果オブジェクト受付を公開しない。
 * @responsibility 結果検査のための重複Runtimeを復活させない。
 * @trace RCM-UT-016
 * @precondition Package Rootの実公開を使用する。
 * @stimulus 廃止APIの有無とParseの状態型を確認する。
 * @observation 実公開とコンパイル時の許可状態。
 * @oracle 未使用Validatorを公開せず、Parseは観測不能を返せない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-016=N/A: 型・公開境界。
 */
test("Parseは三状態に限定し未使用の結果Validatorを公開しない", () => {
  assert.equal("validateDomainOutcome" in documentModel, false);
  assert.equal("validateDocumentResult" in documentModel, false);
  type ParseStatus = ParseResult<unknown>["status"];
  const statuses: readonly ParseStatus[] = ["complete", "partial", "invalid"];
  assert.deepEqual(statuses, ["complete", "partial", "invalid"]);
  // @ts-expect-error 観測不能は取得済み本文のParse状態ではない。
  const observationOnly: ParseStatus = "unobservable";
  assert.equal(observationOnly, "unobservable");
});
