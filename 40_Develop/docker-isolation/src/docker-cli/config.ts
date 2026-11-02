/**
 * 借用された作業領域内の短命Docker CLI設定を所有する。
 *
 * @responsibility 使用Directoryの実体観測と空configの作成・照合・終了後回収を担当する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";

/**
 * 使用Directoryの元実体を識別する。
 *
 * @responsibility Linkや観測不能を同一実体へ補完しない。
 * @trace ARCH-000008
 * @input directory: 利用許可を確認したcanonicalなDirectory所在。
 * @returns 実体metadataの相関。
 * @precondition 所在の利用許可は上位が確認する。
 * @postcondition 実体を作成・変更しない。
 * @effect Filesystem metadataを読む。
 * @failure 非Directory・Link・不明Identityは例外。
 * @invariant 名前だけで同一性を認定しない。
 * @boundary 借用所在と現在Filesystem。
 * @security 認証値を読取らない。
 * @concurrency 各使用前に再観測する。
 */
export function observeDockerDirectoryIdentity(directory: string): string {
  if (fs.realpathSync(directory) !== directory)
    throw new Error("docker_effect_filesystem_identity_invalid");
  const metadata = fs.lstatSync(directory, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("docker_effect_filesystem_identity_invalid");
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

/**
 * 保護read-only .gitだけに許すFile／Directoryの元実体を捕捉する。
 * @responsibility 通常MountのDirectory条件を広げず、元型とFileの後発変更を再確認する。
 * @trace ARCH-000008
 * @input source: 確定した保護Mount元。
 * @returns 元型・metadataの相関。Link・観測不能は例外。
 * @effect Filesystem metadataの読取りだけ。
 * @invariant 任意Fileを他のMount用途へ許可しない。
 */
export function observeDockerProtectedMountIdentity(source: string): string {
  if (fs.realpathSync(source) !== source)
    throw Error("docker_effect_filesystem_identity_invalid");
  const metadata = fs.lstatSync(source, { bigint: true });
  if (
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw Error("docker_effect_filesystem_identity_invalid");
  if (metadata.isDirectory())
    return `directory:${observeDockerDirectoryIdentity(source)}`;
  if (!metadata.isFile())
    throw Error("docker_effect_filesystem_identity_invalid");
  return `file:${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}:${metadata.mtimeNs}:${metadata.size}`;
}

/**
 * 借用管理領域に固定名の短命configを作る。
 *
 * @responsibility Parentや既存領域を作り替えず空configだけを所有する。
 * @trace ARCH-000008
 * @input managementPath: 上位が検査した借用管理領域。
 * @returns 作成したconfig所在と実体相関。
 * @precondition 管理領域の用途・Root・Ownerを上位が検査する。
 * @postcondition 固定子Directory以外を書込まない。
 * @effect 空Directoryを一つ作成する。
 * @failure 既存・Link・canonical差・作成不能は例外。
 * @invariant 親Directoryや共有Stateを追加しない。
 * @boundary 借用Rootと短命Docker config。
 * @security 認証configを複製しない。
 * @concurrency recursive作成を使わず既存名を拒否する。
 */
export function createDockerCliConfig(managementPath: string) {
  const directory = path.join(managementPath, "docker-cli-config");
  fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
  const realDirectory = fs.realpathSync(directory);
  if (realDirectory !== directory)
    throw new Error("docker_effect_config_replaced");
  return Object.freeze({
    directory: realDirectory,
    identity: observeDockerDirectoryIdentity(realDirectory),
  });
}

/**
 * 使用直前のconfig実体を照合する。
 *
 * @responsibility 差替え・Linkを実行前に拒否する。
 * @trace ARCH-000008
 * @input directory、identity: 元configの所在と相関。
 * @returns N/A: 一致時は制御を返す。
 * @precondition 元の借用Ownerを上位が検査する。
 * @postcondition configを変更しない。
 * @effect Filesystem metadataとcanonical所在を読む。
 * @failure 差替え・観測不能は例外。
 * @invariant 別実体へfallbackしない。
 * @boundary 元configと現在Filesystem。
 * @security Linkを辿って別configを使用しない。
 * @concurrency Process開始直前に使用する。
 */
export function verifyDockerCliConfig(directory: string, identity: string) {
  if (
    fs.realpathSync(directory) !== directory ||
    observeDockerDirectoryIdentity(directory) !== identity
  )
    throw new Error("docker_effect_config_replaced");
}
