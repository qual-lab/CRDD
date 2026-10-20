/**
 * Workbench Application ShellのReact表示契約。
 *
 * @packageDocumentation
 * @responsibility Direction AのBrand、Navigation、Project要約および画面配置枠をReact Componentとして所有する。
 * @trace ARCH-000012
 * @boundary Workbench View ModelとBrowser DOMの表示境界。
 * @effect N/A: React要素を構築するだけである。
 * @security React要素とTextだけを受け取り、HTML文字列を解釈しない。
 */
import { createElement, type ReactElement, type ReactNode } from "react";

/**
 * Workbench Shellが表示するServer確定済み値を表す。
 *
 * @responsibility Client-side React Shellへ渡せる表示専用値と画面要素を固定する。
 * @trace ARCH-000012
 * @input N/A: 型宣言でありRuntime入力を受け取らない。
 * @returns N/A: 型宣言でありRuntime出力を返さない。
 * @precondition contentとrefreshはClient Modelから構築したReact要素である。
 * @postcondition Browser AuthorityやCredentialを表すFieldを持たない。
 * @effect N/A: 型宣言である。
 * @failure N/A: 型宣言である。
 * @invariant Project Contextや操作結果の正本を所有しない。
 * @boundary Server View ModelとReact Presentationの境界。
 * @security Secret、TokenおよびHost PathをFieldへ追加しない。
 * @concurrency N/A: 不変型である。
 */
export type WorkbenchShellProps = Readonly<{
  projectId: string;
  repositoryId: string;
  repositoryRole: string;
  connectionLabel: string;
  topicsLabel: string;
  topicsDetail: string;
  meetingsLabel: string;
  meetingsDetail: string;
  logoPath: string;
  refresh: ReactNode;
  content: ReactNode;
  activeSection?: string;
  clientReady?: boolean;
}>;

const navigation = Object.freeze([
  ["overview", "Overview"],
  ["topics", "Topics"],
  ["meetings", "Meetings"],
  ["decision", "Decisions"],
  ["project-plan", "Plan"],
  ["quality", "Quality"],
  ["documentation", "Docs"],
  ["runtime-activity", "Runtime"],
  ["repository", "Repository"],
  ["connection", "Connection"],
  ["credential-administration", "Credentials"],
  ["ai-profiles", "AI Profiles"],
  ["ai-request", "AI Request"],
] as const);

/**
 * Summary Cardを描画する。
 *
 * @responsibility Project Workspaceの四つの主要値を同じVisual規則で表示する。
 * @trace ARCH-000012
 * @input label、valueおよびdetailにServer確定済み表示値を受け取る。
 * @returns Summary CardのReact要素を返す。
 * @precondition 各値はTextとして渡され、HTMLを含まない。
 * @postcondition 一つのarticleにLabel、Value、Detailが表示される。
 * @effect N/A: React要素を構築するだけである。
 * @failure N/A: Reactの決定論的な要素構築だけを行う。
 * @invariant 値を推測または再分類しない。
 * @boundary Workbench Summary View ModelとDOMの境界。
 * @security ReactのText escapingを維持する。
 * @concurrency N/A: 同期的な純粋表示である。
 */
function SummaryCard({
  label,
  value,
  detail,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
}>): ReactElement {
  return createElement(
    "article",
    null,
    createElement("span", null, label),
    createElement("strong", null, value),
    createElement("small", null, detail),
  );
}

/**
 * Direction AのWorkbench Application Shellを描画する。
 *
 * @responsibility Browser上の唯一のReact TreeでBrand、Navigation、Summaryおよび画面配置を一致させる。
 * @trace ARCH-000012
 * @input propsにJSON Read Modelから得た表示値とReact画面要素を受け取る。
 * @returns Workbench ShellのReact要素を返す。
 * @precondition contentとrefreshはBrowser Clientが構築したReact要素である。
 * @postcondition 既存のSection ID、Form、Tokenおよび15画面DOMを保持したShellを返す。
 * @effect N/A: React要素を構築するだけである。
 * @failure N/A: Component内で外部I/Oを実行しない。
 * @invariant React Presentationは業務状態、Authorityまたは操作結果を生成しない。
 * @boundary Workbench JSON Read ModelとBrowser DOMの境界。
 * @security 任意のHTML文字列を受け取らず、動的値はReactのText escapingで描画する。
 * @concurrency N/A: Renderingは入力Propsに対して決定論的である。
 */
export function WorkbenchShell(props: WorkbenchShellProps): ReactElement {
  const activeSection = props.activeSection ?? "overview";
  const navItems: ReactNode[] = navigation.map(([id, label]) =>
    createElement(
      "a",
      {
        className: activeSection === id ? "active" : undefined,
        href: `#${id}`,
        key: id,
      },
      label,
    ),
  );
  return createElement(
    "div",
    {
      className: "app-shell",
      "data-project-id": props.projectId,
      "data-repository-id": props.repositoryId,
      "data-repository-role": props.repositoryRole,
      "data-connection-label": props.connectionLabel,
      "data-topics-label": props.topicsLabel,
      "data-topics-detail": props.topicsDetail,
      "data-meetings-label": props.meetingsLabel,
      "data-meetings-detail": props.meetingsDetail,
      "data-logo-path": props.logoPath,
    },
    createElement(
      "header",
      { className: "topbar" },
      createElement(
        "a",
        { className: "brand", href: "/", "aria-label": "CROS Workbench home" },
        createElement("img", {
          src: props.logoPath,
          alt: "CRDD",
          width: 36,
          height: 36,
          loading: "lazy",
        }),
        createElement(
          "span",
          null,
          createElement("strong", null, "CROS"),
          createElement("small", null, "Workbench"),
        ),
      ),
      createElement(
        "div",
        { className: "project-switcher", "aria-label": "Current project" },
        createElement("span", null, "Project"),
        createElement("strong", null, props.projectId),
      ),
      createElement(
        "div",
        {
          className: "connection",
          id: props.clientReady === true ? "workbench-client-ready" : undefined,
        },
        createElement("span", { className: "status-dot", "aria-hidden": true }),
        createElement(
          "span",
          { className: "connection-label" },
          props.connectionLabel,
        ),
        createElement("span", {
          "aria-hidden": true,
          "data-workbench-client-root": "true",
          hidden: true,
        }),
      ),
    ),
    createElement(
      "aside",
      { className: "sidebar", "aria-label": "Primary navigation" },
      createElement("nav", null, ...navItems),
    ),
    createElement(
      "main",
      { id: "overview" },
      createElement(
        "section",
        { className: "page-heading" },
        createElement(
          "div",
          null,
          createElement("p", { className: "eyebrow" }, "Current project"),
          createElement("h1", null, "Project Workspace"),
          createElement(
            "p",
            null,
            `${props.repositoryId} / ${props.repositoryRole} の固定Project Contextから、今の状況、判断待ち、理由、次に取る一手を確認します。`,
          ),
        ),
        createElement(
          "div",
          { "data-workbench-refresh": "true" },
          props.refresh,
        ),
      ),
      createElement(
        "section",
        { className: "summary-grid", "aria-label": "Project summary" },
        createElement(SummaryCard, {
          label: "Project",
          value: props.projectId,
          detail: props.repositoryId,
        }),
        createElement(SummaryCard, {
          label: "Repository role",
          value: props.repositoryRole,
          detail: "Declared coverage",
        }),
        createElement(SummaryCard, {
          label: "Topics",
          value: props.topicsLabel,
          detail: props.topicsDetail,
        }),
        createElement(SummaryCard, {
          label: "Meetings",
          value: props.meetingsLabel,
          detail: props.meetingsDetail,
        }),
      ),
      createElement(
        "section",
        {
          className: "workspace-grid",
          "data-workbench-content": "true",
        },
        props.content,
      ),
    ),
  );
}
