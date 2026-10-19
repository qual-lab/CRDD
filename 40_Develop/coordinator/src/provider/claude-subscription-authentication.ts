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
import fs from "node:fs";
import path from "node:path";

import {
  describeProviderAuthentication,
  evaluateProviderAuthentication,
  describeProviderExecution,
} from "../../../ai-adapter/src/index.ts";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../host-execution/kernel-lock.ts";
import { describeEgressProxyTopology } from "../external-send/egress-proxy-policy.ts";
import {
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationPlan,
} from "../../../docker-isolation/src/index.ts";

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
  processCompletionConfirmed?: boolean;
  resourceCreationConfirmed?: boolean;
  resourceReceipt?: Readonly<{ name: string; dockerId: string }>;
}>;
const authenticationTechnicalPlans = new WeakMap<
  object,
  DockerAuthenticationPlan
>();

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
  run: (
    command: Command,
    authorityLive: () => boolean,
    plan: ClaudeAuthenticationPlan,
  ) => Promise<Execution>;
  isProcessCompletionConfirmed?: () => boolean;
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
  recordCreatedResource: (
    record: AuthenticationRecoveryRecord,
    result: Execution,
  ) => boolean;
  recoveryCommands: (
    record: AuthenticationRecoveryRecord,
    plan: ClaudeAuthenticationPlan,
    index: number,
  ) => Readonly<{
    ownershipCommand: Command;
    cleanupCommand: Command | null;
    absenceCommand: Command;
    identityAbsenceCommand?: Command;
  }> | null;
}>;

/**
 * Claude再認証の耐久回復記録を表す。
 *
 * @responsibility exact Recovery Identity、資源集合およびCommand状態の値境界を所有する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape revision 3の固定識別子、状態、五資源の実IDおよび記録Pathからなる読取り専用値である。
 * @invariant 秘密値、CredentialおよびProvider生出力を含まない。
 * @boundary 再認証LifecycleとOS管理Recovery Storeの境界。
 * @security 回復に必要な最小Identityだけを耐久化する。
 * @compatibility 旧revisionは自動清掃せず停止する。移行はフロントAIの確認手順で扱う。
 */
export type AuthenticationRecoveryRecord = Readonly<{
  contract: "crdd-coordinator/claude-subscription-authentication-recovery";
  contractRevision: 3;
  recoveryId: string;
  stableLogicalHomeBindingHash: string;
  suffix: string;
  resourceNames: readonly string[];
  resources: readonly Readonly<{
    kind: "container" | "network";
    name: string;
    dockerId: string | null;
  }>[];
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
    contractRevision: 3,
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
    resources: Object.freeze([
      Object.freeze({
        kind: "container" as const,
        name: plan.probeContainerName,
        dockerId: null,
      }),
      Object.freeze({
        kind: "container" as const,
        name: plan.loginContainerName,
        dockerId: null,
      }),
      Object.freeze({
        kind: "container" as const,
        name: plan.proxyContainerName,
        dockerId: null,
      }),
      Object.freeze({
        kind: "network" as const,
        name: plan.internalNetworkName,
        dockerId: null,
      }),
      Object.freeze({
        kind: "network" as const,
        name: plan.egressNetworkName,
        dockerId: null,
      }),
    ]),
    recordPath,
  });
}

/**
 * 保存済み回復記録が期待するIdentityと同じか判定する。
 *
 * @responsibility 未信頼JSONをrevision 3のexact Recovery Recordへ照合する。
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
    Array.isArray(record.resources) &&
    record.resources.length === expected.resources.length &&
    record.resources.every((resource: unknown, index: number) => {
      if (!resource || typeof resource !== "object" || Array.isArray(resource))
        return false;
      const value = resource as Record<string, unknown>;
      const target = expected.resources[index];
      return (
        target !== undefined &&
        Object.keys(value).sort().join(",") === "dockerId,kind,name" &&
        value.kind === target.kind &&
        value.name === target.name &&
        (value.dockerId === null ||
          (typeof value.dockerId === "string" &&
            /^[a-f0-9]{64}$/u.test(value.dockerId)))
      );
    }) &&
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
        resources: record.resources,
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
        ...current,
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
 * 作成中の元資源実IDを同じ回復記録へ保存し読戻す。
 * @responsibility 作成完了と実IDの保存確定をidle遷移前に結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: 元回復相関。name、dockerId: 下位の構成確認済み作成Receipt。
 * @returns 保存・読戻し一致時だけtrue。
 * @precondition 下位が元create結果と即時inspectのID・構成を確認済み。
 * @postcondition 別名・別用途・別IDへReceiptを付け替えない。
 * @effect 既存回復記録だけを同期更新する。
 * @failure 未終了Intent、不正ID、記録差、保存・読戻し不明はfalse。
 * @invariant 新Storeや回復Identityを追加しない。
 * @boundary 下位作成Receiptと既存耐久記録。
 * @security 秘密値・生出力・Host Pathを保存しない。
 * @concurrency 同じHome Lockを保持する単一Writerで処置する。
 */
export function recordClaudeSubscriptionAuthenticationResource(
  record: AuthenticationRecoveryRecord,
  name: string,
  dockerId: string,
) {
  if (!/^[a-f0-9]{64}$/u.test(dockerId)) return false;
  try {
    const current = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as AuthenticationRecoveryRecord;
    if (
      !sameRecoveryRecord(current, record) ||
      current.state !== "active" ||
      current.commandState !== "in_flight"
    )
      return false;
    const index = record.resourceNames.indexOf(name);
    const purposes = [
      "create_probe",
      "create_login",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ];
    if (index < 0 || current.commandPurpose !== purposes[index]) return false;
    const resource = current.resources[index];
    if (
      !resource ||
      (resource.dockerId !== null && resource.dockerId !== dockerId)
    )
      return false;
    const resources = current.resources.map((value, position) =>
      position === index ? { ...value, dockerId } : value,
    );
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({ ...current, recordPath: undefined, resources })}\n`,
      { encoding: "utf8", flush: true },
    );
    const updated = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    return (
      sameRecoveryRecord(updated, record) &&
      JSON.stringify((updated as AuthenticationRecoveryRecord).resources) ===
        JSON.stringify(resources) &&
      (updated as AuthenticationRecoveryRecord).commandState === "in_flight" &&
      (updated as AuthenticationRecoveryRecord).commandPurpose ===
        current.commandPurpose
    );
  } catch {
    return false;
  }
}

/**
 * 同じexact回復記録の資源Receiptを現在読取りする。
 * @responsibility 旧形式・欠測を空Receiptへ補完しない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: 元回復相関。
 * @returns 妥当な五資源Receipt、または観測不能null。
 * @precondition 認可・Home Lockは上位が確認する。
 * @postcondition 永続記録を変更しない。
 * @effect 既存記録を同期読取る。
 * @failure 旧版、不正Identity、読取り不明はnull。
 * @invariant nullを未作成・不存在にしない。
 * @boundary 現在耐久記録と上位回復。
 * @security PathやCredentialを結果へ含めない。
 * @concurrency 同じHome Lock生存中に再観測する。
 */
export function readClaudeSubscriptionAuthenticationResources(
  record: AuthenticationRecoveryRecord,
) {
  try {
    const current = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as AuthenticationRecoveryRecord;
    if (!sameRecoveryRecord(current, record) || current.state !== "active")
      return null;
    return Object.freeze(
      current.resources.map((resource) => Object.freeze({ ...resource })),
    );
  } catch {
    return null;
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
      `${JSON.stringify({ ...(existing as AuthenticationRecoveryRecord), recordPath: undefined, state: "settled" })}\n`,
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
 * 本番Claude再認証Lifecycleの外部境界を構成する。
 *
 * @responsibility 下位の固定認証Runtime、Kernel LockおよびRecovery Storeを結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 固定Runtime構成と現在環境を観測する。
 * @returns 本番境界へ閉じたDependenciesを返す。
 * @precondition 下位の固定認証Runtime Factoryを構成できる。
 * @postcondition 各Command実行前にDocker CLI Identityを再検証する構成だけを返す。
 * @effect 下位Factoryの技術観測を呼び、上位の保存・排他を接続する。
 * @failure 境界を構成できない場合は例外でFail Closedする。
 * @invariant 任意RunnerまたはRepository Pathを注入しない。
 * @boundary Coordinator DomainとHost Docker／Recovery Runtimeの構成境界。
 * @security 固定Environmentと検証済み実行ファイルだけを使用する。
 * @concurrency 同じLogical Provider HomeはKernel Lockで直列化する。
 */
export function createClaudeSubscriptionAuthenticationDependencies(): Dependencies {
  const createRuntime = createDockerAuthenticationRuntimeFactory();
  let processUnsettled = false;
  const runtimes = new WeakMap<
    ClaudeAuthenticationPlan,
    ReturnType<typeof createRuntime>
  >();
  return Object.freeze({
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
    beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
    setRecoveryCommandState:
      setClaudeSubscriptionAuthenticationRecoveryCommandState,
    completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
    recordCreatedResource: (record, result) =>
      result.resourceCreationConfirmed === true &&
      result.resourceReceipt !== undefined &&
      recordClaudeSubscriptionAuthenticationResource(
        record,
        result.resourceReceipt.name,
        result.resourceReceipt.dockerId,
      ),
    isProcessCompletionConfirmed: () => !processUnsettled,
    recoveryCommands: (record, plan, index) => {
      const technicalPlan = authenticationTechnicalPlans.get(plan);
      const receipts = readClaudeSubscriptionAuthenticationResources(record);
      const receipt = receipts?.[index];
      const absenceCommand = plan.absenceCommands[index];
      if (!technicalPlan || !receipt || !absenceCommand) return null;
      if (receipt.dockerId === null)
        return Object.freeze({
          ownershipCommand: absenceCommand,
          cleanupCommand: null,
          absenceCommand,
        });
      return planDockerAuthenticationResourceRecovery(
        technicalPlan,
        receipt.name,
        receipt.dockerId,
      );
    },
    run: async (command, authorityLive, plan) => {
      if (processUnsettled)
        throw new Error("docker_authentication_process_completion_unconfirmed");
      const technicalPlan = authenticationTechnicalPlans.get(plan);
      if (!technicalPlan) throw new Error("docker_authentication_plan_unbound");
      const runtime = runtimes.get(plan) ?? createRuntime(technicalPlan);
      runtimes.set(plan, runtime);
      const result = await runtime.execute(command, authorityLive);
      if (!result.processCompletionConfirmed) processUnsettled = true;
      if (
        command.purpose.startsWith("observe_") &&
        result.resourceConfigurationConfirmed === true
      )
        return Object.freeze({
          ...result,
          stdout: plan.ownershipLabel.split("=")[1] ?? "",
        });
      return result.error?.message === "docker_execution_permit_lost"
        ? Object.freeze({
            ...result,
            error: new Error("provider_home_lock_lost"),
          })
        : result;
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
  const claude = describeProviderExecution("claude");
  const authenticationCli = describeProviderAuthentication("claude");
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
  const technicalPlan = planDockerAuthenticationCommands({
    providerHomeSourcePath,
    providerImageDigest,
    proxyImageDigest,
    ownershipLabel,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    probeContainerName,
    proxyToken,
    proxyPort: egress.containerPort,
    proxyProfile: "claude",
    authenticationCli,
  });
  const { commands, ownershipCommands, cleanupCommands, absenceCommands } =
    technicalPlan;
  const plan: ClaudeAuthenticationPlan = Object.freeze({
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
  authenticationTechnicalPlans.set(plan, technicalPlan);
  return plan;
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
  recovery: AuthenticationRecoveryRecord,
) {
  let cleanupConfirmed = true;
  let processCompletionConfirmed = true;
  let recordingConfirmed = true;
  /**
   * 同じ認証回復IDで清掃操作のIntentと終了を記録する。
   * @responsibility 観測・削除・不存在確認も開始前in_flight、終了確認後idleへ接続する。
   * @trace ARCH-000010
   * @trace ARCH-000015
   * @input command: 元計画の固定清掃操作。
   * @returns 元Process結果。
   * @precondition 同じHome許可とexact回復記録を使用する。
   * @postcondition 終了不明や保存不明では後続Effectを発行しない。
   * @effect 既存記録更新と固定Docker操作を発行する。
   * @failure 記録・許可・終了未確認は停止する。
   * @invariant 新StateやRecoveryを追加しない。
   * @boundary 清掃Lifecycleと既存回復記録。
   * @security 元計画以外の操作は選択しない。
   * @concurrency 同じHome Lock生存中だけ逐次実行する。
   */
  async function execute(command: Command) {
    if (!authorityLive() || !recordingConfirmed || !processCompletionConfirmed)
      throw new Error("claude_authentication_cleanup_stopped");
    if (
      !dependencies.setRecoveryCommandState(
        recovery,
        "in_flight",
        command.purpose,
      )
    ) {
      recordingConfirmed = false;
      throw new Error("claude_authentication_cleanup_intent_unconfirmed");
    }
    let result: Execution;
    try {
      result = await dependencies.run(command, authorityLive, plan);
    } catch {
      processCompletionConfirmed = false;
      throw new Error("claude_authentication_process_completion_unconfirmed");
    }
    if (result.processCompletionConfirmed === false) {
      processCompletionConfirmed = false;
      throw new Error("claude_authentication_process_completion_unconfirmed");
    }
    if (!authorityLive()) {
      recordingConfirmed = false;
      throw new Error("claude_authentication_cleanup_permit_lost");
    }
    if (!dependencies.setRecoveryCommandState(recovery, "idle", null)) {
      recordingConfirmed = false;
      throw new Error("claude_authentication_cleanup_settlement_unconfirmed");
    }
    return result;
  }
  for (let index = 0; index < plan.cleanupCommands.length; index += 1) {
    if (!authorityLive() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    const selected = dependencies.recoveryCommands(recovery, plan, index);
    if (!selected) {
      cleanupConfirmed = false;
      break;
    }
    const {
      ownershipCommand,
      cleanupCommand,
      absenceCommand,
      identityAbsenceCommand,
    } = selected;
    try {
      const ownership = await execute(ownershipCommand);
      const alreadyAbsent = explicitDockerAbsence(ownershipCommand, ownership);
      if (alreadyAbsent && !identityAbsenceCommand) continue;
      if (
        !alreadyAbsent &&
        (ownership.error ||
          ownership.signal !== null ||
          ownership.status !== 0 ||
          ownership.stderr.trim().length !== 0 ||
          ownership.stdout.trim() !== plan.ownershipLabel.split("=")[1])
      ) {
        cleanupConfirmed = false;
        continue;
      }
      if (!alreadyAbsent) {
        if (!cleanupCommand) {
          cleanupConfirmed = false;
          continue;
        }
        const removed = await execute(cleanupCommand);
        if (removed.error || removed.signal !== null || removed.status !== 0)
          cleanupConfirmed = false;
      }
    } catch {
      cleanupConfirmed = false;
    }
    if (!authorityLive() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    try {
      if (identityAbsenceCommand) {
        const identityResult = await execute(identityAbsenceCommand);
        if (!explicitDockerAbsence(identityAbsenceCommand, identityResult))
          cleanupConfirmed = false;
      }
      const result = await execute(absenceCommand);
      if (!explicitDockerAbsence(absenceCommand, result))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return Object.freeze({
    confirmed:
      cleanupConfirmed &&
      recordingConfirmed &&
      processCompletionConfirmed &&
      authorityLive() &&
      (dependencies.isProcessCompletionConfirmed?.() ?? true),
    processCompletionConfirmed:
      processCompletionConfirmed &&
      (dependencies.isProcessCompletionConfirmed?.() ?? true),
  });
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
    activeDependencies =
      dependencies ?? createClaudeSubscriptionAuthenticationDependencies();
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
      recovery,
    );
    if (
      !recoveryCleanupConfirmed.confirmed ||
      !activeDependencies.completeRecovery(recovery)
    ) {
      if (recoveryCleanupConfirmed.processCompletionConfirmed)
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
  let processCompletionUnknown = false;
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
        plan,
      );
      providerEffectIssued = true;
      if (result.processCompletionConfirmed === false) {
        processCompletionUnknown = true;
        reason = "claude_authentication_process_completion_unconfirmed";
        break;
      }
      if (!providerHomeLock.assertLive()) {
        reason = "claude_authentication_provider_home_lock_lost";
        break;
      }
      if (
        command.purpose.startsWith("create_") &&
        !activeDependencies.recordCreatedResource(recovery, result)
      ) {
        reason = "claude_authentication_resource_receipt_unconfirmed";
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
        if (
          evaluateProviderAuthentication(
            "claude",
            "claude_max",
            result.stdout,
            "",
            "login",
          ).status !== "confirmed"
        ) {
          reason = "claude_subscription_authentication_not_confirmed";
          break;
        }
        authenticationConfirmed = true;
      }
    }
  } catch {
    reason = "claude_subscription_authentication_failed_closed";
  }
  const cleanup = processCompletionUnknown
    ? { confirmed: false, processCompletionConfirmed: false }
    : await cleanAuthenticationResources(
        plan,
        activeDependencies,
        providerHomeLock.assertLive,
        recovery,
      );
  processCompletionUnknown ||= !cleanup.processCompletionConfirmed;
  let cleanupConfirmed = cleanup.confirmed;
  const isLockLiveAfterCleanup = providerHomeLock.assertLive();
  if (!isLockLiveAfterCleanup)
    reason = "claude_authentication_provider_home_lock_lost";
  if (cleanupConfirmed && isLockLiveAfterCleanup)
    cleanupConfirmed = activeDependencies.completeRecovery(recovery);
  else cleanupConfirmed = false;
  const lockReleased =
    !processCompletionUnknown &&
    (activeDependencies.isProcessCompletionConfirmed?.() ?? true) &&
    providerHomeLock.release();
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
