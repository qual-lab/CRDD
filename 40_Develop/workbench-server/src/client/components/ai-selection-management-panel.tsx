/**
 * Repository別AI設定の現在値と明示CAS保存を表示する。
 * @responsibility 競合・既知保存・応答不明を分け、設定を自動採用・再送しない。
 * @trace ARCH-000012
 * @boundary Browserと同Originの設定API。
 * @security 資格・Host Path・Provider実行を扱わない。
 */
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type FormEvent,
} from "react";
import type {
  AiSelectionReadResult,
  AiSelectionSaveResult,
  AiSelectionChoice,
  AiSelectionRole,
} from "../../../../coordinator/src/index.ts";
import type { AiModelCatalogSnapshot } from "../../../../ai-adapter/src/index.ts";
import { WorkbenchPanel, ActionTokenInput } from "./elements.ts";
import { requestWorkbench } from "../api/connection.ts";
import { requestWorkbenchMutation } from "../api/mutations.ts";
import { readWorkbenchQuery } from "../api/queries.ts";
import {
  inspectWorkbenchSelectionRead,
  inspectWorkbenchSelectionResult,
} from "../../shared/view/validation.ts";

const roles = [
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
  "advice",
] as const;

/**
 * 入力途中の設定を一つのJSON draftとして扱う。
 * @responsibility 未選択のModelを補完せず、画面内の編集だけを表す。
 * @trace ARCH-000012
 * @shape 五役割の部分入力と分類・上書き。
 * @invariant 正式設定の妥当性・保存可否はServer Ownerが検査する。
 * @boundary Browser Form内部だけ。
 * @security Authority・資格・実行状態を持たない。
 * @compatibility 永続Schemaではない。
 */
type SelectionDraft = {
  contract: "crdd/ai-selection";
  revision: 1;
  roleDefaults: Partial<Record<AiSelectionRole, Partial<AiSelectionChoice>>>;
  workTypes: Record<string, { label: string }>;
  overrides: Partial<
    Record<AiSelectionRole, Record<string, Partial<AiSelectionChoice>>>
  >;
};

/**
 * JSON欄の値を入力部品へ安全に投影する。
 * @responsibility 不正な途中入力を空の正式設定へ補完しない。
 * @trace ARCH-000012
 * @input 画面内のdraft文字列。
 * @returns 編集用外形又はnull。
 * @precondition 保存時の正式検査は別途必須。
 * @postcondition Modelの技術対応・全役割充足を推定しない。
 * @effect N/A: 局所JSON解析。
 * @failure 不正文法・辞書外形・子要素不正はnull。
 * @invariant 新しい保存正本を作らない。
 * @boundary JSON入力とForm表示。
 * @security 任意関数・外部I/Oを扱わない。
 * @concurrency N/A: 同期局所値のみ。
 */
function readSelectionDraft(text: string): SelectionDraft | null {
  try {
    const value = JSON.parse(text);
    const record = (input: unknown): input is Record<string, unknown> =>
      !!input && typeof input === "object" && !Array.isArray(input);
    const choice = (input: unknown) =>
      record(input) &&
      Object.values(input).every((item) => typeof item === "string");
    if (
      !record(value) ||
      value.contract !== "crdd/ai-selection" ||
      value.revision !== 1 ||
      !record(value.roleDefaults) ||
      !Object.values(value.roleDefaults).every(choice) ||
      !record(value.workTypes) ||
      !Object.values(value.workTypes).every(
        (item) => record(item) && typeof item.label === "string",
      ) ||
      !record(value.overrides) ||
      !Object.values(value.overrides).every(
        (item) => record(item) && Object.values(item).every(choice),
      )
    )
      return null;
    return value as SelectionDraft;
  } catch {
    return null;
  }
}

/**
 * 管理Roleが選択RepositoryのAI設定を一回保存する画面。
 * @responsibility 取得世代・二重送信防止・unmount取消を既存HTTP処理へ結合する。
 * @trace ARCH-000012
 * @input Repository ID、管理可否、Token、初期観測と既存画面更新。
 * @returns 未設定・現在設定・明示保存のPanel。
 * @precondition Serverで現在認可とRootを照合する。
 * @postcondition missingだけ初回保存を許可しblockedを空設定へ変換しない。
 * @effect 明示GETとPOST各一回。自動再送なし。
 * @failure 応答不明は再取得へ案内し既知保存結果を保持する。
 * @invariant モデルの技術対応はServer Ownerが検査する。
 * @boundary Repository設定とReact Form。
 * @security Browserの判定を保存Authorityにしない。
 * @concurrency 同期pendingと世代差で古い応答を採用しない。
 */
export function AiSelectionManagementPanel({
  actionToken,
  repositoryId,
  allowed,
  initialRead,
  catalog = null,
  initialResult = null,
  refreshReadModel,
}: {
  actionToken: string;
  repositoryId: string | null;
  allowed: boolean;
  initialRead: AiSelectionReadResult | null;
  catalog?: AiModelCatalogSnapshot | null;
  initialResult?: AiSelectionSaveResult | null;
  refreshReadModel?: (signal: AbortSignal) => Promise<void>;
}): ReactElement | null {
  const [read, setRead] = useState(initialRead);
  const [result, setResult] = useState(initialResult);
  const [draft, setDraft] = useState(
    initialRead?.snapshot
      ? JSON.stringify(initialRead.snapshot.config, null, 2)
      : "",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workTypeId, setWorkTypeId] = useState("");
  const [workTypeLabel, setWorkTypeLabel] = useState("");
  const pending = useRef(false);
  const current = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      current.current?.abort();
      pending.current = false;
    };
  }, []);

  /**
   * 一つの明示操作の結果を同じ画面世代へ反映する。
   * @responsibility 保存を再送せず、既知結果と現在観測を区別する。
   * @trace ARCH-000012
   * @input 保存Form又はnullの明示再取得。
   * @returns 所有HTTPの終了。
   * @precondition pendingでない。
   * @postcondition 取消・終了・別Repositoryへの遅延反映なし。
   * @effect HTTP一要求と任意の既存Read Model再取得。
   * @failure 不明を未保存へ畳まない。
   * @invariant 自動再試行・自動設定生成なし。
   * @boundary React操作と設定API。
   * @security 資格は既存接続Ownerだけが搬送する。
   * @concurrency pendingをawait前に設定しunmountで取消する。
   */
  async function execute(form: URLSearchParams | null): Promise<void> {
    if (pending.current || !allowed) return;
    const controller = new AbortController();
    current.current?.abort();
    current.current = controller;
    pending.current = true;
    setBusy(true);
    const expected = ++generation.current;
    const active = () =>
      mounted.current &&
      !controller.signal.aborted &&
      expected === generation.current;
    let known: AiSelectionSaveResult | null = null;
    try {
      if (form) {
        const response = await requestWorkbenchMutation(
          "/ai-selection/action",
          {
            method: "POST",
            body: form,
            signal: controller.signal,
            headers: { "content-type": "application/x-www-form-urlencoded" },
          },
        );
        if (!response.ok) throw new Error("ai_selection_outcome_unconfirmed");
        known = inspectWorkbenchSelectionResult(form, await response.json());
        if (!active()) return;
        setResult(known);
        setNotice(
          known.status === "saved"
            ? "保存を確認しました。"
            : known.status === "unknown"
              ? "保存結果は未確認です。自動再送は行いません。"
              : "保存できませんでした。現在設定を確認してください。",
        );
        if (known.status === "saved")
          setRead({
            status: "available",
            reason: null,
            snapshot: known.snapshot,
          });
        else setRead(null);
      } else {
        const query = repositoryId
          ? "?repositoryId=" + encodeURIComponent(repositoryId)
          : "";
        const observed = await readWorkbenchQuery(
          "ai-selection",
          controller.signal,
          async (signal) => {
            const response = await requestWorkbench(
              "/api/ai-selection" + query,
              { signal },
            );
            if (!response.ok) throw new Error("ai_selection_unavailable");
            return inspectWorkbenchSelectionRead(await response.json());
          },
        );
        if (!active()) return;
        setRead(observed);
        setDraft(
          observed.snapshot
            ? JSON.stringify(observed.snapshot.config, null, 2)
            : "",
        );
        setNotice("現在の設定を確認しました。");
      }
      if (refreshReadModel) await refreshReadModel(controller.signal);
    } catch {
      if (active()) {
        setRead(null);
        setNotice(
          known?.status === "saved"
            ? "保存は確認済みですが現在表示を更新できません。再送は行いません。"
            : form
              ? "変更結果を確認できません。未保存と判断せず、現在設定を再取得してください。"
              : "現在設定を確認できません。",
        );
      }
    } finally {
      if (active()) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  const edited = readSelectionDraft(draft);
  /**
   * 同じJSON draftへ明示した一編集を反映する。
   * @responsibility 保存要求を発行せず入力部品とJSON欄の二重状態を避ける。
   * @trace ARCH-000012
   * @input 入力途中設定を編集する局所操作。
   * @returns N/A: draft更新のみ。
   * @precondition 現在値を編集用外形として取得できる。
   * @postcondition 未選択Modelを補完しない。
   * @effect React局所状態だけ。
   * @failure 不正JSONは維持し、暗黙修復しない。
   * @invariant 保存は既存の明示submitだけ。
   * @boundary 設定Form内部。
   * @security 権限判定を行わない。
   * @concurrency 関数型更新で同じdraftへ反映する。
   */
  function updateDraft(change: (value: SelectionDraft) => void): void {
    setDraft((previous) => {
      const value = readSelectionDraft(previous);
      if (!value) return previous;
      change(value);
      return JSON.stringify(value, null, 2);
    });
  }
  /**
   * 一役割のProvider・Model・Effort入力を描画する。
   * @responsibility 技術候補を表示し、役割既定と分類上書きを同じ入力で編集する。
   * @trace ARCH-000012
   * @input 固定役割と任意分類ID。
   * @returns 三つの明示選択欄。
   * @precondition 編集用draftが存在する。
   * @postcondition Provider変更で旧Modelを暗黙利用しない。
   * @effect 入力変更時に局所draftだけ更新する。
   * @failure 未選択は空欄のまま保存Ownerの拒否対象とする。
   * @invariant 自動fallback・Model採用なし。
   * @boundary 技術カタログと入力UI。
   * @security 認証済み・利用可能と表示しない。
   * @concurrency 現在draftの関数型更新を利用する。
   */
  function renderChoice(
    role: AiSelectionRole,
    workType?: string,
  ): ReactElement {
    const overrides =
      edited && Object.hasOwn(edited.overrides, role)
        ? edited.overrides[role]
        : undefined;
    const current =
      workType === undefined
        ? edited?.roleDefaults[role]
        : overrides && Object.hasOwn(overrides, workType)
          ? overrides[workType]
          : undefined;
    const models =
      catalog?.catalog.models.filter(
        (model) =>
          model.provider === current?.provider &&
          model.supportedPurposes.includes(
            role === "executor" || role === "independent_reviewer"
              ? "task"
              : "advice",
          ),
      ) ?? [];
    const model = models.find(
      (entry) => entry.modelIdentifier === current?.model,
    );
    const assign = (choice: Partial<AiSelectionChoice>) =>
      updateDraft((value) => {
        if (workType === undefined) value.roleDefaults[role] = choice;
        else {
          const values = Object.hasOwn(value.overrides, role)
            ? (value.overrides[role] ?? {})
            : {};
          values[workType] = choice;
          value.overrides[role] = values;
        }
      });
    return (
      <fieldset
        key={`${role}:${workType ?? "default"}`}
        disabled={busy || !canSave}
      >
        <legend>{role}</legend>
        <label>
          Provider
          <select
            aria-label={`${role} Provider ${workType ?? "default"}`}
            value={current?.provider ?? ""}
            onChange={(event) =>
              assign({
                provider: event.currentTarget
                  .value as AiSelectionChoice["provider"],
                model: "",
                effort: "medium",
              })
            }
          >
            <option value="">選択してください</option>
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
          </select>
        </label>
        <label>
          Model
          <select
            aria-label={`${role} Model ${workType ?? "default"}`}
            value={current?.model ?? ""}
            onChange={(event) =>
              assign({ ...current, model: event.currentTarget.value })
            }
          >
            <option value="">選択してください</option>
            {models.map((entry) => (
              <option key={entry.modelIdentifier} value={entry.modelIdentifier}>
                {entry.modelIdentifier}
              </option>
            ))}
          </select>
        </label>
        <label>
          Effort
          <select
            aria-label={`${role} Effort ${workType ?? "default"}`}
            value={current?.effort ?? ""}
            onChange={(event) =>
              assign({
                ...current,
                effort: event.currentTarget
                  .value as AiSelectionChoice["effort"],
              })
            }
          >
            <option value="">選択してください</option>
            {model?.supportedEfforts.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    );
  }
  if (!allowed) return null;
  const canSave = read?.status === "available" || read?.status === "missing";
  return (
    <WorkbenchPanel
      id="ai-selection-management"
      eyebrow="Repository configuration"
      title="AI設定管理"
      status={busy ? "処理中" : (read?.status ?? "未確認")}
    >
      <p role="status">
        {notice ??
          "五役割の既定値・作業分類・分類別上書きを、このRepositoryだけへ保存します。"}
      </p>
      {result ? (
        <p>
          {result.status} — {result.reason}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void execute(null);
        }}
      >
        現在の設定を再取得
      </button>
      <form
        className="ai-selection-form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new URLSearchParams();
          for (const [key, value] of new FormData(event.currentTarget))
            if (typeof value === "string") form.append(key, value);
          void execute(form);
        }}
      >
        <ActionTokenInput value={actionToken} />
        {repositoryId ? (
          <input type="hidden" name="repositoryId" value={repositoryId} />
        ) : null}
        <input
          type="hidden"
          name="expectedIdentity"
          value={read?.snapshot?.identity ?? ""}
        />
        {edited ? (
          <>
            <h3>役割ごとの既定値</h3>
            {roles.map((role) => renderChoice(role))}
            <h3>作業分類と上書き</h3>
            {Object.entries(edited.workTypes).map(([id, entry]) => (
              <fieldset key={id} disabled={busy || !canSave}>
                <legend>{id}</legend>
                <label>
                  表示名
                  <input
                    aria-label={`${id} 表示名`}
                    value={entry.label}
                    onChange={(event) => {
                      const label = event.currentTarget.value;
                      updateDraft((value) => {
                        value.workTypes[id] = { label };
                      });
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((value) => {
                      delete value.workTypes[id];
                      for (const role of roles)
                        if (Object.hasOwn(value.overrides, role))
                          delete value.overrides[role]?.[id];
                    })
                  }
                >
                  分類と上書きを削除
                </button>
                {roles.map((role) => {
                  const values = Object.hasOwn(edited.overrides, role)
                    ? edited.overrides[role]
                    : undefined;
                  const present =
                    values !== undefined && Object.hasOwn(values, id);
                  return (
                    <div key={role}>
                      {present ? (
                        <>
                          {renderChoice(role, id)}
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((value) => {
                                delete value.overrides[role]?.[id];
                              })
                            }
                          >
                            {role} の上書きを削除
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((value) => {
                              const values = value.overrides[role] ?? {};
                              values[id] = {
                                ...value.roleDefaults[role],
                              };
                              value.overrides[role] = values;
                            })
                          }
                        >
                          {role} の上書きを編集
                        </button>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            ))}
            <label>
              新しい分類ID
              <input
                aria-label="新しい分類ID"
                disabled={busy || !canSave}
                value={workTypeId}
                onChange={(event) => setWorkTypeId(event.currentTarget.value)}
              />
            </label>
            <label>
              新しい分類の表示名
              <input
                aria-label="新しい分類の表示名"
                disabled={busy || !canSave}
                value={workTypeLabel}
                onChange={(event) =>
                  setWorkTypeLabel(event.currentTarget.value)
                }
              />
            </label>
            <button
              type="button"
              disabled={
                busy ||
                !canSave ||
                !/^[a-z0-9][a-z0-9._-]*$/u.test(workTypeId) ||
                !workTypeLabel.trim() ||
                Object.hasOwn(edited.workTypes, workTypeId)
              }
              onClick={() => {
                updateDraft((value) => {
                  value.workTypes[workTypeId] = { label: workTypeLabel };
                });
                setWorkTypeId("");
                setWorkTypeLabel("");
              }}
            >
              作業分類を追加
            </button>
          </>
        ) : read?.status === "missing" && draft === "" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setDraft(
                JSON.stringify(
                  {
                    contract: "crdd/ai-selection",
                    revision: 1,
                    roleDefaults: {},
                    workTypes: {},
                    overrides: {},
                  },
                  null,
                  2,
                ),
              )
            }
          >
            新しい設定を編集
          </button>
        ) : (
          <p>JSON入力を確認してください。自動修復は行いません。</p>
        )}
        <label>
          AI選択設定（JSON・詳細入力）
          <textarea
            name="config"
            rows={16}
            required
            value={draft}
            disabled={busy || !canSave}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
        </label>
        <p>
          未設定時も既定モデルは自動作成しません。競合・結果不明の場合は再取得してから判断してください。
        </p>
        <button type="submit" name="saveSelection" disabled={busy || !canSave}>
          このRepositoryへ保存
        </button>
      </form>
    </WorkbenchPanel>
  );
}
