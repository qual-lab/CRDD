/**
 * Coordinator所有のHost終端intentをRepository内へ保存・再検証する。
 *
 * @responsibility 同参照の完全bytesと部分Effectを保持し、清掃Authorityを発行しない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import {
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
  resolveRepositoryRuntimeDataPaths,
} from "../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import { acquireHostTerminalCallerLease } from "./terminal-caller-lease.ts";
import {
  decodeHostTerminalIntent,
  decodeKnownFixtureHostTerminalIntent,
  type EncodedHostTerminalIntent,
  type EncodedKnownFixtureHostTerminalIntent,
  encodeHostTerminalIntent,
  encodeKnownFixtureHostTerminalIntent,
  type HostTerminalIntent,
  resolveHostTerminalLegacyGeneration,
} from "./terminal-record.ts";
import {
  createHostTerminalCurrentObservationRequest,
  createHostTerminalReadRequest,
  createHostTerminalSaveRequest,
  createKnownFileHostTerminalCurrentObservationRequest,
  createKnownFileHostTerminalReadRequest,
  createKnownFileHostTerminalSaveRequest,
  observeHostTerminalWindowsCandidate,
  observeKnownFileHostTerminalWindowsCandidate,
  readHostTerminalWindowsRecord,
  readKnownFileHostTerminalWindowsRecord,
  saveHostTerminalWindowsRecord,
  saveKnownFileHostTerminalWindowsRecord,
} from "./terminal-windows-adapter.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";

const MAX_ENTRIES = 1_024;
const MAX_BYTES = 8 * 1_024 * 1_024;
const RECORD_NAME =
  /^host-terminal\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(json|stage)$/u;
const REFERENCE =
  /^host-terminal\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

/**
 * caller記録の独立した期待結合を表す。
 *
 * @responsibility 読んだ記録自身を期待値へ循環させない。
 * @trace ARCH-000008
 * @shape Runtime、Repository、選択利用者の三Hash。
 * @invariant 期待値の実由来は上位の署名・Root・OS観測が所有する。
 * @boundary 内部callerと記録codecの境界。
 * @security HashはAuthorityではなく、値の一致は現在権限を証明しない。
 * @compatibility Host終端intent revision 2のbindingsと同じ閉集合。旧文書の属性は補完しない。
 */
export type HostTerminalCallerBindings = HostTerminalIntent["bindings"];

/**
 * 保存の現在結果と発行済みEffectを表す。
 *
 * @responsibility 保存成功とlease終端、管理初期化と記録Effectを分ける。
 * @trace ARCH-000008
 * @shape 同じ参照、saved／blocked、理由と二Effect・終端確認field。
 * @invariant blockedでも取得済み参照と発行可能性を消さない。
 * @boundary 私有caller保存の利用側。
 * @security Cleanup、Task再開または処置Authorityを含めない。
 * @compatibility 公開Runtime結果Schemaへ直接投影しない。
 */
export type HostTerminalCallerCheckpointResult = Readonly<{
  status: "saved" | "blocked";
  reason: string;
  reference: string;
  administrativeEffectIssued: boolean;
  recordEffectIssued: boolean;
  handlesCloseConfirmed: boolean;
  leaseCloseConfirmed: boolean;
  runtimeDataBlock: Readonly<{
    reason: string;
    effectIssued: boolean;
    effectStateUnknown: boolean;
    cleanupConfirmed: boolean;
    retryAllowed: boolean;
    recoveryReference: string | null;
  }> | null;
}>;

/**
 * 現在候補の観測とcaller記録の保存を区別した準備結果を表す。
 *
 * @responsibility 同じ参照と部分Effectを保持し、保存を清掃許可へ昇格しない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @shape 参照、二時点観測、正規intent、保存結果と管理／記録Effect。予期しない保存失敗のEffectはnull。
 * @invariant preparedは過去の所有、非使用、人間承認、Native保存または清掃成立を表さない。
 * @boundary 内部回復Ownerだけへ返し、公開結果へ直接投影しない。
 * @security 自由Path、元Token、秘密値と清掃Authorityを含めない。
 * @compatibility 既存のintent revision 2とcaller保存結果を変換せず保持する。
 */
export type HostTerminalCheckpointPreparation<
  Encoded extends
    | EncodedHostTerminalIntent
    | EncodedKnownFixtureHostTerminalIntent = EncodedHostTerminalIntent,
  Observation extends
    | ReturnType<typeof observeHostTerminalWindowsCandidate>
    | ReturnType<
        typeof observeKnownFileHostTerminalWindowsCandidate
      > = ReturnType<typeof observeHostTerminalWindowsCandidate>,
> = Readonly<{
  status: "prepared" | "blocked";
  reason: string;
  reference: string | null;
  observation: Observation | null;
  intent: Encoded | null;
  checkpoint: HostTerminalCallerCheckpointResult | null;
  processEffectIssued: boolean | null;
  helperExitConfirmed: boolean;
  administrativeEffectIssued: boolean | null;
  recordEffectIssued: boolean | null;
  runtimeAuthorityIssued: false;
  cleanupAuthorized: false;
}>;

/**
 * 現在の限定候補を二回確認し、同じ参照で独立caller記録へ保存する。
 *
 * @responsibility 観測から記録への搬送を一つのOwnerで閉じ、失敗・取消でも取得済み参照を失わない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 検証済みRepository、reference／rootName／markerName／bindingsの閉じた入力、評価時点、取消Signalと開発観測Context。
 * @returns 観測・intent・保存を分けた準備結果。未知の保存Effectをfalseへ畳まない。
 * @precondition 上位がRuntime／Repository／選択利用者Hashの実由来を照合済み。参照は一回確定し再試行で再発行しない。
 * @postcondition 二時点の十一実体、marker Hashと利用者が一致した完全intentだけをcaller記録へ渡す。
 * @effect 固定Native読取り最大二回と既存Repository内caller保存。Host対象は変更しない。
 * @failure 入力・Root・利用者・観測の差、不明、取消で保存前停止。保存失敗は同じ参照と結果を保持する。
 * @invariant 保存した二時点snapshotを保存後の現在値、連続排他、空状態、非使用や削除許可と扱わない。
 * @boundary Current／Known観測→intent codec→既存caller保存。Native公開記録と清掃は別の後続Owner。
 * @security 参照やHashから元Authorityを再構成せず、自由Path、任意workerと自己申告Identityを受け付けない。
 * @concurrency Native呼出し前後、保存前、保存待機後に取消を確認する。保存後取消でも保存結果とEffectを消さない。
 */
export async function prepareHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  value: unknown,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
): Promise<HostTerminalCheckpointPreparation> {
  return prepareTerminalRecoveryCheckpoint(
    repository,
    value,
    evaluationTime,
    signal,
    developmentContext,
    createHostTerminalCurrentObservationRequest,
    observeHostTerminalWindowsCandidate,
    encodeHostTerminalIntent,
    saveHostTerminalCallerCheckpoint,
    false,
  );
}

/**
 * 既知fileの二時点観測から同参照の完全caller記録を準備する。
 *
 * @responsibility 十二実体とfile条件を選択Hash・revision 3へ保持し、空クラスへ縮約しない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 検証済みRepository、閉じた固定名・同参照・独立bindings、評価時点、Signalと固定Context。
 * @returns 専用観測・完全intent・caller保存を区別した準備結果。
 * @precondition 上位が三bindingsの由来と対象選択を照合済み。同参照を再発行しない。
 * @postcondition 十二実体とfile三値を二時点確認した完全bytesだけを専用caller保存へ渡す。
 * @effect 固定Native観測最大二回とRepository-local caller保存。Host対象の変更0。
 * @failure 対象差・取消・拒否では保存前停止。保存後の失敗では同参照と部分Effectを保持する。
 * @invariant 選択Hashは相関用であり非使用、承認、現在値、連続保持や削除許可ではない。
 * @boundary 専用観測→専用codec→既存caller保存Owner。
 * @security 任意Path、file、worker、callbackまたは旧記録の自動移行を受け付けない。
 * @concurrency 観測前後・保存前後の取消を確認し、保存済み結果を取消で消さない。
 */
export function prepareKnownFileHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  value: unknown,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
): Promise<
  HostTerminalCheckpointPreparation<
    EncodedKnownFixtureHostTerminalIntent,
    ReturnType<typeof observeKnownFileHostTerminalWindowsCandidate>
  >
> {
  return prepareTerminalRecoveryCheckpoint(
    repository,
    value,
    evaluationTime,
    signal,
    developmentContext,
    createKnownFileHostTerminalCurrentObservationRequest,
    observeKnownFileHostTerminalWindowsCandidate,
    encodeKnownFixtureHostTerminalIntent,
    saveKnownFileHostTerminalCallerCheckpoint,
    true,
  );
}

/**
 * 旧新準備の同参照・部分Effect・保存順を私有Ownerで保持する。
 *
 * @responsibility 固定wrapper依存を使い、観測から正規bytesへ全対象を欠落なく搬送する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Repository、閉入力、時点、Signal、固定Contextとクラス別の観測・codec・保存。
 * @returns 型ごとの観測・intent・保存・既知または不明のEffect。
 * @precondition private helperは旧新wrapperからだけ呼ぶ。依存は利用者選択ではない。
 * @postcondition 旧Hash順を維持し、新クラスにはfile三値と専用domainを結合する。
 * @effect 固定読取りと既存caller保存。処置Authorityを生成しない。
 * @failure 例外では同参照と取得済み値を保持し、開始後のEffect不明をfalseにしない。
 * @invariant 待機前の観測を保存後の現在状態へ昇格しない。
 * @boundary 既存Coordinatorの回復記録準備Owner。
 * @security 生例外・Path・marker本文を公開しない。
 * @concurrency 各境界前後の取消と保存後の部分結果保持を両クラスで共通処置する。
 */
async function prepareTerminalRecoveryCheckpoint<
  Encoded extends
    | EncodedHostTerminalIntent
    | EncodedKnownFixtureHostTerminalIntent,
  Observation extends
    | ReturnType<typeof observeHostTerminalWindowsCandidate>
    | ReturnType<typeof observeKnownFileHostTerminalWindowsCandidate>,
>(
  repository: VerifiedRepositoryRoot,
  value: unknown,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext: unknown,
  createCurrentRequest: typeof createHostTerminalCurrentObservationRequest,
  observeCandidate: (
    request: NonNullable<
      ReturnType<typeof createHostTerminalCurrentObservationRequest>
    >,
    time: unknown,
    context?: unknown,
    signal?: AbortSignal,
  ) => Observation,
  encode: (value: unknown) => Encoded,
  save: typeof saveHostTerminalCallerCheckpoint,
  hasKnownFile: boolean,
): Promise<HostTerminalCheckpointPreparation<Encoded, Observation>> {
  let reference: string | null = null;
  let observation: Observation | null = null;
  let intent: Encoded | null = null;
  let checkpoint: HostTerminalCallerCheckpointResult | null = null;
  let isObservationStarted = false;
  let isSaveStarted = false;
  /**
   * 準備の停止結果に取得済み参照と部分結果を保持する。
   *
   * @responsibility 下位保存の結果と不明Effectを失敗理由から分離する。
   * @trace ARCH-000008
   * @trace ARCH-000011
   * @input 固定された停止理由。
   * @returns 同参照と保持済み観測・記録結果。
   * @precondition 同じ準備呼出しの局所状態だけを参照する。
   * @postcondition 保存開始後の結果欠落をEffectなしへ変換しない。
   * @effect N/A: 不変の返却値を構成するだけ。
   * @failure N/A: 外部処置を発行しない。
   * @invariant blockedから再試行やAuthorityを発行しない。
   * @boundary 同じOwner内の停止処理。
   * @security 生入力、Pathまたは例外本文を公開しない。
   * @concurrency await後の保持状態を読み、追加の非同期操作を開始しない。
   */
  const stopped = (
    reason: string,
  ): HostTerminalCheckpointPreparation<Encoded, Observation> =>
    Object.freeze({
      status: "blocked",
      reason,
      reference,
      observation,
      intent,
      checkpoint,
      processEffectIssued:
        observation?.processEffectIssued ??
        (isObservationStarted ? null : false),
      helperExitConfirmed:
        observation?.helperExitConfirmed ?? !isObservationStarted,
      administrativeEffectIssued:
        checkpoint?.administrativeEffectIssued ??
        (isSaveStarted ? null : false),
      recordEffectIssued:
        checkpoint?.recordEffectIssued ?? (isSaveStarted ? null : false),
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  try {
    const input = snapshotPlainRecord(
      value,
      new Set(["reference", "rootName", "markerName", "bindings"] as const),
    );
    if (
      !input ||
      typeof input.reference !== "string" ||
      !REFERENCE.test(input.reference)
    )
      return stopped("host_terminal_preparation_input_invalid");
    reference = input.reference;
    const fields = snapshotPlainRecord(
      input.bindings,
      new Set([
        "runtimeSha256",
        "repositorySha256",
        "selectedUserSha256",
      ] as const),
    );
    if (
      !fields ||
      Object.values(fields).some(
        (hash) =>
          typeof hash !== "string" ||
          !/^[a-f0-9]{64}$/u.test(hash) ||
          /^0{64}$/u.test(hash),
      )
    )
      return stopped("host_terminal_preparation_bindings_invalid");
    const bindings = Object.freeze({ ...fields }) as HostTerminalCallerBindings;
    if (!resolveHostTerminalLegacyGeneration(input.rootName, input.markerName))
      return stopped("host_terminal_preparation_generation_invalid");
    if (!resolveRepositoryRuntimeDataPaths(repository))
      return stopped("host_terminal_preparation_repository_invalid");
    const request = createCurrentRequest({
      rootName: input.rootName,
      markerName: input.markerName,
    });
    if (!request) return stopped("host_terminal_preparation_target_invalid");
    if (signal.aborted) return stopped("host_terminal_preparation_cancelled");
    isObservationStarted = true;
    observation = observeCandidate(
      request,
      evaluationTime,
      developmentContext,
      signal,
    );
    const snapshot = observation.knownObservation?.snapshot;
    if (observation.status !== "observed" || !snapshot)
      return stopped(observation.reason);
    if (snapshot.selectedUserSha256 !== bindings.selectedUserSha256)
      return stopped("host_terminal_preparation_user_mismatch");
    const [
      parentIdentity,
      recoveryDirectoryIdentity,
      terminalDirectoryIdentity,
      rootIdentity,
      markerIdentity,
      workspace,
      providerHome,
      temporary,
      events,
      projection,
      management,
      knownFileIdentity,
    ] = snapshot.identities;
    if (
      !parentIdentity ||
      !recoveryDirectoryIdentity ||
      !terminalDirectoryIdentity ||
      !rootIdentity ||
      !markerIdentity ||
      !workspace ||
      !providerHome ||
      !temporary ||
      !events ||
      !projection ||
      !management ||
      (hasKnownFile && (!knownFileIdentity || !("knownFile" in snapshot)))
    )
      return stopped("host_terminal_preparation_snapshot_incomplete");
    const selectionValues = [
      input.rootName,
      input.markerName,
      snapshot.identities.map((identity) => [
        identity.volumeSerial,
        identity.fileIndexHigh,
        identity.fileIndexLow,
        identity.creationTimeHigh,
        identity.creationTimeLow,
        identity.attributes,
      ]),
      snapshot.markerSha256,
      bindings.runtimeSha256,
      bindings.repositorySha256,
      bindings.selectedUserSha256,
    ];
    if (hasKnownFile && "knownFile" in snapshot)
      selectionValues.push([
        snapshot.knownFile.byteLength,
        snapshot.knownFile.linkCount,
        snapshot.knownFile.sha256,
      ]);
    const selectionSnapshotSha256 = createHash("sha256")
      .update(
        hasKnownFile
          ? "crdd/host-terminal-known-file-selection/v1\0"
          : "crdd/host-terminal-selection/v1\0",
        "utf8",
      )
      .update(JSON.stringify(selectionValues), "utf8")
      .digest("hex");
    intent = encode({
      contract: "crdd-coordinator/host-terminal-intent",
      contractRevision: hasKnownFile ? 3 : 2,
      ...(hasKnownFile ? { resourceClass: "known_fixture_host_only_v1" } : {}),
      reference,
      producer: {
        kind: "human_orphan_cleanup",
        selectionSnapshotSha256,
        originalReferenceUnknownReason: "original_reference_unconfirmed",
      },
      bindings,
      target: {
        parentIdentity,
        recoveryDirectoryIdentity,
        terminalDirectoryIdentity,
        root: { name: input.rootName, identity: rootIdentity },
        marker: {
          name: input.markerName,
          identity: markerIdentity,
          sha256: snapshot.markerSha256,
        },
        children: {
          workspace,
          "provider-home": providerHome,
          tmp: temporary,
          events,
          projection,
          management,
        },
        ...(hasKnownFile && "knownFile" in snapshot
          ? {
              knownFile: {
                parent: "workspace",
                name: "fixture.txt",
                identity: knownFileIdentity,
                ...snapshot.knownFile,
              },
            }
          : {}),
      },
      cleanupOrder: hasKnownFile
        ? ["file_absence", "root_absence", "marker_absence", "lease_terminal"]
        : ["root_absence", "marker_absence", "lease_terminal"],
    });
    if (signal.aborted) return stopped("host_terminal_preparation_cancelled");
    isSaveStarted = true;
    checkpoint = await save(repository, intent.intent, bindings, signal);
    if (checkpoint.status !== "saved") return stopped(checkpoint.reason);
    if (signal.aborted) return stopped("host_terminal_preparation_cancelled");
    return Object.freeze({
      ...stopped("host_terminal_checkpoint_prepared"),
      status: "prepared",
    });
  } catch {
    return stopped("host_terminal_preparation_unconfirmed");
  }
}

/**
 * 同一の非link実体を比較する。
 *
 * @responsibility Nodeのcallerファイル世代を前後検査し、Win32 Identityへ変換しない。
 * @trace ARCH-000008
 * @input 二つのbigint stat。
 * @returns 通常file、同じdev／ino／birthtimeとsizeの一致。
 * @precondition N/A: 不一致・不正実体を拒否するための比較である。
 * @postcondition stat値だけを読む。
 * @effect N/A: 外部操作を発行しない。
 * @failure N/A: 不一致はfalse。
 * @invariant この比較はNative保存・過去receipt・非使用を証明しない。
 * @boundary Repository内caller fileの局所観測。
 * @security symlinkと通常file以外を成功へ畳まない。
 * @concurrency 同期比較で共有状態を変更しない。
 */
function sameFile(a: fs.BigIntStats, b: fs.BigIntStats): boolean {
  return (
    a.isFile() &&
    b.isFile() &&
    !a.isSymbolicLink() &&
    !b.isSymbolicLink() &&
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.birthtimeNs === b.birthtimeNs &&
    a.size === b.size
  );
}

/**
 * 固定caller Directoryの全segmentを現在確認する。
 *
 * @responsibility Root外・link・別実体を保存先へ採用しない。
 * @trace ARCH-000008
 * @input 検証済みRepository capability。
 * @returns 固定caller Directory。
 * @precondition Directoryは呼出し側が別の管理Effectとして作成済み。
 * @postcondition 保存先の全segmentを現在観測する。
 * @effect lstatとrealpathの読取り。
 * @failure 未作成、link、非Directory、別realpathは停止。
 * @invariant 任意のPathや自由なsubdirectoryを入力にしない。
 * @boundary Repository Rootから固定保存Directoryまで。
 * @security 検査結果はWindows ACLや連続handle保護の証明ではない。
 * @concurrency mutation lease内でもEffect前後に再確認する。
 */
function resolveCheckpointDirectory(
  repository: VerifiedRepositoryRoot,
): string {
  const paths = resolveRepositoryRuntimeDataPaths(repository);
  if (!paths) throw new Error("host_terminal_caller_root_invalid");
  const directory = path.join(paths.coordinator, "recovery", "host-terminal");
  let current = paths.repositoryRoot;
  for (const segment of path
    .relative(paths.repositoryRoot, directory)
    .split(path.sep)) {
    current = path.join(current, segment);
    const entryStat = fs.lstatSync(current);
    if (
      !entryStat.isDirectory() ||
      entryStat.isSymbolicLink() ||
      fs.realpathSync(current).toLowerCase() !== current.toLowerCase()
    )
      throw new Error("host_terminal_caller_directory_invalid");
  }
  return current;
}

/**
 * 一つのcaller記録を完全bytesで読み、descriptor終了を確認する。
 *
 * @responsibility 部分file・差替え・過大値・結合差を現在候補にしない。
 * @trace ARCH-000008
 * @input 固定Directory、exact参照、独立期待bindingsと保存Ownerへのclose失敗通知。
 * @returns 検証済み正規bytesと現在intent。
 * @precondition 保存先の固定segmentを呼出し直前に検証する。
 * @postcondition reader descriptorを明示closeしてから返す。
 * @effect exact canonical fileの読取り。stageや記録を削除・修復しない。
 * @failure stage併存、部分bytes、link、実体差、結合差またはclose失敗は停止。共同失敗でもclose未確認を保持する。
 * @invariant 記録自身から期待bindingや過去receiptを作らない。
 * @boundary caller独立bytesからNative現在候補へ渡す前段。
 * @security 参照形式以外からPathを作らず、非Authority値だけを返す。
 * @concurrency 前後statとdescriptor実体を比較し、未知を不存在へ畳まない。
 */
function readCheckpoint(
  directory: string,
  reference: string,
  bindings: HostTerminalCallerBindings,
  reportCloseFailure?: () => void,
): EncodedHostTerminalIntent {
  return readTerminalCheckpoint(
    directory,
    reference,
    bindings,
    decodeHostTerminalIntent,
    reportCloseFailure,
  );
}

/**
 * クラス固有codecで同参照の完全bytesをfresh読取りする。
 *
 * @responsibility 実readerと前後実体・独立bindingsを照合し、未確認closeを保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 固定Directory、参照、独立bindingsと内部専用decoder。
 * @returns クラスを保持した正規記録。
 * @precondition decoderは用途限定入口が固定し外部から受け取らない。
 * @postcondition 同参照・bytes・実体を確認し、descriptor終了後に返す。
 * @effect exact canonicalの読取りだけ。
 * @failure 混用、部分bytes、差異、stage併存、close未確認は例外停止。
 * @invariant 記録から期待bindingsやAuthorityを生成しない。
 * @boundary private caller Reader。
 * @security Pathと本文を公開せず、記録や元対象を修復しない。
 * @concurrency 同期readerの前後観測を維持する。
 */
function readTerminalCheckpoint<
  Encoded extends
    | EncodedHostTerminalIntent
    | EncodedKnownFixtureHostTerminalIntent,
>(
  directory: string,
  reference: string,
  bindings: HostTerminalCallerBindings,
  decode: (value: unknown) => Encoded,
  reportCloseFailure?: () => void,
): Encoded {
  if (!REFERENCE.test(reference))
    throw new Error("host_terminal_caller_reference_invalid");
  try {
    fs.lstatSync(path.join(directory, `${reference}.stage`));
    throw new Error("host_terminal_caller_stage_retained");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const file = path.join(directory, `${reference}.json`);
  const before = fs.lstatSync(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0n ||
    before.size > 8_192n ||
    before.nlink !== 1n
  )
    throw new Error("host_terminal_caller_file_invalid");
  const fd = fs.openSync(file, "r");
  let encoded: Encoded | undefined;
  let readFailure: unknown;
  let isReadFailed = false;
  let isCloseFailed = false;
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!sameFile(before, opened))
      throw new Error("host_terminal_caller_identity_changed");
    const bytes = Buffer.alloc(Number(opened.size) + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        fd,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count === 0) break;
      offset += count;
    }
    if (
      offset !== Number(opened.size) ||
      !sameFile(opened, fs.fstatSync(fd, { bigint: true })) ||
      !sameFile(opened, fs.lstatSync(file, { bigint: true }))
    )
      throw new Error("host_terminal_caller_read_changed");
    encoded = decode(bytes.subarray(0, offset));
    if (
      encoded.intent.reference !== reference ||
      encoded.intent.bindings.runtimeSha256 !== bindings.runtimeSha256 ||
      encoded.intent.bindings.repositorySha256 !== bindings.repositorySha256 ||
      encoded.intent.bindings.selectedUserSha256 !== bindings.selectedUserSha256
    )
      throw new Error("host_terminal_caller_binding_mismatch");
  } catch (error) {
    isReadFailed = true;
    readFailure = error;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      isCloseFailed = true;
      reportCloseFailure?.();
    }
  }
  if (isCloseFailed)
    throw new Error("host_terminal_caller_reader_close_unconfirmed", {
      cause: isReadFailed ? readFailure : undefined,
    });
  if (isReadFailed) throw readFailure;
  if (!encoded) throw new Error("host_terminal_caller_read_unconfirmed");
  return encoded;
}

/**
 * fresh Processから同じcaller参照を現在検証する。
 *
 * @responsibility 読取りだけで独立full bytesを取得し、stage復元・再公開をしない。
 * @trace ARCH-000008
 * @input Repository capability、既知参照と独立期待bindings。
 * @returns 現在検証した完全intent。
 * @precondition 上位が参照と期待bindingの由来を保持する。
 * @postcondition 保存先を前後検査し、readerを終端して返す。
 * @effect 固定caller保存先の読取りだけ。
 * @failure 取得不能と不存在を例外として保持し、空記録へ畳まない。
 * @invariant 過去flush・Native保存・非使用を証明しない。
 * @boundary fresh callerからNative再観測へ渡す内部境界。
 * @security 記録からAuthorityや元Task Tokenを生成しない。
 * @concurrency immutable canonical fileだけを読み、write leaseは取得しない。
 */
export function readHostTerminalCallerCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
): EncodedHostTerminalIntent {
  const directory = resolveCheckpointDirectory(repository);
  const result = readCheckpoint(directory, reference, bindings);
  resolveCheckpointDirectory(repository);
  return result;
}

/**
 * 十二実体caller記録を同参照の専用codecで読戻す。
 *
 * @responsibility file実体と完全正規bytesを旧形式へ落とさない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Repository capability、参照と独立bindings。
 * @returns revision 3の完全正規記録。
 * @precondition 期待値と参照の由来は上位Ownerが保持する。
 * @postcondition 固定保存先の前後確認とreader終了を要求する。
 * @effect Repository内のexact記録読取りだけ。
 * @failure 旧Schema、実体差、bindings差、stage併存は停止。
 * @invariant Root／fileの現在存在、非使用、削除許可を推定しない。
 * @boundary caller→専用Native接続前段。
 * @security Authority、Path、秘密を公開しない。
 * @concurrency immutable記録をfresh読む。
 */
export function readKnownFileHostTerminalCallerCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
): EncodedKnownFixtureHostTerminalIntent {
  const directory = resolveCheckpointDirectory(repository);
  const result = readTerminalCheckpoint(
    directory,
    reference,
    bindings,
    decodeKnownFixtureHostTerminalIntent,
  );
  resolveCheckpointDirectory(repository);
  return result;
}

/**
 * 同参照のcaller canonicalをfresh読取りして保護済みNative記録へ接続する。
 *
 * @responsibility 自己申告のsaved Objectではなく、完全bytesと独立bindingsを保存前後に確認する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 検証済みRepository、既知参照、独立bindings、署名評価時点、取消Signalと固定開発Context。
 * @returns 同参照、caller再確認、Native部分結果と共同成立。
 * @precondition caller canonicalは同じ参照で保存済み。対象由来・非使用・清掃許可は別契約。
 * @postcondition readerまたはNative不明でも同参照と保存Effectを保持し、新規保存へ戻らない。
 * @effect caller記録を読み、固定Nativeへ一回の保存または読戻し要求。readは記録変更0、両modeともRoot/marker/child変更0。
 * @failure 参照・bindings・bytes差、取消、Native搬送・記録操作・終了不明では停止する。
 * @invariant この保存結果からTask再開・削除Authorityを発行しない。
 * @boundary Repository内caller canonical→保護済みNative記録。
 * @security 自由Path、本文の公開、ACL修復、別UUID発行または自動再送を行わない。
 * @concurrency 正規bytesを同期copyし、Native前後に同じcanonicalを再確認する。
 */
function connectHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
  mode: "save" | "read",
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
  recordClass: "eleven" | "known_file" = "eleven",
) {
  let nativeSave:
    | ReturnType<typeof saveHostTerminalWindowsRecord>
    | ReturnType<typeof saveKnownFileHostTerminalWindowsRecord>
    | null = null;
  let nativeRead:
    | ReturnType<typeof readHostTerminalWindowsRecord>
    | ReturnType<typeof readKnownFileHostTerminalWindowsRecord>
    | null = null;
  let isNativeCallStarted = false;
  let isCallerVerifiedBeforeAndAfter = false;
  /**
   * 読取りと保存の共同未成立を同参照で返す。
   *
   * @responsibility Nativeの部分保存をcaller確認の失敗で消さない。
   * @trace ARCH-000008
   * @trace ARCH-000011
   * @input 固定停止理由。
   * @returns 現在の同参照・Native結果とEffect。
   * @precondition 上位から渡された参照を別UUIDへ置換しない。
   * @postcondition 既知参照と部分receiptを保持する。
   * @effect N/A: 結果構築のみ。
   * @failure N/A: 停止済み処理の結果を返す。
   * @invariant 未読取りを保存、Native保存を清掃成功へ畳まない。
   * @boundary caller Owner→上位回復Owner。
   * @security Authority、Path、本文を公開しない。
   * @concurrency 同期Owner内の現在値を固定する。
   */
  const stopped = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      reference:
        typeof reference === "string" && REFERENCE.test(reference)
          ? reference
          : null,
      callerVerifiedBeforeAndAfter: isCallerVerifiedBeforeAndAfter,
      nativeSave,
      nativeRead,
      processEffectIssued:
        (nativeSave ?? nativeRead)?.processEffectIssued ??
        (isNativeCallStarted ? null : false),
      recordEffectIssued:
        mode === "read"
          ? false
          : (nativeSave?.recordEffectIssued ??
            (isNativeCallStarted ? null : false)),
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  try {
    if (typeof reference !== "string" || !REFERENCE.test(reference))
      return stopped("host_terminal_caller_reference_invalid");
    const expected = snapshotPlainRecord(
      bindings,
      new Set([
        "runtimeSha256",
        "repositorySha256",
        "selectedUserSha256",
      ] as const),
    );
    if (
      !expected ||
      Object.values(expected).some(
        (value) =>
          typeof value !== "string" ||
          !/^[a-f0-9]{64}$/u.test(value) ||
          /^0{64}$/u.test(value),
      )
    )
      return stopped("host_terminal_caller_binding_invalid");
    const fixedBindings = Object.freeze(expected) as HostTerminalCallerBindings;
    if (signal.aborted)
      return stopped(
        mode === "save"
          ? "host_terminal_publication_cancelled"
          : "host_terminal_readback_cancelled",
      );
    const reader =
      recordClass === "eleven"
        ? readHostTerminalCallerCheckpoint
        : readKnownFileHostTerminalCallerCheckpoint;
    const before = reader(repository, reference, fixedBindings);
    const request =
      mode === "save"
        ? (recordClass === "eleven"
            ? createHostTerminalSaveRequest
            : createKnownFileHostTerminalSaveRequest)(before.intent)
        : (recordClass === "eleven"
            ? createHostTerminalReadRequest
            : createKnownFileHostTerminalReadRequest)(before.intent);
    if (!request || request.reference !== reference)
      return stopped(
        mode === "save"
          ? "host_terminal_save_request_invalid"
          : "host_terminal_read_request_invalid",
      );
    if (signal.aborted)
      return stopped(
        mode === "save"
          ? "host_terminal_publication_cancelled"
          : "host_terminal_readback_cancelled",
      );
    isNativeCallStarted = true;
    if (mode === "save")
      nativeSave = (
        recordClass === "eleven"
          ? saveHostTerminalWindowsRecord
          : saveKnownFileHostTerminalWindowsRecord
      )(request, evaluationTime, signal, developmentContext);
    else
      nativeRead = (
        recordClass === "eleven"
          ? readHostTerminalWindowsRecord
          : readKnownFileHostTerminalWindowsRecord
      )(request, evaluationTime, signal, developmentContext);
    const after = reader(repository, reference, fixedBindings);
    isCallerVerifiedBeforeAndAfter =
      before.serialized === after.serialized && before.sha256 === after.sha256;
    if (!isCallerVerifiedBeforeAndAfter)
      return stopped("host_terminal_caller_changed");
    if (mode === "save" && nativeSave?.status !== "saved")
      return stopped(
        nativeSave?.reason ?? "host_terminal_publication_unconfirmed",
      );
    if (mode === "read" && nativeRead?.status !== "observed")
      return stopped(
        nativeRead?.reason ?? "host_terminal_readback_unconfirmed",
      );
    if (signal.aborted)
      return stopped(
        mode === "save"
          ? "host_terminal_publication_cancelled"
          : "host_terminal_readback_cancelled",
      );
    return Object.freeze({
      ...stopped(
        mode === "save"
          ? "host_terminal_checkpoint_published"
          : "host_terminal_checkpoint_observed",
      ),
      status: "completed" as const,
    });
  } catch (error) {
    return stopped(
      error instanceof Error &&
        /^host_terminal_caller_[a-z_]+$/u.test(error.message)
        ? error.message
        : mode === "save"
          ? "host_terminal_publication_unconfirmed"
          : "host_terminal_readback_unconfirmed",
    );
  }
}

/**
 * 同参照のcaller canonicalからNative保存へ接続する。
 *
 * @responsibility 保存前後の独立完全bytesを確認する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 検証済みRepository、既知参照、独立bindings、評価時点、取消と開発Context。
 * @returns savedまたは同参照・部分結果付き停止。
 * @precondition caller canonicalは保存済み。非使用と処置権限は別確認。
 * @postcondition 保存receiptとcaller前後照合の共同成立後だけsaved。
 * @effect 固定Native記録の保存だけ。対象変更0。
 * @failure 取得・搬送・保存・終了不明は同参照で停止。
 * @invariant 保存結果を清掃許可にしない。
 * @boundary caller canonical→Native保存。
 * @security 自動再送、別UUID、ACL修復、本文公開なし。
 * @concurrency 同期接続前後の取消確認。
 */
export function publishHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = connectHostTerminalRecoveryCheckpoint(
    repository,
    reference,
    bindings,
    "save",
    evaluationTime,
    signal,
    developmentContext,
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed" ? ("saved" as const) : ("blocked" as const),
  });
}

/**
 * 同参照caller canonicalから現在Native記録を読戻す。
 *
 * @responsibility 応答喪失後も同じ完全bytesへ結合し、現在事実を履歴と分離する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 検証済みRepository、既知参照、独立bindings、評価時点、取消と開発Context。
 * @returns observedまたは同参照・現在記録receipt付き停止。
 * @precondition caller canonicalは独立保持済み。Root等の現存を前提にしない。
 * @postcondition caller前後同一、Native読取り/終了共同成立後だけobserved。
 * @effect callerと固定Native記録の読取りのみ。記録/対象変更0。
 * @failure bytes差、取消、搬送・照合・終了不明を同参照で停止。
 * @invariant 記録観測を過去成功、非使用、清掃権限へ変換しない。
 * @boundary caller canonical→Native現在記録Reader。
 * @security 自由Path、再保存、復元、旧Token、本文公開なし。
 * @concurrency 同期接続前後にcallerと取消を再確認する。
 */
export function readHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = connectHostTerminalRecoveryCheckpoint(
    repository,
    reference,
    bindings,
    "read",
    evaluationTime,
    signal,
    developmentContext,
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed"
        ? ("observed" as const)
        : ("blocked" as const),
  });
}

/**
 * 同じHost終端参照の独立caller checkpointを保存する。
 *
 * @responsibility 容量計数から非置換公開・再読取りまで同一Processの排他で閉じる。
 * @trace ARCH-000008
 * @input Repository capability、完全intent、独立期待bindingsと取消Signal。
 * @returns 同参照、保存状態、管理／記録Effectと個別終端確認。
 * @precondition 上位がproducerと十一実体の実由来を照合済みである。
 * @postcondition 部分失敗でも同じ参照とEffect可能性を保持する。
 * @effect Ignore確認・固定Directory初期化、CREATE_NEW、write、flush、非置換link公開と自分のstage除去。
 * @failure 容量・未知entry・衝突・差異・取消・reader／writer終了不明ではblocked。存在観測後の消失で新規作成へ戻らない。
 * @invariant Native記録、旧Root、marker、Provider、Task状態を処置しない。
 * @boundary Repository内caller保存だけ。OS保護済みNative保存とは別Owner。
 * @security 保存自体を清掃Authorityまたは処置成功へ昇格しない。
 * @concurrency 取得だけasync。実保存はawaitのない同期区間で所有pipeを保持する。
 */
export async function saveHostTerminalCallerCheckpoint(
  repository: VerifiedRepositoryRoot,
  value: unknown,
  bindings: HostTerminalCallerBindings,
  signal: AbortSignal,
): Promise<HostTerminalCallerCheckpointResult> {
  const encoded = encodeHostTerminalIntent(value);
  return saveTerminalCallerCheckpoint(
    repository,
    encoded,
    bindings,
    signal,
    decodeHostTerminalIntent,
  );
}

/**
 * 十二実体callerから同参照のNative保存へ接続する。
 *
 * @responsibility 保存前後の完全bytesとfile条件を保持し部分保存を失わない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Repository capability、参照、独立bindings、評価時点、Signalと開発Context。
 * @returns saved、または同参照の部分結果付き停止。
 * @precondition 専用caller canonicalを保存済み。由来・非使用・処置権限は別確認。
 * @postcondition caller前後一致とNative共同成立を要求する。
 * @effect 固定Nativeによる限定記録保存。対象変更なし。
 * @failure bytes差、混用、取消、搬送不明では同参照で停止。
 * @invariant 保存は清掃許可や実回復完成ではない。
 * @boundary 専用caller記録→専用Native保存。
 * @security 別参照、再送、自由Path、Provider依頼なし。
 * @concurrency 同期接続前後で取消とcallerを再確認する。
 */
export function publishKnownFileHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = connectHostTerminalRecoveryCheckpoint(
    repository,
    reference,
    bindings,
    "save",
    evaluationTime,
    signal,
    developmentContext,
    "known_file",
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed" ? ("saved" as const) : ("blocked" as const),
  });
}

/**
 * 十二実体callerから対象未取得でNative記録を読戻す。
 *
 * @responsibility 同参照と現在記録を保持し元対象消失後も再照合する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Repository capability、参照、独立bindings、評価時点、Signalと開発Context。
 * @returns observed、または同参照の部分結果付き停止。
 * @precondition 専用caller記録が独立保持されている。
 * @postcondition caller前後一致、Native現在状態と全終了共同成立を要求する。
 * @effect callerと固定Native記録の読取りだけ。
 * @failure 旧形式、差異、取消、reader／搬送不明では同参照で停止。
 * @invariant Root未試行を不存在、非使用、清掃権限へ昇格しない。
 * @boundary 専用caller記録→専用Native Reader。
 * @security 復元、再保存、本文公開、自由Path、Authorityなし。
 * @concurrency 同期接続前後で取消と完全bytesを確認する。
 */
export function readKnownFileHostTerminalRecoveryCheckpoint(
  repository: VerifiedRepositoryRoot,
  reference: string,
  bindings: HostTerminalCallerBindings,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = connectHostTerminalRecoveryCheckpoint(
    repository,
    reference,
    bindings,
    "read",
    evaluationTime,
    signal,
    developmentContext,
    "known_file",
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed"
        ? ("observed" as const)
        : ("blocked" as const),
  });
}

/**
 * 十二実体caller記録を同参照・非置換で保存する。
 *
 * @responsibility file条件を完全bytesへ保持し、旧クラスの既存記録を上書きしない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Repository capability、新クラス完全候補、独立bindingsと取消Signal。
 * @returns 同参照、部分Effectとlease終了付き保存結果。
 * @precondition 上位が十二実体の期待値の由来を照合済み。
 * @postcondition 保存・読戻し・全終了共同成立だけsavedとする。
 * @effect Repository-local記録の初期化、stage、flush、非置換公開。
 * @failure クラス差、同参照差、容量、取消、実体差または終了不明は停止。
 * @invariant Native保存、元対象削除、非使用またはAuthorityは発行しない。
 * @boundary Repository-local caller保存だけ。
 * @security 自由Path、Provider、OS保存場所の変更へ接続しない。
 * @concurrency 共通caller leaseで新旧保存を直列化する。
 */
export async function saveKnownFileHostTerminalCallerCheckpoint(
  repository: VerifiedRepositoryRoot,
  value: unknown,
  bindings: HostTerminalCallerBindings,
  signal: AbortSignal,
): Promise<HostTerminalCallerCheckpointResult> {
  const encoded = encodeKnownFixtureHostTerminalIntent(value);
  return saveTerminalCallerCheckpoint(
    repository,
    encoded,
    bindings,
    signal,
    decodeKnownFixtureHostTerminalIntent,
  );
}

/**
 * 固定codecの完全bytesを共通容量・leaseで非置換保存する。
 *
 * @responsibility クラスごとの読戻しを保持し、部分保存と終了未確認を消さない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Repository capability、検証済み正規記録、独立bindings、Signalと専用decoder。
 * @returns 同参照の保存状態と発行済みEffect。
 * @precondition 内部専用入口がcodecと完全記録を同じクラスへ固定する。
 * @postcondition 既存一致または非置換公開後のfresh一致を要求する。
 * @effect 用途限定Repository内stageとcanonicalの作成・読取り。
 * @failure 不明、差異、容量、衝突、取消または終了未確認はblocked。
 * @invariant 別参照、旧新変換、元対象の清掃をしない。
 * @boundary private caller保存Owner。
 * @security 本文やPathを公開せず、OS Native保存Authorityを生成しない。
 * @concurrency 取得だけasync、同期保存区間で同じleaseを保持する。
 */
async function saveTerminalCallerCheckpoint<
  Encoded extends
    | EncodedHostTerminalIntent
    | EncodedKnownFixtureHostTerminalIntent,
>(
  repository: VerifiedRepositoryRoot,
  encoded: Encoded,
  bindings: HostTerminalCallerBindings,
  signal: AbortSignal,
  decode: (value: unknown) => Encoded,
): Promise<HostTerminalCallerCheckpointResult> {
  const reference = encoded.intent.reference;
  if (
    encoded.intent.bindings.runtimeSha256 !== bindings.runtimeSha256 ||
    encoded.intent.bindings.repositorySha256 !== bindings.repositorySha256 ||
    encoded.intent.bindings.selectedUserSha256 !== bindings.selectedUserSha256
  )
    throw new Error("host_terminal_caller_binding_mismatch");
  const lease = acquireHostTerminalCallerLease(repository, signal);
  let administrativeEffectIssued = false;
  let recordEffectIssued = false;
  let handlesCloseConfirmed = true;
  let reason = "host_terminal_caller_lease_unavailable";
  let isSaved = false;
  let runtimeDataBlock: HostTerminalCallerCheckpointResult["runtimeDataBlock"] =
    null;
  /**
   * reader終了の未確認を保存結果へ単調に保持する。
   *
   * @responsibility 既存読取りと公開後読取りのclose失敗を共通Ownerへ渡す。
   * @trace ARCH-000008
   * @input N/A: close失敗時だけ呼ばれる引数なし通知。
   * @returns N/A: 終了確認fieldをfalseへ更新する。
   * @precondition 保存Ownerが同じ取得済参照を保持している。
   * @postcondition 後の正常通知から終了確認をtrueへ戻さない。
   * @effect N/A: 外部処置やclose再試行を発行しない。
   * @failure N/A: 単調な局所代入だけを行う。
   * @invariant read失敗と共同発生してもclose未確認を失わない。
   * @boundary 私有readerから同じ保存Ownerへの通知。
   * @security 清掃成功、再公開許可やAuthorityを作らない。
   * @concurrency 同期readerのfinallyから同じProcess内で呼ぶ。
   */
  const reportReaderCloseFailure = () => {
    handlesCloseConfirmed = false;
  };
  try {
    const acquired = await lease.acquired;
    if (acquired.status !== "acquired" || signal.aborted || !lease.isHeld())
      throw new Error(reason);
    administrativeEffectIssued = true;
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataArea(repository, "coordinator"),
      "host_terminal_caller_area_unready",
    );
    let directory = area.directory;
    for (const segment of ["recovery", "host-terminal"]) {
      directory = path.join(directory, segment);
      try {
        fs.mkdirSync(directory, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const entryStat = fs.lstatSync(directory);
      if (
        !entryStat.isDirectory() ||
        entryStat.isSymbolicLink() ||
        fs.realpathSync(directory).toLowerCase() !== directory.toLowerCase()
      )
        throw new Error("host_terminal_caller_directory_invalid");
    }
    resolveCheckpointDirectory(repository);
    const canonical = path.join(directory, `${reference}.json`);
    let isCanonicalPresent = true;
    try {
      fs.lstatSync(canonical);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      isCanonicalPresent = false;
    }
    if (isCanonicalPresent) {
      const existing = readTerminalCheckpoint(
        directory,
        reference,
        bindings,
        decode,
        reportReaderCloseFailure,
      );
      if (existing.serialized !== encoded.serialized)
        throw new Error("host_terminal_caller_conflict");
      isSaved = true;
    }
    if (!isSaved) {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      if (entries.length + 2 > MAX_ENTRIES)
        throw new Error("host_terminal_caller_capacity_exceeded");
      let bytes = 0;
      for (const entry of entries) {
        const entryStat = fs.lstatSync(path.join(directory, entry.name));
        if (
          !RECORD_NAME.test(entry.name) ||
          !entry.isFile() ||
          !entryStat.isFile() ||
          entryStat.isSymbolicLink() ||
          entryStat.size < 0 ||
          entryStat.size > 8_192
        )
          throw new Error("host_terminal_caller_inventory_unknown");
        bytes += entryStat.size;
      }
      const serialized = Buffer.from(encoded.serialized, "utf8");
      if (bytes + 2 * serialized.length > MAX_BYTES)
        throw new Error("host_terminal_caller_capacity_exceeded");
      if (signal.aborted || !lease.isHeld())
        throw new Error("host_terminal_caller_lease_lost");
      const stage = path.join(directory, `${reference}.stage`);
      recordEffectIssued = true;
      const fd = fs.openSync(stage, "wx+", 0o600);
      try {
        let offset = 0;
        while (offset < serialized.length) {
          const count = fs.writeSync(
            fd,
            serialized,
            offset,
            serialized.length - offset,
            offset,
          );
          if (count === 0)
            throw new Error("host_terminal_caller_write_incomplete");
          offset += count;
        }
        fs.fsyncSync(fd);
        const current = fs.fstatSync(fd, { bigint: true });
        const observed = Buffer.alloc(serialized.length + 1);
        const count = fs.readSync(fd, observed, 0, observed.length, 0);
        if (
          count !== serialized.length ||
          !observed.subarray(0, count).equals(serialized) ||
          current.nlink !== 1n ||
          !sameFile(current, fs.lstatSync(stage, { bigint: true }))
        )
          throw new Error("host_terminal_caller_write_unconfirmed");
        resolveCheckpointDirectory(repository);
        fs.linkSync(stage, canonical);
        if (
          !sameFile(current, fs.lstatSync(canonical, { bigint: true })) ||
          !sameFile(current, fs.lstatSync(stage, { bigint: true }))
        )
          throw new Error("host_terminal_caller_publication_unconfirmed");
      } finally {
        try {
          fs.closeSync(fd);
        } catch {
          handlesCloseConfirmed = false;
        }
      }
      if (!handlesCloseConfirmed)
        throw new Error("host_terminal_caller_close_unconfirmed");
      fs.unlinkSync(stage);
      const observed = readTerminalCheckpoint(
        directory,
        reference,
        bindings,
        decode,
        reportReaderCloseFailure,
      );
      if (observed.serialized !== encoded.serialized)
        throw new Error("host_terminal_caller_readback_mismatch");
      resolveCheckpointDirectory(repository);
      isSaved = true;
    }
    reason = "host_terminal_caller_checkpoint_saved";
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      runtimeDataBlock = Object.freeze({
        reason: error.reason,
        effectIssued: error.effectIssued,
        effectStateUnknown: error.effectStateUnknown,
        cleanupConfirmed: error.cleanupConfirmed,
        retryAllowed: error.retryAllowed,
        recoveryReference: error.recoveryReference,
      });
    reason =
      error instanceof Error &&
      /^host_terminal_caller_[a-z_]+$/u.test(error.message)
        ? error.message
        : "host_terminal_caller_save_unconfirmed";
  }
  const end = await lease.release();
  const leaseCloseConfirmed =
    end.status === "not_started" ||
    ((end.status === "closed" || end.status === "closed_after_failure") &&
      end.serverCloseObserved &&
      end.socketsPending === 0);
  if (!leaseCloseConfirmed)
    reason = "host_terminal_caller_lease_close_unconfirmed";
  else if (isSaved && end.status !== "closed")
    reason = "host_terminal_caller_lease_failed";
  return Object.freeze({
    status:
      isSaved && handlesCloseConfirmed && end.status === "closed"
        ? "saved"
        : "blocked",
    reason,
    reference,
    administrativeEffectIssued,
    recordEffectIssued,
    handlesCloseConfirmed,
    leaseCloseConfirmed,
    runtimeDataBlock,
  });
}
