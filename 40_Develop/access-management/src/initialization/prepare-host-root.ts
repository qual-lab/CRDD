/**
 * CROSのHost保存先を準備し、旧入力の存在を読取り観測する。
 * @responsibility 固定用途のstate Rootと作成済みEffectを保持し、初期化許可を生成しない。
 * @trace ARCH-000013
 */
import fs from "node:fs";
import path from "node:path";
import {
  createFilesystemStoreRoot,
  resolveCrosRuntimeRoots,
  resolveFilesystemStorePath,
  type CrosRootInput,
  type FilesystemStoreRoot,
} from "../../../domain-model/src/index.ts";

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
