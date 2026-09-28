/**
 * WorkbenchのQuality構造化投影。
 *
 * @packageDocumentation
 * @responsibility Current Quality Projectionを現在状態、Coverage、Gap、次Gateおよび人間判断が読める画面へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Operation Quality Read ModelとWorkbench Browser表示の境界。
 * @effect N/A: 検証済みRead ModelからReact要素を構築するだけである。
 * @security Repository外情報を取得せず、表示TextはReactのText escapingを使用する。
 */
import { createElement, type ReactElement } from "react";

import type { RepositoryQualityProjection } from "../../project-operation/src/index.ts";

import type { WorkbenchOwnerArtifactCatalog } from "./owner-artifact-surface.ts";

/**
 * Workbenchが観測したCurrent Quality Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をQuality Projectionと同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
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
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input observationと同じRepositoryから構築したOwner Artifact Catalogを受け取る。
 * @returns Browserが描画するReact要素を返す。
 * @precondition availableではprojectionが非nullである。
 * @postcondition 状態、対象、観測済み／未観測、Gap、Gateおよび人間判断を一Panelで確認できる。
 * @effect N/A: React要素の構築だけを行う。
 * @failure 未構成と観測不能を別の表示で保持する。
 * @invariant Quality CenterにないPass、Evidenceまたは判断を推測しない。
 * @boundary Quality Read ModelとBrowser DOMの境界。
 * @security 全表示TextにReactのText escapingを使用し、原文LinkはCatalog内固定Pathだけから生成する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function renderWorkbenchQuality(
  observation: WorkbenchQualityObservation,
  ownerArtifacts: WorkbenchOwnerArtifactCatalog,
): ReactElement {
  if (observation.state !== "available" || observation.projection === null) {
    const label =
      observation.state === "not_configured" ? "Not configured" : "Unknown";
    const message =
      observation.state === "not_configured"
        ? "Current Quality Projectionがまだ構成されていません。"
        : "Current Quality Projectionを完全に観測できません。Quality Readyとして扱いません。";
    return createElement(
      "article",
      { className: "panel wide", id: "quality" },
      createElement(
        "header",
        null,
        createElement(
          "div",
          null,
          createElement(
            "p",
            { className: "eyebrow" },
            "Current quality projection",
          ),
          createElement("h2", null, "Quality and Evidence"),
        ),
        createElement("span", null, label),
      ),
      createElement("p", { className: "empty-state" }, message),
    );
  }
  const projection = observation.projection;
  const source = ownerArtifacts.artifacts.find(
    (artifact) => artifact.category === "quality",
  );
  const rows = [
    ["既知Gap", projection.knownGap, projection.rationale.既知Gap ?? ""],
    ["次Gate", projection.nextGate, projection.rationale.次Gate ?? ""],
    [
      "人間判断",
      projection.humanDecision,
      projection.rationale.現在人間判断 ?? "",
    ],
  ] as const;
  return createElement(
    "article",
    { className: "panel wide quality-projection-panel", id: "quality" },
    createElement(
      "header",
      null,
      createElement(
        "div",
        null,
        createElement(
          "p",
          { className: "eyebrow" },
          "Current quality projection",
        ),
        createElement("h2", null, "Quality and Evidence"),
      ),
      createElement("span", null, projection.target),
    ),
    createElement(
      "p",
      { className: "scene-summary" },
      createElement("strong", null, projection.overallState),
      `。観測済み ${projection.observed}、未観測 ${projection.unobserved}です。局所成立を全体のQuality Readyへ畳みません。`,
    ),
    createElement(
      "div",
      { className: "quality-facts" },
      createElement(
        "div",
        null,
        createElement("span", null, "Observed"),
        createElement("strong", null, projection.observed),
      ),
      createElement(
        "div",
        null,
        createElement("span", null, "Unobserved"),
        createElement("strong", null, projection.unobserved),
      ),
    ),
    createElement(
      "div",
      { className: "table-scroll" },
      createElement(
        "table",
        null,
        createElement(
          "thead",
          null,
          createElement(
            "tr",
            null,
            ...["観点", "現在状態", "根拠・次の処置"].map((value) =>
              createElement("th", { key: value }, value),
            ),
          ),
        ),
        createElement(
          "tbody",
          null,
          ...rows.map((row) =>
            createElement(
              "tr",
              { key: row[0] },
              ...row.map((value, index) =>
                createElement("td", { key: `${row[0]}-${index}` }, value),
              ),
            ),
          ),
        ),
      ),
    ),
    source === undefined
      ? null
      : createElement(
          "a",
          {
            className: "page-link",
            href: `/owner-artifact?path=${encodeURIComponent(source.relativePath)}`,
          },
          "Quality Centerを開く",
        ),
  );
}
