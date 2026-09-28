/**
 * WorkbenchのAI依頼SurfaceとApplication Port。
 *
 * @responsibility 現在Sessionの依頼、状態、事実・共有分析・追加推論の表示を所有し、会話履歴やProvider実行を所有しない。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @boundary Workbench Browserと外部AI実行Application Adapterの境界。
 * @effect 描画はEffect 0。開始・取消は注入されたApplicationへだけ委譲する。
 * @security Promptや結果をRepository、URL、logへ保存せず、秘密値を入力契約へ含めない。
 */
import type { WorkbenchAiProfileSurface } from "./ai-profile-surface.ts";

export type WorkbenchAiRequestMode = "read_only_advice" | "change_candidate";

export type WorkbenchAiRequestCommand = Readonly<{
  mode: WorkbenchAiRequestMode;
  profileId: string;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
}>;

export type WorkbenchAiRequestStartResult = Readonly<{
  status: "accepted" | "blocked";
  requestId: string | null;
  reason: string | null;
}>;

/**
 * AI結果の一項目と、その意味を支える正本参照。
 *
 * @responsibility 結果本文を根拠参照から切り離さずWorkbench表示へ搬送する。
 * @trace ARCH-000015
 * @shape textと一件以上のRepository相対参照を持つ。
 * @invariant 参照のない本文を事実、共有分析または追加推論として扱わない。
 * @boundary 外部AI結果とWorkbench表示Modelの境界。
 * @security 参照は表示用Identityであり、任意Path読取りAuthorityを付与しない。
 * @compatibility 利用側はtextとreferencesだけへ依存する。
 */
export type WorkbenchAiResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

export type WorkbenchAiRequestSnapshot = Readonly<{
  requestId: string;
  mode: WorkbenchAiRequestMode | null;
  profileId: string | null;
  status:
    | "accepted"
    | "running"
    | "completed"
    | "blocked"
    | "cancelled"
    | "unknown";
  reason: string | null;
  facts: readonly WorkbenchAiResultItem[];
  sharedAnalysis: readonly WorkbenchAiResultItem[];
  additionalInferences: readonly WorkbenchAiResultItem[];
  nextOptions: readonly WorkbenchAiResultItem[];
  candidate: Readonly<{
    candidateId: string;
    disposition: "untrusted_not_adopted";
  }> | null;
}>;

export type WorkbenchAiRequestApplication = Readonly<{
  start: (
    request: WorkbenchAiRequestCommand,
  ) => Promise<WorkbenchAiRequestStartResult>;
  observe: (requestId: string) => Promise<WorkbenchAiRequestSnapshot>;
  cancel: (requestId: string) => Promise<WorkbenchAiRequestSnapshot>;
}>;

/**
 * Workbenchへ表示する変更候補の安全な確認投影。
 *
 * @responsibility 候補内容を複製せず、採用判断に必要なIdentity、分類、期限、基準Revision、Hashおよび変更Pathを保持する。
 * @trace ARCH-000015
 * @shape Coordinatorの候補確認Applicationと同じ閉じたPropertyを持つ。
 * @invariant 候補本文、Host Path、秘密値および採用Authorityを含めない。
 * @boundary Coordinator ApplicationとWorkbench View Modelの境界。
 * @security changedPathsは表示情報でありFilesystem Authorityではない。
 * @compatibility Coordinator側の構造型Applicationと一致する。
 */
export type WorkbenchCandidateReview = Readonly<{
  candidateId: string;
  informationClassification: "public" | "internal" | "confidential";
  expiresAtMs: number;
  baseRevision: string;
  candidateHash: string;
  patchHash: string;
  changedPaths: readonly string[];
}>;

/**
 * Workbench変更候補の確認結果。
 *
 * @responsibility 利用可能候補と観測不能を別状態として保持する。
 * @trace ARCH-000015
 * @shape 状態、理由および任意の候補確認投影を持つ。
 * @invariant availableだけがcandidateを持つ。
 * @boundary Coordinator ApplicationとWorkbenchの境界。
 * @security 下位Storeの内部情報を含めない。
 * @compatibility Coordinator側の構造型結果と一致する。
 */
export type WorkbenchCandidateReviewResult = Readonly<{
  status: "available" | "blocked";
  reason: string;
  candidate: WorkbenchCandidateReview | null;
}>;

/**
 * Workbench変更候補の操作結果。
 *
 * @responsibility 採用・破棄の完了、Effect状態、cleanupおよび回復要否を保持する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @shape 操作、状態、理由、候補・Receipt Identity、Effect・Recovery情報を持つ。
 * @invariant blockedを成功へ畳まず、Effect不明を明示する。
 * @boundary Coordinator ApplicationとWorkbenchの境界。
 * @security Capability、Host Path、候補内容または秘密値を含めない。
 * @compatibility Coordinator側の構造型結果と一致する。
 */
export type WorkbenchCandidateActionResult = Readonly<{
  operation: "adopt" | "discard";
  status: "completed" | "blocked";
  reason: string;
  candidateId: string | null;
  receiptId: string | null;
  effectIssued: boolean;
  effectStateUnknown: boolean;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  recoveryIds: readonly string[];
}>;

/**
 * Workbench変更候補Application Port。
 *
 * @responsibility Effect 0の確認、明示採用および確認付き破棄を別操作として公開する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @shape review、adopt、discardの非同期操作を持つ。
 * @invariant confirmedなしで採用または破棄Effectを発行しない。
 * @boundary WorkbenchとCoordinator Applicationの境界。
 * @security Candidate IDをAuthorityとして扱わない。
 * @compatibility Coordinator側の構造型Applicationと一致する。
 */
export type WorkbenchCandidateApplication = Readonly<{
  review: (candidateId: string) => Promise<WorkbenchCandidateReviewResult>;
  adopt: (
    candidateId: string,
    confirmed: boolean,
  ) => Promise<WorkbenchCandidateActionResult>;
  discard: (
    candidateId: string,
    confirmed: boolean,
  ) => Promise<WorkbenchCandidateActionResult>;
}>;

/**
 * Workbench AI依頼Panelを現在Sessionの一件だけから描画する。
 *
 * @responsibility Profile選択、依頼入力、実行状態、結果区分および取消導線を一画面へ投影する。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @input actionToken、Profile Surface、AI Application、現在Snapshot、Candidate Application、候補確認・操作結果およびnotice。
 * @returns Browserへ埋め込むHTML断片。
 * @precondition Profile SurfaceはAI Runtimeの検証済みCatalogを持つ。
 * @postcondition 事実、共有済み分析、追加推論および次の選択肢を別Sectionで表示する。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure Application未接続時は無効状態として表示する。
 * @invariant Provider側会話履歴または過去依頼一覧を生成しない。
 * @boundary AI Request Read ModelとBrowser HTMLの境界。
 * @security 全表示値をescapeし、秘密値・Host Path・Credentialを表示しない。
 * @concurrency Snapshot一件だけを同期描画し、複数依頼の順序を推測しない。
 */
export function renderWorkbenchAiRequest(
  actionToken: string,
  profiles: WorkbenchAiProfileSurface,
  application: WorkbenchAiRequestApplication | undefined,
  snapshot: WorkbenchAiRequestSnapshot | null,
  candidateApplication: WorkbenchCandidateApplication | undefined,
  candidateReview: WorkbenchCandidateReviewResult | null,
  candidateAction: WorkbenchCandidateActionResult | null,
  notice: string | null = null,
): string {
  const options = profiles.catalog.profiles
    .map(
      (profile) =>
        `<option value="${escapeHtml(profile.profileId)}">${escapeHtml(profile.profileId)} — ${escapeHtml(profile.exactModelId)}</option>`,
    )
    .join("");
  const disabled = application === undefined ? " disabled" : "";
  const result =
    snapshot === null
      ? ""
      : renderSnapshot(
          snapshot,
          actionToken,
          candidateApplication,
          candidateReview,
          candidateAction,
        );
  return `<article class="panel wide" id="ai-request"><header><div><p class="eyebrow">AI request</p><h2>AIへ依頼</h2></div><span>${application === undefined ? "Not connected" : "Current session only"}</span></header><p class="scene-summary">選択中のProject Contextと明示した参照を使って外部AIへ依頼します。Workbenchは読取り・助言と変更候補を分け、Provider側の会話履歴を複製せず、事実・共有済み分析・追加推論を区別します。</p><form class="ai-request-form" method="post" action="/ai-request/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="start"><label>依頼種別<select name="mode" required${disabled}><option value="read_only_advice">状況確認・助言（読取りのみ）</option><option value="change_candidate">変更候補（自動採用なし）</option></select></label><label>Profile<select name="profileId" required${disabled}>${options}</select></label><label>依頼<textarea name="prompt" rows="5" maxlength="16000" required${disabled}></textarea></label><label>変更を許可するPath（変更候補時のみ必須、1行1Path）<textarea name="allowedPaths" rows="3" maxlength="8192" placeholder="40_Develop/workbench/src"${disabled}></textarea></label><label class="confirm"><input type="checkbox" name="externalSendConfirmed" value="yes" required${disabled}><span>この依頼と依頼種別に応じた許可済みContextを選択した外部AIへ一回送信する</span></label><button type="submit"${disabled}>依頼を開始</button></form>${notice === null ? "" : `<p class="operation-result">${escapeHtml(notice)}</p>`}${application === undefined ? '<p class="empty-state">AI実行Applicationが未接続です。Profile一覧が表示されても実行可能を意味しません。</p>' : ""}${result}</article>`;
}

/**
 * AI依頼Snapshotを意味区分を保った結果表示へ変換する。
 *
 * @responsibility 現在状態と四つの結果区分を反復説明なしで表示する。
 * @trace ARCH-000015
 * @input snapshot: 現在SessionのAI依頼Snapshot、actionToken: 取消操作Token。
 * @returns 状態と結果のHTML断片。
 * @precondition snapshotは注入Applicationから取得した閉じた結果である。
 * @postcondition completed以外も成功へ畳まず、取消可能状態だけ取消操作を示す。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure unknownとblockedを空結果へ変換しない。
 * @invariant 追加推論を事実または共有済み分析へ移さない。
 * @boundary AI Application ResultとBrowser表示の境界。
 * @security 結果Textを全てescapeする。
 * @concurrency Snapshotに記録された一時点だけを表示する。
 */
function renderSnapshot(
  snapshot: WorkbenchAiRequestSnapshot,
  actionToken: string,
  candidateApplication: WorkbenchCandidateApplication | undefined,
  candidateReview: WorkbenchCandidateReviewResult | null,
  candidateAction: WorkbenchCandidateActionResult | null,
): string {
  const section = (title: string, values: readonly WorkbenchAiResultItem[]) =>
    `<section><h3>${title}</h3>${values.length === 0 ? '<p class="empty-state">なし</p>' : `<ul>${values.map((value) => `<li>${escapeHtml(value.text)}<small>根拠: ${value.references.map(escapeHtml).join(" / ")}</small></li>`).join("")}</ul>`}</section>`;
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
      ? ""
      : renderCandidate(
          snapshot.candidate.candidateId,
          actionToken,
          candidateApplication,
          candidateReview,
          candidateAction,
        );
  return `<div class="ai-request-result"><p class="operation-result"><strong>${escapeHtml(snapshot.status)}</strong> — ${escapeHtml(modeLabel)}${snapshot.reason === null ? "" : ` — ${escapeHtml(snapshot.reason)}`}</p>${candidate}${section("確認できた事実", snapshot.facts)}${section("共有済み分析", snapshot.sharedAnalysis)}${section("追加推論", snapshot.additionalInferences)}${section("次の選択肢", snapshot.nextOptions)}${cancellable ? `<form method="post" action="/ai-request/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="cancel"><input type="hidden" name="requestId" value="${escapeHtml(snapshot.requestId)}"><button type="submit">取消</button></form>` : ""}</div>`;
}

/**
 * 未採用Candidateの確認情報と独立した採用・破棄操作を描画する。
 *
 * @responsibility 候補Identity、変更Path、基準Revision、期限、操作確認および直近結果を一つのPanelへ表示する。
 * @trace ARCH-000015
 * @trace ARCH-000004
 * @input candidateId、actionToken、Application有無、確認結果、直近操作結果。
 * @returns HTML断片を返す。
 * @precondition 表示値はApplicationの閉じた結果である。
 * @postcondition 採用と破棄を別Formにし、それぞれ明示Checkboxを要求する。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure 候補未観測またはApplication未接続を完了表示へ畳まない。
 * @invariant 外部送信確認を候補操作確認として再利用しない。
 * @boundary Candidate Application結果とBrowser HTMLの境界。
 * @security 全表示値をescapeし、Candidate IDだけで操作を自動発行しない。
 * @concurrency 現在Snapshotの一Candidateだけを表示する。
 */
function renderCandidate(
  candidateId: string,
  actionToken: string,
  candidateApplication: WorkbenchCandidateApplication | undefined,
  review: WorkbenchCandidateReviewResult | null,
  action: WorkbenchCandidateActionResult | null,
): string {
  const current =
    review?.status === "available" &&
    review.candidate?.candidateId === candidateId
      ? review.candidate
      : null;
  const details =
    current === null
      ? `<p class="empty-state">${candidateApplication === undefined ? "候補確認Applicationが未接続です。" : `候補を確認できません: ${escapeHtml(review?.reason ?? "not_observed")}`}</p>`
      : `<dl class="candidate-metadata"><div><dt>Classification</dt><dd>${escapeHtml(current.informationClassification)}</dd></div><div><dt>Base revision</dt><dd><code>${escapeHtml(current.baseRevision)}</code></dd></div><div><dt>Candidate hash</dt><dd><code>${escapeHtml(current.candidateHash)}</code></dd></div><div><dt>Patch hash</dt><dd><code>${escapeHtml(current.patchHash)}</code></dd></div><div><dt>Expires</dt><dd>${escapeHtml(new Date(current.expiresAtMs).toISOString())}</dd></div></dl><h4>変更対象</h4><ul>${current.changedPaths.map((value) => `<li><code>${escapeHtml(value)}</code></li>`).join("")}</ul>`;
  const operationResult =
    action === null || action.candidateId !== candidateId
      ? ""
      : `<p class="operation-result"><strong>${escapeHtml(action.operation)}: ${escapeHtml(action.status)}</strong> — ${escapeHtml(action.reason)}${action.receiptId === null ? "" : ` — Receipt: ${escapeHtml(action.receiptId)}`}${action.effectStateUnknown ? " — Effect状態は未確認" : ""}${action.manualRecoveryRequired ? " — 手動回復が必要" : ""}</p>`;
  const operations =
    current === null
      ? ""
      : `<div class="candidate-actions"><form method="post" action="/candidate/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="adopt"><input type="hidden" name="candidateId" value="${escapeHtml(candidateId)}"><label class="confirm"><input type="checkbox" name="confirmed" value="true" required><span>表示した候補ID・基準Revision・変更Pathを確認し、Canonical Repositoryへ採用する</span></label><button type="submit">候補を採用</button></form><form method="post" action="/candidate/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="discard"><input type="hidden" name="candidateId" value="${escapeHtml(candidateId)}"><label class="confirm"><input type="checkbox" name="confirmed" value="true" required><span>この未採用候補を破棄する</span></label><button type="submit">候補を破棄</button></form><form method="post" action="/candidate/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="defer"><input type="hidden" name="candidateId" value="${escapeHtml(candidateId)}"><button type="submit">今回は保留</button></form></div>`;
  return `<section><h3>変更候補</h3><p><code>${escapeHtml(candidateId)}</code></p><p>未信頼・未採用です。確認、採用、破棄は候補生成とは別操作です。採用してもCommitやPushは行いません。</p>${details}${operationResult}${operations}</section>`;
}

/**
 * AI依頼表示TextをHTMLとして安全に符号化する。
 *
 * @responsibility 外部AI由来TextをMarkupとして解釈させない。
 * @trace ARCH-000015
 * @input value: 表示文字列。
 * @returns HTML特殊文字を符号化した文字列。
 * @precondition valueを信頼済みHTMLと仮定しない。
 * @postcondition ampersand、angle bracket、quoteを生で残さない。
 * @effect N/A: 文字列変換だけを行う。
 * @failure N/A: 全文字列を決定論的に変換する。
 * @invariant 表示文字の順序を変えない。
 * @boundary 外部AI結果とWorkbench DOMの境界。
 * @security Script、Element、Attribute注入を防ぐ。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
