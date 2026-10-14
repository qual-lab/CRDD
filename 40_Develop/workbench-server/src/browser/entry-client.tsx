/**
 * Workbench React ClientのBrowser入口。
 *
 * @packageDocumentation
 * @responsibility 同一OriginのJSON Read Modelを取得し、Workbench全画面をClient-side Reactだけで描画する。
 * @trace ARCH-000012
 * @boundary Vite配布Asset、Workbench JSON APIおよびBrowser DOMの境界。
 * @effect 同一OriginへRead Modelを一回要求し、React Rootを更新する。
 * @security タブ内資格は同Origin要求Headerだけに搬送し、JSON ModelやStorageへ含めない。
 */
import { createRoot } from "react-dom/client";

import {
  inspectWorkbenchClientModel,
  type WorkbenchClientModel,
} from "./client-model.ts";
import { WorkbenchApp } from "./app.tsx";
import { requestWorkbench, clearWorkbenchCredential } from "./connection.ts";

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
async function readWorkbenchClientModel(url: URL, signal: AbortSignal): Promise<WorkbenchClientModel> {
  const parameters = new URLSearchParams(url.search);
  parameters.set("route", url.pathname);
  const response = await requestWorkbench(`/api/workbench-view?${parameters.toString()}`, {
    credentials: "same-origin",
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("workbench_client_model_unavailable");
  const model = inspectWorkbenchClientModel(await response.json());
  if (url.pathname === "/change" || url.pathname === "/owner-artifact") {
    if (model.view === "access" && model.authenticated === false) return model;
    const kind = url.pathname === "/change" ? "change" : "owner";
    if (model.view !== "artifact" || model.artifact.kind !== kind ||
        model.artifact.identity !== parameters.get(kind === "change" ? "id" : "path") ||
        (parameters.has("repositoryId")
          ? parameters.getAll("repositoryId").length !== 1 ||
            parameters.get("repositoryId") !== model.repositoryId ||
            model.selectedRepositoryId !== model.repositoryId
          : model.selectedRepositoryId !== null))
      throw new Error("workbench_client_model_unavailable");
  }
  return model;
}

/**
 * Browser RootをCSRへ接続し、取得失敗を成功画面へ畳まない。
 * @responsibility 検査済みModelだけをReact Rootへ接続する。
 * @trace ARCH-000012
 * @input N/A: Document内の固定Rootを使用する。
 * @returns N/A: Browser DOMを更新する。
 * @precondition Document Shellにdata-workbench-react-rootが存在する。
 * @postcondition readyまたはblockedのどちらかを明示する。
 * @effect JSON取得・React Root更新と既知リンク／GET Form／戻る操作の監視を行う。
 * @failure 取得・検査・描画準備失敗はblocked表示にする。
 * @invariant 失敗を空の成功画面へ畳まない。
 * @boundary Document ShellとClient-side Reactの境界。
 * @security 任意HTMLを挿入せずtextContentで失敗を表示する。
 * @concurrency 表示世代とSignalで旧応答を拒否し、画面終了で監視と資格参照を解放する。
 */
async function startWorkbenchClient(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-workbench-react-root]");
  if (root === null) throw new Error("workbench_client_root_missing");
  root.dataset.workbenchRendering = "client_side";
  let rendering = createRoot(root);
  let generation = 0;
  let active: AbortController | null = null;
  let closed = false;
  const modelRoutes = new Set(["/", "/index.html", "/project", "/topic", "/meeting", "/change", "/owner-artifact"]);

  /**
   * 検査済み表示を同じReact Rootへ切り替える。
   * @responsibility Browser reloadを使わず、資格memoryと表示要求を分離する。
   * @trace ARCH-000012
   * @trace ARCH-000013
   * @input 同Originの既知画面URLと履歴追加の要否。
   * @returns N/A: 現在の画面だけを更新する。
   * @precondition URLは自アプリの既知Model経路である。
   * @postcondition 契約検査後だけURLとModelを採用する。
   * @effect 同Origin GET一回、旧表示要求の取消、必要時history更新。
   * @failure 読取り失敗は旧内容を保持せず固定blocked表示。
   * @invariant URLのRepository IDは認可証明ではない。
   * @boundary 表示要求とWorkbench API。
   * @security 鍵をURL・history・Modelへ含めず、POSTや外部リンクを再送しない。
   * @concurrency 新表示要求が旧要求を取消し、待機後の世代差を再確認する。
   */
  async function navigateWorkbench(url: URL, addHistory: boolean): Promise<void> {
    if (closed || url.origin !== location.origin || !modelRoutes.has(url.pathname)) return;
    active?.abort();
    const controller = new AbortController();
    active = controller;
    const expected = ++generation;
    root!.dataset.workbenchClient = "loading";
    rendering.render(<p role="status">現在の情報を確認しています。</p>);
    try {
      const model = await readWorkbenchClientModel(url, controller.signal);
      if (closed || controller.signal.aborted || expected !== generation) return;
      if (addHistory) history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
      rendering.render(<WorkbenchApp key={expected} model={model} />);
      root!.dataset.workbenchClient = "ready";
    } catch {
      if (closed || controller.signal.aborted || expected !== generation) return;
      root!.dataset.workbenchClient = "blocked";
      rendering.render(<p role="alert">Workbenchの現在表示を取得できません。未観測を正常状態として扱わず、Server接続を確認してください。</p>);
    }
  }

  /**
   * 既知の内部リンクだけを同Origin表示要求へ渡す。
   * @responsibility 外部・別タブ・download・修飾クリックを横取りしない。
   * @trace ARCH-000012
   * @input Documentのクリック。
   * @returns N/A: 対象リンクだけ既定navigationを置換する。
   * @precondition このDocumentのRootが所有する通常クリックである。
   * @postcondition 現在の明示Repository選択を落とさない。
   * @effect 既知リンクで表示GET一回。
   * @failure 対象外リンクはnative挙動を維持する。
   * @invariant リンクはAuthority・保存操作を発行しない。
   * @boundary DOM操作と表示API。
   * @security 同Origin以外へ接続資格を搬送しない。
   * @concurrency 表示要求Ownerが旧応答を処置する。
   */
  function navigateLink(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement) || !root!.contains(anchor) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || !modelRoutes.has(url.pathname)) return;
    if (anchor.getAttribute("href")?.startsWith("#")) return;
    const selected = new URL(location.href).searchParams.get("repositoryId");
    if (selected !== null && !url.searchParams.has("repositoryId")) url.searchParams.set("repositoryId", selected);
    event.preventDefault();
    void navigateWorkbench(url, true);
  }

  /**
   * 既知画面のGET検索を表示APIへ渡す。
   * @responsibility POST操作と検索navigationを分離する。
   * @trace ARCH-000012
   * @input DocumentのForm送信。
   * @returns N/A: 所有GET Formだけnative送信を置換する。
   * @precondition Formは同Originの既知Model経路へ向く。
   * @postcondition 明示選択IDを保持し、値を認可にしない。
   * @effect 表示GET一回、保存・自動再送なし。
   * @failure Fileや対象外Formはnative挙動を維持する。
   * @invariant POST結果の成功やrollbackを生成しない。
   * @boundary 検索Formと表示API。
   * @security 資格をForm・URLへ追加しない。
   * @concurrency 同じ表示Ownerが旧応答を取消する。
   */
  function navigateSearch(event: SubmitEvent): void {
    const form = event.target;
    if (event.defaultPrevented || !(form instanceof HTMLFormElement) || !root!.contains(form) || form.method.toLowerCase() !== "get" || (form.target && form.target !== "_self")) return;
    const url = new URL(form.action);
    if (url.origin !== location.origin || !modelRoutes.has(url.pathname)) return;
    const fields = new URLSearchParams();
    for (const [name, value] of new FormData(form, event.submitter)) {
      if (typeof value !== "string") return;
      fields.append(name, value);
    }
    const selected = new URL(location.href).searchParams.get("repositoryId");
    if (selected !== null && !fields.has("repositoryId")) fields.set("repositoryId", selected);
    url.search = fields.toString();
    event.preventDefault();
    void navigateWorkbench(url, true);
  }

  /**
   * Browserの戻る操作で現在Modelを取り直す。
   * @responsibility historyの古いModelや資格を再利用しない。
   * @trace ARCH-000012
   * @input N/A: popstateの現在URLだけを使う。
   * @returns N/A: 表示要求へ渡す。
   * @precondition Documentは同じRootが所有する。
   * @postcondition 検査済みfresh Modelだけを表示する。
   * @effect GET一回。
   * @failure 固定blocked表示へ接続する。
   * @invariant historyに業務Snapshotや資格を保存しない。
   * @boundary historyと表示Owner。
   * @security URLをAuthorityにしない。
   * @concurrency 世代と取消は表示Ownerが処置する。
   */
  function navigateHistory(): void { void navigateWorkbench(new URL(location.href), false); }

  /**
   * 終了したDocumentの表示要求と監視を解放する。
   * @responsibility タブmemoryの資格を残さず、新要求を止める。
   * @trace ARCH-000012
   * @trace ARCH-000013
   * @input N/A: pagehide通知だけ。
   * @returns N/A: 所有資源を解放する。
   * @precondition 当該Documentに登録した監視だけを扱う。
   * @postcondition 表示採用0、Listener解除、資格参照解放。
   * @effect 所有fetch取消とListener解除。
   * @failure N/A: 外部状態を保存しない。
   * @invariant 発行済み業務Effectのrollbackを主張しない。
   * @boundary Documentと表示lifecycle。
   * @security 別Browserの資格は失効しない。
   * @concurrency 重複終了は冪等に処置する。
   */
  function closeNavigation(): void {
    closed = true; generation += 1; active?.abort(); clearWorkbenchCredential();
    rendering.unmount();
    root!.dataset.workbenchClient = "closed";
    document.removeEventListener("click", navigateLink);
    document.removeEventListener("submit", navigateSearch);
    window.removeEventListener("popstate", navigateHistory);
  }

  /**
   * Browser cacheから戻ったDocumentを資格なしで再接続する。
   * @responsibility 保存された古いReact表示を現在状態として再利用しない。
   * @trace ARCH-000012
   * @trace ARCH-000013
   * @input 同Documentのpageshow通知。
   * @returns N/A: 新しい表示要求へ接続する。
   * @precondition pagehideで当該Rootと資格参照が解放済みである。
   * @postcondition 通常資格を復元せずfreshな現在Modelだけを表示する。
   * @effect React Root再作成、所有監視再登録、GET一回。
   * @failure 表示Ownerの固定blocked処置へ渡す。
   * @invariant Browser cacheを認可・Credential保存にしない。
   * @boundary Browser Document cacheと表示lifecycle。
   * @security 一度表示した鍵・入力・旧Modelを再取得しない。
   * @concurrency 一つの解放済みRootだけを再開する。
   */
  function resumeNavigation(event: PageTransitionEvent): void {
    if (!event.persisted || !closed) return;
    closed = false;
    rendering = createRoot(root!);
    document.addEventListener("click", navigateLink);
    document.addEventListener("submit", navigateSearch);
    window.addEventListener("popstate", navigateHistory);
    void navigateWorkbench(new URL(location.href), false);
  }
  document.addEventListener("click", navigateLink);
  document.addEventListener("submit", navigateSearch);
  window.addEventListener("popstate", navigateHistory);
  window.addEventListener("pagehide", closeNavigation);
  window.addEventListener("pageshow", resumeNavigation);
  await navigateWorkbench(new URL(location.href), false);
}

void startWorkbenchClient();
