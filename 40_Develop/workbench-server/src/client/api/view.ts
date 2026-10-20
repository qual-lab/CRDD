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
  parameters.set("route", current.pathname);
  return `/api/workbench-view?${parameters}`;
}

import { inspectWorkbenchClientModel } from "../../shared/view/validation.ts";
import type { WorkbenchClientModel } from "../../shared/view/types.ts";
import { requestWorkbench } from "./connection.ts";
import { readWorkbenchQuery } from "./queries.ts";

/**
 * Workbench Client Model APIから現在の表示Snapshotを取得する。
 * @responsibility 同一OriginのJSONを取得し、Runtime契約検査後だけ表示層へ渡す。
 * @trace ARCH-000012
 * @input 現在の同Origin URLと表示要求の取消Signal。
 * @returns 検査済みWorkbench Client Model。
 * @precondition Workbenchが同一Originで起動している。
 * @postcondition 不正JSONをReactへ渡さない。
 * @effect GET /api/workbench-viewを一回発行する。
 * @failure HTTPまたは契約不一致で例外を送出する。
 * @invariant Browser側で業務状態を補完しない。
 * @boundary Workbench JSON APIとBrowser Reactの境界。
 * @security 同Originだけへ当該タブの資格を送る。初回は資格なしで接続画面を取得する。
 * @concurrency 表示要求ごとに一回だけ取得し、旧要求は所有Signalで取消する。
 */
export async function readWorkbenchClientModel(
  url: URL,
  signal: AbortSignal,
): Promise<WorkbenchClientModel> {
  return readWorkbenchQuery("view", signal, async (signal) => {
    const parameters = new URLSearchParams(url.search);
    parameters.set("route", url.pathname);
    const response = await requestWorkbench(
      `/api/workbench-view?${parameters.toString()}`,
      {
        credentials: "same-origin",
        signal,
        headers: { accept: "application/json" },
      },
    );
    if (!response.ok) throw new Error("workbench_client_model_unavailable");
    const model = inspectWorkbenchClientModel(await response.json());
    if (url.pathname === "/change" || url.pathname === "/owner-artifact") {
      if (model.view === "access" && model.authenticated === false)
        return model;
      const kind = url.pathname === "/change" ? "change" : "owner";
      if (
        model.view !== "artifact" ||
        model.artifact.kind !== kind ||
        model.artifact.identity !==
          parameters.get(kind === "change" ? "id" : "path") ||
        (parameters.has("repositoryId")
          ? parameters.getAll("repositoryId").length !== 1 ||
            parameters.get("repositoryId") !== model.repositoryId ||
            model.selectedRepositoryId !== model.repositoryId
          : model.selectedRepositoryId !== null)
      )
        throw new Error("workbench_client_model_unavailable");
    }
    return model;
  });
}
