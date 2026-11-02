/**
 * 共通技術入口の開始・通知・取消・終了・回収を検証する。
 * @packageDocumentation
 * @responsibility 三用途に共通する技術保証を有限代役で反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 模擬CLI・Process・Directory。実Docker・AI・保持物は使用しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { type TestContext } from "node:test";
import { describeDockerProviderAssets } from "../../src/image/assets.ts";
import type {
  IsolationContainer,
  IsolationRequest,
} from "../../src/execution/types.ts";

/** 本番と同じ共通Ownerへ固定された有限Transportだけを接続する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
async function fixture(t: TestContext, resourceSet = false) {
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
  let configClosed = false,
    startedCalls = 0,
    pendingStarted = false;
  const waitTimeouts: number[] = [];
  let releaseStarted: (started: boolean) => void = () => undefined;
  const configDirectory = "C:\\fixture\\management\\docker-cli-config";
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
      verifyTrustedDockerCliSnapshot: () => "fixed-docker",
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
      observeDockerDirectoryIdentity: () => "directory",
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
                      "crdd.coordinator.runtime":
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
                        "crdd.coordinator.runtime":
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
                          ? [`seccomp=${resource.seccomp}`]
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
                      Name: "crdd-internal-0123456789abcdef",
                      Internal: networkInternal,
                      Driver: "bridge",
                      Scope: "local",
                      Labels: {
                        "crdd.coordinator.runtime": "0123456789abcdef",
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
        const result = {
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
            if (argv[0] === "start") waitTimeouts.push(timeoutMs);
            if (pending) {
              const value = await pending;
              handleClosed = processTermination;
              closed = handleClosed;
              return value;
            }
            handleClosed = true;
            closed = true;
            return result;
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
  t.mock.method(fs, "statSync", () => ({ isDirectory: () => true }));
  t.mock.method(fs.realpathSync, "native", (source: fs.PathLike) =>
    String(source),
  );
  t.mock.method(fs, "readdirSync", () => []);
  t.mock.method(fs, "rmdirSync", () => {
    configClosed = true;
  });
  const exists = fs.existsSync;
  t.mock.method(fs, "existsSync", (value: fs.PathLike) =>
    value === configDirectory ? !configClosed : exists(value),
  );
  const api: typeof import("../../src/execution/operations.ts") = await import(
    `../../src/execution/operations.ts?case=${Math.random()}`
  );
  return {
    api,
    request,
    calls,
    protectedIdentities,
    inputBodies,
    useRequest: (input: IsolationRequest, selected: "codex" | "claude") => {
      request = input;
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
  };
}

/** 元準備だけを一回実行し、Receipt→結果→回収→Completionを確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("両Providerの通常Attemptは実Executorから実DIの共通Ownerと有限CLIへ接続する", async (t) => {
  const f = await fixture(t);
  const di = await import("../../src/index.ts");
  const platform = await import("../../../platform-access/src/index.ts");
  let selected: "codex" | "claude" = "codex",
    released = 0;
  t.mock.module("../../../platform-access/src/index.ts", {
    namedExports: {
      ...platform,
      acquireNamedPipeKernelLock: () => ({
        release: () => {
          released++;
          return true;
        },
        assertLive: () => true,
      }),
    },
  });
  t.mock.module("../../src/index.ts", {
    namedExports: {
      ...di,
      prepareIsolation: (request: IsolationRequest) => {
        f.useRequest(request, selected);
        return f.api.prepareIsolation(request);
      },
      executeIsolation: f.api.executeIsolation,
    },
  });
  const { createExecutor }: typeof import("../../../executor/src/index.ts") =
    await import(
      `../../../executor/src/index.ts?common-chain=${Math.random()}`
    );
  for (const provider of ["codex", "claude"] as const)
    for (const mode of ["normal", "notice_failure", "cancel"] as const)
      await t.test(`${provider}:${mode}`, async () => {
        selected = provider;
        released = 0;
        const policy = di.prepareDockerNetworkPolicy(provider, []);
        assert.equal(policy.status, "ready");
        if (policy.status !== "ready") return;
        const target = {
          provider,
          operationId: "OP-123456",
          grantRef: "PHMGRANT-123456",
          workspaceSourcePath: "C:\\fixture\\workspace",
          temporarySourcePath: "C:\\fixture\\tmp",
          providerHomeSourcePath: "C:\\fixture\\home",
          providerHomeIdentityHash: "a".repeat(64),
          providerHomeProtectionHash: "b".repeat(64),
          localUserBindingHash: "c".repeat(64),
          stableLogicalHomeBindingHash: "d".repeat(64),
          activeMountCapability: {},
          workspaceProtection: {
            gitSourcePath: "C:\\fixture\\git-reference",
            internalSourcePath: "C:\\fixture\\internal",
          },
        };
        const executor =
          provider === "codex"
            ? createExecutor(
                {
                  kind: "attempt",
                  purpose: "task",
                  target,
                  selection: {
                    provider,
                    modelIdentifier: "gpt-5.5",
                    identifierKind: "exact",
                    reasoningEffort: "low",
                    purpose: "task",
                  },
                  input: "synthetic task input",
                  taskRole: "executor",
                  networkPolicy: policy.policy,
                },
                {
                  paths: {
                    tmp: target.temporarySourcePath,
                    management: "C:\\fixture\\management",
                  },
                },
              )
            : createExecutor(
                {
                  kind: "attempt",
                  purpose: "probe",
                  target,
                  selection: {
                    provider,
                    modelIdentifier: "opus",
                    identifierKind: "alias",
                    reasoningEffort: "low",
                    purpose: "task",
                  },
                },
                {
                  paths: {
                    tmp: target.temporarySourcePath,
                    management: "C:\\fixture\\management",
                  },
                },
              );
        assert.ok(executor);
        const management = {};
        const started = executor.start({
          managementCapability: management,
          reference: {
            recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
            recoveryCapability: {},
          },
          callbacks: {
            onCommandSubmitting: async (purpose) => {
              if (purpose === "create_provider") {
                if (mode === "notice_failure")
                  throw Error("synthetic_checkpoint_refusal");
                if (mode === "cancel" && started.status === "started")
                  await executor.cancel({
                    controlCapability: started.controlCapability,
                    managementCapability: management,
                  });
              }
            },
          },
        });
        assert.equal(started.status, "started");
        if (started.status !== "started") return;
        const result = await started.completion;
        assert.equal(
          result.status,
          mode === "normal"
            ? "completed"
            : mode === "cancel"
              ? "cancelled"
              : "blocked",
          JSON.stringify({ provider, mode, reason: result.reason }),
        );
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(result.homeLeaseReleased, true);
        assert.equal(released, 1);
        assert.equal(f.ids.size, 0);
        assert.equal(result.resourceSnapshot?.resources.length, 5);
        assert.equal(result.hostPathReported, true);
        assert.equal(
          JSON.stringify(result.resourceSnapshot).includes(
            "synthetic task input",
          ),
          false,
        );
        if (provider === "codex" && mode === "normal") {
          assert.ok(f.inputBodies.includes("synthetic task input"));
          assert.ok(
            f.protectedIdentities.includes(
              target.workspaceProtection.gitSourcePath,
            ),
          );
          assert.ok(
            f.calls.some((argv) =>
              argv.some((value) => value.includes("seccomp=")),
            ),
          );
        }
      });
});

/** 元準備だけを一回実行し、Receipt→結果→回収→Completionを確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口は元準備を一回だけ実行し非秘密Snapshotと回収結果を返す", async (t) => {
  const f = await fixture(t),
    notices: string[] = [];
  const prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  assert.equal(JSON.stringify(prepared).includes("synthetic-secret"), false);
  assert.equal(f.calls.length, 0);
  assert.equal(prepared.resources.resources[0]?.request, "not_issued");
  assert.throws(
    () => f.api.executeIsolation({ ...prepared }),
    /preparation_invalid/u,
  );
  const execution = f.api.executeIsolation(prepared, {
    onSubmitting: (s) => {
      notices.push(`intent:${s.key}`);
    },
    onCreated: (s, r) => {
      notices.push(`receipt:${s.key}`);
      assert.equal(r.resources[0]?.identity.dockerId, "a".repeat(64));
    },
    onCompleted: (s) => {
      notices.push(`completed:${s.key}`);
    },
    onCleanupSubmitting: () => {
      notices.push("cleanup");
    },
  });
  assert.throws(() => f.api.executeIsolation(prepared), /already_started/u);
  const result = await execution.completion;
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(result.processTerminationConfirmed, true);
  assert.equal(result.callbackRegistrationReleased, true);
  assert.equal(result.resources.resources[0]?.request, "issued");
  assert.equal(
    JSON.stringify(result.resources).includes("synthetic-secret"),
    false,
  );
  assert.ok(notices.indexOf("receipt:create") < notices.indexOf("intent:run"));
  assert.equal(notices.at(-1), "cleanup");
  assert.equal(f.ids.size, 0);
  assert.equal((await execution.cancel()).cancellationRequested, false);
});

/** 開始前取消と二重取消を前進・再実行へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口はService開始と資源集合Snapshot・逆順回収を同じOwnerで確定する", async (t) => {
  const f = await fixture(t, true);
  const prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const receipts: string[] = [],
    cleanup: string[] = [];
  const result = await f.api.executeIsolation(prepared, {
    onCreated: (step, snapshot) => {
      assert.equal(snapshot.resources.length, 2);
      const received = snapshot.resources.find((r) => r.key === step.resource);
      assert.equal(received?.request, "issued");
      assert.ok(received?.identity.dockerId);
      receipts.push(step.resource);
    },
    onCleanupSubmitting: (key) => {
      cleanup.push(key);
    },
  }).completion;
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(result.resources.resources.length, 2);
  assert.ok(
    result.resources.resources.every(
      (r) => r.request === "issued" && r.identity.dockerId,
    ),
  );
  assert.deepEqual(receipts, ["service", "container"]);
  assert.deepEqual(cleanup, ["container", "service"]);
  assert.deepEqual(f.waitTimeouts, [10_000, 300_000]);
  assert.ok(f.calls.some((a) => a[0] === "start" && !a.includes("--attach")));
  assert.equal(f.ids.size, 0);
});

/** 開始前取消と二重取消を前進・再実行へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常と単独Cleanupは同じ元Snapshot・技術回収を使い再実行しない", async (t) => {
  const f = await fixture(t),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const first = await f.api.executeIsolation(prepared).completion;
  assert.equal(first.cleanup.confirmed, true);
  const creates = f.calls.filter((a) => a[0] === "create").length;
  const runs = f.calls.filter((a) => a[0] === "start").length;
  f.ids.add("a".repeat(64));
  const resources = {
    resources: first.resources.resources.map((r) => ({
      ...r,
      configuration: {
        ...r.configuration,
        image: "diagnostic-only-different-image",
      },
    })),
  };
  const result = await f.api.cleanupIsolation({
    managementDirectory: f.request.managementDirectory,
    resources,
    cleanupOrder: ["container"],
    setupTimeoutMs: 10_000,
    unreceiptedAbsence: "retain",
    verifyLabelAbsence: false,
    previouslyAbsent: [],
    discovery: [],
  }).completion;
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(
    result.resources.resources[0]?.identity.dockerId,
    "a".repeat(64),
  );
  assert.equal(
    result.resources.resources[0]?.configuration.image,
    "diagnostic-only-different-image",
  );
  assert.equal(f.calls.filter((a) => a[0] === "create").length, creates);
  assert.equal(f.calls.filter((a) => a[0] === "start").length, runs);
  assert.equal(f.ids.size, 0);
});

/** 保存済み不存在を、再出現した資源への削除許可へ変えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("単独Cleanupは既不存在Checkpointと現在残存の矛盾で削除しない", async (t) => {
  const f = await fixture(t, true),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const first = await f.api.executeIsolation(prepared).completion;
  f.ids.add("a".repeat(64));
  f.ids.add("b".repeat(64));
  const removals = f.calls.filter((a) => a.includes("rm")).length;
  const result = await f.api.cleanupIsolation({
    managementDirectory: f.request.managementDirectory,
    resources: first.resources,
    cleanupOrder: ["container", "service"],
    setupTimeoutMs: 10_000,
    unreceiptedAbsence: "retain",
    verifyLabelAbsence: false,
    previouslyAbsent: ["container"],
    discovery: [],
  }).completion;
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(f.calls.filter((a) => a.includes("rm")).length, removals);
  assert.equal(f.ids.size, 2);
  assert.equal(result.cleanup.configCleanupConfirmed, true);
});

/** 単独回収取消後の追加削除を止め、自作configだけは終了する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("単独Cleanupは取消後の次資源を削除せずconfig終了を確認する", async (t) => {
  const f = await fixture(t, true),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const first = await f.api.executeIsolation(prepared).completion;
  f.ids.add("a".repeat(64));
  f.ids.add("b".repeat(64));
  const before = f.calls.filter((argv) => argv.includes("rm")).length;
  const execution = f.api.cleanupIsolation(
    {
      managementDirectory: f.request.managementDirectory,
      resources: first.resources,
      cleanupOrder: ["container", "service"],
      setupTimeoutMs: 10_000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
      previouslyAbsent: [],
      discovery: [],
    },
    {
      onCleanupCompleted: async (key) => {
        if (key === "container") await execution.cancel();
      },
    },
  );
  const result = await execution.completion;
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(result.cleanup.configCleanupConfirmed, true);
  assert.equal(
    f.calls.filter((argv) => argv.includes("rm")).length - before,
    1,
  );
  assert.equal(f.ids.has("b".repeat(64)), true);
});

/** 発見前のID欠測という由来を保持し、通知後にも構成を再確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("単独Cleanupは発見通知後の構成差替えと通知欠測で削除しない", async (t) => {
  for (const mode of ["normal", "changed", "missing_notice"] as const)
    await t.test(mode, async (t) => {
      const f = await fixture(t),
        id = "a".repeat(64);
      f.ids.add(id);
      const identity = {
        kind: "network" as const,
        name: "crdd-internal-0123456789abcdef",
        dockerId: null,
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      };
      const result = await f.api.cleanupIsolation(
        {
          managementDirectory: f.request.managementDirectory,
          resources: {
            resources: [
              {
                key: "network",
                identity,
                request: "unknown",
                configuration: {
                  image: null,
                  command: null,
                  environmentNames: null,
                  mounts: null,
                  networks: null,
                  internal: null,
                },
              },
            ],
          },
          cleanupOrder: ["network"],
          setupTimeoutMs: 10_000,
          unreceiptedAbsence: "retain",
          verifyLabelAbsence: false,
          previouslyAbsent: [],
          discovery: [
            {
              key: "network",
              configurations: [
                {
                  kind: "network",
                  expectedName: identity.name,
                  ownershipLabel: identity.ownershipLabel,
                  expectedImage: null,
                  shouldBeInternal: true,
                  purpose: "create_internal_network",
                  expectedNetworks: [],
                  workspaceMounted: false,
                  workspaceReadOnly: false,
                  initRequired: false,
                },
              ],
            },
          ],
        },
        mode === "missing_notice"
          ? {}
          : {
              onResourceIdentified: (_key, snapshot) => {
                assert.equal(snapshot.resources[0]?.identity.dockerId, id);
                assert.equal(snapshot.resources[0]?.request, "unknown");
                if (mode === "changed") f.networkInternal = false;
              },
            },
      ).completion;
      assert.equal(result.resources.resources[0]?.identity.dockerId, id);
      assert.equal(result.cleanup.confirmed, mode === "normal");
      if (mode === "missing_notice")
        assert.equal(result.failure?.stage, "notification");
      assert.equal(
        f.calls.filter((argv) => argv.includes("rm")).length,
        mode === "normal" ? 1 : 0,
      );
      assert.equal(result.cleanup.configCleanupConfirmed, true);
    });
});

/** 開始前取消と二重取消を前進・再実行へ読み替えない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口は開始前取消でDocker要求0を維持する", async (t) => {
  const f = await fixture(t),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const execution = f.api.executeIsolation(prepared);
  assert.equal((await execution.cancel()).cancellationRequested, true);
  assert.equal((await execution.cancel()).cancellationRequested, false);
  const result = await execution.completion;
  assert.equal(result.cancellationRequested, true);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(f.calls.length, 0);
});

/** 既定config・直接constructor・疎配列の経路で準備検査を迂回しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通準備は全構築入口で検査し疎配列とconfig省略を拒否する", async (t) => {
  const f = await fixture(t),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const missingConfig = {
    ...f.request,
    managementDirectory: null,
  } as unknown as IsolationRequest;
  assert.equal(f.api.prepareIsolation(missingConfig), null);
  const resource = f.request.resources[0];
  assert.ok(resource?.kind === "container");
  const wrongImage = {
    ...f.request,
    resources: [{ ...resource, image: "unknown" }],
  };
  assert.throws(
    () => Reflect.construct(prepared.constructor, [wrongImage]),
    /isolation_container_invalid/u,
  );
  assert.equal(Object.isFrozen(Object.getPrototypeOf(prepared)), true);
  assert.throws(
    () =>
      Object.defineProperty(Object.getPrototypeOf(prepared), "take", {
        value: () => undefined,
      }),
    TypeError,
  );
  const sparse = Array<string>(2);
  sparse[0] = "synthetic";
  Object.defineProperty(sparse, "4294967295", {
    value: "outside",
    enumerable: true,
  });
  assert.equal(
    f.api.prepareIsolation({
      ...f.request,
      resources: [{ ...resource, argv: sparse }],
    }),
    null,
  );
  assert.equal(f.calls.length, 0);
});

/** request起算は開始観測が停止しても起動要求からの期限を一回だけ使用する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("起動要求起算の期限は開始観測待機でリセットしない", {
  timeout: 2_000,
}, async (t) => {
  const f = await fixture(t);
  f.pendingStarted = true;
  const steps = f.request.steps.map((s) =>
    s.action === "run"
      ? { ...s, timeoutMs: 250, deadlineOrigin: "request" as const }
      : s,
  );
  const prepared = f.api.prepareIsolation({ ...f.request, steps });
  assert.ok(prepared);
  let notices = 0;
  const result = await f.api.executeIsolation(prepared, {
    onStarted: () => {
      notices++;
    },
  }).completion;
  assert.equal(result.failure, null);
  assert.equal(f.startedCalls, 1);
  assert.deepEqual(f.waitTimeouts, [250]);
  f.releaseStarted(true);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(notices, 0);
});

/** 期限起算と開始通知を分離し、登録済み通知の一回完了を確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("要求起算でも観測できた開始は一回通知する", async (t) => {
  const f = await fixture(t);
  const steps = f.request.steps.map((s) =>
    s.action === "run" ? { ...s, deadlineOrigin: "request" as const } : s,
  );
  const prepared = f.api.prepareIsolation({ ...f.request, steps });
  assert.ok(prepared);
  let notices = 0;
  const result = await f.api.executeIsolation(prepared, {
    onStarted: () => {
      notices++;
    },
  }).completion;
  assert.equal(notices, 1);
  assert.equal(result.failure, null);
  assert.equal(result.cleanup.confirmed, true);
  assert.deepEqual(f.waitTimeouts, [300_000]);
});

/** 要求起算の開始通知拒否も後続Effectを止め、回収を完了する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("要求起算の開始通知失敗は捕捉され回収結果へ接続される", async (t) => {
  const f = await fixture(t);
  const steps = f.request.steps.map((s) =>
    s.action === "run" ? { ...s, deadlineOrigin: "request" as const } : s,
  );
  const prepared = f.api.prepareIsolation({ ...f.request, steps });
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared, {
    onStarted: () => {
      throw Error("notification_failed");
    },
  }).completion;
  assert.equal(result.failure?.stage, "notification");
  assert.equal(result.notificationDeliveryConfirmed, false);
  assert.equal(result.cleanup.confirmed, true);
});

/** 通知が拒否しても元IDを保持し、後続runを停止し補償回収する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口はReceipt通知失敗後に前進せず元IDだけを回収する", async (t) => {
  const f = await fixture(t),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared, {
    onCreated: async () => {
      throw Error("save_failed");
    },
  }).completion;
  assert.equal(result.failure?.stage, "notification");
  assert.equal(result.notificationDeliveryConfirmed, false);
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(
    f.calls.some((a) => a[0] === "start"),
    false,
  );
  assert.equal(
    result.resources.resources[0]?.identity.dockerId,
    "a".repeat(64),
  );
});

/** 回収通知が失敗すれば元IDがあっても削除を発行しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口は回収前通知の失敗を削除許可へ変換しない", async (t) => {
  const f = await fixture(t),
    prepared = f.api.prepareIsolation(f.request);
  assert.ok(prepared);
  const result = await f.api.executeIsolation(prepared, {
    onCleanupSubmitting: () => {
      throw Error("save_failed");
    },
  }).completion;
  assert.equal(result.cleanup.confirmed, false);
  assert.equal(
    f.calls.some((a) => a.includes("rm")),
    false,
  );
  assert.equal(result.notificationDeliveryConfirmed, false);
});

/** 実行中取消は一回配送し、Process終了未確認では削除しない。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("共通入口の実行中取消は終了確認と回収可否を分離する", async (t) => {
  for (const confirmed of [true, false])
    await t.test(String(confirmed), async (t) => {
      const f = await fixture(t);
      f.pendingRun = true;
      f.processTermination = confirmed;
      const prepared = f.api.prepareIsolation(f.request);
      assert.ok(prepared);
      let ready: () => void = () => undefined;
      const started = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const execution = f.api.executeIsolation(prepared, {
        onStarted: () => {
          ready();
        },
      });
      await started;
      const cancelled = await execution.cancel();
      assert.equal(cancelled.processTerminationObserved, confirmed);
      const result = await execution.completion;
      assert.equal(result.processTerminationConfirmed, confirmed);
      assert.equal(result.cleanup.confirmed, confirmed);
      assert.equal(
        f.calls.some((a) => a.includes("rm")),
        confirmed,
      );
      assert.equal(f.terminateCount, 1);
    });
});
