/**
 * Workbench React ClientのBrowser入口。
 *
 * @packageDocumentation
 * @responsibility 同一OriginのJSON Read Modelを取得し、Workbench全画面をClient-side Reactだけで描画する。
 * @trace ARCH-000012
 * @boundary Vite配布Asset、Workbench JSON APIおよびBrowser DOMの境界。
 * @effect 同一OriginへRead Modelを一回要求し、React Rootを更新する。
 * @security Credentialを送信せず、JSON以外を表示Modelとして受理しない。
 */
import { createRoot } from "react-dom/client";

import {
  inspectWorkbenchClientModel,
  type WorkbenchClientModel,
} from "../src/presentation/workbench-client-model.ts";
import { WorkbenchApp } from "./workbench-app.tsx";

/**
 * Workbench Client Model APIから現在の表示Snapshotを取得する。
 * @responsibility 同一OriginのJSONを取得し、Runtime契約検査後だけ表示層へ渡す。
 * @trace ARCH-000012
 * @input N/A: Browserの現在URLからRouteとQueryを取得する。
 * @returns 検査済みWorkbench Client Model。
 * @precondition Workbenchが同一Originで起動している。
 * @postcondition 不正JSONをReactへ渡さない。
 * @effect GET /api/workbench-viewを一回発行する。
 * @failure HTTPまたは契約不一致で例外を送出する。
 * @invariant Browser側で業務状態を補完しない。
 * @boundary Workbench JSON APIとBrowser Reactの境界。
 * @security Credentialを送信せず、same-originだけを使用する。
 * @concurrency 起動ごとに一回だけ実行する。
 */
async function readWorkbenchClientModel(): Promise<WorkbenchClientModel> {
  const parameters = new URLSearchParams(window.location.search);
  parameters.set("route", window.location.pathname);
  const response = await fetch(`/api/workbench-view?${parameters.toString()}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("workbench_client_model_unavailable");
  return inspectWorkbenchClientModel(await response.json());
}

/**
 * Browser RootをCSRへ接続し、取得失敗を成功画面へ畳まない。
 * @responsibility 検査済みModelだけをReact Rootへ接続する。
 * @trace ARCH-000012
 * @input N/A: Document内の固定Rootを使用する。
 * @returns N/A: Browser DOMを更新する。
 * @precondition Document Shellにdata-workbench-react-rootが存在する。
 * @postcondition readyまたはblockedのどちらかを明示する。
 * @effect JSON取得とReact Root更新を行う。
 * @failure 取得・検査・描画準備失敗はblocked表示にする。
 * @invariant 失敗を空の成功画面へ畳まない。
 * @boundary Document ShellとClient-side Reactの境界。
 * @security 任意HTMLを挿入せずtextContentで失敗を表示する。
 * @concurrency 起動Promiseの完了順だけを反映する。
 */
async function startWorkbenchClient(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-workbench-react-root]");
  if (root === null) throw new Error("workbench_client_root_missing");
  root.dataset.workbenchRendering = "client_side";
  try {
    const model = await readWorkbenchClientModel();
    createRoot(root).render(<WorkbenchApp model={model} />);
    root.dataset.workbenchClient = "ready";
  } catch {
    root.dataset.workbenchClient = "blocked";
    root.textContent =
      "Workbenchの現在表示を取得できません。未観測を正常状態として扱わず、Server接続を確認してください。";
  }
}

void startWorkbenchClient();
