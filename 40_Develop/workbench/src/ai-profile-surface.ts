/**
 * WorkbenchのAI Profile一覧Surface。
 *
 * @responsibility 設定済みProfileと利用可能性の四軸を、会話履歴や実行Authorityを所有せず表示する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @boundary AI Runtime Profile CatalogとWorkbench Browser表示の境界。
 * @effect N/A: 検証済みCatalogと観測値からReact要素を構築するだけである。
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
import { createElement, type ReactElement } from "react";

import {
  ActionTokenInput,
  WorkbenchPanel,
} from "./presentation/workbench-components.ts";

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
 * AI Profile一覧を安全なReact要素へ投影する。
 *
 * @responsibility Profile、Adapter、Model、既定推論強度、利用可能性を一行ずつ表示する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input surface: Profile CatalogとProfile別の観測値。
 * @returns Workbench PanelのReact要素。
 * @precondition catalogはAI Runtimeで検証済みである。
 * @postcondition 設定済みと利用可能を別の列で表示する。
 * @effect N/A: React要素の構築だけを行う。
 * @failure 観測がないProfileをunknownとして表示する。
 * @invariant 未観測値をavailableへ変換しない。
 * @boundary AI Profile Read ModelとBrowser React表示の境界。
 * @security ReactのText escapingを使用し、秘密値を入力として受け取らない。
 * @concurrency N/A: 固定Snapshotを同期描画する。
 */
export function renderWorkbenchAiProfiles(
  surface: WorkbenchAiProfileSurface,
): ReactElement {
  const observations = new Map(
    surface.observations.map((item) => [item.profileId, item.availability]),
  );
  const adapters = new Map(
    surface.catalog.adapters.map((adapter) => [adapter.adapterId, adapter]),
  );
  const rows = surface.catalog.profiles.map((profile) => {
    const adapter = adapters.get(profile.adapterId);
    const availability = evaluateAiProfileAvailability(
      observations.get(profile.profileId) ?? {
        adapterRegistered: adapter !== undefined,
        hostAvailable: null,
        authenticated: null,
        executionAuthorized: null,
      },
    );
    return createElement(
      "tr",
      { key: profile.profileId },
      createElement("td", null, createElement("code", null, profile.profileId)),
      createElement("td", null, profile.adapterId),
      createElement("td", null, profile.exactModelId),
      createElement("td", null, profile.defaultReasoningEffort),
      createElement("td", null, availability.status),
      createElement("td", null, formatAvailabilityAxes(availability)),
    );
  });
  return createElement(
    WorkbenchPanel,
    {
      id: "ai-profiles",
      eyebrow: "AI configuration",
      title: "AI Profiles",
      status: `${surface.catalog.profiles.length} configured`,
    },
    createElement(
      "p",
      { className: "scene-summary" },
      "Profile設定と、Host・認証・実行Authorityの現在観測を分けて表示します。Configuredは実行可能を意味しません。",
    ),
    createElement(
      "div",
      { className: "table-scroll" },
      createElement(
        "table",
        null,
        createElement(
          "thead",
          null,
          createElement(
            "tr",
            null,
            ...[
              "Profile",
              "Adapter",
              "Model",
              "Reasoning",
              "Availability",
              "Axes",
            ].map((value) => createElement("th", { key: value }, value)),
          ),
        ),
        createElement("tbody", null, ...rows),
      ),
    ),
  );
}

/**
 * Owner別AI Profile限定管理入口をReact要素へ投影する。
 *
 * @responsibility 登録済みAdapter／Modelだけを使う作成・更新と、Profile単位の確認付き削除を表示する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input snapshot: Owner別Catalog、ownerLabel: 表示Owner、actionToken: 起動単位Token、lastResult: 直前結果。
 * @returns Profile管理PanelのReact要素。管理Snapshot未接続時はnull。
 * @precondition snapshotはRepositoryまたはCROSの一方のOwnerだけから取得される。
 * @postcondition CandidateにAdapter定義、Credential、Pathまたは任意実行引数を入力できない。
 * @effect N/A: React要素の構築だけを行う。
 * @failure 管理Snapshot未接続時は管理入口を表示しない。
 * @invariant 作成・更新は現在Revisionを送り、削除は明示確認を要求する。
 * @boundary AI Profile管理ApplicationとWorkbench Browserの境界。
 * @security ReactのText escapingを使用し、秘密値を扱う入力欄を設けない。
 * @concurrency 表示時SnapshotのRevisionを操作ごとに送る。
 */
export function renderWorkbenchAiProfileAdministration(
  snapshot: AiProfileCatalogSnapshot | undefined,
  ownerLabel: "Repository" | "CROS",
  actionToken: string,
  lastResult: AiProfileCatalogMutationResult | null,
): ReactElement | null {
  if (snapshot === undefined) return null;
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
  const profileRows = snapshot.catalog.profiles.map((profile) =>
    createElement(
      "tr",
      { key: profile.profileId },
      createElement("td", null, createElement("code", null, profile.profileId)),
      createElement(
        "td",
        null,
        `${profile.adapterId} / ${profile.exactModelId}`,
      ),
      createElement(
        "td",
        null,
        createElement(
          "form",
          { method: "post", action: "/ai-profiles/action" },
          createElement(ActionTokenInput, { value: actionToken }),
          createElement("input", {
            type: "hidden",
            name: "operation",
            value: "delete",
          }),
          createElement("input", {
            type: "hidden",
            name: "expectedRevision",
            value: snapshot.revision,
          }),
          createElement("input", {
            type: "hidden",
            name: "profileId",
            value: profile.profileId,
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
            "このProfileだけを削除する",
          ),
          createElement("button", { type: "submit" }, "削除"),
        ),
      ),
    ),
  );
  return createElement(
    WorkbenchPanel,
    {
      id: "ai-profile-administration",
      eyebrow: `${ownerLabel} configuration`,
      title: "AI Profile管理",
      status: `revision ${snapshot.revision}`,
    },
    createElement(
      "p",
      { className: "scene-summary" },
      `${ownerLabel} OwnerのProfileだけを管理します。登録済みAdapterと許可Modelの組だけで作成・更新し、認証情報、実行Path、任意引数およびAdapter自体は管理しません。`,
    ),
    lastResult === null
      ? null
      : createElement(
          "p",
          { className: "operation-result" },
          createElement("strong", null, lastResult.status),
          ` — ${lastResult.reason} / revision ${lastResult.snapshot.revision}`,
        ),
    createElement(
      "form",
      {
        className: "ai-profile-administration-form",
        method: "post",
        action: "/ai-profiles/action",
      },
      createElement(ActionTokenInput, { value: actionToken }),
      createElement("input", {
        type: "hidden",
        name: "expectedRevision",
        value: snapshot.revision,
      }),
      createElement(
        "label",
        null,
        "操作",
        createElement(
          "select",
          { name: "operation", required: true },
          createElement("option", { value: "create" }, "新規作成"),
          createElement("option", { value: "update" }, "既存を更新"),
        ),
      ),
      createElement(
        "label",
        null,
        "Profile ID",
        createElement("input", {
          name: "profileId",
          pattern: "PROFILE-[0-9]{6,}",
          placeholder: "PROFILE-300001",
          required: true,
        }),
      ),
      createElement(
        "label",
        null,
        "Adapter / Model",
        createElement(
          "select",
          { name: "adapterModel", required: true },
          ...adapterModels.map((item) =>
            createElement(
              "option",
              { key: item.value, value: item.value },
              item.label,
            ),
          ),
        ),
      ),
      createElement(
        "label",
        null,
        "Family",
        createElement("input", {
          name: "family",
          pattern: "[a-z][a-z0-9._-]{1,63}",
          placeholder: "astra",
          required: true,
        }),
      ),
      createElement(
        "fieldset",
        null,
        createElement("legend", null, "利用Role"),
        ...checkboxes("selectionRole", [
          "coordinator",
          "executor",
          "independent_reviewer",
          "result_integration",
        ]),
      ),
      createElement(
        "fieldset",
        null,
        createElement("legend", null, "Model Tier"),
        ...checkboxes("modelTier", ["preferred", "upper_allowed"]),
      ),
      createElement(
        "label",
        null,
        "既定Reasoning",
        createElement(
          "select",
          { name: "defaultReasoningEffort", required: true },
          ...efforts.map((effort) =>
            createElement("option", { key: effort, value: effort }, effort),
          ),
        ),
      ),
      createElement(
        "label",
        null,
        "互換理由（不要なら空欄）",
        createElement("input", { name: "compatibilityReason" }),
      ),
      createElement("button", { type: "submit" }, "Catalog候補を検証して保存"),
    ),
    createElement(
      "div",
      { className: "table-scroll" },
      createElement(
        "table",
        null,
        createElement(
          "thead",
          null,
          createElement(
            "tr",
            null,
            createElement("th", null, "Profile"),
            createElement("th", null, "Adapter / Model"),
            createElement("th", null, "確認付き削除"),
          ),
        ),
        createElement("tbody", null, ...profileRows),
      ),
    ),
  );
}

/**
 * 閉じた選択肢集合を同名Checkboxへ変換する。
 *
 * @responsibility RoleとTierの複数選択を固定値だけで表現する。
 * @trace ARCH-000012
 * @input name: Form項目名、values: 固定選択肢。
 * @returns Checkbox LabelのReact要素列。
 * @precondition nameとvaluesは実装内の固定値である。
 * @postcondition 各値を同名Form Entryとして送信できる。
 * @effect N/A: React要素を構築するだけである。
 * @failure N/A: 空配列は空の要素列に変換する。
 * @invariant 任意の外部値を選択肢へ追加しない。
 * @boundary 固定Profile語彙とBrowser Formの境界。
 * @security ReactのText escapingを使用し、固定値をHTMLとして解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function checkboxes(name: string, values: readonly string[]): ReactElement[] {
  return values.map((value) =>
    createElement(
      "label",
      { className: "confirm", key: value },
      createElement("input", { type: "checkbox", name, value }),
      value,
    ),
  );
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
