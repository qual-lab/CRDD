import assert from "node:assert/strict";
import test from "node:test";

import { createIsolatedClaudeDockerRuntimeAdapterCandidate } from "../src/security/claude-docker-runtime-adapter.ts";
import {
  createIsolatedDockerEffectRuntimeCandidate,
  describeDockerEffectRuntimeContract,
} from "../src/security/docker-effect-runtime.ts";

function createPlanFixture(taskRole: "executor" | "reviewer" | null = null) {
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const selectionUseCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const authorityControlCapability = Object.freeze({});
  let randomValue = 0;
  const adapter = createIsolatedClaudeDockerRuntimeAdapterCandidate({
    verifyOperationMount: () =>
      Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-25T00:00:00.000Z",
        mounts: Object.freeze({
          workspace: "C:\\operation\\workspace",
          providerHome: "C:\\operation\\provider-home",
          tmp: "C:\\operation\\tmp",
          events: "C:\\operation\\events",
          projection: "C:\\operation\\projection",
          management: "C:\\operation\\management",
        }),
      }),
    activateMount: () =>
      Object.freeze({
        status: "activated",
        grant: Object.freeze({
          grantRef: "PHMGRANT-123456",
          provider: "claude",
          profileId: "PROFILE-200001",
          operationId: "OP-123456",
          providerHomeIdentityHash: "d".repeat(64),
          providerHomeProtectionHash: "e".repeat(64),
          localUserBindingHash: "f".repeat(64),
          stableLogicalHomeBindingHash: "1".repeat(64),
        }),
        activeMountCapability,
      }),
    borrowMountSource: () => "C:\\provider-homes\\claude",
    completeMount: () => Object.freeze({ status: "completed" }),
    wallNow: () => 1_000,
    monotonicNow: () => 2_000,
    randomBytes: (size) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeModelSelection: () =>
      Object.freeze({
        selectionRecordId: "MODELSEL-12345678",
        operationId: "OP-123456",
        frontProvider: "codex" as const,
        executorProvider: "claude" as const,
        route: "front_codex__executor_claude",
        profileId: "PROFILE-200001",
        model: "opus",
        basis: Object.freeze({
          provider: "claude" as const,
          role: "executor" as const,
          workClass: "bounded_implementation" as const,
          planState: "complete" as const,
          risk: "low" as const,
          difficulty: "low" as const,
          decisionImpact: "limited" as const,
          isLocalCandidateOnly: true,
          hasUnresolvedDirection: false,
          requiresCrossContextAlignment: false,
        }),
        effort: "low" as const,
        modelTier: "preferred",
        speedMode: "normal" as const,
        selectionNotice:
          "[委譲経路選定] front=codex executor=claude\n選定理由=complete_bounded_local_plan\n高コスト選択=no",
        delegationDepth: 1,
      }),
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole: taskRole ?? "executor",
        taskPacketHash: "d".repeat(64),
        prompt: "Execute the exact isolated task.",
        promptTransport: "provider_stdin_only" as const,
      }),
    issueProviderAuthority: () =>
      Object.freeze({
        status: "issued",
        useCapability: authorityUseCapability,
        controlCapability: authorityControlCapability,
        operationId: "OP-123456",
        provider: "claude",
        profileId: "PROFILE-200001",
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true,
      }),
    revokeProviderAuthority: () => Object.freeze({ status: "revoked" }),
  });
  const prepared = taskRole
    ? adapter.prepareTask(
        managementCapability,
        mountCapability,
        mountAuthorizationCapability,
        selectionUseCapability,
        Object.freeze({}),
      )
    : adapter.prepare(
        managementCapability,
        mountCapability,
        mountAuthorizationCapability,
        selectionUseCapability,
      );
  assert.equal(prepared.status, "prepared");
  const plan = adapter.consumeForProcessController(
    prepared.preparedCapability,
    managementCapability,
  );
  assert.ok(plan);
  return { plan, managementCapability };
}

function createEffectFixture(
  options: Readonly<{
    taskRole?: "executor" | "reviewer";
    configEntries?: readonly string[];
    outputForInvocation?: (
      argv: readonly string[],
      invocationIndex: number,
    ) => Readonly<{
      status: number | null;
      signal: string | null;
      stdout: string;
      stderr: string;
      outputExceeded: boolean;
    }>;
  }> = {},
) {
  const { plan, managementCapability } = createPlanFixture(
    options.taskRole ?? null,
  );
  const invocations: Array<{
    executable: string;
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
    stdin: string | null;
  }> = [];
  let configCreated = 0;
  let configRemoved = 0;
  const runtime = createIsolatedDockerEffectRuntimeCandidate({
    platform: "win32",
    borrowPaths: () =>
      Object.freeze({
        tmp: "C:\\operation\\tmp",
        management: "C:\\operation\\management",
      }),
    readCli: () =>
      Object.freeze({
        rootIdentity: "root",
        executableIdentity: "executable",
        sha256:
          "C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610",
      }),
    verifyCli: () => undefined,
    createConfig: () => {
      configCreated += 1;
      return Object.freeze({
        directory: "C:\\operation\\management\\docker-cli-config",
        identity: "config",
      });
    },
    verifyConfig: () => undefined,
    configEntries: () => Object.freeze([...(options.configEntries ?? [])]),
    removeConfig: () => {
      configRemoved += 1;
    },
    startProcess: (executable, argv, environment, stdin) => {
      invocations.push({ executable, argv, environment, stdin });
      let closed = false;
      const completion = Object.freeze(
        options.outputForInvocation?.(argv, invocations.length - 1) ?? {
          status: 0,
          signal: null,
          stdout: "",
          stderr: "",
          outputExceeded: false,
        },
      );
      return Object.freeze({
        wait: async () => {
          closed = true;
          return completion;
        },
        terminateAndWait: async () => {
          closed = true;
          return true;
        },
        closed: () => closed,
      });
    },
  });
  return {
    runtime,
    plan,
    managementCapability,
    recoveryCapability: Object.freeze({}),
    invocations,
    counts: () => ({ configCreated, configRemoved }),
  };
}

test("固定planのcommandだけを固定CLI・Engine・最小環境へ渡す", async () => {
  const fixture = createEffectFixture();
  const firstCommand = fixture.plan.commands[0];
  assert.ok(firstCommand);
  const handle = fixture.runtime.startCommand(
    firstCommand,
    fixture.plan,
    fixture.managementCapability,
  );
  assert.equal((await handle.wait(10_000))?.status, 0);
  assert.equal(fixture.invocations.length, 1);
  const invocation = fixture.invocations[0];
  assert.ok(invocation);
  assert.equal(
    invocation.executable,
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  );
  assert.deepEqual(invocation.argv.slice(0, 4), [
    "--host",
    "npipe:////./pipe/dockerDesktopLinuxEngine",
    "--config",
    "C:\\operation\\management\\docker-cli-config",
  ]);
  assert.deepEqual(invocation.environment, {
    SystemRoot: "C:\\Windows",
    WINDIR: "C:\\Windows",
    SystemDrive: "C:",
    DOCKER_CLI_HINTS: "false",
  });
  assert.equal(fixture.counts().configCreated, 1);
});

test("plain command copyと変更planはDocker processを開始しない", () => {
  const fixture = createEffectFixture();
  const firstCommand = fixture.plan.commands[0];
  assert.ok(firstCommand);
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        Object.freeze({
          purpose: firstCommand.purpose,
          argv: firstCommand.argv,
        }),
        fixture.plan,
        fixture.managementCapability,
      ),
    /command_not_owned/u,
  );
  const changed = Object.freeze({
    ...fixture.plan,
    selectedModel: "sonnet",
  });
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        firstCommand,
        changed,
        fixture.managementCapability,
      ),
    /plan_invalid/u,
  );
  assert.equal(fixture.invocations.length, 0);
});

test("Task本文はprovider startのstdinだけへ渡しDocker argvへ含めない", async () => {
  const fixture = createEffectFixture({ taskRole: "executor" });
  const providerStart = fixture.plan.commands.find(
    (command) => command.purpose === "start_provider_attached",
  );
  assert.ok(providerStart);
  const handle = fixture.runtime.startCommand(
    providerStart,
    fixture.plan,
    fixture.managementCapability,
  );
  assert.equal((await handle.wait(10_000))?.status, 0);
  assert.equal(fixture.invocations.length, 1);
  const invocation = fixture.invocations[0];
  assert.ok(invocation);
  assert.equal(invocation.stdin, "Execute the exact isolated task.");
  assert.equal(invocation.argv.includes(invocation.stdin ?? ""), false);
  assert.equal(invocation.argv.includes("--interactive"), true);
});

test("cleanupは全handle終了と所有resource不存在後だけconfigを除去する", async () => {
  const fixture = createEffectFixture();
  const firstCommand = fixture.plan.commands[0];
  assert.ok(firstCommand);
  const handle = fixture.runtime.startCommand(
    firstCommand,
    fixture.plan,
    fixture.managementCapability,
  );
  await handle.wait(10_000);
  const cleanup = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.deepEqual(cleanup, {
    confirmed: true,
    processTreeTerminated: true,
    containersAbsent: true,
    networksAbsent: true,
  });
  assert.deepEqual(fixture.counts(), {
    configCreated: 1,
    configRemoved: 1,
  });
  assert.equal(fixture.invocations.length, 6);
});

test("foreign labelまたはconfig残存はcleanupとRecovery完了を止める", async () => {
  const foreign = createEffectFixture({
    outputForInvocation: (argv) =>
      argv.includes("container") && argv.includes("ls")
        ? Object.freeze({
            status: 0,
            signal: null,
            stdout: `${argv[argv.indexOf("--filter") + 1]?.replace("name=^/", "").replace("$", "")}|foreign\n`,
            stderr: "",
            outputExceeded: false,
          })
        : Object.freeze({
            status: 0,
            signal: null,
            stdout: "",
            stderr: "",
            outputExceeded: false,
          }),
  });
  const foreignCleanup = await foreign.runtime.cleanupOwnedResources(
    foreign.plan,
    foreign.recoveryCapability,
    foreign.managementCapability,
  );
  assert.equal(foreignCleanup.confirmed, false);
  assert.equal(foreignCleanup.containersAbsent, false);
  assert.equal(foreign.counts().configRemoved, 0);

  const residue = createEffectFixture({ configEntries: ["unexpected.json"] });
  const residueCleanup = await residue.runtime.cleanupOwnedResources(
    residue.plan,
    residue.recoveryCapability,
    residue.managementCapability,
  );
  assert.equal(residueCleanup.confirmed, false);
  assert.equal(residueCleanup.containersAbsent, true);
  assert.equal(residueCleanup.networksAbsent, true);
  assert.equal(residue.counts().configRemoved, 0);
});

test("Docker Effect contractは固定CLIと任意command禁止を公開する", () => {
  const contract = describeDockerEffectRuntimeContract();
  assert.equal(contract.contractRevision, 6);
  assert.equal(contract.dockerCli.bytes, 41_631_088);
  assert.equal(contract.dockerCli.pathLookupAllowed, false);
  assert.equal(contract.dockerCli.shellAllowed, false);
  assert.equal(contract.environment, "runtime_owned_minimal_replacement");
  assert.equal(
    contract.commandPlan,
    "exact_nine_command_subscription_preflight_provider_probe_or_isolated_task",
  );
  assert.equal(contract.taskInput, "runtime_owned_stdin_only_not_docker_argv");
  assert.equal(contract.callerCommandAllowed, false);
  assert.equal(contract.providerEffectAllowed, true);
});
