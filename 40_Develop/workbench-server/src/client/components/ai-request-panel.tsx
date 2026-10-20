/**
 * CROS WorkbenchのAI依頼Browser Panel。
 *
 * @packageDocumentation
 * @responsibility 検証済みAI依頼Read ModelをBrowser React要素へ変換する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @boundary AI Request Read ModelとBrowser DOMの境界。
 * @effect Form送信以外の外部Effectを発行しない。
 * @security ReactのText escapingを使用し、秘密値・Host Path・Credentialを表示しない。
 */
import { createElement, type ReactElement } from "react";

import type { WorkbenchAiProfileSurface } from "../../server/ai-profile/projection.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchAiResultItem,
} from "../../server/ai-request/types.ts";
import { ActionTokenInput, EmptyState, WorkbenchPanel } from "./elements.ts";

/**
 * Workbench AI依頼Panelを現在Sessionの一件だけから描画する。
 *
 * @responsibility Profile選択、依頼入力、実行状態、結果区分および取消導線を一画面へ投影する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @input actionToken、Profile Surface、AI Application、現在Snapshot、Candidate Application、候補確認・操作結果およびnotice。
 * @returns Browserが描画するReact要素。
 * @precondition 取得済みProfile SurfaceはAI Runtimeの検証済みCatalogを持つ。nullは今回Ownerからの未取得である。
 * @postcondition 事実、共有済み分析、追加推論および次の選択肢を別Sectionで表示する。
 * @effect N/A: React要素の構築だけを行う。
 * @failure Application未接続時は無効状態として表示する。
 * @invariant Provider側会話履歴または過去依頼一覧を生成しない。
 * @boundary AI Request Read ModelとBrowser React表示の境界。
 * @security ReactのText escapingを使用し、秘密値・Host Path・Credentialを表示しない。
 * @concurrency Snapshot一件だけを同期描画し、複数依頼の順序を推測しない。
 */
export function renderWorkbenchAiRequest(
  actionToken: string,
  profiles: WorkbenchAiProfileSurface | null,
  applicationConfigured: boolean,
  snapshot: WorkbenchAiRequestSnapshot | null,
  notice: string | null = null,
): ReactElement {
  const disabled = !applicationConfigured || profiles === null;
  const result =
    snapshot === null ? null : renderSnapshot(snapshot, actionToken);
  return createElement(
    WorkbenchPanel,
    {
      id: "ai-request",
      eyebrow: "AI request",
      title: "AIへ依頼",
      status: applicationConfigured ? "Current session only" : "Not connected",
    },
    createElement(
      "p",
      { className: "scene-summary" },
      "選択中のProject Contextと明示した参照を使って外部AIへ依頼します。Workbenchは読取り・助言と変更候補を分け、Provider側の会話履歴を複製せず、事実・共有済み分析・追加推論を区別します。",
    ),
    createElement(
      "form",
      {
        className: "ai-request-form",
        method: "post",
        action: "/ai-request/action",
      },
      createElement(ActionTokenInput, { value: actionToken }),
      createElement("input", {
        type: "hidden",
        name: "operation",
        value: "start",
      }),
      createElement(
        "label",
        null,
        "依頼種別",
        createElement(
          "select",
          { name: "mode", required: true, disabled },
          createElement(
            "option",
            { value: "read_only_advice" },
            "状況確認・助言（読取りのみ）",
          ),
          createElement(
            "option",
            { value: "workspace_edit" },
            "Workspace編集（自動Commit・採用なし）",
          ),
        ),
      ),
      createElement(
        "label",
        null,
        "Profile",
        createElement(
          "select",
          { name: "profileId", required: true, disabled },
          ...(profiles?.catalog.profiles ?? []).map((profile) =>
            createElement(
              "option",
              { key: profile.profileId, value: profile.profileId },
              `${profile.profileId} — ${profile.exactModelId}`,
            ),
          ),
        ),
      ),
      createElement(
        "label",
        null,
        "編集先Workspace ID（空欄はDirect。助言は空欄）",
        createElement("input", { name: "workspaceId", disabled }),
      ),
      createElement(
        "p",
        null,
        "Directは現在のWorking Treeを編集します。同じFileの同時編集に注意してください。失敗・取消でも自動で巻き戻しません。Candidate固定・採用はWorkspace管理の別操作です。",
      ),
      createElement(
        "label",
        null,
        "依頼",
        createElement("textarea", {
          name: "prompt",
          rows: 5,
          maxLength: 16000,
          required: true,
          disabled,
        }),
      ),
      createElement(
        "label",
        null,
        "変更対象Path（Workspace編集時のみ必須、1行1Path）",
        createElement("textarea", {
          name: "allowedPaths",
          rows: 3,
          maxLength: 8192,
          placeholder: "40_Develop/workbench-server/src",
          disabled,
        }),
      ),
      createElement(
        "label",
        { className: "confirm" },
        createElement("input", {
          type: "checkbox",
          name: "externalSendConfirmed",
          value: "yes",
          required: true,
          disabled,
        }),
        createElement(
          "span",
          null,
          "この依頼と依頼種別に応じた許可済みContextを選択した外部AIへ一回送信する",
        ),
      ),
      createElement("button", { type: "submit", disabled }, "依頼を開始"),
    ),
    createElement(
      "form",
      {
        className: "ai-request-form",
        method: "post",
        action: "/ai-request/action",
      },
      createElement(ActionTokenInput, { value: actionToken }),
      createElement(
        "p",
        null,
        "再起動前の依頼は元の依頼IDで確認できます。本文は復元・再送しません。",
      ),
      createElement(
        "label",
        null,
        "元の依頼ID",
        createElement("input", { name: "requestId", required: true, disabled }),
      ),
      createElement(
        "label",
        null,
        "操作",
        createElement(
          "select",
          { name: "operation", disabled },
          createElement("option", { value: "observe" }, "状態を確認"),
          createElement(
            "option",
            { value: "cancel" },
            "取消・残存資源の回収を確認",
          ),
        ),
      ),
      createElement("button", { type: "submit", disabled }, "元の依頼を確認"),
    ),
    notice === null
      ? null
      : createElement("p", { className: "operation-result" }, notice),
    !applicationConfigured
      ? createElement(
          EmptyState,
          null,
          "AI実行Applicationが未接続です。Profile一覧が表示されても実行可能を意味しません。",
        )
      : null,
    result,
  );
}

/**
 * AI依頼Snapshotを意味区分を保った結果表示へ変換する。
 *
 * @responsibility 現在状態と四つの結果区分を反復説明なしで表示する。
 * @trace ARCH-000015
 * @input snapshot: 現在SessionのAI依頼Snapshot、actionToken: 取消操作Token。
 * @returns 状態と結果のReact要素。
 * @precondition snapshotは注入Applicationから取得した閉じた結果である。
 * @postcondition completed以外も成功へ畳まず、取消可能状態だけ取消操作を示す。
 * @effect N/A: React要素の構築だけを行う。
 * @failure unknownとblockedを空結果へ変換しない。
 * @invariant 追加推論を事実または共有済み分析へ移さない。
 * @boundary AI Application ResultとBrowser表示の境界。
 * @security 結果TextはReactのText escapingを使用する。
 * @concurrency Snapshotに記録された一時点だけを表示する。
 */
function renderSnapshot(
  snapshot: WorkbenchAiRequestSnapshot,
  actionToken: string,
): ReactElement {
  const section = (
    title: string,
    values: readonly WorkbenchAiResultItem[],
  ): ReactElement =>
    createElement(
      "section",
      { key: title },
      createElement("h3", null, title),
      values.length === 0
        ? createElement(EmptyState, null, "なし")
        : createElement(
            "ul",
            null,
            ...values.map((value, index) =>
              createElement(
                "li",
                { key: `${title}-${index}` },
                value.text,
                createElement(
                  "small",
                  null,
                  `根拠: ${value.references.join(" / ")}`,
                ),
              ),
            ),
          ),
    );
  const cancellable =
    snapshot.status === "accepted" || snapshot.status === "running";
  const modeLabel =
    snapshot.mode === "read_only_advice"
      ? "状況確認・助言（読取りのみ）"
      : snapshot.mode === "workspace_edit"
        ? "Workspace編集（自動Commit・採用なし）"
        : "依頼種別は判定不能";
  return createElement(
    "div",
    { className: "ai-request-result" },
    createElement(
      "p",
      { className: "operation-result" },
      createElement("strong", null, snapshot.status),
      ` — ${modeLabel}${snapshot.reason === null ? "" : ` — ${snapshot.reason}`}`,
    ),
    ...(snapshot.mode === "read_only_advice"
      ? [
          section("確認できた事実", snapshot.facts),
          section("共有済み分析", snapshot.sharedAnalysis),
          section("追加推論", snapshot.additionalInferences),
          section("次の選択肢", snapshot.nextOptions),
        ]
      : [
          createElement(
            "p",
            { key: "workspace-observation" },
            snapshot.workspaceResult
              ? `${snapshot.workspaceResult.workspaceId === null ? "Direct" : "Isolated Workspace"}: ${snapshot.workspaceResult.changedPaths === null ? "変更範囲は未観測" : snapshot.workspaceResult.changedPaths.length === 0 ? "変更なし" : `変更あり — ${snapshot.workspaceResult.changedPaths.join(" / ")}`}。変更の帰属は未判定、自動Commit・採用なし。`
              : "作業領域の変更結果は未観測です。",
          ),
        ]),
    snapshot.cleanupConfirmed === undefined
      ? null
      : createElement(
          "p",
          null,
          snapshot.cleanupConfirmed
            ? "実行資源の回収確認済み"
            : "実行資源の回収は未確認",
        ),
    ...(snapshot.secondaryFailures ?? []).map((reason) =>
      createElement("p", { key: reason }, `終了処理の問題: ${reason}`),
    ),
    cancellable
      ? createElement(
          "form",
          { method: "post", action: "/ai-request/action" },
          createElement(ActionTokenInput, { value: actionToken }),
          createElement("input", {
            type: "hidden",
            name: "operation",
            value: "cancel",
          }),
          createElement("input", {
            type: "hidden",
            name: "requestId",
            value: snapshot.requestId,
          }),
          createElement("button", { type: "submit" }, "取消"),
        )
      : null,
  );
}
