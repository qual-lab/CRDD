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
import { createElement, type ReactElement, type ReactNode } from "react";

import type { WorkbenchAiProfileSurface } from "../src/ai-profile-surface.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchAiResultItem,
  WorkbenchCandidateActionResult,
  WorkbenchCandidateReviewResult,
} from "../src/ai-request.ts";
import {
  ActionTokenInput,
  EmptyState,
  WorkbenchPanel,
} from "../src/presentation/workbench-components.ts";

/**
 * Workbench AI依頼Panelを現在Sessionの一件だけから描画する。
 *
 * @responsibility Profile選択、依頼入力、実行状態、結果区分および取消導線を一画面へ投影する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @input actionToken、Profile Surface、AI Application、現在Snapshot、Candidate Application、候補確認・操作結果およびnotice。
 * @returns Browserが描画するReact要素。
 * @precondition Profile SurfaceはAI Runtimeの検証済みCatalogを持つ。
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
  profiles: WorkbenchAiProfileSurface,
  applicationConfigured: boolean,
  snapshot: WorkbenchAiRequestSnapshot | null,
  candidateApplicationConfigured: boolean,
  candidateReview: WorkbenchCandidateReviewResult | null,
  candidateAction: WorkbenchCandidateActionResult | null,
  notice: string | null = null,
): ReactElement {
  const disabled = !applicationConfigured;
  const result =
    snapshot === null
      ? null
      : renderSnapshot(
          snapshot,
          actionToken,
          candidateApplicationConfigured,
          candidateReview,
          candidateAction,
        );
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
            { value: "change_candidate" },
            "変更候補（自動採用なし）",
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
          ...profiles.catalog.profiles.map((profile) =>
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
        "変更を許可するPath（変更候補時のみ必須、1行1Path）",
        createElement("textarea", {
          name: "allowedPaths",
          rows: 3,
          maxLength: 8192,
          placeholder: "40_Develop/workbench/src",
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
  candidateApplicationConfigured: boolean,
  candidateReview: WorkbenchCandidateReviewResult | null,
  candidateAction: WorkbenchCandidateActionResult | null,
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
      : snapshot.mode === "change_candidate"
        ? "変更候補（自動採用なし）"
        : "依頼種別は判定不能";
  const candidate =
    snapshot.candidate === null
      ? null
      : renderCandidate(
          snapshot.candidate.candidateId,
          actionToken,
          candidateApplicationConfigured,
          candidateReview,
          candidateAction,
        );
  return createElement(
    "div",
    { className: "ai-request-result" },
    createElement(
      "p",
      { className: "operation-result" },
      createElement("strong", null, snapshot.status),
      ` — ${modeLabel}${snapshot.reason === null ? "" : ` — ${snapshot.reason}`}`,
    ),
    candidate,
    section("確認できた事実", snapshot.facts),
    section("共有済み分析", snapshot.sharedAnalysis),
    section("追加推論", snapshot.additionalInferences),
    section("次の選択肢", snapshot.nextOptions),
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

/**
 * 未採用Candidateの確認情報と独立した採用・破棄操作を描画する。
 *
 * @responsibility 候補Identity、変更Path、基準Revision、期限、操作確認および直近結果を一つのPanelへ表示する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @input candidateId、actionToken、Application有無、確認結果、直近操作結果。
 * @returns React要素を返す。
 * @precondition 表示値はApplicationの閉じた結果である。
 * @postcondition 採用と破棄を別Formにし、それぞれ明示Checkboxを要求する。
 * @effect N/A: React要素の構築だけを行う。
 * @failure 候補未観測またはApplication未接続を完了表示へ畳まない。
 * @invariant 外部送信確認を候補操作確認として再利用しない。
 * @boundary Candidate Application結果とBrowser React表示の境界。
 * @security ReactのText escapingを使用し、Candidate IDだけで操作を自動発行しない。
 * @concurrency 現在Snapshotの一Candidateだけを表示する。
 */
function renderCandidate(
  candidateId: string,
  actionToken: string,
  candidateApplicationConfigured: boolean,
  review: WorkbenchCandidateReviewResult | null,
  action: WorkbenchCandidateActionResult | null,
): ReactElement {
  const current =
    review?.status === "available" &&
    review.candidate?.candidateId === candidateId
      ? review.candidate
      : null;
  const details: ReactNode =
    current === null
      ? createElement(
          EmptyState,
          null,
          !candidateApplicationConfigured
            ? "候補確認Applicationが未接続です。"
            : `候補を確認できません: ${review?.reason ?? "not_observed"}`,
        )
      : createElement(
          "div",
          null,
          createElement(
            "dl",
            { className: "candidate-metadata" },
            ...[
              ["Classification", current.informationClassification],
              ["Base revision", current.baseRevision],
              ["Candidate hash", current.candidateHash],
              ["Patch hash", current.patchHash],
              ["Expires", new Date(current.expiresAtMs).toISOString()],
            ].map(([label, value]) =>
              createElement(
                "div",
                { key: label },
                createElement("dt", null, label),
                createElement(
                  "dd",
                  null,
                  label === "Classification" || label === "Expires"
                    ? value
                    : createElement("code", null, value),
                ),
              ),
            ),
          ),
          createElement("h4", null, "変更対象"),
          createElement(
            "ul",
            null,
            ...current.changedPaths.map((value) =>
              createElement(
                "li",
                { key: value },
                createElement("code", null, value),
              ),
            ),
          ),
        );
  const operationResult =
    action === null || action.candidateId !== candidateId
      ? null
      : createElement(
          "p",
          { className: "operation-result" },
          createElement(
            "strong",
            null,
            `${action.operation}: ${action.status}`,
          ),
          ` — ${action.reason}${action.receiptId === null ? "" : ` — Receipt: ${action.receiptId}`}${action.effectStateUnknown ? " — Effect状態は未確認" : ""}${action.manualRecoveryRequired ? " — 手動回復が必要" : ""}`,
        );
  const operations =
    current === null
      ? null
      : createElement(
          "div",
          { className: "candidate-actions" },
          ...[
            [
              "adopt",
              "表示した候補ID・基準Revision・変更Pathを確認し、Canonical Repositoryへ採用する",
              "候補を採用",
            ],
            ["discard", "この未採用候補を破棄する", "候補を破棄"],
          ].map(([operation, confirmation, label]) =>
            createElement(
              "form",
              { key: operation, method: "post", action: "/candidate/action" },
              createElement(ActionTokenInput, { value: actionToken }),
              createElement("input", {
                type: "hidden",
                name: "operation",
                value: operation,
              }),
              createElement("input", {
                type: "hidden",
                name: "candidateId",
                value: candidateId,
              }),
              createElement(
                "label",
                { className: "confirm" },
                createElement("input", {
                  type: "checkbox",
                  name: "confirmed",
                  value: "true",
                  required: true,
                }),
                createElement("span", null, confirmation),
              ),
              createElement("button", { type: "submit" }, label),
            ),
          ),
          createElement(
            "form",
            { method: "post", action: "/candidate/action" },
            createElement(ActionTokenInput, { value: actionToken }),
            createElement("input", {
              type: "hidden",
              name: "operation",
              value: "defer",
            }),
            createElement("input", {
              type: "hidden",
              name: "candidateId",
              value: candidateId,
            }),
            createElement("button", { type: "submit" }, "今回は保留"),
          ),
        );
  return createElement(
    "section",
    null,
    createElement("h3", null, "変更候補"),
    createElement("p", null, createElement("code", null, candidateId)),
    createElement(
      "p",
      null,
      "未信頼・未採用です。確認、採用、破棄は候補生成とは別操作です。採用してもCommitやPushは行いません。",
    ),
    details,
    operationResult,
    operations,
  );
}
