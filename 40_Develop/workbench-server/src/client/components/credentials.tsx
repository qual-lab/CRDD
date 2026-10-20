/**
 * WorkbenchのConnection・Credentialsを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import {
  type ReactElement,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { ActionTokenInput, EmptyState, WorkbenchPanel } from "./elements.ts";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";
import { inspectWorkbenchClientModel } from "../../shared/view/validation.ts";
import { requestWorkbench } from "../api/connection.ts";
import { readWorkbenchQuery } from "../api/queries.ts";

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

/**
 * Userに結合した資格管理投影と専用POSTの一度提示を描画する。
 * @responsibility 発行・失効・指定／全員交換を分け、秘密を通常Modelへ保持しない。
 * @trace ARCH-000013
 * @input modelに非秘密管理Snapshotと固定用途Action Tokenを受け取る。
 * @returns Credential Administration Panelを返す。
 * @precondition 同Processの現在認可はServerとAMが各操作で確認する。
 * @postcondition 生Tokenは対象操作直後の結果だけに表示する。
 * @effect 明示送信時だけCredential CommandをPOSTする。
 * @failure 未構成・利用不可を空一覧として扱わない。
 * @invariant 資格のverifier、salt、Filesystem Authorityを受け取らない。
 * @boundary AM非秘密投影・管理POSTと管理者Browserの境界。
 * @security 生Tokenを永続・再取得・URL反射しない。
 * @concurrency 更新は同一Credential Identityの最新結果だけを表示する。
 */
export function Credentials({
  model,
}: {
  model: Pick<WorkbenchMainViewModel, "actionToken" | "credentials">;
}): ReactElement {
  const [view, setView] = useState(model.credentials);
  const [secret, setSecret] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    setView(model.credentials);
    setSecret(null);
  }, [model.credentials]);
  const snapshot = view.snapshot;

  /**
   * 管理POSTの一応答だけを画面内で消費する。
   * @responsibility 鍵を汎用ModelやBrowser保存へ入れず、現在状態は別GETで確認する。
   * @trace ARCH-000013
   * @input 管理Formの明示送信event。
   * @returns N/A: 局所表示を更新する。
   * @precondition 同Processの管理画面で、表示対象を利用者が選択する。
   * @postcondition 新操作で前の鍵を消し、自動再送・再GETでの鍵表示0。
   * @effect 同一Origin POST一回と非秘密画面GET一回。
   * @failure 不明な応答は固定案内、保存済み処置のrollbackは推定しない。
   * @invariant presentingを提示確認・交換全体完了・人間閲覧へ強めない。
   * @boundary CSRの管理Formと用途限定応答。
   * @security Local/Session Storage・URL・Log・汎用Read Modelへ鍵を保存しない。
   * @concurrency 画面内では一要求だけ。Serverも改訂競合を再確認する。
   */
  async function submitCredentialAction(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setSecret(null);
    setNotice("");
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") {
        pending.current = false;
        setBusy(false);
        return;
      }
      body.append(key, value);
    }
    try {
      const response = await requestWorkbench(
        "/connection-credentials/action",
        {
          method: "POST",
          body,
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            accept: "application/json",
          },
        },
      );
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("credential_response_invalid");
      const result = value as Record<string, unknown>;
      const allowed = [
        "contract",
        "contractRevision",
        "operation",
        "status",
        "reason",
        "operationId",
        "userId",
        "credentialId",
        "recoveryId",
        "token",
        "publication",
        "cleanupConfirmed",
        "firstFailure",
        "secondaryFailure",
        "observedRevision",
        "lastConfirmedOperationId",
        "lastConfirmedStage",
      ];
      if (
        Object.keys(result).some((key) => !allowed.includes(key)) ||
        result.contract !== "crdd/workbench/credential-action" ||
        result.contractRevision !== 1 ||
        !["issue", "revoke", "exchange-user", "exchange-all"].includes(
          String(result.operation),
        ) ||
        !["presenting", "completed", "blocked"].includes(
          String(result.status),
        ) ||
        typeof result.operationId !== "string" ||
        typeof result.userId !== "string" ||
        typeof result.reason !== "string" ||
        (result.status === "presenting"
          ? typeof result.token !== "string" ||
            typeof result.credentialId !== "string"
          : "token" in result)
      )
        throw new Error("credential_response_invalid");
      if (result.status === "presenting") {
        setSecret(result.token as string);
        setNotice(
          "保存済みの新しい鍵を一度だけ表示します。提示確認・交換の終了状態は現在一覧で確認します。",
        );
      } else
        setNotice(
          result.status === "completed"
            ? result.reason ===
              "previous_exchange_record_closed_no_new_exchange"
              ? "前の交換記録を終了しました。今回の新しい交換や鍵の発行は行っていません。"
              : "指定した資格を失効しました。他の資格は変更していません。"
            : "操作結果は未確認です。現在一覧の既知事実を確認してください。自動再実行しません。",
        );
      const nextModel = await readWorkbenchQuery(
        "credentials-view",
        new AbortController().signal,
        async (signal) => {
          const refreshed = await requestWorkbench("/api/workbench-view", {
            cache: "no-store",
            credentials: "same-origin",
            headers: { accept: "application/json" },
            signal,
          });
          if (!refreshed.ok)
            throw new Error("credential_projection_unavailable");
          return inspectWorkbenchClientModel(await refreshed.json());
        },
      );
      if (nextModel.view === "main") {
        setView(nextModel.credentials);
        if (
          result.status === "presenting" &&
          nextModel.credentials.state === "available" &&
          !nextModel.credentials.snapshot?.credentials.some(
            (credential) =>
              credential.credentialId === result.credentialId &&
              !credential.revoked,
          )
        ) {
          setSecret(null);
          setNotice(
            "発行後の現在一覧では、この鍵の有効性を確認できません。失効した可能性があるため表示を止めました。自動再発行は行いません。",
          );
        }
      }
    } catch {
      setNotice(
        "操作または現在状態の確認を完了できません。未保存・取消・復旧完了とは判断せず、鍵を自動再発行しません。",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  /**
   * 表示済み改訂の有効資格集合を操作範囲へ選ぶ。
   * @responsibility 交換前の失効範囲を表示し、実行時判定をAMへ任せる。
   * @trace ARCH-000013
   * @input 既存userIdと全員範囲の選択。
   * @returns 表示Snapshot内の旧資格ID集合。
   * @precondition 非秘密Snapshotを取得済み。
   * @postcondition Snapshotを変更しない。
   * @effect N/A: 局所配列選択だけ。
   * @failure 未取得では空表示用集合。操作許可を作らない。
   * @invariant 現在処置時のexact集合と期待改訂はAMが再評価する。
   * @boundary 非秘密投影と事前表示。
   * @security 秘密やRole内容権限を使わない。
   * @concurrency 当該画面改訂だけ。
   */
  const oldIds = (userId: string, all: boolean) =>
    snapshot?.credentials
      .filter(
        (credential) =>
          !credential.revoked && (all || credential.userId === userId),
      )
      .map((credential) => credential.credentialId) ?? [];
  const prior = snapshot?.exchange ?? null;
  const allOldIds =
    prior && prior.stage !== "credential_stored" && prior.scope === "all"
      ? [...prior.oldCredentialIds]
      : oldIds("", true);
  return (
    <WorkbenchPanel
      id="credential-administration"
      eyebrow="Access Management"
      title="接続鍵の管理"
      status={view.state === "available" ? "Available" : "Unavailable"}
    >
      {secret === null ? null : (
        <div className="one-time-token">
          <p>
            この鍵は今回だけ表示されます。安全な方法で対象ユーザーへ渡してください。
          </p>
          <code>{secret}</code>
          <button type="button" onClick={() => setSecret(null)}>
            表示を消す
          </button>
        </div>
      )}
      {notice === "" ? null : <p role="status">{notice}</p>}
      {view.state !== "available" || snapshot === null ? (
        <EmptyState>
          同一Processの管理接続がありません。Repository単体利用では鍵は不要です。別Process接続では鍵管理を提供しません。管理接続が失われた場合はHost端末の鍵交換を利用してください。
        </EmptyState>
      ) : (
        <>
          <p>
            ユーザー・ロール・内容権限・Repository本体は鍵操作で変更しません。権限設定はユーザー／ロール管理で行います。
          </p>
          <p>
            現在の接続ユーザー:{" "}
            {snapshot.users.find((user) => user.userId === snapshot.actorUserId)
              ?.username ?? snapshot.actorUserId}
          </p>
          {prior === null ? null : (
            <p>
              未完了交換: <code>{prior.recoveryId}</code> / {prior.stage} /{" "}
              {prior.entry}
              。鍵の再表示は行いません。提示未確認なら別の明示交換、Host起点の途中交換はHost端末で続けてください。
            </p>
          )}
          {snapshot.users.map((user) => {
            const ids =
              prior &&
              prior.stage !== "credential_stored" &&
              prior.scope === "targeted" &&
              prior.recipientUserId === user.userId
                ? [...prior.oldCredentialIds]
                : oldIds(user.userId, false);
            return (
              <section key={user.userId}>
                <h3>
                  {user.username} ({user.role})
                </h3>
                <p>
                  <code>{user.userId}</code>
                </p>
                <form
                  onSubmit={(event) => {
                    void submitCredentialAction(event);
                  }}
                >
                  <ActionTokenInput value={model.actionToken} />
                  <input type="hidden" name="operation" value="issue" />
                  <input
                    type="hidden"
                    name="expectedRevision"
                    value={snapshot.revision}
                  />
                  <input type="hidden" name="userId" value={user.userId} />
                  <button type="submit" disabled={busy || prior !== null}>
                    鍵を発行（旧鍵は失効しない）
                  </button>
                </form>
                <p>
                  指定交換で失効する旧資格: {ids.length}件{" "}
                  {ids.join(", ") || "なし"}。発行先は同じユーザーです。
                </p>
                <form
                  onSubmit={(event) => {
                    void submitCredentialAction(event);
                  }}
                >
                  <ActionTokenInput value={model.actionToken} />
                  <input type="hidden" name="operation" value="exchange-user" />
                  <input
                    type="hidden"
                    name="expectedRevision"
                    value={snapshot.revision}
                  />
                  <input type="hidden" name="userId" value={user.userId} />
                  <input
                    type="hidden"
                    name="displayedOldCredentialIds"
                    value={JSON.stringify(ids)}
                  />
                  {prior?.stage === "credential_stored" &&
                  prior.presentation !== "confirmed" ? (
                    <input
                      type="hidden"
                      name="previousRecoveryId"
                      value={prior.recoveryId}
                    />
                  ) : null}
                  <button type="submit" disabled={busy}>
                    指定ユーザーの鍵を交換
                  </button>
                </form>
                {user.role !== "administrator" ? null : (
                  <form
                    onSubmit={(event) => {
                      void submitCredentialAction(event);
                    }}
                  >
                    <ActionTokenInput value={model.actionToken} />
                    <input
                      type="hidden"
                      name="operation"
                      value="exchange-all"
                    />
                    <input
                      type="hidden"
                      name="expectedRevision"
                      value={snapshot.revision}
                    />
                    <input type="hidden" name="userId" value={user.userId} />
                    <input
                      type="hidden"
                      name="displayedOldCredentialIds"
                      value={JSON.stringify(allOldIds)}
                    />
                    {prior?.stage === "credential_stored" &&
                    prior.presentation !== "confirmed" ? (
                      <input
                        type="hidden"
                        name="previousRecoveryId"
                        value={prior.recoveryId}
                      />
                    ) : null}
                    <p>
                      全員交換は操作主体を含む全ての有効資格を失効します。発行先:{" "}
                      {user.username}。他ユーザーは再発行・配布が必要です。
                    </p>
                    <p>対象旧資格: {allOldIds.join(", ") || "なし"}</p>
                    <label className="confirm">
                      <input
                        type="checkbox"
                        name="confirmed"
                        value="true"
                        required
                      />
                      全員の失効範囲を確認した
                    </label>
                    <button type="submit" disabled={busy}>
                      全ユーザーの鍵を交換
                    </button>
                  </form>
                )}
              </section>
            );
          })}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>資格</th>
                  <th>ユーザー</th>
                  <th>状態</th>
                  <th>提示</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.credentials.map((credential) => (
                  <tr key={credential.credentialId}>
                    <td>
                      <code>{credential.credentialId}</code>
                    </td>
                    <td>
                      {snapshot.users.find(
                        (user) => user.userId === credential.userId,
                      )?.username ?? credential.userId}
                    </td>
                    <td>{credential.revoked ? "失効" : "有効"}</td>
                    <td>{credential.presentation}</td>
                    <td>
                      <form
                        onSubmit={(event) => {
                          void submitCredentialAction(event);
                        }}
                      >
                        <ActionTokenInput value={model.actionToken} />
                        <input type="hidden" name="operation" value="revoke" />
                        <input
                          type="hidden"
                          name="expectedRevision"
                          value={snapshot.revision}
                        />
                        <input
                          type="hidden"
                          name="userId"
                          value={credential.userId}
                        />
                        <input
                          type="hidden"
                          name="credentialId"
                          value={credential.credentialId}
                        />
                        <button
                          type="submit"
                          disabled={
                            busy || credential.revoked || prior !== null
                          }
                        >
                          この資格だけ失効
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </WorkbenchPanel>
  );
}
