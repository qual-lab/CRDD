/**
 * Coordinatorの現在状態を閉じた保存形式として検証する。
 * @responsibility 固定操作情報、現在資源、未解決回復と結果搬送の構造・相関を所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import { validateDockerHostTransitionLineage } from "../docker-execution/host-transition-state.ts";
import { dockerProcessControllerPublicCompletionReasons } from "../docker-execution/process-controller-result-reasons.ts";
import {
  isSha256Hex,
  parseDockerTaskRecoveryId,
} from "../docker-execution/recovery-identity.ts";
import {
  exactRecordKeys,
  validateHostSnapshot,
} from "../docker-execution/recovery-record-model.ts";
import { parseHostRecoveryToken } from "../host-execution/recovery-record.ts";

export const COORDINATOR_STATE_SCHEMA = "crdd-coordinator/current-state/v1";
const OPERATION_IDENTITY_SCHEMA = "crdd-coordinator/operation-identity/v1";

/**
 * 本番利用側に固定された結果受領方式を返す。
 * @responsibility 一時的な返却と後続再開用の耐久ACKを区別する。
 * @trace ARCH-000008
 * @input consumer: 固定組立てが選択した利用側識別子。
 * @returns transient、durable、または未知利用側のnull。
 * @precondition N/A: 未知値も受け取り拒否する。
 * @postcondition Orchestratorの耐久受領を入力指定で降格しない。
 * @effect N/A: 値の同期判定だけで保存や配送を行わない。
 * @failure 未知識別子・非文字列ではnull。
 * @invariant 受領方式は資源回収やCandidate保全の証明ではない。
 * @boundary 本番組立ての利用側と保存モデルの固定契約。
 * @security Objectの変換・getter・Proxyを評価しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorConsumerCompletionPolicy(
  consumer: unknown,
): "transient" | "durable" | null {
  if (consumer === "orchestrator") return "durable";
  if (consumer === "coordinator_cli" || consumer === "workbench")
    return "transient";
  return null;
}

/**
 * 現在状態の操作IdentityをRepository結合と照合する。
 * @responsibility 旧RuntimeState証明を受け入れず、操作・Home・Host・予定資源の閉じた相関を検査する。
 * @trace ARCH-000008
 * @input value: 保存されたIdentity、nonce: 操作世代、repositoryBinding: 現在Repository結合。
 * @returns 必須項目と相関がすべて成立した場合だけtrue。
 * @precondition Repository結合は外側Snapshotの検証済み入力である。
 * @postcondition 旧形式や追加項目を新Identityとして解釈しない。
 * @effect N/A: 入力の同期検査のみ。
 * @failure 不正な形式・結合・Host相関をfalseとして返す。
 * @invariant Home・Hostの証明をRepository Hashで代替しない。
 * @boundary 保存形式と同一Process内の検査境界。
 * @security 保存Pathは処置許可を付与しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function validateCoordinatorOperationIdentity(
  value: unknown,
  nonce: string,
  repositoryBinding: string,
): boolean {
  const identity = value as Record<string, unknown>;
  const keys = [
    "schema",
    "operationNonce",
    "provider",
    "consumer",
    "operationId",
    "grantRef",
    "profileId",
    "stableLogicalHomeBindingHash",
    "providerHomeIdentityHash",
    "providerHomeProtectionHash",
    "localUserBindingHash",
    "repositoryBinding",
    "ownershipLabel",
    "resources",
    "images",
    "operationMode",
    "workspaceMountMode",
    "initialHostRecoveryId",
    "initialHostRecovery",
    "hostPaths",
  ];
  const hasCorrelation = Object.hasOwn(identity ?? {}, "recoveryCorrelationId");
  if (
    !exactRecordKeys(
      value,
      hasCorrelation ? [...keys, "recoveryCorrelationId"] : keys,
    )
  )
    return false;
  const token = identity.initialHostRecoveryId;
  if (typeof token !== "string") return false;
  try {
    parseHostRecoveryToken(token);
  } catch {
    return false;
  }
  return (
    identity.schema === OPERATION_IDENTITY_SCHEMA &&
    coordinatorConsumerCompletionPolicy(identity.consumer) !== null &&
    identity.operationNonce === nonce &&
    identity.repositoryBinding === repositoryBinding &&
    isSha256Hex(identity.repositoryBinding) &&
    (identity.provider === "codex" || identity.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(String(identity.operationId ?? "")) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(String(identity.grantRef ?? "")) &&
    /^PROFILE-[0-9]{6,}$/u.test(String(identity.profileId ?? "")) &&
    [
      identity.stableLogicalHomeBindingHash,
      identity.providerHomeIdentityHash,
      identity.providerHomeProtectionHash,
      identity.localUserBindingHash,
    ].every(isSha256Hex) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
      String(identity.ownershipLabel ?? ""),
    ) &&
    exactRecordKeys(identity.resources, [
      "auth",
      "provider",
      "proxy",
      "internal",
      "egress",
    ]) &&
    Object.values(identity.resources as Record<string, unknown>).every(
      (item) =>
        typeof item === "string" &&
        /^crdd-(auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u.test(
          item,
        ),
    ) &&
    exactRecordKeys(identity.images, ["provider", "proxy"]) &&
    Object.values(identity.images as Record<string, unknown>).every(
      (item) => typeof item === "string" && /^sha256:[a-f0-9]{64}$/u.test(item),
    ) &&
    ["boolean_probe", "isolated_task", "workbench_advice"].includes(
      String(identity.operationMode),
    ) &&
    (identity.workspaceMountMode === null ||
      identity.workspaceMountMode === "read_only" ||
      identity.workspaceMountMode === "read_write") &&
    (!hasCorrelation ||
      (typeof identity.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          identity.recoveryCorrelationId,
        ))) &&
    validateHostSnapshot(identity.initialHostRecovery, token) &&
    exactRecordKeys(identity.hostPaths, ["root", "marker"]) &&
    typeof (identity.hostPaths as Record<string, unknown>).root === "string" &&
    typeof (identity.hostPaths as Record<string, unknown>).marker === "string"
  );
}
export const MAX_COORDINATOR_STATE_BYTES = 16 * 1024 * 1024;
export const MAX_COORDINATOR_STATE_OPERATIONS = 64;
const purposeResource = {
  create_egress_network: "egress",
  create_internal_network: "internal",
  create_provider: "provider",
  create_proxy: "proxy",
  create_subscription_auth_probe: "auth",
} as const;
const commandPurposes = [
  ...Object.keys(purposeResource),
  "start_subscription_auth_probe_attached",
  "connect_proxy_egress",
  "start_proxy",
  "start_provider_attached",
];
const failureStages = [
  "submission_record",
  "command_restriction",
  "command_start",
  "provider_start_observation",
  "command_wait",
  "execution_classification",
  "resource_receipt_record",
  "subscription_auth_verification",
  "provider_result_normalization",
];
const finalReasons = new Set<string>([
  ...dockerProcessControllerPublicCompletionReasons,
  "provider_operation_completed",
  "provider_operation_cancelled",
]);

/**
 * 一操作の固定情報と更新可能な現在値を分ける。
 * @responsibility 操作相関、全purposeの評価と一次失敗の保持を型境界にする。
 * @trace ARCH-000008
 * @shape identityとそのHash、exact回復ID、phase、resources、host、lease、execution、結果と要約参照。
 * @invariant checkpointの更新でidentityと回復IDを変更しない。
 * @boundary 保存内容からRuntimeの現在観測への接続。
 * @security 保存値は操作・回復Authorityを発行しない。
 * @compatibility 最新形式だけを扱い、旧Directory形式の読取りを行わない。
 */
export type CoordinatorStateOperation = Readonly<{
  identityJson: string;
  identitySha256: string;
  recoveryId: string;
  phase: "executing" | "settling" | "awaiting_delivery";
  resources: readonly Readonly<{
    purpose: keyof typeof purposeResource;
    request:
      | "not_requested"
      | "not_issued"
      | "intent_saved"
      | "issued"
      | "identified"
      | "unknown";
    dockerId: string | null;
    receiptSource: "docker_create_result" | "runtime_reconciliation" | null;
    observation: "unobserved" | "present" | "absent" | "unknown";
    absence: Readonly<{
      recoveryId: string;
      purpose: keyof typeof purposeResource;
      plannedResourceName: string;
      dockerId: string | null;
      evidenceSha256: string;
    }> | null;
  }>[];
  host: Readonly<{
    currentToken: string;
    pendingTransitionJson: string | null;
    cleanup: "not_requested" | "pending" | "confirmed" | "unknown";
  }>;
  lease: "held" | "released" | "unknown";
  execution: Readonly<{
    providerStart: "not_started" | "started" | "unknown";
    externalSend: "not_issued" | "issued" | "unknown";
    sharedWrite: "not_issued" | "possible" | "unknown";
    ownerEffect: "active" | "disabled" | "unknown";
    workspaceReusable: false;
  }>;
  primaryFailure: Readonly<{
    purpose: string | null;
    stage: string;
    reason: string;
    exceptionCode: string | null;
    commandHandleObtained: boolean;
    responseObserved: boolean;
    receiptRecorded: boolean;
  }> | null;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    cleanupConfirmed: boolean;
  }> | null;
  summarySha256: string | null;
  history: Readonly<{
    occurredAt: string;
    lineSha256: string;
    confirmed: boolean;
  }> | null;
}>;

/**
 * Repository一つの未終了集合を保持する。
 * @responsibility 単調改訂、元内容Hash、操作参照と未受理結果を型として分離する。
 * @trace ARCH-000008
 * @shape 固定schema、改訂相関、Repository結合と三つの現在集合。
 * @invariant 履歴や候補本体を現在集合へ蓄積しない。
 * @boundary 保存Ownerと状態利用側。
 * @security JSONは実資源観測やAuthorityの代わりではない。
 * @compatibility 最新schemaのみ。移行はフロントAIが所有する。
 */
export type CoordinatorStateSnapshot = Readonly<{
  schema: typeof COORDINATOR_STATE_SCHEMA;
  revision: number;
  previous: Readonly<{ revision: number; payloadSha256: string }> | null;
  repositoryBinding: string;
  operations: readonly CoordinatorStateOperation[];
  unresolvedRecoveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    reason: string;
    obligations: readonly (
      | "docker_resources"
      | "host_cleanup"
      | "lease_release"
      | "result_delivery"
    )[];
  }>[];
  pendingDeliveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    resultId: string;
    consumer: "orchestrator";
    acceptanceSha256: string | null;
  }>[];
}>;

/**
 * 宣言したJSON値を再帰的なkey順序で一意に符号化する。
 * @responsibility 不正型・accessor・Proxy・過剰深度を拒否し、配列順は保持する。
 * @trace ARCH-000008
 * @input value: 保存候補のplain JSON値、depth: 内部再帰深度。
 * @returns sorted-key JSON本文。
 * @precondition N/A: 不正値も受け取り拒否する。
 * @postcondition 同じ値のobject key順に依存しない本文を返す。
 * @effect N/A: メモリ内の値だけを扱う。
 * @failure 不正型、循環・過剰深度、accessorとProxyでは例外。
 * @invariant 配列の意味順序は並べ替えない。
 * @boundary 呼出し側の値と保存byte列。
 * @security getterやProxy trapを評価しない。
 * @concurrency N/A: 同期の値変換で共有状態を更新しない。
 */
export function encodeCoordinatorStateValue(value: unknown, depth = 0): string {
  if (depth > 32 || types.isProxy(value))
    throw new Error("coordinator_state_value_invalid");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (!value || typeof value !== "object")
    throw new Error("coordinator_state_value_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    Object.values(descriptors).some((d) => !Object.hasOwn(d, "value"))
  )
    throw new Error("coordinator_state_value_invalid");
  if (Array.isArray(value)) {
    if (
      keys.length !== value.length + 1 ||
      !Object.hasOwn(descriptors, "length")
    )
      throw new Error("coordinator_state_value_invalid");
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor) throw new Error("coordinator_state_value_invalid");
      items.push(encodeCoordinatorStateValue(descriptor.value, depth + 1));
    }
    return `[${items.join(",")}]`;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error("coordinator_state_value_invalid");
  return `{${Object.keys(descriptors)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${encodeCoordinatorStateValue(descriptors[key]?.value, depth + 1)}`,
    )
    .join(",")}}`;
}

/**
 * 現在状態と固定情報に使用する内容Hashを導出する。
 * @responsibility 宣言したsorted-key UTF-8本文と一つのLFへ結合する。
 * @trace ARCH-000008
 * @input value: plain JSON値。
 * @returns 内容のSHA-256。
 * @precondition 値が固定encodingで表現可能。
 * @postcondition objectの挿入順に依存しない。
 * @effect N/A: メモリ内のHash計算だけ。
 * @failure 不正値はencoderの例外を返す。
 * @invariant 可変SnapshotのHashと固定操作情報のHashを混同しない。
 * @boundary 保存内容の相関。
 * @security HashをAuthorityとして発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function coordinatorStateContentHash(value: unknown): string {
  return createHash("sha256")
    .update(`${encodeCoordinatorStateValue(value)}\n`, "utf8")
    .digest("hex");
}

/**
 * 一回確定した操作Identityを最新Snapshotの次版へ追加する。
 * @responsibility 初回checkpointと元版Hashを構成し、既存操作・回復・搬送を保持する。
 * @trace ARCH-000008
 * @input currentBytes: 確認済み元本文または初回null、identityJson: 確定基本情報、repositoryBinding: 検証済み結合。
 * @returns 構造と遷移を検査した次版のbyte列、またはnull。
 * @precondition 呼出し元がHome Leaseを保持し、初期Hostと操作Ownerを確認している。
 * @postcondition 同じIdentityを再追加せず、他操作の現在値を変更しない。
 * @effect N/A: メモリ内の候補構築だけ。保存・Host遷移・Docker要求は発行しない。
 * @failure 不正本文、重複Identity、上限または元版不一致はnull。
 * @invariant null元版は初回Authorityを意味せず、Writerで新品領域を別確認する。
 * @boundary 固定Operation情報とRepository現在Snapshot。
 * @security JSONからAuthorityを発行せず、秘密や追加Pathを生成しない。
 * @concurrency 元版Hashを保持し、競合時に盲目的な再試行をしない。
 */
export function prepareCoordinatorStateOperationSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const identitySha256 = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const recoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${identity.operationNonce}.${identitySha256}`;
    const operation: CoordinatorStateOperation = {
      identityJson,
      identitySha256,
      recoveryId,
      phase: "executing",
      resources: (
        Object.keys(purposeResource) as (keyof typeof purposeResource)[]
      ).map((purpose) => ({
        purpose,
        request: "not_requested",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      })),
      host: {
        currentToken: identity.initialHostRecoveryId,
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      lease: "held",
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "active",
        workspaceReusable: false,
      },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    const operations = [...(current?.snapshot.operations ?? []), operation];
    operations.sort((left, right) => {
      const a =
        parseDockerTaskRecoveryId(left.recoveryId)?.operationNonce ?? "";
      const b =
        parseDockerTaskRecoveryId(right.recoveryId)?.operationNonce ?? "";
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const next: CoordinatorStateSnapshot = {
      schema: COORDINATOR_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
      pendingDeliveries: current?.snapshot.pendingDeliveries ?? [],
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ回復参照の指定checkpointだけを次のSnapshotへ接続する。
 *
 * @responsibility 要求前・発行後・作成結果と現在観測の構造的な遷移を保存候補へ搬送する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文。recoveryId: exact参照。resourceValue: 完全評価。repositoryBinding: 検証済み結合。kind: 資源・Host・実行終端の固定種別。
 * @returns 遷移検査済みの次版byte列、またはnull。
 * @precondition 現在観測と要求の発行事実は呼出し側の実行境界で取得する。
 * @postcondition 指定したcheckpoint以外を保持し、一次失敗・確定結果の不許可更新を拒否する。
 * @effect N/A: 純粋な値変換だけ。保存やDocker要求を発行しない。
 * @failure 不正値・別参照・不正遷移・改訂上限をnullで拒否する。
 * @invariant unknownを成功や再発行許可に変換せず、既知の作成Identityを置換しない。
 * @boundary 実行境界の観測値と固定Snapshotの間。
 * @security 保存値から実資源不存在やAuthorityを推定しない。
 * @concurrency 元版相関を保持し、Writerで競合確認と排他を行う。
 */
function prepareCoordinatorStateOperationCheckpoint(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
  kind: "resource" | "host" | "lifecycle",
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const resource = JSON.parse(encodeCoordinatorStateValue(resourceValue));
    const operation = current.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      (kind === "resource" &&
        !operation.resources.some(
          (item) => item.purpose === resource?.purpose,
        )) ||
      (kind === "lifecycle" &&
        !exactRecordKeys(resource, [
          "phase",
          "lease",
          "execution",
          "primaryFailure",
          "outcome",
          "summarySha256",
        ]))
    )
      return null;
    if (
      kind === "lifecycle" &&
      resource.summarySha256 !== operation.summarySha256
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : {
              ...item,
              ...(kind === "lifecycle" ? resource : {}),
              host: kind === "host" ? resource : item.host,
              resources:
                kind !== "resource"
                  ? item.resources
                  : item.resources.map((before) =>
                      before.purpose === resource.purpose ? resource : before,
                    ),
            },
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一資源の評価だけを次版へ搬送する。
 *
 * @responsibility 固定資源purposeと現在操作のcheckpointを相関する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。resourceValue: 一資源評価。repositoryBinding: 現在結合。
 * @returns 遷移検査済みの次版、またはnull。
 * @precondition 評価は実行Ownerが取得する。
 * @postcondition 他資源とHost・結果は変更しない。
 * @effect N/A: 純粋な値変換だけ。
 * @failure 不正値、別参照・結合と不許可遷移を拒否する。
 * @invariant ID・要求の既知事実を消さない。
 * @boundary 実行評価と保存候補。
 * @security 値変換を資源観測やAuthorityへ昇格しない。
 * @concurrency 元版Hashを保持し、Writerで競合照合する。
 */
export function prepareCoordinatorStateResourceSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    resourceValue,
    repositoryBinding,
    "resource",
  );
}

/**
 * Hostの処置前記録と観測済み次世代を次版へ搬送する。
 *
 * @responsibility 保存済み遷移意図を経ない世代変更と未確定意図の消去を拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。hostValue: Host現在評価。repositoryBinding: 現在結合。
 * @returns lineageと改訂遷移を検査した次版、またはnull。
 * @precondition Hostの実体、処置と受理結果は既存Host Ownerが確認する。
 * @postcondition 同じ操作のHostだけを更新し、他checkpointを保持する。
 * @effect N/A: 値変換のみ。Host処置や保存は行わない。
 * @failure 別世代、処置前記録欠測、不正本文と不許可遷移はnull。
 * @invariant 処置前意図から完了を推定せず、unknownを成功へ丸めない。
 * @boundary Host Ownerの確定記録とSnapshot候補。
 * @security Host TokenとJSONを処置Authorityとして扱わない。
 * @concurrency 元版相関を保持し、実保存時に再照合を要求する。
 */
export function prepareCoordinatorStateHostSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  hostValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    hostValue,
    repositoryBinding,
    "host",
  );
}

/**
 * 実行・Lease・一次失敗・最終結果の現在評価を次版へ搬送する。
 *
 * @responsibility 実行checkpointの閉じたfield集合を更新し、固定Identity・資源・Hostを保持する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。lifecycleValue: 固定六fieldの現在評価。repositoryBinding: 現在結合。
 * @returns 既知事実保持と改訂遷移を検査した次版、またはnull。
 * @precondition 実行とLeaseの現在事実は各Ownerが取得している。
 * @postcondition 一次失敗・確定結果・要約Hashの上書きと既知Effectの未発行化を拒否する。
 * @effect N/A: 値変換だけ。Provider実行・Lease操作・保存は行わない。
 * @failure 未評価field、不正値、別結合と不許可遷移はnull。
 * @invariant 過去unknownを未発行へ戻さず、後続回収で最初の失敗を消さない。
 * @boundary 実行Ownerの現在評価とSnapshot保存候補。
 * @security 保存結果を資源不存在、Authority失効やLease解放の実証にしない。
 * @concurrency 元版Hashへ結合し、Writerの排他とfresh照合を要求する。
 */
export function prepareCoordinatorStateLifecycleSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  lifecycleValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    lifecycleValue,
    repositoryBinding,
    "lifecycle",
  );
}

/**
 * 五資源の回収観測を同じ改訂版へまとめる。
 *
 * @responsibility 未要求、exact IDの不存在と観測不能を区別して保存候補へ接続する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。observationsValue: 固定五資源の回収結果。repositoryBinding: 現在結合。
 * @returns 全資源の相関と遷移が成立する次版、またはnull。
 * @precondition 呼出し側が現在の回収結果を実行Ownerから取得している。
 * @postcondition 全五資源を一回の改訂で更新し、他操作とHost・実行結果を保持する。
 * @effect N/A: 値変換だけ。資源削除や保存は行わない。
 * @failure 欠測、重複、別名・別ID、未要求の偽装と不正遷移を拒否する。
 * @invariant ID未確定の不存在を通常回収の成立へ昇格しない。
 * @boundary 回収Ownerの観測と現在状態の保存候補。
 * @security 観測のHashは相関用であり、実不存在やAuthorityの証明ではない。
 * @concurrency 全結果を同じ元版へ結合し、物理Writerの競合照合を要求する。
 */
export function prepareCoordinatorStateCleanupSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const observations = JSON.parse(
      encodeCoordinatorStateValue(observationsValue),
    );
    const operation = current.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (!operation || !Array.isArray(observations) || observations.length !== 5)
      return null;
    const identity = JSON.parse(operation.identityJson);
    const resources = operation.resources.map((resource, index) => {
      const observed = observations[index];
      if (
        !exactRecordKeys(observed, [
          "purpose",
          "plannedResourceName",
          "dockerId",
          "observation",
        ]) ||
        observed.purpose !== resource.purpose ||
        observed.plannedResourceName !==
          identity.resources[purposeResource[resource.purpose]] ||
        observed.dockerId !== resource.dockerId ||
        !["not_requested", "absent", "unknown"].includes(observed.observation)
      )
        throw new Error("coordinator_state_cleanup_invalid");
      if (observed.observation === "not_requested") {
        if (
          !["not_requested", "not_issued"].includes(resource.request) ||
          resource.dockerId !== null
        )
          throw new Error("coordinator_state_cleanup_invalid");
        return resource;
      }
      if (
        ["not_requested", "not_issued"].includes(resource.request) ||
        (observed.observation === "absent" && resource.request !== "identified")
      )
        throw new Error("coordinator_state_cleanup_invalid");
      return {
        ...resource,
        observation: observed.observation,
        absence:
          observed.observation === "absent"
            ? {
                recoveryId,
                purpose: resource.purpose,
                plannedResourceName: observed.plannedResourceName,
                dockerId: resource.dockerId,
                evidenceSha256: createHash("sha256")
                  .update(
                    encodeCoordinatorStateValue({
                      recoveryId,
                      previousPayloadSha256: current.payloadSha256,
                      observation: observed,
                    }),
                  )
                  .digest("hex"),
              }
            : null,
      };
    });
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation ? { ...item, resources } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ操作の回収義務と結果受理checkpointを次版へ搬送する。
 *
 * @responsibility 他操作を保持し、exact回復参照と結果Identityを現在集合へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。referencesValue: recoveryとdeliveries。repositoryBinding: 現在結合。
 * @returns 構造・相関・遷移を確認した次版、またはnull。
 * @precondition 義務と耐久受理根拠は各Ownerが取得する。
 * @postcondition 同じ操作の参照だけを更新し、未確定の削除と受理Hashの巻戻しを拒否する。
 * @effect N/A: 純粋な値変換。搬送・受理・削除は発行しない。
 * @failure 不正入力、他操作参照、既知結果変更と不許可除去はnull。
 * @invariant 受理記録の存在を実受理へ読み替えず、未解決義務を期限で消さない。
 * @boundary 終端・Consumer Ownerと現在状態の参照集合。
 * @security 回復参照を新Authorityや外部への開示許可にしない。
 * @concurrency 元版Hashに結合し、Writerの競合確認を要求する。
 */
export function prepareCoordinatorStateReferencesSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  referencesValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    const nonce = parseDockerTaskRecoveryId(recoveryId)?.operationNonce;
    const references = JSON.parse(encodeCoordinatorStateValue(referencesValue));
    if (
      !operation ||
      !nonce ||
      !exactRecordKeys(references, ["recovery", "deliveries"]) ||
      !Array.isArray(references.deliveries)
    )
      return null;
    const recovery = references.recovery;
    if (
      (recovery !== null &&
        (recovery.operationNonce !== nonce ||
          recovery.recoveryId !== recoveryId)) ||
      references.deliveries.some(
        (delivery: { operationNonce: unknown; recoveryId: unknown } | null) =>
          !delivery ||
          delivery.operationNonce !== nonce ||
          delivery.recoveryId !== recoveryId,
      )
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      unresolvedRecoveries: [
        ...current.snapshot.unresolvedRecoveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...(recovery === null ? [] : [recovery]),
      ].sort((a, b) =>
        a.operationNonce < b.operationNonce
          ? -1
          : a.operationNonce > b.operationNonce
            ? 1
            : 0,
      ),
      pendingDeliveries: [
        ...current.snapshot.pendingDeliveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...references.deliveries,
      ].sort((a, b) => {
        const first = `${a.operationNonce}:${a.consumer}`;
        const second = `${b.operationNonce}:${b.consumer}`;
        return first < second ? -1 : first > second ? 1 : 0;
      }),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存済み操作から終了要約の候補内容だけを導出する。
 * @responsibility 相関、一次失敗、最終結果と清掃状態を上書きせず要約へ分離する。
 * @trace ARCH-000008
 * @input currentBytes: 正規Snapshot、recoveryId: exact対象、repositoryBinding: 検証済み結合。
 * @returns 正規要約本文、要約Hashと導出元Hash、またはnull。
 * @precondition 対象は実行中でなく最終結果が保存されている。
 * @postcondition 元Snapshotを変更せず、固定・履歴保存の許可を発行しない。
 * @effect N/A: メモリ内の導出だけ。
 * @failure 不正Snapshot、別対象、未確定結果、確定要約との不一致はnull。
 * @invariant 一次失敗と清掃不明を保持し、返却値を要約固定・保存・操作除去の許可にしない。
 * @boundary 現在状態から非Authorityの終了履歴内容。
 * @security 任意要約、任意Path、外部出力や回復権限を受けない。
 * @concurrency 導出元Hashを返し、物理Writerで元版の再照合を要求する。
 */
export function prepareCoordinatorStateHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Readonly<{
  summaryBytes: Buffer;
  summarySha256: string;
  sourcePayloadSha256: string;
}> | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (!operation || operation.phase === "executing" || !operation.outcome)
      return null;
    const summaryBytes = coordinatorOperationSummaryBytes(operation);
    const summarySha256 = createHash("sha256")
      .update(summaryBytes)
      .digest("hex");
    if (
      operation.summarySha256 !== null &&
      operation.summarySha256 !== summarySha256
    )
      return null;
    return Object.freeze({
      summaryBytes,
      summarySha256,
      sourcePayloadSha256: current.payloadSha256,
    });
  } catch {
    return null;
  }
}

/**
 * 固定済み終端要約を結果IDとして必要搬送先を登録する候補を作る。
 *
 * @responsibility 結果本文を既存操作要約へ限定し、時刻・File Identity・全体改訂を結果IDから除外する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、consumersValue: 必要搬送先、repositoryBinding: 現在結合。
 * @returns 同じ結果を未受理で登録する次版、同じ登録の元版、またはnull。
 * @precondition 終端要約Hashは真正終端Writerが固定済みである。
 * @postcondition 再登録で受理を巻き戻さず、結果・必要集合を差し替えない。
 * @effect N/A: メモリ内候補の構築だけ。
 * @failure 未終端・未固定、保存Consumerと異なる集合・重複・未知Consumerを拒否する。
 * @invariant 候補生成を実清掃・Consumer受理・保存成立へ昇格しない。
 * @boundary 終端要約と現在状態の結果搬送集合。
 * @security 任意結果本文・Path・受理Hashを受け付けない。
 * @concurrency 元版と真正終端の共同照合は物理Writerが行う。
 */
export function prepareCoordinatorStateResultDeliverySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  consumersValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const summary = prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    const consumers = JSON.parse(encodeCoordinatorStateValue(consumersValue));
    const identity = operation ? JSON.parse(operation.identityJson) : null;
    const requiredConsumers =
      identity?.consumer === "orchestrator" ? ["orchestrator"] : [];
    if (
      !current ||
      !summary ||
      !operation ||
      operation.summarySha256 !== summary.summarySha256 ||
      operation.outcome?.cleanupConfirmed !== true ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      operation.resources.some(
        (item) =>
          item.request !== "not_requested" &&
          item.request !== "not_issued" &&
          (item.request !== "identified" || item.observation !== "absent"),
      ) ||
      !Array.isArray(consumers) ||
      encodeCoordinatorStateValue(consumers) !==
        encodeCoordinatorStateValue(requiredConsumers)
    )
      return null;
    const nonce = identity.operationNonce;
    if (requiredConsumers.length === 0)
      return Buffer.from(currentBytes as Buffer);
    const existingEntries = current.snapshot.pendingDeliveries.filter(
      (item) => item.operationNonce === nonce,
    );
    if (existingEntries.length !== 0) {
      return existingEntries.length === consumers.length &&
        existingEntries.every(
          (item, index) =>
            item.consumer === consumers[index] &&
            item.resultId === summary.summarySha256 &&
            item.recoveryId === recoveryId,
        )
        ? Buffer.from(currentBytes as Buffer)
        : null;
    }
    return prepareCoordinatorStateReferencesSnapshot(
      currentBytes,
      recoveryId,
      {
        recovery:
          current.snapshot.unresolvedRecoveries.find(
            (item) => item.operationNonce === nonce,
          ) ?? null,
        deliveries: consumers.map((consumer) => ({
          operationNonce: nonce,
          recoveryId,
          resultId: summary.summarySha256,
          consumer,
          acceptanceSha256: null,
        })),
      },
      repositoryBinding,
    );
  } catch {
    return null;
  }
}

/**
 * 固定十一項目の上位受理本文を同じRepositoryへ照合する。
 * @responsibility 受理候補と整理済み観測で同じ値契約を使用する。
 * @trace ARCH-000008
 * @input value: 固定上位Readerの本文、repositoryBinding: 現在Repository結合。
 * @returns 正規JSONの受理本文、またはnull。
 * @precondition 上位の実保存と現在Attemptの照合は上位Readerが所有する。
 * @postcondition 旧形式・追加項目・別Repositoryを受理しない。
 * @effect N/A: メモリ内の符号化と検証だけ。
 * @failure 不正値・accessor・Proxy・分類不一致はnull。
 * @invariant 本文の妥当性を耐久保存や処置Authorityへ昇格しない。
 * @boundary 上位受理の固定値契約。
 * @security 自由本文・Path・秘密値を許可しない。
 * @concurrency N/A: 同期の値検査だけ。
 */
export function decodeCoordinatorProjectAcceptance(
  value: unknown,
  repositoryBinding: unknown,
) {
  try {
    const acknowledgement = JSON.parse(encodeCoordinatorStateValue(value));
    if (
      !exactRecordKeys(acknowledgement, [
        "repositoryBindingId",
        "projectId",
        "milestoneId",
        "taskId",
        "attemptId",
        "operationId",
        "recoveryId",
        "settlementGeneration",
        "repositoryBinding",
        "resultId",
        "consumer",
      ]) ||
      acknowledgement.consumer !== "orchestrator" ||
      acknowledgement.repositoryBinding !== repositoryBinding ||
      !isSha256Hex(acknowledgement.repositoryBinding) ||
      !isSha256Hex(acknowledgement.resultId) ||
      !Number.isSafeInteger(acknowledgement.settlementGeneration) ||
      acknowledgement.settlementGeneration < 1 ||
      [
        "repositoryBindingId",
        "projectId",
        "milestoneId",
        "taskId",
        "attemptId",
        "operationId",
        "recoveryId",
      ].some(
        (key) =>
          typeof acknowledgement[key] !== "string" ||
          acknowledgement[key].length === 0 ||
          acknowledgement[key].length > 1024,
      )
    )
      return null;
    return acknowledgement;
  } catch {
    return null;
  }
}

/**
 * 保存済み上位受理本文から一搬送の受理候補を導出する。
 * @responsibility 十一項目の閉集合と固定結果の相関、初回受理Hashの不変性を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、acknowledgementValue: 上位Readerの受理本文、repositoryBinding: 現在結合。
 * @returns 対象一搬送だけを受理する次版、同じ受理の元版、またはnull。
 * @precondition 物理Writerが上位保存・排他解放・fresh読戻しを別途確認する。
 * @postcondition 他搬送・回復義務・操作を維持し、初回受理を差し替えない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 旧形式、追加項目、別結合・結果・操作、未登録搬送と受理差替えはnull。
 * @invariant 候補生成や入力Hashを実保存・受理Authorityへ昇格しない。
 * @boundary 上位受理本文と下位の固定結果搬送。
 * @security Path、時刻、File Identity、自己Hashを本文へ混ぜない。
 * @concurrency 更新排他内のfresh上位読戻しと元版照合は物理Writerが所有する。
 */
export function prepareCoordinatorStateProjectAcceptanceSnapshot(
  currentBytes: unknown,
  acknowledgementValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const acknowledgement = decodeCoordinatorProjectAcceptance(
      acknowledgementValue,
      repositoryBinding,
    );
    if (!acknowledgement) return null;
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item) => item.recoveryId === acknowledgement.recoveryId,
    );
    const identity = operation ? JSON.parse(operation.identityJson) : null;
    if (
      !current ||
      !operation ||
      (identity.recoveryCorrelationId ?? identity.operationId) !==
        acknowledgement.operationId
    )
      return null;
    const deliveries = current.snapshot.pendingDeliveries.filter(
      (item) => item.recoveryId === acknowledgement.recoveryId,
    );
    const registered = prepareCoordinatorStateResultDeliverySnapshot(
      currentBytes,
      acknowledgement.recoveryId,
      deliveries.map((item) => item.consumer),
      repositoryBinding,
    );
    const target = deliveries.find((item) => item.consumer === "orchestrator");
    if (
      !registered?.equals(currentBytes as Buffer) ||
      !target ||
      target.resultId !== acknowledgement.resultId
    )
      return null;
    const acceptanceSha256 = createHash("sha256")
      .update(`${encodeCoordinatorStateValue(acknowledgement)}\n`, "utf8")
      .digest("hex");
    if (target.acceptanceSha256 !== null)
      return target.acceptanceSha256 === acceptanceSha256
        ? Buffer.from(currentBytes as Buffer)
        : null;
    return prepareCoordinatorStateReferencesSnapshot(
      currentBytes,
      acknowledgement.recoveryId,
      {
        recovery:
          current.snapshot.unresolvedRecoveries.find(
            (item) => item.recoveryId === acknowledgement.recoveryId,
          ) ?? null,
        deliveries: deliveries.map((item) =>
          item === target ? { ...item, acceptanceSha256 } : item,
        ),
      },
      repositoryBinding,
    );
  } catch {
    return null;
  }
}

/**
 * 検証済み操作の要約本文を一意に符号化する。
 * @responsibility 内容Hashと履歴行Hashの共通の内容投影を所有する。
 * @trace ARCH-000008
 * @input operation: 復号済み操作。
 * @returns 正規UTF-8本文と末尾LF。
 * @precondition 呼出し元が操作構造を検証する。
 * @postcondition history確認情報とPathを本文へ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正JSON値は例外。
 * @invariant 確認済み更新で履歴行の内容を変えない。
 * @boundary 現在状態と要約内容。
 * @security 非Authorityの内容だけを返す。
 * @concurrency N/A: 保存を行わない。
 */
function coordinatorOperationSummaryBytes(
  operation: CoordinatorStateOperation,
): Buffer {
  const identity = JSON.parse(operation.identityJson);
  return Buffer.from(
    `${encodeCoordinatorStateValue({
      schema: "crdd-coordinator/operation-summary/v2",
      operationId: identity.operationId,
      operationNonce: identity.operationNonce,
      recoveryId: operation.recoveryId,
      identitySha256: operation.identitySha256,
      primaryFailure: operation.primaryFailure,
      execution: operation.execution,
      outcome: operation.outcome,
      hostCleanup: operation.host.cleanup,
      lease: operation.lease,
    })}\n`,
  );
}

/**
 * 固定した要約時刻を含む履歴行を符号化する。
 * @responsibility 確認状態を除外したexact行Identityを所有する。
 * @trace ARCH-000008
 * @input operation: 検証済み操作、occurredAt: 最初の正規UTC時刻。
 * @returns 履歴行の正規本文。
 * @precondition 時刻と操作内容を呼出し元で確認する。
 * @postcondition confirmedを行Hashへ含めない。
 * @effect N/A: メモリ内の符号化。
 * @failure 不正内容は例外。
 * @invariant 再入場の現在時刻で行を再生成しない。
 * @boundary 操作の終了要約と時刻込み履歴行。
 * @security 生出力やPathを追加しない。
 * @concurrency N/A: 保存を行わない。
 */
function coordinatorHistoryLineBytes(
  operation: CoordinatorStateOperation,
  occurredAt: string,
): Buffer {
  return Buffer.from(
    `${encodeCoordinatorStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt,
      summary: JSON.parse(
        coordinatorOperationSummaryBytes(operation).toString("utf8"),
      ),
    })}\n`,
  );
}

/**
 * 保存済みcheckpointから同じ終了履歴行を導出する。
 * @responsibility 要約・初回時刻とexact行Hashの共通符号化を履歴Writerへ渡す。
 * @trace ARCH-000008
 * @input currentBytes: 現在状態、recoveryId: 対象、repositoryBinding: 検証済み結合。
 * @returns 正規UTF-8行と末尾LF、またはnull。
 * @precondition 対象の要約と初回時刻がcheckpointへ固定済みである。
 * @postcondition 確認状態を行へ含めず、初回と確認済みで同じ本文を返す。
 * @effect N/A: メモリ内の検証と符号化だけ。
 * @failure 未固定、別対象、不正状態や行Hash不一致はnull。
 * @invariant 行の導出を物理保存、終端確認、削除許可にしない。
 * @boundary 現在状態の固定相関と履歴保存の値境界。
 * @security 任意の履歴本文、Path、秘密値を受けない。
 * @concurrency 保存と元版の再照合は物理Writerが所有する。
 */
export function prepareCoordinatorStateHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (value) => value.recoveryId === recoveryId,
  );
  if (!operation?.history) return null;
  const bytes = coordinatorHistoryLineBytes(
    operation,
    operation.history.occurredAt,
  );
  return createHash("sha256").update(bytes).digest("hex") ===
    operation.history.lineSha256
    ? bytes
    : null;
}

/**
 * 一次失敗の固定分類を現在状態と履歴で共用する。
 * @responsibility 失敗の相関と許可分類を一つの値検査で維持する。
 * @trace ARCH-000008
 * @input value: JSONから得た一次失敗またはnull。
 * @returns 固定契約に適合する場合だけtrue。
 * @precondition Proxyやaccessorは上位のJSON境界で除外済み。
 * @postcondition 未知分類やreceiptだけの成功を拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure 不正shapeと分類はfalse。
 * @invariant 一次失敗を清掃結果で上書きしない。
 * @boundary 保存JSONの共通検証。
 * @security 自由な例外本文やPathを許可しない。
 * @concurrency N/A: 同期処理だけ。
 */
function validCoordinatorPrimaryFailure(value: unknown): boolean {
  if (value === null) return true;
  if (
    !exactRecordKeys(value, [
      "purpose",
      "stage",
      "reason",
      "exceptionCode",
      "commandHandleObtained",
      "responseObserved",
      "receiptRecorded",
    ])
  )
    return false;
  const failure = value as NonNullable<
    CoordinatorStateOperation["primaryFailure"]
  >;
  return (
    (failure.purpose === null || commandPurposes.includes(failure.purpose)) &&
    failureStages.includes(failure.stage) &&
    finalReasons.has(failure.reason) &&
    (failure.exceptionCode === null ||
      [
        "ENOENT",
        "EACCES",
        "EPERM",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "EPIPE",
        "unclassified_exception",
      ].includes(failure.exceptionCode) ||
      /^docker_effect_(management_required|plan_invalid|plan_replaced|command_not_owned|platform_unsupported|cli_untrusted|cli_replaced|path_invalid|config_invalid|config_replaced|filesystem_identity_invalid)$/u.test(
        failure.exceptionCode,
      ) ||
      /^owned_operation_(management_binding_required|unknown_child|child_replaced|mount_replaced)$/u.test(
        failure.exceptionCode,
      )) &&
    [
      failure.commandHandleObtained,
      failure.responseObserved,
      failure.receiptRecorded,
    ].every((isObservedFlag) => typeof isObservedFlag === "boolean") &&
    (!failure.receiptRecorded || failure.responseObserved)
  );
}

/**
 * 最終結果の相関を現在状態と履歴で共用する。
 * @responsibility 状態、固定理由、清掃評価の組合せを維持する。
 * @trace ARCH-000008
 * @input value: JSONから得た最終結果またはnull。
 * @returns 固定契約に適合する場合だけtrue。
 * @precondition JSON値境界で検査する。
 * @postcondition 成功・取消理由と状態の不一致を拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure 不正shapeと相関はfalse。
 * @invariant 清掃評価を状態だけから推定しない。
 * @boundary 保存JSONの共通検証。
 * @security 固定理由以外の本文を許可しない。
 * @concurrency N/A: 同期処理だけ。
 */
function validCoordinatorOutcome(value: unknown): boolean {
  if (value === null) return true;
  if (!exactRecordKeys(value, ["status", "reason", "cleanupConfirmed"]))
    return false;
  const outcome = value as NonNullable<CoordinatorStateOperation["outcome"]>;
  return (
    typeof outcome.cleanupConfirmed === "boolean" &&
    finalReasons.has(outcome.reason) &&
    (outcome.status === "completed"
      ? outcome.reason === "provider_operation_completed"
      : outcome.status === "cancelled"
        ? outcome.reason === "provider_operation_cancelled"
        : outcome.status === "blocked" &&
          ![
            "provider_operation_completed",
            "provider_operation_cancelled",
          ].includes(outcome.reason))
  );
}

/**
 * 終了履歴を全行検査し、exact行の相関だけを返す。
 * @responsibility 破損、部分行、重複、未知値を期間整理へ渡さない。
 * @trace ARCH-000008
 * @input bytes: 固定履歴Fileから安定読取りしたUTF-8本文。
 * @returns 正規行・時刻・回復参照・両Hashの不変集合、またはnull。
 * @precondition File実体とRootは物理Ownerが確認する。
 * @postcondition 全行を検証するまで部分結果を返さない。
 * @effect N/A: メモリ内の復号と検査だけ。
 * @failure 容量超過、不正UTF-8、部分行、未知Schema、重複はnull。
 * @invariant 容量・破損を行削除で解消せず、履歴をAuthorityへ昇格しない。
 * @boundary 終了履歴の値契約と物理Writer。
 * @security 自由本文、秘密値、任意Pathを許可しない。
 * @concurrency 元Fileと元状態の再照合は物理Ownerが行う。
 */
export function decodeCoordinatorHistoryRows(bytes: unknown) {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_COORDINATOR_STATE_BYTES)
      return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!Buffer.from(text, "utf8").equals(bytes)) return null;
    if (text === "") return Object.freeze([]);
    if (!text.endsWith("\n")) return null;
    const seen = new Set<string>();
    const rows = text
      .slice(0, -1)
      .split("\n")
      .map((line) => {
        const row = JSON.parse(line);
        const summary = row?.summary;
        if (
          !exactRecordKeys(row, ["schema", "occurredAt", "summary"]) ||
          row.schema !== "crdd-coordinator/history-row/v2" ||
          typeof row.occurredAt !== "string" ||
          !Number.isFinite(Date.parse(row.occurredAt)) ||
          new Date(Date.parse(row.occurredAt)).toISOString() !==
            row.occurredAt ||
          `${encodeCoordinatorStateValue(row)}\n` !== `${line}\n` ||
          !exactRecordKeys(summary, [
            "schema",
            "operationId",
            "operationNonce",
            "recoveryId",
            "identitySha256",
            "primaryFailure",
            "execution",
            "outcome",
            "hostCleanup",
            "lease",
          ]) ||
          summary.schema !== "crdd-coordinator/operation-summary/v2" ||
          typeof summary.operationId !== "string" ||
          !/^OP-[0-9]{6,}$/u.test(summary.operationId) ||
          !isSha256Hex(summary.operationNonce) ||
          !isSha256Hex(summary.identitySha256) ||
          !validCoordinatorPrimaryFailure(summary.primaryFailure) ||
          !exactRecordKeys(summary.execution, [
            "providerStart",
            "externalSend",
            "sharedWrite",
            "ownerEffect",
            "workspaceReusable",
          ]) ||
          !["not_started", "started", "unknown"].includes(
            summary.execution.providerStart,
          ) ||
          !["not_issued", "issued", "unknown"].includes(
            summary.execution.externalSend,
          ) ||
          !["not_issued", "possible", "unknown"].includes(
            summary.execution.sharedWrite,
          ) ||
          summary.execution.ownerEffect !== "disabled" ||
          summary.execution.workspaceReusable !== false ||
          !validCoordinatorOutcome(summary.outcome) ||
          summary.outcome?.cleanupConfirmed !== true ||
          summary.hostCleanup !== "confirmed" ||
          summary.lease !== "released"
        )
          throw new Error("history_row_invalid");
        const recovery = parseDockerTaskRecoveryId(summary.recoveryId);
        if (
          !recovery ||
          recovery.operationNonce !== summary.operationNonce ||
          recovery.baseHash !== summary.identitySha256 ||
          seen.has(summary.recoveryId)
        )
          throw new Error("history_identity_invalid");
        seen.add(summary.recoveryId);
        return Object.freeze({
          line: `${line}\n`,
          occurredAt: row.occurredAt as string,
          recoveryId: summary.recoveryId as string,
          lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
          summarySha256: createHash("sha256")
            .update(`${encodeCoordinatorStateValue(summary)}\n`)
            .digest("hex"),
        });
      });
    return Object.freeze(rows);
  } catch {
    return null;
  }
}

/**
 * 検査済み終了履歴から保持期間内と未確認の行を残す候補を作る。
 * @responsibility 期間整理と保存確認の順序を現在状態へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 現在Snapshot、historyBytes: 履歴本文、now: 固定UTC時刻、retentionDays: 設定日数、repositoryBinding: 現在結合。
 * @returns 元の行順と本文を維持した候補、またはnull。
 * @precondition 更新排他内の元File実体・版・設定を物理Writerが再照合する。
 * @postcondition 未確認行は期限外でも保持し、確認済みの欠落行を再追加しない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 全行検査失敗、設定不正、未確認行欠落または相関不一致はnull。
 * @invariant 件数・容量を理由に削除せず、状態の操作・搬送を変更しない。
 * @boundary 現在状態と通常履歴の保持期間。
 * @security 候補生成は実保存・読戻し・操作除去のAuthorityを発行しない。
 * @concurrency 判定時刻・設定と元本文への結合を保存側が保持する。
 */
export function prepareCoordinatorHistoryRetention(
  currentBytes: unknown,
  historyBytes: unknown,
  now: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const rows = decodeCoordinatorHistoryRows(historyBytes);
  if (
    !current ||
    !rows ||
    typeof now !== "string" ||
    !Number.isFinite(Date.parse(now)) ||
    new Date(Date.parse(now)).toISOString() !== now ||
    typeof retentionDays !== "number" ||
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 104249991
  )
    return null;
  const cutoff = Date.parse(now) - retentionDays * 86400000;
  if (!Number.isSafeInteger(cutoff)) return null;
  const byRecovery = new Map(rows.map((row) => [row.recoveryId, row]));
  const protectedRecoveries = new Set<string>();
  for (const operation of current.snapshot.operations) {
    if (!operation.history) continue;
    const row = byRecovery.get(operation.recoveryId);
    if (
      (row &&
        (row.lineSha256 !== operation.history.lineSha256 ||
          row.summarySha256 !== operation.summarySha256)) ||
      (!row && !operation.history.confirmed)
    )
      return null;
    if (!operation.history.confirmed)
      protectedRecoveries.add(operation.recoveryId);
  }
  return Buffer.from(
    rows
      .filter(
        (row) =>
          protectedRecoveries.has(row.recoveryId) ||
          Date.parse(row.occurredAt) >= cutoff,
      )
      .map((row) => row.line)
      .join(""),
    "utf8",
  );
}

/**
 * 履歴の初回固定または保存確認の候補を同じ操作へ結合する。
 * @responsibility 最初の時刻と行Hashを固定し、確認状態の巻戻しを拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: 対象、occurredAt: 固定時刻、confirmed: 保存確認候補、repositoryBinding: 現在結合。
 * @returns 改訂相関を含む候補Snapshot、またはnull。
 * @precondition 実終端と保存読戻しの根拠は物理Writerで別途確認する。
 * @postcondition 他操作・資源・参照を変更しない。
 * @effect N/A: メモリ内の候補生成。
 * @failure 未終端評価、時刻不正、初回true、既存内容差はnull。
 * @invariant 候補生成を実終端・保存・除去の許可にしない。
 * @boundary 終端Ownerと単一Snapshotの短命な履歴相関。
 * @security 一般Writerは実保存根拠なしの履歴変更を拒否する。
 * @concurrency 元版Hashへ結合して物理Writerで再照合する。
 */
export function prepareCoordinatorStateHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (
      !current ||
      typeof recoveryId !== "string" ||
      typeof occurredAt !== "string" ||
      typeof confirmed !== "boolean"
    )
      return null;
    const time = Date.parse(occurredAt);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== occurredAt)
      return null;
    const operation = current.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      operation.phase === "executing" ||
      !operation.outcome?.cleanupConfirmed ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      operation.resources.some(
        (item) =>
          item.request !== "not_requested" &&
          item.request !== "not_issued" &&
          (item.request !== "identified" || item.observation !== "absent"),
      )
    )
      return null;
    if (!operation.history && confirmed) return null;
    const summary = prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    if (!summary) return null;
    const history = {
      occurredAt,
      lineSha256: createHash("sha256")
        .update(coordinatorHistoryLineBytes(operation, occurredAt))
        .digest("hex"),
      confirmed,
    };
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : { ...item, summarySha256: summary.summarySha256, history },
      ),
    };
    const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存本文を閉じた現在状態へ復号する。
 * @responsibility byte形式、操作Identity、資源と未終了参照の構造相関を検査する。
 * @trace ARCH-000008
 * @input bytes: UTF-8保存本文、repositoryBinding: 呼出し側で検証したRepository結合Hash。
 * @returns 検証済みの不変Snapshotと本文Hash、またはnull。
 * @precondition Repositoryの現在Identityは別のRuntime境界で確認する。
 * @postcondition 不正本文、別Repository、重複・孤立参照を拒否する。
 * @effect N/A: メモリ内の復号だけ。
 * @failure 構造、encodingまたは相関不一致はnull。
 * @invariant 過去unknownと現在観測を区別し、Hostの確定本文を再符号化しない。
 * @boundary 非Authorityの保存内容とRuntimeの再観測。
 * @security 本文を実資源不存在、所有権または処置許可へ昇格しない。
 * @concurrency N/A: 保存や共有状態更新を行わない。
 */
export function decodeCoordinatorStateSnapshot(
  input: unknown,
  repositoryBinding: unknown,
): Readonly<{
  snapshot: CoordinatorStateSnapshot;
  payloadSha256: string;
}> | null {
  try {
    if (
      types.isProxy(input) ||
      !Buffer.isBuffer(input) ||
      !isSha256Hex(repositoryBinding)
    )
      return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (
      !Number.isSafeInteger(length) ||
      length === 0 ||
      length > MAX_COORDINATOR_STATE_BYTES
    )
      return null;
    const buffer = Object.getOwnPropertyDescriptor(
      intrinsic,
      "buffer",
    )?.get?.call(input);
    const offset = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteOffset",
    )?.get?.call(input);
    const bytes = Buffer.from(new Uint8Array(buffer, offset, length));
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const parsed = JSON.parse(text, (_key, value) =>
      value && typeof value === "object" ? Object.freeze(value) : value,
    );
    if (
      `${encodeCoordinatorStateValue(parsed)}\n` !== text ||
      !exactRecordKeys(parsed, [
        "schema",
        "revision",
        "previous",
        "repositoryBinding",
        "operations",
        "unresolvedRecoveries",
        "pendingDeliveries",
      ])
    )
      return null;
    const snapshot = parsed as CoordinatorStateSnapshot;
    if (
      snapshot.schema !== COORDINATOR_STATE_SCHEMA ||
      snapshot.repositoryBinding !== repositoryBinding ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 1
    )
      return null;
    if (
      snapshot.revision === 1
        ? snapshot.previous !== null
        : !exactRecordKeys(snapshot.previous, ["revision", "payloadSha256"]) ||
          snapshot.previous === null ||
          !Number.isSafeInteger(snapshot.previous.revision) ||
          snapshot.previous.revision !== snapshot.revision - 1 ||
          !isSha256Hex(snapshot.previous.payloadSha256)
    )
      return null;
    if (
      !Array.isArray(snapshot.operations) ||
      snapshot.operations.length > MAX_COORDINATOR_STATE_OPERATIONS ||
      !Array.isArray(snapshot.unresolvedRecoveries) ||
      snapshot.unresolvedRecoveries.length > MAX_COORDINATOR_STATE_OPERATIONS ||
      !Array.isArray(snapshot.pendingDeliveries) ||
      snapshot.pendingDeliveries.length > MAX_COORDINATOR_STATE_OPERATIONS
    )
      return null;
    const operations = new Map<string, CoordinatorStateOperation>();
    let previousNonce = "";
    for (const operation of snapshot.operations) {
      if (
        !exactRecordKeys(operation, [
          "identityJson",
          "identitySha256",
          "recoveryId",
          "phase",
          "resources",
          "host",
          "lease",
          "execution",
          "primaryFailure",
          "outcome",
          "summarySha256",
          "history",
        ])
      )
        return null;
      const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
      if (
        !recovery ||
        recovery.operationNonce <= previousNonce ||
        typeof operation.identityJson !== "string" ||
        !operation.identityJson.endsWith("\n")
      )
        return null;
      const identity = JSON.parse(operation.identityJson);
      if (
        `${JSON.stringify(identity)}\n` !== operation.identityJson ||
        !validateCoordinatorOperationIdentity(
          identity,
          recovery.operationNonce,
          repositoryBinding,
        ) ||
        createHash("sha256")
          .update(operation.identityJson, "utf8")
          .digest("hex") !== operation.identitySha256 ||
        recovery.baseHash !== operation.identitySha256 ||
        recovery.stableLogicalHomeBindingHash !==
          identity.stableLogicalHomeBindingHash
      )
        return null;
      previousNonce = recovery.operationNonce;
      operations.set(recovery.operationNonce, operation);
      if (
        !["executing", "settling", "awaiting_delivery"].includes(
          operation.phase,
        ) ||
        !["held", "released", "unknown"].includes(operation.lease) ||
        (operation.summarySha256 !== null &&
          !isSha256Hex(operation.summarySha256))
      )
        return null;
      if (
        !Array.isArray(operation.resources) ||
        operation.resources.length !== 5
      )
        return null;
      for (const [index, purpose] of Object.keys(purposeResource).entries()) {
        const resource = operation.resources[index];
        if (
          !resource ||
          !exactRecordKeys(resource, [
            "purpose",
            "request",
            "dockerId",
            "receiptSource",
            "observation",
            "absence",
          ]) ||
          resource.purpose !== purpose ||
          ![
            "not_requested",
            "not_issued",
            "intent_saved",
            "issued",
            "identified",
            "unknown",
          ].includes(resource.request) ||
          !["unobserved", "present", "absent", "unknown"].includes(
            resource.observation,
          )
        )
          return null;
        if (
          resource.request === "not_issued" &&
          (resource.observation !== "unobserved" || resource.absence !== null)
        )
          return null;
        if (
          resource.request === "identified"
            ? !isSha256Hex(resource.dockerId) ||
              !["docker_create_result", "runtime_reconciliation"].includes(
                resource.receiptSource ?? "",
              )
            : resource.dockerId !== null || resource.receiptSource !== null
        )
          return null;
        if (resource.observation === "absent") {
          const absence = resource.absence;
          if (
            !exactRecordKeys(absence, [
              "recoveryId",
              "purpose",
              "plannedResourceName",
              "dockerId",
              "evidenceSha256",
            ]) ||
            !absence ||
            absence.recoveryId !== operation.recoveryId ||
            absence.purpose !== purpose ||
            absence.plannedResourceName !==
              identity.resources[
                purposeResource[purpose as keyof typeof purposeResource]
              ] ||
            absence.dockerId !== resource.dockerId ||
            !isSha256Hex(absence.evidenceSha256)
          )
            return null;
        } else if (resource.absence !== null) return null;
      }
      if (
        !exactRecordKeys(operation.host, [
          "currentToken",
          "pendingTransitionJson",
          "cleanup",
        ]) ||
        !["not_requested", "pending", "confirmed", "unknown"].includes(
          operation.host.cleanup,
        )
      )
        return null;
      const initialHost = parseHostRecoveryToken(
        identity.initialHostRecoveryId,
      );
      const currentHost = parseHostRecoveryToken(operation.host.currentToken);
      if (
        initialHost.rootName !== currentHost.rootName ||
        initialHost.nonce !== currentHost.nonce
      )
        return null;
      if (operation.host.pendingTransitionJson !== null) {
        if (typeof operation.host.pendingTransitionJson !== "string")
          return null;
        const transition = JSON.parse(operation.host.pendingTransitionJson);
        if (
          `${JSON.stringify(transition)}\n` !==
            operation.host.pendingTransitionJson ||
          !exactRecordKeys(transition, [
            "currentToken",
            "expectedToken",
            "rootName",
            "nonce",
            "currentState",
            "nextState",
            "recordBefore",
          ])
        )
          return null;
        const lineage = validateDockerHostTransitionLineage(transition);
        if (
          ![
            "host_only:docker_submission_started",
            "docker_submission_started:host_only",
            "docker_submission_started:docker_absent_confirmed",
          ].includes(`${transition.currentState}:${transition.nextState}`)
        )
          return null;
        if (
          lineage.current.rootName !== initialHost.rootName ||
          lineage.current.nonce !== initialHost.nonce ||
          ![lineage.currentToken, lineage.expectedToken].includes(
            operation.host.currentToken,
          )
        )
          return null;
      }
      const execution = operation.execution;
      if (
        !exactRecordKeys(execution, [
          "providerStart",
          "externalSend",
          "sharedWrite",
          "ownerEffect",
          "workspaceReusable",
        ]) ||
        !["not_started", "started", "unknown"].includes(
          execution.providerStart,
        ) ||
        !["not_issued", "issued", "unknown"].includes(execution.externalSend) ||
        !["not_issued", "possible", "unknown"].includes(
          execution.sharedWrite,
        ) ||
        !["active", "disabled", "unknown"].includes(execution.ownerEffect) ||
        execution.workspaceReusable !== false
      )
        return null;
      if (
        !validCoordinatorPrimaryFailure(operation.primaryFailure) ||
        !validCoordinatorOutcome(operation.outcome)
      )
        return null;
      if ((operation.summarySha256 === null) !== (operation.history === null))
        return null;
      if (operation.history !== null) {
        const history = operation.history;
        if (
          !operation.outcome ||
          !exactRecordKeys(history, [
            "occurredAt",
            "lineSha256",
            "confirmed",
          ]) ||
          typeof history.occurredAt !== "string" ||
          !Number.isFinite(Date.parse(history.occurredAt)) ||
          new Date(Date.parse(history.occurredAt)).toISOString() !==
            history.occurredAt ||
          !isSha256Hex(history.lineSha256) ||
          typeof history.confirmed !== "boolean" ||
          createHash("sha256")
            .update(coordinatorOperationSummaryBytes(operation))
            .digest("hex") !== operation.summarySha256 ||
          createHash("sha256")
            .update(coordinatorHistoryLineBytes(operation, history.occurredAt))
            .digest("hex") !== history.lineSha256
        )
          return null;
      }
    }
    let previousRecovery = "";
    for (const recovery of snapshot.unresolvedRecoveries) {
      if (
        !exactRecordKeys(recovery, [
          "operationNonce",
          "recoveryId",
          "reason",
          "obligations",
        ]) ||
        recovery.operationNonce <= previousRecovery ||
        operations.get(recovery.operationNonce)?.recoveryId !==
          recovery.recoveryId ||
        !finalReasons.has(recovery.reason) ||
        !Array.isArray(recovery.obligations) ||
        recovery.obligations.length === 0 ||
        recovery.obligations.length > 4
      )
        return null;
      previousRecovery = recovery.operationNonce;
      let previousObligation = "";
      for (const obligation of recovery.obligations) {
        if (
          ![
            "docker_resources",
            "host_cleanup",
            "lease_release",
            "result_delivery",
          ].includes(obligation) ||
          obligation <= previousObligation
        )
          return null;
        previousObligation = obligation;
      }
    }
    let previousDelivery = "";
    const deliveryResultIds = new Map<string, string>();
    for (const delivery of snapshot.pendingDeliveries) {
      const deliveryOperation = operations.get(delivery.operationNonce);
      if (
        !exactRecordKeys(delivery, [
          "operationNonce",
          "recoveryId",
          "resultId",
          "consumer",
          "acceptanceSha256",
        ]) ||
        !deliveryOperation ||
        deliveryOperation.recoveryId !== delivery.recoveryId ||
        !isSha256Hex(delivery.resultId) ||
        delivery.consumer !== "orchestrator" ||
        JSON.parse(deliveryOperation.identityJson).consumer !==
          delivery.consumer ||
        (delivery.acceptanceSha256 !== null &&
          !isSha256Hex(delivery.acceptanceSha256))
      )
        return null;
      const key = `${delivery.operationNonce}:${delivery.consumer}`;
      if (key <= previousDelivery) return null;
      const fixedResultId = deliveryResultIds.get(delivery.operationNonce);
      if (fixedResultId !== undefined && fixedResultId !== delivery.resultId)
        return null;
      deliveryResultIds.set(delivery.operationNonce, delivery.resultId);
      previousDelivery = key;
    }
    return Object.freeze({
      snapshot,
      payloadSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch {
    return null;
  }
}

/**
 * 終端・履歴確認・全搬送受理を満たす一操作だけの終了候補を作る。
 * @responsibility 操作と同じ回復・搬送参照を一改訂で取り除く値契約を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、repositoryBinding: 現在結合。
 * @returns 固定対象だけを除去した次Snapshot、またはnull。
 * @precondition 物理Ownerが実終端と固定利用側に必要な耐久受理根拠を別途照合する。
 * @postcondition 他操作・他参照と元版相関を保持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 実行中、清掃・Lease・履歴未確認、搬送未受理または不正入力はnull。
 * @invariant 候補を実終端・受理・除去Authorityへ昇格せず、一般更新の除去拒否を維持する。
 * @boundary 現在操作の閉集合と通常履歴。
 * @security unknown Createや不明Effectを成功へ丸めない。
 * @concurrency 元版と真正根拠の同時照合は物理Writerの責務。
 */
export function prepareCoordinatorStateCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (value) => value.recoveryId === recoveryId,
  );
  const completionPolicy = operation
    ? coordinatorConsumerCompletionPolicy(
        JSON.parse(operation.identityJson).consumer,
      )
    : null;
  if (
    !current ||
    !operation ||
    !completionPolicy ||
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    operation.host.cleanup !== "confirmed" ||
    operation.host.pendingTransitionJson !== null ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.history?.confirmed !== true ||
    !prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    ) ||
    (completionPolicy === "durable" &&
      !current.snapshot.pendingDeliveries.some(
        (delivery) => delivery.recoveryId === recoveryId,
      )) ||
    (completionPolicy === "transient" &&
      current.snapshot.pendingDeliveries.some(
        (delivery) => delivery.recoveryId === recoveryId,
      )) ||
    operation.resources.some(
      (resource) =>
        resource.request !== "not_requested" &&
        resource.request !== "not_issued" &&
        (resource.request !== "identified" ||
          resource.observation !== "absent"),
    ) ||
    current.snapshot.pendingDeliveries.some(
      (delivery) =>
        delivery.recoveryId === recoveryId &&
        (delivery.acceptanceSha256 === null ||
          delivery.resultId !== operation.summarySha256),
    )
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    pendingDeliveries: current.snapshot.pendingDeliveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 同じRepositoryの現在状態更新で既知事実を保全する。
 * @responsibility exact元本文、固定Identity、確定資源と一次結果の保持を検査する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文または初回のnull、nextBytes: 次本文、repositoryBinding: 現在結合。
 * @returns 許可された内容遷移だけtrue。
 * @precondition 物理Ownerが元Fileの観測と初回Root条件を確認する。
 * @postcondition 不変情報と未終了集合の暗黙除去を拒否する。
 * @effect N/A: メモリ内の比較のみ。
 * @failure 復号・改訂・遷移不一致はfalse。
 * @invariant unknownを既知事実の消去や再実行許可へ用いない。
 * @boundary 保存候補の構造と実処置前の検証。
 * @security trueは資源終端・Authority・保存確定の証明ではない。
 * @concurrency N/A: 排他とfresh観測は物理Writerの責務。
 */
export function validateCoordinatorStateTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  try {
    const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (!next || (currentBytes !== null && !current)) return false;
    if (!current) {
      if (next.snapshot.revision !== 1 || next.snapshot.previous !== null)
        return false;
    } else if (
      next.snapshot.revision !== current.snapshot.revision + 1 ||
      next.snapshot.previous?.revision !== current.snapshot.revision ||
      next.snapshot.previous.payloadSha256 !== current.payloadSha256
    )
      return false;
    const priorOperations = new Map(
      (current?.snapshot.operations ?? []).map((operation) => [
        parseDockerTaskRecoveryId(operation.recoveryId)?.operationNonce,
        operation,
      ]),
    );
    const phases = ["executing", "settling", "awaiting_delivery"];
    for (const operation of next.snapshot.operations) {
      const nonce = parseDockerTaskRecoveryId(
        operation.recoveryId,
      )?.operationNonce;
      const prior = priorOperations.get(nonce);
      if (!prior) {
        const identity = JSON.parse(operation.identityJson);
        // 新操作だけを制約する。旧競合Snapshotの読取り・回収を不能にしない。
        if (
          next.snapshot.operations.some((other) => {
            if (other.recoveryId === operation.recoveryId) return false;
            if (
              JSON.parse(other.identityJson).stableLogicalHomeBindingHash !==
              identity.stableLogicalHomeBindingHash
            )
              return false;
            const before = current?.snapshot.operations.find(
              (item) => item.recoveryId === other.recoveryId,
            );
            // 同じ更新内の終端偽装や、二つの新規開始を受理しない。
            return (
              !before ||
              [before, other].some(
                (value) =>
                  value.phase === "executing" ||
                  value.outcome?.cleanupConfirmed !== true ||
                  value.host.cleanup !== "confirmed" ||
                  value.host.pendingTransitionJson !== null ||
                  value.lease !== "released" ||
                  value.execution.ownerEffect !== "disabled" ||
                  value.execution.providerStart === "unknown" ||
                  value.execution.externalSend === "unknown" ||
                  value.execution.sharedWrite === "unknown" ||
                  value.resources.some(
                    (resource) =>
                      !["not_requested", "not_issued"].includes(
                        resource.request,
                      ) &&
                      (resource.request !== "identified" ||
                        resource.observation !== "absent"),
                  ),
              ) ||
              [current?.snapshot, next.snapshot].some((snapshot) =>
                snapshot?.unresolvedRecoveries.some(
                  (recovery) =>
                    recovery.recoveryId === other.recoveryId &&
                    recovery.obligations.some(
                      (obligation) => obligation !== "result_delivery",
                    ),
                ),
              )
            );
          })
        )
          return false;
        if (
          operation.phase !== "executing" ||
          operation.resources.some(
            (resource) =>
              resource.request !== "not_requested" ||
              resource.observation !== "unobserved",
          ) ||
          operation.host.currentToken !== identity.initialHostRecoveryId ||
          operation.host.pendingTransitionJson !== null ||
          operation.host.cleanup !== "not_requested" ||
          operation.lease !== "held" ||
          operation.execution.providerStart !== "not_started" ||
          operation.execution.externalSend !== "not_issued" ||
          operation.execution.sharedWrite !== "not_issued" ||
          operation.execution.ownerEffect !== "active" ||
          operation.primaryFailure !== null ||
          operation.outcome !== null ||
          operation.summarySha256 !== null ||
          operation.history !== null
        )
          return false;
        continue;
      }
      priorOperations.delete(nonce);
      if (
        operation.identityJson !== prior.identityJson ||
        operation.identitySha256 !== prior.identitySha256 ||
        operation.recoveryId !== prior.recoveryId ||
        phases.indexOf(operation.phase) < phases.indexOf(prior.phase)
      )
        return false;
      for (const [index, resource] of operation.resources.entries()) {
        const before = prior.resources[index];
        if (!before) return false;
        if (
          before.request !== resource.request &&
          ![
            "not_requested:intent_saved",
            "intent_saved:issued",
            "intent_saved:identified",
            "intent_saved:not_issued",
            "intent_saved:unknown",
            "issued:unknown",
            "unknown:issued",
            "unknown:identified",
            "issued:identified",
          ].includes(`${before.request}:${resource.request}`)
        )
          return false;
        if (
          before.request === "intent_saved" &&
          resource.request === "identified" &&
          (before.observation !== "unobserved" ||
            before.absence !== null ||
            resource.receiptSource !== "docker_create_result" ||
            resource.observation !== "unobserved" ||
            resource.absence !== null)
        )
          return false;
        if (
          before.request === "identified" &&
          (resource.dockerId !== before.dockerId ||
            resource.receiptSource !== before.receiptSource)
        )
          return false;
      }
      if (
        prior.primaryFailure !== null &&
        encodeCoordinatorStateValue(operation.primaryFailure) !==
          encodeCoordinatorStateValue(prior.primaryFailure)
      )
        return false;
      if (
        prior.summarySha256 !== null &&
        operation.summarySha256 !== prior.summarySha256
      )
        return false;
      if (prior.history === null) {
        if (operation.history?.confirmed) return false;
      } else if (
        operation.history === null ||
        operation.history.occurredAt !== prior.history.occurredAt ||
        operation.history.lineSha256 !== prior.history.lineSha256 ||
        (prior.history.confirmed && !operation.history.confirmed)
      )
        return false;
      if (
        prior.outcome !== null &&
        (operation.outcome === null ||
          operation.outcome.status !== prior.outcome.status ||
          operation.outcome.reason !== prior.outcome.reason ||
          (prior.outcome.cleanupConfirmed &&
            !operation.outcome.cleanupConfirmed))
      )
        return false;
      for (const [field, known] of [
        ["providerStart", "started"],
        ["externalSend", "issued"],
        ["sharedWrite", "possible"],
        ["ownerEffect", "disabled"],
      ] as const) {
        if (
          prior.execution[field] === known &&
          operation.execution[field] !== known
        )
          return false;
        if (
          prior.execution[field] === "unknown" &&
          operation.execution[field] !== "unknown" &&
          operation.execution[field] !== known
        )
          return false;
      }
      if (prior.lease === "released" && operation.lease !== "released")
        return false;
      if (
        prior.host.cleanup === "confirmed" &&
        operation.host.cleanup !== "confirmed"
      )
        return false;
      const pending =
        prior.host.pendingTransitionJson === null
          ? null
          : JSON.parse(prior.host.pendingTransitionJson);
      if (
        operation.host.currentToken !== prior.host.currentToken &&
        (!pending ||
          pending.currentToken !== prior.host.currentToken ||
          operation.host.currentToken !== pending.expectedToken)
      )
        return false;
      if (
        operation.host.pendingTransitionJson !==
        prior.host.pendingTransitionJson
      ) {
        if (pending && operation.host.currentToken !== pending.expectedToken)
          return false;
        if (
          operation.host.pendingTransitionJson !== null &&
          JSON.parse(operation.host.pendingTransitionJson).currentToken !==
            operation.host.currentToken
        )
          return false;
      }
    }
    if (priorOperations.size !== 0) return false;
    for (const before of current?.snapshot.unresolvedRecoveries ?? []) {
      const after = next.snapshot.unresolvedRecoveries.find(
        (item) => item.operationNonce === before.operationNonce,
      );
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        before.obligations.some(
          (obligation) => !after.obligations.includes(obligation),
        )
      )
        return false;
    }
    for (const before of current?.snapshot.pendingDeliveries ?? []) {
      const after = next.snapshot.pendingDeliveries.find(
        (item) =>
          item.operationNonce === before.operationNonce &&
          item.consumer === before.consumer,
      );
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        after.resultId !== before.resultId ||
        (before.acceptanceSha256 !== null &&
          after.acceptanceSha256 !== before.acceptanceSha256)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
