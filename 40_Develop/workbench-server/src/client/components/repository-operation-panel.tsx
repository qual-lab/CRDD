/**
 * 共有Gitフォームの送信と現在表示を管理する。
 * @responsibility 既存Gitフォームを要求専用結果とfresh取得へ接続する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary Browserの明示操作と同Origin Repository API。
 * @security 資格は接続Ownerだけが扱う。
 */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ChangePublicationResult } from "../../../../version-control/src/index.ts";
import {
  validateRepositoryActionForm,
  inspectRepositoryActionResult,
} from "../../shared/repository/validation.ts";
import { requestWorkbenchMutation } from "../api/mutations.ts";

/**
 * Git処置結果と後続の現在状態取得を分離する。
 * @responsibility 一回送信、既知結果の保持、旧状態の非表示と再取得を所有する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 選択ID、Action Token、既存フォームと現在表示更新callback。
 * @returns 既存Git領域、要求専用通知とGET再取得。
 * @precondition 同Hostの直接Git接続済みModelだけが使用する。
 * @postcondition 完了・拒否・不明を後続取得失敗で消さない。
 * @effect 明示POST一回とfresh GET。再取得はGETのみ。
 * @failure 不明応答を未処置と判断せず、自動再送しない。
 * @invariant Git・認可・処置の判断はServerとVersion Controlが所有する。
 * @boundary Form、同Origin応答と現在の表示Owner。
 * @security Root・鍵・Storageを扱わない。
 * @concurrency 同期pending guardと所有Signal・世代で二重送信と旧結果採用を防ぐ。
 */
export function RepositoryOperationPanel({
  repositoryId,
  actionToken,
  children,
  refresh,
}: {
  repositoryId: string;
  actionToken: string;
  children: ReactNode;
  refresh: (signal: AbortSignal) => Promise<void>;
}): ReactElement {
  const [busy, setBusy] = useState(false),
    [current, setCurrent] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ChangePublicationResult | null>(null);
  const pending = useRef(false),
    generation = useRef(0),
    mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const focus = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    mounted.current = repositoryId !== "" && actionToken !== "";
    setBusy(false);
    setCurrent(true);
    setNotice(null);
    setResult(null);
    return () => {
      mounted.current = false;
      generation.current++;
      controller.current?.abort();
      pending.current = false;
    };
  }, [repositoryId, actionToken]);
  useEffect(() => {
    if (!busy && notice !== null) focus.current?.focus();
  }, [busy, notice]);

  /**
   * 選択Rootへの一件の明示Git操作を送る。
   * @responsibility Formと結果を同じ操作へ相関し、終了後は採用しない。
   * @trace ARCH-000009
   * @trace ARCH-000012
   * @input 既存Repositoryフォームのsubmitイベント。
   * @returns 同じ対象の処置とfresh表示の完了。
   * @precondition 現在Git状態を表示し、同時送信していない。
   * @postcondition 既知結果を保持し、取得失敗では旧状態とフォームを隠す。
   * @effect 同Origin POST最大一回、後続GET一回。
   * @failure 不正・喪失応答は結果未確認として保持する。
   * @invariant retryからPOSTしない。
   * @boundary Browserの明示操作と既存Version Control結果。
   * @security File・余剰・重複・別ID・別Tokenを送信前に拒否する。
   * @concurrency 同期guard、所有Signal、mount／世代を確認する。
   */
  async function submit(event: FormEvent<HTMLDivElement>): Promise<void> {
    const element = event.target;
    if (
      !(element instanceof HTMLFormElement) ||
      element.getAttribute("action") !== "/repository/action"
    )
      return;
    event.preventDefault();
    if (pending.current || !current) return;
    const form = new URLSearchParams();
    let request: ReturnType<typeof validateRepositoryActionForm>["request"];
    try {
      for (const [key, value] of new FormData(element)) {
        if (typeof value !== "string")
          throw new Error("repository_form_file_invalid");
        form.append(key, value);
      }
      const validated = validateRepositoryActionForm(form, actionToken, true);
      if (validated.repositoryId !== repositoryId)
        throw new Error("repository_form_selection_invalid");
      request = validated.request;
    } catch {
      setNotice("入力と選択対象を確認してください。送信していません。");
      return;
    }
    const expected = ++generation.current,
      owned = new AbortController();
    controller.current?.abort();
    controller.current = owned;
    pending.current = true;
    setBusy(true);
    setNotice(null);
    setResult(null);
    let known: ChangePublicationResult | null = null;
    try {
      const response = await requestWorkbenchMutation("/repository/action", {
        method: "POST",
        body: form,
        signal: owned.signal,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      if (!response.ok) throw new Error("repository_outcome_unconfirmed");
      known = inspectRepositoryActionResult(request, await response.json());
      if (
        !mounted.current ||
        owned.signal.aborted ||
        generation.current !== expected
      )
        return;
      setResult(known);
      await refresh(owned.signal);
      if (
        !mounted.current ||
        owned.signal.aborted ||
        generation.current !== expected
      )
        return;
      setCurrent(true);
      setNotice(
        known.status === "completed"
          ? "操作の完了を確認し、現在のGit状態を取得しました。"
          : known.status === "blocked"
            ? "操作は拒否されました。現在のGit状態を取得しました。"
            : "操作結果は未確認です。現在のGit状態を取得しました。再送は行っていません。",
      );
    } catch {
      if (
        mounted.current &&
        !owned.signal.aborted &&
        generation.current === expected
      ) {
        setCurrent(false);
        setNotice(
          known?.status === "completed"
            ? "操作の完了は確認済みです。現在のGit状態は未確認です。再送は行っていません。"
            : known?.status === "blocked"
              ? "操作は拒否されました。現在のGit状態は未確認です。再送は行っていません。"
              : "操作結果を確認できません。未処置と判断せず現在のGit状態を再取得してください。再送は行っていません。",
        );
      }
    } finally {
      if (
        mounted.current &&
        !owned.signal.aborted &&
        generation.current === expected
      ) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  /**
   * 現在Git状態だけを明示再取得する。
   * @responsibility 処置結果を保持し、Git操作を再送しない。
   * @trace ARCH-000009
   * @trace ARCH-000012
   * @input N/A: 再取得button。
   * @returns 現在表示の再取得完了。
   * @precondition 操作要求が終了済み。
   * @postcondition 取得成功後だけGit状態とフォームを表示する。
   * @effect GETのみ。
   * @failure 未確認状態を維持する。
   * @invariant POSTを生成しない。
   * @boundary 現在表示Ownerのcallback。
   * @security 資格へ直接アクセスしない。
   * @concurrency 同じSignalと世代で表示を制限する。
   */
  async function retry(): Promise<void> {
    if (pending.current) return;
    const expected = ++generation.current,
      owned = new AbortController();
    controller.current?.abort();
    controller.current = owned;
    pending.current = true;
    setBusy(true);
    try {
      await refresh(owned.signal);
      if (
        mounted.current &&
        !owned.signal.aborted &&
        generation.current === expected
      ) {
        setCurrent(true);
        setNotice(
          result === null || result.status === "unknown"
            ? "操作結果は引き続き未確認です。現在のGit状態だけを取得しました。操作の再送は行っていません。"
            : "現在のGit状態を取得しました。操作の再送は行っていません。",
        );
      }
    } catch {
      if (
        mounted.current &&
        !owned.signal.aborted &&
        generation.current === expected
      )
        setNotice(
          "現在のGit状態は引き続き未確認です。操作の再送は行っていません。",
        );
    } finally {
      if (
        mounted.current &&
        !owned.signal.aborted &&
        generation.current === expected
      ) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div
      className="repository-operation-surface"
      style={{ display: "contents" }}
      onSubmitCapture={submit}
    >
      {notice === null ? null : (
        <div style={{ gridColumn: "1 / -1" }}>
          <p ref={focus} role="status" tabIndex={-1}>
            {notice}
          </p>
          {result === null ? null : (
            <p className="operation-result" data-status={result.status}>
              {result.status} — {result.reason}
            </p>
          )}
        </div>
      )}
      {current ? (
        <fieldset disabled={busy} style={{ display: "contents" }}>
          {children}
        </fieldset>
      ) : (
        <div style={{ gridColumn: "1 / -1" }}>
          <p>現在のGit状態と操作フォームは表示していません。</p>
          <button type="button" disabled={busy} onClick={retry}>
            現在のGit状態を再取得
          </button>
        </div>
      )}
    </div>
  );
}
