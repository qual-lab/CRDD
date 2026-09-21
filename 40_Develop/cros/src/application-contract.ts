/**
 * CROSの公開Surfaceが共有する操作要求を定義する。
 *
 * @responsibility 入口Identityと操作Identity、Authority、Revisionおよび要求種別を同じ契約へ固定する。
 * @trace ARCH-000010
 * @shape SurfaceOperationRequestが表す入力Propertyを定義する。
 * @invariant Surface差は操作意味、Authorityまたは正本Ownerを変更しない。
 * @boundary Human CLI／TS API／MCP／WorkbenchとApplication Contractの境界。
 * @security Authorityは入口名から付与せず、要求とOwnerで照合する。
 * @compatibility 新しいSurfaceも同じrequest schemaへ変換して接続する。
 */
export type SurfaceOperationRequest = Readonly<{
  operationId: string;
  revision: string;
  authority: string;
  action: "apply" | "inspect" | "cancel";
  value: string | null;
}>;

/**
 * 共有Application Contractの構造化結果を定義する。
 *
 * @responsibility 正常、拒否、部分結果および取消を全Surfaceで同じ結果語彙へ閉じる。
 * @trace ARCH-000010
 * @shape status、reason、revision、effect countおよび残存資源数を定義する。
 * @invariant 拒否または取消ではOwner Effectを発行しない。
 * @boundary Application ContractとSurface Adapterの境界。
 * @security 拒否理由は未許可のOwner値を含まない。
 * @compatibility Surfaceは結果fieldを再解釈せずそのまま搬送する。
 */
export type SurfaceOperationResult = Readonly<{
  status: "completed" | "partial" | "blocked" | "cancelled";
  reason: string;
  revision: string;
  value: string | null;
  ownerEffectCount: number;
  residualResourceCount: number;
}>;

/**
 * 公開操作Surfaceの閉じた集合を定義する。
 *
 * @responsibility TS API、CLI、MCP、Workbenchの入口Identityを固定する。
 * @trace ARCH-000010
 * @shape 四つの公開Surface名を表す。
 * @invariant Surface名はAuthorityまたはOwnerを暗黙に付与しない。
 * @boundary Surface AdapterとApplication Contractの境界。
 * @security Surface名を認証済み主体として扱わない。
 * @compatibility 追加Surfaceは明示的な契約改訂を必要とする。
 */
export type OperationSurface = "ts-api" | "cli" | "mcp" | "workbench";

/**
 * Application Contractの公開実行Portを定義する。
 *
 * @responsibility Surface Adapterが依存する単一の操作契約を固定する。
 * @trace ARCH-000010
 * @shape performSurfaceOperation操作だけを公開する。
 * @invariant AdapterはContract結果を再解釈しない。
 * @boundary Surface AdapterとApplication Contract実装の境界。
 * @security AdapterからAuthorityを追加しない。
 * @compatibility 実装差替時もperformSurfaceOperation schemaを維持する。
 */
export type SurfaceApplicationContract = Readonly<{
  performSurfaceOperation(
    request: SurfaceOperationRequest,
  ): SurfaceOperationResult;
}>;

/**
 * 正本Ownerの最小Portを定義する。
 *
 * @responsibility Application Contractが独自Storeを持たず所有正本へ読書きする境界を固定する。
 * @trace ARCH-000010
 * @shape 現在値の観測とRevision付き更新を定義する。
 * @invariant 更新成否とEffect件数はOwnerだけが決定する。
 * @boundary Application ContractとCanonical Ownerの境界。
 * @security Authority検証を経ないwriteを公開しない。
 * @compatibility Store実装はPortを満たす限り差し替え可能である。
 */
export type CanonicalOperationOwner = Readonly<{
  inspect(): Readonly<{ revision: string; value: string | null }>;
  apply(input: Readonly<{ revision: string; value: string }>): boolean;
}>;

/**
 * 四つの公開Surfaceが共有するApplication Contractを作成する。
 *
 * @responsibility 正常、拒否、部分結果、取消を一つのOwner境界と結果意味で処理する。
 * @trace ARCH-000010
 * @input owner: Canonical Owner Port、allowedAuthority: 更新に必要なAuthority。
 * @returns Surface名に依存しないperformSurfaceOperation関数を返す。
 * @precondition Ownerは同じCanonical Revision空間を使用する。
 * @postcondition completed時だけOwner Effectが1となる。
 * @effect apply要求が全Gateを満たす場合だけOwnerを一度更新する。
 * @failure Authority不一致、Revision不一致または入力欠落を構造化blockedへ変換する。
 * @invariant Contract自身は入口固有Storeを作らない。
 * @boundary TS API／CLI／MCP／Workbench→Application Contract→Canonical Owner。
 * @security 許可Authorityを満たさない更新はEffect 0で拒否する。
 * @concurrency Revision一致を更新直前に再確認する楽観的競合制御を用いる。
 */
export function createSurfaceApplicationContract(
  owner: CanonicalOperationOwner,
  allowedAuthority: string,
): SurfaceApplicationContract {
  return Object.freeze({
    /**
     * 公開Surfaceから受けた操作要求をCanonical Ownerへ適用する。
     *
     * @responsibility 正常、拒否、部分結果および取消を共有契約で判定する。
     * @trace ARCH-000010
     * @input request: Surfaceから正規化された操作要求。
     * @returns Surfaceに依存しない構造化操作結果。
     * @precondition requestはSurface Adapterで同じSchemaへ変換済みである。
     * @postcondition completed時だけOwner Effectが1となる。
     * @effect apply要求が全Gateを満たす場合だけOwnerを一度更新する。
     * @failure 不正入力、取消、Authority不一致、Revision競合およびOwner拒否を構造化結果へ変換する。
     * @invariant 入口種別によってAuthority、Revisionまたは結果意味を変更しない。
     * @boundary Surface Adapter→Application Contract→Canonical Owner。
     * @security 許可Authorityを満たさない更新はEffect 0で拒否する。
     * @concurrency Revision一致を更新直前に再確認する楽観的競合制御を用いる。
     */
    performSurfaceOperation(
      request: SurfaceOperationRequest,
    ): SurfaceOperationResult {
      const current = owner.inspect();
      if (!request.operationId || !request.revision)
        return Object.freeze({
          status: "blocked",
          reason: "surface_operation_input_invalid",
          revision: current.revision,
          value: null,
          ownerEffectCount: 0,
          residualResourceCount: 0,
        });
      if (request.action === "cancel")
        return Object.freeze({
          status: "cancelled",
          reason: "surface_operation_cancelled",
          revision: current.revision,
          value: null,
          ownerEffectCount: 0,
          residualResourceCount: 0,
        });
      if (request.action === "inspect")
        return Object.freeze({
          status: current.value === null ? "partial" : "completed",
          reason:
            current.value === null
              ? "canonical_value_missing"
              : "canonical_value_observed",
          revision: current.revision,
          value: current.value,
          ownerEffectCount: 0,
          residualResourceCount: 0,
        });
      if (request.authority !== allowedAuthority || request.value === null)
        return Object.freeze({
          status: "blocked",
          reason: "surface_operation_authority_or_value_invalid",
          revision: current.revision,
          value: null,
          ownerEffectCount: 0,
          residualResourceCount: 0,
        });
      if (request.revision !== current.revision)
        return Object.freeze({
          status: "blocked",
          reason: "surface_operation_revision_conflict",
          revision: current.revision,
          value: null,
          ownerEffectCount: 0,
          residualResourceCount: 0,
        });
      const isApplied = owner.apply({
        revision: request.revision,
        value: request.value,
      });
      const after = owner.inspect();
      return Object.freeze({
        status: isApplied ? "completed" : "blocked",
        reason: isApplied
          ? "surface_operation_applied"
          : "surface_operation_owner_rejected",
        revision: after.revision,
        value: isApplied ? after.value : null,
        ownerEffectCount: isApplied ? 1 : 0,
        residualResourceCount: 0,
      });
    },
  });
}

/**
 * 公開Surfaceを共有Application Contractへ結合する。
 *
 * @responsibility 各入口を明示Identity付きAdapterとして構成し、独自Storeや独自結果変換を禁止する。
 * @trace ARCH-000010
 * @input surface: 公開入口、contract: 共有Application Contract。
 * @returns Surface Identityと同じperformSurfaceOperation Portを持つAdapterを返す。
 * @precondition contractはCanonical Ownerへ接続済みである。
 * @postcondition 全Surfaceが同じContract objectへ処理を委譲する。
 * @effect N/A: Adapter構築時にOwner Effectを発行しない。
 * @failure N/A: 閉じたSurface型と有効Contractは常に結合できる。
 * @invariant Adapterは状態、Authority、Revisionまたは結果変換を所有しない。
 * @boundary TS API／CLI／MCP／Workbench Adapter→Application Contract。
 * @security 入口IdentityからAuthorityを生成しない。
 * @concurrency Contractの競合制御を共有し、入口別Lockを作らない。
 */
export function bindOperationSurface(
  surface: OperationSurface,
  contract: SurfaceApplicationContract,
): Readonly<{
  surface: OperationSurface;
  performSurfaceOperation(
    request: SurfaceOperationRequest,
  ): SurfaceOperationResult;
}> {
  return Object.freeze({
    surface,
    performSurfaceOperation: (request: SurfaceOperationRequest) =>
      contract.performSurfaceOperation(request),
  });
}

/**
 * 委譲結果を元Taskへ帰還させる入力を定義する。
 *
 * @responsibility Task、Request、Revision、作成側、変更集合およびEvidenceを同じResult Identityへ結合する。
 * @trace ARCH-000015
 * @shape DelegatedResultが持つ相関Propertyを定義する。
 * @invariant 部分結果と完成結果を同じ状態へ畳まない。
 * @boundary Delegated RuntimeとOrigin Taskの境界。
 * @security Authority名だけを保持しCredentialを含めない。
 * @compatibility 再送時もresultIdを維持する。
 */
export type DelegatedResult = Readonly<{
  resultId: string;
  taskId: string;
  requestId: string;
  producerId: string;
  targetRevision: string;
  authority: string;
  changesHash: string;
  evidenceIds: readonly string[];
  complete: boolean;
}>;

/**
 * 委譲結果の帰還判定を行う。
 *
 * @responsibility 正常帰還、拒否、帰還先消失、Revision競合、部分結果および再送をEffect前に判定する。
 * @trace ARCH-000015
 * @input result: 委譲結果、origin: 元Taskの現在状態、settledResultIds: 適用済みResult集合。
 * @returns 帰還状態、理由、相関Identity、Effect件数を返す。
 * @precondition originは判定直前に再観測した値である。
 * @postcondition acceptedのときだけEffect件数が1となる。
 * @effect 正常な完成結果だけを元Taskへ一度反映する許可を表す。
 * @failure 不正相関、消失、競合、部分結果、再送をEffect 0で返す。
 * @invariant 結果を別Taskまたは別Revisionへ付け替えない。
 * @boundary Delegated Runtime→Result Return→Origin Task／Canonical Owner。
 * @security Authority不一致では変更HashやEvidenceを公開結果へ複製しない。
 * @concurrency settledResultIdsとorigin Revisionは同じ判定Snapshotから取得する。
 */
export function settleDelegatedResult(
  result: DelegatedResult,
  origin: Readonly<{
    exists: boolean;
    taskId: string;
    requestId: string;
    revision: string;
    authority: string;
  }>,
  settledResultIds: ReadonlySet<string>,
): Readonly<{
  status: "accepted" | "blocked" | "partial";
  reason: string;
  taskId: string;
  requestId: string;
  resultId: string;
  effectCount: number;
}> {
  const base = {
    taskId: result.taskId,
    requestId: result.requestId,
    resultId: result.resultId,
  } as const;
  if (!origin.exists)
    return Object.freeze({
      ...base,
      status: "blocked",
      reason: "result_return_origin_missing",
      effectCount: 0,
    });
  if (
    result.taskId !== origin.taskId ||
    result.requestId !== origin.requestId ||
    result.authority !== origin.authority
  )
    return Object.freeze({
      ...base,
      status: "blocked",
      reason: "result_return_correlation_invalid",
      effectCount: 0,
    });
  if (result.targetRevision !== origin.revision)
    return Object.freeze({
      ...base,
      status: "blocked",
      reason: "result_return_revision_conflict",
      effectCount: 0,
    });
  if (settledResultIds.has(result.resultId))
    return Object.freeze({
      ...base,
      status: "blocked",
      reason: "result_return_already_settled",
      effectCount: 0,
    });
  if (!result.complete)
    return Object.freeze({
      ...base,
      status: "partial",
      reason: "result_return_partial",
      effectCount: 0,
    });
  return Object.freeze({
    ...base,
    status: "accepted",
    reason: "result_return_accepted",
    effectCount: 1,
  });
}
