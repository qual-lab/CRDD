/**
 * WorkbenchのAI Profile一覧Surface。
 *
 * @responsibility 設定済みProfileと利用可能性の四軸を、会話履歴や実行Authorityを所有せず表示する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @boundary AI Runtime Profile CatalogとWorkbench Browser表示の境界。
 * @effect N/A: 検証済みCatalogと観測値をHTMLへ投影するだけである。
 * @security Credential、Provider Home、Host Pathを表示しない。
 */
import {
  DEFAULT_AI_PROFILE_CATALOG,
  evaluateAiProfileAvailability,
  type AiProfileAvailabilityObservation,
  type AiProfileCatalog,
  type AiProfileCatalogMutationResult,
  type AiProfileCatalogSnapshot,
} from "../../ai-runtime/src/index.ts";

export type WorkbenchAiProfileObservation = Readonly<{
  profileId: string;
  availability: AiProfileAvailabilityObservation;
}>;

export type WorkbenchAiProfileSurface = Readonly<{
  catalog: AiProfileCatalog;
  observations: readonly WorkbenchAiProfileObservation[];
}>;

/**
 * 既定Catalogを未観測の実行状態から分離したWorkbench初期Surfaceとして返す。
 *
 * @responsibility Repository単体起動でも構成済みProfileを示し、Host・認証・Authorityを推測しない。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input N/A: 既定Catalogだけを使用する。
 * @returns Profileごとの四軸をunknownで保持したSurface。
 * @precondition 実行環境観測をまだ行っていない。
 * @postcondition Adapter登録だけをtrueとし、他の軸をnullで返す。
 * @effect N/A: 不変な既定Catalogから値を構築する。
 * @failure N/A: 既定CatalogはBuild時に検証される。
 * @invariant 未観測を利用可能または利用不可へ畳まない。
 * @boundary Workbench初期化とAI Runtime既定Catalogの境界。
 * @security 認証情報を読取らず、認証済みと推測しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function createDefaultWorkbenchAiProfileSurface(): WorkbenchAiProfileSurface {
  return createWorkbenchAiProfileSurface(DEFAULT_AI_PROFILE_CATALOG);
}

/**
 * 検証済みCatalogを未観測の実行状態から分離したSurfaceへ変換する。
 *
 * @responsibility Owner別の採用済みCatalogを表示可能にし、実行環境の可用性を推測しない。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input catalog: AI Runtime Storeまたは既定値から得た検証済みCatalog。
 * @returns Profileごとの四軸をunknownで保持したSurface。
 * @precondition catalogはAI Runtimeの閉じたSchema検証を通過している。
 * @postcondition Adapter登録だけをtrueとし、他の軸をnullで返す。
 * @effect N/A: Catalogから不変表示値を構築するだけである。
 * @failure N/A: 未検証Candidateを本関数へ渡さない。
 * @invariant 採用済み設定を実行Authorityへ変換しない。
 * @boundary AI Runtime Catalog SnapshotとWorkbench表示Modelの境界。
 * @security Credential、Provider HomeおよびHost Pathを追加しない。
 * @concurrency N/A: 一つの不変Snapshotだけを同期変換する。
 */
export function createWorkbenchAiProfileSurface(
  catalog: AiProfileCatalog,
): WorkbenchAiProfileSurface {
  return Object.freeze({
    catalog,
    observations: Object.freeze(
      catalog.profiles.map((profile) =>
        Object.freeze({
          profileId: profile.profileId,
          availability: Object.freeze({
            adapterRegistered: true,
            hostAvailable: null,
            authenticated: null,
            executionAuthorized: null,
          }),
        }),
      ),
    ),
  });
}

/**
 * AI Profile一覧を安全なHTMLへ投影する。
 *
 * @responsibility Profile、Adapter、Model、既定推論強度、利用可能性を一行ずつ表示する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input surface: Profile CatalogとProfile別の観測値。
 * @returns Workbench PanelのHTML断片。
 * @precondition catalogはAI Runtimeで検証済みである。
 * @postcondition 設定済みと利用可能を別の列で表示する。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure 観測がないProfileをunknownとして表示する。
 * @invariant 未観測値をavailableへ変換しない。
 * @boundary AI Profile Read ModelとBrowser HTMLの境界。
 * @security 全表示値をescapeし、秘密値を入力として受け取らない。
 * @concurrency N/A: 固定Snapshotを同期描画する。
 */
export function renderWorkbenchAiProfiles(
  surface: WorkbenchAiProfileSurface,
): string {
  const observations = new Map(
    surface.observations.map((item) => [item.profileId, item.availability]),
  );
  const adapters = new Map(
    surface.catalog.adapters.map((adapter) => [adapter.adapterId, adapter]),
  );
  const rows = surface.catalog.profiles
    .map((profile) => {
      const adapter = adapters.get(profile.adapterId);
      const availability = evaluateAiProfileAvailability(
        observations.get(profile.profileId) ?? {
          adapterRegistered: adapter !== undefined,
          hostAvailable: null,
          authenticated: null,
          executionAuthorized: null,
        },
      );
      return `<tr><td><code>${escapeHtml(profile.profileId)}</code></td><td>${escapeHtml(profile.adapterId)}</td><td>${escapeHtml(profile.exactModelId)}</td><td>${escapeHtml(profile.defaultReasoningEffort)}</td><td>${escapeHtml(availability.status)}</td><td>${escapeHtml(formatAvailabilityAxes(availability))}</td></tr>`;
    })
    .join("");
  return `<article class="panel wide" id="ai-profiles"><header><div><p class="eyebrow">AI configuration</p><h2>AI Profiles</h2></div><span>${surface.catalog.profiles.length} configured</span></header><p class="scene-summary">Profile設定と、Host・認証・実行Authorityの現在観測を分けて表示します。Configuredは実行可能を意味しません。</p><div class="table-scroll"><table><thead><tr><th>Profile</th><th>Adapter</th><th>Model</th><th>Reasoning</th><th>Availability</th><th>Axes</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

/**
 * Owner別AI Profile限定管理入口をHTMLへ投影する。
 *
 * @responsibility 登録済みAdapter／Modelだけを使う作成・更新と、Profile単位の確認付き削除を表示する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input snapshot: Owner別Catalog、ownerLabel: 表示Owner、actionToken: 起動単位Token、lastResult: 直前結果。
 * @returns Profile管理PanelのHTML断片。管理Snapshot未接続時は空文字列。
 * @precondition snapshotはRepositoryまたはCROSの一方のOwnerだけから取得される。
 * @postcondition CandidateにAdapter定義、Credential、Pathまたは任意実行引数を入力できない。
 * @effect N/A: HTML文字列の構築だけを行う。
 * @failure 管理Snapshot未接続時は管理入口を表示しない。
 * @invariant 作成・更新は現在Revisionを送り、削除は明示確認を要求する。
 * @boundary AI Profile管理ApplicationとWorkbench Browserの境界。
 * @security 全表示値をescapeし、秘密値を扱う入力欄を設けない。
 * @concurrency 表示時SnapshotのRevisionを操作ごとに送る。
 */
export function renderWorkbenchAiProfileAdministration(
  snapshot: AiProfileCatalogSnapshot | undefined,
  ownerLabel: "Repository" | "CROS",
  actionToken: string,
  lastResult: AiProfileCatalogMutationResult | null,
): string {
  if (snapshot === undefined) return "";
  const adapterModels = snapshot.catalog.adapters.flatMap((adapter) =>
    adapter.allowedModelIds.map((modelId) => ({
      value: `${adapter.adapterId}|${modelId}`,
      label: `${adapter.adapterId} / ${modelId}`,
    })),
  );
  const efforts = [
    ...new Set(
      snapshot.catalog.adapters.flatMap(
        (adapter) => adapter.allowedReasoningEfforts,
      ),
    ),
  ];
  const notice =
    lastResult === null
      ? ""
      : `<p class="operation-result"><strong>${escapeHtml(lastResult.status)}</strong> — ${escapeHtml(lastResult.reason)} / revision ${lastResult.snapshot.revision}</p>`;
  const deleteRows = snapshot.catalog.profiles
    .map(
      (profile) =>
        `<tr><td><code>${escapeHtml(profile.profileId)}</code></td><td>${escapeHtml(profile.adapterId)} / ${escapeHtml(profile.exactModelId)}</td><td><form method="post" action="/ai-profiles/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="delete"><input type="hidden" name="expectedRevision" value="${snapshot.revision}"><input type="hidden" name="profileId" value="${escapeHtml(profile.profileId)}"><label class="confirm"><input type="checkbox" name="confirmed" value="true" required>このProfileだけを削除する</label><button type="submit">削除</button></form></td></tr>`,
    )
    .join("");
  return `<article class="panel wide" id="ai-profile-administration"><header><div><p class="eyebrow">${escapeHtml(ownerLabel)} configuration</p><h2>AI Profile管理</h2></div><span>revision ${snapshot.revision}</span></header><p class="scene-summary">${escapeHtml(ownerLabel)} OwnerのProfileだけを管理します。登録済みAdapterと許可Modelの組だけで作成・更新し、認証情報、実行Path、任意引数およびAdapter自体は管理しません。</p>${notice}<form class="ai-profile-administration-form" method="post" action="/ai-profiles/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="expectedRevision" value="${snapshot.revision}"><label>操作<select name="operation" required><option value="create">新規作成</option><option value="update">既存を更新</option></select></label><label>Profile ID<input name="profileId" pattern="PROFILE-[0-9]{6,}" placeholder="PROFILE-300001" required></label><label>Adapter / Model<select name="adapterModel" required>${adapterModels.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}</select></label><label>Family<input name="family" pattern="[a-z][a-z0-9._-]{1,63}" placeholder="astra" required></label><fieldset><legend>利用Role</legend>${checkboxes("selectionRole", ["coordinator", "executor", "independent_reviewer", "result_integration"])}</fieldset><fieldset><legend>Model Tier</legend>${checkboxes("modelTier", ["preferred", "upper_allowed"])}</fieldset><label>既定Reasoning<select name="defaultReasoningEffort" required>${efforts.map((effort) => `<option value="${escapeHtml(effort)}">${escapeHtml(effort)}</option>`).join("")}</select></label><label>互換理由（不要なら空欄）<input name="compatibilityReason"></label><button type="submit">Catalog候補を検証して保存</button></form><div class="table-scroll"><table><thead><tr><th>Profile</th><th>Adapter / Model</th><th>確認付き削除</th></tr></thead><tbody>${deleteRows}</tbody></table></div></article>`;
}

/**
 * 閉じた選択肢集合を同名Checkboxへ変換する。
 *
 * @responsibility RoleとTierの複数選択を固定値だけで表現する。
 * @trace ARCH-000012
 * @input name: Form項目名、values: 固定選択肢。
 * @returns Checkbox Label列のHTML。
 * @precondition nameとvaluesは実装内の固定値である。
 * @postcondition 各値を同名Form Entryとして送信できる。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: 空配列も空文字列へ変換する。
 * @invariant 任意の外部値を選択肢へ追加しない。
 * @boundary 固定Profile語彙とBrowser Formの境界。
 * @security 全文字列をescapeする。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function checkboxes(name: string, values: readonly string[]): string {
  return values
    .map(
      (value) =>
        `<label class="confirm"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}">${escapeHtml(value)}</label>`,
    )
    .join("");
}

/**
 * 四つの利用可能性軸を短い表示Textへ変換する。
 *
 * @responsibility true、false、未観測を軸ごとに保持する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input availability: 評価済み利用可能性。
 * @returns 四軸の固定順Text。
 * @precondition nullをunknownとして扱う。
 * @postcondition 全軸を省略せず表示する。
 * @effect N/A: 文字列変換だけを行う。
 * @failure N/A: 閉じた値集合を処理する。
 * @invariant statusだけから各軸を推測しない。
 * @boundary 利用可能性Modelと表示Textの境界。
 * @security CredentialまたはHost詳細を追加しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function formatAvailabilityAxes(
  availability: ReturnType<typeof evaluateAiProfileAvailability>,
): string {
  const display = (value: boolean | null) =>
    value === true ? "yes" : value === false ? "no" : "unknown";
  return `registered=${display(availability.adapterRegistered)}, host=${display(availability.hostAvailable)}, authenticated=${display(availability.authenticated)}, authorized=${display(availability.executionAuthorized)}`;
}

/**
 * AI Profile表示TextをHTMLへ安全に符号化する。
 *
 * @responsibility Catalog由来TextをMarkupとして解釈させない。
 * @trace ARCH-000012
 * @input value: 表示する文字列。
 * @returns HTML特殊文字を符号化した文字列。
 * @precondition valueを実行可能Markupとして扱わない。
 * @postcondition ampersand、angle bracket、quoteを生で残さない。
 * @effect N/A: 文字列変換だけを行う。
 * @failure N/A: 全文字列を決定論的に変換する。
 * @invariant 表示文字の順序を変えない。
 * @boundary AI Profile ModelとBrowser HTMLの境界。
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
