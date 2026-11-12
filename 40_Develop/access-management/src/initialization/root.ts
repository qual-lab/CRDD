/**
 * Host管理Rootの通常検証と明示初回準備を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import fs from "node:fs";
import path from "node:path";
const STORE_ROOT_BRAND: unique symbol = Symbol("filesystem-store-root");
const issuedStoreRoots = new WeakSet<object>();

export type FilesystemStoreRoot = Readonly<{
  [STORE_ROOT_BRAND]: true;
  root: string;
}>;

/**
 * 既存の通常DirectoryをFilesystem Store Rootとして検証する。
 *
 * @responsibility Root自身と既存親chainがLinkでなく、実Pathと一致することを確認する。
 * @trace ARCH-000009
 * @input root: Store専用として呼出し側が許可した絶対Directory。
 * @returns 検証済みCapability。条件不成立時はnull。
 * @precondition rootは呼出し側が所有する用途限定Root候補である。
 * @postcondition 成功時は不変の絶対RootだけをCapabilityへ保持する。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 相対Path、不在、非Directory、Linkまたは実Path不一致をnullで拒否する。
 * @invariant Capabilityは本関数以外から構築できない。
 * @boundary Caller Authority→Filesystem Root Capability。
 * @security Link経由で別RootへAuthorityを拡張しない。
 * @concurrency 検証後の置換は防げないため、利用時にも既存chainを再検証する。
 */
export function createFilesystemStoreRoot(
  root: string,
): FilesystemStoreRoot | null {
  if (!path.isAbsolute(root)) return null;
  const resolved = path.resolve(root);
  try {
    const metadata = fs.lstatSync(resolved);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    if (fs.realpathSync.native(resolved) !== resolved) return null;
    const capability = Object.freeze({
      [STORE_ROOT_BRAND]: true as const,
      root: resolved,
    });
    issuedStoreRoots.add(capability);
    return capability;
  } catch {
    return null;
  }
}

/**
 * 既存Path chainがRootへ直接到達することを確認する。
 *
 * @responsibility TargetからRootまでの既存要素でLinkまたは実Path差替えを拒否する。
 * @trace ARCH-000009
 * @input 検証済みRoot Pathと確認対象Target Path。
 * @returns N/A: 条件成立時に復帰する。
 * @precondition TargetはRoot配下へ字句正規化済みである。
 * @postcondition 既存chainの全要素がRootへ直接接続することを確認済みとなる。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure Link、Root外またはRootへ到達しないchainを例外で拒否する。
 * @invariant 不在suffixは最初の既存親から評価する。
 * @boundary 正規化PathとFilesystem実体の境界。
 * @security Link経由のRoot逸脱を許可しない。
 * @concurrency 観測後の置換は利用側Effect直前の再解決で再確認する。
 */
function assertExistingChainIsDirect(root: string, target: string): void {
  let cursor = target;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error("filesystem_store_path_invalid");
    cursor = parent;
  }
  while (true) {
    const metadata = fs.lstatSync(cursor);
    if (metadata.isSymbolicLink())
      throw new Error("filesystem_store_path_link_forbidden");
    if (fs.realpathSync.native(cursor) !== path.resolve(cursor))
      throw new Error("filesystem_store_path_link_forbidden");
    if (cursor === root) return;
    const parent = path.dirname(cursor);
    if (parent === cursor)
      throw new Error("filesystem_store_path_outside_root");
    cursor = parent;
  }
}

/**
 * Capability内の相対Pathを安全な絶対Pathへ解決する。
 *
 * @responsibility 書込み先をCapability Root配下へ閉じ、既存Link chainを拒否する。
 * @trace ARCH-000009
 * @input capability: 検証済みRoot、relativePath: Root相対Path。
 * @returns Root配下の正規化済み絶対Path。
 * @precondition relativePathは用途側が定義したFile名または下位Pathである。
 * @postcondition 戻り値はRoot自身ではなくRoot配下にある。
 * @effect Filesystem metadataとrealpathを読取るだけである。
 * @failure 空、絶対Path、親移動、Root外またはLink chainを例外で拒否する。
 * @invariant 文字列prefixでなくpath.relativeで包含を判定する。
 * @boundary Filesystem Store Capability→具体File Path。
 * @security Capabilityが許可しないRootへPathを拡張しない。
 * @concurrency 利用側はEffect直前に本関数を呼び、同じPathを使用する。
 */
export function resolveFilesystemStorePath(
  capability: FilesystemStoreRoot,
  relativePath: string,
): string {
  if (
    typeof capability !== "object" ||
    capability === null ||
    !issuedStoreRoots.has(capability)
  )
    throw new Error("filesystem_store_root_capability_invalid");
  if (!relativePath || path.isAbsolute(relativePath))
    throw new Error("filesystem_store_relative_path_required");
  const target = path.resolve(capability.root, relativePath);
  const relative = path.relative(capability.root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("filesystem_store_path_outside_root");
  assertExistingChainIsDirect(capability.root, target);
  return target;
}

export type CrosRootInput = Readonly<{
  platform: "win32" | "linux";
  trustDomainId: string;
  publisher: string;
  application: "cros";
  localAppData?: string;
  xdgConfigHome?: string;
  xdgStateHome?: string;
  xdgRuntimeDirectory?: string;
  homeDirectory?: string;
}>;
const CROS_DIRECTORY_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;

/**
 * Host環境から既存CROS配置契約の入力だけを選ぶ。
 * @responsibility Publisher・Applicationを固定し、任意Path引数や秘密環境値を読まない。
 * @trace ARCH-000013
 * @input Process Environmentと実OS。
 * @returns 固定用途Root入力、または不足・未対応のnull。
 * @precondition ログイン済みHostの環境であり、Remote要求ではない。
 * @postcondition CROS_TRUST_DOMAIN_IDとOS標準領域だけを搬送する。
 * @effect N/A: 環境の選択だけ。
 * @failure 環境不足・未対応OSはnull。
 * @invariant Secret環境値・Repository Rootを保存先へ使わない。
 * @boundary Host CLIと既存Root Resolver。
 * @security 認証・User・Roleを環境から生成しない。
 * @concurrency 開始時の入力Snapshotだけを使用する。
 */
export function resolveHostRootInput(
  environment: NodeJS.ProcessEnv,
): CrosRootInput | null {
  const trustDomainId = environment.CROS_TRUST_DOMAIN_ID;
  if (!trustDomainId) return null;
  if (process.platform === "win32") {
    if (!environment.LOCALAPPDATA) return null;
    return {
      platform: "win32",
      trustDomainId,
      publisher: "qual-lab",
      application: "cros",
      localAppData: environment.LOCALAPPDATA,
    };
  }
  if (process.platform !== "linux" || !environment.HOME) return null;
  return {
    platform: "linux",
    trustDomainId,
    publisher: "qual-lab",
    application: "cros",
    homeDirectory: environment.HOME,
    ...(environment.XDG_CONFIG_HOME
      ? { xdgConfigHome: environment.XDG_CONFIG_HOME }
      : {}),
    ...(environment.XDG_STATE_HOME
      ? { xdgStateHome: environment.XDG_STATE_HOME }
      : {}),
    ...(environment.XDG_RUNTIME_DIR
      ? { xdgRuntimeDirectory: environment.XDG_RUNTIME_DIR }
      : {}),
  };
}

/**
 * AMの既存Host配置を値として解決する。
 * @responsibility 設定Fileを読まず、Host入力から同じstate/config/tmp配置を構成する。
 * @trace ARCH-000013
 * @input Hostから選別したCROS配置入力。
 * @returns 固定配置又はnull。
 * @effect N/A: Pathの値計算だけ。
 * @security Pathの実体確認と作成はAMの初期化Ownerが行う。
 */
export function resolveCrosRuntimeRoots(input: CrosRootInput) {
  if (
    !CROS_DIRECTORY_ID.test(input.trustDomainId) ||
    !CROS_DIRECTORY_ID.test(input.publisher) ||
    input.application !== "cros"
  )
    return null;
  const pathSegments = [
    input.publisher,
    input.application,
    input.trustDomainId,
  ];
  if (input.platform === "win32") {
    if (!input.localAppData || !path.win32.isAbsolute(input.localAppData))
      return null;
    const root = path.win32.join(input.localAppData, ...pathSegments);
    return Object.freeze({
      platform: "win32",
      config: root,
      state: root,
      temporary: path.win32.join(root, "tmp"),
    });
  }
  if (!input.homeDirectory || !path.posix.isAbsolute(input.homeDirectory))
    return null;
  const configBase =
    input.xdgConfigHome ?? path.posix.join(input.homeDirectory, ".config");
  const stateBase =
    input.xdgStateHome ??
    path.posix.join(input.homeDirectory, ".local", "state");
  if (!path.posix.isAbsolute(configBase) || !path.posix.isAbsolute(stateBase))
    return null;
  const config = path.posix.join(configBase, ...pathSegments);
  const state = path.posix.join(stateBase, ...pathSegments);
  const temporary = input.xdgRuntimeDirectory
    ? path.posix.join(input.xdgRuntimeDirectory, ...pathSegments)
    : null;
  if (
    input.xdgRuntimeDirectory &&
    !path.posix.isAbsolute(input.xdgRuntimeDirectory)
  )
    return null;
  return Object.freeze({
    platform: "linux",
    config,
    state,
    temporary,
  });
}

/**
 * 旧管理入力と回復領域の非秘密観測を表す。
 * @responsibility 確認済み不存在・既知存在・観測不能を区別する。
 * @trace ARCH-000013
 * @shape management、attemptと固定reason。
 * @invariant 旧入力内容をparseせず、回復領域存在を有効な試行へ昇格しない。
 * @boundary Host内部の旧入力観測。MCP公開値ではない。
 * @security Secret・Path・旧Credential一覧を含めない。
 * @compatibility 旧形式移行はフロントAI、最新Sourceは存在だけ観測する。
 */
export type HostPreviousInputObservation = Readonly<{
  management: "uninitialized" | "existing" | "unknown";
  attempt: "absent" | "unknown";
  reason:
    | "legacy_inputs_absent"
    | "legacy_management_present"
    | "legacy_recovery_present"
    | "legacy_inputs_present"
    | "host_previous_inputs_unknown";
}>;

/**
 * Host Root準備の既知Effectと既存保存Capabilityを表す。
 * @responsibility 途中作成を未実行へ戻さず、readyを初期化許可と区別する。
 * @trace ARCH-000013
 * @shape status、exact作成Directory集合。readyだけ既存Rootと同期旧入力Observer。
 * @invariant 作成集合は当該mkdir成功分だけで、自動削除のAuthorityではない。
 * @boundary 信頼済みHost内部Owner。絶対Path集合をRemote／CLI公開結果へ透過しない。
 * @security Credential・Verifierを読まない。
 * @compatibility 既存CROS配置契約のstate Rootだけ。Repositoryへ秘密を移さない。
 */
export type HostRootPreparationResult = Readonly<{
  createdDirectories: readonly string[];
}> &
  (
    | Readonly<{
        status: "ready";
        root: FilesystemStoreRoot;
        observePrevious(): HostPreviousInputObservation;
      }>
    | Readonly<{ status: "blocked"; reason: "host_state_root_unavailable" }>
  );

/**
 * 既存Directoryと親chainの直接到達を検証する。
 * @responsibility link・file・観測不能をRoot準備の不存在へ変換しない。
 * @trace ARCH-000013
 * @input 用途Resolverが返した絶対Directory候補。
 * @returns 対象Directoryの実体metadata。
 * @precondition 信頼済みHost入力から解決した候補だけ。
 * @postcondition 対象と既存全親が通常Directoryでrealpathと一致する。
 * @effect lstat／realpathの読取り。
 * @failure 不在・link・非Directory・実Path差をthrowで保持する。
 * @invariant ENOENT以外を不存在にしない。
 * @boundary Path文字列とFilesystem実体。
 * @security Root外へPathを拡張しない。
 * @concurrency 観測後の恒久保証ではなく、各mkdirと利用前に再確認する。
 */
function verifyHostDirectory(directory: string): fs.BigIntStats {
  let cursor = directory;
  const observed = fs.lstatSync(directory, { bigint: true });
  while (true) {
    const entry = fs.lstatSync(cursor, { bigint: true });
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      fs.realpathSync.native(cursor) !== cursor
    )
      throw new Error("host_directory_invalid");
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return observed;
}

/**
 * 作成済みHost保存先を変更せず検証する。
 * @responsibility 通常起動に既存Rootだけを渡し、初期化処理のmkdirと分離する。
 * @trace ARCH-000013
 * @input Host環境から選択した固定用途のRoot構成。
 * @returns 実体検証済みの既存Root、またはnull。
 * @precondition 現在OSと一致する既存配置契約の入力。
 * @postcondition 対象と親chainが通常Directoryで、Capability作成前後のIdentityが一致する。
 * @effect lstat／realpathによる読取りだけ。作成・更新・削除0。
 * @failure 不在・Link・不正構成・観測不能はnull。
 * @invariant Root確認を管理状態の初期化完了や認可へ昇格しない。
 * @boundary Host構成からFilesystem保存Capabilityへの接続。
 * @security 任意Path・Repository保存先・Credentialを入力にしない。
 * @concurrency 検証後も保存Ownerが各操作で現在状態を確認する。
 */
export function readExistingHostRoot(
  input: CrosRootInput,
): FilesystemStoreRoot | null {
  try {
    if (input.platform !== process.platform) return null;
    const roots = resolveCrosRuntimeRoots(input);
    if (!roots) return null;
    const identity = verifyHostDirectory(roots.state);
    const root = createFilesystemStoreRoot(roots.state);
    if (!root) return null;
    const checked = verifyHostDirectory(roots.state);
    if (checked.dev !== identity.dev || checked.ino !== identity.ino)
      return null;
    return root;
  } catch {
    return null;
  }
}

/**
 * 既存配置契約のHost state Rootだけを不足chainから準備する。
 * @responsibility 検証済みRoot、部分作成、旧入力の存在観測を結ぶ。
 * @trace ARCH-000013
 * @input ログイン済みHostから取得したCROS Root構成。
 * @returns 内部Root Capabilityと読取りObserver、または作成済み集合を保持した停止。
 * @precondition 宣言OS baseの用途限定管理領域。default Linux HOMEは既存必須。任意絶対Pathの一般作成APIではない。
 * @postcondition 各mkdir後とCapability作成前に実体を再検証する。
 * @effect stateまでの不足Directoryだけ非再帰mkdir。ACL変更・旧入力本文読取り・削除0。
 * @failure 不正構成・異OS・不正親・作成／検証故障はblocked。
 * @invariant 失敗時に既知mkdirをEffect0やrollbackへ戻さない。
 * @boundary Host構成→既存Domain Root Resolver→Filesystem。
 * @security Secretを保存／読取りせず、初期化・認可Authorityを発行しない。
 * @concurrency EEXISTは再検証し、旧Writer停止はフロントAI切替前提として別に保持する。
 */
export function prepareHostInitializationRoot(
  input: CrosRootInput,
): HostRootPreparationResult {
  const created: string[] = [];
  try {
    if (input.platform !== process.platform)
      throw new Error("host_platform_invalid");
    const roots = resolveCrosRuntimeRoots(input);
    const base =
      input.platform === "win32"
        ? input.localAppData
        : (input.xdgStateHome ?? input.homeDirectory);
    if (!roots || !base || !path.isAbsolute(base))
      throw new Error("host_root_invalid");
    const normalizedBase = path.resolve(base);
    if (input.platform === "linux" && !input.xdgStateHome)
      verifyHostDirectory(normalizedBase);
    let ancestor = normalizedBase;
    for (;;) {
      try {
        fs.lstatSync(ancestor);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw error;
        ancestor = parent;
      }
    }
    verifyHostDirectory(ancestor);
    if (path.parse(ancestor).root !== path.parse(roots.state).root)
      throw new Error("host_root_volume_mismatch");
    const relative = path.relative(ancestor, roots.state);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("host_root_outside_base");
    let current = ancestor;
    for (const segment of relative.split(path.sep)) {
      verifyHostDirectory(current);
      current = path.join(current, segment);
      try {
        fs.lstatSync(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        try {
          fs.mkdirSync(current);
          created.push(current);
        } catch (mkdirError) {
          if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST")
            throw mkdirError;
        }
      }
      verifyHostDirectory(current);
    }
    const identity = verifyHostDirectory(roots.state);
    const root = createFilesystemStoreRoot(roots.state);
    if (!root) throw new Error("host_root_unverified");
    const checked = verifyHostDirectory(roots.state);
    if (checked.dev !== identity.dev || checked.ino !== identity.ino)
      throw new Error("host_root_changed");
    return {
      status: "ready",
      root,
      createdDirectories: Object.freeze([...created]),
      observePrevious: () => {
        const unknown: HostPreviousInputObservation = {
          management: "unknown",
          attempt: "unknown",
          reason: "host_previous_inputs_unknown",
        };
        try {
          resolveFilesystemStorePath(root, "access-management.json");
          const before = verifyHostDirectory(roots.state);
          if (before.dev !== identity.dev || before.ino !== identity.ino)
            return unknown;
          const exists: boolean[] = [];
          for (const name of [
            "credential-registry",
            "credential-access-recovery",
          ]) {
            try {
              fs.lstatSync(path.join(roots.state, name));
              exists.push(true);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                return unknown;
              exists.push(false);
            }
          }
          const after = verifyHostDirectory(roots.state);
          if (after.dev !== identity.dev || after.ino !== identity.ino)
            return unknown;
          const management = exists[0] === true;
          const recovery = exists[1] === true;
          return {
            management: management ? "existing" : "uninitialized",
            attempt: recovery ? "unknown" : "absent",
            reason:
              management && recovery
                ? "legacy_inputs_present"
                : management
                  ? "legacy_management_present"
                  : recovery
                    ? "legacy_recovery_present"
                    : "legacy_inputs_absent",
          };
        } catch {
          return unknown;
        }
      },
    };
  } catch {
    return {
      status: "blocked",
      reason: "host_state_root_unavailable",
      createdDirectories: Object.freeze([...created]),
    };
  }
}
