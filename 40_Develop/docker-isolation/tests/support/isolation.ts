/**
 * 共通DIの有限CLI・Process・Directory代役を試験間で再利用する。
 * @responsibility 実技術Lifecycleを差し替えず、外部操作の端だけを有限値へ接続する。
 * @trace ERB-IT-004
 * @level IT
 * @boundary tests専用。実Docker・外部AI・既存保持物を操作しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import type { CommandObservation } from "../../src/execution/result.ts";
import type {
  IsolationContainer,
  IsolationRequest,
} from "../../src/execution/types.ts";
import { describeDockerProviderAssets } from "../../src/image/assets.ts";

export async function createIsolationFixture(
  t: { mock: TestContext["mock"] },
  resourceSet = false,
) {
  const image = describeDockerProviderAssets("codex").fixedImageDigest;
  const container: IsolationContainer = {
    kind: "container",
    key: "container",
    name: "crdd-codex-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    image,
    argv: ["synthetic"],
    environment: { TOKEN: "synthetic-secret" },
    mounts: [],
    network: null,
    networkAlias: null,
    user: "65534:65534",
    workingDirectory: null,
    entrypoint: null,
    tmpfsBytes: null,
    interactive: false,
    tty: false,
    init: false,
    seccomp: null,
  };
  let request: IsolationRequest = {
    managementDirectory: "C:\\fixture\\management",
    resources: resourceSet
      ? [
          container,
          {
            ...container,
            key: "service",
            name: "crdd-service-0123456789abcdef",
          },
        ]
      : [container],
    steps: [
      ...(resourceSet
        ? [
            {
              key: "create_service",
              action: "create" as const,
              resource: "service",
              timeoutMs: 10_000,
            },
            {
              key: "start_service",
              action: "run" as const,
              resource: "service",
              mode: "detached" as const,
              stdin: null,
              timeoutMs: 10_000,
              stdoutLimitBytes: 1_048_576,
              stderrLimitBytes: 1_048_576,
              acceptedExitCodes: [0],
              deadlineOrigin: "request" as const,
            },
          ]
        : []),
      {
        key: "create",
        action: "create",
        resource: "container",
        timeoutMs: 10_000,
      },
      {
        key: "run",
        action: "run",
        resource: "container",
        mode: "captured",
        stdin: null,
        timeoutMs: 300_000,
        stdoutLimitBytes: 1_048_576,
        stderrLimitBytes: 1_048_576,
        acceptedExitCodes: [0],
        deadlineOrigin: "started",
      },
    ],
    cleanupOrder: resourceSet ? ["container", "service"] : ["container"],
    setupTimeoutMs: 10_000,
    unreceiptedAbsence: "retain",
    verifyLabelAbsence: false,
  };
  const calls: string[][] = [],
    ids = new Set<string>();
  let cliFailure: string | null = null;
  let directoryIdentity = "directory";
  let dynamic = false;
  let provider: "codex" | "claude" = "codex";
  const created = new Map<string, IsolationRequest["resources"][number]>();
  const connected = new Map<string, string[]>();
  const protectedIdentities: string[] = [],
    inputBodies: (string | null)[] = [];
  const id = "a".repeat(64);
  let closed = true,
    terminateCount = 0,
    processTermination = true,
    pendingRun = false;
  let inspectName = `/${container.name}`,
    commandExit = 0;
  let networkInternal = true;
  let networkName = "crdd-internal-0123456789abcdef";
  let networkLabel = "0123456789abcdef";
  let commandObservation: CommandObservation | null | undefined;
  let configClosed = false,
    configCloseError: string | null = null,
    configObservation = "ENOENT",
    startedCalls = 0,
    pendingStarted = false;
  const waitTimeouts: number[] = [];
  let terminationFilter: ((argv: readonly string[]) => boolean) | null = null;
  let observationFilter:
    | ((
        argv: readonly string[],
        result: CommandObservation | null,
      ) => CommandObservation | null)
    | null = null;
  let waitGate: ((argv: readonly string[]) => Promise<void>) | null = null;
  let releaseStarted: (started: boolean) => void = () => undefined;
  let configDirectory = path.join(
    request.managementDirectory,
    "docker-cli-config",
  );
  let release: (value: object | null) => void = () => undefined;
  const environment = { SystemRoot: "C:\\Windows" };
  const trusted = await import("../../src/docker-cli/trust.ts"),
    environments = await import("../../src/docker-cli/environment.ts"),
    configurations = await import("../../src/docker-cli/config.ts"),
    processes = await import("../../src/process/start.ts");
  t.mock.module("../../src/docker-cli/trust.ts", {
    namedExports: {
      ...trusted,
      observeTrustedDockerCli: () => ({}),
      verifyTrustedDockerCliSnapshot: () => {
        if (cliFailure)
          throw Object.assign(Error("private diagnostic"), {
            code: cliFailure,
          });
        return "fixed-docker";
      },
    },
  });
  t.mock.module("../../src/docker-cli/environment.ts", {
    namedExports: {
      ...environments,
      createDockerProcessEnvironment: () => environment,
    },
  });
  t.mock.module("../../src/docker-cli/config.ts", {
    namedExports: {
      ...configurations,
      observeDockerDirectoryIdentity: () => directoryIdentity,
      observeDockerProtectedMountIdentity: (source: string) => {
        protectedIdentities.push(source);
        return "protected-file";
      },
      createDockerCliConfig: (management: string) => {
        assert.equal(management, request.managementDirectory);
        configClosed = false;
        return { directory: configDirectory, identity: "config" };
      },
      verifyDockerCliConfig: () => undefined,
    },
  });
  t.mock.module("../../src/process/start.ts", {
    namedExports: {
      ...processes,
      startOwnedWindowsProcess: (
        _executable: string,
        input: readonly string[],
        _environment: unknown,
        stdin: string | null,
      ) => {
        assert.equal(input[2], "--config");
        assert.equal(input[3], configDirectory);
        const argv = [...input].slice(4);
        calls.push(argv);
        let stdout = "",
          status = 0;
        if (dynamic) {
          inputBodies.push(stdin);
          if (argv[0] === "version") stdout = "linux";
          else if (
            argv[0] === "create" ||
            (argv[0] === "network" && argv[1] === "create")
          ) {
            const name =
              argv[0] === "create"
                ? argv[argv.indexOf("--name") + 1]
                : argv.at(-1);
            const resource = request.resources.find(
              (resource) => resource.name === name,
            );
            assert.ok(resource);
            const assigned = String(
              request.resources.indexOf(resource) + 1,
            ).repeat(64);
            ids.add(assigned);
            created.set(assigned, resource);
            stdout = assigned;
            connected.set(
              assigned,
              resource.kind === "container"
                ? [
                    resource.network
                      ? (request.resources.find(
                          (item) => item.key === resource.network,
                        )?.name ?? "")
                      : "none",
                  ]
                : [],
            );
          } else if (argv[0] === "network" && argv[1] === "connect") {
            const network = created.get(argv[2] ?? "");
            assert.ok(network);
            connected.get(argv[3] ?? "")?.push(network.name);
          } else if (argv.includes("inspect")) {
            if (argv[0] === "image")
              stdout = JSON.stringify([
                {
                  Id: argv.at(-1),
                  Config: {
                    Entrypoint: null,
                    Cmd: [],
                    WorkingDir: "",
                    Env: [],
                  },
                },
              ]);
            else {
              const id = argv.at(-1) ?? "",
                resource = created.get(id);
              assert.ok(resource);
              if (resource.kind === "network")
                stdout = JSON.stringify([
                  {
                    Id: id,
                    Name: resource.name,
                    Internal: resource.internal,
                    Driver: "bridge",
                    Scope: "local",
                    Labels: {
                      [resource.ownershipLabel.split("=")[0] ?? ""]:
                        resource.ownershipLabel.split("=")[1],
                    },
                  },
                ]);
              else
                stdout = JSON.stringify([
                  {
                    Id: id,
                    Name: `/${resource.name}`,
                    State: { Running: false },
                    Config: {
                      Image: resource.image,
                      User: resource.user,
                      Labels: {
                        [resource.ownershipLabel.split("=")[0] ?? ""]:
                          resource.ownershipLabel.split("=")[1],
                      },
                      Entrypoint: resource.entrypoint
                        ? [resource.entrypoint]
                        : null,
                      Cmd: resource.argv,
                      Env: Object.entries(resource.environment).map(
                        ([key, value]) => `${key}=${value}`,
                      ),
                      WorkingDir: resource.workingDirectory ?? "",
                      Tty: resource.tty,
                      OpenStdin: resource.interactive,
                    },
                    HostConfig: {
                      ReadonlyRootfs: true,
                      Privileged: false,
                      CapDrop: ["ALL"],
                      CapAdd: null,
                      Devices: null,
                      SecurityOpt: [
                        "no-new-privileges",
                        ...(resource.seccomp
                          ? [`seccomp=${JSON.stringify(resource.seccomp)}`]
                          : []),
                      ],
                      Init: resource.init,
                      NetworkMode: connected.get(id)?.[0],
                      Tmpfs: resource.tmpfsBytes
                        ? {
                            "/tmp": `rw,noexec,nosuid,size=${resource.tmpfsBytes}`,
                          }
                        : null,
                    },
                    Mounts: resource.mounts.map((mount) => ({
                      Type: "bind",
                      Source: mount.source,
                      Destination: mount.target,
                      RW: !mount.readOnly,
                      Propagation: "rprivate",
                    })),
                    NetworkSettings: {
                      Networks: Object.fromEntries(
                        (connected.get(id) ?? []).map((name) => [name, {}]),
                      ),
                    },
                  },
                ]);
            }
          } else if (argv.includes("ls")) {
            const filters = argv.flatMap((value, index) =>
              value === "--filter" ? [argv[index + 1] ?? ""] : [],
            );
            stdout = [...ids]
              .filter((id) => {
                const resource = created.get(id);
                return (
                  resource &&
                  resource.kind === argv[0] &&
                  filters.every((filter) =>
                    filter.startsWith("id=")
                      ? filter.slice(3) === id
                      : filter.startsWith("label=")
                        ? filter.slice(6) === resource.ownershipLabel
                        : filter ===
                          `name=^${resource.kind === "container" ? "/" : ""}${resource.name}$`,
                  )
                );
              })
              .join("\n");
          } else if (argv.includes("rm")) ids.delete(argv.at(-1) ?? "");
          else if (argv[0] === "start") {
            const resource = created.get(argv.at(-1) ?? "");
            assert.ok(resource);
            if (resource.key === "create_subscription_auth_probe")
              stdout =
                provider === "codex"
                  ? "Logged in using ChatGPT\n"
                  : JSON.stringify({
                      loggedIn: true,
                      authMethod: "claude.ai",
                      apiProvider: "firstParty",
                      forcedLoginMethod: "claudeai",
                      subscriptionType: "max",
                    });
            else if (resource.key === "create_provider")
              stdout =
                provider === "codex"
                  ? [
                      JSON.stringify({
                        type: "item.completed",
                        item: {
                          id: "fixture",
                          type: "agent_message",
                          text: JSON.stringify({
                            status: "completed",
                            summary: "synthetic",
                            changedPaths: ["source.txt"],
                            verification: ["synthetic"],
                          }),
                        },
                      }),
                      JSON.stringify({ type: "turn.completed" }),
                    ].join("\n")
                  : JSON.stringify({
                      type: "result",
                      subtype: "success",
                      is_error: false,
                      num_turns: 1,
                      total_cost_usd: 0,
                      structured_output: { status: true },
                    });
          } else assert.fail("unexpected_dynamic_command");
        } else if (argv[0] === "version") stdout = "linux";
        else if (argv[0] === "create") {
          const createdId =
            argv[argv.indexOf("--name") + 1] === "crdd-service-0123456789abcdef"
              ? "b".repeat(64)
              : id;
          ids.add(createdId);
          stdout = createdId;
        } else if (argv.includes("inspect")) {
          stdout =
            argv[0] === "image"
              ? JSON.stringify([
                  {
                    Id: image,
                    Config: {
                      Entrypoint: null,
                      Cmd: [],
                      WorkingDir: "",
                      Env: [],
                    },
                  },
                ])
              : argv[0] === "network"
                ? JSON.stringify([
                    {
                      Id: argv.at(-1),
                      Name: networkName,
                      Internal: networkInternal,
                      Driver: "bridge",
                      Scope: "local",
                      Labels: {
                        "crdd.coordinator.runtime": networkLabel,
                      },
                    },
                  ])
                : JSON.stringify([
                    {
                      Id: argv.at(-1),
                      Name:
                        argv.at(-1) === "b".repeat(64)
                          ? "/crdd-service-0123456789abcdef"
                          : inspectName,
                      Config: {
                        Image: image,
                        User: container.user,
                        Labels: {
                          "crdd.coordinator.runtime": "0123456789abcdef",
                        },
                        Entrypoint: null,
                        Cmd: ["synthetic"],
                        Env: ["TOKEN=synthetic-secret"],
                        WorkingDir: "",
                        Tty: false,
                        OpenStdin: false,
                      },
                      HostConfig: {
                        ReadonlyRootfs: true,
                        Privileged: false,
                        CapDrop: ["ALL"],
                        CapAdd: null,
                        Devices: null,
                        SecurityOpt: ["no-new-privileges"],
                        Init: null,
                        NetworkMode: "none",
                        Tmpfs: null,
                      },
                      Mounts: [],
                      NetworkSettings: { Networks: { none: {} } },
                    },
                  ]);
        } else if (argv.includes("ls")) {
          const filter = argv[argv.indexOf("--filter") + 1] ?? "";
          const selectedId =
            filter.includes("crdd-service-") ||
            filter === `id=${"b".repeat(64)}`
              ? "b".repeat(64)
              : id;
          stdout = ids.has(selectedId) ? selectedId : "";
        } else if (argv.includes("rm")) ids.delete(argv.at(-1) ?? "");
        else if (argv[0] === "start") {
          stdout = "synthetic-result";
          status = commandExit;
        } else assert.fail("unexpected_command");
        let handleClosed = false;
        const result =
          argv[0] === "start" && commandObservation !== undefined
            ? commandObservation
            : {
                status,
                signal: null,
                stdout,
                stderr: "",
                outputExceeded: false,
              };
        const pending =
          argv[0] === "start" && pendingRun
            ? new Promise<object | null>((resolve) => {
                release = resolve;
              })
            : null;
        return {
          started: async () => {
            startedCalls++;
            return pendingStarted
              ? await new Promise<boolean>((resolve) => {
                  releaseStarted = resolve;
                })
              : true;
          },
          closed: () => handleClosed,
          wait: async (timeoutMs: number) => {
            await waitGate?.(argv);
            if (argv[0] === "start") waitTimeouts.push(timeoutMs);
            if (pending) {
              const value = await pending;
              handleClosed = processTermination;
              closed = handleClosed;
              return value;
            }
            handleClosed = terminationFilter?.(argv) ?? true;
            closed = handleClosed;
            return observationFilter ? observationFilter(argv, result) : result;
          },
          terminateAndWait: async () => {
            terminateCount++;
            handleClosed = processTermination;
            closed = handleClosed;
            release(null);
            return handleClosed;
          },
        };
      },
    },
  });
  const stat = fs.statSync,
    realpath = fs.realpathSync.native;
  const readdir = fs.readdirSync,
    rmdir = fs.rmdirSync;
  t.mock.method(fs, "statSync", (source: fs.PathLike, ...options: unknown[]) =>
    String(source).startsWith("C:\\fixture\\") ||
    String(source) === configDirectory ||
    String(source) === request.managementDirectory
      ? { isDirectory: () => true }
      : Reflect.apply(stat, fs, [source, ...options]),
  );
  t.mock.method(
    fs.realpathSync,
    "native",
    (source: fs.PathLike, ...options: unknown[]) =>
      String(source).startsWith("C:\\fixture\\") ||
      String(source) === configDirectory ||
      String(source) === request.managementDirectory
        ? String(source)
        : Reflect.apply(realpath, fs.realpathSync, [source, ...options]),
  );
  t.mock.method(
    fs,
    "readdirSync",
    (source: fs.PathLike, ...options: unknown[]) =>
      String(source).startsWith("C:\\fixture\\") ||
      String(source) === configDirectory
        ? []
        : Reflect.apply(readdir, fs, [source, ...options]),
  );
  t.mock.method(
    fs,
    "rmdirSync",
    (source: fs.PathLike, ...options: unknown[]) => {
      if (String(source) !== configDirectory)
        return Reflect.apply(rmdir, fs, [source, ...options]);
      if (configCloseError)
        throw Object.assign(Error("synthetic"), { code: configCloseError });
      configClosed = true;
    },
  );
  const lstat = fs.lstatSync;
  t.mock.method(
    fs,
    "lstatSync",
    (value: fs.PathLike, ...options: unknown[]) => {
      if (value !== configDirectory)
        return Reflect.apply(lstat, fs, [value, ...options]);
      if (!configClosed || configObservation === "present")
        return { isDirectory: () => true };
      throw Object.assign(Error("synthetic"), { code: configObservation });
    },
  );
  const api: typeof import("../../src/execution/operations.ts") = await import(
    `../../src/execution/operations.ts?case=${Math.random()}`
  );
  return {
    set cliFailure(value: string | null) {
      cliFailure = value;
    },
    set directoryIdentity(value: string) {
      directoryIdentity = value;
    },
    set observation(value: CommandObservation | null) {
      commandObservation = value;
    },
    set configObservation(value: string) {
      configObservation = value;
    },
    set configCloseError(value: string | null) {
      configCloseError = value;
    },
    api,
    get request() {
      return request;
    },
    calls,
    protectedIdentities,
    inputBodies,
    useRequest: (input: IsolationRequest, selected: "codex" | "claude") => {
      created.clear();
      connected.clear();
      ids.clear();
      configClosed = false;
      request = input;
      configDirectory = path.join(
        request.managementDirectory,
        "docker-cli-config",
      );
      dynamic = true;
      provider = selected;
    },
    ids,
    waitTimeouts,
    releaseStarted: (started: boolean) => releaseStarted(started),
    get startedCalls() {
      return startedCalls;
    },
    set pendingStarted(value: boolean) {
      pendingStarted = value;
    },
    get closed() {
      return closed;
    },
    get terminateCount() {
      return terminateCount;
    },
    set processTermination(value: boolean) {
      processTermination = value;
    },
    set terminationFilter(value:
      | ((argv: readonly string[]) => boolean)
      | null) {
      terminationFilter = value;
    },
    set observationFilter(value:
      | ((
          argv: readonly string[],
          result: CommandObservation | null,
        ) => CommandObservation | null)
      | null) {
      observationFilter = value;
    },
    set waitGate(value: ((argv: readonly string[]) => Promise<void>) | null) {
      waitGate = value;
    },
    set pendingRun(value: boolean) {
      pendingRun = value;
    },
    set inspectName(value: string) {
      inspectName = value;
    },
    set commandExit(value: number) {
      commandExit = value;
    },
    set networkInternal(value: boolean) {
      networkInternal = value;
    },
    set networkName(value: string) {
      networkName = value;
    },
    set networkLabel(value: string) {
      networkLabel = value;
    },
  };
}
