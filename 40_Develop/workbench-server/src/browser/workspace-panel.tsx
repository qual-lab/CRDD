/**
 * 継続作業領域と固定候補の明示操作を表示する。
 * @responsibility 一覧・変更確認・固定・別採用を同じ対象へ結合する。
 * @trace ARCH-000012
 * @trace ARCH-000015
 * @boundary CSRと同Origin Workspace API。
 * @security Root・資格・任意commandを入力させずReact Textで表示する。
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import type {
  WorkspaceCommand,
  WorkspaceView,
} from "../../../orchestrator/src/index.ts";
import type { WorkspaceCandidateSelection } from "../../../version-control/src/index.ts";
import { requestWorkbench } from "./connection.ts";
import { WorkbenchPanel } from "./components.ts";

/**
 * 画面から取得する一fileの確認値。
 * @responsibility 見た内容と固定するBlobを関連づける。
 * @trace ARCH-000012
 * @shape Base・HEAD・selection・本文・patchとbinary状態。
 * @invariant 未確認fileを選択しない。
 * @boundary APIと画面memory。
 * @security HTMLを解釈しない。
 * @compatibility 読取り結果は次の固定時にOwnerが再照合する。
 */
type FilePreview = Readonly<{
  baseCommit: string;
  head: string;
  selection: WorkspaceCandidateSelection;
  content: string | null;
  patch: string;
  binary: boolean;
  truncated: false;
}>;

/**
 * 公開Workspace投影の表示に使う型を検査する。
 * @responsibility 不正応答を現在の正常状態にしない。
 * @trace ARCH-000012
 * @input APIの未知値。
 * @returns 検査した投影又は例外。
 * @precondition JSON decode後。
 * @postcondition 内部記録を表示へ追加しない。
 * @effect N/A: 値検査。
 * @failure 型不一致はthrow。
 * @invariant nullと未知を区別する。
 * @boundary Browser API応答。
 * @security 非文字値をReact Textへ渡さない。
 * @concurrency N/A: 局所検査。
 */
function readWorkspace(value: unknown): WorkspaceView | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("workspace_response_invalid");
  const w = value as WorkspaceView;
  if (
    typeof w.workspaceId !== "string" ||
    !/^[a-f0-9-]{36}$/u.test(w.workspaceId) ||
    !Number.isSafeInteger(w.generation) ||
    typeof w.baseCommit !== "string" ||
    typeof w.head !== "string" ||
    !(w.name === null || typeof w.name === "string") ||
    !["creating", "ready", "discarding"].includes(w.phase) ||
    !(w.holdUntil === null || typeof w.holdUntil === "string")
  )
    throw new Error("workspace_response_invalid");
  if (w.candidate !== null) {
    const c = w.candidate;
    if (
      !c ||
      typeof c !== "object" ||
      typeof c.operationId !== "string" ||
      !(c.name === null || typeof c.name === "string") ||
      !["freezing", "fixed", "merging", "merged", "removing"].includes(
        c.phase,
      ) ||
      !(c.candidateCommit === null || typeof c.candidateCommit === "string") ||
      typeof c.baseCommit !== "string" ||
      !(
        c.disposition === null ||
        ["adopted", "rejected"].includes(c.disposition)
      ) ||
      !(
        c.target === null ||
        (typeof c.target === "object" &&
          typeof c.target.targetBranch === "string" &&
          typeof c.target.expectedTargetHead === "string")
      ) ||
      !Array.isArray(c.relatedChangeIds) ||
      c.relatedChangeIds.some((id) => typeof id !== "string") ||
      !Array.isArray(c.selection) ||
      c.selection.some(
        (s) =>
          !s ||
          typeof s.path !== "string" ||
          !(s.blobId === null || typeof s.blobId === "string") ||
          ![null, "100644", "100755"].includes(s.mode),
      )
    )
      throw new Error("workspace_response_invalid");
  }
  return w;
}

/**
 * 作業領域の選択・固定・採用を別の明示操作として描画する。
 * @responsibility 自動再送・Task完了からの採用を行わない。
 * @trace ARCH-000012
 * @trace ARCH-000015
 * @input 選択Repository・Project・同Origin Tokenと現在Git表示値。
 * @returns 既存Visual Baselineを使うPanel。
 * @precondition 各要求はServerが現在認可を再確認する。
 * @postcondition 接続・対象変更時に旧応答を採用しない。
 * @effect 明示POST、一覧読取り、取消と監視解除。
 * @failure 操作応答喪失は結果未確認、再観測へ案内。
 * @invariant 固定と取込を別操作に保つ。
 * @boundary Browser memoryとWorkspace Owner。
 * @security 資格は既存connection Ownerだけが搬送する。
 * @concurrency 同時送信を同期guardで拒否し終了時に所有fetchを取消す。
 */
export function WorkspacePanel({
  repositoryId,
  projectId,
  actionToken,
  initialHead,
  initialBranch,
}: Readonly<{
  repositoryId: string;
  projectId: string;
  actionToken: string;
  initialHead: string;
  initialBranch: string;
}>): ReactElement {
  const [rows, setRows] = useState<
    readonly {
      queueId: string;
      state: string;
      workspace: WorkspaceView | null;
    }[]
  >([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [queueId, setQueueId] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [paths, setPaths] = useState<readonly string[]>([]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [selection, setSelection] = useState<
    readonly WorkspaceCandidateSelection[]
  >([]);
  const [name, setName] = useState("");
  const [base, setBase] = useState(initialHead);
  const [candidateName, setCandidateName] = useState("");
  const [targetBranch, setTargetBranch] = useState(initialBranch);
  const [targetHead, setTargetHead] = useState(initialHead);
  const [until, setUntil] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const [binaryConfirmed, setBinaryConfirmed] = useState(false);
  const [notice, setNotice] = useState(
    "作業計画の受付一覧を取得してください。",
  );
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState("");
  const [relatedChanges, setRelatedChanges] = useState("");
  const createId = useRef<string | null>(null);
  const flight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const common = workspace
    ? {
        projectId,
        queueId,
        workspaceId: workspace.workspaceId,
        expectedGeneration: workspace.generation,
      }
    : null;
  const call = async (command: WorkspaceCommand) => {
    if (
      flight.current ||
      (needsRefresh && !["list", "get"].includes(command.operation))
    )
      return;
    flight.current = true;
    setBusy(true);
    const current = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const body = new URLSearchParams({
        actionToken,
        repositoryId,
        command: JSON.stringify(command),
      });
      const response = await requestWorkbench("/workspace/action", {
        method: "POST",
        body,
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("workspace_outcome_unconfirmed");
      const result = await response.json();
      if (current !== generation.current || abort.signal.aborted) return;
      if (
        result?.contract !== "crdd-orchestrator/workspace-surface/v1" ||
        result.projectId !== projectId ||
        result.operation !== command.operation ||
        !result.data ||
        typeof result.data !== "object"
      )
        throw new Error("workspace_response_invalid");
      const data = result.data;
      if (command.operation === "list") {
        if (
          !Array.isArray(data.entries) ||
          data.entries.length > 50 ||
          !(data.nextCursor === null || typeof data.nextCursor === "string")
        )
          throw new Error("workspace_response_invalid");
        const entries = data.entries.map(
          (row: { queueId: unknown; state: unknown; workspace: unknown }) => {
            if (
              typeof row.queueId !== "string" ||
              typeof row.state !== "string"
            )
              throw new Error("workspace_response_invalid");
            return {
              queueId: row.queueId,
              state: row.state,
              workspace: readWorkspace(row.workspace),
            };
          },
        );
        setRows(entries);
        setCursor(data.nextCursor);
        setWorkspace(
          entries.find((row: { queueId: string }) => row.queueId === queueId)
            ?.workspace ?? null,
        );
        setPaths([]);
        setSelection([]);
        setPreview(null);
        setNeedsRefresh(false);
        createId.current = null;
        setNotice(
          entries.length
            ? "受付を選択して、作業領域を確認してください。"
            : "受付なし。既存の作業計画を登録した後に再取得してください。",
        );
      } else if (
        command.operation === "inspect" ||
        command.operation === "candidate-diff"
      ) {
        if (
          data.baseCommit !==
            (command.operation === "inspect"
              ? workspace?.baseCommit
              : workspace?.candidate?.baseCommit) ||
          data.head !==
            (command.operation === "inspect"
              ? workspace?.head
              : workspace?.candidate?.candidateCommit) ||
          (command.operation === "candidate-diff" &&
            data.candidateCommit !== workspace?.candidate?.candidateCommit) ||
          data.selection?.path !== command.path ||
          typeof data.patch !== "string" ||
          typeof data.binary !== "boolean" ||
          data.truncated !== false ||
          !(data.content === null || typeof data.content === "string") ||
          !(
            data.selection.blobId === null ||
            typeof data.selection.blobId === "string"
          ) ||
          ![null, "100644", "100755"].includes(data.selection.mode)
        )
          throw new Error("workspace_response_invalid");
        setPreview(data as FilePreview);
        setBinaryConfirmed(false);
        setNotice(
          command.operation === "inspect"
            ? "内容を確認してから固定対象へ追加してください。"
            : "固定Commitの差分です。現在の作業Treeは含めていません。",
        );
      } else {
        const next = readWorkspace(data.workspace);
        if (next !== null && next.workspaceId !== command.workspaceId)
          throw new Error("workspace_response_invalid");
        if (command.operation === "get") {
          if (
            next === null ||
            !Array.isArray(data.changedPaths) ||
            data.changedPaths.some((p: unknown) => typeof p !== "string")
          )
            throw new Error("workspace_response_invalid");
          setPaths(data.changedPaths);
          setNeedsRefresh(false);
          setNotice("現在の作業領域と変更を取得しました。");
        } else {
          if (
            !["completed", "blocked"].includes(data.status) ||
            typeof data.reason !== "string" ||
            !/^[a-z_]+$/u.test(data.reason)
          )
            throw new Error("workspace_response_invalid");
          setPaths([]);
          setNotice(
            `${data.status === "completed" ? "操作完了" : "操作停止"}: ${data.reason}。変更一覧は再取得してください。`,
          );
        }
        setWorkspace(next);
        setPreview(null);
        setSelection([]);
        setConfirmed(false);
        setDiscardConfirmed(false);
      }
    } catch {
      if (current === generation.current && !abort.signal.aborted) {
        setNeedsRefresh(true);
        setNotice(
          "結果未確認です。表示は最後に取得した値です。操作は自動再送せず、同じ対象を再取得してください。",
        );
        setPreview(null);
        setSelection([]);
      }
    } finally {
      if (current === generation.current) {
        flight.current = false;
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const c = workspace?.candidate;
  return (
    <WorkbenchPanel
      id="workspaces"
      eyebrow="Workspace"
      title="作業領域と固定候補"
      status={busy ? "処理中" : "明示操作"}
    >
      <p role="status" aria-live="polite">
        {notice}
      </p>
      <p>
        現在の作業Treeを直接編集する方式と、独立した作業領域を区別します。固定・採用・終了はそれぞれ別操作です。
      </p>
      <fieldset disabled={busy}>
        <button
          type="button"
          onClick={() =>
            void call({ operation: "list", projectId, cursor: null, limit: 20 })
          }
        >
          受付一覧を再取得
        </button>
        {cursor ? (
          <button
            type="button"
            onClick={() =>
              void call({ operation: "list", projectId, cursor, limit: 20 })
            }
          >
            次の20件
          </button>
        ) : null}
        <label>
          作業計画の受付
          <select
            value={queueId}
            onChange={(e) => {
              const q = rows.find((r) => r.queueId === e.target.value);
              setQueueId(e.target.value);
              setWorkspace(q?.workspace ?? null);
              setPaths([]);
              setPreview(null);
              setSelection([]);
              setConfirmed(false);
              setDiscardConfirmed(false);
            }}
          >
            <option value="">選択してください</option>
            {rows.map((row) => (
              <option key={row.queueId} value={row.queueId}>
                {row.workspace?.name ?? row.queueId} — {row.state}
              </option>
            ))}
          </select>
        </label>
        {!workspace ? (
          <fieldset disabled={needsRefresh}>
            <label>
              作業領域名
              <input
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Base Commit
              <input value={base} onChange={(e) => setBase(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={!queueId || !base}
              onClick={() => {
                createId.current ??= crypto.randomUUID();
                void call({
                  operation: "create",
                  projectId,
                  queueId,
                  workspaceId: createId.current,
                  expectedGeneration: 0,
                  baseCommit: base,
                  name: name || null,
                });
              }}
            >
              独立した作業領域を作成
            </button>
            <label>
              既存の作業領域
              <select
                value={selectedExisting}
                onChange={(e) => setSelectedExisting(e.target.value)}
              >
                <option value="">選択してください</option>
                {rows
                  .filter((row) => row.workspace !== null)
                  .map((row) => (
                    <option
                      key={row.queueId}
                      value={row.workspace!.workspaceId}
                    >
                      {row.workspace!.name ?? row.workspace!.workspaceId}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!queueId || !selectedExisting}
              onClick={() => {
                const w = rows.find(
                  (row) => row.workspace?.workspaceId === selectedExisting,
                )?.workspace;
                if (w)
                  void call({
                    operation: "select",
                    projectId,
                    queueId,
                    workspaceId: w.workspaceId,
                    expectedGeneration: w.generation,
                  });
              }}
            >
              選択した受付でこの作業領域を使う
            </button>
          </fieldset>
        ) : null}
        {workspace && common ? (
          <>
            <dl>
              <dt>作業領域</dt>
              <dd>{workspace.name ?? workspace.workspaceId}</dd>
              <dt>ID／世代</dt>
              <dd>
                {workspace.workspaceId}／{workspace.generation}
              </dd>
              <dt>Base／HEAD</dt>
              <dd>
                {workspace.baseCommit}
                <br />
                {workspace.head}
              </dd>
              <dt>状態</dt>
              <dd>
                {workspace.phase}
                {workspace.holdUntil ? `・保持期限 ${workspace.holdUntil}` : ""}
              </dd>
            </dl>
            <button
              type="button"
              onClick={() =>
                void call({
                  operation: "get",
                  projectId,
                  queueId,
                  workspaceId: workspace.workspaceId,
                })
              }
            >
              状態・変更一覧を再取得
            </button>
            <label>
              新しい表示名
              <input
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void call({
                  ...common,
                  operation: "rename",
                  name: name || null,
                })
              }
            >
              表示名を変更
            </button>
            <label>
              調査保持期限（ISO日時）
              <input value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={!until}
              onClick={() => void call({ ...common, operation: "hold", until })}
            >
              明示保持
            </button>
            <button
              type="button"
              onClick={() =>
                void call({ ...common, operation: "hold", until: null })
              }
            >
              保持解除
            </button>
            <h3>変更内容を確認</h3>
            <div className="table-scroll">
              <ul>
                {paths.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() =>
                        void call({
                          operation: "inspect",
                          projectId,
                          queueId,
                          workspaceId: workspace.workspaceId,
                          path: p,
                        })
                      }
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {preview ? (
              <>
                <p>
                  {preview.selection.path} —{" "}
                  {preview.selection.blobId ?? "明示削除"}
                </p>
                <pre
                  style={{
                    maxHeight: "24rem",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {preview.patch ||
                    preview.content ||
                    (preview.binary
                      ? "binaryファイル。内容は表示していません。"
                      : "削除又は差分なし")}
                </pre>
                {preview.binary && !c ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={binaryConfirmed}
                      onChange={(e) => setBinaryConfirmed(e.target.checked)}
                    />
                    binaryの内容を別ツールで確認しました
                  </label>
                ) : null}
                <button
                  type="button"
                  disabled={!!c || (preview.binary && !binaryConfirmed)}
                  onClick={() => {
                    setSelection((s) => [
                      ...s.filter((p) => p.path !== preview.selection.path),
                      preview.selection,
                    ]);
                    setPreview(null);
                  }}
                >
                  確認したfile全体を固定対象へ追加
                </button>
              </>
            ) : null}
            <ul>
              {selection.map((s) => (
                <li key={s.path}>
                  {s.path}
                  <button
                    type="button"
                    onClick={() =>
                      setSelection((v) => v.filter((p) => p.path !== s.path))
                    }
                  >
                    選択解除
                  </button>
                </li>
              ))}
            </ul>
            {!c ? (
              <>
                <label>
                  候補名
                  <input
                    maxLength={120}
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                  />
                </label>
                <label>
                  関連CHG ID（カンマ区切り・任意）
                  <input
                    value={relatedChanges}
                    onChange={(e) => setRelatedChanges(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={!selection.length || needsRefresh}
                  onClick={() =>
                    void call({
                      ...common,
                      operation: "freeze",
                      operationId: crypto.randomUUID(),
                      baseCommit: workspace.baseCommit,
                      expectedHead: workspace.head,
                      selection,
                      candidateName: candidateName || null,
                      relatedChangeIds: relatedChanges
                        .split(",")
                        .map((id) => id.trim())
                        .filter(Boolean),
                    })
                  }
                >
                  選択内容を候補として固定
                </button>
              </>
            ) : (
              <>
                <h3>固定候補：{c.name ?? c.operationId}</h3>
                <p>
                  {c.phase} — {c.candidateCommit ?? "固定未完了"}
                </p>
                <ul>
                  {c.selection.map((s) => (
                    <li key={s.path}>
                      {s.path} — {s.blobId ?? "削除"}
                      {c.candidateCommit ? (
                        <button
                          type="button"
                          onClick={() =>
                            void call({
                              operation: "candidate-diff",
                              projectId,
                              queueId,
                              workspaceId: workspace.workspaceId,
                              path: s.path,
                            })
                          }
                        >
                          固定差分を確認
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {c.phase === "freezing" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void call({
                        ...common,
                        operation: "freeze",
                        operationId: c.operationId,
                        baseCommit: c.baseCommit,
                        expectedHead: workspace.head,
                        selection: c.selection,
                        candidateName: c.name,
                        relatedChangeIds: c.relatedChangeIds,
                      })
                    }
                  >
                    同じ候補の固定を再確認
                  </button>
                ) : null}
                <label>
                  取込先Branch
                  <input
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    disabled={c.target !== null}
                  />
                </label>
                <label>
                  確認した取込先HEAD
                  <input
                    value={targetHead}
                    onChange={(e) => setTargetHead(e.target.value)}
                    disabled={c.target !== null}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  対象Commit・取込先又は破棄対象を確認しました
                </label>
                <button
                  type="button"
                  disabled={
                    !confirmed ||
                    !c.candidateCommit ||
                    !["fixed", "merging", "merged"].includes(c.phase)
                  }
                  onClick={() =>
                    c.candidateCommit &&
                    void call({
                      ...common,
                      operation: "adopt",
                      candidateCommit: c.candidateCommit,
                      targetBranch: c.target?.targetBranch ?? targetBranch,
                      expectedTargetHead:
                        c.target?.expectedTargetHead ?? targetHead,
                    })
                  }
                >
                  この固定候補を採用・Merge
                </button>
                <button
                  type="button"
                  disabled={!confirmed || c.phase === "merging"}
                  onClick={() =>
                    void call({
                      ...common,
                      operation: "close-candidate",
                      expectedCommit: c.candidateCommit,
                      disposition:
                        c.disposition ??
                        (c.phase === "merged" ? "adopted" : "rejected"),
                    })
                  }
                >
                  {c.disposition === "adopted"
                    ? "採用済み候補を終了"
                    : "候補を不採用として終了"}
                </button>
              </>
            )}
            <label>
              <input
                type="checkbox"
                checked={discardConfirmed}
                onChange={(e) => setDiscardConfirmed(e.target.checked)}
              />
              作業領域内の未採用変更も破棄することを確認しました
            </label>
            <button
              type="button"
              disabled={!discardConfirmed || !!c}
              onClick={() =>
                void call({
                  ...common,
                  operation: "discard",
                  expectedHead: workspace.head,
                  discardChanges: true,
                })
              }
            >
              この独立作業領域を終了・破棄
            </button>
          </>
        ) : null}
      </fieldset>
    </WorkbenchPanel>
  );
}
