/**
 * 旧資源集合回収の有限モデルと、低位技術実装への試験接続。
 * @responsibility 旧試験の反例を保持し、本番の共通回収Ownerへ再流入させない。
 * @trace ARCH-000008
 */

import { types } from "node:util";
import path from "node:path";
import {
  describeIsolationConfiguration,
  type ResourceSnapshot,
} from "../../src/index.ts";
import {
  createRecoveryExecutor,
  type DockerRecoveryExecutionBinding,
  type DockerResourceRecoveryOperations,
} from "../../src/cleanup/execute.ts";

export type DockerResourceReceipts = Readonly<
  Record<
    | "create_provider"
    | "create_proxy"
    | "create_subscription_auth_probe"
    | "create_internal_network"
    | "create_egress_network",
    Readonly<{ submitted: boolean; dockerId: string | null }>
  >
>;

export type DockerResourceCleanupObservation = Readonly<{
  purpose: keyof DockerResourceReceipts;
  plannedResourceName: string;
  dockerId: string | null;
  observation: "not_requested" | "absent" | "unknown";
}>;

export type DockerResourceExpectationSet = readonly Readonly<{
  purpose: keyof DockerResourceReceipts;
  expectations: readonly Omit<
    import("../../../docker-isolation/src/cleanup/types.ts").DockerResourceExpectation,
    "dockerId"
  >[];
}>[];

export type ResourceCleanupResult = Readonly<{
  resourceSnapshot?: ResourceSnapshot;
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  dockerCleanupConfirmed: boolean;
  configCleanupConfirmed: boolean;
  resources: readonly DockerResourceCleanupObservation[];
}>;
export interface ResourceCleanupCallbacks<Observation> {
  onResourceInspecting?(purpose: keyof DockerResourceReceipts): void;
  onResourceIdentified?(
    purpose: keyof DockerResourceReceipts,
    dockerId: string,
  ): void;
  onResourcesClosed?(observation: Observation): void | Promise<void>;
  onCleanupCompleted?(observation: Observation): void | Promise<void>;
}

/**
 * 必要な回収通知を同期処理として完了させる。
 * @responsibility 通知先の保存結果を解釈せず、未完了なら次Effectを止める。
 * @trace ARCH-000008
 * @input notice: 登録済み通知。args: 同じ資源の技術事実。
 * @returns 同期voidの完了後だけ戻る。
 * @effect 登録済み通知だけを一回発行する。
 * @failure Promise・不正返却・例外では停止し拒否を消費する。
 * @invariant ACK・待機キュー・再送を追加しない。
 */
function completeRecoveryNotice(
  notice: ((...args: never[]) => unknown) | undefined,
  ...args: unknown[]
): void {
  if (!notice) return;
  const returned: unknown = Reflect.apply(notice, undefined, args);
  if (returned !== undefined) {
    void Promise.resolve(returned).catch(() => {});
    throw Error("docker_task_recovery_checkpoint_unconfirmed");
  }
}

/**
 * 通常実行と再入場の同じ期待値・Receiptを一つの回収順序へ接続する。
 * @responsibility 資源の照合・探索通知・削除・不存在・結果集約を一回だけ行う。
 * @trace ARCH-000008
 * @input input: DIが構築した技術期待値と元Receipt。operations: 同じDIの固定実行接続。callbacks: 必要な同期通知。
 * @returns 資源別事実と回収成立。Hostやconfig終了はこの結果へ補完しない。
 * @effect 元資源の固定観測と実ID処置。
 * @failure 取消・通知拒否・未発見・構成差をunknown又はblockedとして保持する。
 * @invariant 上位Owner・保存方式・Taskを知らない。
 */
export async function cleanupResourceSet(
  input: Readonly<{
    expectations: DockerResourceExpectationSet;
    receipts: DockerResourceReceipts;
    signal?: AbortSignal;
    previouslyAbsent?: readonly (keyof DockerResourceReceipts)[];
  }>,
  operations: {
    cleanupObserved: DockerResourceRecoveryOperations["cleanupObserved"];
    discoverSubmitted?: DockerResourceRecoveryOperations["discoverSubmitted"];
  } | null,
  callbacks: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  > = {},
): Promise<
  Omit<
    ResourceCleanupResult,
    "operationId" | "recoveryId" | "configCleanupConfirmed"
  >
> {
  const target = input,
    entries = input.expectations;
  const resources: DockerResourceCleanupObservation[] = [];
  let reason = "docker_task_recovery_execution_unconfirmed",
    completed = false,
    confirmed = false;
  try {
    for (const entry of entries) {
      const receipt = target.receipts[entry.purpose];
      if (
        !receipt ||
        typeof receipt.submitted !== "boolean" ||
        (receipt.dockerId !== null &&
          (typeof receipt.dockerId !== "string" ||
            !/^[a-f0-9]{64}$/u.test(receipt.dockerId))) ||
        (!receipt.submitted && receipt.dockerId !== null)
      )
        throw Error("docker_task_recovery_receipt_invalid");
    }
    for (const entry of entries) {
      const first = entry.expectations[0];
      if (!first) throw Error("docker_task_recovery_resource_missing");
      target.signal?.throwIfAborted();
      const receipt = target.receipts[entry.purpose];
      let dockerId = receipt.dockerId;
      let observation: DockerResourceCleanupObservation["observation"] =
        "not_requested";
      const requireConfigurationMatch = dockerId === null;
      if (receipt.submitted) {
        if (!operations)
          throw Error("docker_task_recovery_executor_unavailable");
        reason = "docker_task_recovery_checkpoint_unconfirmed";
        completeRecoveryNotice(callbacks.onResourceInspecting, entry.purpose);
        reason = "docker_task_recovery_execution_unconfirmed";
        target.signal?.throwIfAborted();
        if (dockerId === null) {
          for (const expected of entry.expectations) {
            target.signal?.throwIfAborted();
            dockerId = operations.discoverSubmitted?.(expected) ?? null;
            target.signal?.throwIfAborted();
            if (dockerId !== null) break;
          }
          if (dockerId !== null) {
            reason = "docker_task_recovery_checkpoint_unconfirmed";
            if (!callbacks.onResourceIdentified)
              throw Error("docker_task_recovery_checkpoint_unconfirmed");
            completeRecoveryNotice(
              callbacks.onResourceIdentified,
              entry.purpose,
              dockerId,
            );
            reason = "docker_task_recovery_execution_unconfirmed";
            target.signal?.throwIfAborted();
          }
        }
        let absent = false;
        if (dockerId)
          for (const expected of entry.expectations) {
            target.signal?.throwIfAborted();
            absent = await operations.cleanupObserved(
              { ...expected, dockerId },
              target.signal,
              target.previouslyAbsent?.includes(entry.purpose) === true,
              requireConfigurationMatch,
            );
            target.signal?.throwIfAborted();
            if (absent) break;
          }
        observation = absent ? "absent" : "unknown";
        if (!absent && target.previouslyAbsent?.includes(entry.purpose)) {
          reason = "docker_task_recovery_resource_unconfirmed";
          throw Error("previous_absence_unconfirmed");
        }
      }
      resources.push(
        Object.freeze({
          purpose: entry.purpose,
          plannedResourceName: first.expectedName,
          dockerId,
          observation,
        }),
      );
    }
    resources.sort((left, right) => left.purpose.localeCompare(right.purpose));
    confirmed = resources.every((value) => value.observation !== "unknown");
    reason = "docker_task_recovery_checkpoint_unconfirmed";
    completeRecoveryNotice(
      callbacks.onResourcesClosed,
      Object.freeze(resources),
    );
    target.signal?.throwIfAborted();
    completed = true;
    reason = confirmed
      ? "docker_task_recovery_resources_clean"
      : "docker_task_recovery_resource_unconfirmed";
  } catch {
    completed = false;
  }
  return Object.freeze({
    status: completed && confirmed ? "completed" : "blocked",
    reason,
    dockerCleanupConfirmed: confirmed,
    resources: Object.freeze(resources),
  });
}

/**
 * 有限試験の検査済みconfigを本番と同じ低位実装へ接続する。
 *
 * @responsibility raw argvを公開せず、現在観測・実ID回収・予定資源発見へ限定する。
 * @trace ARCH-000008
 * @input binding: 既存Ownerが検査したconfigとfresh Host観測。
 * @returns 実ID回収、予定資源発見、予定資源不存在の三操作。
 * @precondition 試験が合成configと固定Process代役を用意している。
 * @postcondition 上位のStateや回復Classを所有・変更しない。
 * @effect N/A: 構築だけでは外部処置を発行しない。
 * @failure 操作中のCLI／config／環境不明は新Effect前に停止する。
 * @invariant 永続State・履歴・追加Lock・新しいRecoveryを作らない。
 * @boundary tests専用の接続。製品SourceとRootへ再公開しない。
 * @security 公開操作から任意Dockerコマンドを実行できない。
 * @concurrency 各要求の直前に同じconfigとCLIを再照合する。
 */
export function createDockerResourceRecoveryExecutor(
  binding: DockerRecoveryExecutionBinding,
) {
  return createRecoveryExecutor(binding, () => undefined);
}

const DOCKER_TASK_RECOVERY_ID =
  /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u;

/**
 * Docker Taskの元回復参照を技術境界で解析する。
 * @responsibility 三成分の固定文法を検査し、値から操作Authorityを発行しない。
 * @trace ARCH-000008
 * @input token: 未信頼値。
 * @returns 三Hash成分と元token、又はnull。
 * @effect N/A: 文字列だけを同期検査する。
 * @failure 文字列以外・長さ・大文字・余剰成分はnull。
 * @boundary Domainの保存受理parserとは独立したDI技術入力。
 */
export function parseDockerTaskRecoveryId(token: unknown) {
  if (typeof token !== "string") return null;
  const match = DOCKER_TASK_RECOVERY_ID.exec(token);
  return match?.[1] && match[2] && match[3]
    ? Object.freeze({
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      })
    : null;
}

/** 過去の構成反例だけを保持する有限Oracle。製品回収はSnapshotを使う。 */
export function codexAdviceProviderInitRequired(
  operationMode: string,
  imageDigest: string | null,
) {
  return (
    operationMode === "workbench_advice" &&
    (imageDigest ===
      describeIsolationConfiguration("codex").assets.alternateIdentity
        .fixedImageDigest ||
      imageDigest ===
        "sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e" ||
      imageDigest ===
        "sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36")
  );
}

/**
 * 回収する五用途の固定技術期待値を構築する。
 * @responsibility 回収順、Network、Image、MountとInitを下位の不変計画として所有する。
 * @trace ARCH-000008
 * @input input: 五資源名、Label、二Image digest、Workspace／read-only／Initの三boolean。
 * @returns Container先行の固定五用途と期待値候補、またはnull。
 * @precondition 上位がIdentityの意味、Provider判断と現在資源の結合を確認する。
 * @postcondition 秘密値・所在・実ID・状態・Authorityを計画へ含めない。
 * @effect N/A: 同期の値構築だけ。
 * @failure 不正な名前・Label・digest・型・欠測は部分計画を返さずnull。
 * @invariant Proxy候補順と独立booleanの意味を保持する。
 * @boundary 上位の検証済み非秘密入力とDocker技術構成。
 * @security この計画から存在・所有・削除許可を推定しない。
 * @concurrency 入力を書き換えず、返却値と入れ子配列を凍結する。
 */
export function planDockerRecoveryResourceExpectations(
  input: Readonly<{
    authenticationContainerName: string;
    executionContainerName: string;
    proxyContainerName: string;
    internalNetworkName: string;
    egressNetworkName: string;
    ownershipLabel: string;
    executionImageDigest: string;
    proxyImageDigest: string;
    workspaceMounted: boolean;
    workspaceReadOnly: boolean;
    initRequired: boolean;
    workspaceProtected?: boolean;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
  }>,
): DockerResourceExpectationSet | null {
  try {
    if (
      !input ||
      typeof input !== "object" ||
      types.isProxy(input) ||
      Array.isArray(input)
    )
      return null;
    const stringKeys = [
      "authenticationContainerName",
      "executionContainerName",
      "proxyContainerName",
      "internalNetworkName",
      "egressNetworkName",
      "ownershipLabel",
      "executionImageDigest",
      "proxyImageDigest",
    ] as const;
    const booleanKeys = [
      "workspaceMounted",
      "workspaceReadOnly",
      "initRequired",
    ] as const;
    const keys = [
      ...stringKeys,
      ...booleanKeys,
      ...(Object.hasOwn(input, "workspaceProtected")
        ? ["workspaceProtected" as const]
        : []),
      ...(Object.hasOwn(input, "workspaceProtection")
        ? ["workspaceProtection" as const]
        : []),
    ];
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(
        (key) =>
          typeof key !== "string" ||
          !keys.includes(key as (typeof keys)[number]),
      )
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (
      keys.some(
        (key) => !descriptors[key] || !Object.hasOwn(descriptors[key], "value"),
      )
    )
      return null;
    const raw = {
      authenticationContainerName:
        descriptors.authenticationContainerName.value,
      executionContainerName: descriptors.executionContainerName.value,
      proxyContainerName: descriptors.proxyContainerName.value,
      internalNetworkName: descriptors.internalNetworkName.value,
      egressNetworkName: descriptors.egressNetworkName.value,
      ownershipLabel: descriptors.ownershipLabel.value,
      executionImageDigest: descriptors.executionImageDigest.value,
      proxyImageDigest: descriptors.proxyImageDigest.value,
      workspaceMounted: descriptors.workspaceMounted.value,
      workspaceReadOnly: descriptors.workspaceReadOnly.value,
      initRequired: descriptors.initRequired.value,
      ...(descriptors.workspaceProtected
        ? { workspaceProtected: descriptors.workspaceProtected.value }
        : {}),
      ...(descriptors.workspaceProtection
        ? { workspaceProtection: descriptors.workspaceProtection.value }
        : {}),
    };
    if (
      stringKeys.some((key) => typeof raw[key] !== "string") ||
      booleanKeys.some((key) => typeof raw[key] !== "boolean") ||
      (Object.hasOwn(raw, "workspaceProtected") &&
        typeof raw.workspaceProtected !== "boolean") ||
      (raw.workspaceProtected === true && raw.workspaceMounted !== true)
    )
      return null;
    const captured = raw as Readonly<typeof input>;
    if (
      !/^crdd-auth-[a-f0-9]{16}$/u.test(captured.authenticationContainerName) ||
      !/^crdd-(?:claude|codex)-[a-f0-9]{16}$/u.test(
        captured.executionContainerName,
      ) ||
      !/^crdd-proxy-[a-f0-9]{16}$/u.test(captured.proxyContainerName) ||
      !/^crdd-internal-[a-f0-9]{16}$/u.test(captured.internalNetworkName) ||
      !/^crdd-egress-[a-f0-9]{16}$/u.test(captured.egressNetworkName) ||
      !/^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
        captured.ownershipLabel,
      ) ||
      ![captured.executionImageDigest, captured.proxyImageDigest].every(
        (digest) => /^sha256:[a-f0-9]{64}$/u.test(digest),
      ) ||
      (captured.workspaceProtection &&
        (captured.workspaceProtected !== true ||
          ![
            captured.workspaceProtection.gitSourcePath,
            captured.workspaceProtection.internalSourcePath,
          ].every(
            (value) =>
              typeof value === "string" &&
              path.isAbsolute(value) &&
              !/[\0\r\n,]/u.test(value),
          )))
    )
      return null;
    const order = [
      "create_provider",
      "create_subscription_auth_probe",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ] as const;
    const names = {
      create_provider: captured.executionContainerName,
      create_subscription_auth_probe: captured.authenticationContainerName,
      create_proxy: captured.proxyContainerName,
      create_internal_network: captured.internalNetworkName,
      create_egress_network: captured.egressNetworkName,
    };
    const plan = order.map((purpose) => {
      const network =
        purpose === "create_internal_network" ||
        purpose === "create_egress_network";
      const base: Omit<
        import("../../../docker-isolation/src/cleanup/types.ts").DockerResourceExpectation,
        "dockerId"
      > = {
        key: purpose,
        kind: network ? "network" : "container",
        expectedName: names[purpose],
        ownershipLabel: captured.ownershipLabel,
        expectedImage: network
          ? null
          : purpose === "create_proxy"
            ? captured.proxyImageDigest
            : captured.executionImageDigest,
        shouldBeInternal: network
          ? purpose === "create_internal_network"
          : null,
        expectedNetworks: Object.freeze(
          network
            ? []
            : purpose === "create_subscription_auth_probe"
              ? ["none"]
              : [captured.internalNetworkName],
        ),
        expectedUser: network ? null : "65534:65534",
        expectedMounts: Object.freeze(
          purpose === "create_subscription_auth_probe"
            ? [
                Object.freeze({
                  destination: "/provider-home",
                  readWrite: false,
                  source: null,
                }),
              ]
            : purpose === "create_provider"
              ? [
                  Object.freeze({
                    destination: "/provider-home",
                    readWrite: true,
                    source: null,
                  }),
                  Object.freeze({
                    destination: "/tmp",
                    readWrite: true,
                    source: null,
                  }),
                  ...(captured.workspaceMounted
                    ? [
                        Object.freeze({
                          destination: "/work",
                          readWrite: !captured.workspaceReadOnly,
                          source: null,
                        }),
                      ]
                    : []),
                  ...(captured.workspaceProtected === true
                    ? [
                        Object.freeze({
                          destination: "/work/.git",
                          readWrite: false,
                          source:
                            captured.workspaceProtection?.gitSourcePath ?? null,
                        }),
                        Object.freeze({
                          destination: "/work/.crdd",
                          readWrite: false,
                          source:
                            captured.workspaceProtection?.internalSourcePath ??
                            null,
                        }),
                      ]
                    : []),
                ]
              : [],
        ),
        initRequired: purpose === "create_provider" && captured.initRequired,
        tmpfsBytes: purpose === "create_proxy" ? 16777216 : null,
      };
      return Object.freeze({
        purpose,
        expectations: Object.freeze([
          Object.freeze(base),
          ...(purpose === "create_proxy"
            ? [
                Object.freeze({
                  ...base,
                  expectedNetworks: Object.freeze([
                    captured.internalNetworkName,
                    captured.egressNetworkName,
                  ]),
                }),
              ]
            : []),
        ]),
      });
    });
    return Object.freeze(plan);
  } catch {
    return null;
  }
}
