/**
 * CROS WorkbenchのProject Plan／Quality Browser Panel。
 *
 * @packageDocumentation
 * @responsibility 検証済みProject PlanとQuality Read ModelをBrowser React要素へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Operation Read ModelとBrowser DOMの境界。
 * @effect Navigation以外の外部Effectを発行しない。
 * @security ReactのText escapingを使用し、Catalog内固定PathだけをLinkへ使う。
 */
import { createElement, type ReactElement } from "react";

import type { WorkbenchOwnerArtifactCatalog } from "../owner-artifact/read.ts";
import type { WorkbenchProjectPlanObservation } from "../project-plan/types.ts";
import type { WorkbenchQualityObservation } from "../quality/types.ts";

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
