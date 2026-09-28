/**
 * WorkbenchのProject Plan構造化投影。
 *
 * @packageDocumentation
 * @responsibility Current Release ProjectionをVersion、期限、Scope、依存および判断が読める画面へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Operation Release Read ModelとWorkbench Browser表示の境界。
 * @effect N/A: 検証済みRead ModelからReact要素を構築するだけである。
 * @security Repository外情報を取得せず、表示TextはReactのText escapingを使用する。
 */
import { createElement, type ReactElement } from "react";

import type { RepositoryReleaseProjection } from "../../project-operation/src/index.ts";

import type { WorkbenchOwnerArtifactCatalog } from "./owner-artifact-surface.ts";

/**
 * Workbenchが観測したCurrent Release Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をProjection本体と同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
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
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input observationと同じRepositoryから構築したOwner Artifact Catalogを受け取る。
 * @returns Browserが描画するReact要素を返す。
 * @precondition availableではprojectionが非nullである。
 * @postcondition Baseline、対象Version、期限、Risk、Scopeおよび依存を一つのPanelで確認できる。
 * @effect N/A: React要素の構築だけを行う。
 * @failure 未構成と観測不能を別の表示で保持する。
 * @invariant RoadmapにないMilestone、判断または期限を推測しない。
 * @boundary Project Plan Read ModelとBrowser DOMの境界。
 * @security 全表示TextにReactのText escapingを使用し、原文LinkはCatalog内固定Pathだけから生成する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function renderWorkbenchProjectPlan(
  observation: WorkbenchProjectPlanObservation,
  ownerArtifacts: WorkbenchOwnerArtifactCatalog,
): ReactElement {
  if (observation.state !== "available" || observation.projection === null) {
    const label =
      observation.state === "not_configured" ? "Not configured" : "Unknown";
    const message =
      observation.state === "not_configured"
        ? "Current Release Projectionがまだ構成されていません。"
        : "Current Release Projectionを完全に観測できません。空の計画として扱いません。";
    return createElement(
      "article",
      { className: "panel wide", id: "project-plan" },
      createElement(
        "header",
        null,
        createElement(
          "div",
          null,
          createElement(
            "p",
            { className: "eyebrow" },
            "Current release projection",
          ),
          createElement("h2", null, "Project Plan"),
        ),
        createElement("span", null, label),
      ),
      createElement("p", { className: "empty-state" }, message),
    );
  }
  const projection = observation.projection;
  const source = ownerArtifacts.artifacts.find(
    (artifact) => artifact.category === "release_projection",
  );
  const detail = ownerArtifacts.artifacts.find(
    (artifact) => artifact.category === "project_plan",
  );
  const link = (artifact: typeof source, label: string): ReactElement | null =>
    artifact === undefined
      ? null
      : createElement(
          "a",
          {
            className: "page-link",
            href: `/owner-artifact?path=${encodeURIComponent(artifact.relativePath)}`,
          },
          label,
        );
  return createElement(
    "article",
    { className: "panel wide project-plan-panel", id: "project-plan" },
    createElement(
      "header",
      null,
      createElement(
        "div",
        null,
        createElement(
          "p",
          { className: "eyebrow" },
          "Current release projection",
        ),
        createElement("h2", null, "Project Plan"),
      ),
      createElement(
        "span",
        null,
        `${projection.targetVersion} / ${projection.targetReleaseDate ?? "期限未設定"}`,
      ),
    ),
    createElement(
      "p",
      { className: "scene-summary" },
      createElement(
        "strong",
        null,
        `${projection.publishedBaseline} → ${projection.targetVersion}`,
      ),
      `。現在は${projection.workState}で、リリース判断は${projection.releaseDecision}です。日程リスク: `,
      createElement("strong", null, projection.scheduleRisk),
    ),
    createElement(
      "div",
      { className: "plan-facts" },
      createElement(
        "div",
        null,
        createElement("span", null, "Target date"),
        createElement("strong", null, projection.targetReleaseDate ?? "未設定"),
      ),
      createElement(
        "div",
        null,
        createElement("span", null, "Schedule risk"),
        createElement("strong", null, projection.scheduleRisk),
      ),
    ),
    createElement("h3", null, "Scope and milestones"),
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
            ...["段階", "範囲", "現在状態", "正本"].map((value) =>
              createElement("th", { key: value }, value),
            ),
          ),
        ),
        createElement(
          "tbody",
          null,
          ...projection.scope.map((item, index) =>
            createElement(
              "tr",
              { key: `${item.stage}-${index}` },
              createElement("td", null, item.stage),
              createElement("td", null, item.scope),
              createElement("td", null, item.state),
              createElement("td", null, item.owner),
            ),
          ),
        ),
      ),
    ),
    createElement("h3", null, "Dependencies and decisions"),
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
            ...["項目", "現在状態", "次の処置／判断"].map((value) =>
              createElement("th", { key: value }, value),
            ),
          ),
        ),
        createElement(
          "tbody",
          null,
          ...projection.dependencies.map((item, index) =>
            createElement(
              "tr",
              { key: `${item.item}-${index}` },
              createElement("td", null, item.item),
              createElement("td", null, item.state),
              createElement("td", null, item.next),
            ),
          ),
        ),
      ),
    ),
    createElement(
      "div",
      { className: "plan-links" },
      link(source, "Current Release Projectionを開く"),
      link(detail, "Roadmap詳細を開く"),
    ),
  );
}
