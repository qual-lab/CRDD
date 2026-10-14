/**
 * 現在本人と非鍵管理の四投影・明示操作を描画する。
 * @responsibility 対象・個別改訂・結果と再観測を同じ画面へ接続する。
 * @trace ARCH-000013
 * @boundary Workbench管理JSONとReact DOM。
 * @security 資格・管理Root・Bindingを保持せず、表示可否を実行認可にしない。
 */
import { useEffect, useState, useRef, type ReactElement, type FormEvent } from "react";
import { WorkbenchPanel, ActionTokenInput, EmptyState } from "./components.ts";
import { inspectManagementResult, type ManagementView, type WorkbenchManagementResult } from "../management/contract.ts";
import { requestWorkbench } from "./connection.ts";

const ROLE_LABELS = { developer: "開発者", manager: "マネージャー", administrator: "管理者" } as const;
const VIEWS: ManagementView[] = ["users", "roles", "repositories", "exposure"];

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
export function ManagementPanel({ actionToken, refreshReadModel }: { actionToken: string; refreshReadModel: (signal: AbortSignal) => Promise<void> }): ReactElement {
  const [data, setData] = useState<Partial<Record<ManagementView, WorkbenchManagementResult>>>({});
  const [mode, setMode] = useState<"local" | "none">("none");
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
  async function refreshManagement(signal: AbortSignal): Promise<void> {
    setData({});
    const response = await requestWorkbench("/api/access-management?view=current", { cache: "no-store", credentials: "same-origin", signal });
    if (!response.ok) throw new Error("management_unavailable");
    const current = inspectManagementResult(await response.json(), "current");
    const next: Partial<Record<ManagementView, WorkbenchManagementResult>> = { current };
    const nextMode = response.headers.get("x-crdd-management-mode");
    if (nextMode !== "local" && nextMode !== "none") throw new Error("management_unavailable");
    if (current.status === "completed" && "user" in current && current.user.role !== "developer") {
      const reads = await Promise.allSettled(VIEWS.map(async (view) => {
        const reply = await requestWorkbench(`/api/access-management?view=${view}`, { cache: "no-store", credentials: "same-origin", signal });
        if (!reply.ok || reply.headers.get("x-crdd-management-mode") !== nextMode) throw new Error("management_unavailable");
        return { view, result: inspectManagementResult(await reply.json(), view) };
      }));
      if (reads.some((read) => read.status === "rejected")) throw new Error("management_unavailable");
      for (const read of reads) if (read.status === "fulfilled") next[read.value.view] = read.value.result;
    }
    if (signal.aborted) return;
    setMode(nextMode); setData(next); setPage(0);
  }

  useEffect(() => {
    const active = new AbortController(); controller.current = active;
    void refreshManagement(active.signal).then(() => { if (!active.signal.aborted) setNotice(""); }).catch(() => { if (!active.signal.aborted) setNotice("現在の管理状態を確認できません。以前の一覧は表示しません。"); });
    return () => { active.abort(); controller.current?.abort(); };
  }, [actionToken]);

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
  async function submitManagement(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (pending.current) return;
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") return; body.append(key, value);
    }
    body.set("operationId", crypto.randomUUID());
    pending.current = true; setBusy(true); setNotice("操作を処理しています。");
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    let resultNotice = "操作結果を確認できません。保存されていないとは判断せず、自動再送しません。";
    try {
      const response = await requestWorkbench("/access-management/action", { method: "POST", body, credentials: "same-origin", cache: "no-store", signal: active.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" } });
      if (!response.ok) throw new Error("management_unavailable");
      const result = inspectManagementResult(await response.json(), "mutation");
      resultNotice = result.status === "completed" ? `変更を保存しました。改訂 ${result.revision}。内容へのアクセスや開始済み処理の終了を保証するものではありません。` :
        result.status === "rejected" ? "現在の権限・対象・改訂では受理されませんでした。現在投影を確認してください。" :
        "publication" in result && result.publication === "confirmed" ? "保存は確認済みですが、清掃または終了を確認できません。再実行しません。" :
        "保存の結果を確認できません。現在投影で確認し、自動再送しません。";
      setNotice(resultNotice);
      await refreshManagement(active.signal);
      await refreshReadModel(active.signal);
    } catch { if (!active.signal.aborted) { setData({}); setNotice(`${resultNotice} 現在投影の確認は完了していません。`); } }
    finally { pending.current = false; if (!active.signal.aborted) { setBusy(false); resultFocus.current?.focus(); } }
  }

  const current = data.current;
  const actor = current?.status === "completed" && "user" in current ? current.user : null;
  const usersResult = data.users, rolesResult = data.roles, repositoriesResult = data.repositories, exposureResult = data.exposure;
  const users = usersResult?.status === "completed" && "users" in usersResult ? usersResult.users ?? [] : [];
  const roles = rolesResult?.status === "completed" && "roles" in rolesResult ? rolesResult.roles ?? [] : [];
  const repositories = repositoriesResult?.status === "completed" && "repositories" in repositoriesResult ? repositoriesResult.repositories ?? [] : [];
  const exposures = exposureResult?.status === "completed" && "repositories" in exposureResult ? exposureResult.repositories ?? [] : [];
  const availableRoles = actor?.role === "administrator" ? ["developer", "manager", "administrator"] as const : ["developer", "manager"] as const;
  return <WorkbenchPanel id="access-management" eyebrow="Access Management" title="ユーザー・ロール・公開範囲" status={actor ? "現在観測" : "未取得"}>
    <p ref={resultFocus} tabIndex={-1} role="status" aria-live="polite">{notice}</p>
    {!actor ? <EmptyState>管理接続は未構成または現在情報を取得できません。Repository単体利用では鍵は不要です。</EmptyState> : <>
      <p id="access-management-current-user">接続している本人: {actor.username}（{ROLE_LABELS[actor.role]}） <code>{actor.userId}</code></p>
      <p>管理能力と内容利用範囲は別です。各Sectionの改訂は独立しています。</p>
      {actor.role === "developer" ? <EmptyState>このロールには管理操作を提供しません。本人表示と許可内の利用は可能です。</EmptyState> : <>
        <section><h3>ユーザー</h3>
          {usersResult?.status !== "completed" ? <EmptyState>ユーザー一覧を取得できません。</EmptyState> : <>
            <p>改訂 {usersResult.revision}。{users.length}件中 {page * 20 + 1}〜{Math.min((page + 1) * 20, users.length)}件。</p>
            <form onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="registerUser" /><input type="hidden" name="expectedRevision" value={usersResult.revision} />
              <label>表示名<input required name="username" maxLength={256} /></label><label>登録ロール<select name="plannedRole">{availableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><button disabled={busy}>ユーザーを登録（鍵は発行しない）</button></form>
            {users.slice(page * 20, page * 20 + 20).map((user) => <section key={user.userId}><h4>{user.username}（{ROLE_LABELS[user.role]}）</h4><code>{user.userId}</code>
              <form onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="updateUserName" /><input type="hidden" name="expectedRevision" value={usersResult.revision} /><input type="hidden" name="userId" value={user.userId} />
                <label>新しい表示名<input required name="username" defaultValue={user.username} maxLength={256} /></label><button disabled={busy}>表示名を変更</button></form>
              {actor.role !== "administrator" && user.role === "administrator" ? <p>管理者のロール変更は管理者だけが操作できます。</p> : <form onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="changeUserRole" /><input type="hidden" name="expectedRevision" value={usersResult.revision} /><input type="hidden" name="userId" value={user.userId} /><input type="hidden" name="currentRole" value={user.role} />
                <label>変更先ロール<select name="nextRole" defaultValue={user.role}>{availableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><button disabled={busy}>ロールを変更</button></form>}
            </section>)}
            <button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>前の20件</button><button disabled={busy || (page + 1) * 20 >= users.length} onClick={() => setPage(page + 1)}>次の20件</button>
          </>}
        </section>
        <section><h3>ロールの内容利用範囲</h3>{rolesResult?.status !== "completed" ? <EmptyState>現在設定を取得できません。</EmptyState> : <><p>改訂 {rolesResult.revision}。管理操作の分担は変わりません。</p>{roles.map((role) => <form key={role.role} onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="updateRoleContentAccess" /><input type="hidden" name="expectedRevision" value={rolesResult.revision} /><input type="hidden" name="targetRole" value={role.role} /><fieldset><legend>{ROLE_LABELS[role.role]}</legend>{["development", "management"].map((scope) => <label key={scope}><input type="checkbox" name="workspaceIds" value={scope} defaultChecked={role.workspaceIds.includes(scope as "development" | "management")} />{scope === "development" ? "開発" : "マネジメント"}</label>)}</fieldset><button disabled={busy}>内容範囲を変更</button></form>)}</>}</section>
        <section><h3>登録リポジトリ</h3>{repositoriesResult?.status !== "completed" ? <EmptyState>現在登録を取得できません。</EmptyState> : <><p>改訂 {repositoriesResult.revision}。登録は公開設定とは別です。</p>
          {mode !== "local" ? <p>管理Ownerが未構成のためリポジトリ登録を提供できません。</p> : <form onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="registerRepository" /><input type="hidden" name="expectedRevision" value={repositoriesResult.revision} /><label>Repository ID<input required name="repositoryId" /></label><label>サーバー上のRepositoryフォルダ<input required name="repositoryRoot" autoComplete="off" /></label><p>Browserを開いている端末ではなく、Workbench Server上のGit Repositoryを指定します。</p><button disabled={busy}>リポジトリを登録（公開しない）</button></form>}
          {repositories.map((repository) => <form key={repository.repositoryId} onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="unregisterRepository" /><input type="hidden" name="expectedRevision" value={repositoriesResult.revision} /><input type="hidden" name="repositoryId" value={repository.repositoryId} /><p><code>{repository.repositoryId}</code> — 登録と公開設定を解除します。本体は削除しません。</p><button disabled={busy}>登録を解除</button></form>)}</>}</section>
        <section><h3>リポジトリ公開範囲</h3>{exposureResult?.status !== "completed" ? <EmptyState>現在公開範囲を取得できません。</EmptyState> : <><p>改訂 {exposureResult.revision}。未設定と明示的な範囲なしを区別します。</p>{exposures.map((repository) => <form key={repository.repositoryId} onSubmit={(event) => { void submitManagement(event); }}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="updateExposure" /><input type="hidden" name="expectedRevision" value={exposureResult.revision} /><input type="hidden" name="repositoryId" value={repository.repositoryId} /><fieldset><legend>{repository.repositoryId}</legend><p>{"workspaceIds" in repository && repository.workspaceIds === null ? "公開設定なし" : "公開範囲を明示設定済み"}</p>{["development", "management"].map((scope) => <label key={scope}><input type="checkbox" name="workspaceIds" value={scope} defaultChecked={"workspaceIds" in repository && Array.isArray(repository.workspaceIds) && repository.workspaceIds.includes(scope)} />{scope === "development" ? "開発" : "マネジメント"}</label>)}</fieldset><button disabled={busy}>公開範囲を更新</button></form>)}</>}</section>
      </>}
    </>}
  </WorkbenchPanel>;
}
