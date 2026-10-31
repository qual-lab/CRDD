/**
 * 検査済み再入場の固定Docker観測・回収を実行する。
 *
 * @responsibility config実体、CLI再照合、最小環境と閉じた資源操作を結合する。
 * @trace ARCH-000008
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "../docker-cli/trust.ts";
import { createDockerCliEnvironment } from "../docker-cli/environment.ts";
import { captureDockerProcessEnvironment } from "../process/environment.ts";
import type { DockerResourceExpectation } from "./plan.ts";
import {
  discoverSubmittedDockerResource,
  observeSubmittedDockerResourceAbsent,
  recoverObservedDockerResource,
  type DockerRecoveryCommandResult,
} from "./resource.ts";

const DOCKER_CLI_EXECUTABLE =
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";

let recoveryDockerCliSnapshot: ReturnType<
  typeof observeTrustedDockerCli
> | null = null;

/**
 * 回復要求のCLIを初回観測し、後続は同じ実体を再確認する。
 * @responsibility module共有の既存snapshot寿命と固定拒否理由を維持する。
 * @trace ARCH-000008
 * @input N/A: 要求時に固定CLIを観測する。
 * @returns N/A: 正常時だけ呼出し元へ戻る。
 * @precondition 下位Executorが現在Ownerを確認している。
 * @postcondition verify失敗から再observeへfallbackしない。
 * @effect CLI実体を読取り、初回成功時だけsnapshotを保持する。
 * @failure 観測・再確認失敗はdocker_task_recovery_cli_untrusted。
 * @invariant closeや別Executor生成でsnapshotを破棄しない。
 * @boundary 固定Docker CLIの出所と要求直前確認。
 * @security 任意実行物や上位入力のCLI検証を採用しない。
 * @concurrency 同期確認でmodule内の同じsnapshotを共有する。
 */
function verifyRecoveryDockerCli() {
  try {
    if (recoveryDockerCliSnapshot === null) {
      recoveryDockerCliSnapshot = observeTrustedDockerCli();
    } else {
      verifyTrustedDockerCliSnapshot(recoveryDockerCliSnapshot);
    }
  } catch {
    throw new Error("docker_task_recovery_cli_untrusted");
  }
}

/**
 * Task回復の借用所在と現在Ownerへ固定CLI・最小環境を結合する。
 * @responsibility 上位にOS構成を要求せず、既存低位Executorをそのまま返す。
 * @trace ARCH-000008
 * @input input: managementDirectoryと同期assertOwnerの二項目。
 * @returns 既存低位factoryの元結果と元executor／close。
 * @precondition 上位が所在のRoot・用途と回復Ownerを確認している。
 * @postcondition CLI／環境は構築時でなく各要求時だけ取得する。
 * @effect 構築時に借用領域内の短命configを作る。要求時のEffectは既存Executorが所有する。
 * @failure 環境不明はdocker_recovery_environment_unavailable。CLI不明は別理由で保持する。
 * @invariant 入力全体をspreadせず、余剰CLI／環境設定を採用しない。
 * @boundary Coordinatorの現在OwnerとDocker技術構成。
 * @security 認証config、任意実行物、上位Stateを受け取らない。
 * @concurrency Owner確認・config回収・close一回性は既存低位factoryを変更しない。
 */
export function createDockerTaskRecoveryExecutor(
  input: Pick<
    DockerOperationRecoveryInput,
    "managementDirectory" | "assertOwner"
  >,
) {
  return createDockerOperationRecoveryExecutor({
    managementDirectory: input.managementDirectory,
    assertOwner: input.assertOwner,
    verifyCli: verifyRecoveryDockerCli,
    environment: () => {
      const environment = createDockerCliEnvironment({
        dockerConfig: null,
        dockerHome: null,
      });
      if (!environment)
        throw new Error("docker_recovery_environment_unavailable");
      return environment;
    },
  });
}

/**
 * 再入場用の検査済みconfigとHost観測を保持する。
 *
 * @responsibility 上位のLease・回復記録を持たず、技術実行直前の観測だけを受ける。
 * @trace ARCH-000008
 * @shape config所在・実体Identity、CLI照合と最小環境の既存Owner callback。
 * @invariant 任意Docker argv、Lock操作、上位Stateを公開入力へ含めない。
 * @boundary 上位の用途限定再入場projectionから技術実行への境界。
 * @security callbackは既存Ownerに固定し、環境fallbackを行わない。
 * @compatibility config作成・回復Classの採用は上位Ownerへ維持する。
 */
export type DockerRecoveryExecutionBinding = Readonly<{
  configDirectory: string;
  configIdentity: string;
  verifyCli: () => void;
  environment: () => Readonly<Record<string, string>>;
}>;

/**
 * 空の実行専用configの現在実体を観測する。
 *
 * @responsibility link・差替え・非空Directoryを拒否して実体相関を返す。
 * @trace ARCH-000008
 * @input configDirectory: 上位が借用・検査したconfig所在。
 * @returns dev・ino・birthtimeNsの実体相関。
 * @precondition 所在のRoot・Lease・用途を上位が検査している。
 * @postcondition Root作成や任意所在への変更は行わない。
 * @effect configのmetadata、realpath、entriesを読むだけ。
 * @failure 不明・link・非Directory・非空・canonical差は例外で停止する。
 * @invariant この値だけで実行許可を発行しない。
 * @boundary 借用configの実体と固定Docker CLIの構成。
 * @security 認証情報を読取らず、空config以外を使用しない。
 * @concurrency 各実行直前に同じIdentityを再観測する。
 */
export function observeDockerRecoveryConfigIdentity(configDirectory: string) {
  const metadata = fs.lstatSync(configDirectory, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync(configDirectory) !== configDirectory ||
    fs.readdirSync(configDirectory).length !== 0
  )
    throw new Error("docker_task_recovery_config_untrusted");
  return [metadata.dev, metadata.ino, metadata.birthtimeNs].join(":");
}

/**
 * 再入場の技術操作だけを持つ固定実行接続を構築する。
 *
 * @responsibility raw argvを公開せず、現在観測・実ID回収・予定資源発見へ限定する。
 * @trace ARCH-000008
 * @input binding: 既存Ownerが検査したconfigとfresh Host観測。
 * @returns 実ID回収、予定資源発見、予定資源不存在の三操作。
 * @precondition 同じ回復IdentityとLeaseの採用を上位が行っている。
 * @postcondition 上位のStateや回復Classを所有・変更しない。
 * @effect N/A: 構築だけでは外部処置を発行しない。
 * @failure 操作中のCLI／config／環境不明は新Effect前に停止する。
 * @invariant 永続State・履歴・追加Lock・新しいRecoveryを作らない。
 * @boundary 検査済み再入場から固定Docker技術処置。
 * @security 公開操作から任意Dockerコマンドを実行できない。
 * @concurrency 各要求の直前に同じconfigとCLIを再照合する。
 */
export function createDockerResourceRecoveryExecutor(
  binding: DockerRecoveryExecutionBinding,
) {
  return createRecoveryExecutor(binding, () => undefined);
}

/**
 * 固定Executorへ最終処置前確認を結合する。
 * @responsibility config照合後・spawn前の最終確認を同じ同期境界へ置く。
 * @trace ARCH-000008
 * @input binding: 固定技術投影。beforeSpawn: 内部の最終確認。
 * @returns 固定三操作。
 * @precondition callbackはPackage内部の組立てだけが設定する。
 * @postcondition 最終確認の失敗ではProcessを開始しない。
 * @effect 構築のみ。各操作は固定Docker要求を発行する。
 * @failure 境界不明は例外で停止。
 * @invariant 任意argvと状態Ownerを公開しない。
 * @boundary 借用実行構成と固定Process。
 * @security callbackから新Authorityを生成しない。
 * @concurrency 最終確認とspawnを同じ同期呼出しで処置する。
 */
function createRecoveryExecutor(
  binding: DockerRecoveryExecutionBinding,
  beforeSpawn: () => void,
): DockerResourceRecoveryOperations {
  /**
   * Package内部で組み立てた固定観測・回収要求を発行する。
   *
   * @responsibility CLI・config・最小環境をfresh照合して固定Engineへ接続する。
   * @trace ARCH-000008
   * @input argv: このPackageの資源操作だけが構築する固定引数。
   * @returns status、signal、出力とerrorを区別した元結果。
   * @precondition bindingの元Ownerと用途が上位で検査済みである。
   * @postcondition 例外・Signal・出力失敗を成功に変換しない。
   * @effect 固定Docker CLIをshellなしで有界実行する。
   * @failure CLI・config不明は例外。実行失敗は元errorを保持する。
   * @invariant raw実行操作を公開APIへ返さない。
   * @boundary 固定Docker観測・回収とHost Processの境界。
   * @security 親ambient環境、任意実行物、認証configを使わない。
   * @concurrency 同期実行の結果を返す。実資源終端は別の現在観測で確認する。
   */
  function run(argv: readonly string[]): DockerRecoveryCommandResult {
    const environment = captureDockerProcessEnvironment(binding.environment());
    binding.verifyCli();
    if (
      observeDockerRecoveryConfigIdentity(binding.configDirectory) !==
      binding.configIdentity
    )
      throw new Error("docker_task_recovery_config_untrusted");
    beforeSpawn();
    const result = spawnSync(
      DOCKER_CLI_EXECUTABLE,
      ["--host", DOCKER_ENGINE, "--config", binding.configDirectory, ...argv],
      {
        windowsHide: true,
        shell: false,
        env: environment,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 1_048_576,
      },
    );
    return Object.freeze({
      status: result.status,
      signal: result.signal,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
      error: result.error ?? null,
    });
  }

  return Object.freeze({
    recoverObserved: (
      expectation: DockerResourceExpectation,
      options: Readonly<{
        allowAlreadyAbsent?: boolean;
        removeAfterVerification?: boolean;
        assertBeforeRemoval?: () => boolean;
      }> = Object.freeze({}),
    ) => recoverObservedDockerResource(run, expectation, options),
    discoverSubmitted: (
      expectation: Omit<DockerResourceExpectation, "dockerId">,
    ) => discoverSubmittedDockerResource(run, expectation),
    observeAbsent: (
      kind: "container" | "network",
      expectedName: string,
      ownershipLabel: string,
    ) =>
      observeSubmittedDockerResourceAbsent(
        run,
        kind,
        expectedName,
        ownershipLabel,
      ),
  });
}

/**
 * 固定三操作の同期回収契約。
 * @responsibility 技術期待値とfreshな観測結果だけを搬送する。
 * @trace ARCH-000008
 * @invariant 保存・Task状態・新しい削除Authorityを所有しない。
 */
export type DockerResourceRecoveryOperations = Readonly<{
  recoverObserved: (
    expectation: DockerResourceExpectation,
    options?: Readonly<{
      allowAlreadyAbsent?: boolean;
      removeAfterVerification?: boolean;
      assertBeforeRemoval?: () => boolean;
    }>,
  ) => boolean;
  discoverSubmitted: (
    expectation: Omit<DockerResourceExpectation, "dockerId">,
  ) => string | null;
  observeAbsent: (
    kind: "container" | "network",
    expectedName: string,
    ownershipLabel: string,
  ) => boolean;
}>;

/**
 * 現在操作の借用管理領域に限定した回復接続入力。
 * @responsibility 技術用の短命config作成に必要な所在とOwner観測だけを受ける。
 * @trace ARCH-000008
 * @shape 管理Directory、同期Owner確認、CLI照合、固定環境。
 * @invariant 任意config所在、上位State、Lockを受け取らない。
 * @boundary 既存管理Ownerと使い捨てDocker構成。
 * @security 借用所在は呼出し元が用途とRootへ結合する。
 * @compatibility 最新構成のみ。旧prefix残存は再利用しない。
 */
export type DockerOperationRecoveryInput = Readonly<{
  managementDirectory: string;
  assertOwner: () => boolean;
  verifyCli: () => void;
  environment: () => Readonly<Record<string, string>>;
}>;

/**
 * 通常Directoryのcanonical実体だけを観測する。
 * @responsibility 空を要求せず親の非link・Identityを固定する。
 * @trace ARCH-000008
 * @input directory: 検査済み管理所在。
 * @returns dev・ino・birthtimeNsの相関値。
 * @precondition 上位がRootと用途を確認している。
 * @postcondition 作成・修復・削除を行わない。
 * @effect metadataとrealpathの読取りのみ。
 * @failure 非Directory・link・非canonical・不明Identityは拒否。
 * @invariant Path文字列だけをAuthorityにしない。
 * @boundary 借用Directoryの実体観測。
 * @security 親や隣接領域を探索しない。
 * @concurrency 操作ごとに同じ実体を再観測する。
 */
function recoveryParentIdentity(directory: string) {
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory)
    throw new Error("docker_task_recovery_parent_untrusted");
  const metadata = fs.lstatSync(directory, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync(directory) !== directory ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("docker_task_recovery_parent_untrusted");
  return [metadata.dev, metadata.ino, metadata.birthtimeNs].join(":");
}

/**
 * 操作ごとの一意な空configと固定回収接続を作る。
 * @responsibility 他の残存を採用せず自作Identityだけを一度回収する。
 * @trace ARCH-000008
 * @input input: 検査済み借用管理領域と既存Owner観測。
 * @returns readyと三操作・close、または固定停止とcleanup状態。
 * @precondition 上位が現在操作と管理領域を結合している。
 * @postcondition config不明を保存成功や資源回収へ昇格しない。
 * @effect 直下短命Directory一つの作成、固定Docker要求と空Directory回収。
 * @failure Owner・Identity・空性・保持上限不明は停止し残存を保持。
 * @invariant 旧prefixを採用・削除せず永続State／Registry／Lockを追加しない。
 * @boundary 管理領域の借用と使い捨てDocker技術構成。
 * @security 任意実行物、認証config、Recursive削除を使用しない。
 * @concurrency 各spawnとcloseで現在Identityを再照合しcloseは一度だけ試す。
 */
export function createDockerOperationRecoveryExecutor(
  input: DockerOperationRecoveryInput,
) {
  const prefix = "docker-recovery-config-";
  let parentIdentity: string | null = null;
  let configDirectory: string | null = null;
  let configIdentity: string | null = null;
  let creationAttempted = false;
  let closed = false;
  let closeConfirmed = false;
  /**
   * 自作空configをOwner失効後も一度だけ回収する。
   * @responsibility 非使用・実体・空性を確認した自作子だけを削除する。
   * @trace ARCH-000008
   * @input N/A: 閉じた自作Identityを使用する。
   * @returns 全不存在確認時だけtrue、再呼出しは同じ値。
   * @precondition 他の旧子を処置対象にしない。
   * @postcondition 二度目closeは追加Filesystem Effect 0。
   * @effect Identity読取り、非再帰rmdir、明示不存在観測。
   * @failure 未capture・差替え・非空・削除後不明はfalseで保持。
   * @invariant 初回falseも自動再試行しない。
   * @boundary 自作configの実体と短命保存領域。
   * @security Owner喪失を別Identity削除の根拠にしない。
   * @concurrency close先行固定後に一度だけ処置する。
   */
  const close = () => {
    if (closed) return closeConfirmed;
    closed = true;
    if (!creationAttempted) {
      closeConfirmed = true;
      return true;
    }
    if (!configDirectory || !configIdentity || !parentIdentity) return false;
    try {
      if (
        recoveryParentIdentity(input.managementDirectory) !== parentIdentity ||
        path.dirname(configDirectory) !== input.managementDirectory ||
        !path.basename(configDirectory).startsWith(prefix) ||
        observeDockerRecoveryConfigIdentity(configDirectory) !== configIdentity
      )
        return false;
      fs.rmdirSync(configDirectory);
      try {
        fs.lstatSync(configDirectory);
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
      }
      closeConfirmed = true;
      return true;
    } catch {
      return false;
    }
  };
  /**
   * 現Ownerの同期trueだけを受理する。
   * @responsibility 失効・非boolean・非同期値を処置許可へ変換しない。
   * @trace ARCH-000008
   * @input N/A: 固定Owner callbackを使用する。
   * @returns N/A: 不成立は例外。
   * @precondition この操作の既存Ownerがcallbackを結合する。
   * @postcondition 不明時は後続Effectを停止する。
   * @effect 既存Ownerの読取りだけ。
   * @failure false・throw・thenableは拒否。
   * @invariant callback戻り値から新Authorityを作らない。
   * @boundary 元Ownerと技術処置前確認。
   * @security thenを実行しない。
   * @concurrency 同期確認のみ。
   */
  const owner = () => {
    if (closed || input.assertOwner() !== true)
      throw new Error("docker_task_recovery_owner_unconfirmed");
  };
  try {
    parentIdentity = recoveryParentIdentity(input.managementDirectory);
    if (
      fs
        .readdirSync(input.managementDirectory)
        .filter((name) => name.startsWith(prefix)).length >= 96
    )
      throw new Error("docker_task_recovery_config_capacity");
    if (recoveryParentIdentity(input.managementDirectory) !== parentIdentity)
      throw new Error("docker_task_recovery_parent_untrusted");
    owner();
    creationAttempted = true;
    configDirectory = fs.mkdtempSync(
      path.join(input.managementDirectory, prefix),
    );
    if (
      path.dirname(configDirectory) !== input.managementDirectory ||
      !path.basename(configDirectory).startsWith(prefix)
    )
      throw new Error("docker_task_recovery_config_untrusted");
    const capturedIdentity =
      observeDockerRecoveryConfigIdentity(configDirectory);
    if (recoveryParentIdentity(configDirectory) !== capturedIdentity)
      throw new Error("docker_task_recovery_config_untrusted");
    configIdentity = capturedIdentity;
    owner();
    const executor = createRecoveryExecutor(
      {
        configDirectory,
        configIdentity,
        environment: input.environment,
        verifyCli: () => {
          owner();
          input.verifyCli();
        },
      },
      () => {
        if (
          recoveryParentIdentity(input.managementDirectory) !== parentIdentity
        )
          throw new Error("docker_task_recovery_parent_untrusted");
        owner();
      },
    );
    return Object.freeze({
      status: "ready" as const,
      executor: Object.freeze({ ...executor, close }),
      cleanupConfirmed: false,
      reason: "docker_task_recovery_executor_ready",
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      executor: null,
      cleanupConfirmed: close(),
      reason: "docker_task_recovery_executor_unconfirmed",
    });
  }
}
