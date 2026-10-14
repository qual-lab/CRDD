/**
 * 共有Record Formの明示送信と現在表示を管理する。
 * @responsibility Main／Detailの既存Formを同じ同Origin搬送へ接続する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary Browser表示と要求専用Topic／Meeting API。
 * @security 資格は接続Ownerだけが扱う。
 */
import { useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { requestWorkbench } from "./connection.ts";
import { createTopicMeetingActionBody, inspectTopicMeetingActionResult } from "./topic-meeting-presentation.ts";
import type { WorkbenchTopicMeetingResultView } from "./client-model.ts";

/**
 * 既存Formの一回送信・結果通知・fresh表示を共用する。
 * @responsibility 保存済み、拒否、結果不明と現在内容未確認を分離する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input Repository ID、Token、既存Form群と現在表示更新callback。
 * @returns 既存内容領域、要求専用通知と明示再取得。
 * @precondition 直接Ownerへ接続済みの共有Modelだけが使用する。
 * @postcondition 保存結果を後続取得失敗で消さず、旧本文はCurrent表示しない。
 * @effect 明示POST一回とfresh GET。再取得buttonはGETのみ。
 * @failure 不明応答は未保存と判断せず、自動再送しない。
 * @invariant 認可と保存判断はServer／Domainが所有する。
 * @boundary 同OriginのForm、API結果と画面世代。
 * @security 鍵・Root・Storageを扱わない。
 * @concurrency pending refで二重送信を拒否し、終了・対象切替で所有fetchを取消する。
 */
export function RecordOperationPanel({ repositoryId, actionToken, children, refresh }: {
  repositoryId: string;
  actionToken: string;
  children: ReactNode;
  refresh: (signal: AbortSignal, result: WorkbenchTopicMeetingResultView | null) => Promise<void>;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<WorkbenchTopicMeetingResultView | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const focus = useRef<HTMLParagraphElement | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true; setBusy(false); setCurrent(true); setNotice(null); setResult(null);
    return () => { mounted.current = false; generation.current += 1; controller.current?.abort(); pending.current = false; };
  }, [repositoryId, actionToken]);
  useEffect(() => { if (!busy && notice !== null) focus.current?.focus(); }, [busy, notice]);

  /**
   * 一回の明示Formを送信し、同じ対象のfresh表示へ接続する。
   * @responsibility 別世代の結果や取消後応答を採用しない。
   * @trace ARCH-000006
   * @trace ARCH-000012
   * @input この領域のTopic／Meeting POST submit。
   * @returns 送信とfresh表示の処置完了。
   * @precondition native validationを通過した明示submit。
   * @postcondition 既知結果を保持し、未知では再送を行わない。
   * @effect POST一回と表示GET。
   * @failure 固定通知へ分離し、現在本文を非表示にする。
   * @invariant Client取消からServer保存の巻戻しを推定しない。
   * @boundary Form、接続Owner、Domain表示結果。
   * @security 秘密をFormへ追加しない。
   * @concurrency 同期guard・Signal・世代を待機後に確認する。
   */
  async function submit(event: FormEvent<HTMLDivElement>): Promise<void> {
    const element = event.target;
    if (!(element instanceof HTMLFormElement) || element.method !== "post" || new URL(element.action).pathname !== "/topic-meeting/action") return;
    event.preventDefault();
    if (pending.current || !current) return;
    let form: URLSearchParams;
    try { form = createTopicMeetingActionBody(new FormData(element), repositoryId, actionToken); }
    catch { setNotice("入力と選択対象を確認してください。送信していません。"); return; }
    const expected = ++generation.current;
    const owned = new AbortController(); controller.current?.abort(); controller.current = owned;
    pending.current = true; setBusy(true); setResult(null); setNotice(null);
    let known: WorkbenchTopicMeetingResultView | null = null;
    try {
      const response = await requestWorkbench("/topic-meeting/action", { method: "POST", body: form, signal: owned.signal, headers: { "content-type": "application/x-www-form-urlencoded" } });
      if (!response.ok) throw new Error("workbench_record_outcome_unconfirmed");
      known = inspectTopicMeetingActionResult(form, await response.json());
      if (!mounted.current || owned.signal.aborted || generation.current !== expected) return;
      setResult(known);
      await refresh(owned.signal, known);
      if (!mounted.current || owned.signal.aborted || generation.current !== expected) return;
      setCurrent(true); setNotice(known.status === "completed" ? "保存を確認し、現在の内容を取得しました。" : "変更は拒否されました。現在の内容を取得しました。");
    } catch {
      if (mounted.current && !owned.signal.aborted && generation.current === expected) {
        setCurrent(false);
        setNotice(known?.status === "completed" ? "保存は確認済みです。現在の内容は未確認です。再送は行っていません。" : known ? "変更は拒否されました。現在の内容は未確認です。" : "変更結果を確認できません。未保存と判断せず現在の内容を再取得してください。再送は行っていません。");
      }
    } finally { if (mounted.current && !owned.signal.aborted && generation.current === expected) { pending.current = false; setBusy(false); } }
  }

  /**
   * 明示再取得を表示Ownerへ渡す。
   * @responsibility 保存を再実行せず、現在本文だけを再観測する。
   * @trace ARCH-000012
   * @input N/A: 再取得button。
   * @returns fresh表示の処置完了。
   * @precondition 保存処理が終了済み。
   * @postcondition 既知保存通知を保持し、失敗時に旧本文を復元しない。
   * @effect GETのみ。
   * @failure 現在内容未確認を維持する。
   * @invariant POSTを再送しない。
   * @boundary 現在表示callback。
   * @security 資格を直接参照しない。
   * @concurrency 同じ対象のSignalと世代で採用を制限する。
   */
  async function retry(): Promise<void> {
    if (pending.current) return;
    const expected = ++generation.current, owned = new AbortController();
    controller.current?.abort(); controller.current = owned; pending.current = true; setBusy(true);
    try {
      await refresh(owned.signal, result);
      if (mounted.current && !owned.signal.aborted && generation.current === expected) { setCurrent(true); setNotice("現在の内容を取得しました。保存要求の再送は行っていません。"); }
    } catch { if (mounted.current && !owned.signal.aborted && generation.current === expected) setNotice(result?.status === "completed" ? "保存は確認済みです。現在の内容は引き続き未確認です。" : "現在の内容を確認できません。再送は行っていません。"); }
    finally { if (mounted.current && !owned.signal.aborted && generation.current === expected) { pending.current = false; setBusy(false); } }
  }
  return <div className="record-operation-surface" style={{ display: "contents" }} onSubmitCapture={submit}>
    {notice === null ? null : <div style={{ gridColumn: "1 / -1" }}><p ref={focus} role="status" tabIndex={-1}>{notice}</p>{result === null ? null : <p className="operation-result">{result.status} — {result.reason}</p>}</div>}
    {current ? <fieldset disabled={busy} style={{ display: "contents" }}>{children}</fieldset> : <div style={{ gridColumn: "1 / -1" }}><p>現在の本文と操作フォームは表示していません。</p><button type="button" disabled={busy} onClick={retry}>現在の内容を再取得</button></div>}
  </div>;
}
