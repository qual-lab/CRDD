/**
 * 現在の本人と管理操作の表示・受付を描画する。
 * @responsibility 対象・個別改訂・結果と再観測を同じ画面へ接続する。
 * @trace ARCH-000013
 * @boundary Workbench管理JSONとReact DOM。
 * @security 資格・管理Root・Bindingを保持せず、表示可否を実行認可にしない。
 */
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactElement,
  type FormEvent,
} from "react";
import { WorkbenchPanel, ActionTokenInput, EmptyState } from "./elements.ts";
import {
  validateManagementResponse,
  type ManagementView,
  type ManagementResult,
} from "../api/response.ts";
import { requestSessionManagementChange } from "../api/mutations.ts";
import {
  inspectWorkbenchManagementUsers,
  type ManagementPermissions,
  readManagementPermissions,
  requestManagementView,
  type WorkbenchManagementUsers,
} from "../api/access.ts";

const ROLE_LABELS = {
  developer: "開発者",
  manager: "マネージャー",
  administrator: "管理者",
} as const;

/**
 * 同改訂を偽らず、現在管理対象と操作結果を表示する。
 * @responsibility 同Hostの七保存と全Role本人表示を閉JSONへ接続する。
 * @trace ARCH-000013
 * @input 同Origin Action Tokenと画面全体の再観測callback。
 * @returns 管理Panel。
 * @precondition backendが現在AM認可と入力境界を確認する。
 * @postcondition 保存後fresh、拒否／不明で旧管理投影を再使用しない。
 * @effect 明示POST一回と管理GET、成功後の画面再観測。
 * @failure 保存／観測不明を未保存・rollback・取消完了にしない。
 * @invariant 改訂はSectionごと、管理と内容範囲は別。
 * @boundary CSR管理Formと同Origin backend。
 * @security 生資格・永続Storage・Root反射なし。
 * @concurrency 二重送信をrefで拒否、Unmount時に所有fetchを取消する。
 */
export function ManagementPanel({
  actionToken,
  onSessionUsers,
  onPermissions,
  onSessionUnavailable,
}: {
  actionToken: string;
  onSessionUsers?: (result: WorkbenchManagementUsers) => void;
  onPermissions?: (permissions: ManagementPermissions) => void;
  onSessionUnavailable?: (
    permissionDenied?: boolean,
    resultNotice?: string,
  ) => void;
}): ReactElement {
  const [data, setData] = useState<
    Partial<Record<ManagementView, ManagementResult>>
  >({});
  const [usersView, setUsersView] = useState<WorkbenchManagementUsers | null>(
    null,
  );
  const [permissions, setPermissions] = useState<ManagementPermissions | null>(
    null,
  );
  const [notice, setNotice] = useState("現在の接続を確認しています。");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const resultFocus = useRef<HTMLParagraphElement>(null);

  /**
   * 現在本人から必要な四投影を別改訂で再取得する。
   * @responsibility 降格・失効後に以前の管理一覧を表示しない。
   * @trace ARCH-000013
   * @input 所有Signal。
   * @returns N/A: Section表示を更新する。
   * @precondition 同Originの閉GETだけを使う。
   * @postcondition 不明を空成功へ変換しない。
   * @effect 本人一GETと管理者だけ四GET。
   * @failure 未取得はそのSectionを利用不能へ表示する。
   * @invariant 四改訂を合成しない。
   * @boundary 管理backendとCSR。
   * @security 他Userを本人推定に使わない。
   * @concurrency 並行GETを全てsettleまで待ち、取消後は描画しない。
   */
  const refreshManagement = useCallback(
    async (signal: AbortSignal, resultNotice?: string): Promise<void> => {
      if (!actionToken) throw new Error("management_unavailable");
      setData({});
      setUsersView(null);
      setPermissions(null);
      const next: Partial<Record<ManagementView, ManagementResult>> = {};
      let currentUsers: WorkbenchManagementUsers | null = null;
      let currentPermissions: ManagementPermissions | null = null;
      for (const view of ["current", "users", "repositories"] as const) {
        const response = await requestManagementView(view, signal);
        if (signal.aborted) return;
        if (response.status === 401 || response.status === 403)
          onSessionUnavailable?.(false, resultNotice);
        if (!response.ok) throw new Error("management_unavailable");
        const value: unknown = await response.json();
        if (signal.aborted) return;
        if (
          !value ||
          typeof value !== "object" ||
          !("formToken" in value) ||
          value.formToken !== actionToken
        )
          throw new Error("management_unavailable");
        if (view === "users") {
          currentUsers = inspectWorkbenchManagementUsers(value);
          continue;
        }
        const { formToken: _token, ...projection } = value;
        const { management, ...ordinary } = projection as Record<
          string,
          unknown
        >;
        if (view !== "current" && Object.hasOwn(projection, "management"))
          throw new Error("management_unavailable");
        const result = validateManagementResponse(ordinary, view);
        next[view] = result;
        if (view === "current") {
          if (result.status !== "completed" || !("user" in result))
            throw new Error("management_unavailable");
          currentPermissions = readManagementPermissions(management);
          if (!currentPermissions.openSession) {
            onSessionUnavailable?.(true, resultNotice);
            return;
          }
        }
      }
      if (signal.aborted) return;
      setData(next);
      setUsersView(currentUsers);
      setPermissions(currentPermissions);
      if (currentUsers) onSessionUsers?.(currentUsers);
      if (currentPermissions) onPermissions?.(currentPermissions);
      setPage(0);
    },
    [actionToken, onSessionUnavailable, onSessionUsers, onPermissions],
  );

  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    void refreshManagement(active.signal)
      .then(() => {
        if (!active.signal.aborted) setNotice("");
      })
      .catch(() => {
        if (!active.signal.aborted)
          setNotice(
            "現在の管理状態を確認できません。以前の一覧は表示しません。",
          );
      });
    return () => {
      active.abort();
      controller.current?.abort();
    };
  }, [refreshManagement]);

  /**
   * 明示した一Formだけを送信して結果と現在投影を確認する。
   * @responsibility 既知保存と後続観測失敗を分離し、自動再送しない。
   * @trace ARCH-000013
   * @input 利用者が送信した操作別Form。
   * @returns N/A: 結果表示とFocusを更新する。
   * @precondition 対象と表示改訂がFormに明示されている。
   * @postcondition 保存確認・拒否・出版不明・清掃不明を別表示する。
   * @effect 同Origin POST一回と再観測。
   * @failure 応答喪失では保存済みか断定せず、再送しない。
   * @invariant 保存成功から内容利用や取消完了を推定しない。
   * @boundary Browser明示操作とbackend。
   * @security IDと非秘密設定だけを送る。
   * @concurrency pending refで二重送信0、保存後は元改訂を再使用しない。
   */
  async function submitManagement(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending.current) return;
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") return;
      body.append(key, value);
    }
    body.set("operationId", crypto.randomUUID());
    pending.current = true;
    setBusy(true);
    setNotice("操作を処理しています。");
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    let resultNotice =
      "操作結果を確認できません。保存されていないとは判断せず、自動再送しません。";
    try {
      const response = await requestSessionManagementChange(
        body,
        active.signal,
      );
      if (active.signal.aborted) return;
      if (response.status === 401) onSessionUnavailable?.(false, resultNotice);
      if (!response.ok && ![403, 409, 503].includes(response.status))
        throw new Error("management_unavailable");
      const result = validateManagementResponse(
        await response.json(),
        "mutation",
      );
      const conflict =
        result.status === "rejected" &&
        result.reason === "management_revision_conflict";
      if (conflict !== (response.status === 409))
        throw new Error("management_unavailable");
      if (
        "operationId" in result &&
        (result.operationId !== body.get("operationId") ||
          result.expectedRevision !== Number(body.get("expectedRevision")))
      )
        throw new Error("management_unavailable");
      resultNotice =
        result.status === "completed"
          ? `変更を保存しました。改訂 ${result.revision}。内容へのアクセスや開始済み処理の終了を保証するものではありません。`
          : result.status === "rejected"
            ? conflict
              ? "一覧の取得後に管理状態が更新されたため、保存しませんでした。最新の一覧を確認してください。"
              : "現在の権限・対象では受理されませんでした。現在投影を確認してください。"
            : "publication" in result && result.publication === "confirmed"
              ? "保存は確認済みですが、清掃または終了を確認できません。再実行しません。"
              : "保存の結果を確認できません。現在投影で確認し、自動再送しません。";
      setNotice(resultNotice);
      await refreshManagement(active.signal, resultNotice);
    } catch {
      if (!active.signal.aborted) {
        setData({});
        setNotice(`${resultNotice} 現在投影の確認は完了していません。`);
      }
    } finally {
      pending.current = false;
      if (!active.signal.aborted) {
        setBusy(false);
        resultFocus.current?.focus();
      }
    }
  }

  const current = data.current;
  const actor =
    current?.status === "completed" && "user" in current ? current.user : null;
  const usersResult = usersView;
  const repositoriesResult = data.repositories;
  const users = usersResult?.users ?? [];
  const repositories =
    repositoriesResult?.status === "completed" &&
    "repositories" in repositoriesResult
      ? (repositoriesResult.repositories ?? [])
      : [];
  return (
    <WorkbenchPanel
      id="access-management"
      eyebrow="Access Management"
      title="利用者・管理ロール・登録リポジトリ"
      status={actor ? "現在観測" : "未取得"}
    >
      <p ref={resultFocus} tabIndex={-1} role="status" aria-live="polite">
        {notice}
      </p>
      {!actor ? (
        <EmptyState>
          管理接続は未構成または現在情報を取得できません。単体利用では共有ログインは不要です。
        </EmptyState>
      ) : (
        <>
          <p id="access-management-current-user">
            接続している本人: {actor.username}（{ROLE_LABELS[actor.role]}）{" "}
            <code>{actor.userId}</code>
          </p>
          <p>
            管理ロールは内容の権限を付与しません。共有リポジトリの読み書きは本人のGitホスト権限で決まります。
          </p>
          {!permissions?.openSession ? (
            <EmptyState>
              このロールには管理操作を提供しません。本人表示と許可内の利用は可能です。
            </EmptyState>
          ) : (
            <>
              <section>
                <h3>ユーザー</h3>
                {!usersResult ? (
                  <EmptyState>ユーザー一覧を取得できません。</EmptyState>
                ) : (
                  <>
                    <p>
                      改訂 {usersResult.revision}。{users.length}件中{" "}
                      {page * 20 + 1}〜{Math.min((page + 1) * 20, users.length)}
                      件。
                    </p>
                    {users.slice(page * 20, page * 20 + 20).map((user) => (
                      <section key={user.userId}>
                        <h4>
                          {user.username}（{ROLE_LABELS[user.role]}）
                        </h4>
                        <code>{user.userId}</code>
                        {user.actions.rename && (
                          <form
                            onSubmit={(event) => {
                              void submitManagement(event);
                            }}
                          >
                            <ActionTokenInput value={actionToken} />
                            <input
                              type="hidden"
                              name="operation"
                              value="updateUserName"
                            />
                            <input
                              type="hidden"
                              name="expectedRevision"
                              value={usersResult.revision}
                            />
                            <input
                              type="hidden"
                              name="userId"
                              value={user.userId}
                            />
                            <label>
                              新しい表示名
                              <input
                                required
                                name="username"
                                defaultValue={user.username}
                                maxLength={256}
                              />
                            </label>
                            <button type="submit" disabled={busy}>
                              表示名を変更
                            </button>
                          </form>
                        )}
                        {user.actions.changeRoles.length > 0 && (
                          <form
                            onSubmit={(event) => {
                              void submitManagement(event);
                            }}
                          >
                            <ActionTokenInput value={actionToken} />
                            <input
                              type="hidden"
                              name="operation"
                              value="updateUserRole"
                            />
                            <input
                              type="hidden"
                              name="expectedRevision"
                              value={usersResult.revision}
                            />
                            <input
                              type="hidden"
                              name="userId"
                              value={user.userId}
                            />
                            <input
                              type="hidden"
                              name="currentRole"
                              value={user.role}
                            />
                            <label>
                              変更先ロール
                              <select name="nextRole" defaultValue="" required>
                                <option value="" disabled>
                                  変更先を選択
                                </option>
                                {user.actions.changeRoles.map((role) => (
                                  <option key={role} value={role}>
                                    {ROLE_LABELS[role]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p>
                              ロールの変更は、以後の管理操作と内容へのアクセスに影響します。
                            </p>
                            <button type="submit" disabled={busy}>
                              ロールを変更
                            </button>
                          </form>
                        )}
                      </section>
                    ))}
                    <button
                      type="button"
                      disabled={busy || page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      前の20件
                    </button>
                    <button
                      type="submit"
                      disabled={busy || (page + 1) * 20 >= users.length}
                      onClick={() => setPage(page + 1)}
                    >
                      次の20件
                    </button>
                  </>
                )}
              </section>
              <section>
                <h3>登録リポジトリ</h3>
                {repositoriesResult?.status !== "completed" ? (
                  <EmptyState>現在登録を取得できません。</EmptyState>
                ) : (
                  <>
                    <p>
                      改訂 {repositoriesResult.revision}
                      。登録だけで内容へのアクセスは許可されません。
                    </p>
                    <p>
                      登録はログインし、対象リポジトリのGitホストを連携した管理セッションから行います。
                    </p>
                    {permissions.unregisterRepository &&
                      repositories.map((repository) => (
                        <form
                          key={repository.repositoryId}
                          onSubmit={(event) => {
                            void submitManagement(event);
                          }}
                        >
                          <ActionTokenInput value={actionToken} />
                          <input
                            type="hidden"
                            name="operation"
                            value="unregisterRepository"
                          />
                          <input
                            type="hidden"
                            name="expectedRevision"
                            value={repositoriesResult.revision}
                          />
                          <input
                            type="hidden"
                            name="repositoryId"
                            value={repository.repositoryId}
                          />
                          <p>
                            <code>{repository.repositoryId}</code> —
                            CRDDの利用対象から外します。本体は削除しません。
                          </p>
                          <button type="submit" disabled={busy}>
                            登録を解除
                          </button>
                        </form>
                      ))}
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </WorkbenchPanel>
  );
}
