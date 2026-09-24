/**
 * generate-release-keyに属する責務をまとめる。
 *
 * @responsibility isContainedByを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readHiddenLine } from "../../artifact-signing/src/index.ts";
import { assertSupportedCoordinatorNodeRuntime } from "../src/core/node-runtime-version.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const PRIVATE_KEY_FILE = "crdd-release-v1-private.pem";
const PUBLIC_KEY_FILE = "crdd-release-v1-public.spki.der";
const MINIMUM_PASSPHRASE_CHARACTERS = 20;
const MAXIMUM_PASSPHRASE_BYTES = 1_024;

/**
 * Contained Byかを判定する。
 *
 * @responsibility Contained Byの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input parent: string、candidate: string
 * @returns isContainedByの計算結果を返す。
 * @precondition 「parent: string、candidate: string」がisContainedByの入力契約を満たす。
 * @postcondition isContainedByの責務を完了した結果だけを返す。
 * @effect N/A: isContainedByは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isContainedByは独自の失敗分岐を所有しない。
 * @invariant isContainedByは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isContainedByはProcess内の同一Subsystemで完結する。
 * @security N/A: isContainedByはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isContainedByは共有非同期状態を持たない同期処理である。
 */
function isContainedBy(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * 出力 Directoryの契約を検証する。
 *
 * @responsibility 出力 Directoryの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawOutputDirectory: unknown
 * @returns validateOutputDirectoryの計算結果を返す。
 * @precondition 「rawOutputDirectory: unknown」がvalidateOutputDirectoryの入力契約を満たす。
 * @postcondition validateOutputDirectoryの責務を完了した結果だけを返す。
 * @effect validateOutputDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure validateOutputDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateOutputDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: validateOutputDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateOutputDirectoryは共有非同期状態を持たない同期処理である。
 */
function validateOutputDirectory(rawOutputDirectory: unknown) {
  if (
    typeof rawOutputDirectory !== "string" ||
    !path.isAbsolute(rawOutputDirectory) ||
    rawOutputDirectory.includes("\0")
  ) {
    throw new Error("release_key_output_directory_invalid");
  }
  const outputDirectory = path.resolve(rawOutputDirectory);
  const realRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  const parent = path.dirname(outputDirectory);
  const parentMetadata = fs.lstatSync(parent);
  const realParent = fs.realpathSync.native(parent);
  if (
    !parentMetadata.isDirectory() ||
    parentMetadata.isSymbolicLink() ||
    realParent !== parent ||
    isContainedBy(realRepositoryRoot, outputDirectory) ||
    fs.existsSync(outputDirectory)
  ) {
    throw new Error("release_key_output_directory_invalid");
  }
  return outputDirectory;
}

/**
 * Passphraseの契約を検証する。
 *
 * @responsibility Passphraseの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawPassphrase: unknown
 * @returns validatePassphraseの計算結果を返す。
 * @precondition 「rawPassphrase: unknown」がvalidatePassphraseの入力契約を満たす。
 * @postcondition validatePassphraseの責務を完了した結果だけを返す。
 * @effect N/A: validatePassphraseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validatePassphraseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validatePassphraseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatePassphraseはProcess内の同一Subsystemで完結する。
 * @security N/A: validatePassphraseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validatePassphraseは共有非同期状態を持たない同期処理である。
 */
function validatePassphrase(rawPassphrase: unknown) {
  if (
    typeof rawPassphrase !== "string" ||
    [...rawPassphrase].length < MINIMUM_PASSPHRASE_CHARACTERS ||
    Buffer.byteLength(rawPassphrase, "utf8") > MAXIMUM_PASSPHRASE_BYTES
  ) {
    throw new Error("release_key_passphrase_invalid");
  }
  return Buffer.from(rawPassphrase, "utf8");
}

/**
 * Release Key Pairを生成する。
 *
 * @responsibility Release Key Pairの生成入力、決定規則、生成物のIdentity境界を所有する。
 * @trace ARCH-000004
 * @input rawOutputDirectory: unknown、rawPassphrase: unknown
 * @returns generateReleaseKeyPairの計算結果を返す。
 * @precondition 「rawOutputDirectory: unknown、rawPassphrase: unknown」がgenerateReleaseKeyPairの入力契約を満たす。
 * @postcondition generateReleaseKeyPairの責務を完了した結果だけを返す。
 * @effect generateReleaseKeyPairはFilesystemの読取りまたは書込みを実行する。
 * @failure generateReleaseKeyPairは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant generateReleaseKeyPairは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: generateReleaseKeyPairはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: generateReleaseKeyPairは共有非同期状態を持たない同期処理である。
 */
export function generateReleaseKeyPair(
  rawOutputDirectory: unknown,
  rawPassphrase: unknown,
) {
  const outputDirectory = validateOutputDirectory(rawOutputDirectory);
  const passphrase = validatePassphrase(rawPassphrase);
  let isDirectoryCreated = false;
  try {
    const keyPair = generateKeyPairSync("ed25519");
    const privateKey = keyPair.privateKey.export({
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase,
    });
    const publicKey = keyPair.publicKey.export({ type: "spki", format: "der" });
    fs.mkdirSync(outputDirectory, { mode: 0o700 });
    isDirectoryCreated = true;
    fs.writeFileSync(path.join(outputDirectory, PRIVATE_KEY_FILE), privateKey, {
      flag: "wx",
      mode: 0o600,
    });
    fs.writeFileSync(path.join(outputDirectory, PUBLIC_KEY_FILE), publicKey, {
      flag: "wx",
      mode: 0o644,
    });
    return Object.freeze({
      status: "created" as const,
      publicKeyFile: PUBLIC_KEY_FILE,
      publicKeySpkiSha256: createHash("sha256").update(publicKey).digest("hex"),
      privateKeyStoredOutsideRepository: true,
    });
  } catch (error) {
    if (isDirectoryCreated) {
      for (const fileName of [PUBLIC_KEY_FILE, PRIVATE_KEY_FILE]) {
        const target = path.join(outputDirectory, fileName);
        if (fs.existsSync(target)) fs.unlinkSync(target);
      }
      fs.rmdirSync(outputDirectory);
    }
    throw error;
  } finally {
    passphrase.fill(0);
  }
}

/**
 * generate-release-keyのCommand処理を開始する。
 *
 * @responsibility generate-release-keyの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  assertSupportedCoordinatorNodeRuntime(process.versions.node);
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") {
    throw new Error(
      'usage: & "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\\40_Develop\\coordinator\\scripts\\generate-release-key.ts" --output "<absolute-new-directory>"',
    );
  }
  const first = await readHiddenLine("Release key passphrase: ");
  const second = await readHiddenLine("Confirm passphrase: ");
  if (first !== second) throw new Error("release_key_passphrase_mismatch");
  const result = generateReleaseKeyPair(args[1], first);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "release_key_generation_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
