/**
 * 単独試験の元参照・有限記録・Home排他を一試行へ結合する。
 * @packageDocumentation
 * @responsibility 製品Hostを複製せず、試験Root内の同期保存と既存Executorだけを組み立てる。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary scripts専用。認証・排他取得・Docker起動は呼出し側の明示承認を必要とする。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  writeCommittedJson,
  readCommittedJson,
} from "../../domain-model/src/index.ts";
import type { acquireNamedPipeKernelLock } from "../../platform-access/src/index.ts";
import type { DockerResourceReceipts } from "../../docker-isolation/src/index.ts";
import {
  createExecutor,
  isPrimaryFailureDiagnostic,
  type AttemptDiagnosticNotice,
  type ExecutorHost,
} from "../src/index.ts";
import {
  planIdentity,
  resolveValidatedPlan,
} from "../src/attempt/isolation.ts";
import type { PreparedPlan } from "../src/attempt/types.ts";

/**
 * 既存同期排他を保持した一回限りの試験Hostを組み立てる。
 * @responsibility 元Capability・資源Receipt・終端を同じ保存列へ接続する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @input directory: 検証済み新品試験Root。plan: 現Homeを再観測済みの固定計画。lease: 同じHomeの保持中排他。
 * @returns 固定一試行の開始・取消・結果記録だけ。生Writerは公開しない。
 * @precondition 呼出し側がRoot・Home観測・同意・固定Image・選定と排他取得を確認する。
 * @postcondition 同期保存が成立する前に発行・終了を成功化しない。
 * @effect 試験Rootに非秘密の確定JSONを保存し、明示start後にだけ固定Executorを呼ぶ。
 * @failure 保存・相関・生存・解放の拒否は停止し、記録や資源を強制削除しない。
 * @invariant 本番Runtime state・Coordinator内部・新Registry・回復Frameworkを使用しない。
 * @boundary 試験Hostと既存Executor／Domain確定JSON／既存同期排他。
 * @security Home Path・四Hashの個別field・Provider生出力・認証内容を保存しない。既存形式の回復参照だけを保持する。
 * @concurrency completionまで元排他を保持し、技術清掃後の同期解放状態だけを記録する。Worker exitの証明ではない。
 */
export function createStandaloneProviderAttemptHost(
  directory: string,
  plan: PreparedPlan & { readonly consumer: "coordinator_cli" },
  lease: NonNullable<ReturnType<typeof acquireNamedPipeKernelLock>>,
  onProviderStarted?: () => void,
) {
  const root = fs.realpathSync(directory);
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const parent = path.join(repository, ".crdd", "tests");
  const relative = path.relative(parent, root);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("standalone_host_root_outside_tests");
  for (const ancestor of [path.dirname(parent), parent]) {
    if (
      fs.lstatSync(ancestor).isSymbolicLink() ||
      fs.realpathSync(ancestor).toLowerCase() !== ancestor.toLowerCase()
    )
      throw new Error("standalone_host_parent_invalid");
  }
  if (
    root.toLowerCase() !== path.resolve(directory).toLowerCase() ||
    fs.lstatSync(root).isSymbolicLink() ||
    fs.readdirSync(root).length !== 0
  )
    throw new Error("standalone_host_root_invalid");
  const identity = fs.statSync(root, { bigint: true });
  const planHash = planIdentity(plan);
  const temporary = path.join(root, "tmp");
  if (!resolveValidatedPlan(plan, temporary) || !lease.assertLive())
    throw new Error("standalone_host_plan_or_lease_invalid");
  const management = {},
    prepared = {},
    recovery = {},
    finalization = {};
  const recoveryId = `docker-task.${plan.stableLogicalHomeBindingHash}.${createHash("sha256").update(root).digest("hex")}.${planHash}`;
  const expected = {
    create_provider: plan.providerContainerName,
    create_proxy: plan.proxyContainerName,
    create_subscription_auth_probe: plan.authContainerName,
    create_internal_network: plan.internalNetworkName,
    create_egress_network: plan.egressNetworkName,
  };
  const receipts: Record<
    keyof DockerResourceReceipts,
    { submitted: boolean; dockerId: string | null }
  > = {
    create_provider: { submitted: false, dockerId: null },
    create_proxy: { submitted: false, dockerId: null },
    create_subscription_auth_probe: { submitted: false, dockerId: null },
    create_internal_network: { submitted: false, dockerId: null },
    create_egress_network: { submitted: false, dockerId: null },
  };
  let sequence = 0,
    consumed = false,
    authorityConsumed = false,
    opened = false;
  let terminalAttempted = false;
  let terminalResult: object | null = null;
  let terminalObservation:
    | Parameters<NonNullable<ExecutorHost["recordTerminalObservation"]>>[2]
    | null = null;
  let recoverySaveFailed = false;
  let releaseAttempted = false,
    released = false,
    closed = false;
  let absence: Parameters<NonNullable<ExecutorHost["recordDockerAbsence"]>>[1] =
    null;
  let mountResult: Readonly<{ status: string }> | null = null;
  let runtime: ReturnType<typeof createExecutor>;
  let diagnostic: Readonly<
    Pick<
      Extract<
        AttemptDiagnosticNotice,
        { event: "coordinator_provider_boundary_settled" }
      >,
      | "primaryFailure"
      | "providerProcessStartedObserved"
      | "processTreeTerminationObserved"
      | "containersAbsentObserved"
      | "networksAbsentObserved"
      | "cleanupConfirmed"
    >
  > | null = null;
  /** 現Root・元計画と必要な保持状態を再確認する。
   * @responsibility 別Ownerや差替え後の保存を拒否する。
   * @trace ERB-IT-004
   * @input held: 生きたHome排他を必要とするか。
   * @returns 現在の局所確認結果。
   * @effect 試験Root metadataと既存排他状態の読取り。
   * @failure 例外はfalseへ閉じる。
   * @boundary 試験Rootと元排他。認証確認ではない。
   */
  function current(held: boolean) {
    try {
      const stat = fs.statSync(root, { bigint: true });
      return (
        !fs.lstatSync(root).isSymbolicLink() &&
        stat.dev === identity.dev &&
        stat.ino === identity.ino &&
        stat.birthtimeNs === identity.birthtimeNs &&
        planIdentity(plan) === planHash &&
        (held ? !releaseAttempted && lease.assertLive() : released)
      );
    } catch {
      return false;
    }
  }
  /** 非秘密の固定イベントを保存し同じ本文を読戻しする。
   * @responsibility 保存失敗をcallback成功へ変換しない。
   * @trace ERB-IT-002
   * @input kindと固定用途の非秘密field。
   * @returns 保存と読戻しが成立した場合だけtrue。
   * @effect 今回Rootの連番JSON保存。
   * @failure 拒否は例外。再試行しない。
   * @boundary 試験専用記録。製品Storeではない。
   */
  function save(kind: string, fields: object = {}, held = true) {
    if (!current(held)) throw new Error("standalone_host_owner_unconfirmed");
    const name = `event-${String(++sequence).padStart(3, "0")}.json`;
    const value = {
      kind,
      recordedAt: new Date().toISOString(),
      operationId: plan.operationId,
      provider: plan.provider,
      recoveryId,
      sequence,
      ...fields,
    };
    const written = writeCommittedJson(root, name, name, value);
    const read = readCommittedJson(written.target, name);
    if (
      read.hash !== written.hash ||
      read.identityText !== written.identityText ||
      JSON.stringify(read.value) !== JSON.stringify(value)
    )
      throw new Error("standalone_host_save_unconfirmed");
    return true;
  }
  const host: ExecutorHost = {
    reportProviderProcessStarted: async (notice) => {
      if (
        notice.event !== "coordinator_provider_process_started" ||
        notice.operationId !== plan.operationId ||
        notice.provider !== plan.provider ||
        notice.taskRole !== plan.taskRole ||
        !current(true)
      )
        return false;
      onProviderStarted?.();
      return true;
    },
    reportProviderBoundaryDiagnostic: async (notice) => {
      if (
        notice.event !== "coordinator_provider_boundary_settled" ||
        notice.operationId !== plan.operationId ||
        notice.provider !== plan.provider ||
        notice.recoveryId !== recoveryId ||
        diagnostic !== null ||
        !isPrimaryFailureDiagnostic(notice.primaryFailure)
      )
        return false;
      const projection = {
        primaryFailure: notice.primaryFailure,
        providerProcessStartedObserved: notice.providerProcessStartedObserved,
        processTreeTerminationObserved: notice.processTreeTerminationObserved,
        containersAbsentObserved: notice.containersAbsentObserved,
        networksAbsentObserved: notice.networksAbsentObserved,
        cleanupConfirmed: notice.cleanupConfirmed,
      };
      if (
        Object.entries(projection).some(
          ([key, value]) =>
            key !== "primaryFailure" && typeof value !== "boolean",
        )
      )
        return false;
      diagnostic = Object.freeze(projection);
      // 解放拒否・不明後はWriterを呼ばず、同じ結果IPCでだけ搬送する。
      if (released) save("execution_settled", projection, false);
      return true;
    },
    verifyRevision: (m) => m === management && current(!released),
    consumePreparedPlan: (p, m) => {
      if (p !== prepared || m !== management || consumed || !current(true))
        return null;
      consumed = true;
      return plan;
    },
    consumeProviderAuthority: (a, mt, m) => {
      if (
        a !== plan.authorityUseCapability ||
        mt !== plan.activeMountCapability ||
        m !== management ||
        authorityConsumed ||
        !current(true)
      )
        return null;
      authorityConsumed = true;
      return {
        operationId: plan.operationId,
        provider: plan.provider,
        providerHomeMountGrantRef: plan.grantRef,
        runtimeAuthorityIssued: true,
        providerEffectAllowed: true,
      };
    },
    beginRecovery: (p, m) => {
      if (
        planIdentity(p) !== planHash ||
        p.activeMountCapability !== plan.activeMountCapability ||
        p.authorityUseCapability !== plan.authorityUseCapability ||
        m !== management ||
        opened ||
        !current(true)
      )
        return null;
      try {
        save("recovery_opened");
      } catch {
        recoverySaveFailed = true;
        return {
          status: "blocked",
          reason: "docker_task_recovery_checkpoint_failed",
          recoveryId,
          manualRecoveryRequired: true,
        };
      }
      opened = true;
      return { status: "ready", recoveryId, recoveryCapability: recovery };
    },
    verifyRecoveryBinding: (r, id, m, h) =>
      opened &&
      r === recovery &&
      id === recoveryId &&
      m === management &&
      h === plan.stableLogicalHomeBindingHash &&
      current(true),
    borrowPaths: (m) => {
      if (m !== management || !current(true))
        throw new Error("standalone_host_path_borrow_rejected");
      return { tmp: temporary, management: path.join(root, "management") };
    },
    inspectReceipts: (r) =>
      r === recovery && opened && current(true)
        ? (Object.freeze(
            Object.fromEntries(
              Object.entries(receipts).map(([key, value]) => [
                key,
                Object.freeze({ ...value }),
              ]),
            ),
          ) as DockerResourceReceipts)
        : null,
    markResourceSubmission: (r, purpose) => {
      if (r !== recovery || !Object.hasOwn(expected, purpose)) return false;
      const key = purpose as keyof DockerResourceReceipts;
      if (receipts[key].submitted) return false;
      save("submission_planned", {
        purpose,
        plannedResourceName: expected[key],
        ownershipLabel: plan.ownershipLabel,
      });
      receipts[key].submitted = true;
      return true;
    },
    recordResourceReceipt: (r, purpose, rawId) => {
      const id = typeof rawId === "string" ? rawId.trim() : "";
      if (
        r !== recovery ||
        !Object.hasOwn(expected, purpose) ||
        !/^[a-f0-9]{64}$/u.test(id)
      )
        return false;
      const key = purpose as keyof DockerResourceReceipts;
      if (!receipts[key].submitted || receipts[key].dockerId !== null)
        return false;
      save("receipt_recorded", { purpose, dockerId: id });
      receipts[key].dockerId = id;
      return true;
    },
    recordProviderSubmission: (r) =>
      r === recovery && save("provider_submission"),
    recordResourceNotIssued: (r, purpose) => {
      if (r !== recovery || !Object.hasOwn(expected, purpose)) return false;
      const key = purpose as keyof DockerResourceReceipts;
      if (receipts[key].dockerId !== null) return false;
      save("resource_not_issued", { purpose });
      receipts[key].submitted = false;
      return true;
    },
    recordTerminalObservation: (r, result, observation) => {
      if (
        r !== recovery ||
        observation.operationId !== plan.operationId ||
        observation.recoveryId !== recoveryId ||
        terminalResult !== null
      )
        throw Error("terminal_delivery_mismatch");
      terminalResult = result;
      terminalObservation = observation;
    },
    recordDockerAbsence: (r, observed) => {
      if (
        r !== recovery ||
        !observed ||
        observed.length !== Object.keys(expected).length ||
        new Set(observed.map((value) => value.purpose)).size !==
          observed.length ||
        observed.some(
          (value) =>
            !Object.hasOwn(expected, value.purpose) ||
            value.plannedResourceName !== expected[value.purpose] ||
            value.observation === "unknown" ||
            (value.observation === "not_requested" &&
              receipts[value.purpose].submitted) ||
            value.dockerId !== receipts[value.purpose].dockerId,
        )
      )
        return false;
      save("absence_observed", { resources: observed });
      absence = observed;
      return true;
    },
    completeMount: (mt, m) => {
      if (
        mt !== plan.activeMountCapability ||
        m !== management ||
        (!absence && !recoverySaveFailed) ||
        releaseAttempted ||
        !current(true)
      )
        return { status: "blocked" };
      if (!recoverySaveFailed) save("home_release_requested");
      releaseAttempted = true;
      try {
        released = lease.release() === true;
      } catch {
        released = false;
      }
      if (!released) return { status: "blocked" };
      if (!recoverySaveFailed) save("home_released", {}, false);
      mountResult = Object.freeze({ status: "completed" });
      return mountResult;
    },
    recordMountCompletion: (r, value) =>
      r === recovery &&
      value === mountResult &&
      released &&
      save("mount_recorded", {}, false),
    completeRecovery: (r, m, completion) => {
      if (
        r !== recovery ||
        m !== management ||
        completion.plan !== plan ||
        completion.mountCompletion !== mountResult ||
        !released ||
        closed ||
        runtime.verifyCleanupOutcome(
          completion.cleanupOutcome,
          plan,
          recovery,
          management,
        ) !== absence
      )
        return { status: "blocked" };
      save("recovery_closed", {}, false);
      closed = true;
      return {
        status: "completed",
        recoveryFinalizationCapability: finalization,
      };
    },
    verifyHomeLeaseRelease: (r, m, op, id) =>
      r === recovery &&
      m === management &&
      op === plan.operationId &&
      id === recoveryId &&
      released &&
      current(false),
  };
  runtime = createExecutor(host);
  return Object.freeze({
    runtime,
    prepared,
    management,
    recovery,
    recoveryId,
    readDiagnostic: () => diagnostic,
    readTerminal: () => terminalObservation,
    start: () =>
      runtime.start(
        prepared,
        management,
        (r: object, id: string) =>
          r === recovery && id === recoveryId && save("recovery_handoff"),
      ),
    recordTerminal: (
      result: Awaited<ReturnType<typeof runtime.start>["completion"]>,
    ) => {
      if (!result) return false;
      const terminal = terminalResult === result ? terminalObservation : null;
      if (
        !terminal ||
        terminal.resources !== absence ||
        !closed ||
        !released ||
        terminalAttempted ||
        terminal.homeLeaseReleased !== true ||
        result.cleanupConfirmed !== true
      )
        return false;
      terminalAttempted = true;
      return save(
        "terminal_received",
        {
          status: result.status,
          reason: result.reason,
          resultSha256: result.resultSha256,
          resultBytes: result.resultBytes,
        },
        false,
      );
    },
  });
}
