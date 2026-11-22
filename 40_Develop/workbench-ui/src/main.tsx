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
import { RouterProvider } from "react-router/dom";
import { clearWorkbenchCredential } from "./api/connection.ts";
import { createWorkbenchRouter, isWorkbenchRoute } from "./router.tsx";

/**
 * DocumentとRouterの起動・終了を一つのReact Rootへ接続する。
 * @responsibility 履歴と取消はRouterが所有し、既存リンクの選択補正とDocument寿命だけを接続する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input N/A: 固定Document Rootと現在URL。
 * @returns N/A: RouterProviderを描画する。
 * @precondition data-workbench-react-rootが一つ存在する。
 * @postcondition pagehideではRoot・Router・所有監視と資格参照を解放する。
 * @effect 初回表示、既知リンク／GET Formの薄い配送、Document復帰時のfresh表示。
 * @failure Routerが遷移先URLで固定エラーを表示し、旧画面は残さない。
 * @invariant 独自History・Navigation世代・取得Cacheを併存させない。
 * @boundary Document lifecycleと標準Browser Router。
 * @security 接続資格を復帰時に復元せず、URL・Storageへ保存しない。
 * @concurrency 終了後のnavigateを止め、persisted復帰では新しいRouterを作る。
 */
function startWorkbenchClient(): void {
  const selectedRoot = document.querySelector<HTMLElement>(
    "[data-workbench-react-root]",
  );
  if (selectedRoot === null) throw new Error("workbench_client_root_missing");
  const root = selectedRoot;
  root.dataset.workbenchRendering = "client_side";
  root.dataset.workbenchClient = "loading";
  let rendering = createRoot(root);
  let router: ReturnType<typeof createWorkbenchRouter> | null =
    createWorkbenchRouter(root);
  let closed = false;
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
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      !root.contains(anchor) ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self")
    )
      return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || !isWorkbenchRoute(url.pathname))
      return;
    if (anchor.getAttribute("href")?.startsWith("#")) return;
    const selected = new URL(location.href).searchParams.get("repositoryId");
    if (selected !== null && !url.searchParams.has("repositoryId"))
      url.searchParams.set("repositoryId", selected);
    event.preventDefault();
    void router?.navigate(`${url.pathname}${url.search}${url.hash}`, {
      flushSync: true,
    });
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
    if (
      event.defaultPrevented ||
      !(form instanceof HTMLFormElement) ||
      !root.contains(form) ||
      form.method.toLowerCase() !== "get" ||
      (form.target && form.target !== "_self")
    )
      return;
    const url = new URL(form.action);
    if (url.origin !== location.origin || !isWorkbenchRoute(url.pathname))
      return;
    const fields = new URLSearchParams();
    for (const [name, value] of new FormData(form, event.submitter)) {
      if (typeof value !== "string") return;
      fields.append(name, value);
    }
    const selected = new URL(location.href).searchParams.get("repositoryId");
    if (selected !== null && !fields.has("repositoryId"))
      fields.set("repositoryId", selected);
    url.search = fields.toString();
    event.preventDefault();
    void router?.navigate(`${url.pathname}${url.search}${url.hash}`, {
      flushSync: true,
    });
  }

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
    if (closed) return;
    closed = true;
    router?.dispose();
    router = null;
    clearWorkbenchCredential();
    rendering.unmount();
    root.dataset.workbenchClient = "closed";
    document.removeEventListener("click", navigateLink);
    document.removeEventListener("submit", navigateSearch);
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
    rendering = createRoot(root);
    router = createWorkbenchRouter(root);
    rendering.render(
      <RouterProvider
        router={router}
        useTransitions={false}
        onError={() => {}}
      />,
    );
    document.addEventListener("click", navigateLink);
    document.addEventListener("submit", navigateSearch);
  }

  document.addEventListener("click", navigateLink);
  document.addEventListener("submit", navigateSearch);
  window.addEventListener("pagehide", closeNavigation);
  window.addEventListener("pageshow", resumeNavigation);
  rendering.render(
    <RouterProvider
      router={router}
      useTransitions={false}
      onError={() => {}}
    />,
  );
}

startWorkbenchClient();
