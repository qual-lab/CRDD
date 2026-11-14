/**
 * 単独試験の記録を製品Executorの公開入口へ結合する。
 * @responsibility 試験Rootの保存と終端受領だけを所有し、実行・Home排他・清掃を複製しない。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary 明示承認された試験専用。実行判断と過去保持物の操作は行わない。
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeIsolation } from "../../docker-isolation/src/index.ts";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
} from "../../execution-model/src/index.ts";
import { observeProviderHome } from "../../executor/scripts/provider-home.ts";
import { readReport, writeReport } from "../../executor/scripts/report.ts";
import { observeRepositoryRuntimeDataArea } from "../../executor/scripts/runtime-data.ts";
import {
  type AttemptDiagnosticNotice,
  type AttemptTerminalObservation,
  type CompletionResult,
  createExecutor,
  type ExecutorCallbacks,
  type ExecutorRequest,
} from "../../executor/src/index.ts";
import { getRepository } from "../../version-control/src/index.ts";

/** 元要求と同じRootに必要な通知を保存し、公開ExecutorのCompletionをjoinする。 @trace ERB-IT-004 */
export function createStandaloneProviderAttemptHost(
  directory: string,
  request: ExecutorRequest<"attempt">,
  onProviderStarted?: () => void,
) {
  const root = fs.realpathSync(directory);
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const verified = getRepository(repository);
  if (verified.status !== "completed") throw Error(verified.reason);
  const area = observeRepositoryRuntimeDataArea(verified.capability, "tests");
  if (area.status !== "ready") throw Error(area.reason);
  const parent = area.directory;
  const relative = path.relative(parent, root);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw Error("standalone_host_root_outside_tests");
  if (
    root.toLowerCase() !== path.resolve(directory).toLowerCase() ||
    fs.lstatSync(root).isSymbolicLink() ||
    fs.readdirSync(root).length
  )
    throw Error("standalone_host_root_invalid");
  const identity = fs.statSync(root, { bigint: true });
  const settings = initializeIsolation({
    windowsDirectory: process.env.SystemRoot ?? "",
    userHomeDirectory: os.userInfo().homedir,
  });
  if (!settings) throw Error("isolation_settings_unavailable");
  const runtime = createExecutor(request, {
    settings,
    paths: {
      tmp: path.join(root, "tmp"),
      management: path.join(root, "management"),
    },
  });
  if (!runtime) throw Error("standalone_host_plan_or_lease_invalid");
  const operationId = request.target.operationId,
    provider = request.selection.provider;
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const requestHash = hash(JSON.stringify(request));
  const recoveryId = `docker-task.${request.target.stableLogicalHomeBindingHash}.${hash(root)}.${requestHash}`;
  const management = {},
    recovery = {};
  let sequence = 0,
    opened = false,
    released = false,
    closed = false,
    terminalAttempted = false,
    homeChecked = false;
  let operationCleanupConfirmed = true,
    homeFailure: string | null = null;
  let resources: OperationResources | null = null;
  let lastPayloadSha256 = requestHash;
  let terminal: AttemptTerminalObservation | null = null;
  let originalResult: CompletionResult<"attempt"> | null = null;
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
  function current(): boolean {
    try {
      const stat = fs.statSync(root, { bigint: true });
      return (
        !fs.lstatSync(root).isSymbolicLink() &&
        stat.dev === identity.dev &&
        stat.ino === identity.ino &&
        stat.birthtimeNs === identity.birthtimeNs &&
        hash(JSON.stringify(request)) === requestHash
      );
    } catch {
      return false;
    }
  }
  function save(kind: string, fields: object = {}): void {
    if (!current()) throw Error("standalone_host_owner_unconfirmed");
    const name = `event-${String(++sequence).padStart(3, "0")}.json`;
    const value = {
      kind,
      recordedAt: new Date().toISOString(),
      operationId,
      provider,
      recoveryId,
      sequence,
      ...fields,
    };
    const written = writeReport(root, name, name, value);
    const read = readReport(written.target, name);
    if (
      read.hash !== written.hash ||
      read.identityText !== written.identityText ||
      JSON.stringify(read.value) !== JSON.stringify(value)
    )
      throw Error("standalone_host_save_unconfirmed");
    lastPayloadSha256 = written.hash;
  }
  const callbacks: ExecutorCallbacks<"attempt"> = {
    onCommandSubmitting: (purpose, frame) => {
      if (!purpose.startsWith("create_")) return;
      // Executorが同じHomeの排他を取得した後、最初の資源Effectより前に再観測する。
      if (!homeChecked) {
        homeChecked = true;
        operationCleanupConfirmed = false;
        const observed = observeProviderHome(
          provider,
          request.target.providerHomeSourcePath,
        );
        operationCleanupConfirmed = observed.filesystemEffectIssued === false;
        if (
          observed.status !== "candidate" ||
          observed.filesystemEffectIssued ||
          ["providerHomeIdentityHash", "stableLogicalHomeBindingHash"].some(
            (key) =>
              Reflect.get(observed, key) !== Reflect.get(request.target, key),
          )
        ) {
          homeFailure = "trial_home_changed_or_unconfirmed";
          throw Error(homeFailure);
        }
      }
      const next = applyResourceEvent(resources, {
        ...frame,
        event: "submission",
        key: purpose,
      });
      if (!next) throw Error("resource_submission_unconfirmed");
      save("submission_planned", { resources: next });
      resources = next;
    },
    onCommandNotIssued: (purpose) => {
      if (!purpose.startsWith("create_")) return;
      const next = applyResourceEvent(resources, {
        event: "not_issued",
        key: purpose,
      });
      if (!next) throw Error("resource_not_issued_unconfirmed");
      save("resource_not_issued", { resources: next });
      resources = next;
    },
    onResourceCreated: (purpose, _id, frame) => {
      const next = applyResourceEvent(resources, {
        ...frame,
        event: "receipt",
        key: purpose,
      });
      if (!next) throw Error("resource_receipt_unconfirmed");
      save("receipt_recorded", { resources: next });
      resources = next;
    },
    onResourceIdentified: (key, frame) => {
      const next = applyResourceEvent(resources, {
        ...frame,
        event: "identified",
        key,
      });
      if (!next) throw Error("resource_receipt_unconfirmed");
      save("receipt_recorded", { resources: next });
      resources = next;
    },
    onProviderSubmitting: () => save("provider_submission"),
    onStarted: () => {
      onProviderStarted?.();
    },
    onCleanupCompleted: (observation) => {
      terminal = observation;
      released = observation.homeLeaseReleased;
      if (
        !released ||
        !observation.processTreeTerminationConfirmed ||
        !observation.containersAbsent ||
        !observation.networksAbsent ||
        !resources ||
        !observation.resourceSnapshot ||
        !observation.resources
      )
        return;
      const next = applyResourceCleanup(
        resources,
        observation.resourceSnapshot,
        observation.resources,
        { recoveryId, previousPayloadSha256: lastPayloadSha256 },
      );
      if (!next || next.checkpoints.some((c) => c.observation === "unknown"))
        throw Error("absence_unconfirmed");
      save("home_released");
      save("absence_observed", { resources: next });
      resources = next;
      save("mount_recorded");
      save("recovery_closed");
      closed = true;
    },
    onDiagnostic: (notice) => {
      if (notice.event !== "coordinator_provider_boundary_settled") return;
      diagnostic = Object.freeze({
        primaryFailure: notice.primaryFailure,
        providerProcessStartedObserved: notice.providerProcessStartedObserved,
        processTreeTerminationObserved: notice.processTreeTerminationObserved,
        containersAbsentObserved: notice.containersAbsentObserved,
        networksAbsentObserved: notice.networksAbsentObserved,
        cleanupConfirmed: notice.cleanupConfirmed,
      });
      if (closed && released) save("execution_settled", diagnostic);
    },
  };
  return Object.freeze({
    runtime,
    management,
    recoveryId,
    get operationCleanupConfirmed() {
      return operationCleanupConfirmed;
    },
    get releaseConfirmed() {
      return released;
    },
    get homeFailure() {
      return homeFailure;
    },
    readDiagnostic: () => diagnostic,
    readTerminal: () => terminal,
    start: () => {
      if (!opened) {
        save("recovery_opened");
        save("recovery_handoff");
        opened = true;
      }
      const started = runtime.start({
        managementCapability: management,
        reference: { recoveryId, recoveryCapability: recovery },
        callbacks,
      });
      if (started.status !== "started") return started;
      return {
        ...started,
        completion: started.completion.then((result) => {
          originalResult = result;
          return result;
        }),
      };
    },
    recordTerminal: (result: CompletionResult<"attempt">) => {
      if (
        result !== originalResult ||
        !terminal ||
        !closed ||
        !released ||
        terminalAttempted ||
        !result.cleanupConfirmed
      )
        return false;
      terminalAttempted = true;
      save("terminal_received", {
        status: result.status,
        reason: result.reason,
        resultSha256: result.resultSha256,
        resultBytes: result.resultBytes,
      });
      return true;
    },
  });
}
