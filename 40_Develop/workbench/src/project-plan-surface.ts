/**
 * WorkbenchのProject Plan構造化投影。
 *
 * @packageDocumentation
 * @responsibility Current Release ProjectionをVersion、期限、Scope、依存および判断が読める画面へ変換する。
 * @trace ARCH-000005 ARCH-000012
 * @boundary Project Operation Release Read ModelとWorkbench Browser表示の境界。
 * @effect N/A: 検証済みRead ModelからHTMLを構築するだけである。
 * @security Repository外情報を取得せず、表示TextをHTML escapeする。
 */
import type { RepositoryReleaseProjection } from "../../project-operation/src/index.ts";

import type { WorkbenchOwnerArtifactCatalog } from "./owner-artifact-surface.ts";

/**
 * Workbenchが観測したCurrent Release Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をProjection本体と同じ結果へ閉じる。
 * @trace ARCH-000005 ARCH-000012
 * @shape state、projectionおよびreasonを表す。
 * @invariant 未構成または観測不能を空の計画へ変換しない。
 * @boundary Repository Release ReaderとWorkbench Project Surfaceの型境界。
 * @security reasonは内部Pathを含まない固定値に限る。
 * @compatibility 状態追加時は全表示と試験を再評価する。
 */
export type WorkbenchProjectPlanObservation = Readonly<{
  state: "available" | "not_configured" | "unknown";
  projection: RepositoryReleaseProjection | null;
  reason: "release_projection_invalid" | "observation_failed" | null;
}>;

/**
 * Current Release Projectionを構造化Project Planとして描画する。
 *
 * @responsibility 計画の結論を先に示し、Scopeと依存を原文Relation付きで表示する。
 * @trace ARCH-000005 ARCH-000012
 * @input observationと同じRepositoryから構築したOwner Artifact Catalogを受け取る。
 * @returns Browserへ埋め込む安全なHTML断片を返す。
 * @precondition availableではprojectionが非nullである。
 * @postcondition Baseline、対象Version、期限、Risk、Scopeおよび依存を一つのPanelで確認できる。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure 未構成と観測不能を別の表示で保持する。
 * @invariant RoadmapにないMilestone、判断または期限を推測しない。
 * @boundary Project Plan Read ModelとBrowser DOMの境界。
 * @security 全表示Textをescapeし、原文LinkはCatalog内固定Pathだけから生成する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function renderWorkbenchProjectPlan(
  observation: WorkbenchProjectPlanObservation,
  ownerArtifacts: WorkbenchOwnerArtifactCatalog,
): string {
  if (observation.state !== "available" || observation.projection === null) {
    const label =
      observation.state === "not_configured" ? "Not configured" : "Unknown";
    const message =
      observation.state === "not_configured"
        ? "Current Release Projectionがまだ構成されていません。"
        : "Current Release Projectionを完全に観測できません。空の計画として扱いません。";
    return `<article class="panel wide" id="project-plan"><header><div><p class="eyebrow">Current release projection</p><h2>Project Plan</h2></div><span>${label}</span></header><p class="empty-state">${message}</p></article>`;
  }
  const projection = observation.projection;
  const source = ownerArtifacts.artifacts.find(
    (artifact) => artifact.category === "release_projection",
  );
  const detail = ownerArtifacts.artifacts.find(
    (artifact) => artifact.category === "project_plan",
  );
  const link = (path: string, label: string) =>
    `<a class="page-link" href="/owner-artifact?path=${encodeURIComponent(path)}">${escapeHtml(label)}</a>`;
  return `<article class="panel wide project-plan-panel" id="project-plan"><header><div><p class="eyebrow">Current release projection</p><h2>Project Plan</h2></div><span>${escapeHtml(projection.targetVersion)} / ${escapeHtml(projection.targetReleaseDate ?? "期限未設定")}</span></header><p class="scene-summary"><strong>${escapeHtml(projection.publishedBaseline)} → ${escapeHtml(projection.targetVersion)}</strong>。現在は${escapeHtml(projection.workState)}で、リリース判断は${escapeHtml(projection.releaseDecision)}です。日程リスク: <strong>${escapeHtml(projection.scheduleRisk)}</strong></p><div class="plan-facts"><div><span>Target date</span><strong>${escapeHtml(projection.targetReleaseDate ?? "未設定")}</strong></div><div><span>Schedule risk</span><strong>${escapeHtml(projection.scheduleRisk)}</strong></div></div><h3>Scope and milestones</h3><div class="table-scroll"><table><thead><tr><th>段階</th><th>範囲</th><th>現在状態</th><th>正本</th></tr></thead><tbody>${projection.scope.map((item) => `<tr><td>${escapeHtml(item.stage)}</td><td>${escapeHtml(item.scope)}</td><td>${escapeHtml(item.state)}</td><td>${escapeHtml(item.owner)}</td></tr>`).join("")}</tbody></table></div><h3>Dependencies and decisions</h3><div class="table-scroll"><table><thead><tr><th>項目</th><th>現在状態</th><th>次の処置／判断</th></tr></thead><tbody>${projection.dependencies.map((item) => `<tr><td>${escapeHtml(item.item)}</td><td>${escapeHtml(item.state)}</td><td>${escapeHtml(item.next)}</td></tr>`).join("")}</tbody></table></div><div class="plan-links">${source === undefined ? "" : link(source.relativePath, "Current Release Projectionを開く")}${detail === undefined ? "" : link(detail.relativePath, "Roadmap詳細を開く")}</div></article>`;
}

/**
 * Project Plan表示TextをHTMLとして安全に符号化する。
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
