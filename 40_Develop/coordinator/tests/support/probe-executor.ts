/**
 * Probe移管後の上位Source試験へ実Executor本文と共通DI契約の有限代役を接続する。
 * @responsibility 保存・完了Oracleを維持する。DI技術保証はDIの共通入口試験が検証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope VMのSourceとメモリだけ。実Docker・Process・保存を使わない。
 * @boundary Coordinator実本文→Executor実本文→単一Containerの有限DI代役。
 */
import fs from "node:fs";
import { types } from "node:util";
import { runInNewContext as runVm } from "node:vm";
import type {
  IsolationCallbacks,
  IsolationRequest,
} from "../../../docker-isolation/src/execution/types.ts";
import { DIAGNOSTIC_IMAGE } from "../../../docker-isolation/src/image/assets.ts";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { executeLifecycle } from "../../../executor/src/lifecycle/execute.ts";
import { createLifecycleOperations } from "../../../executor/src/lifecycle/operations.ts";
import { describeIsolationProbeProfile } from "../../../executor/src/probe/configuration.ts";

/**
 * 実上位本文を、移管先の実技術本文へ配線する。
 * @responsibility 旧試験のDI観測点を新Ownerへ接続する。
 * @trace ERB-IT-004
 * @precondition Sourceは現行宣言、依存は各Caseの有限代役だけ。
 * @stimulus 上位本体又は純粋補助のVMコードを評価する。
 * @observation 元の下位要求・通知・結果・私有Mapを観測する。
 * @oracle 上位とExecutorの実宣言を実行し、DIの物理観測成立はこの試験から主張しない。
 * @cleanup 有限Promiseを呼出し試験が待機する。実資源なし。
 * @boundary 二Packageの実本文とDI代役。
 */
export function runInNewContext(
  code: string,
  context: Record<string, unknown> = {},
): unknown {
  if (!code.includes("return runDockerIsolationScenario"))
    return runVm(code, context);
  const source = fs.readFileSync(
    new URL("../../../executor/src/probe/operations.ts", import.meta.url),
    "utf8",
  );
  let profile = "normal";
  let configuration: IsolationRequest | null = null;
  let binding: unknown;
  let observedFacts: unknown = null;
  const invoke = (name: string, ...args: unknown[]) =>
    (context[name] as (...args: unknown[]) => unknown)(...args);
  const lower = runVm(
    `${sourceDeclaration(source, "captureMounts")}\n${sourceDeclaration(source, "notify")}\n${sourceDeclaration(source, "createIsolationProbe")};createIsolationProbe`,
    {
      ...context,
      types,
      AbortController,
      executeLifecycle,
      createLifecycleOperations,
      DIAGNOSTIC_IMAGE,
      describeIsolationProbeProfile,
      classifyIsolationProbeExecution: () => observedFacts,
      prepareIsolation: (request: IsolationRequest) => {
        configuration = request;
        binding = invoke(
          "createDockerProbeRuntimeBinding",
          request.managementDirectory,
        );
        return { resources: { resources: [] } };
      },
      executeIsolation: (_prepared: object, callbacks: IsolationCallbacks) => ({
        cancel: async () => ({
          cancellationRequested: true,
          processTerminationObserved: false,
        }),
        completion: (async () => {
          const request = configuration;
          if (request?.resources.length !== 1 || request.steps.length !== 2)
            throw Error("finite_probe_fixture_invalid");
          const definition = request.resources[0];
          const create = request.steps[0],
            run = request.steps[1];
          if (definition?.kind !== "container" || !create || !run)
            throw Error("finite_probe_fixture_invalid");
          let id: string | null = null;
          let issued = false,
            clean = true;
          let failure: { stage: string; reason: string } | null = null;
          const snapshot = () => ({
            resources: [
              {
                key: "probe",
                identity: {
                  kind: "container" as const,
                  dockerId: id,
                  name: definition.name,
                  ownershipLabel: definition.ownershipLabel,
                },
                request: issued ? ("issued" as const) : ("not_issued" as const),
                configuration: {
                  image: definition.image,
                  command: null,
                  environmentNames: null,
                  mounts: null,
                  networks: null,
                  internal: null,
                },
              },
            ],
          });
          try {
            if (!invoke("observeDockerProbeEngine", binding))
              throw Error("docker_isolation_engine_unconfirmed");
            await callbacks.onSubmitting?.(create);
            issued = true;
            const mounts = Object.fromEntries(
              definition.mounts.map((mount) => [
                mount.target === "/operation/workspace"
                  ? "workspace"
                  : mount.target === "/operation/provider-home"
                    ? "providerHome"
                    : "tmp",
                mount.source,
              ]),
            );
            const created = invoke(
              "createDockerProbeContainer",
              binding,
              profile,
              definition.ownershipLabel.split("=")[1],
              mounts,
            ) as { status: string; id?: string };
            id = created.id ?? null;
            if (created.status !== "confirmed" || !id)
              throw Error("docker_container_identity_unknown");
            invoke("inspectOwnedContainer", binding, definition);
            await callbacks.onCreated?.(create, snapshot());
            await callbacks.onSubmitting?.(run);
            observedFacts = invoke(
              "runDockerProbeToCompletion",
              binding,
              profile,
              id,
            );
            callbacks.onObserved?.(
              run,
              {
                status: 0,
                signal: null,
                stdout: "",
                stderr: "",
                outputExceeded: false,
              },
              0,
              null,
              { category: "completed", stdoutBytes: 0, stderrBytes: 0 },
              "zero",
            );
          } catch (error) {
            failure = {
              stage: id ? "notification" : "observation",
              reason:
                error instanceof Error
                  ? error.message
                  : "docker_isolation_probe_failed",
            };
          }
          if (id)
            clean = (
              invoke("cleanupOwnedContainer", binding, definition) as {
                confirmed: boolean;
              }
            ).confirmed;
          else if (issued) clean = false;
          return {
            failure,
            resources: snapshot(),
            cancellationRequested: false,
            processTerminationConfirmed: true,
            notificationDeliveryConfirmed:
              failure?.stage === "notification" ? false : null,
            callbackRegistrationReleased: true,
            cleanup: {
              confirmed: clean,
              configCleanupConfirmed: true,
              observations: [],
            },
          };
        })(),
      }),
    },
  );
  const run = runVm(code, {
    ...context,
    absenceCapabilities: new WeakMap(),
    createExecutor: (request: object, options: object) =>
      lower(request, options, profile),
  });
  return (owned: unknown, selected: string | null) => {
    profile = selected ?? "normal";
    return run(owned);
  };
}
