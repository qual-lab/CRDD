/**
 * 共通隔離入力を通常dataへ固定し、固定Docker構成へ変換する。
 * @responsibility 技術構成・Directory・公開する非秘密投影を所有する。
 * @trace ARCH-000008
 */
import path from "node:path";
import fs from "node:fs";
import { types } from "node:util";
import {
  describeDockerProviderAssets,
  resolveDockerImageProfile,
} from "../image/assets.ts";
import type { ResourceSnapshot } from "../cleanup/types.ts";
import type {
  IsolationContainer,
  IsolationRequest,
  IsolationCleanupRequest,
} from "./types.ts";
import { dockerResourceLocatorIsValid } from "../cleanup/validation.ts";
import { prepareDockerNetworkPolicy } from "../network/policy.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "./plan.ts";

const MOUNT_TARGETS = new Set([
  "/provider-home",
  "/tmp",
  "/work",
  "/work/.git",
  "/work/.crdd",
  "/operation/workspace",
  "/operation/provider-home",
  "/operation/tmp",
]);

/** getter・Proxy・疎配列・循環参照を実行入力へ持ち込まない。 */
function capture(value: unknown, active = new Set<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    active.has(value)
  )
    throw Error("docker_isolation_input_invalid");
  const array = Array.isArray(value);
  if (
    !array &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw Error("docker_isolation_input_invalid");
  if (array && Reflect.ownKeys(value).length !== value.length + 1)
    throw Error("docker_isolation_input_invalid");
  active.add(value);
  const result: Record<string, unknown> | unknown[] = array
    ? []
    : Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw Error("docker_isolation_input_invalid");
    if (
      array &&
      (!/^(0|[1-9][0-9]*)$/u.test(key) ||
        !Number.isSafeInteger(Number(key)) ||
        Number(key) >= value.length)
    )
      throw Error("docker_isolation_input_invalid");
    Object.defineProperty(result, key, {
      value: capture(descriptor.value, active),
      enumerable: true,
    });
  }
  active.delete(value);
  return Object.freeze(result);
}

/** 宣言した技術field以外を実行へ採用しない。 */
function fields(value: object, expected: string): void {
  if (
    Object.keys(value).sort().join(",") !== expected.split(",").sort().join(",")
  )
    throw Error("docker_isolation_input_invalid");
}

/** 入力の参照・順序と固定隔離制約を検査し、可変参照を分離する。 */
export function captureIsolationRequest(
  value: IsolationRequest,
): IsolationRequest {
  const captured = capture(value) as IsolationRequest;
  fields(
    captured,
    "managementDirectory,resources,steps,cleanupOrder,setupTimeoutMs,unreceiptedAbsence,verifyLabelAbsence" +
      (Object.hasOwn(captured, "proxy") ? ",proxy" : ""),
  );
  const input = configureProxy(captured);
  const absolute = (v: unknown): v is string =>
    typeof v === "string" &&
    path.isAbsolute(v) &&
    path.resolve(v) === v &&
    !/[\0\r\n,]/u.test(v);
  const timeout = (v: unknown): v is number =>
    typeof v === "number" &&
    Number.isSafeInteger(v) &&
    v > 0 &&
    v <= 2_147_483_647;
  if (
    !absolute(input.managementDirectory) ||
    !timeout(input.setupTimeoutMs) ||
    !Array.isArray(input.resources) ||
    !Array.isArray(input.steps) ||
    !input.steps.length ||
    !Array.isArray(input.cleanupOrder)
  )
    throw Error("docker_isolation_input_invalid");
  if (
    !["retain", "observe"].includes(input.unreceiptedAbsence) ||
    typeof input.verifyLabelAbsence !== "boolean"
  )
    throw Error("docker_isolation_input_invalid");
  const key = (v: unknown): v is string =>
    typeof v === "string" && /^[a-z][a-z0-9_-]{0,127}$/u.test(v);
  const resources = new Map<string, IsolationRequest["resources"][number]>(),
    names = new Set<string>();
  for (const r of input.resources) {
    if (
      !r ||
      !key(r.key) ||
      resources.has(r.key) ||
      typeof r.name !== "string" ||
      names.has(r.name) ||
      typeof r.ownershipLabel !== "string" ||
      !dockerResourceLocatorIsValid(r.kind, r.name, r.ownershipLabel)
    )
      throw Error("docker_isolation_resource_invalid");
    resources.set(r.key, r);
    names.add(r.name);
    if (r.kind === "network") {
      fields(r, "kind,key,name,ownershipLabel,internal");
      if (typeof r.internal !== "boolean")
        throw Error("docker_isolation_network_invalid");
    } else if (r.kind === "container") {
      fields(
        r,
        "kind,key,name,ownershipLabel,image,argv,environment,mounts,network,networkAlias,user,workingDirectory,entrypoint,tmpfsBytes,interactive,tty,init,seccomp",
      );
      if (
        !resolveDockerImageProfile(r.image) ||
        !Array.isArray(r.argv) ||
        r.argv.some(
          (v: unknown) => typeof v !== "string" || v.includes("\0"),
        ) ||
        !r.environment ||
        typeof r.environment !== "object" ||
        Array.isArray(r.environment) ||
        Object.entries(r.environment).some(
          ([k, v]) =>
            !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(k) ||
            typeof v !== "string" ||
            v.includes("\0"),
        ) ||
        !Array.isArray(r.mounts) ||
        new Set(
          r.mounts.map((m: IsolationContainer["mounts"][number]) => m.target),
        ).size !== r.mounts.length ||
        ![true, false].includes(r.init) ||
        ![true, false].includes(r.interactive) ||
        ![true, false].includes(r.tty) ||
        (r.tty && !r.interactive) ||
        ![null, 16777216, 33554432].includes(r.tmpfsBytes) ||
        ![null, "proxy"].includes(r.networkAlias) ||
        ![null, "/work", "/operation/workspace"].includes(r.workingDirectory) ||
        ![null, "python"].includes(r.entrypoint)
      )
        throw Error("docker_isolation_container_invalid");
      const profile = resolveDockerImageProfile(r.image);
      if (
        !profile ||
        r.user !== profile.user ||
        !profile.entrypoints.includes(r.entrypoint)
      )
        throw Error("docker_isolation_container_invalid");
      for (const m of r.mounts) {
        fields(m, "source,target,readOnly");
        if (
          !absolute(m.source) ||
          !MOUNT_TARGETS.has(m.target) ||
          typeof m.readOnly !== "boolean" ||
          (["/work/.git", "/work/.crdd"].includes(m.target) && !m.readOnly)
        )
          throw Error("docker_isolation_mount_invalid");
      }
      if (r.seccomp !== null) {
        fields(r.seccomp, "sha256,bytes");
        if (
          !resolveFixedCodexExecutorSeccompProfile(
            r.seccomp.sha256,
            r.seccomp.bytes,
          )
        )
          throw Error("docker_isolation_seccomp_invalid");
      }
    } else throw Error("docker_isolation_resource_invalid");
  }
  for (const r of input.resources)
    if (r.kind === "container" && r.network !== null) {
      const network = resources.get(r.network);
      if (
        network?.kind !== "network" ||
        (!network.internal &&
          resolveDockerImageProfile(r.image)?.externalNetwork !== true)
      )
        throw Error("docker_isolation_network_invalid");
    }
  const created = new Set<string>(),
    steps = new Set<string>(),
    started = new Set<string>();
  for (const s of input.steps) {
    const r = resources.get(s.resource);
    if (!key(s.key) || steps.has(s.key) || !r)
      throw Error("docker_isolation_step_invalid");
    steps.add(s.key);
    if (s.action === "create") {
      fields(s, "key,action,resource,timeoutMs");
      if (
        created.has(r.key) ||
        !timeout(s.timeoutMs) ||
        (r.kind === "container" &&
          r.network !== null &&
          !created.has(r.network))
      )
        throw Error("docker_isolation_step_invalid");
      created.add(r.key);
    } else if (s.action === "connect") {
      fields(s, "key,action,resource,network,timeoutMs");
      const network = resources.get(s.network);
      if (
        r.kind !== "container" ||
        resolveDockerImageProfile(r.image)?.externalNetwork !== true ||
        network?.kind !== "network" ||
        network.internal ||
        !created.has(s.resource) ||
        !created.has(s.network) ||
        !timeout(s.timeoutMs)
      )
        throw Error("docker_isolation_step_invalid");
    } else if (s.action === "run") {
      fields(
        s,
        "key,action,resource,mode,stdin,timeoutMs,stdoutLimitBytes,stderrLimitBytes,acceptedExitCodes,deadlineOrigin",
      );
      if (
        r.kind !== "container" ||
        !created.has(r.key) ||
        started.has(r.key) ||
        !["captured", "interactive", "detached"].includes(s.mode) ||
        !["request", "started"].includes(s.deadlineOrigin) ||
        (s.timeoutMs !== null && !timeout(s.timeoutMs)) ||
        (s.timeoutMs === null && s.mode !== "interactive") ||
        (s.stdin !== null && typeof s.stdin !== "string") ||
        (s.stdin !== null && (!r.interactive || s.mode !== "captured")) ||
        (s.mode === "interactive" && (!r.interactive || s.stdin !== null)) ||
        !Number.isSafeInteger(s.stdoutLimitBytes) ||
        s.stdoutLimitBytes <= 0 ||
        s.stdoutLimitBytes > 1_048_576 ||
        !Number.isSafeInteger(s.stderrLimitBytes) ||
        s.stderrLimitBytes <= 0 ||
        s.stderrLimitBytes > 1_048_576 ||
        !Array.isArray(s.acceptedExitCodes) ||
        !s.acceptedExitCodes.length ||
        s.acceptedExitCodes.some((v: unknown) => !Number.isSafeInteger(v))
      )
        throw Error("docker_isolation_step_invalid");
      started.add(r.key);
    } else throw Error("docker_isolation_step_invalid");
  }
  if (
    created.size !== resources.size ||
    input.cleanupOrder.length !== resources.size ||
    new Set(input.cleanupOrder).size !== resources.size ||
    input.cleanupOrder.some((k) => !resources.has(k))
  )
    throw Error("docker_isolation_cleanup_order_invalid");
  return input;
}

/** 元Snapshot・回収順序・ID欠測時だけの照合条件を通常入力と同じ規律で固定する。 */
export function captureIsolationCleanupRequest(
  value: IsolationCleanupRequest,
): IsolationCleanupRequest {
  const input = capture(value) as IsolationCleanupRequest;
  fields(
    input,
    "managementDirectory,resources,cleanupOrder,setupTimeoutMs,unreceiptedAbsence,verifyLabelAbsence,previouslyAbsent",
  );
  if (
    typeof input.managementDirectory !== "string" ||
    !path.isAbsolute(input.managementDirectory) ||
    path.resolve(input.managementDirectory) !== input.managementDirectory ||
    /[\0\r\n,]/u.test(input.managementDirectory) ||
    !Number.isSafeInteger(input.setupTimeoutMs) ||
    input.setupTimeoutMs <= 0 ||
    input.setupTimeoutMs > 300_000 ||
    !["retain", "observe"].includes(input.unreceiptedAbsence) ||
    typeof input.verifyLabelAbsence !== "boolean"
  )
    throw Error("docker_isolation_cleanup_invalid");
  fields(input.resources, "resources");
  if (
    !Array.isArray(input.resources.resources) ||
    !Array.isArray(input.cleanupOrder) ||
    !Array.isArray(input.previouslyAbsent)
  )
    throw Error("docker_isolation_cleanup_invalid");
  const keys = new Set<string>();
  for (const r of input.resources.resources) {
    fields(r, "key,identity,request,configuration");
    fields(r.identity, "kind,dockerId,name,ownershipLabel");
    const id = r.identity;
    if (
      typeof r.key !== "string" ||
      !/^[a-z][a-z0-9_-]*$/u.test(r.key) ||
      keys.has(r.key) ||
      !["container", "network"].includes(id.kind) ||
      typeof id.name !== "string" ||
      typeof id.ownershipLabel !== "string" ||
      !dockerResourceLocatorIsValid(id.kind, id.name, id.ownershipLabel) ||
      (id.dockerId !== null &&
        (typeof id.dockerId !== "string" ||
          !/^[a-f0-9]{64}$/u.test(id.dockerId))) ||
      !["not_issued", "issued", "unknown"].includes(r.request) ||
      (r.request === "not_issued" && id.dockerId !== null)
    )
      throw Error("docker_isolation_cleanup_invalid");
    keys.add(r.key);
    const c = r.configuration;
    fields(c, "image,command,environmentNames,mounts,networks,internal");
    if (
      (c.image !== null &&
        (typeof c.image !== "string" || /[\0\r\n]/u.test(c.image))) ||
      (c.command !== null &&
        (!Array.isArray(c.command) ||
          c.command.some((v: unknown) => v !== "<redacted>"))) ||
      (c.environmentNames !== null &&
        (!Array.isArray(c.environmentNames) ||
          c.environmentNames.some(
            (v: unknown) =>
              typeof v !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(v),
          ))) ||
      (c.networks !== null &&
        (!Array.isArray(c.networks) ||
          c.networks.some(
            (v: unknown) => typeof v !== "string" || /[\0\r\n]/u.test(v),
          ))) ||
      (c.internal !== null && typeof c.internal !== "boolean") ||
      (c.mounts !== null &&
        (!Array.isArray(c.mounts) ||
          c.mounts.some((m: unknown) => {
            if (!m || typeof m !== "object") return true;
            fields(m, "source,target,readOnly");
            const mount = m as Record<string, unknown>;
            return (
              typeof mount.source !== "string" ||
              typeof mount.target !== "string" ||
              /[\0\r\n]/u.test(mount.source + mount.target) ||
              typeof mount.readOnly !== "boolean"
            );
          })))
    )
      throw Error("docker_isolation_cleanup_invalid");
  }
  if (
    input.cleanupOrder.length !== keys.size ||
    new Set(input.cleanupOrder).size !== keys.size ||
    input.cleanupOrder.some((key) => !keys.has(key))
  )
    throw Error("docker_isolation_cleanup_invalid");
  if (
    new Set(input.previouslyAbsent).size !== input.previouslyAbsent.length ||
    input.previouslyAbsent.some((key) => !keys.has(key))
  )
    throw Error("docker_isolation_cleanup_invalid");
  return input;
}

/** 固定セキュリティ設定を付与し、任意Docker flagの搬送を防ぐ。 */
export function containerCreation(
  r: IsolationContainer,
  network: string | null,
): readonly string[] {
  const seccomp =
    r.seccomp === null
      ? null
      : resolveFixedCodexExecutorSeccompProfile(
          r.seccomp.sha256,
          r.seccomp.bytes,
        );
  if (r.seccomp !== null && !seccomp)
    throw Error("docker_isolation_seccomp_invalid");
  return Object.freeze([
    "create",
    ...(r.init ? ["--init"] : []),
    ...(r.interactive ? ["--interactive"] : []),
    ...(r.tty ? ["--tty"] : []),
    "--pull=never",
    "--network",
    network ?? "none",
    ...(r.networkAlias ? ["--network-alias", r.networkAlias] : []),
    "--read-only",
    "--name",
    r.name,
    "--label",
    r.ownershipLabel,
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    ...(seccomp ? [`--security-opt=seccomp=${seccomp}`] : []),
    `--user=${r.user}`,
    ...(r.workingDirectory ? [`--workdir=${r.workingDirectory}`] : []),
    ...Object.entries(r.environment).flatMap(([k, v]) => [
      "--env",
      `${k}=${v}`,
    ]),
    ...r.mounts.flatMap((m) => [
      "--mount",
      `type=bind,src=${m.source},dst=${m.target},bind-propagation=rprivate${m.readOnly ? ",readonly" : ""}`,
    ]),
    ...(r.tmpfsBytes
      ? ["--tmpfs", `/tmp:rw,noexec,nosuid,size=${r.tmpfsBytes}`]
      : []),
    ...(r.entrypoint ? ["--entrypoint", r.entrypoint] : []),
    r.image,
    ...r.argv,
  ]);
}

/** 準備構成の非秘密投影。発行状態は未要求として明示する。 */
export function plannedResourceSnapshot(
  input: IsolationRequest,
): ResourceSnapshot {
  return Object.freeze({
    resources: Object.freeze(
      input.resources.map((r) =>
        Object.freeze({
          key: r.key,
          identity: Object.freeze({
            kind: r.kind,
            dockerId: null,
            name: r.name,
            ownershipLabel: r.ownershipLabel,
          }),
          request: "not_issued" as const,
          configuration:
            r.kind === "network"
              ? Object.freeze({
                  image: null,
                  command: null,
                  environmentNames: null,
                  mounts: null,
                  networks: null,
                  internal: r.internal,
                })
              : Object.freeze({
                  image: r.image,
                  command: Object.freeze(r.argv.map(() => "<redacted>")),
                  environmentNames: Object.freeze(Object.keys(r.environment)),
                  mounts: r.mounts,
                  networks: Object.freeze(
                    r.network
                      ? [
                          input.resources.find((n) => n.key === r.network)
                            ?.name ?? "",
                        ]
                      : ["none"],
                  ),
                  internal: null,
                }),
        }),
      ),
    ),
  });
}

/**
 * 作成直後・実行前の完全構成を同じ技術定義へ照合する。
 * @responsibility 回収Identityの最小照合とは分離して、隔離条件を検査する。
 * @trace ARCH-000008
 * @input resource: 確定構成。value: 単一inspect。image: 同じ固定ImageのConfig。
 * @returns 完全構成とMount元実体を確認できた場合だけtrue。
 * @effect Mount元のrealpath読取りだけ。
 * @failure 欠測・型差・観測不能はfalse。
 * @invariant 構成検査の成功を削除権限として公開しない。
 */
export function isolationResourceConfigurationMatches(
  resource: IsolationRequest["resources"][number],
  value: unknown,
  image: Readonly<Record<string, unknown>> | null,
  networks: readonly string[],
): boolean {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return false;
    const v = value as Record<string, unknown>;
    if (resource.kind === "network")
      return (
        v.Driver === "bridge" &&
        v.Scope === "local" &&
        v.Internal === resource.internal
      );
    if (
      !image ||
      !v.Config ||
      typeof v.Config !== "object" ||
      !v.HostConfig ||
      typeof v.HostConfig !== "object"
    )
      return false;
    const c = v.Config as Record<string, unknown>,
      h = v.HostConfig as Record<string, unknown>;
    if (
      c.Image !== resource.image ||
      c.User !== resource.user ||
      c.Tty !== resource.tty ||
      c.OpenStdin !== resource.interactive ||
      h.ReadonlyRootfs !== true ||
      h.Privileged !== false ||
      JSON.stringify(h.CapDrop) !== '["ALL"]'
    )
      return false;
    for (const field of ["CapAdd", "Devices"])
      if (
        h[field] !== null &&
        (!Array.isArray(h[field]) || h[field].length !== 0)
      )
        return false;
    if (
      !Array.isArray(h.SecurityOpt) ||
      !h.SecurityOpt.some(
        (v) => v === "no-new-privileges" || v === "no-new-privileges:true",
      ) ||
      h.SecurityOpt.some(
        (v) =>
          typeof v !== "string" ||
          (v !== "no-new-privileges" &&
            v !== "no-new-privileges:true" &&
            !(resource.seccomp && v.startsWith("seccomp="))),
      )
    )
      return false;
    if (
      resource.init
        ? h.Init !== true
        : h.Init !== undefined && h.Init !== null && h.Init !== false
    )
      return false;
    if (
      JSON.stringify(c.Entrypoint) !==
        JSON.stringify(
          resource.entrypoint ? [resource.entrypoint] : image.Entrypoint,
        ) ||
      JSON.stringify(c.Cmd) !==
        JSON.stringify(resource.argv.length ? resource.argv : image.Cmd) ||
      c.WorkingDir !== (resource.workingDirectory ?? image.WorkingDir)
    )
      return false;
    const environment = (value: unknown) => {
      if (!Array.isArray(value)) return null;
      const values = new Map<string, string>();
      for (const entry of value) {
        if (
          typeof entry !== "string" ||
          !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(entry)
        )
          return null;
        const at = entry.indexOf("="),
          key = entry.slice(0, at);
        if (values.has(key)) return null;
        values.set(key, entry.slice(at + 1));
      }
      return values;
    };
    const defaults = environment(image.Env),
      actual = environment(c.Env);
    if (!defaults || !actual) return false;
    for (const [k, v] of Object.entries(resource.environment))
      defaults.set(k, v);
    if (
      defaults.size !== actual.size ||
      [...defaults].some(([k, v]) => actual.get(k) !== v)
    )
      return false;
    const settings = v.NetworkSettings as Record<string, unknown> | null;
    if (
      !settings?.Networks ||
      typeof settings.Networks !== "object" ||
      JSON.stringify(Object.keys(settings.Networks).sort()) !==
        JSON.stringify([...networks].sort()) ||
      h.NetworkMode !== networks[0]
    )
      return false;
    if (!Array.isArray(v.Mounts)) return false;
    const binds = v.Mounts.filter((m) => m.Type === "bind");
    if (
      binds.length !== resource.mounts.length ||
      v.Mounts.some(
        (m) =>
          m.Type !== "bind" &&
          !(
            resource.tmpfsBytes &&
            m.Type === "tmpfs" &&
            m.Destination === "/tmp"
          ),
      )
    )
      return false;
    for (const expected of resource.mounts) {
      const actual = binds.filter((m) => m.Destination === expected.target);
      if (
        actual.length !== 1 ||
        actual[0].RW !== !expected.readOnly ||
        actual[0].Propagation !== "rprivate" ||
        typeof actual[0].Source !== "string"
      )
        return false;
      const canonical = (source: string) =>
        process.platform === "win32"
          ? fs.realpathSync.native(source).toLocaleLowerCase("en-US")
          : fs.realpathSync.native(source);
      if (canonical(actual[0].Source) !== canonical(expected.source))
        return false;
    }
    const tmpfs = h.Tmpfs as Record<string, unknown> | null;
    if (!resource.tmpfsBytes)
      return (
        tmpfs === null ||
        (typeof tmpfs === "object" && Object.keys(tmpfs).length === 0)
      );
    return (
      !!tmpfs &&
      Object.keys(tmpfs).length === 1 &&
      typeof tmpfs["/tmp"] === "string" &&
      JSON.stringify(tmpfs["/tmp"].split(",").sort()) ===
        JSON.stringify(
          ["rw", "noexec", "nosuid", `size=${resource.tmpfsBytes}`].sort(),
        )
    );
  } catch {
    return false;
  }
}

/**
 * 同じ確定通信条件から固定Proxyと接続環境を構成する。
 * @responsibility Policy生成・HashとClient環境の相関をDI内で所有する。
 * @trace ARCH-000008
 * @input 通常dataとして捕捉済みのRequest。
 * @returns 元の資源参照を検査した固定環境付きRequest。
 * @effect N/A: 純粋構成のみ。
 * @failure 未知Profile・Host・別Proxy・外部直結・矛盾環境は要求前拒否。
 * @invariant Role・認証・Taskの用途を判定せず、旧Policyへのfallbackを持たない。
 */
function configureProxy(input: IsolationRequest): IsolationRequest {
  if (!Array.isArray(input.resources))
    throw Error("docker_isolation_input_invalid");
  const proxyImage = describeDockerProviderAssets("codex").proxy.imageDigest;
  const proxyResources = input.resources.filter(
    (r) => r.kind === "container" && r.image === proxyImage,
  );
  if (!input.proxy) {
    if (Object.hasOwn(input, "proxy") || proxyResources.length)
      throw Error("docker_isolation_proxy_required");
    return input;
  }
  const p = input.proxy;
  fields(p, "resource,clients,profile,token,additionalHosts,environmentMode");
  if (
    !["codex", "claude"].includes(p.profile) ||
    typeof p.token !== "string" ||
    !/^[a-f0-9]{64}$/u.test(p.token) ||
    !Array.isArray(p.clients) ||
    !p.clients.length ||
    new Set(p.clients).size !== p.clients.length ||
    !["https", "uppercase", "all"].includes(p.environmentMode) ||
    proxyResources.length !== 1 ||
    proxyResources[0]?.key !== p.resource
  )
    throw Error("docker_isolation_proxy_invalid");
  const policy = prepareDockerNetworkPolicy(
    p.profile,
    p.additionalHosts === null ? [] : p.additionalHosts,
  );
  if (policy.status !== "ready") throw Error("docker_network_policy_invalid");
  const proxy = proxyResources[0];
  const network = input.resources.find((r) => r.key === proxy.network);
  if (
    network?.kind !== "network" ||
    !network.internal ||
    proxy.networkAlias !== "proxy"
  )
    throw Error("docker_isolation_proxy_invalid");
  for (const key of p.clients) {
    const client = input.resources.find((r) => r.key === key);
    if (
      client?.kind !== "container" ||
      key === p.resource ||
      client.network !== network.key
    )
      throw Error("docker_isolation_proxy_client_invalid");
  }
  for (const r of input.resources) {
    if (r.kind !== "container" || r.key === p.resource || r.network === null)
      continue;
    const attached = input.resources.find((n) => n.key === r.network);
    if (attached?.kind !== "network" || !attached.internal)
      throw Error("docker_isolation_direct_network_invalid");
  }
  const proxyEnvironment: Record<string, string> = {
    CRDD_PROXY_AUTH: p.token,
    CRDD_PROXY_PROFILE: p.profile,
    ...(p.additionalHosts !== null
      ? { CRDD_PROXY_NETWORK_POLICY: JSON.stringify(policy.policy) }
      : {}),
  };
  const url = `http://crdd:${p.token}@proxy:8080`;
  const clientEnvironment: Record<string, string> = { HTTPS_PROXY: url };
  if (p.environmentMode !== "https")
    for (const key of ["HTTP_PROXY", "ALL_PROXY", "NO_PROXY"])
      clientEnvironment[key] = key === "NO_PROXY" ? "" : url;
  if (p.environmentMode === "all")
    for (const key of ["https_proxy", "http_proxy", "all_proxy", "no_proxy"])
      clientEnvironment[key] = key === "no_proxy" ? "" : url;
  const reserved = [
    "CRDD_PROXY_AUTH",
    "CRDD_PROXY_PROFILE",
    "CRDD_PROXY_NETWORK_POLICY",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "https_proxy",
    "http_proxy",
    "all_proxy",
    "no_proxy",
  ];
  return Object.freeze({
    ...input,
    resources: Object.freeze(
      input.resources.map((r) => {
        if (r.kind !== "container") return r;
        const generated =
          r.key === p.resource
            ? proxyEnvironment
            : p.clients.includes(r.key)
              ? clientEnvironment
              : null;
        if (!generated) return r;
        for (const key of reserved)
          if (
            Object.hasOwn(r.environment, key) &&
            r.environment[key] !== generated[key]
          )
            throw Error("docker_isolation_proxy_environment_conflict");
        return Object.freeze({
          ...r,
          environment: Object.freeze({ ...r.environment, ...generated }),
        });
      }),
    ),
  });
}
