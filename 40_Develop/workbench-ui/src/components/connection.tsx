/**
 * Workbenchの接続範囲とGitホスト連携を表示する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import { type ReactElement, useEffect, useRef, useState } from "react";
import {
  type GitHostConnectionView,
  validateGitHostConnections,
} from "../api/response.ts";
import { EmptyState, WorkbenchPanel } from "./elements.ts";

const gitConnectionsPath = "/api/session/git";
type GitHostRow = GitHostConnectionView & {
  readonly disconnectFailed?: boolean;
};

export function GitHostConnections({
  showLogin = true,
}: {
  showLogin?: boolean;
}) {
  const [state, setState] = useState<
    "hidden" | "login" | "unavailable" | readonly GitHostRow[]
  >("hidden");
  const lifetime = useRef<AbortController | null>(null);
  const operations = useRef(new Set<string>());
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void (async () => {
      try {
        const response = await fetch(gitConnectionsPath, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 404) return;
        if (response.status === 401) return setState("login");
        if (!response.ok) return setState("unavailable");
        const result: unknown = await response.json();
        if (controller.signal.aborted) return;
        setState(validateGitHostConnections(result));
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      }
    })();
    return () => controller.abort();
  }, []);
  if (
    state === "hidden" ||
    (state === "login" && !showLogin) ||
    (typeof state !== "string" && state.length === 0)
  )
    return null;
  const disconnect = async (id: string) => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || operations.current.has(id)) return;
    operations.current.add(id);
    const finish = (success: boolean) => {
      setState((current) =>
        typeof current === "string"
          ? current
          : current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    connected: success ? false : item.connected,
                    disconnectFailed: !success,
                  }
                : item,
            ),
      );
    };
    try {
      const response = await fetch(
        `${gitConnectionsPath}/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          signal,
        },
      );
      if (signal.aborted) return;
      if (response.status === 401) return setState("login");
      finish(response.status === 204);
    } catch {
      if (!signal.aborted) finish(false);
    } finally {
      operations.current.delete(id);
    }
  };
  return (
    <section aria-label="Gitホスト連携">
      <p>
        連携が必要な共有リポジトリでは、CRDDの開発権限とGitホスト側の書き込み権限がある場合に、
        ローカルでステージ・解除できます。
        共有Workbenchからのコミット・Pushにはまだ対応していません。
      </p>
      {state === "login" ? (
        <a href="/">ログインしてGitホストを連携</a>
      ) : state === "unavailable" ? (
        <p role="status">Gitホストの連携状態を確認できません。</p>
      ) : (
        <ul>
          {state.map(
            ({ id, host, displayName, connected, disconnectFailed }) => (
              <li key={id}>
                {displayName} ({host})
                {connected ? (
                  <button type="button" onClick={() => void disconnect(id)}>
                    このセッションの{displayName}連携を解除
                  </button>
                ) : (
                  <form
                    action={`${gitConnectionsPath}/${encodeURIComponent(id)}`}
                    method="post"
                  >
                    <button type="submit">{displayName}を連携</button>
                  </form>
                )}
                {disconnectFailed ? (
                  <p role="status">
                    このホストの連携解除を確認できません。もう一度お試しください。
                  </p>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

/**
 * Repository単体利用の接続範囲を示す。
 * @responsibility 他Hostへの接続Formを提供せず、現在の利用形態を説明する。
 * @trace ARCH-000012
 * @input N/A: 固定説明だけを表示する。
 * @returns 接続説明Panel。
 * @precondition Repository単体のMain画面である。
 * @postcondition MCP接続先・資格入力・接続操作を表示しない。
 * @effect N/A: 表示のみ。
 * @failure N/A: 非同期操作を行わない。
 * @invariant 別Hostへの接続を作らない。
 * @boundary 単体利用と同Host共有利用の説明。
 * @security 資格を受け取らない。
 * @concurrency N/A: 固定表示。
 */
export function Connection(): ReactElement {
  return (
    <WorkbenchPanel
      id="connection"
      eyebrow="Repository"
      title="接続"
      status="単体利用"
    >
      <EmptyState>
        このRepositoryを資格なしで利用しています。共有利用は共有HostのWorkbenchへBrowserから接続してください。
      </EmptyState>
    </WorkbenchPanel>
  );
}
