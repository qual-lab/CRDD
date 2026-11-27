/**
 * WorkbenchのAccessWorkbenchを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import {
  type ReactElement,
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { EmptyState, WorkbenchPanel } from "../components/elements.ts";
import {
  type AccessViewResponse,
  type ManagementResult,
  validateManagementResponse,
} from "../api/response.ts";
import { ManagementPanel } from "../components/management-panel.tsx";
import { invalidateWorkbenchRequests } from "../api/connection.ts";
import { GitHostConnections } from "../components/connection.tsx";
import { WORKBENCH_LOGO_PATH } from "../components/shell.ts";

const invitePattern = /^#invite=([A-Za-z0-9_-]{43})$/u;
const userIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

async function readInvitationForm(signal: AbortSignal) {
  const list = await fetch("/api/users", { cache: "no-store", signal });
  if (list.status === 401) return null;
  const view: unknown = list.ok ? await list.json() : null;
  if (
    !view ||
    typeof view !== "object" ||
    !("revision" in view) ||
    typeof view.revision !== "number" ||
    !Number.isSafeInteger(view.revision) ||
    view.revision < 1 ||
    !("formToken" in view) ||
    typeof view.formToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(view.formToken)
  )
    throw new Error("invitation_form_unavailable");
  if (!("users" in view) || !Array.isArray(view.users))
    throw new Error("invitation_form_unavailable");
  const users = view.users.map((user: unknown) => {
    if (
      !user ||
      typeof user !== "object" ||
      !("userId" in user) ||
      typeof user.userId !== "string" ||
      !userIdPattern.test(user.userId) ||
      !("username" in user) ||
      typeof user.username !== "string" ||
      !("role" in user) ||
      (user.role !== "developer" &&
        user.role !== "manager" &&
        user.role !== "administrator")
    )
      throw new Error("invitation_form_unavailable");
    return { userId: user.userId, username: user.username, role: user.role };
  });
  return {
    revision: view.revision,
    formToken: view.formToken,
    users,
    hostedRegistration:
      list.headers.get("x-crdd-hosted-registration") === "github.com",
  };
}

function AccountAccess({
  providers,
  onSessionRejected,
}: {
  providers: NonNullable<AccessViewResponse["loginProviders"]>;
  onSessionRejected: () => void;
}) {
  const [invite] = useState(
    () => invitePattern.exec(window.location.hash)?.[1],
  );
  const [role, setRole] = useState<
    "login" | "developer" | "manager" | "administrator" | "unavailable" | null
  >(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [formToken, setFormToken] = useState<string | null>(null);
  const [hostedRegistration, setHostedRegistration] = useState(false);
  const [users, setUsers] = useState<
    NonNullable<Awaited<ReturnType<typeof readInvitationForm>>>["users"]
  >([]);
  const [issued, setIssued] = useState<{
    url: string;
    expiresAt: number;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [managementRefresh, setManagementRefresh] = useState(0);
  const active = useRef<AbortController | null>(null);
  const initialAccess = useRef<AbortController | null>(null);
  const sessionChanges = useRef<BroadcastChannel | null>(null);
  const observeUsers = useCallback((result: ManagementResult) => {
    if (result.status === "completed" && "users" in result && result.users) {
      setRevision(result.revision);
      setUsers(result.users);
    }
  }, []);
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
      if (developer) setRole("developer");
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
      setRole((current) => current ?? "unavailable");
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
    const controller = new AbortController();
    initialAccess.current = controller;
    void (async () => {
      try {
        const response = await fetch("/api/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted || response.status === 404) return;
        if (response.status === 401) {
          setRole("login");
          onSessionRejected();
          return;
        }
        if (!response.ok) return setRole("unavailable");
        const current: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (
          !current ||
          typeof current !== "object" ||
          !("role" in current) ||
          (current.role !== "developer" &&
            current.role !== "manager" &&
            current.role !== "administrator")
        )
          return setRole("unavailable");
        setRole(current.role);
        if (current.role === "developer") return;
        const view = await readInvitationForm(controller.signal);
        if (controller.signal.aborted) return;
        setRevision(view?.revision ?? null);
        setFormToken(view?.formToken ?? null);
        setUsers(view?.users ?? []);
        setHostedRegistration(view?.hostedRegistration ?? false);
      } catch {
        if (!controller.signal.aborted) setRole("unavailable");
      }
    })();
    return () => {
      controller.abort();
      if (initialAccess.current === controller) initialAccess.current = null;
      active.current?.abort();
    };
  }, [invite, onSessionRejected]);

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
    setHostedRegistration(false);
    setNotice("");
    setManagementResult(null);
    sessionChanges.current?.postMessage("changed");
    try {
      const response = await fetch(
        manage ? "/api/session/management" : "/api/session",
        {
          method: manage ? "POST" : "DELETE",
          signal: pending.signal,
        },
      );
      if (pending.signal.aborted) return;
      if (!manage && response.status === 401) {
        setRole("login");
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
      const view = await readInvitationForm(pending.signal);
      if (pending.signal.aborted) return;
      if (!view) throw new Error("session_unavailable");
      setFormToken(view.formToken);
      setRevision(view.revision);
      setUsers(view.users);
      setHostedRegistration(view.hostedRegistration);
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
      (typeof target !== "string" || !userIdPattern.test(target))
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
      const response = await fetch(
        repository
          ? "/api/repositories"
          : target
            ? `/api/users/${target}/invitations`
            : "/api/users",
        {
          method: "POST",
          cache: "no-store",
          signal: pending.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(repository
              ? {
                  repositoryId: form.get("repositoryId"),
                  directory: form.get("directory"),
                }
              : {
                  ...(target
                    ? {}
                    : {
                        username: form.get("username"),
                        role: form.get("role"),
                      }),
                  email: form.get("email"),
                }),
            expectedRevision: revision,
            operationId,
            formToken,
          }),
        },
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

  if (!invite && role === null) return null;
  return (
    <section aria-label="ログインと利用者招待">
      {invite || role === "login" ? (
        providers.map(({ id, displayName }) => (
          <form
            key={id}
            method="post"
            action={`/api/session/login/${encodeURIComponent(id)}${invite ? "/invitation" : ""}`}
          >
            {invite && <input type="hidden" name="invitation" value={invite} />}
            <button type="submit">
              {invite ? "招待を使って" : ""}
              {displayName}でログイン
            </button>
          </form>
        ))
      ) : role === "unavailable" ? (
        <p role="status">ログインの状態を確認できません。</p>
      ) : (
        <>
          <p>ログイン済みです。</p>
          <button type="button" onClick={() => void changeSession("sign_out")}>
            ログアウト
          </button>
          {(role === "manager" || role === "administrator") &&
            (formToken === null ? (
              <button
                type="button"
                onClick={() => void changeSession("start_management")}
              >
                管理セッションを開始
              </button>
            ) : (
              <>
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
                        <option value="developer">開発者</option>
                        <option value="manager">マネージャー</option>
                        {role === "administrator" && (
                          <option value="administrator">管理者</option>
                        )}
                      </select>
                    </label>
                    <button type="submit">登録して招待リンクを発行</button>
                  </fieldset>
                </form>
                {role === "administrator" && (
                  <form onSubmit={register}>
                    <fieldset disabled={revision === null || issued !== null}>
                      <legend>既存利用者の招待を再発行</legend>
                      <label>
                        利用者
                        <select name="userId" required defaultValue="">
                          <option value="" disabled>
                            対象を選択
                          </option>
                          {users.map((user) => (
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
                {hostedRegistration && (
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
  const rejectSession = useCallback(() => setSessionRejected(true), []);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <img src={WORKBENCH_LOGO_PATH} width="36" height="36" alt="CRDD" />
          <span>
            CROS Workbench<small>接続と管理</small>
          </span>
        </a>
      </header>
      <main style={{ gridColumn: "1 / -1" }}>
        {model.loginProviders && (
          <AccountAccess
            providers={model.loginProviders}
            onSessionRejected={rejectSession}
          />
        )}
        {!sessionRejected && <GitHostConnections showLogin={false} />}
        {model.loginProviders && model.authenticated && !sessionRejected ? (
          <WorkbenchPanel
            id="projects"
            eyebrow="Current access"
            title="利用できるProject"
            status={model.portfolio === null ? "未確認" : "現在の許可範囲"}
          >
            {model.portfolio === null ? (
              <EmptyState>現在の内容を確認できません。</EmptyState>
            ) : model.portfolio.projects.length === 0 ? (
              <EmptyState>現在許可されたRepositoryはありません。</EmptyState>
            ) : (
              model.portfolio.projects.map((project) => (
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
          </WorkbenchPanel>
        ) : null}
      </main>
    </div>
  );
}
