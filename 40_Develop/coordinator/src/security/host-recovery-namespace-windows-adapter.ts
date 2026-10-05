/**
 * 署名付きNativeで共有管理境界を保護付き初期化する。
 *
 * @responsibility Task作成前の親観測・独立期待値・部分処置・実行物再確認を所有する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWindowsHostTerminalHelperEnvironment } from "../core/windows-child-environment.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

const distributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const RESPONSE_LIMIT = 1024;

/**
 * 親・共有管理先・終端保存先のNative実体を保持する。
 *
 * @responsibility NodeのmetadataとNativeの識別値を混同しない。
 * @trace ARCH-000011
 * @shape volume、file-index、creation-time、属性の六u32。
 * @invariant 自己申告またはHashだけを同一実体へ昇格しない。
 * @boundary 専用frame→内部初期化Owner。
 * @security Path、SID、Authorityなし。
 * @compatibility CRDDNR01専用。旧Node三識別値へ暗黙変換しない。
 */
type NamespaceIdentity = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * 初期化の現在結果と全終了を保持する。
 *
 * @responsibility 停止の部分作成・元理由・不明を消さない。
 * @trace ARCH-000011
 * @shape 状態、理由、三実体、利用者Hash、二つの部分receipt、TokenとDirectoryの個別close。
 * @invariant 初期化完了をTask回復や非使用へ昇格しない。
 * @boundary Native専用応答→Coordinator内部。
 * @security 共有Directory削除・ACL移行のAuthorityを含まない。
 * @compatibility status 0/1/2とreceiptのfalse/true/nullを区別する。
 */
type NamespaceObservation = Readonly<{
  status: "blocked" | "observed" | "initialized";
  reason: string;
  operationReason: string | null;
  identities: readonly (NamespaceIdentity | null)[];
  selectedUserSha256: string | null;
  children: readonly (Readonly<{
    createIssued: boolean;
    created: boolean | null;
    handleAcquired: boolean;
    close: boolean | null;
  }> | null)[];
  tokenCloses: readonly boolean[];
  directoryCloses: readonly boolean[];
}>;

/**
 * 親確認・初期化・外側Processの共同結果を保持する。
 *
 * @responsibility 応答不明をFilesystem Effect 0へ畳まない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @shape 状態、理由、二観測、Process発行、終了、実行物再確認、Filesystem Effect三値。
 * @invariant Native開始後の初期化搬送失敗はEffect不明である。
 * @boundary 署名Native初期化→通常producer。
 * @security Authority、削除、Provider要求を発行しない。
 * @compatibility 同期の作成前接続。開発Contextと未署名fallbackは受付けない。
 */
type NamespaceInitialization = Readonly<{
  status: "blocked" | "initialized";
  reason: string;
  parentObservation: NamespaceObservation | null;
  initialization: NamespaceObservation | null;
  processEffectIssued: boolean;
  helperExitConfirmed: boolean;
  artifactVerifiedBeforeAndAfter: boolean;
  filesystemEffectIssued: boolean | null;
}>;

/**
 * 同じnonceとmodeの閉形式応答を検証する。
 *
 * @responsibility 完了の共同条件・余剰・三値を決定論的に検査する。
 * @trace ARCH-000011
 * @input 最大1024bytes、独立nonceと呼出しmode。
 * @returns 不変の現在結果、またはnull。
 * @precondition 呼出し側がProcess終了と署名実行物を別に確認する。
 * @postcondition 部分応答やclose不明を完了へ畳まない。
 * @effect N/A: bytes解析だけ。
 * @failure revision、相関、値、共同条件、欠落・余剰不正はnull。
 * @invariant parser成功を署名・非使用・処置許可へ昇格しない。
 * @boundary 専用Native stdout→初期化Owner。
 * @security 生出力は結果・logへ含めない。
 * @concurrency 入力をcopyして読み、戻り値を凍結する。
 */
export function decodeHostRecoveryNamespaceResponse(
  input: unknown,
  nonceHex: string,
  shouldInitialize: boolean,
): NamespaceObservation | null {
  if (
    !Buffer.isBuffer(input) ||
    input.length < 59 ||
    input.length > RESPONSE_LIMIT ||
    !/^[0-9a-f]{64}$/u.test(nonceHex) ||
    /^0+$/u.test(nonceHex)
  )
    return null;
  const bytes = Buffer.from(input);
  if (
    !bytes.subarray(0, 8).equals(Buffer.from("CRDDNR01", "ascii")) ||
    bytes.readUInt16LE(8) !== 1 ||
    bytes.subarray(10, 42).toString("hex") !== nonceHex
  )
    return null;
  const status = bytes[42];
  const reasonLength = bytes[43];
  const operationLength = bytes[44];
  const mask = bytes[45];
  const selected = bytes[46];
  const tokens = bytes[47];
  const directories = bytes[48];
  if (
    status === undefined ||
    status > 2 ||
    reasonLength === undefined ||
    reasonLength === 0 ||
    reasonLength > 96 ||
    operationLength === undefined ||
    operationLength > 96 ||
    mask === undefined ||
    mask > 7 ||
    selected === undefined ||
    selected > 1 ||
    tokens === undefined ||
    tokens > 2 ||
    directories === undefined ||
    directories > 64
  )
    return null;
  const childObservations: NamespaceObservation["children"][number][] = [];
  for (let index = 0; index < 2; index += 1) {
    const offset = 49 + index * 5;
    const present = bytes[offset];
    const issued = bytes[offset + 1];
    const created = bytes[offset + 2];
    const acquired = bytes[offset + 3];
    const close = bytes[offset + 4];
    if (
      present === undefined ||
      present > 1 ||
      issued === undefined ||
      issued > 1 ||
      created === undefined ||
      created > 2 ||
      acquired === undefined ||
      acquired > 1 ||
      close === undefined ||
      close > 2
    )
      return null;
    if (present === 0) {
      if (issued !== 0 || created !== 2 || acquired !== 0 || close !== 2)
        return null;
      childObservations.push(null);
    } else {
      if ((issued === 0 && created !== 0) || (acquired === 0 && close !== 2))
        return null;
      childObservations.push(
        Object.freeze({
          createIssued: issued === 1,
          created: created === 2 ? null : created === 1,
          handleAcquired: acquired === 1,
          close: close === 2 ? null : close === 1,
        }),
      );
    }
  }
  const identityCount = [0, 1, 2].filter(
    (index) => (mask & (1 << index)) !== 0,
  ).length;
  if (
    bytes.length !==
    59 +
      reasonLength +
      operationLength +
      selected * 32 +
      identityCount * 24 +
      tokens +
      directories
  )
    return null;
  let offset = 59;
  if (
    [...bytes.subarray(offset, offset + reasonLength + operationLength)].some(
      (value) => value > 127,
    )
  )
    return null;
  const reason = bytes
    .subarray(offset, offset + reasonLength)
    .toString("ascii");
  offset += reasonLength;
  const operation = bytes
    .subarray(offset, offset + operationLength)
    .toString("ascii");
  offset += operationLength;
  if (
    !/^terminal_[a-z0-9_]+$/u.test(reason) ||
    (operation !== "" && !/^terminal_[a-z0-9_]+$/u.test(operation))
  )
    return null;
  const selectedUserSha256 =
    selected === 1 ? bytes.subarray(offset, offset + 32).toString("hex") : null;
  offset += selected * 32;
  if (selectedUserSha256 !== null && /^0+$/u.test(selectedUserSha256))
    return null;
  const identities: (NamespaceIdentity | null)[] = [];
  for (let index = 0; index < 3; index += 1) {
    if ((mask & (1 << index)) === 0) {
      identities.push(null);
      continue;
    }
    const identity = Object.freeze([
      bytes.readUInt32LE(offset),
      bytes.readUInt32LE(offset + 4),
      bytes.readUInt32LE(offset + 8),
      bytes.readUInt32LE(offset + 12),
      bytes.readUInt32LE(offset + 16),
      bytes.readUInt32LE(offset + 20),
    ] as const);
    offset += 24;
    identities.push(identity);
  }
  const closes = [...bytes.subarray(offset)];
  if (closes.some((value) => value > 1)) return null;
  const tokenCloses = Object.freeze(
    closes.slice(0, tokens).map((value) => value === 1),
  );
  const directoryCloses = Object.freeze(
    closes.slice(tokens).map((value) => value === 1),
  );
  if (
    !shouldInitialize &&
    (childObservations.some((child) => child !== null) || (mask & 6) !== 0)
  )
    return null;
  if (status !== 0) {
    if (
      status !== (shouldInitialize ? 2 : 1) ||
      operation !== "" ||
      selected !== 1 ||
      mask !== (shouldInitialize ? 7 : 1) ||
      tokens !== 2 ||
      tokenCloses.some((isConfirmed) => !isConfirmed) ||
      directories === 0 ||
      directoryCloses.some((isConfirmed) => !isConfirmed) ||
      reason !==
        (shouldInitialize
          ? "terminal_namespace_initialized"
          : "terminal_namespace_parent_observed") ||
      (shouldInitialize &&
        childObservations.some(
          (child) =>
            child === null ||
            !child.handleAcquired ||
            child.close !== true ||
            child.created === null,
        ))
    )
      return null;
    for (let index = 0; index < identities.length; index += 1) {
      const identity = identities[index];
      if (!identity) continue;
      if (
        (identity[5] & 0x10) === 0 ||
        (identity[5] & 0x400) !== 0 ||
        identities
          .slice(0, index)
          .some(
            (other) =>
              other &&
              other[0] === identity[0] &&
              other[1] === identity[1] &&
              other[2] === identity[2],
          )
      )
        return null;
    }
  }
  return Object.freeze({
    status:
      status === 0 ? "blocked" : shouldInitialize ? "initialized" : "observed",
    reason,
    operationReason: operation || null,
    identities: Object.freeze(identities),
    selectedUserSha256,
    children: Object.freeze(childObservations),
    tokenCloses,
    directoryCloses,
  });
}

/**
 * Task作成前に固定共有管理境界を署名付きNativeで初期化する。
 *
 * @responsibility 署名・親の独立期待値・作成後再確認を一元入口で接続する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Nodeが読取り解決した現在の一時親。
 * @returns 共同成立した初期化、または部分結果を保持した停止。
 * @precondition 呼出し元はこの固定親の管理先作成を許可された通常producerである。
 * @postcondition 成功は三Native実体・利用者・二保護・全終了・署名再確認が成立する。
 * @effect 最大二回の固定Native Process。二回目だけ固定二childを作成し得る。
 * @failure 未署名、別親、期待差、作成・搬送・終了・実行物変更で停止する。
 * @invariant Node mkdir、未署名実行、別Temp、ACL修復へのfallbackを持たない。
 * @boundary 作成前Owner→固定署名Native→共有管理境界。
 * @security 任意Executable、自由Path、ACL、開発Context、元Task Tokenを受け付けない。
 * @concurrency 各同期Workerは5秒上限。共有物rollbackや自動再試行は行わない。
 */
export function initializeHostRecoveryNamespaceWindows(
  parent: string,
): NamespaceInitialization {
  let parentObservation: NamespaceObservation | null = null;
  let initialization: NamespaceObservation | null = null;
  let processEffectIssued = false;
  let helperExitConfirmed = false;
  let isArtifactVerifiedBeforeAndAfter = false;
  let filesystemEffectIssued: boolean | null = false;
  /**
   * 現在の部分観測と明示した完了判定だけを返す。
   *
   * @responsibility 成功に見える理由文字列だけで完了を決めない。
   * @trace ARCH-000011
   * @input 固定理由と共同成立後だけtrueになる完了判定。
   * @returns 不変の部分結果。
   * @precondition 現呼出しの観測だけを参照する。
   * @postcondition 停止でも取得済みreceiptと不明を保持する。
   * @effect N/A: memory構築だけ。
   * @failure N/A: 新たなOS処置を持たない。
   * @invariant 理由・署名確認だけから初期化完了を推定しない。
   * @boundary 搬送の現在結果→通常作成Owner。
   * @security Path・SID・元Tokenを返さない。
   * @concurrency 同期呼出し内の現在値だけをcopyする。
   */
  const result = (
    reason: string,
    isCompleted = false,
  ): NamespaceInitialization =>
    Object.freeze({
      status: isCompleted ? "initialized" : "blocked",
      reason,
      parentObservation,
      initialization,
      processEffectIssued,
      helperExitConfirmed,
      artifactVerifiedBeforeAndAfter: isArtifactVerifiedBeforeAndAfter,
      filesystemEffectIssued,
    });
  try {
    if (process.platform !== "win32")
      return result("terminal_platform_unsupported");
    const environment = createWindowsHostTerminalHelperEnvironment();
    if (
      !environment ||
      parent !== environment.TEMP ||
      environment.TMP !== parent
    )
      return result("terminal_namespace_parent_mismatch");
    const verification =
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime: new Date().toISOString(),
      });
    if (
      verification.status !== "candidate" ||
      verification.runtimeOwnedReleaseTrustConfirmed !== true ||
      verification.runtimeExecutionIdentityRuntimeOwned !== true ||
      verification.crddDistributionConfirmed !== true
    )
      return result("terminal_namespace_release_not_verified");
    const before =
      observePlatformAccessReleaseArtifactCandidate(distributionRoot);
    const signing =
      beginPlatformAccessArtifactSigningObservation(distributionRoot);
    if (
      before.status !== "candidate" ||
      !signing ||
      JSON.stringify(before.artifact) !==
        JSON.stringify(verification.platformAccessArtifact) ||
      JSON.stringify(before.artifact) !== JSON.stringify(signing.artifact)
    )
      return result("terminal_namespace_artifact_not_verified");
    for (const shouldInitialize of [false, true]) {
      const nonce = randomBytes(32);
      const request = Buffer.alloc(shouldInitialize ? 98 : 42);
      request.write(shouldInitialize ? "CRDDNI01" : "CRDDNC01", 0, "ascii");
      request.writeUInt16LE(1, 8);
      nonce.copy(request, 10);
      if (shouldInitialize) {
        const identity = parentObservation?.identities[0];
        const user = parentObservation?.selectedUserSha256;
        if (!identity || !user)
          return result("terminal_namespace_parent_observation_missing");
        identity.forEach((value, index) => {
          request.writeUInt32LE(value, 42 + index * 4);
        });
        Buffer.from(user, "hex").copy(request, 66);
      }
      // Record issuance before calling the Process API; exceptions are not proof of Effect 0.
      processEffectIssued = true;
      helperExitConfirmed = false;
      isArtifactVerifiedBeforeAndAfter = false;
      if (shouldInitialize) filesystemEffectIssued = null;
      const execution = spawnSync(
        path.join(
          distributionRoot,
          ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
        ),
        [
          shouldInitialize
            ? "--host-recovery-namespace-initialize"
            : "--host-recovery-namespace-observe",
        ],
        {
          input: request,
          encoding: "buffer",
          env: environment,
          shell: false,
          windowsHide: true,
          timeout: 5000,
          maxBuffer: RESPONSE_LIMIT + 1,
        },
      );
      helperExitConfirmed =
        execution.error === undefined &&
        execution.signal === null &&
        execution.status !== null;
      if (
        !helperExitConfirmed ||
        !Buffer.isBuffer(execution.stderr) ||
        execution.stderr.length !== 0
      )
        return result("terminal_namespace_worker_transport_unconfirmed");
      if (!verifyPlatformAccessArtifactSigningObservation(signing.token))
        return result("terminal_namespace_artifact_changed");
      const after =
        observePlatformAccessReleaseArtifactCandidate(distributionRoot);
      if (
        after.status !== "candidate" ||
        JSON.stringify(before.artifact) !== JSON.stringify(after.artifact)
      )
        return result("terminal_namespace_artifact_changed");
      isArtifactVerifiedBeforeAndAfter = true;
      const observation = decodeHostRecoveryNamespaceResponse(
        execution.stdout,
        nonce.toString("hex"),
        shouldInitialize,
      );
      if (
        !observation ||
        execution.status !== (observation.status === "blocked" ? 2 : 0)
      )
        return result("terminal_namespace_response_invalid");
      if (shouldInitialize) {
        initialization = observation;
        filesystemEffectIssued = observation.children.some(
          (child) => child?.createIssued === true,
        );
      } else {
        parentObservation = observation;
      }
      if (observation.status === "blocked") return result(observation.reason);
      if (
        shouldInitialize &&
        (JSON.stringify(observation.identities[0]) !==
          JSON.stringify(parentObservation?.identities[0]) ||
          observation.selectedUserSha256 !==
            parentObservation?.selectedUserSha256)
      )
        return result("terminal_namespace_parent_mismatch");
    }
    return result("terminal_namespace_initialized", true);
  } catch {
    return result("terminal_namespace_initialization_failed");
  }
}
