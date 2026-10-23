/**
 * Workbenchの公開HTTP受付を実Provider検証へ接続する。
 *
 * @packageDocumentation
 * @responsibility 検証が内部Applicationを直接呼ばず、公開FormとRead Modelを通ることを保証する。
 * @trace ARCH-000015
 * @boundary 検証Runner→loopback Workbench HTTP。
 * @effect 明示されたHTTP要求だけを発行する。
 * @security Token、Prompt、結果本文を出力せず、自動再送とredirect追従を禁止する。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type {
  WorkbenchAiRequests,
  WorkbenchAiRequestCommand,
} from "../src/server/ai-request/types.ts";
import { inspectWorkbenchClientModel } from "../src/shared/view/validation.ts";

/** 実試験で捕捉する属性の同一性。Filesystem内容の保全証明ではない。 */
export type VerificationDockerInventory = Readonly<{
  containers: readonly Readonly<{
    id: string;
    name: string;
    image: string;
    state: string;
    configurationHash: string;
  }>[];
  networks: readonly Readonly<{
    id: string;
    name: string;
    driver: string;
    scope: string;
    defaultBridge: boolean;
    configurationHash: string;
  }>[];
}>;

const digest = (value: unknown): string => {
  const normalize = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(normalize)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, item]) => [k, normalize(item)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(normalize(value)))
    .digest("hex");
};

/**
 * Dockerを読取りだけで観測する。失敗・過大出力・不完全形はnullで保持する。
 * @trace ERB-IT-021
 * @effect 既存CLIの一覧・inspectだけ。起動／作成／再起動を発行しない。
 * @security inspectの本文・環境変数・Host Pathは出力しない。
 * @boundary 省電力cacheをlive Engineの証明とは扱わない。
 */
export function observeVerificationDockerInventory(): VerificationDockerInventory | null {
  try {
    const record = (v: unknown): v is Record<string, unknown> =>
      v !== null && typeof v === "object" && !Array.isArray(v);
    const nullableRecord = (v: unknown) => v === null || record(v);
    const nullableStrings = (v: unknown) =>
      v === null || (Array.isArray(v) && v.every((s) => typeof s === "string"));
    const docker = (...args: string[]) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        windowsHide: true,
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    const list = (...args: string[]) =>
      docker(...args)
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean);
    const containerIds = list("ps", "-aq", "--no-trunc");
    const networkIds = list("network", "ls", "-q", "--no-trunc");
    if (containerIds.length > 256 || networkIds.length > 256) return null;
    if (
      [...containerIds, ...networkIds].some((id) => !/^[a-f0-9]{64}$/u.test(id))
    )
      return null;
    const inspect = (
      kind: string,
      ids: string[],
    ): Record<string, unknown>[] => {
      if (ids.length === 0) return [];
      const value: unknown = JSON.parse(docker(kind, "inspect", ...ids));
      if (
        !Array.isArray(value) ||
        value.length !== ids.length ||
        value.some((v) => !v || typeof v !== "object")
      )
        throw new Error("inventory_invalid");
      if (
        new Set(ids).size !== ids.length ||
        JSON.stringify(value.map((v) => v.Id).sort()) !==
          JSON.stringify([...ids].sort())
      )
        throw new Error("inventory_identity_changed");
      return value;
    };
    const containers = inspect("container", containerIds).map((v) => {
      const config = v.Config as Record<string, unknown>;
      const state = v.State as Record<string, unknown>;
      if (
        !record(config) ||
        typeof config.User !== "string" ||
        typeof config.WorkingDir !== "string" ||
        !nullableStrings(config.Cmd) ||
        !nullableStrings(config.Entrypoint) ||
        !record(state) ||
        !record(v.HostConfig) ||
        !Array.isArray(v.Mounts)
      )
        throw new Error("container_configuration_unobserved");
      return {
        id: v.Id as string,
        name: v.Name as string,
        image: v.Image as string,
        state: state.Status as string,
        configurationHash: digest({
          image: v.Image,
          user: config.User,
          directory: config.WorkingDir,
          command: config.Cmd,
          entrypoint: config.Entrypoint,
          host: v.HostConfig,
          mounts: v.Mounts,
        }),
      };
    });
    const networks = inspect("network", networkIds).map((v) => {
      if (
        typeof v.Internal !== "boolean" ||
        typeof v.EnableIPv6 !== "boolean" ||
        typeof v.EnableIPv4 !== "boolean" ||
        !record(v.IPAM) ||
        typeof v.IPAM.Driver !== "string" ||
        !(
          v.IPAM.Config === null ||
          (Array.isArray(v.IPAM.Config) && v.IPAM.Config.every(record))
        ) ||
        !nullableRecord(v.IPAM.Options) ||
        !record(v.Containers) ||
        !nullableRecord(v.Options) ||
        !nullableRecord(v.Labels) ||
        typeof v.Attachable !== "boolean" ||
        typeof v.Ingress !== "boolean" ||
        typeof v.ConfigOnly !== "boolean" ||
        !record(v.ConfigFrom)
      )
        throw new Error("network_configuration_unobserved");
      return {
        id: v.Id as string,
        name: v.Name as string,
        driver: v.Driver as string,
        scope: v.Scope as string,
        defaultBridge:
          (v.Options as Record<string, unknown> | null)?.[
            "com.docker.network.bridge.default_bridge"
          ] === "true",
        configurationHash: digest({
          driver: v.Driver,
          scope: v.Scope,
          internal: v.Internal,
          ipv4: v.EnableIPv4,
          ipv6: v.EnableIPv6,
          options: v.Options,
          ipam: v.IPAM,
          labels: v.Labels,
          attachable: v.Attachable,
          ingress: v.Ingress,
          configOnly: v.ConfigOnly,
          configFrom: v.ConfigFrom,
          containers: v.Containers,
        }),
      };
    });
    const value = { containers, networks };
    return validInventory(value) ? value : null;
  } catch {
    return null;
  }
}

function validInventory(value: unknown): value is VerificationDockerInventory {
  if (!value || typeof value !== "object") return false;
  const v = value as VerificationDockerInventory;
  if (!Array.isArray(v.containers) || !Array.isArray(v.networks)) return false;
  const common = (
    items: readonly { id: string; name: string; configurationHash: string }[],
  ) =>
    items.length <= 256 &&
    items.every(
      (r) =>
        r &&
        /^[a-f0-9]{64}$/u.test(r.id) &&
        typeof r.name === "string" &&
        r.name.length > 0 &&
        /^[a-f0-9]{64}$/u.test(r.configurationHash),
    ) &&
    new Set(items.map((r) => r.id)).size === items.length &&
    new Set(items.map((r) => r.name)).size === items.length;
  if (
    !common(v.containers) ||
    !common(v.networks) ||
    v.containers.some(
      (c) =>
        typeof c.image !== "string" ||
        ![
          "created",
          "running",
          "paused",
          "restarting",
          "removing",
          "exited",
          "dead",
        ].includes(c.state),
    )
  )
    return false;
  for (const n of v.networks) {
    if (
      typeof n.driver !== "string" ||
      typeof n.scope !== "string" ||
      typeof n.defaultBridge !== "boolean"
    )
      return false;
    if (
      n.name === "bridge" &&
      (n.driver !== "bridge" || n.scope !== "local" || !n.defaultBridge)
    )
      return false;
    if (
      n.name === "host" &&
      (n.driver !== "host" || n.scope !== "local" || n.defaultBridge)
    )
      return false;
    if (
      n.name === "none" &&
      (n.driver !== "null" || n.scope !== "local" || n.defaultBridge)
    )
      return false;
    if (n.defaultBridge && n.name !== "bridge") return false;
  }
  return ["bridge", "host", "none"].every((name) =>
    v.networks.some((n) => n.name === name),
  );
}

/**
 * 標準NetworkのID世代差、今回の回収、既存資源属性を分離して評価する。
 * @trace ERB-IT-021
 * @effect N/A: 純粋比較。標準資源名だけの例外・欠測の空配列化を禁止する。
 * @boundary 成立は捕捉属性に限定し、全設定・Filesystem内容・Engine生存を保証しない。
 */
export function assessVerificationDockerInventory(
  before: unknown,
  after: unknown,
  cleanupConfirmed: boolean,
) {
  if (!validInventory(before) || !validInventory(after))
    return {
      status: "unknown" as const,
      reason: "docker_inventory_unobserved",
      standardNetworkIdentityChanged: false,
    };
  const system = (name: string) => ["bridge", "host", "none"].includes(name);
  const ordered = <T extends { name: string }>(items: readonly T[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name));
  const same = (a: unknown, b: unknown) => digest(a) === digest(b);
  const standardBefore = ordered(before.networks.filter((n) => system(n.name)));
  const standardAfter = ordered(after.networks.filter((n) => system(n.name)));
  const standardNetworkIdentityChanged = standardBefore.some(
    (n, i) => n.id !== standardAfter[i]?.id,
  );
  const systemConfigurationEqual = same(
    standardBefore.map(({ id: _id, ...rest }) => rest),
    standardAfter.map(({ id: _id, ...rest }) => rest),
  );
  const existingResourceInventoryPreserved =
    same(ordered(before.containers), ordered(after.containers)) &&
    same(
      ordered(before.networks.filter((n) => !system(n.name))),
      ordered(after.networks.filter((n) => !system(n.name))),
    );
  const addedContainers = after.containers
    .filter((a) => !before.containers.some((b) => a.id === b.id))
    .map((a) => a.id);
  const removedContainers = before.containers
    .filter((b) => !after.containers.some((a) => a.id === b.id))
    .map((b) => b.id);
  const addedNetworks = after.networks
    .filter((a) => !before.networks.some((b) => a.id === b.id))
    .map((a) => a.id);
  const removedNetworks = before.networks
    .filter((b) => !after.networks.some((a) => a.id === b.id))
    .map((b) => b.id);
  const status =
    !cleanupConfirmed ||
    [...before.containers, ...after.containers].some(
      (c) => !["created", "exited", "dead"].includes(c.state),
    ) ||
    !existingResourceInventoryPreserved ||
    !systemConfigurationEqual
      ? ("blocked" as const)
      : ("verified" as const);
  return {
    status,
    reason: !cleanupConfirmed
      ? "provider_cleanup_unconfirmed"
      : [...before.containers, ...after.containers].some(
            (c) => !["created", "exited", "dead"].includes(c.state),
          )
        ? "docker_inventory_not_idle"
        : !existingResourceInventoryPreserved
          ? "existing_or_unexpected_resource_changed"
          : !systemConfigurationEqual
            ? "standard_network_configuration_changed"
            : standardNetworkIdentityChanged
              ? "standard_network_identity_changed"
              : "observed_inventory_unchanged",
    standardNetworkIdentityChanged,
    existingResourceInventoryPreserved,
    systemConfigurationEqual,
    addedContainers,
    removedContainers,
    addedNetworks,
    removedNetworks,
  };
}

/**
 * 固定Workbench Routeの応答を受信中の上限付きで取得する。
 *
 * @responsibility 応答の無制限蓄積、redirect追従と暗黙再送を防ぐ。
 * @trace ARCH-000015
 * @input baseUrl、固定Routeと任意Form。
 * @returns Status、Locationと上限内本文。
 * @precondition 呼出し元がloopback URLを検証済み。
 * @postcondition 受信Readerと期限Timerを解放する。
 * @effect GETまたはPOSTを一回だけ発行する。
 * @failure 15秒超過、1MiB超過またはTransport失敗を送出する。
 * @invariant POST失敗を未実行と推定しない。
 * @boundary 検証Runnerと公開HTTP Transport。
 * @security 本文、Tokenおよび例外本文をlogへ出さない。
 * @concurrency 各要求が独立したAbortControllerを所有する。
 */
export async function requestBounded(
  baseUrl: string,
  route: string,
  form?: URLSearchParams,
) {
  const controller = new AbortController();
  let headersReceived = false;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  try {
    const response = await fetch(new URL(route, baseUrl), {
      method: form === undefined ? "GET" : "POST",
      ...(form === undefined
        ? {}
        : { body: form, headers: { origin: new URL(baseUrl).origin } }),
      redirect: "manual",
      signal: controller.signal,
    });
    headersReceived = true;
    const reader = response.body?.getReader();
    if (reader === undefined)
      throw new Error("workbench_verification_body_missing");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let failureClass: "body_limit" | "read_failed" | null = null;
    let ended = false;
    let cleanupConfirmed = false;
    try {
      for (;;) {
        const item = await reader.read();
        if (item.done) {
          ended = true;
          break;
        }
        bytes += item.value.byteLength;
        if (bytes > 1024 * 1024) {
          failureClass = "body_limit";
          throw new Error("workbench_verification_body_limit");
        }
        chunks.push(item.value);
      }
    } catch {
      failureClass ??= "read_failed";
    } finally {
      cleanupConfirmed = ended;
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (!ended) {
          controller.abort();
          cleanupConfirmed = await Promise.race([
            reader.cancel().then(
              () => true,
              () => false,
            ),
            new Promise<boolean>((resolve) => {
              cleanupTimer = setTimeout(() => resolve(false), 1000);
            }),
          ]);
        }
      } finally {
        if (cleanupTimer !== undefined) clearTimeout(cleanupTimer);
        try {
          reader.releaseLock();
        } catch {
          cleanupConfirmed = false;
        }
      }
    }
    if (!cleanupConfirmed)
      throw new Error("workbench_verification_reader_cleanup_unknown", {
        cause: Object.freeze({
          failureClass,
          timedOut,
        }),
      });
    if (failureClass !== null)
      throw new Error("workbench_verification_response_incomplete", {
        cause: Object.freeze({
          failureClass,
          timedOut,
        }),
      });
    return {
      status: response.status,
      location: response.headers.get("location"),
      body: Buffer.concat(chunks).toString("utf8"),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("workbench_verification_")
    )
      throw error;
    throw new Error("workbench_verification_transport_failed", {
      cause: Object.freeze({
        failureClass: headersReceived ? "read_failed" : "headers_unobserved",
        timedOut,
        transportCode:
          error instanceof Error &&
          error.cause instanceof Error &&
          "code" in error.cause &&
          typeof error.cause.code === "string" &&
          /^(?:ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT|UND_ERR_(?:SOCKET|CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT))$/u.test(
            error.cause.code,
          )
            ? error.cause.code
            : null,
      }),
    });
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

/**
 * 試験器の通信失敗を秘密本文なしの有限診断へ投影する。
 * @trace ERB-IT-021
 * @input 同じ試験器が送出した例外。
 * @returns 固定理由、観測段階、期限超過、既知code。未知例外はnull。
 * @effect なし。
 * @security URL・Token・本文・自由な例外messageを返さない。
 */
export function projectVerificationTransportFailure(error: unknown) {
  if (
    !(error instanceof Error) ||
    ![
      "workbench_verification_transport_failed",
      "workbench_verification_response_incomplete",
      "workbench_verification_reader_cleanup_unknown",
      "workbench_verification_body_limit",
      "workbench_verification_body_missing",
    ].includes(error.message)
  )
    return null;
  const cause = error.cause;
  const detail =
    cause !== null && typeof cause === "object"
      ? (cause as Record<string, unknown>)
      : {};
  return Object.freeze({
    reason: error.message,
    failureClass:
      typeof detail.failureClass === "string" &&
      ["headers_unobserved", "read_failed", "body_limit"].includes(
        detail.failureClass,
      )
        ? detail.failureClass
        : null,
    timedOut: typeof detail.timedOut === "boolean" ? detail.timedOut : null,
    transportCode:
      typeof detail.transportCode === "string" &&
      /^(?:ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT|UND_ERR_(?:SOCKET|CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT))$/u.test(
        detail.transportCode,
      )
        ? detail.transportCode
        : null,
  });
}

/**
 * 公開JSONからMain Viewだけを受理する。
 *
 * @responsibility 既存の結果parserを維持して公開モデルを検証する。
 * @trace ARCH-000015
 * @input 検証済みloopback baseUrl。
 * @returns Main Viewのモデル。
 * @precondition Workbench Listenerが起動している。
 * @postcondition 別Viewを結果として返さない。
 * @effect 公開Read ModelへGETを一回発行する。
 * @failure 非200、不正JSONまたは不正モデルを拒否する。
 * @invariant 観測失敗を結果なしへ変換しない。
 * @boundary 公開Read Model→検証Oracle。
 * @security 取得本文はmemory内だけで扱う。
 * @concurrency N/A: 一要求の読取りに閉じる。
 */
export async function readMain(baseUrl: string) {
  const response = await requestBounded(
    baseUrl,
    "/api/workbench-view?route=%2F",
  );
  assert.equal(response.status, 200, "workbench_verification_model_status");
  const model = inspectWorkbenchClientModel(JSON.parse(response.body));
  if (model.view !== "main")
    throw new Error("workbench_verification_main_required");
  return model;
}

/**
 * 本番Applicationへの直呼出しを公開HTTP操作へ置き換える。
 *
 * @responsibility 同じrequestId、modeと固定選定を公開結果から照合する。
 * @trace ARCH-000015
 * @input 起動済みWorkbenchのloopback URL。
 * @returns start／observe／cancelと候補確認・破棄の検証用接続部。採用操作は含めない。
 * @precondition CallerがListenerと本番Applicationの終了・回復を所有する。
 * @postcondition 内部Application、署名またはProviderへ直接アクセスしない。
 * @effect 操作Tokenを読み、明示された公開HTTP操作を発行する。
 * @failure POSTの観測失敗はoutcome unknownとして停止し、自動再送しない。
 * @invariant 303だけをAI完了と表示しない。Listener終了はProvider回収を意味しない。
 * @boundary 検証Runner→公開Workbench受付→注入された本番Application。
 * @security 送信確認を自動付与せず、PROJECT_CONTEXT.mdだけを正式入力にする。
 * @concurrency 一Sessionで一依頼ずつ実行するCaller契約。
 */
export async function createWorkbenchAiVerificationHttpClient(
  baseUrl: string,
): Promise<WorkbenchAiRequests> {
  const url = new URL(baseUrl);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error("workbench_verification_loopback_required");
  const initial = await readMain(baseUrl);
  const token = initial.actionToken;
  const accepted = new Map<string, WorkbenchAiRequestCommand>();
  return Object.freeze<WorkbenchAiRequests>({
    start: async (request) => {
      if (
        request.contextReferences.length !== 1 ||
        request.contextReferences[0] !== "PROJECT_CONTEXT.md"
      )
        throw new Error("workbench_verification_context_mismatch");
      const previous = (await readMain(baseUrl)).aiRequest.snapshot?.requestId;
      try {
        const response = await requestBounded(
          baseUrl,
          "/ai-request/action",
          new URLSearchParams({
            actionToken: token,
            operation: "start",
            mode: request.mode,
            workspaceId: request.workspaceId ?? "",
            workType: request.workType ?? "",
            choice: request.choice ? JSON.stringify(request.choice) : "",
            prompt: request.prompt,
            allowedPaths: request.allowedPaths.join("\n"),
            externalSendConfirmed: request.externalSendConfirmed ? "yes" : "no",
            expectedNetworkPolicyHash: request.expectedNetworkPolicyHash,
          }),
        );
        if (response.status === 400 && !request.externalSendConfirmed)
          return {
            status: "blocked",
            requestId: null,
            reason: "workbench_ai_http_request_rejected",
          };
        assert.equal(
          response.status,
          303,
          "workbench_verification_start_status",
        );
        assert.equal(
          response.location,
          "/#ai-request",
          "workbench_verification_start_location",
        );
        const snapshot = (await readMain(baseUrl)).aiRequest.snapshot;
        if (snapshot === null || snapshot.requestId === previous)
          throw new Error("workbench_ai_http_start_identity_unknown");
        assert.equal(snapshot.mode, request.mode);
        if (snapshot.executionSelection) {
          assert.equal(snapshot.executionSelection.workType, request.workType);
          if (request.choice) {
            assert.equal(
              snapshot.executionSelection.provider,
              request.choice.provider,
            );
            assert.equal(
              snapshot.executionSelection.modelIdentifier,
              request.choice.model,
            );
            assert.equal(
              snapshot.executionSelection.reasoningEffort,
              request.choice.effort,
            );
          }
        }
        accepted.set(snapshot.requestId, request);
        return {
          status: "accepted",
          requestId: snapshot.requestId,
          reason: null,
        };
      } catch (error) {
        const observed = await readMain(baseUrl).catch(() => null);
        const snapshot = observed?.aiRequest.snapshot;
        const requestId =
          snapshot != null &&
          snapshot.requestId !== previous &&
          snapshot.mode === request.mode &&
          (snapshot.executionSelection === null ||
            snapshot.executionSelection.workType === request.workType)
            ? snapshot.requestId
            : null;
        if (requestId !== null) accepted.set(requestId, request);
        throw new Error("workbench_ai_http_start_outcome_unknown", {
          cause: Object.freeze({
            requestId,
            transportFailure:
              error instanceof Error &&
              error.message === "workbench_verification_reader_cleanup_unknown"
                ? "reader_cleanup_unknown"
                : "response_or_observation_failed",
            ...(error instanceof Error &&
            error.message.startsWith("workbench_verification_")
              ? { transportCause: error.cause }
              : {}),
          }),
        });
      }
    },
    observe: async (requestId) => {
      const command = accepted.get(requestId);
      if (command === undefined)
        throw new Error("workbench_verification_request_unknown");
      const snapshot = (await readMain(baseUrl)).aiRequest.snapshot;
      if (snapshot === null)
        throw new Error("workbench_verification_snapshot_missing");
      assert.equal(snapshot.requestId, requestId);
      assert.equal(snapshot.mode, command.mode);
      if (snapshot.executionSelection)
        assert.equal(snapshot.executionSelection.workType, command.workType);
      return snapshot;
    },
    cancel: async (requestId) => {
      const command = accepted.get(requestId);
      if (command === undefined)
        throw new Error("workbench_verification_request_unknown");
      const response = await requestBounded(
        baseUrl,
        "/ai-request/action",
        new URLSearchParams({
          actionToken: token,
          operation: "cancel",
          requestId,
        }),
      );
      assert.equal(
        response.status,
        303,
        "workbench_verification_cancel_status",
      );
      assert.equal(
        response.location,
        "/#ai-request",
        "workbench_verification_cancel_location",
      );
      const snapshot = (await readMain(baseUrl)).aiRequest.snapshot;
      if (snapshot === null)
        throw new Error("workbench_verification_snapshot_missing");
      assert.equal(snapshot.requestId, requestId);
      assert.equal(snapshot.mode, command.mode);
      if (snapshot.executionSelection)
        assert.equal(snapshot.executionSelection.workType, command.workType);
      return snapshot;
    },
  });
}
