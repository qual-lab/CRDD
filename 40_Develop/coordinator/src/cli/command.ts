/**
 * Coordinator CLIの引数受付・取消・表示・終了を所有する。
 * @responsibility 正式APIを一回呼び、元のstdin・Signal・JSON・Exit Codeの契約を維持する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary CLIと既存の正式API。importだけでは受付・実行しない。
 */

import fs from "node:fs";
import {
  parseDockerTaskRecoveryId,
  isPrincipalId,
} from "@qual-lab/crdd-execution-model";
import {
  parseUnambiguousJsonDocument,
  snapshotPlainArray,
} from "../lifecycle/validation.ts";
import path from "node:path";
import { types } from "node:util";
import { classifyDoctorOperationInitializationFailure } from "../lifecycle/environment.ts";
import {
  type RecoveryObservation,
  authenticateProvider,
  getAuthenticationStatus,
  PROVIDER_AUTHENTICATION_INPUT_NOTICE,
  isSupportedNodeRuntime,
  diagnoseEnvironment,
  recoverExecution,
  restartDockerForRecovery,
  repairDockerRuntime,
  retainRepair,
  readRecovery,
  inspectSingleTaskCommand,
  runObjective,
  runTask,
  getCapabilities,
} from "../api.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  getRepository,
} from "@qual-lab/crdd-version-control";
import { parseRepositoryProjectContextMarkdown } from "@qual-lab/crdd-document-model";
import { fileURLToPath } from "node:url";

/**
 * file-snapshotで使用するStable File Identityの値契約を定義する。
 *
 * @responsibility Stable File IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape StableFileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StableFileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: StableFileIdentityの宣言は外部境界を開かない。
 * @security StableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StableFileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StableFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

/**
 * task-cli-cancellationで使用するTask Cli Signalの値契約を定義する。
 *
 * @responsibility Task Cli SignalのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCliSignalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignal = (typeof taskCliSignals)[number];

/**
 * task-cli-cancellationで使用するTask Cli Signal Listenerの値契約を定義する。
 *
 * @responsibility Task Cli Signal ListenerのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCliSignalListenerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalListenerで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalListenerの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalListenerはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalListenerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignalListener = () => void;

/**
 * task-cli-cancellationで使用するTask Cli Signal Portの値契約を定義する。
 *
 * @responsibility Task Cli Signal PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCliSignalPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCliSignalPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCliSignalPortの宣言は外部境界を開かない。
 * @security N/A: TaskCliSignalPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskCliSignalPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskCliSignalPort = Readonly<{
  on: (signal: TaskCliSignal, listener: TaskCliSignalListener) => void;
  removeListener: (
    signal: TaskCliSignal,
    listener: TaskCliSignalListener,
  ) => void;
}>;

/**
 * CLI起動時に観測した実行環境の値を定義する。
 * @responsibility Node版と端末・出力可否をAuthorityと分離する。
 * @trace ARCH-000004
 * @shape Node版、stdin/stdoutのTTY、stdout書込み可否。
 * @invariant 観測値は実行権限を発行しない。
 * @boundary CLI受付内。
 * @security 秘密値・Pathを含まない。
 * @compatibility 正式APIのRequestとは独立したCLI内契約。
 */
type LaunchObservation = Readonly<{
  nodeVersion: string;
  stdinIsTty: boolean;
  stdoutIsTty: boolean;
  stdoutWritable: boolean;
}>;

const MAXIMUM_ARGUMENTS = 16;

const MAXIMUM_ARGUMENT_LENGTH = 4_096;

/**
 * UsageErrorが担う状態と操作を提供する。
 *
 * @responsibility UsageErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000004
 * @construction UsageErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle UsageErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: UsageErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: UsageErrorの宣言自体は実行時失敗を所有しない。
 * @invariant UsageErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: UsageErrorの宣言は外部境界を開かない。
 * @security N/A: UsageErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: UsageErrorは共有非同期状態を持たない同期処理である。
 */
export class UsageError extends Error {
  readonly usage = true;
}

const MAXIMUM_TASK_REQUEST_BYTES = 128 * 1024;

const intrinsicPromiseThen = Promise.prototype.then;

const taskCliSignals = ["SIGINT", "SIGTERM"] as const;

/**
 * responseを決定する。
 *
 * @responsibility responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input status: S、reason: string | null、value: T | null、isJsonRequested
 * @returns responseの計算結果を返す。
 * @precondition 「status: S、reason: string | null、value: T | null、isJsonRequested」がresponseの入力契約を満たす。
 * @postcondition responseの責務を完了した結果だけを返す。
 * @effect N/A: responseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: responseは独自の失敗分岐を所有しない。
 * @invariant responseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: responseはProcess内の同一Subsystemで完結する。
 * @security N/A: responseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: responseは共有非同期状態を持たない同期処理である。
 */
function response<const S extends string, T>(
  status: S,
  reason: string | null,
  value: T | null = null,
  isJsonRequested = false,
) {
  return Object.freeze({
    status,
    reason,
    value,
    jsonRequested: isJsonRequested,
  });
}

/**
 * Tokenが有効か判定する。
 *
 * @responsibility Tokenの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTokenの入力契約を満たす。
 * @postcondition validTokenの責務を完了した結果だけを返す。
 * @effect N/A: validTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTokenは独自の失敗分岐を所有しない。
 * @invariant validTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTokenはProcess内の同一Subsystemで完結する。
 * @security N/A: validTokenはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTokenは共有非同期状態を持たない同期処理である。
 */
function validToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_ARGUMENT_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Doctor Argumentsを構造化値へ解析する。
 *
 * @responsibility Doctor Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawArguments: unknown、_environmentRoot: unknown
 * @returns parseDoctorArgumentsの計算結果を返す。
 * @precondition 「rawArguments: unknown、_environmentRoot: unknown」がparseDoctorArgumentsの入力契約を満たす。
 * @postcondition parseDoctorArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseDoctorArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDoctorArgumentsは独自の失敗分岐を所有しない。
 * @invariant parseDoctorArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDoctorArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseDoctorArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseDoctorArgumentsは共有非同期状態を持たない同期処理である。
 */
export function parseDoctorArguments(
  rawArguments: unknown,
  _environmentRoot: unknown,
) {
  const snapshot = snapshotPlainArray<string>(rawArguments, MAXIMUM_ARGUMENTS);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.some((value) => !validToken(value))
  )
    return response("blocked", "doctor_arguments_invalid");
  const args = snapshot.value,
    json = args.includes("--json");
  const [target, action, ...tail] = args;
  if (target === "doctor") {
    if (
      args.slice(1).some((flag) => !["--isolation", "--json"].includes(flag)) ||
      new Set(args).size !== args.length
    )
      return response("blocked", "doctor_arguments_invalid", null, json);
    return response(
      "ok",
      null,
      Object.freeze({
        json,
        action: args.includes("--isolation") ? "isolation" : "check",
        recoveryId: null,
      }),
      json,
    );
  }
  let operation:
    | "resume"
    | "inspect"
    | "restart-docker"
    | "repair-docker"
    | "retain-repair";
  let recoveryId: string | null = null;
  let flags: readonly string[];
  if (target === "recovery" && (action === "resume" || action === "inspect")) {
    recoveryId = tail[0] ?? null;
    flags = tail.slice(1);
    if (
      !recoveryId ||
      recoveryId.startsWith("--") ||
      flags.some(
        (flag) =>
          !(
            action === "inspect" ? ["--json"] : ["--json", "--restart-docker"]
          ).includes(flag),
      ) ||
      new Set(flags).size !== flags.length
    )
      return response("blocked", "doctor_arguments_invalid", null, json);
    operation =
      action === "inspect"
        ? "inspect"
        : flags.includes("--restart-docker")
          ? "restart-docker"
          : "resume";
    if (
      operation === "restart-docker" &&
      !parseDockerTaskRecoveryId(recoveryId)
    )
      return response("blocked", "doctor_arguments_invalid", null, json);
  } else if (target === "maintenance" && action === "repair") {
    const retain = tail[0] === "--retain";
    recoveryId = retain ? (tail[1] ?? null) : null;
    flags = retain ? tail.slice(2) : tail;
    if (
      flags.length > 1 ||
      (flags.length === 1 && flags[0] !== "--json") ||
      (retain &&
        !/^docker-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(recoveryId ?? ""))
    )
      return response("blocked", "doctor_arguments_invalid", null, json);
    operation = retain ? "retain-repair" : "repair-docker";
  } else {
    return response("blocked", "doctor_arguments_invalid", null, json);
  }
  return response(
    "ok",
    null,
    Object.freeze({ json, action: operation, recoveryId }),
    json,
  );
}

/**
 * Bounded Task Request From Stdinを読み取る。
 *
 * @responsibility Bounded Task Request From Stdinの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns readBoundedTaskRequestFromStdinの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がreadBoundedTaskRequestFromStdinの入力契約を満たす。
 * @postcondition readBoundedTaskRequestFromStdinの責務を完了した結果だけを返す。
 * @effect readBoundedTaskRequestFromStdinはFilesystemの読取りまたは書込みを実行する。
 * @failure readBoundedTaskRequestFromStdinは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readBoundedTaskRequestFromStdinは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readBoundedTaskRequestFromStdinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readBoundedTaskRequestFromStdinは共有非同期状態を持たない同期処理である。
 */
export function readBoundedTaskRequestFromStdin() {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const buffer = Buffer.alloc(8 * 1024);
  for (;;) {
    const readBytes = fs.readSync(0, buffer, 0, buffer.length, null);
    if (readBytes === 0) break;
    totalBytes += readBytes;
    if (totalBytes > MAXIMUM_TASK_REQUEST_BYTES) {
      throw new UsageError("task_request_too_large");
    }
    chunks.push(Buffer.from(buffer.subarray(0, readBytes)));
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, totalBytes),
    );
  } catch {
    throw new UsageError("task_request_invalid_utf8");
  }
  const parsed = parseUnambiguousJsonDocument(source);
  if (!parsed) throw new UsageError("task_request_invalid_json");
  return parsed;
}

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input metadata: fs.BigIntStats
 * @returns identityの計算結果を返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure identityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security identityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(metadata: fs.BigIntStats) {
  const ino = normalizeFileId(metadata.ino);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n
  )
    throw new Error("file_snapshot_invalid");
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

/**
 * Windowsの符号付き64bit File IDを同じ実体の符号なし表現に揃える。
 * @responsibility Readerと保存Writerの同一性比較で同じ表現規則を使う。
 * @trace ARCH-000014
 * @input ino: OSから観測したFile ID。
 * @returns Windowsの有効な負の64bit表現だけを正規化する。
 * @precondition 呼出し側がFile Identity全体の妥当性を検査する。
 * @postcondition 同じ64bit IDの意味を変えず、範囲外の値を補正しない。
 * @effect N/A: 入力値だけを変換する。
 * @failure N/A: 不正値の拒否は呼出し側が所有する。
 * @invariant Windows以外と他のIdentity項目を変更しない。
 * @boundary Process内の保存部品。
 * @security 異なるFile IDを同一と扱わない。
 * @concurrency N/A: 共有状態を持たない。
 */
function normalizeFileId(ino: bigint): bigint {
  return process.platform === "win32" &&
    typeof ino === "bigint" &&
    ino >= -(1n << 63n) &&
    ino < 0n
    ? BigInt.asUintN(64, ino)
    : ino;
}

/**
 * Stable File Identityが同一かを判定する。
 *
 * @responsibility Stable File Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000014
 * @input left: StableFileIdentity、right: StableFileIdentity
 * @returns sameStableFileIdentityの計算結果を返す。
 * @precondition 「left: StableFileIdentity、right: StableFileIdentity」がsameStableFileIdentityの入力契約を満たす。
 * @postcondition sameStableFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameStableFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameStableFileIdentityは独自の失敗分岐を所有しない。
 * @invariant sameStableFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameStableFileIdentityはProcess内の同一Subsystemで完結する。
 * @security sameStableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameStableFileIdentityは共有非同期状態を持たない同期処理である。
 */
export function sameStableFileIdentity(
  left: StableFileIdentity,
  right: StableFileIdentity,
) {
  return (
    left.dev === right.dev &&
    normalizeFileId(left.ino) === normalizeFileId(right.ino) &&
    left.birthtimeNs === right.birthtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

/**
 * Stable File Snapshotを読み取る。
 *
 * @responsibility Stable File Snapshotの読取り元と読取不能時の結果境界を所有する。
 * @trace ARCH-000014
 * @input file: string
 * @returns readStableFileSnapshotの計算結果を返す。
 * @precondition 「file: string」がreadStableFileSnapshotの入力契約を満たす。
 * @postcondition readStableFileSnapshotの責務を完了した結果だけを返す。
 * @effect Filesystemを読み取り、読取り用descriptorを開閉する。書込みは行わない。
 * @failure readStableFileSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readStableFileSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readStableFileSnapshotは共有非同期状態を持たない同期処理である。
 */
export function readStableFileSnapshot(file: string) {
  if (!path.isAbsolute(file)) throw new Error("file_snapshot_invalid");
  const resolved = path.resolve(file);
  const before = identity(fs.lstatSync(resolved, { bigint: true }));
  if (fs.realpathSync.native(resolved) !== resolved)
    throw new Error("file_snapshot_invalid");
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY);
  try {
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameStableFileIdentity(before, opened))
      throw new Error("file_snapshot_changed");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = identity(fs.lstatSync(resolved, { bigint: true }));
    if (
      byteLength !== Number(opened.size) ||
      !sameStableFileIdentity(opened, after) ||
      !sameStableFileIdentity(opened, pathAfter) ||
      fs.realpathSync.native(resolved) !== resolved
    )
      throw new Error("file_snapshot_changed");
    return Object.freeze({
      path: resolved,
      identity: opened,
      bytes: Buffer.concat(chunks, byteLength),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Task Cli Cancellation Latchを構築する。
 *
 * @responsibility Task Cli Cancellation Latchの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input requestCancellation: () => Promise<unknown>
 * @returns createTaskCliCancellationLatchの計算結果を返す。
 * @precondition 「requestCancellation: () => Promise<unknown>」がcreateTaskCliCancellationLatchの入力契約を満たす。
 * @postcondition createTaskCliCancellationLatchの責務を完了した結果だけを返す。
 * @effect N/A: createTaskCliCancellationLatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createTaskCliCancellationLatchは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTaskCliCancellationLatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createTaskCliCancellationLatchはProcess内の同一Subsystemで完結する。
 * @security N/A: createTaskCliCancellationLatchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency createTaskCliCancellationLatchは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createTaskCliCancellationLatch(
  requestCancellation: () => Promise<unknown>,
) {
  let cancellationPromise: Promise<unknown> | null = null;
  let observerCount = 0;
  const request = () => {
    if (cancellationPromise) return cancellationPromise;
    try {
      const observed = requestCancellation();
      if (
        !observed ||
        typeof observed !== "object" ||
        types.isProxy(observed) ||
        !types.isPromise(observed) ||
        Object.getPrototypeOf(observed) !== Promise.prototype ||
        Object.getOwnPropertyDescriptor(observed, "then") !== undefined
      )
        throw new Error("task_cli_cancellation_promise_invalid");
      cancellationPromise = observed;
    } catch (error) {
      cancellationPromise = Promise.reject(error);
    }
    observerCount += 1;
    try {
      void intrinsicPromiseThen.call(
        cancellationPromise,
        () => undefined,
        () => undefined,
      );
    } catch {
      cancellationPromise = Promise.reject(
        new Error("task_cli_cancellation_observer_failed"),
      );
      void intrinsicPromiseThen.call(
        cancellationPromise,
        () => undefined,
        () => undefined,
      );
    }
    return cancellationPromise;
  };
  return Object.freeze({
    request,
    observedPromise: () => cancellationPromise,
    observerCount: () => observerCount,
  });
}

/**
 * Task Cli Cancellation Signals To PortをIdentityへ結合する。
 *
 * @responsibility Task Cli Cancellation Signals To Portの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000004
 * @input port: TaskCliSignalPort、requestCancellation: () => Promise<unknown>
 * @returns bindTaskCliCancellationSignalsToPortの計算結果を返す。
 * @precondition 「port: TaskCliSignalPort、requestCancellation: () => Promise<unknown>」がbindTaskCliCancellationSignalsToPortの入力契約を満たす。
 * @postcondition bindTaskCliCancellationSignalsToPortの責務を完了した結果だけを返す。
 * @effect 指定Portへ同一Listenerを登録し、Signal時に取消を要求する。登録失敗時は登録済みListenerを解除する。
 * @failure 登録・解除の失敗は非成功で返し、取消の同期throw・rejectは既存Latchで観測する。
 * @invariant 重複Signalを一回の取消と同じPromiseへ収束し、解除不明を成功へ畳まない。
 * @boundary CLI Signalの登録先と単発実行の取消境界。
 * @security N/A: bindTaskCliCancellationSignalsToPortはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Signal登録中の通知・重複通知・取消待機とfinally解除を同じLatchに結合する。
 */
export function bindTaskCliCancellationSignalsToPort(
  port: TaskCliSignalPort,
  requestCancellation: () => Promise<unknown>,
) {
  const cancellation = createTaskCliCancellationLatch(requestCancellation);
  const cancel = () => void cancellation.request();
  const registered = new Set<TaskCliSignal>();
  let isReleaseAttempted = false;

  const removeRegisteredListeners = () => {
    const failures: TaskCliSignal[] = [];
    for (const signal of taskCliSignals) {
      if (!registered.has(signal)) continue;
      try {
        port.removeListener(signal, cancel);
        registered.delete(signal);
      } catch {
        failures.push(signal);
      }
    }
    return Object.freeze({
      status:
        failures.length === 0 ? ("released" as const) : ("failed" as const),
      failedSignals: Object.freeze(failures),
    });
  };

  try {
    for (const signal of taskCliSignals) {
      port.on(signal, cancel);
      registered.add(signal);
    }
  } catch {
    const rollback = removeRegisteredListeners();
    void cancellation.request();
    return Object.freeze({
      status: "binding_failed" as const,
      cancellation,
      listener: cancel,
      rollback,
      unbind: () => {
        if (isReleaseAttempted)
          return Object.freeze({
            status:
              registered.size === 0
                ? ("released" as const)
                : ("failed" as const),
            failedSignals: Object.freeze([...registered]),
          });
        isReleaseAttempted = true;
        return removeRegisteredListeners();
      },
    });
  }

  return Object.freeze({
    status: "bound" as const,
    cancellation,
    listener: cancel,
    rollback: Object.freeze({
      status: "released" as const,
      failedSignals: Object.freeze([] as TaskCliSignal[]),
    }),
    unbind: () => {
      if (isReleaseAttempted)
        return Object.freeze({
          status:
            registered.size === 0 ? ("released" as const) : ("failed" as const),
          failedSignals: Object.freeze([...registered]),
        });
      isReleaseAttempted = true;
      return removeRegisteredListeners();
    },
  });
}

/**
 * Task Cli Cancellation SignalsをIdentityへ結合する。
 *
 * @responsibility Task Cli Cancellation Signalsの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000004
 * @input requestCancellation: () => Promise<unknown>
 * @returns bindTaskCliCancellationSignalsの計算結果を返す。
 * @precondition 「requestCancellation: () => Promise<unknown>」がbindTaskCliCancellationSignalsの入力契約を満たす。
 * @postcondition bindTaskCliCancellationSignalsの責務を完了した結果だけを返す。
 * @effect bindTaskCliCancellationSignalsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: bindTaskCliCancellationSignalsは独自の失敗分岐を所有しない。
 * @invariant bindTaskCliCancellationSignalsは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: bindTaskCliCancellationSignalsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: bindTaskCliCancellationSignalsは共有非同期状態を持たない同期処理である。
 */
export function bindTaskCliCancellationSignals(
  requestCancellation: () => Promise<unknown>,
) {
  return bindTaskCliCancellationSignalsToPort(
    Object.freeze({
      on: (signal, listener) => process.on(signal, listener),
      removeListener: (signal, listener) =>
        process.removeListener(signal, listener),
    }),
    requestCancellation,
  );
}

/**
 * 照会Ownerが生成した保存観測を表示する。
 * @responsibility 記録の有無と実資源の状態を混同させない。
 * @trace ARCH-000004
 * @input 正式readRecoveryの結果とJSON表示指定。
 * @returns 表示文字列と、照会不能時2の終了値。
 * @precondition 外部JSONではなく同じProcessの正式Owner結果である。
 * @postcondition 記録なしを資源不存在・回復完了へ変換しない。
 * @effect 外部Effectなし。
 * @security Ownerが投影した非秘密fieldだけを表示する。
 */
export function renderRecoveryObservation(
  observation: RecoveryObservation,
  json: boolean,
) {
  const label =
    observation.observationState === "recorded"
      ? "現在の保存記録を取得しました。"
      : observation.observationState === "not_recorded"
        ? "現在の保存正本に一致する記録はありません。資源の不存在や回復完了を意味しません。"
        : "現在の保存記録を確認できません。自動再試行せず停止理由を確認してください。";
  return Object.freeze({
    stdout: json
      ? `${JSON.stringify(observation)}\n`
      : `${label}\n回復ID: ${observation.recoveryId}\n理由: ${observation.reason}\nDocker資源の現在状態は観測していません。保存時点の値: ${JSON.stringify(observation.record)}\n`,
    exitCode: observation.status === "completed" ? 0 : 2,
  });
}

/**
 * Doctor Command 失敗を人間向け表示へ整形する。
 *
 * @responsibility Doctor Command 失敗の入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns renderDoctorCommandFailureの計算結果を返す。
 * @precondition 「error: unknown」がrenderDoctorCommandFailureの入力契約を満たす。
 * @postcondition renderDoctorCommandFailureの責務を完了した結果だけを返す。
 * @effect N/A: renderDoctorCommandFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: renderDoctorCommandFailureは独自の失敗分岐を所有しない。
 * @invariant renderDoctorCommandFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: renderDoctorCommandFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: renderDoctorCommandFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: renderDoctorCommandFailureは共有非同期状態を持たない同期処理である。
 */
export function renderDoctorCommandFailure(error: unknown) {
  const doctorCreation = classifyDoctorOperationInitializationFailure(error);
  const message = error instanceof Error ? error.message : null;
  const reason =
    typeof message === "string" && /^[a-z0-9_]+$/u.test(message)
      ? message
      : "diagnostic_failed";
  return Object.freeze({
    exitCode: 2,
    json: `${JSON.stringify(
      doctorCreation
        ? { status: "blocked", ...doctorCreation }
        : { status: "blocked", reason },
    )}\n`,
    human: doctorCreation
      ? `Coordinator診断は停止しました: ${doctorCreation.reason}; 手動回復が必要です; ホスト回復ID: ${doctorCreation.hostRecoveryId ?? "取得できません"}\n`
      : `Coordinator診断に失敗しました: ${reason}\n`,
  });
}

/**
 * 記録をPlain Dataとして検証する。
 *
 * @responsibility 記録の許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown」がplainRecordの入力契約を満たす。
 * @postcondition plainRecordの責務を完了した結果だけを返す。
 * @effect N/A: plainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainRecordは独自の失敗分岐を所有しない。
 * @invariant plainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: plainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainRecordは共有非同期状態を持たない同期処理である。
 */
function plainRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    types.isProxy(value)
  )
    return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

/**
 * ArrayをPlain Dataとして検証する。
 *
 * @responsibility Arrayの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns readonly unknown[]を返す。
 * @precondition 「value: unknown」がplainArrayの入力契約を満たす。
 * @postcondition plainArrayの責務を完了した結果だけを返す。
 * @effect N/A: plainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainArrayは独自の失敗分岐を所有しない。
 * @invariant plainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: plainArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainArrayは共有非同期状態を持たない同期処理である。
 */
function plainArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) && !types.isProxy(value) ? value : [];
}

/**
 * Docker 回復 Doctor Reportを人間向け表示へ整形する。
 *
 * @responsibility Docker 回復 Doctor Reportの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000003
 * @input report: unknown、shouldOutputJson: boolean
 * @returns renderDockerRecoveryDoctorReportの計算結果を返す。
 * @precondition 「report: unknown、shouldOutputJson: boolean」がrenderDockerRecoveryDoctorReportの入力契約を満たす。
 * @postcondition renderDockerRecoveryDoctorReportの責務を完了した結果だけを返す。
 * @effect N/A: renderDockerRecoveryDoctorReportは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure renderDockerRecoveryDoctorReportは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant renderDockerRecoveryDoctorReportは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: renderDockerRecoveryDoctorReportはProcess内の同一Subsystemで完結する。
 * @security N/A: renderDockerRecoveryDoctorReportはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: renderDockerRecoveryDoctorReportは共有非同期状態を持たない同期処理である。
 */
export function renderDockerRecoveryDoctorReport(
  report: unknown,
  shouldOutputJson: boolean,
) {
  const reportValue = plainRecord(report);
  const statusDescriptor =
    reportValue && Object.getOwnPropertyDescriptor(reportValue, "status");
  const contractDescriptor =
    reportValue && Object.getOwnPropertyDescriptor(reportValue, "contract");
  if (
    !reportValue ||
    !statusDescriptor ||
    !("value" in statusDescriptor) ||
    typeof statusDescriptor.value !== "string" ||
    typeof reportValue.status !== "string" ||
    (contractDescriptor && !("value" in contractDescriptor))
  )
    throw new Error("diagnostic_failed");
  const contract = contractDescriptor?.value;
  if (contract === "crdd-coordinator/current-runtime-repair") {
    const fields = [
      "contract",
      "status",
      "reason",
      "recoveryId",
      "finalCheckpointConfirmed",
      "outcomeConfirmed",
      "retentionConfirmed",
      "historyConfirmed",
      "completionConfirmed",
      "operationCleanupConfirmed",
      "cliCleanupConfirmed",
      "cliCleanupReason",
      "retentionReviewAfter",
    ] as const;
    if (
      fields.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(reportValue, key);
        return !descriptor || !("value" in descriptor);
      })
    )
      throw new Error("diagnostic_failed");
    const safe = Object.fromEntries(
      fields.map((key) => [
        key,
        Object.getOwnPropertyDescriptor(reportValue, key)?.value,
      ]),
    );
    const reasons = [
      "docker_repair_recovered",
      "docker_repair_failed_closed",
      "docker_repair_boundary_unavailable",
      "docker_repair_state_unavailable",
      "docker_repair_observation_unknown",
      "docker_repair_effect_unknown",
      "docker_repair_cancelled",
      "docker_repair_cleanup_unknown",
      "docker_repair_cancellation_binding_failed",
    ];
    if (
      !["observed", "blocked"].includes(safe.status) ||
      !reasons.includes(safe.reason) ||
      (safe.recoveryId !== null &&
        (typeof safe.recoveryId !== "string" ||
          !/^docker-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
            safe.recoveryId,
          ))) ||
      fields.slice(4, 11).some((key) => typeof safe[key] !== "boolean") ||
      (safe.retentionReviewAfter !== null &&
        (typeof safe.retentionReviewAfter !== "string" ||
          !Number.isFinite(Date.parse(safe.retentionReviewAfter)) ||
          new Date(Date.parse(safe.retentionReviewAfter)).toISOString() !==
            safe.retentionReviewAfter)) ||
      safe.retentionConfirmed !== (safe.retentionReviewAfter !== null) ||
      (safe.cliCleanupConfirmed
        ? safe.cliCleanupReason !== null
        : safe.cliCleanupReason !== "docker_repair_cli_cleanup_unconfirmed") ||
      (safe.completionConfirmed &&
        (safe.status !== "observed" ||
          safe.reason !== "docker_repair_recovered" ||
          !safe.historyConfirmed ||
          safe.recoveryId === null)) ||
      (safe.retentionConfirmed &&
        !safe.completionConfirmed &&
        safe.status === "observed" &&
        (!safe.outcomeConfirmed ||
          !safe.finalCheckpointConfirmed ||
          !safe.operationCleanupConfirmed)) ||
      (safe.historyConfirmed && safe.recoveryId === null)
    )
      throw new Error("diagnostic_failed");
    const recovered =
      safe.status === "observed" &&
      safe.reason === "docker_repair_recovered" &&
      safe.recoveryId !== null;
    const completeState =
      recovered && safe.completionConfirmed && safe.historyConfirmed;
    const retained =
      recovered &&
      !safe.completionConfirmed &&
      safe.retentionConfirmed &&
      safe.historyConfirmed &&
      safe.outcomeConfirmed &&
      safe.finalCheckpointConfirmed &&
      safe.operationCleanupConfirmed;
    const awaitingDisposition =
      recovered &&
      !safe.completionConfirmed &&
      !safe.retentionConfirmed &&
      !safe.historyConfirmed &&
      safe.outcomeConfirmed &&
      safe.finalCheckpointConfirmed &&
      safe.operationCleanupConfirmed;
    const stopped =
      safe.reason !== "docker_repair_recovered" && !safe.completionConfirmed;
    if (!(completeState || retained || awaitingDisposition || stopped))
      throw new Error("diagnostic_failed");
    const completed = completeState && safe.cliCleanupConfirmed;
    return Object.freeze({
      stdout: shouldOutputJson
        ? `${JSON.stringify(safe, null, 2)}\n`
        : [
            `Coordinator Docker実行環境の修復: ${completed ? (safe.retentionConfirmed ? "保持引渡し完了" : "完了") : awaitingDisposition ? "技術修復済み・保持判断待ち" : retained ? "保持済み・終了整理待ち" : "停止・確認待ち"}`,
            `- 理由: ${safe.reason}`,
            ...(safe.recoveryId === null
              ? []
              : [`- 回復ID: ${safe.recoveryId}`]),
            `- 履歴保存: ${safe.historyConfirmed ? "確認済み" : "未確認"}`,
            `- 現在状態の終了整理: ${safe.completionConfirmed ? "確認済み" : "未確認"}`,
            ...(safe.retentionReviewAfter === null
              ? []
              : [
                  `- 保持の見直し期限: ${safe.retentionReviewAfter}`,
                  "- 期限までに保持物の削除または保持延長を判断してください。期限だけで自動削除は行いません。",
                ]),
            `- CLI後片付け: ${safe.cliCleanupConfirmed ? "確認済み" : "未確認"}`,
            ...(safe.cliCleanupReason === null
              ? []
              : [`- CLI後片付けの停止理由: ${safe.cliCleanupReason}`]),
            "",
          ].join("\n"),
      exitCode: completed ? 0 : 2,
    });
  }
  if (contract === "crdd-coordinator/current-task-recovery") {
    const fields = [
      "contract",
      "status",
      "reason",
      "recoveryId",
      "dockerCleanupConfirmed",
      "hostCleanupConfirmed",
      "locksReleased",
      "historyConfirmed",
      "operationRetained",
      "operationRemovalConfirmed",
      "taskRecoveryCompleted",
      "cleanupReason",
      "cliCleanupConfirmed",
      "cliCleanupReason",
    ] as const;
    if (
      fields.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(reportValue, key);
        return descriptor && !("value" in descriptor);
      })
    )
      throw new Error("diagnostic_failed");
    const safe = Object.fromEntries(
      fields.map((key) => [
        key,
        Object.getOwnPropertyDescriptor(reportValue, key)?.value ?? null,
      ]),
    );
    if (
      !["blocked", "recovered", "completed"].includes(safe.status) ||
      typeof safe.reason !== "string" ||
      !/^[a-z0-9_]{1,160}$/u.test(safe.reason) ||
      (safe.recoveryId !== null &&
        (typeof safe.recoveryId !== "string" ||
          !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
            safe.recoveryId,
          ))) ||
      fields
        .slice(4)
        .some((key) =>
          key === "cleanupReason" || key === "cliCleanupReason"
            ? safe[key] !== null &&
              (typeof safe[key] !== "string" ||
                !/^[a-z0-9_]{1,160}$/u.test(safe[key]))
            : key === "operationRetained" && safe[key] === null
              ? false
              : typeof safe[key] !== "boolean",
        )
    )
      throw new Error("diagnostic_failed");
    const technical =
      safe.dockerCleanupConfirmed &&
      safe.hostCleanupConfirmed &&
      safe.locksReleased &&
      safe.historyConfirmed &&
      safe.cleanupReason === null;
    const recovered =
      technical &&
      safe.status === "recovered" &&
      safe.reason === "docker_task_recovery_completed" &&
      safe.operationRetained === false &&
      safe.operationRemovalConfirmed &&
      safe.taskRecoveryCompleted;
    const pending =
      technical &&
      safe.status === "completed" &&
      safe.reason === "docker_task_recovery_terminal_confirmed" &&
      safe.operationRetained === true &&
      !safe.operationRemovalConfirmed &&
      !safe.taskRecoveryCompleted;
    const blocked =
      safe.status === "blocked" &&
      !safe.operationRemovalConfirmed &&
      !safe.taskRecoveryCompleted &&
      safe.operationRetained !== false &&
      ![
        "docker_task_recovery_completed",
        "docker_task_recovery_terminal_confirmed",
      ].includes(safe.reason);
    const valid =
      (blocked || recovered || pending) &&
      (safe.cliCleanupConfirmed
        ? safe.cliCleanupReason === null
        : safe.cliCleanupReason !== null);
    if (!valid) throw new Error("diagnostic_failed");
    return Object.freeze({
      stdout: shouldOutputJson
        ? `${JSON.stringify(safe, null, 2)}\n`
        : [
            `Coordinator Task回復: ${recovered ? "完了" : pending ? "技術回収済み・Task保存待ち" : "停止"}`,
            `- 理由: ${safe.reason}`,
            ...(safe.recoveryId === null
              ? []
              : [`- 回復ID: ${safe.recoveryId}`]),
            `- Task回復完了: ${safe.taskRecoveryCompleted ? "はい" : "いいえ"}`,
            `- CLI後片付け: ${safe.cliCleanupConfirmed ? "確認済み" : "未確認"}`,
            ...(safe.cleanupReason === null
              ? []
              : [`- 資源解放の停止理由: ${safe.cleanupReason}`]),
            ...(safe.cliCleanupReason === null
              ? []
              : [`- CLIの停止理由: ${safe.cliCleanupReason}`]),
            "",
          ].join("\n"),
      exitCode: (recovered || pending) && safe.cliCleanupConfirmed ? 0 : 2,
    });
  }
  if (contract === "crdd-coordinator/docker-restart-for-recovery") {
    const isCompleted =
      reportValue.status === "completed" &&
      reportValue.restartCompleted === true &&
      reportValue.cleanupConfirmed === true &&
      reportValue.taskRecoveryCompleted === false;
    return Object.freeze({
      stdout: shouldOutputJson
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${[
            `Dockerの検証付き再起動: ${isCompleted ? "完了" : "停止"}`,
            "Taskの復旧・再実行は行っていません。",
            isCompleted
              ? "次の操作: 同じRepositoryで同じ復旧IDを指定して recovery resume を実行してください。作成結果不明は別途停止する場合があります。"
              : "次の操作: 保存された停止理由と残存記録を確認してください。再起動を繰り返さないでください。",
            `理由: ${typeof reportValue.reason === "string" && /^[a-z0-9_]{1,128}$/u.test(reportValue.reason) ? reportValue.reason : "unconfirmed"}`,
            `資源回収: ${reportValue.cleanupConfirmed === true ? "確認済み" : "未確認"}`,
          ].join("\n")}\n`,
      exitCode: isCompleted ? 0 : 2,
    });
  }
  if (shouldOutputJson) {
    const isRepairReport =
      contract === "crdd-coordinator/docker-desktop-runtime-repair";
    const isRepairSucceeded =
      isRepairReport &&
      [
        "closed_retained",
        "closed_historical_effect_unknown_retained",
        "historical_closed_retained",
      ].includes(reportValue.status) &&
      reportValue.nativeHelperCleanupConfirmed === true &&
      reportValue.newRepairPermitted === true;
    return Object.freeze({
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      exitCode: (isRepairReport
        ? isRepairSucceeded
          ? [reportValue.status]
          : []
        : ["ready", "recovered"]
      ).includes(reportValue.status)
        ? 0
        : 2,
    });
  }
  if (contract === "crdd-coordinator/docker-desktop-runtime-repair") {
    const tri = (value: unknown) =>
      value === true ? "はい" : value === false ? "いいえ" : "未確認";
    const lines = [`Coordinator Docker Desktop復旧: ${reportValue.status}`];
    if (
      typeof reportValue.reason === "string" &&
      /^[a-z0-9_]{1,128}$/u.test(reportValue.reason)
    )
      lines.push(`- 理由: ${reportValue.reason}`);
    if (
      typeof reportValue.repairId === "string" &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(reportValue.repairId)
    )
      lines.push(`- 復旧ID: ${reportValue.repairId}`);
    lines.push(`- Docker Engineの準備完了: ${tri(reportValue.engineReady)}`);
    lines.push(
      `- Docker Engine起動所要時間（参考値）: ${
        typeof reportValue.engineStartupDurationMs === "number" &&
        Number.isFinite(reportValue.engineStartupDurationMs) &&
        reportValue.engineStartupDurationMs >= 0
          ? `${Math.round(reportValue.engineStartupDurationMs)} ms`
          : "未計測"
      }`,
    );
    lines.push(`- プロセス操作の発行: ${tri(reportValue.processEffectIssued)}`);
    lines.push(
      `- プロセス操作の確認状態: ${
        ["not_issued", "confirmed", "unknown"].includes(
          String(reportValue.processEffectConfirmation),
        )
          ? String(reportValue.processEffectConfirmation)
          : "unknown"
      }`,
    );
    lines.push(
      `- ファイルシステム操作の発行: ${tri(reportValue.filesystemEffectIssued)}`,
    );
    lines.push(
      `- ファイルシステム操作の確認状態: ${
        ["not_issued", "confirmed", "unknown"].includes(
          String(reportValue.filesystemEffectConfirmation),
        )
          ? String(reportValue.filesystemEffectConfirmation)
          : "unknown"
      }`,
    );
    lines.push(
      `- 退避した実行時フォルダの状態: ${
        ["absent", "retained", "unknown"].includes(
          String(reportValue.staleRuntimeDirectory),
        )
          ? String(reportValue.staleRuntimeDirectory)
          : "unknown"
      }`,
    );
    lines.push(`- 削除の実行: なし`);
    lines.push(
      `- 復旧根拠の保持状態: ${
        ["preserved", "not_preserved", "unknown"].includes(
          String(reportValue.evidenceState),
        )
          ? String(reportValue.evidenceState)
          : "unknown"
      }`,
    );
    lines.push(
      `- ネイティブ補助プロセスの資源回収確認: ${tri(
        reportValue.nativeHelperCleanupConfirmed,
      )}`,
    );
    lines.push(
      `- 新しい復旧操作の許可: ${tri(reportValue.newRepairPermitted)}`,
    );
    if (
      [
        "recovered_pending_close",
        "historical_recovered_pending_close",
      ].includes(reportValue.status) &&
      typeof reportValue.repairId === "string" &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(reportValue.repairId)
    ) {
      lines.push(
        "- 次の操作: 旧形式の復旧記録です。根拠と対象を保持したまま、フロントAIの移行手順で確認してください。現在の修復IDへ自動変換しません。",
      );
    } else if (
      reportValue.manualRecoveryRequired === true ||
      reportValue.operatorActionRequired === true
    ) {
      lines.push(
        "- 次の操作: 新しい復旧の試行を止め、Runtime運用担当者へ連絡してください。",
      );
      lines.push(
        "- 保持した根拠や段階記録を手動で削除・改名しないでください。",
      );
      if (
        [
          "docker_desktop_repair_record_capacity_unavailable",
          "docker_desktop_repair_operation_capacity_unavailable",
        ].includes(String(reportValue.reason))
      )
        lines.push(
          "- 復旧記録の上限: 再試行や復旧記録の削除・圧縮をしないでください。",
        );
    } else if (reportValue.status === "historical_closed_retained") {
      lines.push(
        "- 結果: 現在のDocker正常状態を確認し、旧版の復旧記録を保持したまま終了しました。",
      );
      lines.push(
        "- 過去の不明な操作は再実行せず、不明だった事実も変更していません。",
      );
      lines.push(
        reportValue.staleRuntimeDirectory === "retained"
          ? "- 退避フォルダ: 元の実体を保持しています。"
          : "- 退避フォルダ: 不存在を確認しました。旧記録は保持しています。",
      );
    } else if (reportValue.status === "closed_retained") {
      lines.push(
        reportValue.staleRuntimeDirectory === "absent"
          ? "- 結果: 復旧記録を終了しました。退避した実行時フォルダは残っていません。復旧記録と確認済みのホスト操作履歴は意図的に保持しています。"
          : "- 結果: 復旧記録を終了しました。退避した実行時フォルダの根拠は意図的に保持しています。",
      );
    } else if (
      reportValue.status === "closed_historical_effect_unknown_retained"
    ) {
      lines.push(
        "- 結果: 復旧記録を終了しました。退避した実行時フォルダは観測されていません。過去のプロセス操作が不明だった事実と復旧記録は意図的に保持しています。",
      );
    }
    return Object.freeze({
      stdout: `${lines.join("\n")}\n`,
      exitCode:
        [
          "closed_retained",
          "closed_historical_effect_unknown_retained",
          "historical_closed_retained",
        ].includes(reportValue.status) &&
        reportValue.nativeHelperCleanupConfirmed === true &&
        reportValue.newRepairPermitted === true
          ? 0
          : 2,
    });
  }
  const lines = [`Coordinator環境診断: ${reportValue.status}`];
  if (
    typeof reportValue.reason === "string" &&
    /^[a-z0-9_]{1,128}$/u.test(reportValue.reason)
  )
    lines.push(`- 理由: ${reportValue.reason}`);
  if (
    typeof reportValue.recoveryId === "string" &&
    /^(?:host-operation\.OP-[0-9]{6,}|docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64})$/u.test(
      reportValue.recoveryId,
    )
  ) {
    lines.push(`- 回復ID: ${reportValue.recoveryId}`);
    if (reportValue.manualRecoveryRequired === true) {
      lines.push(
        "- 次の操作: 新しいタスクを止め、この回復IDをRuntime運用担当者へ渡してください。名前やラベルだけを根拠に資源を削除しないでください。",
      );
    } else
      lines.push(
        `- 次の操作: coordinator recovery resume ${reportValue.recoveryId}`,
      );
  }
  if (reportValue.manualRecoveryRequired === true) {
    lines.push("- 回復: 自動回復は停止しました。");
    lines.push(
      reportValue.evidenceState === "preserved"
        ? "- 回復根拠: 保持済み"
        : reportValue.evidenceState === "not_preserved"
          ? "- 回復根拠: 保持されていません"
          : "- 回復根拠: 保持状況は未確認",
    );
    if (typeof reportValue.recoveryId !== "string")
      lines.push(
        "- 次の操作: 新しいタスクを止め、理由と回復根拠の保持状況をRuntime運用担当者へ渡してください。再利用できる回復IDは取得できていません。名前やラベルだけを根拠に資源を削除しないでください。",
      );
  }
  const providers = plainRecord(reportValue.providers);
  for (const [name, providerValue] of Object.entries(providers ?? {})) {
    const provider = plainRecord(providerValue);
    lines.push(
      `- ${name}: ${provider?.located === true ? "実行ファイルを検出" : "実行ファイルが見つかりません"}; 実行による確認は行っていません。`,
    );
  }
  if (reportValue.credentials) lines.push("- 認証情報の値の記録: なし");
  const filesystem = plainRecord(reportValue.filesystem);
  if (typeof filesystem?.enforcement === "string")
    lines.push(`- ファイルシステム制約の強制状態: ${filesystem.enforcement}`);
  const egress = plainRecord(reportValue.egress);
  if (typeof egress?.providerAllowlist === "string")
    lines.push(`- Provider外部送信先の許可リスト: ${egress.providerAllowlist}`);
  const runtimeRootEvaluation = plainRecord(reportValue.runtimeRootEvaluation);
  if (typeof runtimeRootEvaluation?.status === "string")
    lines.push(
      `- Runtimeルートの評価: ${runtimeRootEvaluation.status}; 状態変更は行っていません。`,
    );
  const recovery = plainRecord(reportValue.recovery);
  if (recovery?.manualRecoveryRequired === true) {
    const recoveryReason =
      typeof recovery.reason === "string" ? recovery.reason : "unknown";
    lines.push(
      `- 回復: 自動回復用のIDを取得できません。手動で安全を確認する対応が必要です (${recoveryReason})。`,
    );
  } else if (
    recovery?.required === true &&
    typeof recovery.recoveryId === "string"
  )
    lines.push(
      "- 回復: 返された回復IDを指定して recovery resume を実行してください。",
    );
  const blockers = plainArray(reportValue.blockers);
  lines.push(`- 実行を妨げる事項: ${blockers.length}`);
  for (const blockerValue of blockers) {
    const blocker = plainRecord(blockerValue);
    if (typeof blocker?.id === "string" && typeof blocker.reason === "string")
      lines.push(`  - ${blocker.id}: ${blocker.reason}`);
  }
  return Object.freeze({
    stdout: `${lines.join("\n")}\n`,
    exitCode: ["ready", "recovered"].includes(reportValue.status) ? 0 : 2,
  });
}

/**
 * 共通認証コマンドの文法・端末・取消・表示を接続する。
 * @responsibility 認証の意味・Home選択・回収は正式APIへ委譲する。
 * @trace ARCH-000004
 * @input args: status/login、Provider、statusだけに許可する任意の--json。
 * @returns 表示と終了値の設定。
 * @precondition 一回のCLI受付から呼ぶ。
 * @postcondition 不正入力・端末不足ではAPIを呼ばない。
 * @effect 検査後の正式認証API、Signal登録と出力。
 * @failure 文法は64、操作未完了は2。未知の回収を成功化しない。
 * @invariant 通常Task・Repository・APIキーへ接続しない。
 * @boundary Process端末と正式API。
 * @security loginの生対話は下位がTTYへ直接接続する。
 * @concurrency 一回取消・操作待機後のListener解除を維持する。
 */
export async function runAuthenticationCommand(
  args: readonly string[],
): Promise<void> {
  if (args.length === 1 && ["--help", "help", "-h"].includes(args[0] ?? "")) {
    process.stdout.write(
      "auth status codex|claude [--json] : 通信なしの認証状態確認\nauth login codex|claude : 専用Homeへの公式対話ログイン（--json非対応）\n",
    );
    process.exitCode = 0;
    return;
  }
  const [action, provider, format] = args;
  const invalid =
    args.length < 2 ||
    args.length > 3 ||
    (action !== "status" && action !== "login") ||
    (provider !== "codex" && provider !== "claude") ||
    (format !== undefined && (format !== "--json" || action !== "status"));
  if (
    invalid ||
    !isSupportedNodeRuntime(process.versions.node) ||
    (action === "login" &&
      (process.stdin.isTTY !== true || process.stdout.isTTY !== true))
  ) {
    const reason = invalid
      ? "provider_authentication_arguments_invalid"
      : !isSupportedNodeRuntime(process.versions.node)
        ? "coordinator_node_version_unsupported"
        : "provider_authentication_interactive_terminal_required";
    process.stderr.write(`${reason}\n`);
    process.exitCode = 64;
    return;
  }
  const controller = new AbortController();
  const binding = bindTaskCliCancellationSignals(async () =>
    controller.abort(),
  );
  let result: Readonly<Record<string, unknown>>;
  let signalsReleased = false;
  try {
    if (binding.status !== "bound") {
      result = {
        status: "blocked",
        reason: "provider_authentication_signal_binding_failed",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      };
    } else {
      if (action === "login")
        process.stderr.write(
          "表示されたProvider公式手順だけを完了してください。秘密値をチャットへ貼らないでください。\n" +
            PROVIDER_AUTHENTICATION_INPUT_NOTICE +
            "\n",
        );
      result = await (action === "status"
        ? getAuthenticationStatus
        : authenticateProvider)({ provider }, controller.signal);
    }
  } catch {
    result = {
      status: "blocked",
      reason: "provider_authentication_entry_failed",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    };
  } finally {
    try {
      signalsReleased = binding.unbind().status === "released";
    } catch {
      signalsReleased = false;
    }
    if (!signalsReleased) {
      process.stderr.write("provider_authentication_signal_release_failed\n");
      process.exitCode = 2;
    }
  }
  if (!signalsReleased)
    result = {
      ...result,
      status: "blocked",
      cliCleanupConfirmed: false,
      cliReason: "provider_authentication_signal_release_failed",
    };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.exitCode !== 2)
    process.exitCode = result.status === "completed" ? 0 : 2;
}

/**
 * 診断・回復Commandを一回実行し、取消解除後に結果を表示する。
 * @responsibility CLIの接続条件だけを検査し、回復種別の判断と処置は正式APIへ委譲する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @input arguments_: 対象、操作、任意のexact参照と--json。
 * @returns 終了値を設定して完了する。
 * @precondition 共通受付でNode版を確認済み。
 * @postcondition 一回の操作を待機しListener解除を確認してから一回表示する。
 * @effect 診断は局所観測用の一時領域を作る場合があり、厳密なEffect 0ではない。
 * @failure 入力拒否64、操作失敗2。解除失敗で一次理由を上書きしない。
 * @invariant 表示失敗による再実行や自動再起動をしない。
 * @boundary 端末と正式API。内部のRoot・Scope・checkpointを追加公開しない。
 * @security Rootは現在Repositoryから検証し、任意Pathを受け取らない。
 * @concurrency 取消を同じSignalへ伝え、finallyでListenerを解除する。
 */
export async function runDoctorCommand(
  arguments_: readonly string[],
): Promise<void> {
  const json = arguments_.includes("--json");
  try {
    const parsed = parseDoctorArguments(arguments_, undefined);
    if (parsed.status !== "ok" || !parsed.value)
      throw new UsageError(parsed.reason ?? "doctor_arguments_invalid");
    const options = parsed.value;
    const verified = getRepository(
      resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
    );
    if (verified.status !== "completed")
      throw new Error("coordinator_repository_root_not_verified");
    const context = { rootCapability: verified.capability };
    let report: Readonly<Record<string, unknown>>;
    let cliCleanupConfirmed = true;
    if (options.action === "inspect") {
      if (options.recoveryId === null)
        throw new UsageError("doctor_arguments_invalid");
      const observation = readRecovery(
        { recoveryId: options.recoveryId },
        context,
        new AbortController().signal,
      );
      const rendered = renderRecoveryObservation(observation, json);
      process.stdout.write(rendered.stdout);
      process.exitCode = rendered.exitCode;
      return;
    } else if (options.action === "check" || options.action === "isolation") {
      const controller = new AbortController();
      const binding = bindTaskCliCancellationSignals(async () =>
        controller.abort(),
      );
      cliCleanupConfirmed = false;
      try {
        if (binding.status !== "bound")
          throw new Error("coordinator_cli_cancellation_binding_failed");
        report = await diagnoseEnvironment(
          { activeIsolation: options.action === "isolation" },
          context,
          controller.signal,
        );
      } finally {
        try {
          cliCleanupConfirmed = binding.unbind().status === "released";
        } catch {
          cliCleanupConfirmed = false;
        }
      }
    } else {
      const recoveryId = options.recoveryId;
      const repair =
        options.action === "repair-docker" ||
        options.action === "retain-repair" ||
        recoveryId?.startsWith("docker-repair.") === true;
      if (
        ["resume", "restart-docker", "retain-repair"].includes(
          options.action,
        ) &&
        recoveryId === null
      )
        throw new UsageError("doctor_arguments_invalid");
      const controller = new AbortController();
      const binding = bindTaskCliCancellationSignals(async () =>
        controller.abort(),
      );
      let result: Readonly<Record<string, unknown>> = {
        status: "blocked",
        reason: repair
          ? "docker_repair_cancellation_binding_failed"
          : "coordinator_cli_cancellation_binding_failed",
        recoveryId,
        cleanupConfirmed: false,
        restartCompleted: false,
        taskRecoveryCompleted: false,
        ...(repair
          ? {
              finalCheckpointConfirmed: false,
              outcomeConfirmed: false,
              retentionConfirmed: false,
              retentionReviewAfter: null,
              historyConfirmed: false,
              completionConfirmed: false,
              operationCleanupConfirmed: false,
            }
          : {}),
      };
      cliCleanupConfirmed = false;
      try {
        if (binding.status === "bound") {
          if (options.action === "resume" && recoveryId !== null)
            result = await recoverExecution(
              { recoveryId },
              context,
              controller.signal,
            );
          else if (options.action === "restart-docker" && recoveryId !== null)
            result = await restartDockerForRecovery(
              { recoveryId },
              context,
              controller.signal,
            );
          else if (options.action === "retain-repair" && recoveryId !== null)
            result = await retainRepair(
              { recoveryId },
              context,
              controller.signal,
            );
          else
            result = await repairDockerRuntime(
              null,
              context,
              controller.signal,
            );
        }
      } finally {
        try {
          cliCleanupConfirmed = binding.unbind().status === "released";
        } catch {
          cliCleanupConfirmed = false;
        }
      }
      report = {
        ...result,
        ...(repair
          ? { contract: "crdd-coordinator/current-runtime-repair" }
          : options.action === "restart-docker"
            ? { contract: "crdd-coordinator/docker-restart-for-recovery" }
            : {}),
        cliCleanupConfirmed,
        cliCleanupReason: cliCleanupConfirmed
          ? null
          : repair
            ? "docker_repair_cli_cleanup_unconfirmed"
            : "docker_task_recovery_cli_cleanup_unconfirmed",
      };
    }
    const rendered = renderDockerRecoveryDoctorReport(report, json);
    process.stdout.write(rendered.stdout);
    process.exitCode = cliCleanupConfirmed ? rendered.exitCode : 2;
  } catch (error) {
    const failure = renderDoctorCommandFailure(error);
    (json ? process.stdout : process.stderr).write(
      json ? failure.json : failure.human,
    );
    process.exitCode = error instanceof UsageError ? 64 : failure.exitCode;
  }
}

/**
 * Project Commandを実行する。
 *
 * @responsibility Project Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns runProjectCommandの計算結果を返す。
 * @precondition 「args: readonly string[]」がrunProjectCommandの入力契約を満たす。
 * @postcondition runProjectCommandの責務を完了した結果だけを返す。
 * @effect runProjectCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runProjectCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runProjectCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runProjectCommandは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runProjectCommand(args: readonly string[]) {
  if (
    args.length !== 5 ||
    args[0] !== "objective" ||
    args[1] !== "--request-stdin" ||
    args[2] !== "--json" ||
    args[3] !== "--principal-id" ||
    !isPrincipalId(args[4]) ||
    !args[4].startsWith("local.email.")
  ) {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          status: "blocked",
          reason: "project_arguments_invalid",
        }),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 64;
    return;
  }
  let request: unknown;
  try {
    request = readBoundedTaskRequestFromStdin();
  } catch (rawError) {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          status: "blocked",
          reason:
            rawError instanceof UsageError
              ? rawError.message
              : "project_request_invalid",
        }),
        null,
        2,
      )}\n`,
    );
    process.exitCode = rawError instanceof UsageError ? 64 : 2;
    return;
  }
  const controller = new AbortController();
  const binding = bindTaskCliCancellationSignals(async () =>
    controller.abort(),
  );
  let result:
    | Awaited<ReturnType<typeof runObjective>>
    | Readonly<{ status: "blocked"; reason: string }>;
  let released: ReturnType<typeof binding.unbind> | undefined;
  try {
    result =
      binding.status === "bound"
        ? await runObjective(request, controller.signal, process.cwd(), {
            principalId: args[4],
          })
        : {
            status: "blocked",
            reason: "project_cli_cancellation_binding_failed",
          };
  } finally {
    try {
      released = binding.unbind();
    } catch {
      released = undefined;
    }
  }
  if (binding.status !== "bound" || released?.status !== "released") {
    process.stdout.write(
      `${JSON.stringify(
        Object.freeze({
          command: "project",
          ...result,
          status: "unknown",
          cliCleanupConfirmed: false,
          cliReason: "project_cli_cancellation_binding_failed",
        }),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
    return;
  }
  process.stdout.write(
    `${JSON.stringify({ command: "project", ...result })}\n`,
  );
  process.exitCode = result.status === "completed" ? 0 : 2;
}

/**
 * 編集・助言CLIを共通の単発Ownerと上位の対象解決へ接続する。
 * @responsibility 用途一致、編集時の明示Workspace、固定選定、取消joinと結果公開。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @input --request-stdin --json --principal-idと共通SingleTaskCommand。
 * @returns 終端を一回出力する。
 * @effect 既存Ownerの受付・保存・AI実行。入力拒否では開始しない。
 * @failure 対象省略、旧Task形式、Root／Context不明は開始前停止。
 * @invariant Workspace選択をCoordinatorへ委譲せず、未指定をDirect化しない。
 * @boundary 配布CLIからCoordinator。新しい台帳・Lock・Recoveryなし。
 */
export async function runSingleTaskCommand(args: readonly string[]) {
  if (
    args.length !== 5 ||
    !["task", "advice"].includes(args[0] ?? "") ||
    args[1] !== "--request-stdin" ||
    args[2] !== "--json" ||
    args[3] !== "--principal-id" ||
    !isPrincipalId(args[4]) ||
    !args[4].startsWith("local.email.")
  ) {
    process.stdout.write(
      `${JSON.stringify({ command: args[0] === "advice" ? "advice" : "task", status: "blocked", reason: "task_arguments_invalid" }, null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
  const operation = args[0] === "advice" ? "advice" : "task";
  let cancellation: ReturnType<typeof bindTaskCliCancellationSignals> | null =
    null;
  const controller = new AbortController();
  let report: Record<string, unknown> = {
    command: operation,
    status: "blocked",
    reason: "task_entry_unconfirmed",
  };
  try {
    const command = inspectSingleTaskCommand(readBoundedTaskRequestFromStdin());
    if (
      command?.mode !==
      (operation === "advice" ? "read_only_advice" : "workspace_edit")
    )
      throw new UsageError(
        operation === "advice"
          ? "advice_request_required"
          : "task_workspace_request_required",
      );
    const root = resolveVerifiedRepositoryRootFromWorkingDirectory(
      process.cwd(),
    );
    const verified = getRepository(root);
    if (verified.status !== "completed")
      throw new UsageError("task_repository_configuration_unavailable");
    const contextIntake = parseRepositoryProjectContextMarkdown(
      readStableFileSnapshot(
        path.join(root, "PROJECT_CONTEXT.md"),
      ).bytes.toString("utf8"),
    );
    const context = contextIntake.result;
    if (context === null)
      throw new Error(
        contextIntake.issues.find(
          (issue) =>
            issue.kind === "artifact.project-context.projection-model-invalid",
        )?.reason ?? "project_context_scene_invalid",
      );
    cancellation = bindTaskCliCancellationSignals(async () =>
      controller.abort(),
    );
    if (cancellation.status !== "bound")
      throw new UsageError("task_cancellation_binding_failed");
    report = {
      command: operation,
      ...(await runTask(
        {
          rootCapability: verified.capability,
          projectId: context.projectId,
          principalId: args[4],
          authorize: () =>
            resolveVerifiedRepositoryRootFromWorkingDirectory(root) === root,
          consumer: "coordinator_cli",
        },
        command,
        controller.signal,
      )),
    };
  } catch (error) {
    report = {
      ...report,
      command: operation,
      status: typeof report.requestId === "string" ? "unknown" : "blocked",
      cleanupConfirmed: false,
      reason:
        error instanceof UsageError ? error.message : "task_entry_unconfirmed",
    };
  } finally {
    let released = cancellation === null;
    try {
      released =
        cancellation === null || cancellation.unbind().status === "released";
    } catch {
      released = false;
    }
    if (!released) {
      report = {
        ...report,
        status: "unknown",
        secondaryFailures: [
          ...(Array.isArray(report.secondaryFailures)
            ? report.secondaryFailures
            : []),
          "task_cancellation_release_unconfirmed",
        ],
      };
    }
  }
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode =
    report.status === "completed" && report.cleanupConfirmed === true ? 0 : 2;
}

/**
 * 通常Commandの文法と端末条件を実行前に確認する。
 * @responsibility 起動モードの別名を持たず、対象・操作を一意に解決する。
 * @trace ARCH-000004
 * @input args: 対象・操作・引数、observation: 現在の実行環境。
 * @returns readyと同じ引数、または有限理由のblocked。
 * @precondition 観測値は呼出し元が現在Processから取得する。
 * @postcondition 不正な文法・Node版・出力条件では操作を配送しない。
 * @effect N/A: 入力値だけの同期検査。
 * @failure 不明・旧モードは拒否する。
 * @invariant CLI受付はAuthorityや送信同意を与えない。
 * @boundary CLI内の純粋な配送判断。
 * @security 引数本文を拒否理由へ複製しない。
 * @concurrency N/A: 共有状態なし。
 */
export function resolveCoordinatorLaunch(
  args: readonly string[],
  observation: LaunchObservation,
) {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (!isSupportedNodeRuntime(observation.nodeVersion))
    return blocked("coordinator_node_version_unsupported");
  if (
    args.length > 16 ||
    args.some(
      (a) =>
        typeof a !== "string" ||
        !a.length ||
        a.length > 4096 ||
        /[\u0000-\u001f\u007f]/u.test(a),
    )
  )
    return blocked("coordinator_launch_arguments_invalid");
  const [target, action, ...tail] = args;
  if (
    !target ||
    ![
      "run",
      "doctor",
      "recovery",
      "maintenance",
      "auth",
      "capabilities",
      "help",
      "--help",
      "-h",
    ].includes(target)
  )
    return blocked("coordinator_launch_mode_invalid");
  if (!observation.stdoutWritable)
    return blocked("coordinator_launch_terminal_output_required");
  if (target === "run") {
    if (
      !["task", "objective", "advice"].includes(action ?? "") ||
      tail.length !== 4 ||
      tail[0] !== "--request-stdin" ||
      tail[1] !== "--json" ||
      tail[2] !== "--principal-id" ||
      !isPrincipalId(tail[3]) ||
      !tail[3].startsWith("local.email.")
    )
      return blocked("coordinator_launch_arguments_invalid");
    if (observation.stdoutIsTty)
      return blocked("coordinator_launch_machine_output_required");
  }
  if (
    target === "auth" &&
    action === "login" &&
    (!observation.stdinIsTty || !observation.stdoutIsTty)
  )
    return blocked("coordinator_launch_terminal_input_required");
  return Object.freeze({
    status: "ready" as const,
    forwardedArgs: Object.freeze([...args]),
  });
}

/**
 * 起動拒否を秘密情報を含まない説明へ変換する。
 * @responsibility 有限理由を短い人間向け案内へ変換する。
 * @trace ARCH-000004
 * @input reason: 受付の有限理由。
 * @returns 人間向け案内。
 * @precondition 秘密本文を渡さない。
 * @postcondition 引数・Pathを出力しない。
 * @effect N/A: 文字列変換のみ。
 * @failure 未知理由は実行・回収未確認とする。
 * @invariant 失敗を成功化しない。
 * @boundary CLI内。
 * @security 秘密値を含まない。
 * @concurrency N/A: 同期処理。
 */
export function coordinatorLaunchFailureMessage(reason: string) {
  if (reason === "coordinator_node_version_unsupported")
    return "対応するNode.jsで起動してください。実処理は開始していません。";
  if (reason === "coordinator_launch_machine_output_required")
    return "機械向け結果はパイプ等へ接続してください。実処理は開始していません。";
  if (reason === "coordinator_launch_terminal_input_required")
    return "公式ログインは入出力を直接接続した端末で行ってください。";
  if (reason.startsWith("coordinator_launch_"))
    return "対象と操作、引数または出力先を確認してください。--helpで一覧を表示できます。";
  return "実行状態と資源回収は未確認です。自動再試行せず記録を確認してください。";
}

/**
 * 通常CLIを一回配送し、同じ操作の完了を待つ。
 * @responsibility help・能力表示と専門CLIへの有限配送。
 * @trace ARCH-000004
 * @input arguments_: 省略時は現在のProcess引数。
 * @returns 表示と終了値を設定する。
 * @precondition 一回のCLI起動として呼ぶ。
 * @postcondition 専門操作と取消解除を待機する。
 * @effect 専門API、標準入出力。受付拒否では下位操作なし。
 * @failure 受付拒否64、開始後の不明失敗2。
 * @invariant Shell・子Process・cwd・環境を書き換えない。
 * @boundary CLIと専門操作。
 * @security ログイン・機械出力の端末条件を実行前に確認する。
 * @concurrency 一つの操作をawaitし、自動再送しない。
 */
export async function runCoordinatorCommand(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const args = arguments_.length ? arguments_ : ["help"];
  const plan = resolveCoordinatorLaunch(args, {
    nodeVersion: process.versions.node,
    stdinIsTty: process.stdin.isTTY === true,
    stdoutIsTty: process.stdout.isTTY === true,
    stdoutWritable: !process.stdout.destroyed && process.stdout.writable,
  });
  if (plan.status !== "ready") {
    process.stderr.write(
      coordinatorLaunchFailureMessage(plan.reason) + "\n" + plan.reason + "\n",
    );
    process.exitCode = 64;
    return;
  }
  try {
    const [target, ...rest] = plan.forwardedArgs;
    if (target && ["help", "--help", "-h"].includes(target)) {
      if (rest.length) {
        process.exitCode = 64;
        return;
      }
      process.stdout.write(
        "Coordinator — 対象と操作\n" +
          getCapabilities()
            .commands.map((c) => "  coordinator " + c.invocation)
            .join("\n") +
          "\n",
      );
      process.exitCode = 0;
    } else if (target === "capabilities") {
      if (rest.length !== 1 || rest[0] !== "--json") {
        process.stderr.write("Usage: coordinator capabilities --json\n");
        process.exitCode = 64;
        return;
      }
      process.stdout.write(JSON.stringify(getCapabilities()) + "\n");
      process.exitCode = 0;
    } else if (target === "auth") await runAuthenticationCommand(rest);
    else if (target === "run" && rest[0] === "objective")
      await runProjectCommand(rest);
    else if (target === "run") await runSingleTaskCommand(rest);
    else await runDoctorCommand(plan.forwardedArgs);
  } catch {
    process.stderr.write(
      coordinatorLaunchFailureMessage("entry_failed") +
        "\ncoordinator_launch_entry_failed\n",
    );
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await runCoordinatorCommand();
