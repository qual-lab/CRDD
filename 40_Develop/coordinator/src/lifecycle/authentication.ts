/**
 * Provider認証の受付・実行と既存回復記録の調停を所有する。
 *
 * @responsibility Provider Homeの排他、認証・取消・結果通知を既存技術操作と回復記録へ接続する。
 * @trace ARCH-000008
 */

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";
import {
  getAuthenticationDefinition,
  type Provider,
} from "@qual-lab/crdd-ai-adapter";
import type {
  IsolationCallbacks,
  IsolationExecution,
} from "@qual-lab/crdd-docker-isolation";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
  validateResourceBook,
} from "@qual-lab/crdd-execution-model";
import {
  type AuthenticationOptions,
  cleanupResources,
  createExecutor,
  type Executor,
  type ExecutorCallbacks,
  type ExecutorRequest,
  type RecordProjection,
  type ResourceTarget,
} from "@qual-lab/crdd-executor";
import type { LockResult } from "@qual-lab/crdd-lock";
import { snapshotJsonValue, readExecutionCancellation } from "./validation.ts";
import {
  getIsolationSettings,
  inspectWindowsProviderHomeCandidate,
} from "./environment.ts";
import {
  acquireProviderHomeLock,
  poisonExecutionProcessAfterCleanupUnknown,
} from "./host.ts";
export const PROVIDER_AUTHENTICATION_CONTRACT =
  "crdd-coordinator/provider-authentication";

export const PROVIDER_AUTHENTICATION_CONTRACT_REVISION = 1;

export const PROVIDER_AUTHENTICATION_INPUT_NOTICE =
  "PowerShellにコード貼付けを求められた場合、貼付けた文字は画面に表示されません。一度だけ貼り付けてEnterを押し、結果が出るまで再入力しないでください。";

/**
 * 認証の上位保存・Home排他と技術実行の接続。
 * @responsibility 技術実装を持たず現在記録の照会・保存・確定を所有する。
 * @trace ARCH-000010
 * @shape 準備、Home排他、Recovery受付・資源照会と専用Writer。
 * @invariant 保存結果を下位の通知ACKとして公開しない。
 * @boundary Coordinatorの記録OwnerとExecutor。
 * @security Secret値・任意Docker操作を受け取らない。
 * @compatibility 保存SchemaとLock解放条件を維持する。
 */
type Dependencies = Readonly<{
  randomHex: (bytes: number) => string;
  createAuthentication: (
    request: ExecutorRequest<"authentication">,
    options: AuthenticationOptions,
  ) => Executor<"authentication"> | null;
  createManagementDirectory: (
    record: AuthenticationRecoveryRecord,
    directory: string,
  ) => AuthenticationManagementDirectory | null;
  removeManagementDirectory: (
    directory: AuthenticationManagementDirectory,
  ) => boolean;
  cleanupAuthentication: (
    target: ResourceTarget<"snapshot">,
    callbacks: IsolationCallbacks,
  ) => IsolationExecution;
  acquireProviderHomeLock: (
    identityHash: string,
    directory: string,
  ) => LockResult<Readonly<{ assertLive(): boolean; release(): boolean }>>;
  beginRecovery: (
    record: AuthenticationRecoveryRecord,
  ) =>
    | "created"
    | "existing_idle"
    | "existing_in_flight"
    | "unknown"
    | Readonly<{ status: "prior_action_active"; recoveryId: string }>;
  setRecoveryCommandState: (
    record: AuthenticationRecoveryRecord,
    state: "idle" | "in_flight",
    purpose: string | null,
    resources?: unknown,
    key?: string,
  ) => boolean;
  completeRecovery: (record: AuthenticationRecoveryRecord) => boolean;
  recordResource: (
    record: AuthenticationRecoveryRecord,
    event: unknown,
  ) => boolean;
  readResources: (
    record: AuthenticationRecoveryRecord,
  ) => Readonly<{ resources: OperationResources | null }> | null;
}>;

/** 同じHome Lock下で自作した管理Directoryの短命実体。保存・権限ではない。 */
type AuthenticationManagementDirectory = Readonly<{
  directory: string;
  assertCurrent(): boolean;
}>;

/**
 * 既存Recovery親に、この入場専用の子だけをexclusive作成する。
 * @responsibility 記録受付前の書込みと由来不明の既存領域の採用を避ける。
 * @trace ARCH-000010
 * @input record: 同じHomeと完全Hashから構築した元記録。directory: 同じFactoryに渡した今回専用Path。
 * @returns 自作した元実体。既存・Link・観測不能はnull。
 * @effect 上位管理領域の固定子Directoryを一つ作成する。
 * @invariant 既存の管理領域を使用・削除せず、同じ記録の世代数を96未満に抑えてから新規取得する。
 */
function createAuthenticationManagementDirectory(
  record: AuthenticationRecoveryRecord,
  directory: string,
): AuthenticationManagementDirectory | null {
  try {
    const parent = path.win32.dirname(record.recordPath);
    const recordName = path.win32.basename(record.recordPath);
    const prefix = recordName.replace(/\.json$/u, ".management-");
    const name = path.win32.basename(directory);
    if (
      prefix === recordName ||
      path.win32.dirname(directory) !== parent ||
      !name.startsWith(prefix) ||
      !/^[a-f0-9]{32}$/u.test(name.slice(prefix.length)) ||
      fs.realpathSync(parent) !== parent
    )
      return null;
    const parentMetadata = fs.lstatSync(parent, { bigint: true });
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink())
      return null;
    const parentIdentity = `${parentMetadata.dev}:${parentMetadata.ino}:${parentMetadata.birthtimeNs}`;
    const sameParent = () => {
      const current = fs.lstatSync(parent, { bigint: true });
      return (
        current.isDirectory() &&
        !current.isSymbolicLink() &&
        fs.realpathSync(parent) === parent &&
        `${current.dev}:${current.ino}:${current.birthtimeNs}` ===
          parentIdentity
      );
    };
    if (
      fs
        .readdirSync(parent)
        .filter((entry) => entry.toLowerCase().startsWith(prefix)).length >=
        96 ||
      !sameParent()
    )
      return null;
    fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
    const metadata = fs.lstatSync(directory, { bigint: true });
    if (
      fs.realpathSync(directory) !== directory ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.dev <= 0n ||
      metadata.ino <= 0n ||
      metadata.birthtimeNs <= 0n ||
      !sameParent()
    )
      return null;
    const identity = `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
    return Object.freeze({
      directory,
      assertCurrent() {
        try {
          const current = fs.lstatSync(directory, { bigint: true });
          return (
            current.isDirectory() &&
            !current.isSymbolicLink() &&
            fs.realpathSync(directory) === directory &&
            `${current.dev}:${current.ino}:${current.birthtimeNs}` ===
              identity &&
            sameParent()
          );
        } catch {
          return false;
        }
      },
    });
  } catch {
    return null;
  }
}

/**
 * 自作した同じ空の管理実体だけを非recursiveに終了する。
 * @responsibility DI回収成功と上位Directory終了を別に確認する。
 * @trace ARCH-000010
 * @input owned: 同Processで自作を観測した元Directory。
 * @returns 元実体・空・削除後不存在を確認できた場合だけtrue。
 * @effect 元の空Directory一つのrmdir。
 * @failure 不明・残存・差替えはfalse。別領域を削除しない。
 */
function removeAuthenticationManagementDirectory(
  owned: AuthenticationManagementDirectory,
): boolean {
  try {
    if (
      !owned.assertCurrent() ||
      fs.readdirSync(owned.directory).length !== 0 ||
      !owned.assertCurrent()
    )
      return false;
    fs.rmdirSync(owned.directory);
    try {
      fs.lstatSync(owned.directory);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT";
    }
  } catch {
    return false;
  }
}

const authenticationPreparations = new WeakMap<
  object,
  Readonly<{
    executor: Executor<"authentication">;
    request: ExecutorRequest<"authentication">;
    managementDirectory: string;
  }>
>();

/**
 * Provider認証の耐久回復記録を表す。
 *
 * @responsibility exact Recovery Identity、資源集合およびCommand状態の値境界を所有する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape revision 1の固定識別子、状態、操作別資源の実IDおよび記録Pathからなる読取り専用値である。
 * @invariant 秘密値、CredentialおよびProvider生出力を含まない。
 * @boundary 再認証LifecycleとOS管理Recovery Storeの境界。
 * @security 回復に必要な最小Identityだけを耐久化する。
 * @compatibility 旧revisionは自動清掃せず停止する。移行はフロントAIの確認手順で扱う。
 */
export type AuthenticationRecoveryRecord = Readonly<{
  contract: "crdd-coordinator/provider-authentication-recovery";
  contractRevision: 3;
  provider: "codex" | "claude";
  action: "status" | "login";
  recoveryId: string;
  stableLogicalHomeBindingHash: string;
  suffix: string;
  resources: OperationResources | null;
  ownershipLabel: string;
  state: "active" | "settled";
  commandState: "idle" | "in_flight";
  commandPurpose: string | null;
  recordPath: string;
}>;

/**
 * Provider認証の耐久回復記録を構築する。
 *
 * @responsibility 検証済みProvider Home Identityと固定Docker Planを、秘密値を含まないexact Recovery Identityへ結合する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input providerHomeSourcePath: 選択Userの専用Provider Home、stableLogicalHomeBindingHash: 安定Identity、plan: 固定Docker Plan
 * @returns 妥当な入力ではactive回復記録、不正入力ではnullを返す。
 * @precondition Provider HomeはOS管理Runtime Root直下のProviderHomes/<provider>である。
 * @postcondition 記録はRecovery ID、所有Labelおよび操作別資源名を含み、PathまたはCredentialを永続Payloadへ含めない。
 * @effect N/A: 回復記録の値を構築するだけでFilesystemへ書き込まない。
 * @failure IdentityまたはProvider Home境界が不正な場合はnullへ閉じる。
 * @invariant 同じLogical Provider Home IdentityとPlanから同じRecovery IDと資源集合を導く。
 * @boundary OS管理Runtime Root内のProvider認証回復Storeとの値境界。
 * @security Path、Credential、SecretまたはProvider生出力を耐久Payloadへ含めない。
 * @concurrency N/A: 共有状態を変更しない同期値構築である。
 */
export function createProviderAuthenticationRecoveryRecord(
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  plan: RecordProjection<"authentication">,
): AuthenticationRecoveryRecord | null {
  if (
    !authenticationPreparations.has(plan) ||
    !/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash) ||
    path.win32.basename(providerHomeSourcePath).toLowerCase() !==
      plan.provider ||
    path.win32.basename(path.win32.dirname(providerHomeSourcePath)) !==
      "ProviderHomes"
  )
    return null;
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  if (plan.ownershipLabel !== `crdd.coordinator.authentication=${suffix}`)
    return null;
  const recordPath = authenticationRecoveryRecordPath(
    providerHomeSourcePath,
    plan.provider,
    stableLogicalHomeBindingHash,
  );
  return Object.freeze({
    contract: "crdd-coordinator/provider-authentication-recovery",
    contractRevision: 3,
    provider: plan.provider,
    action: plan.action,
    recoveryId: `provider-auth.${plan.provider}.${plan.action}.${stableLogicalHomeBindingHash}`,
    stableLogicalHomeBindingHash,
    suffix: plan.ownershipLabel.slice(plan.ownershipLabel.indexOf("=") + 1),
    ownershipLabel: plan.ownershipLabel,
    state: "active",
    commandState: "idle",
    commandPurpose: null,
    resources: null,
    recordPath,
  });
}

/** @trace ARCH-000010 認証記録と管理領域の同じRecovery親を導出する。 */
function authenticationRecoveryRecordPath(
  home: string,
  provider: Provider,
  homeHash: string,
) {
  return path.win32.join(
    path.win32.dirname(path.win32.dirname(home)),
    "Recovery",
    "provider-authentication",
    `${provider}.${homeHash}.json`,
  );
}

/**
 * 保存済み回復記録が期待するIdentityと同じか判定する。
 *
 * @responsibility 未信頼JSONを現行のrevision 3の回復記録へ照合する。
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
  if (
    Object.keys(record).sort().join(",") !==
    "action,commandPurpose,commandState,contract,contractRevision,ownershipLabel,provider,recoveryId,resources,stableLogicalHomeBindingHash,state,suffix"
  )
    return false;
  const isCommandStateValid =
    (record.commandState === "idle" && record.commandPurpose === null) ||
    (record.commandState === "in_flight" &&
      typeof record.commandPurpose === "string" &&
      /^[a-z][a-z0-9_]{1,63}$/u.test(record.commandPurpose));
  return (
    record.contract === expected.contract &&
    record.contractRevision === expected.contractRevision &&
    record.provider === expected.provider &&
    record.action === expected.action &&
    record.recoveryId === expected.recoveryId &&
    record.stableLogicalHomeBindingHash ===
      expected.stableLogicalHomeBindingHash &&
    record.suffix === expected.suffix &&
    record.ownershipLabel === expected.ownershipLabel &&
    (record.state === "active" || record.state === "settled") &&
    isCommandStateValid &&
    validateResourceBook(record.resources) &&
    (record.resources === null ||
      record.resources.snapshot.resources.every(
        (resource) =>
          resource.identity.ownershipLabel === expected.ownershipLabel,
      ))
  );
}

/**
 * Provider認証の耐久回復Lifecycleを開始または再入場する。
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
export function beginProviderAuthenticationRecovery(
  record: AuthenticationRecoveryRecord,
): ReturnType<Dependencies["beginRecovery"]> {
  try {
    const temporary = `${record.recordPath}.pending`;
    const recoveryDirectory = path.win32.dirname(record.recordPath);
    let metadata: fs.Stats | undefined;
    try {
      metadata = fs.lstatSync(recoveryDirectory);
    } catch (error) {
      // 親そのものの不存在だけが初回作成を許す。列挙と子の観測失敗は外側で拒否する。
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "unknown";
    }
    if (metadata) {
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        return "unknown";
      const allowed = new Set([
        path.win32.basename(record.recordPath),
        path.win32.basename(temporary),
      ]);
      const managementName = path.win32
        .basename(record.recordPath)
        .replace(/\.json$/u, ".management");
      if (
        fs.readdirSync(recoveryDirectory).some((name) => {
          const normalized = name.toLowerCase();
          if (
            !normalized.startsWith(`${record.provider}.`) ||
            allowed.has(normalized)
          )
            return false;
          if (
            normalized !== managementName &&
            (!normalized.startsWith(`${managementName}-`) ||
              !/^[a-f0-9]{32}$/u.test(
                normalized.slice(managementName.length + 1),
              ))
          )
            return true;
          // 同じ記録の管理領域は記録ではない。実体の種別だけを確認し、中には入らない。
          const entry = fs.lstatSync(path.win32.join(recoveryDirectory, name));
          return !entry.isDirectory() || entry.isSymbolicLink();
        })
      )
        return "unknown";
    }
    const previous = fs.existsSync(record.recordPath)
      ? fs.readFileSync(record.recordPath, "utf8")
      : null;
    if (previous !== null) {
      const existing = JSON.parse(previous) as Record<string, unknown>;
      const action = existing.action;
      if (action !== "status" && action !== "login") return "unknown";
      const expected: AuthenticationRecoveryRecord = {
        ...record,
        action,
        recoveryId: `provider-auth.${record.provider}.${action}.${record.stableLogicalHomeBindingHash}`,
        resources: null,
      };
      if (!sameRecoveryRecord(existing, expected)) return "unknown";
      if (existing.state === "active") {
        if (action !== record.action)
          return Object.freeze({
            status: "prior_action_active",
            recoveryId: expected.recoveryId,
          });
        return existing.commandState === "in_flight"
          ? "existing_in_flight"
          : "existing_idle";
      }
      if (existing.commandState !== "idle") return "unknown";
    }
    fs.mkdirSync(path.win32.dirname(record.recordPath), { recursive: true });
    const payload = `${JSON.stringify({
      ...record,
      recordPath: undefined,
      state: "active",
      commandState: "idle",
      commandPurpose: null,
    })}\n`;
    let recoveredPending = false;
    if (fs.existsSync(temporary)) {
      const pending = fs.readFileSync(temporary, "utf8");
      // Pendingは未発行Intentだけ。Receiptやin-flightを新規実行へ読み替えない。
      if (pending !== payload) return "unknown";
      recoveredPending = true;
    } else {
      fs.writeFileSync(temporary, payload, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
    }
    const current = fs.existsSync(record.recordPath)
      ? fs.readFileSync(record.recordPath, "utf8")
      : null;
    if (current !== previous) return "unknown";
    fs.renameSync(temporary, record.recordPath);
    if (fs.readFileSync(record.recordPath, "utf8") !== payload)
      return "unknown";
    // 正本不在から回復したpendingは、過去のEffect不存在を推定しない。
    return recoveredPending && previous === null ? "existing_idle" : "created";
  } catch {
    return "unknown";
  }
}
/**
 * Provider認証Commandの耐久実行状態を更新する。
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
export function setProviderAuthenticationRecoveryCommandState(
  record: AuthenticationRecoveryRecord,
  state: "idle" | "in_flight",
  purpose: string | null,
  resourcesValue?: unknown,
  key?: string,
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
    let resources = current.resources as OperationResources | null;
    if (state === "in_flight" && purpose?.startsWith("create_")) {
      const material = snapshotJsonValue(resourcesValue) as Record<
        string,
        unknown
      >;
      resources = applyResourceEvent(resources, {
        ...material,
        event: "submission",
        key,
      });
      if (!resources) return false;
    }
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({
        ...current,
        recordPath: undefined,
        state: "active",
        commandState: state,
        commandPurpose: purpose,
        resources,
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
      updated.commandPurpose === purpose &&
      isDeepStrictEqual(
        snapshotJsonValue(updated.resources),
        snapshotJsonValue(resources),
      )
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
export function recordProviderAuthenticationResource(
  record: AuthenticationRecoveryRecord,
  eventValue: unknown,
) {
  try {
    const raw = fs.readFileSync(record.recordPath, "utf8");
    const current = JSON.parse(raw) as AuthenticationRecoveryRecord;
    const event = snapshotJsonValue(eventValue) as Record<string, unknown>;
    if (!sameRecoveryRecord(current, record) || current.state !== "active")
      return false;
    let resources: OperationResources | null;
    if (event.event === "cleanup") {
      if (!current.resources) return false;
      resources = applyResourceCleanup(
        current.resources,
        event.snapshot,
        event.observations,
        {
          recoveryId: current.recoveryId,
          previousPayloadSha256: createHash("sha256").update(raw).digest("hex"),
        },
      );
    } else {
      if (
        current.commandState !== "in_flight" ||
        current.commandPurpose !==
          (event.event === "identified" ? "remove_" : "create_") + event.key
      )
        return false;
      resources = applyResourceEvent(current.resources, event);
    }
    if (!resources) return false;
    const next = {
      ...current,
      recordPath: undefined,
      resources,
      ...(event.event === "not_issued"
        ? { commandState: "idle", commandPurpose: null }
        : {}),
    };
    fs.writeFileSync(record.recordPath, JSON.stringify(next) + "\n", {
      encoding: "utf8",
      flush: true,
    });
    const updated = JSON.parse(fs.readFileSync(record.recordPath, "utf8"));
    return (
      sameRecoveryRecord(updated, record) &&
      JSON.stringify(updated) === JSON.stringify(next)
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
 * @returns 操作に対応する資源Receipt、または観測不能null。
 * @precondition 認可・Home Lockは上位が確認する。
 * @postcondition 永続記録を変更しない。
 * @effect 既存記録を同期読取る。
 * @failure 旧版、不正Identity、読取り不明はnull。
 * @invariant nullを未作成・不存在にしない。
 * @boundary 現在耐久記録と上位回復。
 * @security PathやCredentialを結果へ含めない。
 * @concurrency 同じHome Lock生存中に再観測する。
 */
export function readProviderAuthenticationResources(
  record: AuthenticationRecoveryRecord,
) {
  try {
    const current = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as AuthenticationRecoveryRecord;
    if (
      !sameRecoveryRecord(current, record) ||
      current.state !== "active" ||
      current.commandState !== "idle" ||
      current.commandPurpose !== null
    )
      return null;
    return { resources: current.resources };
  } catch {
    return null;
  }
}

/**
 * Provider認証の耐久回復Lifecycleをsettledへ閉じる。
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
export function settleProviderAuthenticationRecovery(
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
 * 認証の上位保存とHome排他を構成する。
 * @responsibility Docker構成・実行・回収をExecutorへ委譲する。
 * @trace ARCH-000010
 * @input N/A: 既存の固定保存APIへ接続する。
 * @returns 認証受付と保存の依存。
 * @precondition Home選定と操作許可は呼出し元が確定する。
 * @postcondition 構成だけではDocker操作しない。
 * @effect N/A: 関数を結合するだけ。
 * @failure 実際の保存失敗は登録通知で例外へ変換する。
 * @invariant 新Store・Lock・認証Stateを作らない。
 * @boundary 上位記録Ownerと単一認証生涯。
 * @security 生のCLI出力やProxy tokenを通知しない。
 * @concurrency 既存Home排他を維持する。
 */
export function createProviderAuthenticationDependencies(): Dependencies {
  return Object.freeze({
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    createAuthentication: createExecutor,
    createManagementDirectory: createAuthenticationManagementDirectory,
    removeManagementDirectory: removeAuthenticationManagementDirectory,
    cleanupAuthentication: (target, callbacks) =>
      cleanupResources(target, getIsolationSettings(), callbacks),
    acquireProviderHomeLock: acquireProviderHomeLock,
    beginRecovery: beginProviderAuthenticationRecovery,
    setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
    completeRecovery: settleProviderAuthenticationRecovery,
    readResources: readProviderAuthenticationResources,
    recordResource: recordProviderAuthenticationResource,
  });
}

/**
 * 選定済み認証の資源投影を同じ上位記録へ結合する。
 * @responsibility 技術計画を構築せず元の認証操作と投影の相関だけを保持する。
 * @trace ARCH-000010
 * @input provider・action・Home・suffix・proxyToken: 固定技術入力、prepare: 有限試験又は既存Executor。
 * @returns 元認証操作の資源投影、又は準備拒否null。
 * @precondition Provider Homeが既存Ownerで選定済み。
 * @postcondition 任意Docker引数を上位で構築しない。
 * @effect 同Processの既存準備Mapへの結合のみ。
 * @failure Executorの準備拒否はnull。
 * @invariant コピー投影を新しいRecovery記録の準備へ昇格しない。
 * @boundary 上位記録構築とExecutor。
 * @security RecordへCommandやProxy tokenを入れない。
 * @concurrency 同じ認証操作の短命結合だけを保持する。
 */
export function prepareProviderAuthentication(
  provider: Provider,
  action: "status" | "login",
  providerHomeSourcePath: string,
  suffix: string,
  proxyToken: string | null,
  prepare: Dependencies["createAuthentication"] = createExecutor,
  managementDirectory: string,
): RecordProjection<"authentication"> | null {
  const request: ExecutorRequest<"authentication"> = {
    kind: "authentication",
    provider,
    action,
    providerHomeSourcePath,
    suffix,
    proxyToken,
  };
  const authentication = prepare(request, {
    managementDirectory,
    settings: getIsolationSettings(),
  });
  if (!authentication) return null;
  const projection = authentication.recordProjection;
  authenticationPreparations.set(projection, {
    executor: authentication,
    request,
    managementDirectory,
  });
  return projection;
}

/**
 * 各認証技術操作の前後で上位保存を完了する通知を登録する。
 * @responsibility 保存拒否を例外へ変換し次Effectを止める。
 * @trace ARCH-000010
 * @input recovery: 元記録、dependencies: 専用Writer、current: 上位が保持したHome Lockの現在性。
 * @returns 同期void通知だけを持つinterface。
 * @precondition 上位がHome Lockを保持し、通知内で必要保存の現在性を確認する。
 * @postcondition Record保存結果を通知の戻り値にしない。
 * @effect 各通知で既存Intent・Receipt・idleを保存する。
 * @failure 保存拒否は例外で下位へ返す。
 * @invariant Receipt保存失敗後にidleへ進まない。
 * @boundary Executor通知と上位耐久保存。
 * @security 通知に生出力・認証値を受け取らない。
 * @concurrency 通知は保存・読戻し完了後だけreturnする。
 */
function authenticationCallbacks(
  recovery: AuthenticationRecoveryRecord,
  dependencies: Dependencies,
  current: () => boolean,
): ExecutorCallbacks<"authentication"> {
  return {
    onCommandSubmitting: (purpose, resources, key) => {
      if (!current())
        throw Error("provider_authentication_provider_home_lock_lost");
      if (
        !dependencies.setRecoveryCommandState(
          recovery,
          "in_flight",
          purpose,
          resources,
          key,
        )
      )
        throw Error("provider_authentication_command_intent_unconfirmed");
    },
    onResourceIdentified: (key, resources) => {
      if (
        !current() ||
        !dependencies.recordResource(recovery, {
          ...resources,
          event: "identified",
          key,
        })
      )
        throw Error("provider_authentication_resource_receipt_unconfirmed");
    },
    onResourceCreated: (receipt, resources) => {
      if (!current())
        throw Error("provider_authentication_provider_home_lock_lost");
      if (
        !dependencies.recordResource(recovery, {
          ...resources,
          event: "receipt",
          key: receipt.key,
        })
      )
        throw Error("provider_authentication_resource_receipt_unconfirmed");
    },
    onCommandNotIssued: (_purpose, _resources, key) => {
      if (
        !current() ||
        !dependencies.recordResource(recovery, { event: "not_issued", key })
      )
        throw Error("provider_authentication_command_settlement_unconfirmed");
    },
    onCommandCompleted: () => {
      if (!current())
        throw Error("provider_authentication_provider_home_lock_lost");
      if (!dependencies.setRecoveryCommandState(recovery, "idle", null))
        throw Error("provider_authentication_command_settlement_unconfirmed");
    },
  };
}

/**
 * 元認証操作の技術回収へ保存通知を接続する。
 * @responsibility 実体確認や削除を組み立てず、上位で読んだ確定Receipt値を渡す。
 * @trace ARCH-000010
 * @input plan: 元投影、dependencies: 上位保存、authorityLive: 現在Home、recovery: 元記録。
 * @returns 技術回収とProcess終了の個別結果。
 * @precondition 同じ認証操作が準備Mapへ登録済み。
 * @postcondition Homeの解放・settled確定は呼出し元に残す。
 * @effect 下位回収通知で各操作のIntentと終了を保存する。
 * @failure 元結合欠測・終了不明は回収未確認。
 * @invariant 保存成功と技術回収成功を混同しない。
 * @boundary 上位記録とExecutor資源回収。
 * @security 任意Pathや削除命令を渡さない。
 * @concurrency 上位Lockを保持し、必要保存通知内で現在性を確認する。
 */
async function cleanAuthenticationResources(
  plan: RecordProjection<"authentication">,
  dependencies: Dependencies,
  authorityLive: () => boolean,
  recovery: AuthenticationRecoveryRecord,
) {
  if (!authorityLive())
    return { confirmed: false, processCompletionConfirmed: false };
  const authentication = authenticationPreparations.get(plan);
  const observed = dependencies.readResources(recovery);
  if (!authentication || !observed)
    return { confirmed: false, processCompletionConfirmed: false };
  const book = observed.resources;
  // 成功したexact idle読取りだけが、初回Intent前の未要求窓を示す。
  if (book === null)
    return { confirmed: true, processCompletionConfirmed: true };
  let material: Readonly<{
    snapshot: OperationResources["snapshot"];
    cleanup: OperationResources["cleanup"];
  }> = {
    snapshot: {
      resources: book.snapshot.resources.map((resource) => ({
        ...resource,
        request:
          book.checkpoints.find((item) => item.key === resource.key)
            ?.submission !== "intent_saved"
            ? ("not_issued" as const)
            : resource.identity.dockerId === null
              ? ("unknown" as const)
              : ("issued" as const),
      })),
    },
    cleanup: book.cleanup,
  };
  const target = {
    ...book.cleanup,
    resources: material.snapshot,
    managementDirectory: authentication.managementDirectory,
    previouslyAbsent: book.checkpoints
      .filter((item) => item.observation === "absent")
      .map((item) => item.key),
  };
  if (!authorityLive())
    return { confirmed: false, processCompletionConfirmed: true };
  let execution: ReturnType<Dependencies["cleanupAuthentication"]>;
  try {
    execution = dependencies.cleanupAuthentication(target, {
      onCleanupSubmitting: (key) => {
        if (
          !authorityLive() ||
          !dependencies.setRecoveryCommandState(
            recovery,
            "in_flight",
            "remove_" + key,
            material,
            key,
          )
        )
          throw Error("provider_authentication_command_intent_unconfirmed");
      },
      onResourceIdentified: (key, snapshot) => {
        material = { ...material, snapshot };
        if (
          !authorityLive() ||
          !dependencies.recordResource(recovery, {
            ...material,
            event: "identified",
            key,
          })
        )
          throw Error("provider_authentication_resource_receipt_unconfirmed");
      },
      onCleanupCompleted: () => {
        if (
          !authorityLive() ||
          !dependencies.setRecoveryCommandState(recovery, "idle", null)
        )
          throw Error("provider_authentication_command_settlement_unconfirmed");
      },
      onResourcesClosed: (snapshot, observations) => {
        if (
          !authorityLive() ||
          !dependencies.recordResource(recovery, {
            event: "cleanup",
            snapshot,
            observations,
          })
        )
          throw Error("provider_authentication_resource_receipt_unconfirmed");
      },
    });
  } catch {
    // 下位の同期拒否は準備段階。CleanupのProcessはまだ発行されていない。
    return { confirmed: false, processCompletionConfirmed: true };
  }
  let result: Awaited<typeof execution.completion>;
  try {
    result = await execution.completion;
  } catch {
    return { confirmed: false, processCompletionConfirmed: false };
  }
  return {
    confirmed:
      result.cleanup.confirmed &&
      result.notificationDeliveryConfirmed !== false,
    processCompletionConfirmed: result.processTerminationConfirmed,
  };
}

/**
 * 専用Provider Homeで状態確認または公式対話認証を実行する。
 *
 * @responsibility Planの順序実行、対話境界、事後認証確認およびexact cleanupを所有する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Home、stableLogicalHomeBindingHash: Provider Homeの安定Identity、dependencies: Test差替え可能なProcess境界
 * @returns 秘密値や生Provider出力を含まない固定結果を返す。
 * @precondition 選択実行物の同一性を確認し、loginでは呼出し元が対話端末を確保する。
 * @postcondition 認証観測と操作別資源cleanupを別の事実として返し、観測不能を未認証へ丸めない。
 * @effect statusは通信なし・Home読取り専用のDocker確認、loginだけがNetworkと専用HomeのOAuth credentialを変更する。
 * @failure 故障を自動再試行せずcleanup結果付きでblockedへ閉じる。statusの正規未ログインは確認完了と区別する。
 * @invariant Repository、Workspace、host credentialおよびAPI keyを接続しない。
 * @boundary 人間端末、Docker Engine、限定Proxy、選択Provider認証Endpointの外部境界。
 * @security OAuth対話はTTYへ直接接続し、生出力、token、URLまたはPathを結果へ保存しない。
 * @concurrency Docker資源をOperation固有suffixで分離し、終了時にexact nameだけを清掃する。
 */
export async function authenticateProvider(
  provider: Provider,
  action: "status" | "login",
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  dependencies?: Dependencies,
  signal?: AbortSignal,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (action !== "status" && action !== "login")
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_input_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const cancellation = readExecutionCancellation(signal);
  if (cancellation === null)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_signal_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  if (cancellation)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_cancelled",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  let activeDependencies: Dependencies;
  try {
    activeDependencies =
      dependencies ?? createProviderAuthenticationDependencies();
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_docker_boundary_unavailable",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  }
  if (!/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash))
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_provider_home_identity_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const acquisition = activeDependencies.acquireProviderHomeLock(
    stableLogicalHomeBindingHash,
    path.dirname(providerHomeSourcePath),
  );
  if (acquisition.status !== "acquired") {
    if (!acquisition.descriptorClosed)
      poisonExecutionProcessAfterCleanupUnknown();
    const retained =
      acquisition.reference !== null || !acquisition.cleanupConfirmed;
    return Object.freeze({
      status: "blocked",
      reason: !acquisition.descriptorClosed
        ? "provider_authentication_home_lock_descriptor_close_unconfirmed"
        : acquisition.reason === "lock_initialization_failed"
          ? "provider_authentication_home_lock_initialization_failed"
          : "provider_authentication_provider_home_active_or_unknown",
      cleanupConfirmed: acquisition.cleanupConfirmed,
      manualRecoveryRequired: retained,
      processRestartRequired: !acquisition.descriptorClosed,
      providerEffectIssued: false,
    });
  }
  const providerHomeLock = acquisition.lock;
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  let plan: RecordProjection<"authentication"> | null = null;
  let recovery: AuthenticationRecoveryRecord | null = null;
  let managementDirectory: string;
  try {
    const proxyToken =
      action === "login" ? activeDependencies.randomHex(32) : null;
    managementDirectory = authenticationRecoveryRecordPath(
      providerHomeSourcePath,
      provider,
      stableLogicalHomeBindingHash,
    ).replace(/\.json$/u, `.management-${randomBytes(16).toString("hex")}`);
    plan = prepareProviderAuthentication(
      provider,
      action,
      providerHomeSourcePath,
      suffix,
      proxyToken,
      activeDependencies.createAuthentication,
      managementDirectory,
    );
    recovery = plan
      ? createProviderAuthenticationRecoveryRecord(
          providerHomeSourcePath,
          stableLogicalHomeBindingHash,
          plan,
        )
      : null;
    if (!plan || !recovery) throw Error("provider_authentication_plan_invalid");
  } catch (error) {
    let lockReleased = false;
    try {
      lockReleased = providerHomeLock.release();
    } catch {
      /* 解放不明を成功へ変換しない。 */
    }
    return Object.freeze({
      status: "blocked",
      reason:
        error instanceof Error &&
        error.message === "provider_authentication_docker_boundary_unavailable"
          ? error.message
          : "provider_authentication_plan_invalid",
      cleanupConfirmed: lockReleased,
      providerEffectIssued: false,
      manualRecoveryRequired: !lockReleased,
      processRestartRequired: !lockReleased,
    });
  }
  let recoveryState = providerHomeLock.assertLive()
    ? activeDependencies.beginRecovery(recovery)
    : ("unknown" as const);
  if (typeof recoveryState === "object") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_prior_action_active",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recoveryState.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "unknown") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_recovery_inventory_unknown",
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
      reason: "provider_authentication_prior_command_in_flight",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  const management = providerHomeLock.assertLive()
    ? activeDependencies.createManagementDirectory(
        recovery,
        managementDirectory,
      )
    : null;
  if (!management || management.directory !== managementDirectory) {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_management_directory_unconfirmed",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: false,
    });
  }
  const closeManagement = () => {
    try {
      return (
        providerHomeLock.assertLive() &&
        activeDependencies.removeManagementDirectory(management)
      );
    } catch {
      return false;
    }
  };
  const managementCurrent = () =>
    providerHomeLock.assertLive() && management.assertCurrent();
  if (recoveryState === "existing_idle") {
    const recoveryCleanupConfirmed = await cleanAuthenticationResources(
      plan,
      activeDependencies,
      managementCurrent,
      recovery,
    );
    if (
      !recoveryCleanupConfirmed.confirmed ||
      !managementCurrent() ||
      !activeDependencies.completeRecovery(recovery)
    ) {
      if (recoveryCleanupConfirmed.processCompletionConfirmed) {
        closeManagement();
        providerHomeLock.release();
      }
      return Object.freeze({
        status: "blocked",
        reason: "provider_authentication_recovery_unconfirmed",
        cleanupConfirmed: false,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: true,
      });
    }
    recoveryState = managementCurrent()
      ? activeDependencies.beginRecovery(recovery)
      : "unknown";
    if (recoveryState !== "created") {
      closeManagement();
      providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "provider_authentication_recovery_reentry_failed",
        cleanupConfirmed: false,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: false,
      });
    }
  }
  const authentication = authenticationPreparations.get(plan);
  let reason = "provider_authentication_failed_closed";
  let authenticationStatus: "confirmed" | "unconfirmed" | "unknown" = "unknown";
  let authenticationConfirmed = false,
    providerEffectIssued = false;
  let processCompletionUnknown = authentication === undefined;
  let cleanup = { confirmed: false, processCompletionConfirmed: false };
  if (authentication && managementCurrent()) {
    try {
      const started = authentication.executor.start({
        ...(signal ? { signal } : {}),
        callbacks: authenticationCallbacks(
          recovery,
          activeDependencies,
          managementCurrent,
        ),
      });
      if (started.status !== "started") {
        // 開始拒否はDI Effectより前であり、取得済み管理領域の終了を妨げない。
        reason = started.reason;
        processCompletionUnknown = false;
        cleanup = { confirmed: true, processCompletionConfirmed: true };
      } else {
        const result = await started.completion;
        const resourcesSaved =
          result.resourceSnapshot === null ||
          (managementCurrent() &&
            activeDependencies.recordResource(recovery, {
              event: "cleanup",
              snapshot: result.resourceSnapshot,
              observations: result.resourceObservations,
            }));
        cleanup = {
          confirmed: result.cleanupConfirmed && resourcesSaved,
          processCompletionConfirmed: result.processCompletionConfirmed,
        };
        reason = result.reason;
        authenticationStatus = result.authenticationStatus;
        authenticationConfirmed = result.authenticationConfirmed;
        providerEffectIssued = result.providerEffectIssued;
        processCompletionUnknown = !result.processCompletionConfirmed;
      }
    } catch {
      processCompletionUnknown = true;
      reason = "provider_authentication_process_completion_unconfirmed";
    }
  } else if (authentication) {
    reason = "provider_authentication_management_directory_unconfirmed";
    cleanup = { confirmed: false, processCompletionConfirmed: true };
  }
  processCompletionUnknown ||= !cleanup.processCompletionConfirmed;
  let cleanupConfirmed = cleanup.confirmed;
  if (cleanupConfirmed && !processCompletionUnknown) {
    cleanupConfirmed = closeManagement();
    if (!cleanupConfirmed && reason === "provider_authentication_completed")
      reason = "provider_authentication_management_cleanup_unconfirmed";
  }
  const isLockLiveAfterCleanup = providerHomeLock.assertLive();
  if (!isLockLiveAfterCleanup)
    reason = "provider_authentication_provider_home_lock_lost";
  if (cleanupConfirmed && isLockLiveAfterCleanup)
    cleanupConfirmed = activeDependencies.completeRecovery(recovery);
  else cleanupConfirmed = false;
  const lockReleased = !processCompletionUnknown && providerHomeLock.release();
  cleanupConfirmed = cleanupConfirmed && lockReleased;
  if (
    readExecutionCancellation(signal) !== false &&
    reason === "provider_authentication_completed"
  )
    reason = "provider_authentication_cancelled";
  const completed =
    readExecutionCancellation(signal) === false &&
    cleanupConfirmed &&
    (authenticationConfirmed ||
      (action === "status" && authenticationStatus === "unconfirmed"));
  return Object.freeze({
    contract: PROVIDER_AUTHENTICATION_CONTRACT,
    contractRevision: PROVIDER_AUTHENTICATION_CONTRACT_REVISION,
    status: completed ? "completed" : "blocked",
    reason: completed
      ? authenticationConfirmed
        ? "provider_authentication_confirmed"
        : "provider_authentication_unconfirmed"
      : reason,
    provider,
    action,
    offering: getAuthenticationDefinition(provider).offering,
    humanInteractive: action === "login",
    repositoryMounted: false,
    workspaceMounted: false,
    providerEffectIssued,
    authenticationConfirmed,
    authenticationStatus: cleanupConfirmed ? authenticationStatus : "unknown",
    cleanupConfirmed,
    recoveryId: cleanupConfirmed ? null : recovery.recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    effectStateUnknown: !cleanupConfirmed,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

/**
 * 認証対象だけを指定する公開要求。
 * @responsibility Provider固有引数と秘密Pathを利用側へ要求しない。
 * @trace ARCH-000004
 * @shape 対応Provider一項目。
 * @invariant Repository・追加通信先・CLI引数を含めない。
 * @boundary 公開認証操作。
 * @security 認証値を搬送しない。
 * @compatibility 新形式だけを受理する。
 */
export type AuthenticationRequest = Readonly<{
  provider: "codex" | "claude";
}>;

/**
 * 認証要求を検査し、現在Userの専用Homeへ接続する。
 * @responsibility 公開要求から内部のHome観測と認証Lifecycleを一度だけ接続する。
 * @trace ARCH-000004
 * @input action: 固定操作、request: Providerだけの要求、signal: 呼出し元の取消。
 * @returns 秘密値を含まない操作結果。
 * @precondition 実認証前に旧記録の移行確認をフロントAIが完了する。
 * @postcondition 不正要求・取消ではHome観測・Docker操作を発行しない。
 * @effect 検査後だけ既存Home観測と認証操作を呼ぶ。
 * @failure Home不明は停止し、別Provider・Host認証へfallbackしない。
 * @invariant 設定・State・Lock・Retryを新設しない。
 * @boundary 公開要求と現在Userの保護Home。
 * @security Proxy／accessorを実行しない。Host Pathを結果へ複製しない。
 * @concurrency 実行中の排他・取消・終了待機は既存Ownerが所有する。
 */
export async function runProviderAuthenticationRequest(
  action: "status" | "login",
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  const descriptors =
    request &&
    typeof request === "object" &&
    !types.isProxy(request) &&
    Object.getPrototypeOf(request) === Object.prototype
      ? Object.getOwnPropertyDescriptors(request)
      : null;
  const property = descriptors?.provider;
  const provider = property && "value" in property ? property.value : null;
  if (
    !descriptors ||
    Reflect.ownKeys(descriptors).length !== 1 ||
    !property?.enumerable ||
    (provider !== "codex" && provider !== "claude")
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_input_invalid",
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  const cancellation = readExecutionCancellation(signal);
  if (cancellation === null)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_signal_invalid",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  if (cancellation)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_cancelled",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  const observed = inspectWindowsProviderHomeCandidate(provider);
  if (observed.status !== "candidate")
    return Object.freeze({
      status: "blocked",
      reason: observed.reason,
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed:
        observed.processEffectIssued === false &&
        observed.manualRecoveryRequired === false,
      manualRecoveryRequired: observed.manualRecoveryRequired,
      providerEffectIssued: false,
    });
  const home = observed.providerHome;
  return authenticateProvider(
    provider,
    action,
    home.providerHomeSourcePath,
    home.stableLogicalHomeBindingHash,
    undefined,
    signal,
  );
}
