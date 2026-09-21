/**
 * private-key-signingに属する責務をまとめる。
 *
 * @responsibility FileIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAXIMUM_ENVIRONMENT_BYTES = 8 * 1024;
const MAXIMUM_PASSPHRASE_BYTES = 1_024;

/**
 * 事前確認した秘密鍵Fileの同一性を表す。
 *
 * @responsibility PathだけでなくFilesystem Identityと変更検出値を固定する。
 * @trace ARCH-000014
 * @shape FileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant 同一性の比較に必要なPath、Device、inode、時刻およびSizeを一組で保持する。
 * @boundary Filesystem観測値と署名処理の型境界。
 * @security 秘密鍵内容を保持せず、非秘密のFilesystem Identityだけを表す。
 * @compatibility FileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FileIdentity = Readonly<{
  resolvedPath: string;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mtimeNs: bigint;
}>;

/**
 * 一回の秘密鍵参照を許可する非秘密のCapabilityを表す。
 *
 * @responsibility 検証済みFile Identityを秘密値なしで署名要求へ結合する。
 * @trace ARCH-000014
 * @shape PrivateKeyReferenceAuthorizationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Contract名とRevisionを固定し、秘密値を含めない。
 * @boundary 事前確認と署名実行のCapability境界。
 * @security Capabilityの再利用を許さない。
 * @compatibility PrivateKeyReferenceAuthorizationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PrivateKeyReferenceAuthorization = Readonly<{
  contract: "crdd-artifact-signing/private-key-reference-authorization";
  contractRevision: 1;
}>;

const authorizations = new WeakMap<
  PrivateKeyReferenceAuthorization,
  Readonly<{ identity: FileIdentity; consumed: boolean }>
>();

/**
 * 候補Pathが指定Rootの内側かを判定する。
 *
 * @responsibility 秘密鍵参照の禁止Root境界をPath比較で強制する。
 * @trace ARCH-000014
 * @input 親Rootと判定対象Path。
 * @returns 対象が親Root自身または内側にある場合はtrue。
 * @precondition 両Pathは呼出し側が比較可能な絶対Pathへ正規化する。
 * @postcondition 入力PathとFilesystemを変更しない。
 * @effect N/A: Path文字列だけを比較する純粋計算である。
 * @failure N/A: Path包含の真偽だけを返す。
 * @invariant `..`または絶対相対Pathを親Root内として受理しない。
 * @boundary Filesystem Pathの包含境界。
 * @security 禁止RootからのPath逸脱判定にだけ使用する。
 * @concurrency N/A: 共有状態を持たない同期計算である。
 */
function isContainedBy(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * 秘密鍵候補を追跡不能なLinkや禁止Rootから除外して同一性を固定する。
 *
 * @responsibility 署名前に安全に参照可能な通常Fileだけを受理する。
 * @trace ARCH-000014
 * @input 秘密鍵候補Path、禁止Rootおよび最大byte数。
 * @returns 検証時点の秘密鍵File Identity。
 * @precondition 呼出し側は秘密鍵内容でなく参照Pathだけを渡す。
 * @postcondition 受理時は通常FileのIdentityを返し、拒否時は値を返さない。
 * @effect Filesystem metadataとreal pathを読取り観測する。
 * @failure 判定不能または条件不一致を同じ拒否結果へ閉じる。
 * @invariant Repository内、Link、空Fileおよび上限超過Fileを受理しない。
 * @boundary Filesystem metadataとreal pathの観測境界。
 * @security Repository内鍵、Link、過大Fileを拒否する。
 * @concurrency 観測後の差替えは後続の再観測で検出し、この処理単独ではLockしない。
 */
function inspectPrivateKeyReference(
  target: string,
  prohibitedRoot: string,
  maximumBytes: number,
): FileIdentity {
  if (
    !path.isAbsolute(target) ||
    target.includes("\0") ||
    !path.isAbsolute(prohibitedRoot) ||
    prohibitedRoot.includes("\0") ||
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1
  ) {
    throw new Error("artifact_signing_private_key_reference_invalid");
  }
  try {
    const resolvedPath = path.resolve(target);
    const metadata = fs.lstatSync(resolvedPath, { bigint: true });
    const realPath = fs.realpathSync.native(resolvedPath);
    const realProhibitedRoot = fs.realpathSync.native(
      path.resolve(prohibitedRoot),
    );
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      realPath !== resolvedPath ||
      metadata.size <= 0n ||
      metadata.size > BigInt(maximumBytes) ||
      isContainedBy(realProhibitedRoot, resolvedPath)
    ) {
      throw new Error("artifact_signing_private_key_reference_invalid");
    }
    return Object.freeze({
      resolvedPath,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeNs: metadata.birthtimeNs,
      size: metadata.size,
      mtimeNs: metadata.mtimeNs,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "artifact_signing_private_key_reference_invalid"
    ) {
      throw error;
    }
    throw new Error("artifact_signing_private_key_reference_invalid");
  }
}

/**
 * 二つの秘密鍵File観測が同じ実体と改訂状態を表すか比較する。
 *
 * @responsibility 事前確認後の差替えを署名前に検出する。
 * @trace ARCH-000014
 * @input 比較する二つのFile Identity。
 * @returns 全Identity fieldが一致する場合はtrue。
 * @precondition 両方が同じFile Identity Schemaで取得されている。
 * @postcondition 入力Identityを変更しない。
 * @effect N/A: 値だけを比較する純粋計算である。
 * @failure N/A: 不一致はfalseとして表す。
 * @invariant すべてのIdentity fieldが一致した場合だけ同一とする。
 * @boundary N/A: Process内の値比較であり外部境界を開かない。
 * @security 部分一致を同一Fileの根拠にしない。
 * @concurrency N/A: Readonly値の同期比較である。
 */
function sameFileIdentity(left: FileIdentity, right: FileIdentity) {
  return (
    left.resolvedPath === right.resolvedPath &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs
  );
}

/**
 * 事前確認した同一Fileから秘密鍵byteを安定して読み取る。
 *
 * @responsibility open前後のIdentityを再確認し、差替えられていない鍵だけを返す。
 * @trace ARCH-000014
 * @input 期待File Identity、禁止Rootおよび最大byte数。
 * @returns 同一性を再確認した秘密鍵byte Buffer。
 * @precondition 期待Identityは同じ禁止Root契約で事前確認済みである。
 * @postcondition 成功時は完全読取りしたBufferを返し、失敗時は取得済みbyteを消去する。
 * @effect File descriptorを一時取得し、秘密鍵Fileを読んで必ずcloseを試行する。
 * @failure read、closeまたはIdentity再確認の失敗を署名Effect前に返す。
 * @invariant open前、descriptor取得後、読取り後のIdentityが同じ場合だけ成功する。
 * @boundary Filesystem descriptorと秘密鍵byteの境界。
 * @security 失敗時に取得済み秘密鍵byteを消去する。
 * @concurrency 差替え競合を複数時点のIdentity比較で検出し、共有Lockは所有しない。
 */
function readStablePrivateKey(
  expected: FileIdentity,
  prohibitedRoot: string,
  maximumBytes: number,
) {
  const current = inspectPrivateKeyReference(
    expected.resolvedPath,
    prohibitedRoot,
    maximumBytes,
  );
  if (!sameFileIdentity(expected, current)) {
    throw new Error("artifact_signing_private_key_changed");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(
    expected.resolvedPath,
    fs.constants.O_RDONLY | noFollow,
  );
  let bytes: Buffer | null = null;
  let failure: unknown = null;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== expected.dev ||
      opened.ino !== expected.ino ||
      opened.birthtimeNs !== expected.birthtimeNs ||
      opened.size !== expected.size ||
      opened.mtimeNs !== expected.mtimeNs
    ) {
      throw new Error("artifact_signing_private_key_changed");
    }
    bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = inspectPrivateKeyReference(
      expected.resolvedPath,
      prohibitedRoot,
      maximumBytes,
    );
    if (
      offset !== bytes.length ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      !sameFileIdentity(expected, pathAfter)
    ) {
      throw new Error("artifact_signing_private_key_changed");
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== null || bytes === null) {
    bytes?.fill(0);
    throw failure ?? new Error("artifact_signing_private_key_read_failed");
  }
  return bytes;
}

/**
 * 開発用Environment Fileから秘密鍵の絶対Pathだけを読み取る。
 *
 * @responsibility 秘密値を読まず、指定Variableの一意で安全な参照だけを抽出する。
 * @trace ARCH-000014
 * @input Environment File Pathと取得するVariable名。
 * @returns 一意に定義された秘密鍵Fileの絶対Path。
 * @precondition Environment FileはGit管理外の通常Fileとして配置される。
 * @postcondition 秘密値を読まず、Path文字列だけを返す。
 * @effect Environment Fileのmetadataとtextを読取り観測する。
 * @failure 不正File、重複Variable、相対Pathまたは制御文字を拒否する。
 * @invariant Variableは一件だけ存在し、値は改行やNULを含まない絶対Pathである。
 * @boundary Environment Fileと署名Applicationの設定境界。
 * @security passphraseや秘密鍵内容を設定Fileから取得しない。
 * @concurrency File更新との同期は所有せず、署名直前の秘密鍵Identity再確認へ委ねる。
 */
export function readPrivateKeyReferenceFromEnvironmentFile(
  environmentFile: string,
  variableName: string,
) {
  let metadata: fs.Stats;
  try {
    metadata = fs.lstatSync(environmentFile);
  } catch {
    throw new Error("artifact_signing_environment_invalid");
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1 ||
    metadata.size > MAXIMUM_ENVIRONMENT_BYTES ||
    !/^[A-Z][A-Z0-9_]{0,127}$/u.test(variableName)
  ) {
    throw new Error("artifact_signing_environment_invalid");
  }
  const matches = fs
    .readFileSync(environmentFile, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(`${variableName}=`));
  if (matches.length !== 1) {
    throw new Error("artifact_signing_environment_invalid");
  }
  let value = matches[0]?.slice(variableName.length + 1) ?? "";
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  if (
    !path.isAbsolute(value) ||
    value.includes("\0") ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    throw new Error("artifact_signing_environment_invalid");
  }
  return value;
}

/**
 * 秘密鍵参照を検証し、一回だけ使用できるAuthorizationを発行する。
 *
 * @responsibility 検証済みFile Identityを署名要求へ結ぶ一回利用境界を確立する。
 * @trace ARCH-000014
 * @input 秘密鍵Path、禁止Rootおよび最大byte数。
 * @returns 一回だけ署名へ使用できるPrivateKeyReferenceAuthorization。
 * @precondition 候補Pathは秘密鍵内容を露出せず指定される。
 * @postcondition 成功時だけ未消費AuthorizationをRegistryへ登録する。
 * @effect Process内Authorization Registryへ未使用Capabilityを登録する。
 * @failure 不正参照ではAuthorizationを発行しない。
 * @invariant Authorizationは検証したexact File Identityにだけ結合する。
 * @boundary Filesystem事前確認とProcess内Capability発行の境界。
 * @security Authorizationに秘密値を含めない。
 * @concurrency 同じAuthorizationの消費状態を一つのRegistryで所有する。
 */
export function preflightPrivateKeyReference(options: {
  privateKeyPath: string;
  prohibitedRoot: string;
  maximumBytes: number;
}) {
  const identity = inspectPrivateKeyReference(
    options.privateKeyPath,
    options.prohibitedRoot,
    options.maximumBytes,
  );
  const authorization = Object.freeze({
    contract:
      "crdd-artifact-signing/private-key-reference-authorization" as const,
    contractRevision: 1 as const,
  });
  authorizations.set(
    authorization,
    Object.freeze({ identity, consumed: false }),
  );
  return authorization;
}

/**
 * 検証済み秘密鍵参照を一回消費してPayloadへEd25519署名を行う。
 *
 * @responsibility 期待公開鍵との一致、署名、一回利用および秘密byte消去を一つの操作で保証する。
 * @trace ARCH-000014
 * @input Authorization、Payload、passphrase、期待公開鍵、禁止Rootおよび鍵Size上限。
 * @returns Algorithm、公開鍵由来Key IDおよびBase64url署名。
 * @precondition 未消費のPrivateKeyReferenceAuthorizationを受け取る。
 * @postcondition 成否にかかわらずAuthorizationを再利用不能にする。
 * @effect Payloadに対する署名Effectだけを発行する。
 * @failure 不正Authorization、passphrase、鍵差替えまたは公開鍵不一致を拒否する。
 * @invariant 検証した秘密鍵が期待公開鍵と一致する場合だけ署名結果を返す。
 * @boundary Filesystem秘密鍵、Node Cryptoおよび署名結果の境界。
 * @security passphraseと秘密鍵byteを終了前に消去する。
 * @concurrency Authorizationの最初の消費だけを許可する。
 */
export function signEd25519Payload(options: {
  authorization: PrivateKeyReferenceAuthorization;
  payload: Uint8Array;
  passphrase: unknown;
  expectedPublicKeySpki: Uint8Array;
  prohibitedRoot: string;
  maximumPrivateKeyBytes: number;
}) {
  const authorized = authorizations.get(options.authorization);
  if (!authorized || authorized.consumed) {
    throw new Error("artifact_signing_private_key_authorization_invalid");
  }
  authorizations.set(
    options.authorization,
    Object.freeze({ identity: authorized.identity, consumed: true }),
  );
  if (
    typeof options.passphrase !== "string" ||
    options.passphrase.length === 0 ||
    Buffer.byteLength(options.passphrase, "utf8") > MAXIMUM_PASSPHRASE_BYTES
  ) {
    throw new Error("artifact_signing_passphrase_invalid");
  }
  const passphrase = Buffer.from(options.passphrase, "utf8");
  let privateKeyBytes: Buffer | null = null;
  try {
    privateKeyBytes = readStablePrivateKey(
      authorized.identity,
      options.prohibitedRoot,
      options.maximumPrivateKeyBytes,
    );
    const privateKey = createPrivateKey({
      key: privateKeyBytes,
      format: "pem",
      passphrase,
    });
    const signerSpki = createPublicKey(privateKey).export({
      type: "spki",
      format: "der",
    });
    const expected = Buffer.from(options.expectedPublicKeySpki);
    if (!signerSpki.equals(expected)) {
      throw new Error("artifact_signing_private_key_not_expected");
    }
    const signature = sign(null, options.payload, privateKey);
    return Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: createHash("sha256").update(signerSpki).digest("hex"),
      signature: signature.toString("base64url"),
    });
  } finally {
    passphrase.fill(0);
    privateKeyBytes?.fill(0);
  }
}
