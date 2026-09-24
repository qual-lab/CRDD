/**
 * Claude専用Provider Homeの人手再認証Lifecycleを所有する。
 *
 * @responsibility 固定Claude Image、限定Proxy、Repository非接続、認証後Probeおよびexact cleanupを一つのLifecycleへ閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describeClaudeExecutionPlanContract } from "./claude-execution-plan.ts";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";
import { createDockerProcessEnvironment } from "./docker-owned-process.ts";
import { describeEgressProxyTopology } from "./egress-proxy-policy.ts";

export const CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT =
  "crdd-coordinator/claude-subscription-authentication";
export const CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT_REVISION = 1;

export const CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE =
  "PowerShellにコード貼付けを求められた場合、貼付けた文字は画面に表示されません。一度だけ貼り付けてEnterを押し、結果が出るまで再入力しないでください。";

/**
 * Claude再認証で許可する一つのDocker Commandを表す。
 *
 * @responsibility 固定用途、引数および対話性の値境界を所有する。
 * @trace ARCH-000010
 * @shape purpose、argv、interactiveからなる読取り専用値である。
 * @invariant 任意Shell文字列や暗黙の環境依存を含まない。
 * @boundary 認証PlanからDocker CLI AdapterへのCommand境界。
 * @security 秘密値を結果または診断へ公開しない。
 * @compatibility 利用側は宣言済みPropertyだけへ依存する。
 */
type Command = Readonly<{
  purpose: string;
  argv: readonly string[];
  interactive: boolean;
}>;

/**
 * Claude再認証の固定Docker Planを表す。
 *
 * @responsibility Image、資源名、所有LabelおよびCommand列の値境界を所有する。
 * @trace ARCH-000010
 * @shape Provider情報、Docker資源Identityおよび用途別Command列からなる読取り専用値である。
 * @invariant RepositoryやWorkspaceのmountを含めない。
 * @boundary Host Runtimeから隔離Docker認証環境へのPlan境界。
 * @security 専用Provider Home以外のHost資源を接続しない。
 * @compatibility 利用側は宣言済みPropertyと固定Command順だけへ依存する。
 */
export type ClaudeAuthenticationPlan = Readonly<{
  provider: "claude";
  providerHomeSourcePath: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  ownershipLabel: string;
  internalNetworkName: string;
  egressNetworkName: string;
  proxyContainerName: string;
  loginContainerName: string;
  probeContainerName: string;
  commands: readonly Command[];
  ownershipCommands: readonly Command[];
  cleanupCommands: readonly Command[];
  absenceCommands: readonly Command[];
}>;

/**
 * 一つのDocker Command実行観測を表す。
 *
 * @responsibility 終了状態、出力および起動失敗の観測値境界を所有する。
 * @trace ARCH-000010
 * @shape status、signal、stdout、stderrおよび任意errorからなる読取り専用値である。
 * @invariant 要求発行と完了観測を同一視しない。
 * @boundary 子Processから再認証Lifecycleへの結果搬送境界。
 * @security 生出力を公開結果へ直接搬送しない。
 * @compatibility 利用側は宣言済み観測Propertyだけへ依存する。
 */
type Execution = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}>;

/**
 * Claude再認証Lifecycleが利用する外部境界を表す。
 *
 * @responsibility Random、Process、Kernel LockおよびRecovery StoreのPort集合を所有する。
 * @trace ARCH-000010
 * @shape 再認証Lifecycleに必要な関数Portだけからなる読取り専用値である。
 * @invariant Repositoryや任意Filesystem Adapterを注入可能にしない。
 * @boundary Domain LifecycleとOS／Docker／Recovery実装の境界。
 * @security Test差替えを本番Authorityへ昇格させない。
 * @compatibility 利用側は宣言済みPort signatureだけへ依存する。
 */
type Dependencies = Readonly<{
  randomHex: (bytes: number) => string;
  run: (command: Command, authorityLive: () => boolean) => Promise<Execution>;
  acquireProviderHomeLock: (
    identityHash: string,
  ) => Readonly<{ assertLive: () => boolean; release: () => boolean }> | null;
  beginRecovery: (
    record: AuthenticationRecoveryRecord,
  ) => "created" | "existing_idle" | "existing_in_flight" | "unknown";
  setRecoveryCommandState: (
    record: AuthenticationRecoveryRecord,
    state: "idle" | "in_flight",
    purpose: string | null,
  ) => boolean;
  completeRecovery: (record: AuthenticationRecoveryRecord) => boolean;
}>;

/**
 * Claude再認証の耐久回復記録を表す。
 *
 * @responsibility exact Recovery Identity、資源集合およびCommand状態の値境界を所有する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape revision 2の固定識別子、状態、資源名および記録Pathからなる読取り専用値である。
 * @invariant 秘密値、CredentialおよびProvider生出力を含まない。
 * @boundary 再認証LifecycleとOS管理Recovery Storeの境界。
 * @security 回復に必要な最小Identityだけを耐久化する。
 * @compatibility revision 2の宣言済みPropertyと状態語彙を維持する。
 */
export type AuthenticationRecoveryRecord = Readonly<{
  contract: "crdd-coordinator/claude-subscription-authentication-recovery";
  contractRevision: 2;
  recoveryId: string;
  stableLogicalHomeBindingHash: string;
  suffix: string;
  resourceNames: readonly string[];
  ownershipLabel: string;
  state: "active" | "settled";
  commandState: "idle" | "in_flight";
  commandPurpose: string | null;
  recordPath: string;
}>;

/**
 * Claude再認証の耐久回復記録を構築する。
 *
 * @responsibility 検証済みProvider Home Identityと固定Docker Planを、秘密値を含まないexact Recovery Identityへ結合する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input providerHomeSourcePath: 選択Userの専用Provider Home、stableLogicalHomeBindingHash: 安定Identity、plan: 固定Docker Plan
 * @returns 妥当な入力ではactive回復記録、不正入力ではnullを返す。
 * @precondition Provider HomeはOS管理Runtime Root直下のProviderHomes/claudeである。
 * @postcondition 記録はRecovery ID、所有Labelおよび5資源名を含み、PathまたはCredentialを永続Payloadへ含めない。
 * @effect N/A: 回復記録の値を構築するだけでFilesystemへ書き込まない。
 * @failure IdentityまたはProvider Home境界が不正な場合はnullへ閉じる。
 * @invariant 同じLogical Provider Home IdentityとPlanから同じRecovery IDと資源集合を導く。
 * @boundary OS管理Runtime Root内のClaude再認証回復Storeとの値境界。
 * @security Path、Credential、SecretまたはProvider生出力を耐久Payloadへ含めない。
 * @concurrency N/A: 共有状態を変更しない同期値構築である。
 */
export function createClaudeSubscriptionAuthenticationRecoveryRecord(
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  plan: ClaudeAuthenticationPlan,
): AuthenticationRecoveryRecord | null {
  if (
    !/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash) ||
    path.win32.basename(providerHomeSourcePath).toLowerCase() !== "claude" ||
    path.win32.basename(path.win32.dirname(providerHomeSourcePath)) !==
      "ProviderHomes"
  )
    return null;
  const runtimeRoot = path.win32.dirname(
    path.win32.dirname(providerHomeSourcePath),
  );
  const recordPath = path.win32.join(
    runtimeRoot,
    "Recovery",
    "claude-subscription-authentication",
    `${stableLogicalHomeBindingHash}.json`,
  );
  return Object.freeze({
    contract: "crdd-coordinator/claude-subscription-authentication-recovery",
    contractRevision: 2,
    recoveryId: `claude-auth.${stableLogicalHomeBindingHash}`,
    stableLogicalHomeBindingHash,
    suffix: plan.internalNetworkName.slice("crdd-internal-".length),
    ownershipLabel: plan.ownershipLabel,
    state: "active",
    commandState: "idle",
    commandPurpose: null,
    resourceNames: Object.freeze([
      plan.probeContainerName,
      plan.loginContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ]),
    recordPath,
  });
}

/**
 * 保存済み回復記録が期待するIdentityと同じか判定する。
 *
 * @responsibility 未信頼JSONをrevision 2のexact Recovery Recordへ照合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input value: 未信頼の保存値、expected: 現在の期待回復記録
 * @returns Identity、資源集合および状態語彙が一致する場合だけtrueを返す。
 * @precondition expectedは現在のProvider Homeと固定Planから構築済みである。
 * @postcondition trueの場合だけ既存記録を同じ回復Lifecycleへ利用できる。
 * @effect N/A: 入力値だけを読み取る。
 * @failure 不正形状、余分な状態またはIdentity不一致はfalseへ閉じる。
 * @invariant Pathや秘密値の類似から同一性を推定しない。
 * @boundary 未信頼Filesystem JSONからRecovery Domain値への検証境界。
 * @security accessorや任意Prototypeを実行せず、固定Propertyだけを照合する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function sameRecoveryRecord(
  value: unknown,
  expected: AuthenticationRecoveryRecord,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const isCommandStateValid =
    (record.commandState === "idle" && record.commandPurpose === null) ||
    (record.commandState === "in_flight" &&
      typeof record.commandPurpose === "string" &&
      /^[a-z][a-z0-9_]{1,63}$/u.test(record.commandPurpose));
  return (
    record.contract === expected.contract &&
    record.contractRevision === expected.contractRevision &&
    record.recoveryId === expected.recoveryId &&
    record.stableLogicalHomeBindingHash ===
      expected.stableLogicalHomeBindingHash &&
    record.suffix === expected.suffix &&
    record.ownershipLabel === expected.ownershipLabel &&
    (record.state === "active" || record.state === "settled") &&
    isCommandStateValid &&
    Array.isArray(record.resourceNames) &&
    record.resourceNames.length === expected.resourceNames.length &&
    record.resourceNames.every(
      (name, index) => name === expected.resourceNames[index],
    )
  );
}

/**
 * Claude再認証の耐久回復Lifecycleを開始または再入場する。
 *
 * @responsibility active IntentをDocker Effect前に排他的に公開し、既存activeとsettled再利用を区別する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: exact Recovery Identityへ結合した回復記録
 * @returns 新規開始created、既存activeのexisting、観測不能または不一致のunknownを返す。
 * @precondition 呼出し側が同じLogical Provider HomeのKernel Lockを保持する。
 * @postcondition createdではfinal Pathにexact active記録が存在し、existingでは既存active記録を変更しない。
 * @effect OS管理Runtime Rootの回復Storeへpending write、flush、renameまたはsettledからactiveへの更新を行う。
 * @failure 不一致、競合、読書きまたはrename失敗をunknownへ閉じる。
 * @invariant 回復Identityまたは資源集合が異なる既存記録を上書きしない。
 * @boundary Filesystem耐久記録の作成・再入場境界。
 * @security 秘密値を記録せず、検証済み記録Path以外へ書き込まない。
 * @concurrency Kernel Lockを保持する単一Writerだけが状態を遷移させる。
 */
export function beginClaudeSubscriptionAuthenticationRecovery(
  record: AuthenticationRecoveryRecord,
) {
  try {
    const temporary = `${record.recordPath}.pending`;
    if (fs.existsSync(record.recordPath)) {
      const existing = JSON.parse(
        fs.readFileSync(record.recordPath, "utf8"),
      ) as unknown;
      if (!sameRecoveryRecord(existing, record)) return "unknown";
      if ((existing as Record<string, unknown>).state === "active")
        return (existing as Record<string, unknown>).commandState ===
          "in_flight"
          ? "existing_in_flight"
          : "existing_idle";
      fs.writeFileSync(
        record.recordPath,
        `${JSON.stringify({ ...record, recordPath: undefined, state: "active", commandState: "idle", commandPurpose: null })}\n`,
        { encoding: "utf8", flush: true },
      );
      return "created";
    }
    fs.mkdirSync(path.win32.dirname(record.recordPath), { recursive: true });
    if (fs.existsSync(temporary)) {
      const pending = JSON.parse(fs.readFileSync(temporary, "utf8")) as unknown;
      if (!sameRecoveryRecord(pending, record)) return "unknown";
      fs.renameSync(temporary, record.recordPath);
      return "existing_idle";
    }
    fs.writeFileSync(
      temporary,
      `${JSON.stringify({
        contract: record.contract,
        contractRevision: record.contractRevision,
        recoveryId: record.recoveryId,
        stableLogicalHomeBindingHash: record.stableLogicalHomeBindingHash,
        suffix: record.suffix,
        ownershipLabel: record.ownershipLabel,
        state: "active",
        commandState: "idle",
        commandPurpose: null,
        resourceNames: record.resourceNames,
      })}\n`,
      { encoding: "utf8", flag: "wx", flush: true },
    );
    fs.renameSync(temporary, record.recordPath);
    return "created";
  } catch {
    return "unknown";
  }
}

/**
 * Claude再認証Commandの耐久実行状態を更新する。
 *
 * @responsibility Docker Effect前のin-flight Intentと子Process close後のidle settlementを同じRecovery IDへ耐久化する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: exact回復記録、state: idleまたはin_flight、purpose: 固定Command用途またはnull
 * @returns exact active記録の更新と再読取りが成立した場合だけtrueを返す。
 * @precondition 呼出し側がLogical Provider Home Kernel Lockを保持し、in_flightはEffect前、idleは子Process close後である。
 * @postcondition in_flightはCommand用途を保持し、idleは用途をnullへ戻す。
 * @effect OS管理Runtime Rootのexact回復記録を同期更新する。
 * @failure 記録不一致、状態組合せ不正または読書き失敗をfalseへ閉じる。
 * @invariant in_flightが残る世代へfresh OwnerはDocker cleanupまたは新規認証Effectを発行しない。
 * @boundary Filesystem耐久記録とDocker Command Processの世代Barrier。
 * @security 固定Command用途だけを記録し、argv、Path、CredentialまたはProvider出力を記録しない。
 * @concurrency Kernel Lockを保持する単一WriterだけがCommand状態を更新する。
 */
export function setClaudeSubscriptionAuthenticationRecoveryCommandState(
  record: AuthenticationRecoveryRecord,
  state: "idle" | "in_flight",
  purpose: string | null,
) {
  if (
    (state === "idle" && purpose !== null) ||
    (state === "in_flight" &&
      (typeof purpose !== "string" || !/^[a-z][a-z0-9_]{1,63}$/u.test(purpose)))
  )
    return false;
  try {
    const existing = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    if (!sameRecoveryRecord(existing, record)) return false;
    const current = existing as Record<string, unknown>;
    if (
      current.state !== "active" ||
      (state === "in_flight" &&
        (current.commandState !== "idle" || current.commandPurpose !== null)) ||
      (state === "idle" && current.commandState !== "in_flight")
    )
      return false;
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({
        ...record,
        recordPath: undefined,
        state: "active",
        commandState: state,
        commandPurpose: purpose,
      })}\n`,
      { encoding: "utf8", flush: true },
    );
    const updated = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as Record<string, unknown>;
    return (
      sameRecoveryRecord(updated, record) &&
      updated.state === "active" &&
      updated.commandState === state &&
      updated.commandPurpose === purpose
    );
  } catch {
    return false;
  }
}

/**
 * Claude再認証の耐久回復Lifecycleをsettledへ閉じる。
 *
 * @responsibility exact記録を削除せずsettledへ遷移させ、Lock解放不明でもRecovery Identityを保持する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: 現在Lifecycleのexact回復記録
 * @returns settled状態の再読取りまで成立した場合だけtrueを返す。
 * @precondition 所有Docker資源の不存在が確認され、呼出し側がKernel Lockを保持する。
 * @postcondition 成功時は同じfinal Pathにexact settled記録が存在する。
 * @effect OS管理Runtime Rootの回復記録をsettled状態へ更新し再読取りする。
 * @failure 記録不一致、欠落または読書き失敗ではfalseを返し、成功を公開しない。
 * @invariant Recovery ID、所有Labelおよび資源集合を変更しない。
 * @boundary Filesystem耐久記録の終端状態確定境界。
 * @security 秘密値を追加せず、既存exact記録以外を変更しない。
 * @concurrency Kernel Lockを保持する単一Writerだけが状態を遷移させる。
 */
export function settleClaudeSubscriptionAuthenticationRecovery(
  record: AuthenticationRecoveryRecord,
) {
  try {
    const existing = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    if (
      !sameRecoveryRecord(existing, record) ||
      (existing as Record<string, unknown>).commandState !== "idle" ||
      (existing as Record<string, unknown>).commandPurpose !== null
    )
      return false;
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({ ...record, recordPath: undefined, state: "settled" })}\n`,
      { encoding: "utf8", flush: true },
    );
    const settled = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as Record<string, unknown>;
    return sameRecoveryRecord(settled, record) && settled.state === "settled";
  } catch {
    return false;
  }
}

/**
 * Docker CLI CommandをProvider Home Lockの生存中だけ実行する。
 *
 * @responsibility 同期・対話Commandを共通の非同期Process監視へ閉じ、Lock喪失、timeout、出力上限およびProcess終了を区別する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input executable: 検証済みDocker CLI、command: 固定Plan Command、environment: 最小環境、workingDirectory: 固定OS Directory、authorityLive: Lock生存観測
 * @returns 子Processのclose後に、終了状態、限定出力および失敗理由を返す。
 * @precondition executable、environmentおよびworkingDirectoryは同じEffect直前に検証済みである。
 * @postcondition Lock喪失または非対話Commandのtimeout・出力超過時は終了要求後のchild closeまで完了を返さない。
 * @effect 固定Docker CLI子Processを一つ起動し、必要時にそのProcessへ終了要求を発行する。
 * @failure spawn失敗、Lock喪失、timeout、出力超過または異常終了を成功へ畳まない。
 * @invariant 一つのCommand結果を一度だけ確定し、子Processがliveな間に上位へ完了を返さない。
 * @boundary Windows Host ProcessからDocker CLIへの外部Process境界。
 * @security 親EnvironmentとRepository cwdを継承せず、対話Provider出力を捕捉・保存しない。
 * @concurrency Authority監視、stdout／stderr、Process errorおよびcloseを単一finalizerへ収束させる。
 */
export async function runDockerCommandWithAuthority(
  executable: string,
  command: Command,
  environment: NodeJS.ProcessEnv,
  workingDirectory: string,
  authorityLive: () => boolean,
): Promise<Execution> {
  const authorityIsLive = () => {
    try {
      return authorityLive();
    } catch {
      return false;
    }
  };
  if (!authorityIsLive())
    return {
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: new Error("provider_home_lock_lost"),
    };
  return await new Promise<Execution>((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let terminalError: Error | undefined;
    let authorityTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;
    const child = spawn(executable, command.argv, {
      env: environment,
      cwd: workingDirectory,
      stdio: command.interactive ? "inherit" : ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: !command.interactive,
    });
    const stop = (error: Error) => {
      if (!terminalError) terminalError = error;
      child.kill();
    };
    const append = (target: "stdout" | "stderr", chunk: string) => {
      const next = target === "stdout" ? stdout + chunk : stderr + chunk;
      if (Buffer.byteLength(next, "utf8") > 1_048_576) {
        stop(new Error("docker_effect_output_too_large"));
        return;
      }
      if (target === "stdout") stdout = next;
      else stderr = next;
    };
    if (!command.interactive) {
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => append("stdout", chunk));
      child.stderr?.on("data", (chunk: string) => append("stderr", chunk));
      timeoutTimer = setTimeout(
        () => stop(new Error("docker_effect_timeout")),
        30_000,
      );
    }
    authorityTimer = setInterval(() => {
      if (authorityIsLive()) return;
      stop(new Error("provider_home_lock_lost"));
    }, 250);
    const finish = (status: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      if (authorityTimer) clearInterval(authorityTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(
        Object.freeze({
          status,
          signal,
          stdout,
          stderr,
          ...(terminalError ? { error: terminalError } : {}),
        }),
      );
    };
    child.once("error", (error) => {
      terminalError ??= error;
      if (child.pid === undefined) finish(null, null);
    });
    child.once("close", finish);
  });
}

/**
 * 本番Claude再認証Lifecycleの外部境界を構成する。
 *
 * @responsibility 検証済みDocker CLI、限定環境、Kernel LockおよびRecovery Storeを結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 固定Runtime構成と現在環境を観測する。
 * @returns 本番境界へ閉じたDependenciesを返す。
 * @precondition Docker CLIとSystemRootを安全に観測できる。
 * @postcondition 各Command実行前にDocker CLI Identityを再検証する構成だけを返す。
 * @effect Docker CLIとFilesystemの読取り観測を行う。
 * @failure 境界を構成できない場合は例外でFail Closedする。
 * @invariant 任意RunnerまたはRepository Pathを注入しない。
 * @boundary Coordinator DomainとHost Docker／Recovery Runtimeの構成境界。
 * @security 固定Environmentと検証済み実行ファイルだけを使用する。
 * @concurrency 同じLogical Provider HomeはKernel Lockで直列化する。
 */
function createProductionDependencies(): Dependencies {
  const dockerCli = observeTrustedDockerCli();
  const environment = createDockerProcessEnvironment();
  const systemRoot = environment.SystemRoot;
  if (!systemRoot)
    throw new Error("docker_effect_working_directory_unavailable");
  const workingDirectory = path.win32.join(systemRoot, "System32");
  if (!fs.statSync(workingDirectory).isDirectory())
    throw new Error("docker_effect_working_directory_unavailable");
  return Object.freeze({
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
    beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
    setRecoveryCommandState:
      setClaudeSubscriptionAuthenticationRecoveryCommandState,
    completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
    run: async (command, authorityLive) => {
      const executable = verifyTrustedDockerCliSnapshot(dockerCli);
      return await runDockerCommandWithAuthority(
        executable,
        command,
        environment,
        workingDirectory,
        authorityLive,
      );
    },
  });
}

/**
 * Claude再認証の固定Docker Planを構築する。
 *
 * @responsibility 認証Effectを固定Image、限定Egressおよび専用Provider Homeだけへ制限する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Homeの絶対Path、suffix: Logical Provider Home Identity由来hex
 * @returns 検証済み入力では固定Plan、不正入力ではnullを返す。
 * @precondition providerHomeSourcePathはPlatform Accessが選択Userから導いたPathである。
 * @postcondition PlanにRepository mount、host network、API keyまたは任意Commandを含めない。
 * @effect N/A: Plan生成だけを行う。
 * @failure 不正Path、suffixまたは固定配布契約の不一致をnullへ閉じる。
 * @invariant Claude Maxの公式CLI認証とnetwork-noneの事後Probeだけを許可する。
 * @boundary Host Docker CLIへ渡す引数の生成境界。
 * @security Provider Home Pathを結果以外へ公開せず、秘密値を読まない。
 * @concurrency 同じLogical Provider Homeは安定suffixとKernel Lockで単一Lifecycleへ直列化する。
 */
export function createClaudeSubscriptionAuthenticationPlan(
  providerHomeSourcePath: string,
  suffix: string,
  proxyToken: string,
): ClaudeAuthenticationPlan | null {
  if (
    !/^[a-f0-9]{16}$/u.test(suffix) ||
    providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
    !/^[a-f0-9]{64}$/u.test(proxyToken)
  )
    return null;
  const claude = describeClaudeExecutionPlanContract();
  const egress = describeEgressProxyTopology("claude");
  const providerImageDigest = claude.distribution.binding.fixedImageDigest;
  const proxyImageDigest = egress.verificationAdapter.imageDigest;
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(providerImageDigest) ||
    !/^sha256:[a-f0-9]{64}$/u.test(proxyImageDigest) ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false
  )
    return null;
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const loginContainerName = `crdd-claude-${suffix}`;
  const probeContainerName = `crdd-auth-${suffix}`;
  const ownershipLabel = `crdd.coordinator.authentication=${suffix}`;
  const proxyUrl = `http://crdd:${proxyToken}@proxy:${egress.containerPort}`;
  const homeMount = `type=bind,src=${providerHomeSourcePath},dst=/provider-home,bind-propagation=rprivate`;
  const fixedEnvironmentArguments = [
    "--env",
    "HOME=/provider-home",
    "--env",
    "TMPDIR=/tmp",
    "--env",
    `HTTPS_PROXY=${proxyUrl}`,
    "--env",
    "DISABLE_AUTOUPDATER=1",
    "--env",
    "DISABLE_UPDATES=1",
    "--env",
    "DISABLE_TELEMETRY=1",
    "--env",
    "DISABLE_ERROR_REPORTING=1",
    "--env",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1",
  ];
  const command = (
    purpose: string,
    argv: readonly string[],
    isInteractive = false,
  ) =>
    Object.freeze({
      purpose,
      argv: Object.freeze([...argv]),
      interactive: isInteractive,
    });
  const commands = Object.freeze([
    command("create_internal_network", [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      ownershipLabel,
      internalNetworkName,
    ]),
    command("create_egress_network", [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      ownershipLabel,
      egressNetworkName,
    ]),
    command("create_proxy", [
      "create",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--network-alias",
      "proxy",
      "--read-only",
      "--name",
      proxyContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      `CRDD_PROXY_AUTH=${proxyToken}`,
      "--env",
      "CRDD_PROXY_PROFILE=claude",
      proxyImageDigest,
    ]),
    command("connect_proxy_egress", [
      "network",
      "connect",
      egressNetworkName,
      proxyContainerName,
    ]),
    command("start_proxy", ["start", proxyContainerName]),
    command("create_login", [
      "create",
      "--interactive",
      "--tty",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--read-only",
      "--name",
      loginContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...fixedEnvironmentArguments,
      "--mount",
      homeMount,
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=33554432",
      providerImageDigest,
      "auth",
      "login",
      "--claudeai",
    ]),
    command(
      "start_login_attached",
      ["start", "--attach", "--interactive", loginContainerName],
      true,
    ),
    command("create_probe", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      probeContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      "HOME=/provider-home",
      "--mount",
      `${homeMount},readonly`,
      providerImageDigest,
      "auth",
      "status",
      "--json",
    ]),
    command("start_probe_attached", ["start", "--attach", probeContainerName]),
  ]);
  const cleanupCommands = Object.freeze([
    command("remove_probe", ["rm", "--force", probeContainerName]),
    command("remove_login", ["rm", "--force", loginContainerName]),
    command("remove_proxy", ["rm", "--force", proxyContainerName]),
    command("remove_internal_network", ["network", "rm", internalNetworkName]),
    command("remove_egress_network", ["network", "rm", egressNetworkName]),
  ]);
  const ownershipCommands = Object.freeze([
    command("observe_probe_owner", [
      "container",
      "inspect",
      "--format",
      '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
      probeContainerName,
    ]),
    command("observe_login_owner", [
      "container",
      "inspect",
      "--format",
      '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
      loginContainerName,
    ]),
    command("observe_proxy_owner", [
      "container",
      "inspect",
      "--format",
      '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
      proxyContainerName,
    ]),
    command("observe_internal_network_owner", [
      "network",
      "inspect",
      "--format",
      '{{ index .Labels "crdd.coordinator.authentication" }}',
      internalNetworkName,
    ]),
    command("observe_egress_network_owner", [
      "network",
      "inspect",
      "--format",
      '{{ index .Labels "crdd.coordinator.authentication" }}',
      egressNetworkName,
    ]),
  ]);
  const absenceCommands = Object.freeze([
    command("confirm_probe_absent", [
      "container",
      "inspect",
      probeContainerName,
    ]),
    command("confirm_login_absent", [
      "container",
      "inspect",
      loginContainerName,
    ]),
    command("confirm_proxy_absent", [
      "container",
      "inspect",
      proxyContainerName,
    ]),
    command("confirm_internal_network_absent", [
      "network",
      "inspect",
      internalNetworkName,
    ]),
    command("confirm_egress_network_absent", [
      "network",
      "inspect",
      egressNetworkName,
    ]),
  ]);
  return Object.freeze({
    provider: "claude",
    providerHomeSourcePath,
    providerImageDigest,
    proxyImageDigest,
    ownershipLabel,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    probeContainerName,
    commands,
    ownershipCommands,
    cleanupCommands,
    absenceCommands,
  });
}

/**
 * Claude認証ProbeがMax契約を確認したか判定する。
 *
 * @responsibility Provider出力を固定4 Propertyの成功条件へ縮約する。
 * @trace ARCH-000010
 * @input stdout: network-none ProbeのJSON出力
 * @returns exactなClaude Max状態だけでtrueを返す。
 * @precondition 出力は未信頼文字列として扱う。
 * @postcondition trueは四つの固定値がすべて一致した場合に限る。
 * @effect N/A: 入力文字列だけを解析する。
 * @failure JSON不正や値不一致はfalseへ閉じる。
 * @invariant 部分一致や追加の認証方式を成功へ昇格しない。
 * @boundary Claude CLI出力から認証Domain判定への境界。
 * @security 生出力を例外または公開結果へ含めない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function probeConfirmed(stdout: string) {
  try {
    const value = JSON.parse(stdout) as Record<string, unknown>;
    return (
      value.loggedIn === true &&
      value.authMethod === "claude.ai" &&
      value.apiProvider === "firstParty" &&
      value.subscriptionType === "max"
    );
  } catch {
    return false;
  }
}

/**
 * Docker資源名を正規表現literalへ変換する。
 *
 * @responsibility 固定資源名をstderr exact照合で安全に使用できる形へ変換する。
 * @trace ARCH-000010
 * @input value: 固定Planから得たDocker資源名
 * @returns 正規表現meta文字をescapeした文字列を返す。
 * @precondition valueはCommand末尾から取得した文字列である。
 * @postcondition 返却値を正規表現へ埋めても元文字列のliteral一致になる。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure N/A: 任意文字列を決定論的にescapeする。
 * @invariant 文字を削除または意味変換しない。
 * @boundary Docker資源Identityとstderr parserの表現境界。
 * @security 正規表現注入を防ぐ。
 * @concurrency N/A: 共有状態を変更しない同期変換である。
 */
function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Docker結果が対象資源の明示不存在を示すか判定する。
 *
 * @responsibility exit、stdout、stderrおよびexact資源名の積で不存在を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 不存在確認Command、result: その実行観測
 * @returns 明示不存在をすべて確認した場合だけtrueを返す。
 * @precondition commandは固定PlanのabsenceCommands要素である。
 * @postcondition 観測不能、任意stdoutまたは別資源の結果を不存在へ畳まない。
 * @effect N/A: 入力値だけを読み取る。
 * @failure 不正結果や未知形式はfalseへ閉じる。
 * @invariant status 1と固定stderrの両方を必要とする。
 * @boundary Docker CLI観測から資源不存在Domain判定への境界。
 * @security stderr全体を公開せず固定形式だけを判定する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function explicitDockerAbsence(command: Command, result: Execution) {
  const normalizedStdout = result.stdout.trim();
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 1 ||
    (normalizedStdout.length !== 0 && normalizedStdout !== "[]")
  )
    return false;
  const resourceName = command.argv.at(-1);
  if (!resourceName) return false;
  const exactName = escapeRegularExpression(resourceName);
  const normalized = result.stderr.trim();
  if (command.purpose.includes("network"))
    return new RegExp(
      `^(?:Error response from daemon: )?(?:network ${exactName} not found|No such network: ${exactName})$`,
      "u",
    ).test(normalized);
  return new RegExp(
    `^(?:(?:Error response from daemon|Error): )?No such (?:object|container): ${exactName}$`,
    "u",
  ).test(normalized);
}

/**
 * Claude再認証が所有するDocker資源を確認付きで清掃する。
 *
 * @responsibility 所有権確認、対象限定削除、最終不存在観測およびAuthority生存確認を順序付ける。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input plan: 固定認証Plan、dependencies: 実行境界、authorityLive: Kernel Lock生存観測
 * @returns 全対象の不存在とAuthority生存を確認した場合だけtrueを返す。
 * @precondition planのcleanup、ownership、absence Commandが同じ順序で対応する。
 * @postcondition 非所有資源を削除せず、観測不能をcleanup成功へ畳まない。
 * @effect Docker inspect、removeおよびnetwork removeを対象限定で発行する。
 * @failure Command失敗、所有不一致、Authority喪失または不存在未確認をfalseへ閉じる。
 * @invariant Plan外の資源名へ削除Effectを発行しない。
 * @boundary Coordinator cleanup LifecycleとDocker Engineの外部境界。
 * @security 所有Label一致前に削除せず、生出力を公開しない。
 * @concurrency Kernel Lockが生存する単一Lifecycleだけが清掃する。
 */
async function cleanAuthenticationResources(
  plan: ClaudeAuthenticationPlan,
  dependencies: Dependencies,
  authorityLive: () => boolean,
) {
  let cleanupConfirmed = true;
  for (let index = 0; index < plan.cleanupCommands.length; index += 1) {
    if (!authorityLive()) return false;
    const ownershipCommand = plan.ownershipCommands[index];
    const cleanupCommand = plan.cleanupCommands[index];
    const absenceCommand = plan.absenceCommands[index];
    if (!ownershipCommand || !cleanupCommand || !absenceCommand) return false;
    try {
      const ownership = await dependencies.run(ownershipCommand, authorityLive);
      if (explicitDockerAbsence(absenceCommand, ownership)) continue;
      if (
        ownership.error ||
        ownership.signal !== null ||
        ownership.status !== 0 ||
        ownership.stderr.trim().length !== 0 ||
        ownership.stdout.trim() !== plan.ownershipLabel.split("=")[1]
      ) {
        cleanupConfirmed = false;
        continue;
      }
      const removed = await dependencies.run(cleanupCommand, authorityLive);
      if (removed.error || removed.signal !== null || removed.status !== 0)
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    if (!authorityLive()) return false;
    try {
      const result = await dependencies.run(absenceCommand, authorityLive);
      if (!explicitDockerAbsence(absenceCommand, result))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return cleanupConfirmed && authorityLive();
}

/**
 * Claude専用Provider Homeを人手で再認証する。
 *
 * @responsibility Planの順序実行、対話境界、事後認証確認およびexact cleanupを所有する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Home、stableLogicalHomeBindingHash: Provider Homeの安定Identity、dependencies: Test差替え可能なProcess境界
 * @returns 秘密値や生Provider出力を含まない固定結果を返す。
 * @precondition 呼出し元が署名済み配布と対話端末を確認済みである。
 * @postcondition 成功はClaude Max認証確認と全Docker資源cleanup確認の両方を必要とする。
 * @effect Docker Process、Networkおよび専用Provider HomeのOAuth credentialを変更する。
 * @failure 任意段階の失敗を自動再試行せず、cleanup結果付きでblockedへ閉じる。
 * @invariant Repository、Workspace、host credentialおよびAPI keyを接続しない。
 * @boundary 人間端末、Docker Engine、限定Proxy、Claude認証Endpointの外部境界。
 * @security OAuth対話はTTYへ直接接続し、生出力、token、URLまたはPathを結果へ保存しない。
 * @concurrency Docker資源をOperation固有suffixで分離し、終了時にexact nameだけを清掃する。
 */
export async function authenticateClaudeSubscription(
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  dependencies?: Dependencies,
) {
  let activeDependencies: Dependencies;
  try {
    activeDependencies = dependencies ?? createProductionDependencies();
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_docker_boundary_unavailable",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  }
  if (!/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash))
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_provider_home_identity_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const providerHomeLock = activeDependencies.acquireProviderHomeLock(
    stableLogicalHomeBindingHash,
  );
  if (!providerHomeLock)
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_provider_home_active_or_unknown",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  const proxyToken = activeDependencies.randomHex(32);
  const plan = createClaudeSubscriptionAuthenticationPlan(
    providerHomeSourcePath,
    suffix,
    proxyToken,
  );
  const recovery = plan
    ? createClaudeSubscriptionAuthenticationRecoveryRecord(
        providerHomeSourcePath,
        stableLogicalHomeBindingHash,
        plan,
      )
    : null;
  if (!plan || !recovery) {
    const lockReleased = providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_plan_invalid",
      cleanupConfirmed: lockReleased,
      providerEffectIssued: false,
    });
  }
  let recoveryState = activeDependencies.beginRecovery(recovery);
  if (recoveryState === "unknown") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_recovery_inventory_unknown",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "existing_in_flight") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_prior_command_in_flight",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "existing_idle") {
    const recoveryCleanupConfirmed = await cleanAuthenticationResources(
      plan,
      activeDependencies,
      providerHomeLock.assertLive,
    );
    if (
      !recoveryCleanupConfirmed ||
      !activeDependencies.completeRecovery(recovery)
    ) {
      providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "claude_authentication_recovery_unconfirmed",
        cleanupConfirmed: false,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: true,
      });
    }
    recoveryState = activeDependencies.beginRecovery(recovery);
    if (recoveryState !== "created") {
      providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "claude_authentication_recovery_reentry_failed",
        cleanupConfirmed: false,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: false,
      });
    }
  }
  let reason = "claude_subscription_authentication_completed";
  let authenticationConfirmed = false;
  let providerEffectIssued = false;
  try {
    for (const command of plan.commands) {
      if (!providerHomeLock.assertLive()) {
        reason = "claude_authentication_provider_home_lock_lost";
        break;
      }
      if (
        !activeDependencies.setRecoveryCommandState(
          recovery,
          "in_flight",
          command.purpose,
        )
      ) {
        reason = "claude_authentication_command_intent_unconfirmed";
        break;
      }
      const result = await activeDependencies.run(
        command,
        providerHomeLock.assertLive,
      );
      providerEffectIssued = true;
      if (!providerHomeLock.assertLive()) {
        reason = "claude_authentication_provider_home_lock_lost";
        break;
      }
      if (!activeDependencies.setRecoveryCommandState(recovery, "idle", null)) {
        reason = "claude_authentication_command_settlement_unconfirmed";
        break;
      }
      if (result.error || result.signal !== null || result.status !== 0) {
        reason =
          result.error?.message === "provider_home_lock_lost"
            ? "claude_authentication_provider_home_lock_lost"
            : `claude_authentication_${command.purpose}_failed`;
        break;
      }
      if (command.purpose === "start_probe_attached") {
        if (!probeConfirmed(result.stdout)) {
          reason = "claude_subscription_authentication_not_confirmed";
          break;
        }
        authenticationConfirmed = true;
      }
    }
  } catch {
    reason = "claude_subscription_authentication_failed_closed";
  }
  let cleanupConfirmed = await cleanAuthenticationResources(
    plan,
    activeDependencies,
    providerHomeLock.assertLive,
  );
  const isLockLiveAfterCleanup = providerHomeLock.assertLive();
  if (!isLockLiveAfterCleanup)
    reason = "claude_authentication_provider_home_lock_lost";
  if (cleanupConfirmed && isLockLiveAfterCleanup)
    cleanupConfirmed = activeDependencies.completeRecovery(recovery);
  else cleanupConfirmed = false;
  const lockReleased = providerHomeLock.release();
  cleanupConfirmed = cleanupConfirmed && lockReleased;
  return Object.freeze({
    contract: CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT,
    contractRevision: CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT_REVISION,
    status:
      authenticationConfirmed && cleanupConfirmed ? "completed" : "blocked",
    reason:
      authenticationConfirmed && cleanupConfirmed
        ? "claude_subscription_authentication_completed"
        : reason,
    provider: "claude",
    offering: "claude_max",
    humanInteractive: true,
    repositoryMounted: false,
    workspaceMounted: false,
    providerEffectIssued,
    authenticationConfirmed,
    cleanupConfirmed,
    recoveryId: cleanupConfirmed ? null : recovery.recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    effectStateUnknown: !cleanupConfirmed,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}
