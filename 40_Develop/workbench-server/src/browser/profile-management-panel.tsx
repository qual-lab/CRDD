/**
 * Owner別Profile管理の既存Formと現在観測を描画する。
 * @responsibility 単体の既存表示と共有Catalogの明示操作を同じUIへ接続する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 非秘密Catalog JSONとReact Form。
 * @security 鍵はprops・Form・結果へ持たず、同Origin搬送Ownerだけが扱う。
 */
import { useEffect, useState, useRef, type ReactElement, type FormEvent } from "react";
import type { AiProfileCatalogSnapshot, AiProfileCatalogMutationResult } from "../../../ai-adapter/src/index.ts";
import { WorkbenchPanel, ActionTokenInput, EmptyState } from "./components.ts";
import { requestWorkbench } from "./connection.ts";
import { inspectWorkbenchProfileSnapshot, inspectWorkbenchProfileResult } from "./client-model.ts";

/**
 * Repositoryと共有HostのProfile管理入口を表示する。
 * @responsibility 現在Snapshot・明示保存・既知結果と再観測を分離する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Owner、Action Token、任意初期Snapshot／結果と既存画面更新callback。
 * @returns 既存Profile Panel、FormとTable。
 * @precondition Ownerは起動構成／Modelで確定済み。
 * @postcondition 未取得を既定値へ補完せず、既知保存は後続取得故障でも保持する。
 * @effect CROSの同Origin GETと明示POST一回。Repositoryは既存native Form。
 * @failure 拒否・不明で旧CatalogをCurrent表示せず、自動再送しない。
 * @invariant 保存・認可・Owner切替をBrowserで決定しない。
 * @boundary Browser接続資格OwnerとProfile API。
 * @security 秘密・Root・Storageを使用しない。
 * @concurrency 二重送信をrefで拒否し、所有fetchをunmountで取消する。
 */
export function ProfileManagementPanel({
  actionToken, owner, initialSnapshot = null, initialResult = null, refreshReadModel,
}: {
  actionToken: string;
  owner: "Repository" | "CROS";
  initialSnapshot?: AiProfileCatalogSnapshot | null;
  initialResult?: AiProfileCatalogMutationResult | null;
  refreshReadModel?: (signal: AbortSignal) => Promise<void>;
}): ReactElement | null {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [result, setResult] = useState(initialResult);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const current = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const resultFocus = useRef<HTMLParagraphElement | null>(null);

  /**
   * 現在共有Catalogを一応答として検査・採用する。
   * @responsibility 世代差・取消後のSnapshotを表示しない。
   * @trace ARCH-000010
   * @trace ARCH-000012
   * @input 所有Signal。
   * @returns N/A: 現在Snapshotを更新する。
   * @precondition CROS Ownerの同Origin専用APIだけを使う。
   * @postcondition 欠測で旧SnapshotをCurrent表示しない。
   * @effect GET一回、再送なし。
   * @failure HTTP・JSON・相関不正は例外。
   * @invariant Catalog取得を認可・保存成立の証拠にしない。
   * @boundary 現在JSONとComponent世代。
   * @security Header搬送以外に資格を触らない。
   * @concurrency 待機後もSignal・mount・世代を照合する。
   */
  async function readCatalog(signal: AbortSignal): Promise<void> {
    const expected = ++generation.current;
    setSnapshot(null);
    const response = await requestWorkbench("/api/ai-profiles", { signal });
    if (!response.ok) throw new Error("workbench_profile_unavailable");
    const next = inspectWorkbenchProfileSnapshot(await response.json());
    if (!mounted.current || signal.aborted || expected !== generation.current)
      throw new Error("workbench_profile_unavailable");
    setSnapshot(next);
  }

  useEffect(() => {
    mounted.current = true;
    setNotice(null);
    if (owner === "Repository") {
      setSnapshot(initialSnapshot); setResult(initialResult); setBusy(false);
    } else {
      const controller = new AbortController();
      current.current = controller;
      pending.current = true; setBusy(true); setResult(null);
      void readCatalog(controller.signal).catch(() => {
        if (mounted.current && !controller.signal.aborted)
          setNotice("現在のProfile管理情報を取得できません。管理Roleと接続を確認してください。");
      }).finally(() => {
        if (mounted.current && !controller.signal.aborted) {
          pending.current = false; setBusy(false);
        }
      });
    }
    return () => {
      mounted.current = false; generation.current += 1;
      current.current?.abort(); current.current = null; pending.current = false;
    };
  }, [owner, actionToken, initialSnapshot, initialResult]);

  useEffect(() => {
    if (!busy && notice !== null) resultFocus.current?.focus();
  }, [notice, busy]);

  /**
   * 明示再取得を同じ読取りOwnerへ渡す。
   * @responsibility 不明な設定を自動再送なしで再観測する。
   * @trace ARCH-000010
   * @trace ARCH-000012
   * @input N/A: 再取得buttonの明示操作。
   * @returns N/A: 所有読取りを開始する。
   * @precondition 前処理が終了済み。
   * @postcondition 保存要求を再実行しない。
   * @effect GET一回。
   * @failure 不明表示を維持する。
   * @invariant 既知Mutation結果を消去しない。
   * @boundary Browser buttonと現在Catalog。
   * @security 秘密を再取得しない。
   * @concurrency pending中は操作0。
   */
  function retryCatalog(): void {
    if (pending.current) return;
    const controller = new AbortController();
    current.current?.abort(); current.current = controller;
    pending.current = true; setBusy(true);
    void readCatalog(controller.signal).then(() => {
      if (mounted.current && !controller.signal.aborted) setNotice("現在の設定を取得しました。");
    }).catch(() => {
      if (mounted.current && !controller.signal.aborted) setNotice("現在の設定を確認できません。再送は行っていません。");
    }).finally(() => {
      if (mounted.current && !controller.signal.aborted) { pending.current = false; setBusy(false); }
    });
  }

  /**
   * 一回のProfile Formを現在資格で送信する。
   * @responsibility 保存結果と後続の現在投影の確認を分ける。
   * @trace ARCH-000010
   * @trace ARCH-000012
   * @trace ARCH-000013
   * @input 明示送信された既存Form。
   * @returns POSTと現在再観測の処置完了。
   * @precondition 検査済みSnapshotから操作を構成する。
   * @postcondition 既知結果を保持し、応答不明で再送しない。
   * @effect POST一回とGET一回、任意既存画面再観測。
   * @failure 応答不正・喪失は未保存と判断せず固定表示。
   * @invariant Client取消で保存をrollbackしない。
   * @boundary Profile Formと同Origin API。
   * @security 鍵をForm・URL・結果へ転記しない。
   * @concurrency 同期pending guardと所有Signalで二重送信・終了後採用を拒否する。
   */
  async function submitProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending.current) return;
    const form = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      if (typeof value === "string") form.append(key, value);
    const controller = new AbortController();
    current.current?.abort(); current.current = controller;
    pending.current = true; setBusy(true); setResult(null);
    let known: AiProfileCatalogMutationResult | null = null;
    try {
      const response = await requestWorkbench("/ai-profiles/action", {
        method: "POST", body: form, signal: controller.signal,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      if (!response.ok) throw new Error("workbench_profile_outcome_unconfirmed");
      known = inspectWorkbenchProfileResult(form, await response.json());
      if (!mounted.current || controller.signal.aborted) return;
      setResult(known);
      setNotice(known.status === "completed" ? "保存を確認しました。" : "変更は拒否されました。");
      await readCatalog(controller.signal);
      if (refreshReadModel) await refreshReadModel(controller.signal);
    } catch {
      if (mounted.current && !controller.signal.aborted) {
        setSnapshot(null);
        setNotice(known?.status === "completed"
          ? "保存は確認済みです。現在の設定は未確認です。再送は行っていません。"
          : known ? "変更は拒否されました。現在の設定は未確認です。"
          : "変更結果を確認できません。未保存と判断せず現在設定を再取得してください。自動再送は行っていません。");
      }
    } finally {
      if (mounted.current && !controller.signal.aborted) { pending.current = false; setBusy(false); }
    }
  }

  if (snapshot === null) {
    if (owner === "Repository") return null;
    return <WorkbenchPanel id="ai-profile-administration" eyebrow="CROS configuration" title="AI Profile管理" status={busy ? "取得中" : "未確認"}>
      <p ref={resultFocus} role="status" tabIndex={-1}>{notice ?? "現在の設定を確認しています。"}</p>
      {result ? <p className="operation-result"><strong>{result.status}</strong> — {result.reason}</p> : null}
      <EmptyState>管理情報が未取得のためCatalogと件数は表示していません。</EmptyState>
      <button type="button" disabled={busy} onClick={retryCatalog}>現在の設定を再取得</button>
    </WorkbenchPanel>;
  }
  const efforts = [...new Set(snapshot.catalog.adapters.flatMap((adapter) => adapter.allowedReasoningEfforts))];
  return (
    <WorkbenchPanel
      id="ai-profile-administration"
      eyebrow={`${owner} configuration`}
      title="AI Profile管理"
      status={`revision ${snapshot.revision}`}
    >
      {owner === "CROS" ? <p ref={resultFocus} role="status" tabIndex={-1}>{notice ?? "現在の設定を取得しました。"}</p> : null}
      {result === null ? null : (
        <p className="operation-result">
          <strong>{result.status}</strong> — {result.reason}
        </p>
      )}
      <fieldset disabled={busy} style={{display:"contents"}}>
      <form
        onSubmit={owner === "CROS" ? submitProfile : undefined}
        className="ai-profile-administration-form"
        method="post"
        action="/ai-profiles/action"
      >
        <ActionTokenInput value={actionToken} />
        <input
          type="hidden"
          name="expectedRevision"
          value={snapshot.revision}
        />
        <label>
          操作
          <select name="operation" required>
            <option value="create">新規作成</option>
            <option value="update">既存を更新</option>
          </select>
        </label>
        <label>
          Profile ID
          <input name="profileId" pattern="PROFILE-[0-9]{6,}" required />
        </label>
        <label>
          Adapter / Model
          <select name="adapterModel" required>
            {snapshot.catalog.adapters.flatMap((adapter) =>
              adapter.allowedModelIds.map((modelId) => (
                <option
                  key={`${adapter.adapterId}|${modelId}`}
                  value={`${adapter.adapterId}|${modelId}`}
                >
                  {adapter.adapterId} / {modelId}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          Family
          <input name="family" pattern="[a-z][a-z0-9._-]{1,63}" required />
        </label>
        <fieldset><legend>利用Role</legend>{["coordinator", "executor", "independent_reviewer", "result_integration"].map((role) => <label key={role} className="confirm"><input type="checkbox" name="selectionRole" value={role} />{role}</label>)}</fieldset>
        <fieldset><legend>Model Tier</legend>{["preferred", "upper_allowed"].map((tier) => <label key={tier} className="confirm"><input type="checkbox" name="modelTier" value={tier} />{tier}</label>)}</fieldset>
        <label>既定Reasoning<select name="defaultReasoningEffort" required>{efforts.map((effort) => <option key={effort} value={effort}>{effort}</option>)}</select></label>
        <label>互換理由（不要なら空欄）<input name="compatibilityReason" /></label>
        <button type="submit">Catalog候補を検証して保存</button>
      </form>
      <div className="table-scroll"><table><thead><tr><th>Profile</th><th>Adapter / Model</th><th>Actions</th></tr></thead><tbody>{snapshot.catalog.profiles.map((profile) => <tr key={profile.profileId}><td><code>{profile.profileId}</code></td><td>{profile.adapterId} / {profile.exactModelId}</td><td><form method="post" action="/ai-profiles/action" onSubmit={owner === "CROS" ? submitProfile : undefined}><ActionTokenInput value={actionToken} /><input type="hidden" name="operation" value="delete" /><input type="hidden" name="expectedRevision" value={snapshot.revision} /><input type="hidden" name="profileId" value={profile.profileId} /><label className="confirm"><input type="checkbox" name="confirmed" value="true" required />このProfileだけを削除する</label><button type="submit">削除</button></form></td></tr>)}</tbody></table></div>
      </fieldset>
      {owner === "CROS" ? <button type="button" disabled={busy} onClick={retryCatalog}>現在の設定を再取得</button> : null}
    </WorkbenchPanel>
  );
}
