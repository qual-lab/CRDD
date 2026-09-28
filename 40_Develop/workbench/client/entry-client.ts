/**
 * Workbench React ClientのBrowser入口。
 *
 * @packageDocumentation
 * @responsibility Server描画済みApplication ShellをHydrationし、Hash Navigationの現在位置を表示へ反映する。
 * @trace ARCH-000012
 * @boundary Vite配布AssetとBrowser DOMの境界。
 * @effect 現在DocumentのReact RootとNavigation表示だけを更新する。
 * @security Credential、Action Tokenおよび内部Fragmentを外部へ送信しない。
 */
import { createElement, useEffect, useState, type ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";

import {
  WorkbenchShell,
  type WorkbenchShellProps,
} from "../src/presentation/workbench-shell.ts";

/**
 * BrowserのHashから現在Sectionを安全な表示値として取得する。
 *
 * @responsibility Navigation強調に使うFragmentだけを正規化する。
 * @trace ARCH-000012
 * @input N/A: Browserのlocation.hashを読む。
 * @returns 空Hashではoverview、それ以外は先頭#を除いた値を返す。
 * @precondition Browser Document内で呼び出される。
 * @postcondition 空文字を返さない。
 * @effect N/A: Browser状態を変更しない。
 * @failure N/A: location.hashが空でもoverviewへ畳む。
 * @invariant Section選択から業務Authorityを生成しない。
 * @boundary Browser LocationとReact Navigation Stateの境界。
 * @security HashをHTMLとして解釈しない。
 * @concurrency Hash変更ごとに最新値を同期取得する。
 */
function readActiveSection(): string {
  const value = window.location.hash.slice(1).trim();
  return value.length === 0 ? "overview" : value;
}

/**
 * Hydration後のNavigation状態を管理する。
 *
 * @responsibility Serverと同じShell Propsを維持し、Hash変更だけをReact Stateへ反映する。
 * @trace ARCH-000012
 * @input propsにServer描画DOMから再構成した表示専用値を受け取る。
 * @returns Hydration対象のWorkbench Shell React要素を返す。
 * @precondition 初期SectionはServer出力と一致するoverviewである。
 * @postcondition Hash変更後に該当Navigationだけがactiveになる。
 * @effect hashchange Listenerを登録し、Unmount時に解除する。
 * @failure N/A: Listener登録と局所State更新だけを行う。
 * @invariant Form、TokenおよびServer生成画面Fragmentを変更しない。
 * @boundary Browser EventとReact Presentation Stateの境界。
 * @security URL FragmentをText比較にだけ使用する。
 * @concurrency React Effectの一つのListenerだけを所有する。
 */
function ClientShell(props: WorkbenchShellProps): ReactElement {
  const [activeSection, setActiveSection] = useState("overview");
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    const hydrationRoot = document.querySelector<HTMLElement>(
      "[data-workbench-react-root]",
    );
    if (hydrationRoot !== null) {
      hydrationRoot.dataset.workbenchHydration = "completed";
    }
    setClientReady(true);
    const update = (): void => setActiveSection(readActiveSection());
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return createElement(WorkbenchShell, {
    ...props,
    activeSection,
    clientReady,
  });
}

const root = document.querySelector<HTMLElement>("[data-workbench-react-root]");
if (root !== null) {
  const shell = root.querySelector<HTMLElement>(".app-shell");
  const refresh = root.querySelector<HTMLElement>("[data-workbench-refresh]");
  const content = root.querySelector<HTMLElement>("[data-workbench-content]");
  if (shell !== null && refresh !== null && content !== null) {
    const props: WorkbenchShellProps = Object.freeze({
      projectId: shell.dataset.projectId ?? "",
      repositoryId: shell.dataset.repositoryId ?? "",
      repositoryRole: shell.dataset.repositoryRole ?? "",
      connectionLabel: shell.dataset.connectionLabel ?? "",
      topicsLabel: shell.dataset.topicsLabel ?? "",
      topicsDetail: shell.dataset.topicsDetail ?? "",
      meetingsLabel: shell.dataset.meetingsLabel ?? "",
      meetingsDetail: shell.dataset.meetingsDetail ?? "",
      logoPath: shell.dataset.logoPath ?? "",
      refreshHtml: refresh.innerHTML,
      contentHtml: content.innerHTML,
    });
    root.dataset.workbenchHydration = "started";
    hydrateRoot(root, createElement(ClientShell, props), {
      onRecoverableError: () => {
        root.dataset.workbenchHydration = "failed";
      },
    });
  }
}
