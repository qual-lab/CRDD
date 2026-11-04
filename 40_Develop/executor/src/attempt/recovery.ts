/**
 * 保存済みAttemptの投影をDIの技術資源観測・回収へ接続する。
 * @responsibility 元Operation／Recovery相関と用途構成をExecutorで解釈し、実体処置はDIへ渡す。
 * @trace ARCH-000008
 */
import path from "node:path";
import { types as utilTypes } from "node:util";
import {
  cleanupIsolation,
  describeIsolationConfiguration,
  type ResourceTarget as IsolationResourceTarget,
  inspectIsolation,
  type ResourceSnapshot,
} from "../../../docker-isolation/src/index.ts";
import type { ResourceCleanupCallbacks } from "../lifecycle/callbacks.ts";
import type {
  DockerResourceCleanupObservation,
  DockerResourceExpectationSet,
  DockerResourceReceipts,
  ResourceCleanupResult,
  ResourceInspection,
  ResourceTarget,
} from "./types.ts";

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
 * 検査済みのAttempt技術投影をDIの五用途へ結合する。
 * @responsibility 回収順序とDocker構成はDIへ委譲し、保存Schemaを解釈しない。
 * @trace ARCH-000008
 * @input target: 元参照・技術投影・五用途Receipt。
 * @returns 固定五用途の不変期待値と元Receiptから作ったSnapshot。
 * @effect N/A: 値変換だけ。
 * @failure 不正な参照・欠測・Proxy・資源不一致は停止する。
 * @invariant IDだけで処置を許可しない。
 */
function prepareResourceTarget(target: ResourceTarget) {
  if (
    utilTypes.isProxy(target) ||
    target?.kind !== "resource_set" ||
    typeof target.recoveryId !== "string" ||
    target.recoveryId.length === 0 ||
    typeof target.operationId !== "string" ||
    target.operationId.length === 0 ||
    !target.receipts ||
    utilTypes.isProxy(target.receipts) ||
    Object.keys(target.receipts).length !== 5
  )
    throw Error("docker_task_recovery_resource_missing");
  const p = target.projection;
  const entries = planDockerRecoveryResourceExpectations({
    authenticationContainerName: p.authContainerName,
    executionContainerName: p.providerContainerName,
    proxyContainerName: p.proxyContainerName,
    internalNetworkName: p.internalNetworkName,
    egressNetworkName: p.egressNetworkName,
    ownershipLabel: p.ownershipLabel,
    executionImageDigest: p.providerImageDigest,
    proxyImageDigest: p.proxyImageDigest,
    workspaceMounted: p.operationMode === "isolated_task",
    workspaceReadOnly: p.workspaceMountMode === "read_only",
    initRequired: codexAdviceProviderInitRequired(
      p.operationMode,
      p.providerImageDigest,
    ),
    ...(p.workspaceProtected === true
      ? {
          workspaceProtected: true,
          ...(p.workspaceProtection
            ? { workspaceProtection: p.workspaceProtection }
            : {}),
        }
      : {}),
  });
  if (
    !entries ||
    entries.some((entry) => {
      const receipt = target.receipts[entry.purpose];
      return (
        !receipt ||
        utilTypes.isProxy(receipt) ||
        typeof receipt.submitted !== "boolean" ||
        (receipt.dockerId !== null &&
          !/^[a-f0-9]{64}$/u.test(receipt.dockerId)) ||
        (!receipt.submitted && receipt.dockerId !== null)
      );
    })
  )
    throw Error("docker_task_recovery_resource_missing");
  const snapshot: ResourceSnapshot = Object.freeze({
    resources: Object.freeze(
      entries.map((entry) => {
        const e = entry.expectations[0];
        if (!e) throw Error("docker_task_recovery_resource_missing");
        const receipt = target.receipts[entry.purpose];
        return Object.freeze({
          key: entry.purpose,
          identity: Object.freeze({
            kind: e.kind,
            dockerId: receipt.dockerId,
            name: e.expectedName,
            ownershipLabel: e.ownershipLabel,
          }),
          request: receipt.submitted
            ? ("unknown" as const)
            : ("not_issued" as const),
          configuration: Object.freeze({
            image: null,
            command: null,
            environmentNames: null,
            mounts: null,
            networks: null,
            internal: null,
          }),
        });
      }),
    ),
  });
  return { entries, snapshot };
}

/**
 * 選択済みAttempt資源を技術Snapshotとして観測し元の相関へ戻す。
 * @responsibility 限定観測と探索条件を確定し、DIへTask・保存相関を渡さない。
 * @trace ARCH-000008
 * @input target: 元投影とReceipt。purpose: 上位が選んだ限定対象。
 * @returns 元Operation／Recovery IDを保持した観測結果。
 * @effect DIの同期観測だけ。未要求だけなら要求0。
 * @invariant 不明・取消・config終了失敗を成功へ補完しない。
 */
export function inspectAttemptResources(
  target: ResourceTarget,
  purpose?: keyof DockerResourceReceipts,
): ResourceInspection {
  try {
    const prepared = prepareResourceTarget(target);
    const entries = prepared.entries.filter(
      (entry) => purpose === undefined || entry.purpose === purpose,
    );
    if (!entries.length) throw Error("docker_task_recovery_resource_missing");
    target.signal?.throwIfAborted();
    const snapshot: ResourceSnapshot = Object.freeze({
      resources: Object.freeze(
        prepared.snapshot.resources.filter((resource) =>
          entries.some((entry) => entry.purpose === resource.key),
        ),
      ),
    });
    if (
      !snapshot.resources.some((resource) => resource.request !== "not_issued")
    ) {
      return Object.freeze({
        resourceSnapshot: Object.freeze({ resources: Object.freeze([]) }),
        status: "completed",
        operationId: target.operationId,
        recoveryId: target.recoveryId,
        reason: "docker_task_recovery_resources_inspected",
        configCleanupConfirmed: true,
        resources: Object.freeze(
          snapshot.resources.map((resource) =>
            Object.freeze({
              purpose: resource.key as keyof DockerResourceReceipts,
              plannedResourceName: resource.identity.name,
              dockerId: null,
              observation: "not_requested" as const,
              absenceObservations: Object.freeze([]),
            }),
          ),
        ),
      });
    }
    if (!target.managementDirectory)
      throw Error("docker_task_recovery_host_borrow_unconfirmed");
    const limitedAuthentication = purpose === "create_subscription_auth_probe";
    const observed = inspectIsolation(
      {
        managementDirectory: target.managementDirectory,
        resources: snapshot,
        cleanupOrder: entries.map((entry) => entry.purpose),
        setupTimeoutMs: 10000,
        unreceiptedAbsence: limitedAuthentication ? "retain" : "observe",
        verifyLabelAbsence: false,
        previouslyAbsent: [],
        discovery: limitedAuthentication
          ? []
          : entries.map((entry) => ({
              key: entry.purpose,
              configurations: entry.expectations,
            })),
      },
      {
        ...(target.signal ? { signal: target.signal } : {}),
        stopOnUnknownAbsence: limitedAuthentication,
      },
    );
    return Object.freeze({
      ...observed,
      operationId: target.operationId,
      recoveryId: target.recoveryId,
      resources: Object.freeze(
        observed.resources.map(({ key, ...resource }) =>
          Object.freeze({
            ...resource,
            purpose: key as keyof DockerResourceReceipts,
          }),
        ),
      ),
    });
  } catch {
    return Object.freeze({
      resourceSnapshot: Object.freeze({ resources: Object.freeze([]) }),
      status: "blocked",
      operationId: target.operationId,
      recoveryId: target.recoveryId,
      reason: target.managementDirectory
        ? "docker_task_recovery_resource_unconfirmed"
        : "docker_task_recovery_host_borrow_unconfirmed",
      configCleanupConfirmed: true,
      resources: Object.freeze([]),
    });
  }
}

/**
 * 再入場の短命configを取得し、共通回収とcloseを終えて元参照を返す。
 * @responsibility 共通資源処置を再実装せず、取得したconfigだけを一回終了する。
 * @trace ARCH-000008
 * @input target: 保存から復元した技術情報。callbacks: 共通回収通知。
 * @returns 資源回収とconfig終了を分離した同一参照の結果。
 * @effect 固定回収接続の取得・共通回収・自作configの終了。
 * @failure setup・通知・close不明はblocked。同じ参照を保持する。
 * @invariant 通常SessionのProcessやconfigを二重回収しない。
 */
export async function cleanupAttemptResources(
  target: ResourceTarget,
  callbacks: ResourceCleanupCallbacks<
    readonly DockerResourceCleanupObservation[]
  > = {},
): Promise<ResourceCleanupResult> {
  let resources: readonly DockerResourceCleanupObservation[] = [];
  let resourceSnapshot: ResourceSnapshot = Object.freeze({
    resources: Object.freeze([]),
  });
  let dockerCleanupConfirmed = false,
    configCleanupConfirmed = true;
  let reason = "docker_task_recovery_execution_unconfirmed";
  let completed = false;
  let resourcesNoticeIssued = false;
  try {
    const { entries, snapshot } = prepareResourceTarget(target);
    target.signal?.throwIfAborted();
    const submitted = entries.some(
      (entry) => target.receipts[entry.purpose].submitted,
    );

    resourceSnapshot = snapshot;
    if (!submitted) {
      resources = Object.freeze(
        snapshot.resources
          .map((resource) =>
            Object.freeze({
              purpose: resource.key as keyof DockerResourceReceipts,
              plannedResourceName: resource.identity.name,
              dockerId: null,
              observation: "not_requested" as const,
            }),
          )
          .sort((a, b) => a.purpose.localeCompare(b.purpose)),
      );
      dockerCleanupConfirmed = true;
    } else {
      if (!target.managementDirectory)
        throw Error("docker_task_recovery_host_borrow_unconfirmed");
      const execution = cleanupIsolation(
        {
          managementDirectory: target.managementDirectory,
          resources: snapshot,
          cleanupOrder: entries.map((entry) => entry.purpose),
          setupTimeoutMs: 10_000,
          unreceiptedAbsence: "retain",
          verifyLabelAbsence: false,
          previouslyAbsent: target.previouslyAbsent ?? [],
          discovery: entries.map((entry) => ({
            key: entry.purpose,
            configurations: entry.expectations,
          })),
        },
        {
          onCleanupSubmitting: (key) =>
            completeRecoveryNotice(callbacks.onResourceInspecting, key),
          onResourceIdentified: (key, current) => {
            const id = current.resources.find(
              (resource) => resource.key === key,
            )?.identity.dockerId;
            if (!id || !callbacks.onResourceIdentified)
              throw Error("docker_task_recovery_checkpoint_unconfirmed");
            completeRecoveryNotice(callbacks.onResourceIdentified, key, id);
          },
          onResourcesClosed: (snapshot, observations) => {
            resourcesNoticeIssued = true;
            const current = Object.freeze(
              snapshot.resources
                .map((resource) =>
                  Object.freeze({
                    purpose: resource.key as keyof DockerResourceReceipts,
                    plannedResourceName: resource.identity.name,
                    dockerId: resource.identity.dockerId,
                    observation:
                      observations.find((value) => value.key === resource.key)
                        ?.observation ?? ("unknown" as const),
                  }),
                )
                .sort((a, b) => a.purpose.localeCompare(b.purpose)),
            );
            completeRecoveryNotice(callbacks.onResourcesClosed, current);
          },
        },
      );
      const abort = () => {
        void execution.cancel().catch(() => {});
      };
      target.signal?.addEventListener("abort", abort, { once: true });
      if (target.signal?.aborted) abort();
      try {
        const result = await execution.completion;
        resourceSnapshot = result.resources;
        resources = Object.freeze(
          result.resources.resources
            .map((resource) =>
              Object.freeze({
                purpose: resource.key as keyof DockerResourceReceipts,
                plannedResourceName: resource.identity.name,
                dockerId: resource.identity.dockerId,
                observation:
                  result.cleanup.observations.find(
                    (value) => value.key === resource.key,
                  )?.observation ?? ("unknown" as const),
              }),
            )
            .sort((a, b) => a.purpose.localeCompare(b.purpose)),
        );
        configCleanupConfirmed = result.cleanup.configCleanupConfirmed;
        dockerCleanupConfirmed =
          result.processTerminationConfirmed &&
          resources.length === 5 &&
          resources.every((value) => value.observation !== "unknown");
        if (result.failure?.stage === "notification")
          reason = "docker_task_recovery_checkpoint_unconfirmed";
        else if (!dockerCleanupConfirmed)
          reason = "docker_task_recovery_resource_unconfirmed";
        if (result.failure?.stage === "notification")
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
      } finally {
        target.signal?.removeEventListener("abort", abort);
      }
    }
    reason = "docker_task_recovery_checkpoint_unconfirmed";
    if (!resourcesNoticeIssued)
      completeRecoveryNotice(callbacks.onResourcesClosed, resources);
    target.signal?.throwIfAborted();
    completed = dockerCleanupConfirmed;
    reason = completed
      ? "docker_task_recovery_resources_clean"
      : "docker_task_recovery_resource_unconfirmed";
  } catch {
    // 一次理由、元参照、取得済み実IDを保持する。自動再実行はしない。
  }
  try {
    completeRecoveryNotice(callbacks.onCleanupCompleted, resources);
  } catch {
    if (completed) reason = "docker_task_recovery_checkpoint_unconfirmed";
    completed = false;
  }
  return Object.freeze({
    status: completed && configCleanupConfirmed ? "completed" : "blocked",
    reason: !configCleanupConfirmed
      ? "docker_task_recovery_config_cleanup_unconfirmed"
      : reason,
    operationId: target.operationId,
    recoveryId: target.recoveryId,
    dockerCleanupConfirmed,
    configCleanupConfirmed,
    resourceSnapshot,
    resources,
  });
}

/**
 * 公式助言Imageと未解決の旧助言Imageにinitを要求する。
 *
 * @responsibility 起動計画、Effect直前検査と耐久Recoveryで同じinit適用条件を使う。
 * @trace ARCH-000004
 * @input operationMode: 実行方式、imageDigest: 固定Image Identity。
 * @returns 助言方式と現行または回復対象の旧Imageが一致する場合だけtrue。
 * @precondition 呼出し側がcreate_provider以外へ適用しない。
 * @postcondition 通常TaskとClaude助言へ波及させず、旧exact Recoveryの構成を保持する。
 * @effect N/A: 固定Identityを比較するだけである。
 * @failure N/A: 不一致はfalseとして返す。
 * @invariant 専用Imageであることを名前やtagから推測しない。
 * @boundary Provider作成とexactな終了後検査・Recoveryの共通境界。
 * @security 戻り値は削除Authorityではなく構成上の必要条件だけを示す。
 * @concurrency N/A: 同期の純粋比較である。
 */
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
      utilTypes.isProxy(input) ||
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
      const base: IsolationResourceTarget<"snapshot">["discovery"][number]["configurations"][number] =
        {
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
                              captured.workspaceProtection?.gitSourcePath ??
                              null,
                          }),
                          Object.freeze({
                            destination: "/work/.crdd",
                            readWrite: false,
                            source:
                              captured.workspaceProtection
                                ?.internalSourcePath ?? null,
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
