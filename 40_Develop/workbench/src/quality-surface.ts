/**
 * WorkbenchのQuality構造化投影。
 *
 * @packageDocumentation
 * @responsibility Current Quality Projectionを現在状態、Coverage、Gap、次Gateおよび人間判断が読める画面へ変換する。
 * @trace ARCH-000005 ARCH-000012
 * @boundary Project Operation Quality Read ModelとWorkbench Browser表示の境界。
 * @effect N/A: 検証済みRead ModelからHTMLを構築するだけである。
 * @security Repository外情報を取得せず、表示TextをHTML escapeする。
 */
import type { RepositoryQualityProjection } from "../../project-operation/src/index.ts";

import type { WorkbenchOwnerArtifactCatalog } from "./owner-artifact-surface.ts";

/**
 * Workbenchが観測したCurrent Quality Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をQuality Projectionと同じ結果へ閉じる。
 * @trace ARCH-000005 ARCH-000012
 * @shape state、projectionおよびreasonを表す。
 * @invariant 未構成または観測不能をQuality Readyへ変換しない。
 * @boundary Repository Quality ReaderとWorkbench Project Surfaceの型境界。
 * @security reasonは内部Pathを含まない固定値に限る。
 * @compatibility 状態追加時は全表示と試験を再評価する。
 */
export type WorkbenchQualityObservation = Readonly<{
  state: "available" | "not_configured" | "unknown";
  projection: RepositoryQualityProjection | null;
  reason: "quality_projection_invalid" | "observation_failed" | null;
}>;

/**
 * Current Quality Projectionを構造化Quality Panelとして描画する。
 *
 * @responsibility 品質の結論、Coverage、Gap、Gateおよび判断を原文Relation付きで表示する。
 * @trace ARCH-000005 ARCH-000012
 * @input observationと同じRepositoryから構築したOwner Artifact Catalogを受け取る。
 * @returns Browserへ埋め込む安全なHTML断片を返す。
 * @precondition availableではprojectionが非nullである。
 * @postcondition 状態、対象、観測済み／未観測、Gap、Gateおよび人間判断を一Panelで確認できる。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure 未構成と観測不能を別の表示で保持する。
 * @invariant Quality CenterにないPass、Evidenceまたは判断を推測しない。
 * @boundary Quality Read ModelとBrowser DOMの境界。
 * @security 全表示Textをescapeし、原文LinkはCatalog内固定Pathだけから生成する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function renderWorkbenchQuality(
  observation: WorkbenchQualityObservation,
  ownerArtifacts: WorkbenchOwnerArtifactCatalog,
): string {
  if (observation.state !== "available" || observation.projection === null) {
    const label =
      observation.state === "not_configured" ? "Not configured" : "Unknown";
    const message =
      observation.state === "not_configured"
        ? "Current Quality Projectionがまだ構成されていません。"
        : "Current Quality Projectionを完全に観測できません。Quality Readyとして扱いません。";
    return `<article class="panel wide" id="quality"><header><div><p class="eyebrow">Current quality projection</p><h2>Quality and Evidence</h2></div><span>${label}</span></header><p class="empty-state">${message}</p></article>`;
  }
  const projection = observation.projection;
  const source = ownerArtifacts.artifacts.find(
    (artifact) => artifact.category === "quality",
  );
  const sourceLink =
    source === undefined
      ? ""
      : `<a class="page-link" href="/owner-artifact?path=${encodeURIComponent(source.relativePath)}">Quality Centerを開く</a>`;
  return `<article class="panel wide quality-projection-panel" id="quality"><header><div><p class="eyebrow">Current quality projection</p><h2>Quality and Evidence</h2></div><span>${escapeHtml(projection.target)}</span></header><p class="scene-summary"><strong>${escapeHtml(projection.overallState)}</strong>。観測済み ${escapeHtml(projection.observed)}、未観測 ${escapeHtml(projection.unobserved)}です。局所成立を全体のQuality Readyへ畳みません。</p><div class="quality-facts"><div><span>Observed</span><strong>${escapeHtml(projection.observed)}</strong></div><div><span>Unobserved</span><strong>${escapeHtml(projection.unobserved)}</strong></div></div><div class="table-scroll"><table><thead><tr><th>観点</th><th>現在状態</th><th>根拠・次の処置</th></tr></thead><tbody><tr><td>既知Gap</td><td>${escapeHtml(projection.knownGap)}</td><td>${escapeHtml(projection.rationale.既知Gap ?? "")}</td></tr><tr><td>次Gate</td><td>${escapeHtml(projection.nextGate)}</td><td>${escapeHtml(projection.rationale.次Gate ?? "")}</td></tr><tr><td>人間判断</td><td>${escapeHtml(projection.humanDecision)}</td><td>${escapeHtml(projection.rationale.現在人間判断 ?? "")}</td></tr></tbody></table></div>${sourceLink}</article>`;
}

/**
 * Quality表示TextをHTMLとして安全に符号化する。
 *
 * @responsibility Repository由来TextをMarkupとして解釈させない。
 * @trace ARCH-000012
 * @input valueに表示文字列を受け取る。
 * @returns HTML特殊文字を符号化した文字列を返す。
 * @precondition valueを信頼済みHTMLと仮定しない。
 * @postcondition ampersand、angle bracketおよびquoteを生で残さない。
 * @effect N/A: 文字列変換だけを行う。
 * @failure N/A: 全文字列を決定論的に変換する。
 * @invariant 表示文字の順序を変えない。
 * @boundary Repository TextとBrowser DOMの境界。
 * @security Script、ElementおよびAttribute注入を防ぐ。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
