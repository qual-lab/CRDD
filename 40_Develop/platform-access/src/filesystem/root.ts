/**
 * 保護RootとProvider Homeの用途固定Native観測を接続する。
 * @packageDocumentation
 * @responsibility 固定要求、実行物の前後同一性、子Processの有界実行と応答相関を所有する。
 * @trace ARCH-000008 ARCH-000010 ARCH-000015
 * @boundary Nodeから固定Windows Nativeへの同期搬送。上位Capability・回復判断は所有しない。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginPlatformAccessArtifactObservation,
  beginPlatformAccessBootstrapObservation,
  observePlatformAccessArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactObservation,
} from "../artifact/identity.ts";
import { createWindowsNativeHelperEnvironment } from "../process/environment.ts";
import {
  createProviderHomeObservationRequest,
  createRuntimeStateObservationRequest,
  evaluateProviderHomeObservationResponseCandidate,
  evaluateRuntimeStateObservationResponseCandidate,
  PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
} from "./protection.ts";

const bundledDistributionRoot = fileURLToPath(
  new URL("../../../..", import.meta.url),
);
const HELPER_TIMEOUT_MS = 5_000;

/**
 * 上位が既存の開発観測から投影する実行物の照合入力。
 * @responsibility 実行物の所在と期待値だけを受け取り、上位Contextを保持しない。
 * @trace ARCH-000008
 * @shape 配布Rootと期待Artifact。期待値欠落と観測自体の欠落を区別する。
 * @invariant この構造の一致だけで開発実行の許可を発行しない。
 * @boundary 上位の開発観測からNative照合への入力。
 * @security 任意argv・任意実行物Pathを受け付けない。
 * @compatibility 既存の開発観測の必要fieldだけを投影する。
 */
export type DevelopmentNativeSource = Readonly<{
  distributionRoot: string;
  expectedArtifact: unknown;
}>;

/**
 * 開発観測の取得と再確認を同期で借用する。
 * @responsibility 既存上位borrowの位置を保ち、この呼出しの外へ保持しない。
 * @trace ARCH-000008
 * @shape 引数なしの同期Reader。nullはContext不正、期待Artifactなしとは別である。
 * @invariant 二回目の返却値から実行物を再選択しない。
 * @boundary 上位は自身のContextをclosure内に保持する。
 * @security Readerは新たな実行許可・Capabilityを発行しない。
 * @compatibility 例外は従来のborrowと同様に伝播させる。
 */
export type DevelopmentNativeSourceReader =
  () => DevelopmentNativeSource | null;

/**
 * 固定Root／Home搬送で発生する技術失敗の閉集合。
 * @responsibility 上位が拒否理由を型から対応付けられるようにする。
 * @trace ARCH-000008
 * @shape 開発観測・Artifact・環境・Helperの失敗区分。
 * @invariant Process発行・終了事実を失敗名だけから推定しない。
 * @boundary 私有Native搬送から用途固定結果への理由。
 * @security 自由な例外本文を理由へ含めない。
 * @compatibility 現行上位理由の技術区分を維持する。
 */
type RootObservationFailure =
  | "development_context_invalid"
  | "artifact_bootstrap_unavailable"
  | "artifact_not_verified"
  | "environment_unavailable"
  | "artifact_changed"
  | "helper_failed";

/**
 * Native実行物の必要fieldが同一かを確認する。
 * @responsibility 既存のArtifact比較条件を維持する。
 * @trace ARCH-000008
 * @input 比較する二つの観測候補。
 * @returns 全六fieldが一致する場合だけtrue。
 * @precondition 候補は既存のArtifact観測から取得する。
 * @postcondition Hashだけの一致を全体一致にしない。
 * @effect N/A: 局所値の比較のみ。
 * @failure 不正な候補はfalse。
 * @invariant 比較対象を変更しない。
 * @boundary Native実行前後の観測照合。
 * @security 一致からAuthorityを発行しない。
 * @concurrency N/A: 同期の局所比較。
 */
function sameArtifact(left: unknown, right: unknown): boolean {
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const first = left as Partial<{
    relativePath: string;
    target: string;
    protocolRevision: number;
    rustToolchain: string;
    byteLength: number;
    sha256: string;
  }>;
  const second = right as typeof first;
  return (
    first.relativePath === second.relativePath &&
    first.target === second.target &&
    first.protocolRevision === second.protocolRevision &&
    first.rustToolchain === second.rustToolchain &&
    first.byteLength === second.byteLength &&
    first.sha256 === second.sha256
  );
}

/**
 * 固定保護Root要求をNativeへ同期搬送する。
 * @responsibility Artifact・環境・Process・応答frameと開発観測の既存順序を保持する。
 * @trace ARCH-000008 ARCH-000010 ARCH-000015
 * @input 私有の固定要求と用途限定の開発観測Reader。
 * @returns 完全frameまたは固定失敗区分と観測したEffect・終了情報。
 * @precondition 要求は同Fileの用途固定APIが生成済み。
 * @postcondition 成功・失敗でもReaderやframeを共有状態へ保持しない。
 * @effect 固定Nativeの同期Process一件と、要求用途に応じた既存OS観測・限定初期化。
 * @failure Artifact・環境・Helper・前後観測の失敗を区別し、Reader例外は伝播する。
 * @invariant 後Readerは元Artifact照合後だけに呼び、返却値から実行物を変更しない。
 * @boundary Node同期ProcessからWindows固定Protocol。
 * @security shellなし・固定相対実行物・閉じた環境・空argv・有界I/Oを維持する。
 * @concurrency 同期呼出し内で完結し、取消・再送・Registryを追加しない。
 */
function invokeRootObservation(
  request: Readonly<{ request: Buffer }>,
  readDevelopmentSource?: DevelopmentNativeSourceReader,
) {
  /**
   * 搬送の失敗区分と発行済みProcessの事実を構成する。
   * @responsibility 起動前拒否と起動後失敗・終了確認を分離する。
   * @trace ARCH-000008
   * @input 固定の失敗区分と観測済みProcess発行・終了値。
   * @returns 凍結した拒否結果。
   * @precondition 呼出し側が実際の観測値だけを渡す。
   * @postcondition 拒否を未発行・終了成功へ一律変換しない。
   * @effect N/A: 局所結果の生成のみ。
   * @failure N/A: 追加I/Oを行わない。
   * @invariant raw frame・token・Pathを結果へ含めない。
   * @boundary Native搬送から上位結果への技術情報。
   * @security Capabilityを生成しない。
   * @concurrency N/A: 同期の局所処理。
   */
  const blocked = (
    reason: RootObservationFailure,
    processEffectIssued = false,
    helperExitConfirmed = false,
  ) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      processEffectIssued,
      helperExitConfirmed,
      artifactVerifiedBeforeAndAfter: false as const,
    });
  const development = readDevelopmentSource ? readDevelopmentSource() : null;
  if (readDevelopmentSource && !development)
    return blocked("development_context_invalid");
  const distributionRoot =
    development?.distributionRoot ?? bundledDistributionRoot;
  const bootstrap = development
    ? null
    : beginPlatformAccessBootstrapObservation(distributionRoot);
  const expectedArtifact = development
    ? development.expectedArtifact
    : bootstrap?.artifact;
  if (!expectedArtifact) return blocked("artifact_bootstrap_unavailable");
  const artifactBefore =
    observePlatformAccessArtifactCandidate(distributionRoot);
  const artifactObservation = development
    ? beginPlatformAccessArtifactObservation(distributionRoot)
    : bootstrap;
  if (
    artifactBefore.status !== "candidate" ||
    !artifactObservation ||
    !sameArtifact(expectedArtifact, artifactBefore.artifact) ||
    !sameArtifact(artifactBefore.artifact, artifactObservation.artifact)
  ) {
    return blocked("artifact_not_verified");
  }
  const environment = createWindowsNativeHelperEnvironment();
  if (!environment) return blocked("environment_unavailable");
  if (!verifyPlatformAccessArtifactObservation(artifactObservation.token))
    return blocked("artifact_changed");
  const selectedExecutable = path.join(
    distributionRoot,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  const execution = spawnSync(selectedExecutable, [], {
    input: request.request,
    encoding: "buffer",
    env: environment,
    shell: false,
    windowsHide: true,
    timeout: HELPER_TIMEOUT_MS,
    maxBuffer: PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES + 1,
  });
  const processEffectIssued = execution.pid !== undefined;
  if (
    execution.error ||
    execution.signal !== null ||
    execution.status !== 0 ||
    !Buffer.isBuffer(execution.stdout) ||
    execution.stdout.byteLength !== PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES ||
    !Buffer.isBuffer(execution.stderr) ||
    execution.stderr.byteLength !== 0
  ) {
    return blocked("helper_failed", processEffectIssued);
  }
  if (!verifyPlatformAccessArtifactObservation(artifactObservation.token))
    return blocked("artifact_changed", true, true);
  const artifactAfter =
    observePlatformAccessArtifactCandidate(distributionRoot);
  if (
    artifactAfter.status !== "candidate" ||
    !sameArtifact(artifactBefore.artifact, artifactAfter.artifact) ||
    (readDevelopmentSource && !readDevelopmentSource())
  )
    return blocked("artifact_changed", true, true);
  return Object.freeze({
    status: "completed" as const,
    response: execution.stdout,
    processEffectIssued: true as const,
    helperExitConfirmed: true as const,
    artifactVerifiedBeforeAndAfter: true as const,
    executionSourceKind: development
      ? ("fixed_development_candidate" as const)
      : ("fixed_bootstrap_native_artifact" as const),
  });
}

/**
 * 選択済みRuntime State Rootを固定Nativeで観測する。
 * @responsibility 固定用途の要求構築・搬送・応答検査を型付き結果として返す。
 * @trace ARCH-000008 ARCH-000015
 * @input 上位の選択Root、既存初期化指定、任意の開発観測Reader。
 * @returns 観測候補または失敗区分とProcess・Artifact確認結果。
 * @precondition 上位は初期化許可と開発実行の採用を確認する。
 * @postcondition Root Capabilityを発行せずraw frameを返さない。
 * @effect Native観測と、許可済み指定時だけ既存Root初期化。
 * @failure 不正要求はReader・Process前に拒否し、応答不正を候補にしない。
 * @invariant 原因・発行事実・終了確認を同一視しない。
 * @boundary TypeScript APIから固定Rust要求。
 * @security Pathは対象相関用であり、入力だけを操作許可とみなさない。
 * @concurrency 同期実行。Readerは初回と必要な後確認だけに使用する。
 */
export function observeWindowsRuntimeState(
  rootPath: unknown,
  initializeIfMissing: unknown,
  readDevelopmentSource?: DevelopmentNativeSourceReader,
) {
  if (process.platform !== "win32")
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_unsupported",
      processEffectIssued: false,
      helperExitConfirmed: false,
      artifactVerifiedBeforeAndAfter: false,
      filesystemEffectIssued: false,
    });
  const request = createRuntimeStateObservationRequest(
    rootPath,
    initializeIfMissing,
  );
  if (!request)
    return Object.freeze({
      status: "blocked" as const,
      reason: "root_invalid",
      processEffectIssued: false,
      helperExitConfirmed: false,
      artifactVerifiedBeforeAndAfter: false,
      filesystemEffectIssued: false,
    });
  const result = invokeRootObservation(request, readDevelopmentSource);
  if (result.status === "blocked")
    return Object.freeze({
      ...result,
      filesystemEffectIssued:
        initializeIfMissing === true && result.processEffectIssued,
    });
  const observation = evaluateRuntimeStateObservationResponseCandidate(
    result.response,
    request.nonce,
  );
  if (observation.status !== "candidate")
    return Object.freeze({
      status: "blocked" as const,
      reason: "response_invalid",
      processEffectIssued: true,
      helperExitConfirmed: true,
      artifactVerifiedBeforeAndAfter: true,
      filesystemEffectIssued: initializeIfMissing === true,
    });
  return Object.freeze({
    ...observation,
    processEffectIssued: true,
    helperExitConfirmed: true,
    artifactVerifiedBeforeAndAfter: true,
    filesystemEffectIssued: initializeIfMissing === true,
    executionSourceKind: result.executionSourceKind,
  });
}

/**
 * 選択済みProvider Homeを固定Nativeで観測する。
 * @responsibility Providerと対象Pathを相関した要求・応答を観測候補へ変換する。
 * @trace ARCH-000008 ARCH-000010
 * @input Provider、上位選択Home、任意の開発観測Reader。
 * @returns 観測候補または失敗区分とProcess・Artifact確認結果。
 * @precondition 上位はProvider選択と開発実行の採用を確認する。
 * @postcondition Mount権限・鮮度付きCapabilityを発行せずraw frameを返さない。
 * @effect 固定Native一件によるHome・主体・保護の観測。
 * @failure 要求不正をReader前に拒否し、不正・未知応答を成功にしない。
 * @invariant 認証内容を読み出さず、上位の鮮度条件を変更しない。
 * @boundary TypeScript APIから固定Rust要求。
 * @security 任意argv・任意実行物Pathを受け付けない。
 * @concurrency 同期実行。開発観測の初回・後確認の順序を維持する。
 */
export function observeWindowsProviderHome(
  provider: unknown,
  homePath: unknown,
  readDevelopmentSource?: DevelopmentNativeSourceReader,
) {
  if (process.platform !== "win32")
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_unsupported",
      processEffectIssued: false,
      helperExitConfirmed: false,
      artifactVerifiedBeforeAndAfter: false,
      filesystemEffectIssued: false,
    });
  const request = createProviderHomeObservationRequest(provider, homePath);
  if (!request)
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_invalid",
      processEffectIssued: false,
      helperExitConfirmed: false,
      artifactVerifiedBeforeAndAfter: false,
      filesystemEffectIssued: false,
    });
  const result = invokeRootObservation(request, readDevelopmentSource);
  if (result.status === "blocked")
    return Object.freeze({ ...result, filesystemEffectIssued: false });
  const observation = evaluateProviderHomeObservationResponseCandidate(
    result.response,
    request.nonce,
    request.provider,
  );
  if (observation.status !== "candidate")
    return Object.freeze({
      status: "blocked" as const,
      reason: "response_invalid",
      processEffectIssued: true,
      helperExitConfirmed: true,
      artifactVerifiedBeforeAndAfter: true,
      filesystemEffectIssued: false,
    });
  return Object.freeze({
    ...observation,
    processEffectIssued: true,
    helperExitConfirmed: true,
    artifactVerifiedBeforeAndAfter: true,
    filesystemEffectIssued: false,
    executionSourceKind: result.executionSourceKind,
  });
}
