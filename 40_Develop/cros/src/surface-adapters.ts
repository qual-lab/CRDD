/**
 * CROSの公開Surface入力を共有Application Contractへ変換する。
 *
 * @packageDocumentation
 * @responsibility TS API、CLI、MCP、Workbenchの実入力境界を個別に検証し、同じ操作契約へ接続する。
 * @trace ARCH-000010
 * @boundary 公開Surface入力とCROS Application Contractの境界。
 * @effect N/A: Adapterは入力変換だけを行い、Effectは共有Contractへ委譲する。
 * @security Surface名や入力形式からAuthorityを追加しない。
 */
import type {
  SurfaceApplicationContract,
  SurfaceOperationRequest,
  SurfaceOperationResult,
} from "./application-contract.ts";

/**
 * Workbenchから受け取る操作Commandの形を定義する。
 *
 * @responsibility Workbench表示状態と実行要求を分け、操作に必要な値だけをApplication Contractへ渡す。
 * @trace ARCH-000010
 * @shape Workbench Commandの入力Propertyを定義する。
 * @invariant UI表示名はAuthority、Revisionまたは操作Identityを変更しない。
 * @boundary Workbench UIとCROS Workbench Adapterの境界。
 * @security Credentialや非表示Source本文をCommandへ含めない。
 * @compatibility 表示変更時も本Commandの意味を維持する。
 */
export type WorkbenchOperationCommand = Readonly<{
  id: string;
  expectedRevision: string;
  grantedAuthority: string;
  command: "apply" | "inspect" | "cancel";
  proposedValue: string | null;
}>;

/**
 * 公開Surfaceの入力拒否結果を構築する。
 *
 * @responsibility Ownerへ到達していない入力失敗を共通のEffect 0結果へ変換する。
 * @trace ARCH-000010
 * @input Surface固有の拒否理由。
 * @returns unknown RevisionとEffect 0を持つblocked結果。
 * @precondition 理由は機密を含まない固定語彙である。
 * @postcondition Owner値またはRevisionを推測しない。
 * @effect N/A: 値を構築するだけである。
 * @failure N/A: 固定Propertyから必ず結果を構築する。
 * @invariant Owner Effectと残存資源は0である。
 * @boundary Surface入力検証と共有結果契約の境界。
 * @security 未検証入力を結果へ複製しない。
 * @concurrency N/A: 共有状態を使用しない純粋変換である。
 */
function invalidInputResult(reason: string): SurfaceOperationResult {
  return Object.freeze({
    status: "blocked",
    reason,
    revision: "unknown",
    value: null,
    ownerEffectCount: 0,
    residualResourceCount: 0,
  });
}

/**
 * 未知値がCanonical Surface Requestを満たすか判定する。
 *
 * @responsibility MCP等の未知入力を必須Propertyと閉じたaction語彙で検証する。
 * @trace ARCH-000010
 * @input 任意の未知値。
 * @returns 全Propertyが契約を満たす場合だけtrue。
 * @precondition N/A: 未知入力を受ける境界である。
 * @postcondition true時はSurfaceOperationRequestとして安全に扱える。
 * @effect N/A: 入力値を読取るだけである。
 * @failure 不正入力をfalseへ分離し例外または補完を行わない。
 * @invariant 余分なTransport情報からAuthorityを生成しない。
 * @boundary 未知Transport入力とApplication Requestの境界。
 * @security 欠落fieldを既定AuthorityやRevisionで補完しない。
 * @concurrency N/A: 共有状態を使用しない純粋判定である。
 */
function isSurfaceOperationRequest(
  value: unknown,
): value is SurfaceOperationRequest {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.operationId === "string" &&
    typeof input.revision === "string" &&
    typeof input.authority === "string" &&
    (input.action === "apply" ||
      input.action === "inspect" ||
      input.action === "cancel") &&
    (typeof input.value === "string" || input.value === null)
  );
}

/**
 * TS API要求を共有Application Contractへ渡す。
 *
 * @responsibility 型付けされたTS API入力を再解釈せず共有Contractへ接続する。
 * @trace ARCH-000010
 * @input contractと型付け済みSurfaceOperationRequest。
 * @returns 共有Contractの構造化結果。
 * @precondition requestはTypeScript公開型を満たす。
 * @postcondition 結果意味とEffect件数を変更せず返す。
 * @effect Contractが許可したEffectだけを発行する。
 * @failure Contractの拒否・部分結果・取消をそのまま返す。
 * @invariant Adapter固有StoreまたはAuthorityを作らない。
 * @boundary TS API→Application Contract。
 * @security 入力Authorityを昇格しない。
 * @concurrency Contractの競合制御を共有する。
 */
export function executeTsSurfaceOperation(
  contract: SurfaceApplicationContract,
  request: SurfaceOperationRequest,
): SurfaceOperationResult {
  return contract.performSurfaceOperation(request);
}

/**
 * CLI引数を共有Application Contractへ変換して実行する。
 *
 * @responsibility CLIの位置引数を固定Schemaへ変換し、不完全な入力をOwner到達前に拒否する。
 * @trace ARCH-000010
 * @input contractとoperationId、revision、authority、action、valueの順のCLI引数。
 * @returns 共有Contract結果またはCLI入力拒否結果。
 * @precondition 値なしは文字列`null`で表す。
 * @postcondition 正常入力だけが共有Contractへ一度到達する。
 * @effect Contractが許可したEffectだけを発行する。
 * @failure 引数数・action・null表現の不正をEffect 0で拒否する。
 * @invariant CLI固有のAuthority、RevisionまたはStoreを作らない。
 * @boundary CLI argv→CLI Adapter→Application Contract。
 * @security 引数から追加Authorityを生成しない。
 * @concurrency Contractの競合制御を共有する。
 */
export function executeCliSurfaceOperation(
  contract: SurfaceApplicationContract,
  args: readonly string[],
): SurfaceOperationResult {
  if (args.length !== 5) return invalidInputResult("cli_surface_input_invalid");
  const [operationId, revision, authority, action, rawValue] = args;
  const request = {
    operationId,
    revision,
    authority,
    action,
    value: rawValue === "null" ? null : rawValue,
  };
  if (!isSurfaceOperationRequest(request))
    return invalidInputResult("cli_surface_input_invalid");
  return contract.performSurfaceOperation(request);
}

/**
 * MCPの未知入力を検証して共有Application Contractへ渡す。
 *
 * @responsibility 外部Transport由来の未知値を固定Request Schemaで検証し、検証済み値だけを実行する。
 * @trace ARCH-000010
 * @input contractとMCP Tool Inputの未知値。
 * @returns 共有Contract結果またはMCP入力拒否結果。
 * @precondition N/A: 未知入力を受ける境界である。
 * @postcondition Schema適合時だけ共有Contractへ一度到達する。
 * @effect Contractが許可したEffectだけを発行する。
 * @failure 型・必須Property・action不正をEffect 0で拒否する。
 * @invariant MCP Transport情報を操作意味へ混入させない。
 * @boundary MCP Tool Input→MCP Adapter→Application Contract。
 * @security 未知値からAuthorityを補完しない。
 * @concurrency Contractの競合制御を共有する。
 */
export function executeMcpSurfaceOperation(
  contract: SurfaceApplicationContract,
  input: unknown,
): SurfaceOperationResult {
  if (!isSurfaceOperationRequest(input))
    return invalidInputResult("mcp_surface_input_invalid");
  return contract.performSurfaceOperation(input);
}

/**
 * Workbench Commandを共有Application Contractへ変換して実行する。
 *
 * @responsibility UI向けCommand名をCanonicalな操作要求へ明示変換し、Workbench独自Storeを作らない。
 * @trace ARCH-000010
 * @input contractとWorkbenchOperationCommand。
 * @returns 共有Contractの構造化結果。
 * @precondition commandはWorkbench公開型を満たす。
 * @postcondition UI固有名はCanonical Requestへ一度だけ変換される。
 * @effect Contractが許可したEffectだけを発行する。
 * @failure Contractの拒否・部分結果・取消をそのまま返す。
 * @invariant Workbenchは結果意味、Authority、Revisionまたは正本を所有しない。
 * @boundary Workbench Command→Workbench Adapter→Application Contract。
 * @security UI状態からAuthorityを追加しない。
 * @concurrency Contractの競合制御を共有する。
 */
export function executeWorkbenchSurfaceOperation(
  contract: SurfaceApplicationContract,
  command: WorkbenchOperationCommand,
): SurfaceOperationResult {
  return contract.performSurfaceOperation({
    operationId: command.id,
    revision: command.expectedRevision,
    authority: command.grantedAuthority,
    action: command.command,
    value: command.proposedValue,
  });
}
