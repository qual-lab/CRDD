/**
 * WorkbenchのAccessWorkbenchを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ProjectPageResponse } from "@qual-lab/crdd-server";
import {
  type FormEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  changeBrowserSession,
  isGitHostRevocationUnconfirmed,
  type ManagementPermissions,
  readManagementPermissions,
  registerAccess,
  requestBrowserSession,
  requestManagementUsers,
  type WorkbenchManagementUsers,
} from "../api/access.ts";
import { invalidateWorkbenchRequests } from "../api/connection.ts";
import { UUID_V4 } from "../api/path.ts";
import {
  type AccessViewResponse,
  validateManagementResponse,
} from "../api/response.ts";
import { ProjectLoginRequired, readProjectPage } from "../api/view.ts";
import {
  ExternalLoginOptions,
  GitHostConnections,
} from "../components/connection.tsx";
import { EmptyState, WorkbenchPanel } from "../components/elements.ts";
import { ManagementPanel } from "../components/management-panel.tsx";
import { WORKBENCH_LOGO_PATH } from "../components/shell.ts";

const invitePattern = /^#invite=([A-Za-z0-9_-]{43})$/u;

const roleLabels = {
  developer: "開発者",
  manager: "マネージャー",
  administrator: "管理者",
} as const;

function AccountAccess({
  providers,
  sessionRejected,
  onSessionRejected,
}: {
  providers: NonNullable<AccessViewResponse["loginProviders"]>;
  sessionRejected: boolean;
  onSessionRejected: () => void;
}) {
  const [invite] = useState(
    () => invitePattern.exec(window.location.hash)?.[1],
  );
  const [observedSession, setSession] = useState<
    "login" | "signed_in" | "unavailable" | null
  >(null);
  const session = sessionRejected ? "login" : observedSession;
  const [management, setManagement] = useState<ManagementPermissions | null>(
    null,
  );
  const [revision, setRevision] = useState<number | null>(null);
  const [formToken, setFormToken] = useState<string | null>(null);
  const [users, setUsers] = useState<WorkbenchManagementUsers["users"]>([]);
  const [issued, setIssued] = useState<{
    url: string;
    expiresAt: number;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [managementRefresh, setManagementRefresh] = useState(0);
  const active = useRef<AbortController | null>(null);
  const initialAccess = useRef<AbortController | null>(null);
  const sessionChanges = useRef<BroadcastChannel | null>(null);
  const observeUsers = useCallback((result: WorkbenchManagementUsers) => {
    setRevision(result.revision);
    setUsers(result.users);
  }, []);
  const observeManagement = useCallback(
    (permissions: ManagementPermissions) => {
      setManagement(permissions);
    },
    [],
  );
  const stableResult = useRef<HTMLParagraphElement>(null);
  const [managementResult, setManagementResult] = useState<string | null>(null);
  useEffect(() => {
    if (managementResult) stableResult.current?.focus();
  }, [managementResult]);
  const endManagementView = useCallback(
    (developer?: boolean, resultNotice?: string) => {
      setFormToken(null);
      setRevision(null);
      setUsers([]);
      setIssued(null);
      if (developer) setManagement(null);
      setManagementResult(
        resultNotice
          ? `${resultNotice} ${developer ? "現在のロールでは管理操作を続けられません。" : "管理セッションを確認してください。"}`
          : "管理セッションを確認できません。必要なら開始し直してください。",
      );
    },
    [],
  );
  useEffect(() => {
    if (typeof BroadcastChannel !== "function") return;
    const channel = new BroadcastChannel("crdd:management-session");
    sessionChanges.current = channel;
    const clearPriorSession = (event: MessageEvent<unknown>) => {
      if (event.data !== "changed") return;
      active.current?.abort();
      initialAccess.current?.abort();
      setSession((current) => current ?? "unavailable");
      setFormToken(null);
      setRevision(null);
      setUsers([]);
      setIssued(null);
    };
    channel.addEventListener("message", clearPriorSession);
    return () => {
      sessionChanges.current = null;
      channel.removeEventListener("message", clearPriorSession);
      channel.close();
    };
  }, []);
  useEffect(() => {
    if (invite) {
      if (invitePattern.test(window.location.hash))
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      return;
    }
    if (sessionRejected) return;
    const controller = new AbortController();
    initialAccess.current = controller;
    void (async () => {
      try {
        const response = await requestBrowserSession(controller.signal);
        if (controller.signal.aborted || response.status === 404) return;
        if (response.status === 401) {
          setSession("login");
          onSessionRejected();
          return;
        }
        if (!response.ok) return setSession("unavailable");
        const current: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (
          !current ||
          typeof current !== "object" ||
          !("management" in current)
        )
          return setSession("unavailable");
        const permissions = readManagementPermissions(current.management);
        setSession("signed_in");
        setManagement(permissions);
        if (!permissions.openSession) return;
        const view = await requestManagementUsers(controller.signal);
        if (controller.signal.aborted) return;
        setRevision(view?.revision ?? null);
        setFormToken(view?.formToken ?? null);
        setUsers(view?.users ?? []);
      } catch {
        if (!controller.signal.aborted) setSession("unavailable");
      }
    })();
    return () => {
      controller.abort();
      if (initialAccess.current === controller) initialAccess.current = null;
      active.current?.abort();
    };
  }, [invite, onSessionRejected, sessionRejected]);

  async function changeSession(action: "start_management" | "sign_out") {
    if (active.current) return;
    const pending = new AbortController();
    active.current = pending;
    const manage = action === "start_management";
    if (!manage) invalidateWorkbenchRequests();
    setIssued(null);
    setRevision(null);
    setFormToken(null);
    setUsers([]);
    setNotice("");
    setManagementResult(null);
    sessionChanges.current?.postMessage("changed");
    try {
      const response = await changeBrowserSession(action, pending.signal);
      if (pending.signal.aborted) return;
      const revocationUnconfirmed =
        !manage && (await isGitHostRevocationUnconfirmed(response));
      if (pending.signal.aborted) return;
      if (revocationUnconfirmed) {
        setSession("login");
        onSessionRejected();
        setNotice(
          "CRDDからはログアウトしましたが、Gitホスト側のトークン失効を確認できませんでした。必要に応じてGitホストの設定からアプリの認可を取り消してください。",
        );
        return;
      }
      if (!manage && response.status === 401) {
        setSession("login");
        onSessionRejected();
        setNotice(
          "ログアウトを完了できませんでした。再ログインしてからログアウトしてください。",
        );
        return;
      }
      if (response.status !== 204) throw new Error("session_unavailable");
      if (!manage) {
        window.location.reload();
        return;
      }
      const view = await requestManagementUsers(pending.signal);
      if (pending.signal.aborted) return;
      if (!view) throw new Error("session_unavailable");
      setFormToken(view.formToken);
      setRevision(view.revision);
      setUsers(view.users);
    } catch {
      if (!pending.signal.aborted)
        setNotice(
          "セッションの変更を確認できません。現在のログイン状態を確認してください。",
        );
    } finally {
      active.current = null;
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || revision === null || formToken === null) return;
    const form = new FormData(event.currentTarget);
    const target = form.get("userId");
    const repository = form.has("repositoryId");
    if (
      target !== null &&
      (typeof target !== "string" || !UUID_V4.test(target))
    )
      return;
    const operationId = crypto.randomUUID();
    const pending = new AbortController();
    active.current = pending;
    setIssued(null);
    setRevision(null);
    setNotice(
      repository
        ? "リポジトリの接続先を確認しています。"
        : "利用者を登録しています。",
    );
    try {
      const response = await registerAccess(
        repository
          ? {
              kind: "repository",
              repositoryId: form.get("repositoryId"),
              directory: form.get("directory"),
            }
          : target
            ? { kind: "invitation", userId: target, email: form.get("email") }
            : {
                kind: "user",
                username: form.get("username"),
                role: form.get("role"),
                email: form.get("email"),
              },
        { expectedRevision: revision, operationId, formToken },
        pending.signal,
      );
      if (response.status === 409) {
        const result = validateManagementResponse(
          await response.json(),
          "mutation",
        );
        if (pending.signal.aborted) return;
        if (
          result.status !== "rejected" ||
          result.reason !== "management_revision_conflict"
        )
          throw new Error("management_conflict_unconfirmed");
        setManagementRefresh((generation) => generation + 1);
        setNotice(
          "一覧の取得後に管理状態が更新されたため、保存しませんでした。最新の一覧を確認してください。",
        );
        return;
      }
      const value: unknown =
        response.status === 201 ? await response.json() : null;
      if (pending.signal.aborted) return;
      if (
        repository &&
        value &&
        typeof value === "object" &&
        "status" in value &&
        value.status === "completed" &&
        "operationId" in value &&
        value.operationId === operationId &&
        "revision" in value &&
        value.revision === revision + 1
      ) {
        setRevision(value.revision);
        setManagementRefresh((generation) => generation + 1);
        setNotice(
          "共有リポジトリを登録しました。閲覧・操作はGitホストでの本人の権限に従います。",
        );
        return;
      }
      if (
        !value ||
        typeof value !== "object" ||
        !("result" in value) ||
        !value.result ||
        typeof value.result !== "object" ||
        !("status" in value.result) ||
        value.result.status !== "completed" ||
        !("operationId" in value.result) ||
        value.result.operationId !== operationId ||
        !("revision" in value.result) ||
        value.result.revision !== revision + 1 ||
        !("invitation" in value) ||
        !value.invitation ||
        typeof value.invitation !== "object" ||
        !("url" in value.invitation) ||
        typeof value.invitation.url !== "string" ||
        !("expiresAt" in value.invitation) ||
        typeof value.invitation.expiresAt !== "number" ||
        !Number.isSafeInteger(value.invitation.expiresAt)
      )
        throw new Error("invitation_unavailable");
      const url = new URL(value.invitation.url);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== "/" ||
        url.username ||
        url.password ||
        url.search ||
        !invitePattern.test(url.hash)
      )
        throw new Error("invitation_unavailable");
      setIssued({ url: url.href, expiresAt: value.invitation.expiresAt });
      setRevision(value.result.revision);
      setManagementRefresh((generation) => generation + 1);
      setNotice(
        target
          ? "招待を発行し直しました。古い招待は使えません。"
          : "登録しました。招待リンクはこの画面で一度だけ表示します。",
      );
    } catch {
      if (!pending.signal.aborted)
        setNotice(
          repository
            ? "登録を確認できません。Gitホスト連携とローカルの接続先を確認してください。自動では再送しません。"
            : "招待を確認できません。自動で再送せず、画面を更新して利用者の登録状態を確認してください。",
        );
    } finally {
      active.current = null;
    }
  }

  if (!invite && session === null) return null;
  return (
    <section aria-label="ログインと利用者招待">
      {invite || session === "login" ? (
        <ExternalLoginOptions providers={providers} invitation={invite} />
      ) : session === "unavailable" ? (
        <p role="status">ログインの状態を確認できません。</p>
      ) : (
        <>
          <p>ログイン済みです。</p>
          <button type="button" onClick={() => void changeSession("sign_out")}>
            ログアウト
          </button>
          {management?.openSession &&
            (formToken === null ? (
              <button
                type="button"
                onClick={() => void changeSession("start_management")}
              >
                管理セッションを開始
              </button>
            ) : (
              <>
                {management.registerRoles.length > 0 && (
                  <form onSubmit={register}>
                    <fieldset disabled={revision === null || issued !== null}>
                      <legend>ログインする利用者を登録</legend>
                      <label>
                        表示名
                        <input name="username" required maxLength={256} />
                      </label>
                      <label>
                        初回ログイン用メール
                        <input
                          name="email"
                          type="email"
                          required
                          maxLength={254}
                        />
                      </label>
                      <label>
                        ロール
                        <select name="role">
                          {management.registerRoles.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit">登録して招待リンクを発行</button>
                    </fieldset>
                  </form>
                )}
                {users.some(({ actions }) => actions.renewInvitation) && (
                  <form onSubmit={register}>
                    <fieldset disabled={revision === null || issued !== null}>
                      <legend>既存利用者の招待を再発行</legend>
                      <label>
                        利用者
                        <select name="userId" required defaultValue="">
                          <option value="" disabled>
                            対象を選択
                          </option>
                          {users
                            .filter(({ actions }) => actions.renewInvitation)
                            .map((user) => (
                              <option key={user.userId} value={user.userId}>
                                {user.username} ({user.userId})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        初回ログイン用メール
                        <input
                          type="email"
                          name="email"
                          required
                          maxLength={254}
                        />
                      </label>
                      <p>
                        同じ利用者に新しい招待を発行し、以前のリンクを無効にします。紐付け済みのアカウントは変更しません。
                      </p>
                      <button type="submit">招待を再発行</button>
                    </fieldset>
                  </form>
                )}
                {management.registerRepository && (
                  <form onSubmit={register}>
                    <fieldset disabled={revision === null || issued !== null}>
                      <legend>共有リポジトリを登録</legend>
                      <label>
                        リポジトリID
                        <input name="repositoryId" required maxLength={128} />
                      </label>
                      <label>
                        サーバー上の絶対パス
                        <input name="directory" required maxLength={4096} />
                      </label>
                      <p>
                        本人のGitホスト連携と、リポジトリのHTTPS
                        originを確認します。登録によってGitホストの権限は変わりません。
                      </p>
                      <button type="submit">共有リポジトリを登録</button>
                    </fieldset>
                  </form>
                )}
                <ManagementPanel
                  key={`${formToken}:${managementRefresh}`}
                  actionToken={formToken}
                  onSessionUsers={observeUsers}
                  onPermissions={observeManagement}
                  onSessionUnavailable={endManagementView}
                />
              </>
            ))}
          {managementResult && (
            <p role="status" tabIndex={-1} ref={stableResult}>
              {managementResult}
            </p>
          )}
          {issued && (
            <div>
              <label>
                招待リンク
                <input aria-label="招待リンク" readOnly value={issued.url} />
              </label>
              <p>有効期限: {new Date(issued.expiresAt).toLocaleString()}</p>
              <button type="button" onClick={() => setIssued(null)}>
                リンクを閉じる
              </button>
            </div>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}

/** 本人確認と、確認済み共有セッションで利用できるProjectを表示する。 @trace ARCH-000012 */
export function AccessWorkbench({
  initialModel,
}: {
  initialModel: AccessViewResponse;
}): ReactElement {
  const model = initialModel;
  const [sessionRejected, setSessionRejected] = useState(false);
  const [disconnectsPending, setDisconnectsPending] = useState(0);
  const rejectSession = useCallback(() => setSessionRejected(true), []);
  const observeDisconnect = useCallback((pending: boolean) => {
    setDisconnectsPending((count) => count + (pending ? 1 : -1));
  }, []);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <img src={WORKBENCH_LOGO_PATH} width="36" height="36" alt="CRDD" />
          <span>
            CRDD Workbench<small>接続と管理</small>
          </span>
        </a>
      </header>
      <main style={{ gridColumn: "1 / -1" }}>
        {model.loginProviders && (
          <AccountAccess
            providers={model.loginProviders}
            sessionRejected={sessionRejected}
            onSessionRejected={rejectSession}
          />
        )}
        {model.authenticated && !sessionRejected && (
          <GitHostConnections
            showLogin={false}
            onDisconnectPending={observeDisconnect}
            onSessionRejected={rejectSession}
          />
        )}
        {model.authenticated &&
          !sessionRejected &&
          disconnectsPending === 0 && (
            <AvailableProjects onSessionRejected={rejectSession} />
          )}
      </main>
    </div>
  );
}

/** ログイン状態とは独立に、現在許可された一覧を取得する。 @trace ARCH-000012 */
function AvailableProjects({
  onSessionRejected,
}: {
  onSessionRejected: () => void;
}) {
  const [{ cursor, generation }, select] = useState({
    cursor: "",
    generation: 0,
  });
  const [observed, publish] = useState<{
    generation: number;
    page: ProjectPageResponse | null;
  }>();
  useEffect(() => {
    const pending = new AbortController();
    const publishCurrent = (page: ProjectPageResponse | null) => {
      if (!pending.signal.aborted) publish({ generation, page });
    };
    void readProjectPage(
      null,
      { query: "", state: "", cursor },
      pending.signal,
    ).then(
      (page) => publishCurrent(page.cursorInvalid ? null : page),
      (error: unknown) => {
        if (pending.signal.aborted) return;
        if (error instanceof ProjectLoginRequired) onSessionRejected();
        else publishCurrent(null);
      },
    );
    return () => pending.abort();
  }, [cursor, generation, onSessionRejected]);
  const page = observed?.generation === generation ? observed.page : undefined;
  const open = (cursor: string) =>
    select({ cursor, generation: generation + 1 });
  return (
    <WorkbenchPanel
      id="projects"
      eyebrow="Current access"
      title="利用できるProject"
      status={
        page === undefined
          ? "取得中"
          : page === null
            ? "未確認"
            : "現在の許可範囲"
      }
    >
      {page === undefined ? (
        <EmptyState>利用できるProjectを取得しています。</EmptyState>
      ) : page === null ? (
        <EmptyState>現在の内容を確認できません。</EmptyState>
      ) : page.projects.length === 0 ? (
        <EmptyState>現在許可されたRepositoryはありません。</EmptyState>
      ) : (
        page.projects.map((project) => (
          <div key={project.projectId}>
            <h3>
              {project.projectId} —{" "}
              {
                {
                  complete: "確認済み",
                  partial: "一部未確認",
                  conflicting: "競合あり",
                }[project.state]
              }
            </h3>
            {project.sources.map((source) => (
              <div key={source.repositoryId}>
                {source.state === "complete" ? (
                  <a
                    href={`/?repositoryId=${encodeURIComponent(source.repositoryId)}`}
                  >
                    {source.repositoryId}
                  </a>
                ) : (
                  <span>{source.repositoryId}</span>
                )}{" "}
                —{" "}
                {
                  {
                    complete: "確認済み",
                    missing: "文書未提供",
                    unavailable: "文書未確認",
                    conflicting: "文書競合",
                  }[source.state]
                }
              </div>
            ))}
          </div>
        ))
      )}
      {page === null && !cursor && (
        <button type="button" onClick={() => open("")}>
          再取得
        </button>
      )}
      {cursor && (
        <button type="button" onClick={() => open("")}>
          最初の一覧へ
        </button>
      )}
      {page?.nextCursor && (
        <button type="button" onClick={() => open(page.nextCursor ?? "")}>
          次のProject
        </button>
      )}
    </WorkbenchPanel>
  );
}
