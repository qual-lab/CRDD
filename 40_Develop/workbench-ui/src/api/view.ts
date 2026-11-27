/**
 * Workbench表示を再取得する選択URLの構成。
 * @packageDocumentation
 * @responsibility 選択URLの構成と一回の表示取得・応答相関を維持する。
 * @trace ARCH-000012
 * @boundary Workbenchの非秘密表示契約とBrowser／Serverの境界。
 * @effect 同Origin表示APIの一回読取りと非秘密Modelの検査。
 * @security 資格・認可Authorityを新設せず、既存の秘密非搬送と受理条件を維持する。
 */
/**
 * 現在の画面URLから検索欄・継続導線の表示値を組み立てる。
 * @trace ARCH-000012
 * @boundary URLの表示値。実際のPortfolio検索とCursorの検証はServerが所有する。
 */
export function readWorkbenchDisplayQuery(search: string) {
  const query = new URLSearchParams(search);
  return {
    document: query.get("documentQuery") ?? "",
    activityCursor: query.get("activityCursor") ?? "",
    portfolio: {
      query: query.get("portfolioQuery") ?? "",
      state: query.get("portfolioState") ?? "",
      cursor: query.get("portfolioCursor") ?? "",
    },
  };
}

/**
 * 現在画面と同じ選択条件のRead Model URLを作る。
 * @responsibility 管理・内容操作後の再取得で選択Repositoryを失わない。
 * @trace ARCH-000012
 * @input 現在URLとModelの選択Repository ID。
 * @returns 同Origin専用APIの相対URL。
 * @precondition Callerは現在画面のModelを所有する。
 * @postcondition route・queryを維持し、選択差を拒否する。
 * @effect N/A: URL構成のみ。
 * @failure URL選択とModelが不一致なら固定例外。
 * @invariant URLのIDを認可証明にしない。
 * @boundary 現在LocationとRead Model要求。
 * @security Origin・秘密値を返却URLへ追加しない。
 * @concurrency Callerは待機後にも同じ対象を確認する。
 */
export function createSelectedWorkbenchViewUrl(
  current: URL,
  repositoryId: string | null,
): string {
  const parameters = new URLSearchParams(current.search);
  if (
    parameters.getAll("repositoryId").length > 1 ||
    (parameters.get("repositoryId") || null) !== repositoryId
  )
    throw new Error("workbench_view_selection_changed");
  if (current.pathname === "/" || current.pathname === "/index.html")
    parameters.delete("documentQuery");
  stripOverviewParameters(parameters);
  parameters.delete("route");
  return `${workbenchViewPath}?${parameters}`;
}

import { requestWorkbench } from "./connection.ts";
import { workbenchPath } from "./path.ts";
import { readWorkbenchQuery } from "./queries.ts";
import type { MainViewResponse, ViewResponse } from "./response.ts";
import {
  isFederatedProject,
  validateAiRequestSnapshot,
  validateArtifactResource,
  validateExecutionActivity,
  validateProjectPage,
  validateRecordResource,
  validateViewResponse,
  validateWorkbenchContext,
} from "./response.ts";

const workbenchViewPath = workbenchPath(["GET", "/api/workbench/overview"]);
const workbenchContextPath = workbenchPath(["GET", "/api/workbench/context"]);

/** 現在のリポジトリの活動だけを専用APIで読む。 */
export async function readExecutionActivityPage(
  repositoryId: string,
  projectId: string,
  cursor: string,
  signal: AbortSignal,
  browserSession: boolean,
) {
  const path = workbenchPath(
    ["GET", "/api/repositories/:repositoryId/activity"],
    { repositoryId },
  );
  const url = cursor ? `${path}?${new URLSearchParams({ cursor })}` : path;
  const response = await requestWorkbench(url, { signal }, browserSession);
  if (!response.ok || signal.aborted)
    throw new Error("workbench_activity_response_unavailable");
  return validateExecutionActivity(
    await response.json(),
    projectId,
    repositoryId,
  );
}

function stripOverviewParameters(parameters: URLSearchParams) {
  for (const name of [
    "portfolioQuery",
    "portfolioState",
    "portfolioCursor",
    "activityCursor",
    "treeDirectory",
    "treeCursor",
    "diffPath",
  ])
    parameters.delete(name);
}

export class ProjectLoginRequired extends Error {}

/** 概要を再取得せず、選択範囲のProject一覧だけを読む。 */
export async function readProjectPage(
  repositoryId: string | null,
  query: Readonly<{ query: string; state: string; cursor: string }>,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ limit: "20" });
  if (repositoryId !== null) params.set("repositoryId", repositoryId);
  if (query.query) params.set("q", query.query);
  if (query.state) params.set("state", query.state);
  if (query.cursor) params.set("cursor", query.cursor);
  const path = workbenchPath(["GET", "/api/projects"]);
  const response = await requestWorkbench(
    `${path}?${params}`,
    { signal },
    true,
  );
  if (!signal.aborted && response.status === 401)
    throw new ProjectLoginRequired();
  if (!response.ok || signal.aborted)
    throw new Error("workbench_project_page_unavailable");
  return validateProjectPage(await response.json(), repositoryId);
}

/**
 * 取得した一覧と構成状態を記録画面の表示用に組み合わせる。
 * @trace ARCH-000012
 * @boundary 開示済みの同じビュー応答とWorkbenchの一覧表示。
 */
export function composeWorkbenchRecordDisplay(
  model: Pick<
    MainViewResponse,
    "topicPage" | "topicQuery" | "meetingPage" | "meetingQuery"
  > & {
    projectData: Pick<MainViewResponse["projectData"], "topics" | "meetings">;
  },
  kind: "topic" | "meeting",
) {
  return kind === "topic"
    ? {
        collection: model.projectData.topics,
        page: model.topicPage,
        query: model.topicQuery,
      }
    : {
        collection: model.projectData.meetings,
        page: model.meetingPage,
        query: model.meetingQuery,
      };
}

/**
 * 現在のAI依頼だけを読み、画面全体の取得と分離する。
 * @trace ARCH-000015
 * @security 対象URLには選択Repositoryだけを載せ、依頼IDの相関は画面で行う。
 */
export async function readCurrentAiRequest(
  repositoryId: string,
  signal: AbortSignal,
  browserSession = false,
) {
  const response = await requestWorkbench(
    workbenchPath(["GET", "/api/repositories/:repositoryId/ai-request"], {
      repositoryId,
    }),
    {
      signal,
    },
    browserSession,
  );
  if (!response.ok) throw new Error("workbench_ai_request_unavailable");
  const snapshot = validateAiRequestSnapshot(await response.json());
  if (signal.aborted) throw new Error("workbench_ai_request_unavailable");
  return snapshot;
}

/**
 * Workbench Client Model APIから現在の表示Snapshotを取得する。
 * @responsibility 同一OriginのJSONを取得し、Runtime契約検査後だけ表示層へ渡す。
 * @trace ARCH-000012
 * @input 現在の同Origin URLと表示要求の取消Signal。
 * @returns 検査済みWorkbench Client Model。
 * @precondition Workbenchが同一Originで起動している。
 * @postcondition 不正JSONをReactへ渡さない。
 * @effect GET /api/workbench/overviewを一回発行する。
 * @failure HTTPまたは契約不一致で例外を送出する。
 * @invariant Browser側で業務状態を補完しない。
 * @boundary Workbench JSON APIとBrowser Reactの境界。
 * @security 同Originだけへ当該タブの資格を送る。初回は資格なしで接続画面を取得する。
 * @concurrency 表示要求ごとに一回だけ取得し、旧要求は所有Signalで取消する。
 */
export async function readViewResponse(
  url: URL,
  signal: AbortSignal,
): Promise<ViewResponse> {
  return readWorkbenchQuery("view", signal, async (signal) => {
    const parameters = new URLSearchParams(url.search);
    const readContext = async () => {
      const result = await requestWorkbench(
        workbenchContextPath,
        { signal },
        true,
      );
      if (!result.ok) throw new Error("workbench_client_model_unavailable");
      return validateWorkbenchContext(await result.json());
    };
    if (url.pathname === "/change" || url.pathname === "/owner-artifact") {
      const kind = url.pathname === "/change" ? "change" : "owner";
      const identityKey = kind === "change" ? "id" : "path";
      const identity = parameters.get(identityKey);
      const explicit = parameters.get("repositoryId");
      let repositoryId = explicit;
      if (
        !identity ||
        explicit === "" ||
        [...parameters.keys()].some(
          (key) =>
            (key !== identityKey && key !== "repositoryId") ||
            parameters.getAll(key).length !== 1,
        )
      )
        throw new Error("workbench_client_model_unavailable");
      if (repositoryId === null) {
        const entry = await readContext();
        if (entry.mode === "shared" && entry.login) return entry.login;
        if (entry.mode !== "single")
          throw new Error("workbench_client_model_unavailable");
        repositoryId = entry.repositoryId;
      }
      const endpoint =
        kind === "change"
          ? workbenchPath(
              ["GET", "/api/repositories/:repositoryId/changes/:changeId"],
              {
                repositoryId,
                changeId: identity,
              },
            )
          : `${workbenchPath(["GET", "/api/repositories/:repositoryId/artifacts"], { repositoryId })}?${new URLSearchParams({ path: identity })}`;
      const response = await requestWorkbench(endpoint, { signal }, true);
      if (response.status === 401) {
        const entry = await readContext();
        if (entry.mode === "shared" && entry.login) return entry.login;
      }
      if (!response.ok) throw new Error("workbench_client_model_unavailable");
      const model = validateArtifactResource(
        await response.json(),
        repositoryId,
        kind,
        identity,
      );
      if (
        model.selectedRepositoryId !== null &&
        model.selectedRepositoryId !== explicit
      )
        throw new Error("workbench_client_model_unavailable");
      if (explicit !== null && model.selectedRepositoryId === null) {
        const entry = await readContext();
        if (entry.mode !== "single" || entry.repositoryId !== repositoryId)
          throw new Error("workbench_client_model_unavailable");
      }
      return model;
    }
    if (url.pathname === "/topic" || url.pathname === "/meeting") {
      const kind = url.pathname === "/topic" ? "topic" : "meeting";
      const id = parameters.get("id");
      let repositoryId = parameters.get("repositoryId");
      if (
        !id ||
        !(kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u).test(id) ||
        parameters.getAll("id").length !== 1 ||
        parameters.getAll("repositoryId").length > 1 ||
        repositoryId === ""
      )
        throw new Error("workbench_client_model_unavailable");
      if (repositoryId === null) {
        const entry = await readContext();
        if (entry.mode === "shared") {
          if (entry.login) return entry.login;
          const overview = await requestWorkbench(
            workbenchViewPath,
            { signal },
            true,
          );
          if (overview.ok) {
            const view = validateViewResponse(await overview.json());
            if (view.view === "access") return view;
          }
          throw new Error("workbench_client_model_unavailable");
        }
        repositoryId = entry.repositoryId;
      }
      const recordPath =
        kind === "topic"
          ? workbenchPath(
              ["GET", "/api/repositories/:repositoryId/topics/:topicId"],
              { repositoryId, topicId: id },
            )
          : workbenchPath(
              ["GET", "/api/repositories/:repositoryId/meetings/:meetingId"],
              { repositoryId, meetingId: id },
            );
      const response = await requestWorkbench(recordPath, { signal }, true);
      if (response.status === 401) {
        const entry = await readContext();
        if (entry.mode === "shared" && entry.login) return entry.login;
      }
      if (!response.ok) throw new Error("workbench_client_model_unavailable");
      return validateRecordResource(
        await response.json(),
        repositoryId,
        kind,
        id,
      );
    }
    if (url.pathname === "/project") {
      const projectId = parameters.get("id");
      const repositoryId = parameters.get("repositoryId");
      if (
        !projectId ||
        parameters.getAll("id").length !== 1 ||
        parameters.getAll("repositoryId").length > 1 ||
        repositoryId === ""
      )
        throw new Error("workbench_client_model_unavailable");
      const endpoint = repositoryId
        ? workbenchPath(
            [
              "GET",
              "/api/repositories/:repositoryId/projects/:projectId/context",
            ],
            { repositoryId, projectId },
          )
        : workbenchPath(["GET", "/api/projects/:projectId"], { projectId });
      const response = await requestWorkbench(endpoint, { signal }, true);
      if (response.status === 401) {
        const context = await readContext();
        if (context.mode === "shared" && context.login) return context.login;
      }
      if (!response.ok) throw new Error("workbench_client_model_unavailable");
      const project: unknown = await response.json();
      if (
        !isFederatedProject(project) ||
        project.projectId !== projectId ||
        (repositoryId !== null &&
          (project.sources.length !== 1 ||
            project.sources[0]?.repositoryId !== repositoryId))
      )
        throw new Error("workbench_client_model_unavailable");
      return {
        contract: "crdd/workbench/view/v1",
        view: "project-detail",
        project,
      };
    }
    if (url.pathname === "/" || url.pathname === "/index.html")
      parameters.delete("documentQuery");
    stripOverviewParameters(parameters);
    parameters.delete("route");
    const response = await requestWorkbench(
      `${workbenchViewPath}?${parameters.toString()}`,
      {
        credentials: "same-origin",
        signal,
        headers: { accept: "application/json" },
      },
      true,
    );
    if (!response.ok) throw new Error("workbench_client_model_unavailable");
    const model = validateViewResponse(await response.json());
    if (model.view !== "main" && model.view !== "access")
      throw new Error("workbench_client_model_unavailable");
    return model;
  });
}
