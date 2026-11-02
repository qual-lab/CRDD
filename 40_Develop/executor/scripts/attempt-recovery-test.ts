/**
 * 診断・回収APIの本番本文へ有限のDI代役を接続する試験入口。
 * @packageDocumentation
 * @responsibility 製品公開APIに注入点を追加せず保存側の結合試験を支援する。
 * @trace ERB-IT-014
 * @boundary scripts/tests専用。実Docker・Filesystem書込み・新Authorityを持たない。
 */
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { types as utilTypes } from "node:util";
import { runInNewContext } from "node:vm";
import * as isolation from "../../docker-isolation/src/index.ts";

/**
 * 実関数本文のDI接続だけを代役化する。
 * @responsibility 上位の保存順序を実Executorコードと結合して検査する。
 * @trace ERB-IT-014
 * @input create: 現行cleanupObservedを備える有限DI生成代役。
 * @returns 本番と同じ同期診断・非同期回収API。
 * @effect 固定Sourceの読取りとメモリ内のコード実行だけ。
 * @failure 本文の読取り・型除去・評価失敗は試験へ返す。Cleanup欠測は旧同期処理で補完しない。
 * @invariant 本番Rootの公開契約や実行権限を変更しない。
 */
export function createAttemptRecoveryTestApi(
  create: (
    input: Readonly<{
      managementDirectory: string;
      signal?: AbortSignal;
    }>,
  ) => unknown,
): typeof import("../src/lifecycle/cleanup.ts") {
  const source = readFileSync(
    new URL("../../docker-isolation/src/cleanup/resources.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?from\s*["'][^"']+["'];?\s*/gm, "")
    .replace(/^export /gm, "");
  let cleanupSet: typeof import("../../docker-isolation/src/cleanup/resources.ts").cleanupResourceSet;
  const api = runInNewContext(
    `${body}; ({ inspectResources: inspectDockerResources, cleanupResources: cleanupDockerResources, cleanupSet: cleanupResourceSet })`,
    {
      ...isolation,
      utilTypes,
      cleanupIsolation: (
        request: isolation.IsolationCleanupRequest,
        callbacks: isolation.IsolationCallbacks,
      ) => {
        const signal = new AbortController();
        const created = create({
          managementDirectory: request.managementDirectory,
          signal: signal.signal,
        }) as {
          executor: isolation.DockerResourceRecoveryOperations & {
            close(): boolean;
          };
        };
        const completion = Promise.resolve().then(
          async (): Promise<isolation.IsolationExecutionResult> => {
            const receipts = Object.fromEntries(
              request.resources.resources.map((resource) => [
                resource.key,
                {
                  submitted: resource.request !== "not_issued",
                  dockerId: resource.identity.dockerId,
                },
              ]),
            ) as isolation.DockerResourceReceipts;
            let snapshot = request.resources;
            const result = await cleanupSet(
              {
                expectations: request.discovery.map((entry) => ({
                  purpose: entry.key as keyof isolation.DockerResourceReceipts,
                  expectations: entry.configurations,
                })),
                receipts,
                signal: signal.signal,
                previouslyAbsent:
                  request.previouslyAbsent as (keyof isolation.DockerResourceReceipts)[],
              },
              created.executor,
              {
                onResourceInspecting: (key) => {
                  const returned = callbacks.onCleanupSubmitting?.(key);
                  if (returned !== undefined)
                    throw Error("test_sync_notification_required");
                },
                onResourceIdentified: (key, id) => {
                  snapshot = Object.freeze({
                    resources: Object.freeze(
                      snapshot.resources.map((resource) =>
                        resource.key === key
                          ? Object.freeze({
                              ...resource,
                              identity: Object.freeze({
                                ...resource.identity,
                                dockerId: id,
                              }),
                            })
                          : resource,
                      ),
                    ),
                  });
                  if (!callbacks.onResourceIdentified)
                    throw Error("test_identification_required");
                  const returned = callbacks.onResourceIdentified(
                    key,
                    snapshot,
                  );
                  if (returned !== undefined) {
                    void Promise.resolve(returned).catch(() => {});
                    throw Error("test_sync_notification_required");
                  }
                },
                onResourcesClosed: (observations) => {
                  const returned = callbacks.onResourcesClosed?.(
                    snapshot,
                    observations.map((value) => ({
                      key: value.purpose,
                      observation: value.observation,
                    })),
                  );
                  if (returned !== undefined) {
                    void Promise.resolve(returned).catch(() => {});
                    throw Error("test_sync_notification_required");
                  }
                },
              },
            );
            let closed = false;
            try {
              closed = created.executor.close() === true;
            } catch {}
            return Object.freeze<isolation.IsolationExecutionResult>({
              failure:
                result.reason === "docker_task_recovery_checkpoint_unconfirmed"
                  ? {
                      stepKey: null,
                      stage: "notification",
                      reason: result.reason,
                      notification: "onResourceIdentified",
                      commandHandleObtained: false,
                      responseObserved: false,
                      exceptionCode: null,
                      kind: "threw",
                    }
                  : null,
              resources: snapshot,
              cancellationRequested: signal.signal.aborted,
              processTerminationConfirmed: true,
              notificationDeliveryConfirmed: result.status === "completed",
              callbackRegistrationReleased: true,
              cleanup: {
                confirmed: result.dockerCleanupConfirmed && closed,
                configCleanupConfirmed: closed,
                observations: result.resources.map((resource) => ({
                  key: resource.purpose,
                  observation: resource.observation,
                })),
              },
            });
          },
        );
        return {
          completion,
          cancel: async () => {
            signal.abort();
            return {
              cancellationRequested: true,
              processTerminationObserved: true,
            };
          },
        };
      },
      createDockerTaskRecoveryExecutor: (input: {
        managementDirectory: string;
        signal?: AbortSignal;
      }) => {
        const result = create(input) as {
          executor?: isolation.DockerResourceRecoveryOperations;
        };
        const operations = result.executor;
        if (operations && typeof operations.cleanupObserved !== "function")
          throw Error("test_cleanup_operation_missing");
        return result;
      },
      observeDockerRuntimeRepairRetention: () => {
        throw Error("directory_observation_not_mocked");
      },
      disposeDockerRuntimeRepairDirectory: () => {
        throw Error("directory_cleanup_not_mocked");
      },
    },
  );
  cleanupSet = api.cleanupSet;
  return api;
}
