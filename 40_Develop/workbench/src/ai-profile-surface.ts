/**
 * WorkbenchのAI Profile一覧Surface。
 *
 * @responsibility 設定済みProfileと利用可能性の四軸を、会話履歴や実行Authorityを所有せずBrowser向けRead Modelへ投影する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @boundary AI Runtime Profile CatalogとWorkbench Browser Read Modelの境界。
 * @effect N/A: 検証済みCatalogと観測値からBrowser向けRead Modelを構築するだけである。
 * @security Credential、Provider Home、Host PathをRead Modelへ含めない。
 */
import {
  DEFAULT_AI_PROFILE_CATALOG,
  type AiProfileAvailabilityObservation,
  type AiProfileCatalog,
} from "../../ai-runtime/src/index.ts";

/**
 * Profile Catalog一件の観測値をBrowserへ渡すRead Modelの構造を固定する。
 *
 * @responsibility Profile Identityと四軸の利用可能性観測を同じRecordへ保持する。
 * @trace ARCH-000010
 * @shape profileIdとavailabilityだけを持つ閉じた型として扱う。
 * @invariant 未観測値を利用可能または利用不可へ読み替えない。
 * @boundary AI RuntimeのProfile観測とWorkbench Browser Read Modelの型境界。
 * @security Credential、Provider HomeおよびHost Pathを含めない。
 * @compatibility 変更時はClient Model、表示実装および契約試験を同時更新する。
 */
export type WorkbenchAiProfileObservation = Readonly<{
  profileId: string;
  availability: AiProfileAvailabilityObservation;
}>;

/**
 * AI Profile一覧SurfaceをBrowserへ渡すRead Modelの構造を固定する。
 *
 * @responsibility 検証済みCatalogとProfile別観測を一つのSnapshotとして保持する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @shape catalogとobservationsだけを持つ閉じた型として扱う。
 * @invariant Catalog設定と実行可用性を同じ事実へ畳まない。
 * @boundary Workbench ApplicationとBrowser Client Modelの型境界。
 * @security Credential、Provider HomeおよびHost Pathを追加しない。
 * @compatibility 変更時はClient Model、表示実装および契約試験を同時更新する。
 */
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
