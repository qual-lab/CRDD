/**
 * Coordinator所有のHost回復記録と状態遷移相関を扱う。
 * @responsibility 元token・同じRoot・記録bytesを照合し、Docker操作やProbe資源記録を所有しない。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";

/**
 * 同じHostのRootとmarkerを、削除後も別々に観測する。
 * @responsibility 正規の親・記録領域とtokenへ対象を固定し、観測不能を不存在へ畳まない。
 * @trace ARCH-000008
 * @input token: exact Host参照、expectedRoot: 現在Identityの絶対Root。
 * @returns 二対象のpresent／absent／unknownと固定marker Path。
 * @precondition 処置Ownerと保持排他は呼出し側が別に照合する。
 * @postcondition ENOENTだけを不存在とし、両不存在だけでAuthorityを発行しない。
 * @effect 同じ親・記録領域・Root・markerの読取りだけ。
 * @failure 不正Path・link・親差・観測例外はunknown。
 * @invariant 別親探索、旧形式探索、作成・削除を行わない。
 * @boundary 現在Host IdentityとFilesystemの三値観測。
 * @security Package内部の所在確認であり公開出力へPathを搬送しない。
 * @concurrency 世代取得後と保存直前にも再観測する。
 */
export function observeHostRecoveryCleanup(
  token: unknown,
  expectedRoot: unknown,
): Readonly<{
  root: "present" | "absent" | "unknown";
  marker: "present" | "absent" | "unknown";
  markerPath: string | null;
}> {
  try {
    const parsed = parseHostRecoveryToken(token);
    if (
      typeof expectedRoot !== "string" ||
      !path.isAbsolute(expectedRoot) ||
      path.resolve(expectedRoot) !== expectedRoot ||
      path.basename(expectedRoot) !== parsed.rootName
    )
      throw new Error("host_recovery_root_mismatch");
    const parent = path.dirname(expectedRoot);
    const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
    for (const location of [parent, directory]) {
      const metadata = fs.lstatSync(location);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync(location) !== location
      )
        throw new Error("host_recovery_directory_untrusted");
    }
    const markerPath = path.join(
      directory,
      `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
    );
    const rootMetadata = fs.lstatSync(expectedRoot, { throwIfNoEntry: false });
    const markerMetadata = fs.lstatSync(markerPath, { throwIfNoEntry: false });
    if (
      rootMetadata &&
      (!rootMetadata.isDirectory() ||
        rootMetadata.isSymbolicLink() ||
        fs.realpathSync(expectedRoot) !== expectedRoot)
    )
      throw new Error("host_recovery_root_untrusted");
    if (
      markerMetadata &&
      (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    )
      throw new Error("host_recovery_record_untrusted");
    return Object.freeze({
      root: rootMetadata ? ("present" as const) : ("absent" as const),
      marker: markerMetadata ? ("present" as const) : ("absent" as const),
      markerPath,
    });
  } catch {
    return Object.freeze({
      root: "unknown" as const,
      marker: "unknown" as const,
      markerPath: null,
    });
  }
}

/**
 * Host 回復 Tokenを表示形式へ整形する。
 *
 * @responsibility Host 回復 Tokenの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000008
 * @input rootName: string、nonce: string、recordHash: string
 * @returns formatHostRecoveryTokenの計算結果を返す。
 * @precondition 「rootName: string、nonce: string、recordHash: string」がformatHostRecoveryTokenの入力契約を満たす。
 * @postcondition formatHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: formatHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: formatHostRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant formatHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: formatHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security formatHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: formatHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function formatHostRecoveryToken(
  rootName: string,
  nonce: string,
  recordHash: string,
) {
  return `host.${rootName}.${nonce}.${recordHash}`;
}

/**
 * Host 回復 Tokenを構造化値へ解析する。
 *
 * @responsibility Host 回復 Tokenの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns parseHostRecoveryTokenの計算結果を返す。
 * @precondition 「token: unknown」がparseHostRecoveryTokenの入力契約を満たす。
 * @postcondition parseHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: parseHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseHostRecoveryTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security parseHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function parseHostRecoveryToken(token: unknown) {
  if (typeof token !== "string") throw new Error("host_recovery_token_invalid");
  const match =
    /^host\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\.([0-9a-f-]{36})\.([0-9a-f]{64})$/u.exec(
      token ?? "",
    );
  if (!match) throw new Error("host_recovery_token_invalid");
  const rootName = match[1];
  const nonce = match[2];
  const recordHash = match[3];
  if (!rootName || !nonce || !recordHash)
    throw new Error("host_recovery_token_invalid");
  return { rootName, nonce, recordHash };
}

/**
 * Host 回復 記録 By Tokenを読み込む。
 *
 * @responsibility Host 回復 記録 By Tokenの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: exact参照、expectedRoot: 元Ownerまたは現在操作に結合した絶対Root。
 * @returns 同じRoot直下の親に保存されたexact markerと記録。
 * @precondition 親scopeの処置許可は呼出し元が別に確認する。
 * @postcondition 操作Root不存在でも同じ親以外を探索しない。
 * @effect 親・記録Directory・markerの読取りだけ。作成・書込みなし。
 * @failure loadHostRecoveryRecordByTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadHostRecoveryRecordByTokenは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security loadHostRecoveryRecordByTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHostRecoveryRecordByTokenは共有非同期状態を持たない同期処理である。
 */
export function loadHostRecoveryRecordByToken(
  token: unknown,
  expectedRoot: unknown,
) {
  const parsed = parseHostRecoveryToken(token);
  if (
    typeof expectedRoot !== "string" ||
    !path.isAbsolute(expectedRoot) ||
    path.resolve(expectedRoot) !== expectedRoot ||
    path.basename(expectedRoot) !== parsed.rootName
  )
    throw new Error("host_recovery_root_mismatch");
  const parent = path.dirname(expectedRoot);
  const parentMetadata = fs.lstatSync(parent);
  if (
    !parentMetadata.isDirectory() ||
    parentMetadata.isSymbolicLink() ||
    fs.realpathSync(parent) !== parent
  )
    throw new Error("host_recovery_parent_untrusted");
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  const realDirectory = fs.realpathSync(directory);
  const directoryMetadata = fs.lstatSync(realDirectory);
  if (
    realDirectory !== directory ||
    path.dirname(realDirectory) !== parent ||
    !directoryMetadata.isDirectory() ||
    directoryMetadata.isSymbolicLink()
  )
    throw new Error("host_recovery_directory_untrusted");
  const marker = path.join(
    realDirectory,
    `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
  );
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (
    createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash
  )
    throw new Error("host_recovery_record_mismatch");
  const record = JSON.parse(serialized);
  if (
    record.schema !== "crdd-coordinator-host-recovery/v1" ||
    record.rootName !== parsed.rootName
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  const after = fs.lstatSync(marker);
  if (
    !after.isFile() ||
    after.isSymbolicLink() ||
    after.dev !== markerMetadata.dev ||
    after.ino !== markerMetadata.ino ||
    after.birthtimeMs !== markerMetadata.birthtimeMs ||
    after.size !== markerMetadata.size ||
    fs.realpathSync(directory) !== directory ||
    fs.realpathSync(parent) !== parent
  )
    throw new Error("host_recovery_record_replaced");
  return {
    parsed,
    parent,
    directory: realDirectory,
    marker,
    record,
    serialized,
  };
}

/**
 * canonicalHostRecoveryTransitionRecordを決定する。
 *
 * @responsibility canonicalHostRecoveryTransitionRecordの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalHostRecoveryTransitionRecordの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalHostRecoveryTransitionRecordの入力契約を満たす。
 * @postcondition canonicalHostRecoveryTransitionRecordの責務を完了した結果だけを返す。
 * @effect N/A: canonicalHostRecoveryTransitionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalHostRecoveryTransitionRecordは独自の失敗分岐を所有しない。
 * @invariant canonicalHostRecoveryTransitionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalHostRecoveryTransitionRecordはProcess内の同一Subsystemで完結する。
 * @security canonicalHostRecoveryTransitionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalHostRecoveryTransitionRecordは共有非同期状態を持たない同期処理である。
 */
function canonicalHostRecoveryTransitionRecord(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

/**
 * Host記録の状態遷移相関の契約を検証する。
 *
 * @responsibility Host記録の状態遷移相関の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、requiredNextState: string
 * @returns validateHostRecoveryTransitionLineageの計算結果を返す。
 * @precondition 「value: unknown、requiredNextState: string」がvalidateHostRecoveryTransitionLineageの入力契約を満たす。
 * @postcondition validateHostRecoveryTransitionLineageの責務を完了した結果だけを返す。
 * @effect N/A: validateHostRecoveryTransitionLineageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateHostRecoveryTransitionLineageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateHostRecoveryTransitionLineageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateHostRecoveryTransitionLineageはProcess内の同一Subsystemで完結する。
 * @security validateHostRecoveryTransitionLineageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateHostRecoveryTransitionLineageは共有非同期状態を持たない同期処理である。
 */
export function validateHostRecoveryTransitionLineage(
  value: unknown,
  requiredNextState?: string,
) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const intent = value as Record<string, unknown>;
  const currentToken = String(intent.currentToken ?? "");
  const expectedToken = String(intent.expectedToken ?? "");
  const current = parseHostRecoveryToken(currentToken);
  const expected = parseHostRecoveryToken(expectedToken);
  const recordBefore = intent.recordBefore;
  if (
    !recordBefore ||
    typeof recordBefore !== "object" ||
    Array.isArray(recordBefore) ||
    Object.getPrototypeOf(recordBefore) !== Object.prototype ||
    current.rootName !== intent.rootName ||
    expected.rootName !== intent.rootName ||
    current.nonce !== intent.nonce ||
    expected.nonce !== intent.nonce ||
    (requiredNextState !== undefined &&
      intent.nextState !== requiredNextState) ||
    typeof intent.currentState !== "string" ||
    typeof intent.nextState !== "string" ||
    intent.currentToken === intent.expectedToken
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  const before = recordBefore as Record<string, unknown>;
  const beforeHash = createHash("sha256")
    .update(canonicalHostRecoveryTransitionRecord(before))
    .digest("hex");
  const successor = Object.freeze({ ...before, state: intent.nextState });
  const successorHash = createHash("sha256")
    .update(canonicalHostRecoveryTransitionRecord(successor))
    .digest("hex");
  if (
    current.recordHash !== beforeHash ||
    expected.recordHash !== successorHash ||
    before.state !== intent.currentState ||
    successor.state !== intent.nextState
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  return Object.freeze({ currentToken, expectedToken, current, expected });
}
