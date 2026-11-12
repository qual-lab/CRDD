/**
 * Repository別AI選択設定の共有値契約。
 * @packageDocumentation
 * @responsibility 希望設定・役割・分類と内容Identityを所有し、技術Catalogや実行を所有しない。
 * @trace ARCH-000004
 * @boundary 秘密値・実行Authorityを含めない設定データ。
 */

import type { ensureConfigurationDirectory } from "../storage/store.ts";

/**
 * v0.22の固定した五つの作業上の役割。
 * @responsibility アクセス管理のロールとは異なるAIの担当を表す。
 * @trace ARCH-000004
 * @shape 五つのliteralの和。
 * @invariant ユーザー定義の作業分類を役割へ昇格しない。
 * @boundary Repository設定とTask計画。
 * @security 権限・認証・Tool許可ではない。
 * @compatibility 新形式の固定集合。
 */
export type AiSelectionRole =
  | "coordinator"
  | "executor"
  | "independent_reviewer"
  | "result_integration"
  | "advice";

/**
 * Repositoryが希望する一つのModelとEffort。
 * @responsibility 技術カタログを参照する値だけを保持する。
 * @trace ARCH-000004
 * @shape Provider、Model識別子、Effort。
 * @invariant 既定値やfallbackを内部に持たない。
 * @boundary 設定と技術検査。
 * @security CLI引数・Path・Secretを持たない。
 * @compatibility 新設定JSONの選択値。
 */
export type AiSelectionChoice = Readonly<{
  provider: "codex" | "claude";
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
}>;

/**
 * 五役割の既定値と任意分類・分類別上書きを保持する。
 * @responsibility Repositoryごとの希望を一つの設定正本へまとめる。
 * @trace ARCH-000004
 * @shape 固定契約、役割既定値、分類辞書、部分上書き辞書。
 * @invariant revisionはSchema版であり保存CAS世代ではない。
 * @boundary 設定保存と選定処理。
 * @security Authority・認証・外部送信同意を含めない。
 * @compatibility 旧Profile形式を含めない。
 */
export type AiSelectionConfig = Readonly<{
  contract: "crdd/ai-selection";
  revision: 1;
  roleDefaults: Readonly<Record<AiSelectionRole, AiSelectionChoice>>;
  workTypes: Readonly<Record<string, Readonly<{ label: string }>>>;
  overrides: Readonly<
    Partial<
      Record<AiSelectionRole, Readonly<Record<string, AiSelectionChoice>>>
    >
  >;
}>;

/**
 * 内容Identityとともに検証されたRepository設定。
 * @responsibility 書式差でなく意味が一致する設定を同じHashへ固定する。
 * @trace ARCH-000004
 * @shape 不変設定と正規化本文SHA-256。
 * @invariant 元入力の後発変更を含めない。
 * @boundary 設定読取り・CAS・Task選定。
 * @security Hashは認可又は署名ではない。
 * @compatibility 旧Profile改訂と同じ値へ読み替えない。
 */
export type AiSelectionSnapshot = Readonly<{
  config: AiSelectionConfig;
  identity: string;
}>;

/** 設定の参照検査に必要な、信頼したHostから渡す非秘密Catalog投影。 */
export type AiSelectionCatalog = Readonly<{
  models: readonly Readonly<{
    provider: AiSelectionChoice["provider"];
    modelIdentifier: string;
    supportedEfforts: readonly AiSelectionChoice["effort"][];
    supportedPurposes: readonly ("advice" | "task")[];
  }>[];
}>;

/**
 * 正本の検証済みSnapshot、真正不存在、拒否を区別する。
 * @responsibility 観測不能を空設定へ変換しない。
 * @trace ARCH-000004
 * @shape 状態で絞り込む閉じた結果。
 * @invariant availableだけが設定値を持つ。
 * @boundary 設定Readerと利用側。
 * @security Host Path・秘密値なし。
 * @compatibility 新形式専用。
 */
export type AiSelectionReadResult = Readonly<
  | { status: "available"; snapshot: AiSelectionSnapshot; reason: null }
  | { status: "missing"; snapshot: null; reason: "ai_selection_not_configured" }
  | {
      status: "blocked";
      snapshot: null;
      reason:
        | "ai_selection_boundary_unconfirmed"
        | "ai_selection_file_invalid"
        | "ai_selection_config_invalid"
        | "ai_selection_read_unconfirmed";
    }
>;

/**
 * 今回作成した非正本Fileの観測値を介入担当へ渡す。
 * @responsibility 自動削除のAuthorityでないexact参照を保持する。
 * @trace ARCH-000004
 * @shape Repository束縛、相対名、観測可能な場合だけ実Identity。
 * @invariant 不明なIdentityを補完せず正本の設定へ利用しない。
 * @boundary Store失敗と既存フロントAI／運用清掃。
 * @security 絶対Path・File内容・秘密値なし。
 * @compatibility 新しい回復Registryではない。
 */
export type AiSelectionTemporaryReference = Readonly<{
  repositoryBinding: string;
  boundaryIdentity: string;
  relativePath: string;
  identity: Readonly<{
    dev: string;
    ino: string;
    birthtimeNs: string;
    size: string;
    mtimeNs: string;
    ctimeNs: string;
  }> | null;
  status: "cleanup_unconfirmed";
}>;

/**
 * 保存の成功・競合・拒否と未確認のEffectを分離する。
 * @responsibility 設定公開と一時File／Lockの終了を成功条件へ結合する。
 * @trace ARCH-000004
 * @shape saved以外は設定本文を返さない。
 * @invariant 公開後の失敗を保存前拒否へ畳まない。
 * @boundary 設定Storeと管理操作。
 * @security 未確認の保存を自動再送させず、既存回復参照は同じまま保持する。
 * @compatibility 初回作成のexpectedIdentityはnull。
 */
export type AiSelectionSaveResult = Readonly<
  | { status: "saved"; reason: null; snapshot: AiSelectionSnapshot }
  | {
      status: "conflict";
      reason: "ai_selection_identity_conflict";
      snapshot: null;
    }
  | {
      status: "blocked";
      reason: string;
      snapshot: null;
      recoveryId?: string;
      setupFailure?: ConfigAreaFailure;
    }
  | {
      status: "unknown";
      reason: string;
      snapshot: null;
      publication: "not_published" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
      recoveryId: string | null;
      temporary: AiSelectionTemporaryReference | null;
      setupFailure?: ConfigAreaFailure;
    }
>;

/**
 * 既存config領域確保の失敗契約をそのまま保持する。
 * @responsibility Ignoreの未確認Effectと元回復参照を新Storeで失わない。
 * @trace ARCH-000004
 * @shape 既存Domain結果のblocked部分。
 * @invariant 元のreason・cleanup・回復Identityを再生成しない。
 * @boundary Domainの領域確保と設定保存。
 * @security 認可された管理Callerだけへ搬送する内部契約。
 * @compatibility 既存Domain契約を変更しない。
 */
export type ConfigAreaFailure = Extract<
  NonNullable<ReturnType<typeof ensureConfigurationDirectory>>,
  { status: "blocked" }
>;

/**
 * 設定検査の成功値と固定拒否。
 * @responsibility 不正設定を空設定へ畳まない。
 * @trace ARCH-000004
 * @shape valid時だけSnapshotを持つ直和型。
 * @invariant 未設定と有効設定を同一視しない。
 * @boundary 設定Storeと検査。
 * @security 認証・実行許可なし。
 * @compatibility 新形式専用。
 */
export type AiSelectionConfigResult = Readonly<
  | { status: "valid"; value: AiSelectionSnapshot; reason: null }
  | { status: "blocked"; value: null; reason: "ai_selection_config_invalid" }
>;
