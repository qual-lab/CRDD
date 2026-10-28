/**
 * 放棄した実Ownerと別Process回復を分離する固定試験子入口。
 * @packageDocumentation
 * @responsibility 自己生成Repositoryで旧Owner終了・清掃途中切断と本番consumer回復を検証する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @level IT
 * @scope 実Root・Host・Home排他・Writer。通常Host試験はHome観測と固定切断hookを模擬する。auth_create_failureはDocker代役と通常例外を確認し、明示したauth_create_unknownだけは専用承認Rootで固定Imageの停止Containerを一件作成する。
 * @boundary 旧Owner Processの終了後の現在回復。専用モードの同期CLI終了は子孫tree／daemon queue終端の証明ではない。
 */

import assert from "node:assert/strict";
import cp from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  CoordinatorStateOperation,
  CoordinatorStateTaskOperation,
} from "../../../domain-model/src/index.ts";
import {
  COORDINATOR_STATE_SCHEMA,
  encodeRuntimeStateValue,
} from "../../../domain-model/src/index.ts";
import { executionSelection } from "./ai-selection.ts";

const mode = process.argv[2];
assert.ok(
  mode === "producer" ||
    mode === "state_saved" ||
    mode === "host_started" ||
    mode === "cleanup_withheld" ||
    mode === "parent_terminated" ||
    mode === "auth_create_unknown" ||
    mode === "auth_create_failure" ||
    mode === "recovery",
);
const authCreateMode =
  mode === "auth_create_unknown" || mode === "auth_create_failure";
const authFault = mode === "auth_create_failure" ? process.argv[3] : null;
if (mode === "auth_create_failure")
  assert.ok(
    ["image", "inspect", "before_unknown", "after_unknown", "packet"].includes(
      authFault ?? "",
    ),
  );
const root = fs.realpathSync(process.cwd());
const distribution = fs.realpathSync(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
if (mode === "auth_create_unknown") {
  assert.equal(process.platform, "win32");
  const expectedRoot = path.join(
    distribution,
    ".crdd",
    "tests",
    "auth-create-closure",
  );
  assert.equal(root, expectedRoot);
  assert.equal(fs.realpathSync(expectedRoot), expectedRoot);
  assert.equal(fs.lstatSync(expectedRoot).isSymbolicLink(), false);
}
const authCreateImage =
  "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
if (mode === "auth_create_failure") {
  assert.equal(process.platform, "win32");
  assert.equal(path.dirname(root), path.join(distribution, ".crdd", "tests"));
  assert.match(path.basename(root), /^auth-create-failure-[a-zA-Z0-9]+$/u);
  assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
}
const vc = await import("../../../version-control/src/index.ts");
const verified = vc.verifyRepositoryRoot(root);
assert.equal(verified.status, "completed");
assert.ok(verified.capability);
assert.equal(vc.resolveVerifiedRepositoryRoot(verified.capability), root);
const statePath = path.join(root, ".crdd", "domain-model", "state.json");

/**
 * 自己生成Coordinator領域の全実体と本文を捕捉する。
 * @responsibility 開始拒否による履歴・短命物の残存や既存物置換を検出する。
 * @trace PRL-IT-013
 * @precondition 自己生成RepositoryのCoordinator領域が存在する。
 * @stimulus 固定Fileと注入用未知Fileを全数列挙する。
 * @observation 名前集合、種別、dev／ino／birthtimeNs、本文を取得する。
 * @oracle link・非通常File・想定外名を拒否し、比較時は全要素一致を要求する。
 * @cleanup N/A: 観測だけでFilesystemを変更しない。
 * @boundary 自己生成Coordinator直下だけを読む。
 */
function captureCoordinatorFiles() {
  const directory = path.dirname(statePath);
  const metadata = fs.lstatSync(directory, { bigint: true });
  assert.equal(metadata.isDirectory(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  return {
    directory: [metadata.dev, metadata.ino, metadata.birthtimeNs].map(String),
    files: fs
      .readdirSync(directory)
      .sort()
      .map((name) => {
        assert.ok(
          [
            "state.json",
            "state.pending.json",
            "state.lock",
            "history.jsonl",
            "history.pending.jsonl",
            "unexpected.json",
          ].includes(name),
        );
        const file = path.join(directory, name);
        const stat = fs.lstatSync(file, { bigint: true });
        assert.equal(stat.isFile(), true);
        assert.equal(stat.isSymbolicLink(), false);
        return {
          name,
          identity: [stat.dev, stat.ino, stat.birthtimeNs].map(String),
          bytes: fs.readFileSync(file),
        };
      }),
  };
}

if (mode !== "recovery") {
  const domain = await import("../../../domain-model/src/index.ts");
  const host = await import("../../src/execution/operation.ts");
  const repository = await import("../../src/execution/operation.ts");
  const store = {
    ...domain,
    ...(await import("../../src/execution/persistence.ts")),
  };
  const model = await import("../../../domain-model/src/index.ts");
  const homes = await import("../../src/execution/authority.ts");
  const locks = await import("../../src/execution/kernel-lock.ts");
  const area = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests"),
    "abandon_fixture",
  );
  const owned = host.createOwnedOperationDirectories(area.directory);
  const otherOwned = host.createOwnedOperationDirectories(area.directory);
  const management = host.createOwnedOperationManagementCapability(
    host.createOwnedOperationContextCapability(owned),
    host.createOwnedMountCapability(owned),
  );
  const other = host.createOwnedOperationManagementCapability(
    host.createOwnedOperationContextCapability(otherOwned),
    host.createOwnedMountCapability(otherOwned),
  );
  assert.ok(repository.bindRuntimeOwnedRepositoryOperation(management, root));
  assert.ok(repository.bindRuntimeOwnedRepositoryOperation(other, root));
  const binding =
    repository.borrowRuntimeOwnedCoordinatorStateRepository(management);
  const otherBinding =
    repository.borrowRuntimeOwnedCoordinatorStateRepository(other);
  assert.ok(binding && otherBinding);
  const initial = Buffer.from(
    `${encodeRuntimeStateValue({
      schema: COORDINATOR_STATE_SCHEMA,
      repositoryBindingId: null,
      intakeEpoch: null,
      intakeBindings: [],
      projects: [],
      managedExecutions: [],
      workspaces: [],
      queueEntries: [],
      leaseEvidence: [],
      leaseIntents: [],
      results: [],
      historyPending: [],
      acceptanceDecisions: [],
      decisionRecoveries: [],
      resultReceipts: [],
      revision: 1,
      previous: null,
      repositoryBinding: binding.repositoryBinding,
      operations: [],
      unresolvedRecoveries: [],
      pendingDeliveries: [],
    })}\n`,
  );
  const snapshotArea = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      root,
      "domain-model",
    ),
    "abandon_snapshot_fixture",
  );
  fs.writeFileSync(path.join(snapshotArea.directory, "state.json"), initial, {
    flag: "wx",
  });
  assert.equal(
    store.readRuntimeOwnedCoordinatorStateSnapshot(management).status,
    "completed",
  );
  const hash = randomBytes(32).toString("hex"),
    suffix = randomBytes(8).toString("hex");
  const plan = Object.freeze({
    provider: "codex" as const,
    consumer: "workbench" as const,
    operationId: binding.operationId,
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: executionSelection("executor", {
      provider: "codex",
      model: "gpt-5.5",
      effort: "low",
    }),
    taskAttempt: 0 as const,
    providerHomeIdentityHash: hash,
    providerHomeProtectionHash: hash,
    localUserBindingHash: hash,
    stableLogicalHomeBindingHash: hash,
    authContainerName: `crdd-auth-${suffix}`,
    providerContainerName: `crdd-codex-${suffix}`,
    proxyContainerName: `crdd-proxy-${suffix}`,
    internalNetworkName: `crdd-internal-${suffix}`,
    egressNetworkName: `crdd-egress-${suffix}`,
    ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
    providerImageDigest: authCreateMode ? authCreateImage : `sha256:${hash}`,
    proxyImageDigest: authCreateMode ? authCreateImage : `sha256:${hash}`,
    operationMode: "workbench_advice" as const,
    workspaceMountMode: null,
  });
  const baseline = await import("../../src/execution/recovery.ts");
  const otherIdentity =
    baseline.prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      {
        ...plan,
        operationId: otherBinding.operationId,
        stableLogicalHomeBindingHash: randomBytes(32).toString("hex"),
      },
      other,
      randomBytes(32).toString("hex"),
      "workbench",
    );
  assert.ok(otherIdentity);
  assert.equal(
    store.saveRuntimeOwnedCoordinatorOperationStart(other, otherIdentity)
      .status,
    "completed",
  );
  const observation = Object.freeze({});
  let observedPlan = plan;
  let afterHomeAcquire: (() => void) | null = null;
  let afterStateRead: (() => void) | null = null;
  let hostStarts = 0;
  let startWrites = 0;
  const stateReads: ReturnType<
    typeof store.readRuntimeOwnedCoordinatorStateSnapshot
  >[] = [];
  const admissionChecks: string[] = [];
  const lockMock = mock.module(
    new URL("../../src/execution/kernel-lock.ts", import.meta.url).href,
    {
      namedExports: {
        ...locks,
        acquireRuntimeOwnedLogicalProviderHomeKernelLock: (home: unknown) => {
          const lease =
            locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(home);
          if (lease && afterHomeAcquire) {
            const hook = afterHomeAcquire;
            afterHomeAcquire = null;
            try {
              hook();
            } catch (error) {
              assert.equal(lease.release(), true);
              throw error;
            }
          }
          return lease;
        },
      },
    },
  );
  const homeMock = mock.module(
    new URL("../../src/execution/authority.ts", import.meta.url).href,
    {
      namedExports: {
        ...homes,
        inspectRuntimeOwnedWindowsProviderHomeCandidate: () => ({
          status: "candidate",
          observationCapability: observation,
        }),
        consumeRuntimeOwnedProviderHomeObservationCapability: (
          value: unknown,
        ) => (value === observation ? observedPlan : null),
      },
    },
  );
  let owner: typeof baseline | null = null;
  let capability: object | null = null;
  let generationReleased = false;
  let crashArmed = false;
  const injectedFailure = new Error(`auth_create_fixture_failure:${authFault}`);
  let faultReached = 0;
  let primaryFailure: unknown;
  let authExpectedBytes: Buffer | null = null;
  let authRecoveryId: string | null = null;
  const dockerCalls: string[] = [];
  let realDockerCalls = 0;
  let abandonCalls = 0;
  let authHostBefore: {
    root: string[];
    markerIdentity: string[];
    marker: Buffer;
  } | null = null;
  /**
   * 確定済み境界を同期通知して、終了処理を通さず自己Processを終了する。
   * @responsibility 通常abandonと実Process消失の刺激を区別する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 対象exact IDの保存確定と指定境界への一回到達を確認済みである。
   * @stimulus 同期stdoutへ相関情報を全量書込み、SIGKILLを発行する。
   * @observation 親がProcess終端、finally未実行、耐久本文と実Hostを別々に確認する。
   * @oracle 送信不足・kill返却後の生存は明示失敗とし、通常終了へ代替しない。
   * @cleanup N/A: 意図的に終了処理を省略し、親のfresh回復だけが処置する。
   * @boundary 自己生成試験子Processのみ。専用auth_create_unknownでは実create受付の正対照だけを添付する。
   */
  function terminateAtBoundary(
    recoveryId: string,
    observation: Readonly<Record<string, unknown>> = {},
  ): never {
    if (mode === "auth_create_failure") {
      assert.equal(authFault, "packet");
      faultReached++;
      throw injectedFailure;
    }
    crashArmed = true;
    const packet = Buffer.from(
      JSON.stringify({
        ...observation,
        pid: process.pid,
        recoveryId,
        phase: mode,
        hostStarts,
      }),
    );
    assert.equal(fs.writeSync(1, packet), packet.length);
    process.kill(process.pid, "SIGKILL");
    throw new Error("crash_fixture_process_survived");
  }
  try {
    const actualStore = await import(
      new URL(
        "../../src/execution/persistence.ts?abandon-producer",
        import.meta.url,
      ).href
    );
    const actualSubmission = await import(
      new URL("../../src/execution/controller.ts", import.meta.url).href
    );
    const submissionMock = mock.module(
      new URL("../../src/execution/controller.ts", import.meta.url).href,
      {
        namedExports: {
          ...actualSubmission,
          beginRuntimeOwnedCoordinatorHostSubmission: (
            ...args: Parameters<
              typeof actualSubmission.beginRuntimeOwnedCoordinatorHostSubmission
            >
          ) => {
            hostStarts++;
            return actualSubmission.beginRuntimeOwnedCoordinatorHostSubmission(
              ...args,
            );
          },
        },
      },
    );
    const authCheckpointResults: ReturnType<
      typeof actualStore.checkpointRuntimeOwnedCoordinatorResource
    >[] = [];
    const storeMock = mock.module(
      new URL("../../src/execution/persistence.ts", import.meta.url).href,
      {
        namedExports: {
          ...actualStore,
          checkpointRuntimeOwnedCoordinatorResource: (
            ...args: Parameters<
              typeof actualStore.checkpointRuntimeOwnedCoordinatorResource
            >
          ) => {
            const saved = actualStore.checkpointRuntimeOwnedCoordinatorResource(
              ...args,
            );
            if (authCreateMode) authCheckpointResults.push(saved);
            return saved;
          },
          readRuntimeOwnedCoordinatorStateSnapshot: (
            ...args: Parameters<
              typeof store.readRuntimeOwnedCoordinatorStateSnapshot
            >
          ) => {
            const result = actualStore.readRuntimeOwnedCoordinatorStateSnapshot(
              ...args,
            );
            stateReads.push(result);
            if (afterStateRead) {
              const hook = afterStateRead;
              afterStateRead = null;
              hook();
            }
            return result;
          },
          saveRuntimeOwnedCoordinatorOperationStart: (
            ...args: Parameters<
              typeof store.saveRuntimeOwnedCoordinatorOperationStart
            >
          ) => {
            startWrites++;
            const result =
              actualStore.saveRuntimeOwnedCoordinatorOperationStart(...args);
            if (
              (mode === "cleanup_withheld" || mode === "parent_terminated") &&
              args[0] === management
            ) {
              assert.equal(result.status, "completed");
              assert.equal(result.snapshotConfirmed, true);
              assert.equal(result.lockReleased, true);
              assert.equal(typeof result.recoveryId, "string");
            }
            if (mode === "state_saved" && args[0] === management) {
              assert.equal(startWrites, 1);
              assert.equal(hostStarts, 0);
              assert.equal(result.status, "completed");
              assert.equal(result.snapshotConfirmed, true);
              assert.equal(result.lockReleased, true);
              assert.equal(typeof result.recoveryId, "string");
              assert.ok(result.recoveryId);
              terminateAtBoundary(result.recoveryId);
            }
            return result;
          },
        },
      },
    );
    try {
      owner = await import(
        new URL(
          "../../src/execution/recovery.ts?abandon-producer",
          import.meta.url,
        ).href
      );
      assert.ok(owner);
      assert.equal(
        await host.activateOwnedHostOperationGenerationLock(management),
        "activated",
      );
      if (mode !== "producer") {
        const begun = owner.beginRuntimeOwnedDockerRecovery(plan, management);
        assert.ok(begun && begun.status === "ready", JSON.stringify(begun));
        capability = begun.recoveryCapability;
        if (authCreateMode) {
          authRecoveryId = begun.recoveryId;
          const isolation = await import(
            "../../../docker-isolation/src/index.ts"
          );
          assert.equal(startWrites, 1);
          assert.equal(hostStarts, 1);
          assert.deepEqual(fs.readdirSync(owned.directories.providerHome), []);
          const config = path.join(
            owned.directories.management,
            "auth-create-config",
          );
          fs.mkdirSync(config);
          const commands = isolation.planDockerIsolationCommands({
            authenticationContainerName: plan.authContainerName,
            executionContainerName: plan.providerContainerName,
            proxyContainerName: plan.proxyContainerName,
            internalNetworkName: plan.internalNetworkName,
            egressNetworkName: plan.egressNetworkName,
            ownershipLabel: plan.ownershipLabel,
            executionImageDigest: authCreateImage,
            proxyImageDigest: authCreateImage,
            homeSourcePath: owned.directories.providerHome,
            temporarySourcePath: owned.directories.tmp,
            workspace: null,
            authentication: { argv: ["python", "-c", "pass"], environment: {} },
            execution: {
              argv: ["python", "-c", "pass"],
              environment: {},
              interactive: false,
              initRequired: false,
              seccompProfile: null,
            },
            proxy: {
              profile: "codex",
              token: "0".repeat(64),
              port: 8080,
              extendedProxyEnvironment: false,
            },
          });
          assert.ok(commands);
          const command = commands.find(
            (value) => value.purpose === "create_subscription_auth_probe",
          );
          assert.ok(command);
          const createArgv = command.argv;
          const expected = [
            "create",
            "--pull=never",
            "--network=none",
            "--read-only",
            "--name",
            plan.authContainerName,
            "--label",
            plan.ownershipLabel,
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--pids-limit=32",
            "--user=65534:65534",
            "--env",
            "HOME=/provider-home",
            "--mount",
            `type=bind,src=${owned.directories.providerHome},dst=/provider-home,bind-propagation=rprivate,readonly`,
            authCreateImage,
            "python",
            "-c",
            "pass",
          ];
          assert.deepEqual(command.argv, expected);
          assert.equal(authCheckpointResults.length, 0);
          assert.equal(
            owner.markRuntimeOwnedDockerResourceSubmission(
              begun.recoveryCapability,
              "create_subscription_auth_probe",
            ),
            true,
          );
          assert.equal(authCheckpointResults.length, 1);
          const intent = authCheckpointResults[0];
          assert.ok(intent);
          assert.equal(intent.status, "completed");
          assert.equal(intent.snapshotConfirmed, true);
          assert.equal(intent.lockReleased, true);
          const savedIntent =
            actualStore.readRuntimeOwnedCoordinatorStateSnapshot(management);
          assert.equal(savedIntent.status, "completed");
          assert.equal(savedIntent.lockReleased, true);
          assert.ok(savedIntent.value);
          const intentOperation: CoordinatorStateTaskOperation | undefined =
            savedIntent.value.snapshot.operations.find(
              (
                value: CoordinatorStateOperation,
              ): value is CoordinatorStateTaskOperation =>
                value.kind === "docker_task" &&
                value.recoveryId === begun.recoveryId,
            );
          assert.ok(intentOperation);
          const auth = intentOperation.resources.find(
            (value) => value.purpose === "create_subscription_auth_probe",
          );
          assert.deepEqual(auth, {
            purpose: "create_subscription_auth_probe",
            request: "intent_saved",
            dockerId: null,
            receiptSource: null,
            observation: "unobserved",
            absence: null,
          });
          authExpectedBytes = Buffer.from(
            `${encodeRuntimeStateValue(savedIntent.value.snapshot)}\n`,
          );
          const hostPaths =
            host.borrowOwnedHostRecoverySnapshot(management).hostPaths;
          const rootStat = fs.lstatSync(hostPaths.root, { bigint: true });
          const markerStat = fs.lstatSync(hostPaths.marker, { bigint: true });
          authHostBefore = {
            root: [rootStat.dev, rootStat.ino, rootStat.birthtimeNs].map(
              String,
            ),
            markerIdentity: [
              markerStat.dev,
              markerStat.ino,
              markerStat.birthtimeNs,
            ].map(String),
            marker: fs.readFileSync(hostPaths.marker),
          };
          const executable =
            "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
          const dockerPrefix = [
            "--host",
            "npipe:////./pipe/dockerDesktopLinuxEngine",
            "--config",
            config,
          ];
          const options = {
            shell: false as const,
            windowsHide: true,
            encoding: "utf8" as const,
            timeout: 10_000,
            maxBuffer: 1_048_576,
            env: { SystemRoot: process.env.SystemRoot ?? "C:\\Windows" },
          };
          /**
           * 専用実証と通常例外試験のDocker要求を排他的に搬送する。
           * @responsibility fakeでは閉じた三要求以外を拒否し実CLIへfallbackしない。
           * @trace PRL-IT-013
           * @trace ERB-IT-003
           * @precondition 生成済み固定create計画と空の専用configを使用する。
           * @stimulus image／create／inspectを順序固定で搬送し指定故障だけを一回発生させる。
           * @observation 要求列、実CLI要求数、故障到達、固定inspect構成。
           * @oracle fakeは実要求0で、unknown要求または順序差を拒否する。
           * @cleanup N/A: fakeは物理Docker資源を作らず、実証は親回収を必要とする。
           * @boundary Docker CLI代役と実同期CLIをmodeで分離する。
           */
          function runAuthDocker(argv: string[]) {
            if (mode === "auth_create_unknown") {
              realDockerCalls++;
              return cp.spawnSync(executable, argv, options);
            }
            assert.equal(mode, "auth_create_failure");
            const stage = ["image", "create", "inspect"][dockerCalls.length];
            const fakeId = "1".repeat(64);
            assert.ok(stage);
            assert.deepEqual(argv, [
              ...dockerPrefix,
              ...(stage === "image"
                ? ["image", "inspect", authCreateImage, "--format", "{{.Id}}"]
                : stage === "create"
                  ? [...createArgv]
                  : ["container", "inspect", fakeId]),
            ]);
            dockerCalls.push(stage);
            if (stage === authFault) {
              faultReached++;
              throw injectedFailure;
            }
            const inspected = {
              Id: fakeId,
              Name: `/${plan.authContainerName}`,
              Config: {
                Image: authCreateImage,
                User: "65534:65534",
                Labels: { "crdd.coordinator.runtime": suffix },
              },
              HostConfig: {
                ReadonlyRootfs: true,
                Privileged: false,
                CapDrop: ["ALL"],
                CapAdd: [],
                SecurityOpt: ["no-new-privileges"],
                PidsLimit: 32,
                Init: false,
              },
              NetworkSettings: { Networks: { none: {} } },
              Mounts: [
                {
                  Type: "bind",
                  Destination: "/provider-home",
                  RW: false,
                  Propagation: "rprivate",
                },
              ],
              State: { Status: "created" },
            };
            return {
              error: undefined,
              signal: null,
              status: 0,
              pid: process.pid,
              stdout:
                stage === "image"
                  ? `${authCreateImage}\n`
                  : stage === "create"
                    ? `${fakeId}\n`
                    : JSON.stringify([inspected]),
              stderr: "",
            };
          }
          const image = runAuthDocker([
            ...dockerPrefix,
            "image",
            "inspect",
            authCreateImage,
            "--format",
            "{{.Id}}",
          ]);
          assert.equal(image.error, undefined);
          assert.equal(image.signal, null);
          assert.equal(image.status, 0);
          assert.equal(image.stderr, "");
          assert.equal(image.stdout.trim(), authCreateImage);
          const created = runAuthDocker([...dockerPrefix, ...command.argv]);
          assert.equal(created.error, undefined);
          assert.equal(created.signal, null);
          assert.equal(created.status, 0);
          assert.equal(created.stderr, "");
          const dockerId = created.stdout.trim();
          assert.match(dockerId, /^[a-f0-9]{64}$/u);
          assert.ok(Number.isSafeInteger(created.pid) && created.pid > 0);
          const inspected = runAuthDocker([
            ...dockerPrefix,
            "container",
            "inspect",
            dockerId,
          ]);
          assert.equal(inspected.error, undefined);
          assert.equal(inspected.signal, null);
          assert.equal(inspected.status, 0);
          assert.equal(inspected.stderr, "");
          const values = JSON.parse(inspected.stdout);
          assert.equal(values.length, 1);
          const expectation = owner
            .currentDockerRecoveryResourceExpectations(intentOperation)
            .find(
              (value) => value.purpose === "create_subscription_auth_probe",
            );
          assert.ok(expectation?.expectations[0]);
          assert.equal(
            isolation.dockerResourceConfigurationMatches(values[0], {
              ...expectation.expectations[0],
              dockerId,
            }),
            true,
          );
          assert.equal(values[0].State.Status, "created");
          if (authFault === "before_unknown") {
            faultReached++;
            throw injectedFailure;
          }
          const expectedUnknown = model.prepareCoordinatorStateResourceSnapshot(
            authExpectedBytes,
            begun.recoveryId,
            { ...auth, request: "unknown" },
            binding.repositoryBinding,
          );
          assert.ok(expectedUnknown);
          const unknown = actualStore.checkpointRuntimeOwnedCoordinatorResource(
            management,
            begun.recoveryId,
            { ...auth, request: "unknown" },
          );
          if (authFault === "after_unknown") {
            authExpectedBytes = expectedUnknown;
            faultReached++;
            throw injectedFailure;
          }
          assert.equal(unknown.status, "completed");
          assert.equal(unknown.snapshotConfirmed, true);
          assert.equal(unknown.lockReleased, true);
          const savedUnknown =
            actualStore.readRuntimeOwnedCoordinatorStateSnapshot(management);
          assert.equal(savedUnknown.status, "completed");
          assert.equal(savedUnknown.lockReleased, true);
          assert.ok(savedUnknown.value);
          assert.deepEqual(
            Buffer.from(
              `${encodeRuntimeStateValue(savedUnknown.value.snapshot)}\n`,
            ),
            expectedUnknown,
          );
          authExpectedBytes = expectedUnknown;
          const unknownOperation: CoordinatorStateTaskOperation | undefined =
            savedUnknown.value.snapshot.operations.find(
              (
                value: CoordinatorStateOperation,
              ): value is CoordinatorStateTaskOperation =>
                value.kind === "docker_task" &&
                value.recoveryId === begun.recoveryId,
            );
          assert.ok(unknownOperation);
          const unknownAuth = unknownOperation.resources.find(
            (value) => value.purpose === "create_subscription_auth_probe",
          );
          assert.ok(unknownAuth);
          assert.equal(unknownAuth.request, "unknown");
          const receiptRegistered =
            unknownAuth.dockerId !== null || unknownAuth.receiptSource !== null;
          const providerStarted =
            unknownOperation.execution.providerStart !== "not_started";
          assert.equal(receiptRegistered, false);
          assert.equal(providerStarted, false);
          assert.equal(unknownOperation.execution.externalSend, "not_issued");
          assert.equal(unknownOperation.execution.sharedWrite, "not_issued");
          terminateAtBoundary(begun.recoveryId, {
            dockerId,
            containerName: plan.authContainerName,
            ownershipLabel: plan.ownershipLabel,
            image: authCreateImage,
            createCli: {
              pid: created.pid,
              status: created.status,
              signal: created.signal,
              stdoutBytes: Buffer.byteLength(created.stdout),
              stderrBytes: Buffer.byteLength(created.stderr),
            },
            stateSha256: createHash("sha256")
              .update(expectedUnknown)
              .digest("hex"),
            receiptRegistered,
            providerStarted,
          });
        }
        if (mode === "cleanup_withheld" || mode === "parent_terminated") {
          const current =
            actualStore.readRuntimeOwnedCoordinatorStateSnapshot(management);
          assert.equal(current.status, "completed");
          assert.equal(current.lockReleased, true);
          assert.ok(current.value);
          const target: CoordinatorStateTaskOperation | undefined =
            current.value.snapshot.operations.find(
              (item: CoordinatorStateOperation) =>
                item.kind === "docker_task" &&
                item.recoveryId === begun.recoveryId,
            );
          assert.ok(target?.kind === "docker_task");
          assert.equal(target.resources.length, 5);
          assert.ok(
            target.resources.every(
              (item) =>
                item.request === "not_requested" &&
                item.dockerId === null &&
                item.receiptSource === null,
            ),
          );
          assert.equal(target.execution.providerStart, "not_started");
          assert.equal(target.execution.externalSend, "not_issued");
          assert.equal(target.execution.sharedWrite, "not_issued");
          assert.equal(startWrites, 1);
          assert.equal(hostStarts, 1);
          assert.equal(realDockerCalls, 0);
          assert.equal(abandonCalls, 0);
          crashArmed = true;
          const packet = Buffer.from(
            `${JSON.stringify({ pid: process.pid, recoveryId: begun.recoveryId, phase: mode, hostStarts, operationRoot: root, cleanupObserved: false, authCreateDockerCalls: realDockerCalls })}\n`,
          );
          assert.equal(fs.writeSync(1, packet), packet.length);
          if (mode === "parent_terminated") {
            setInterval(() => undefined, 1_000);
            await new Promise<never>(() => undefined);
          }
          process.exit(0);
        }
        assert.equal(mode, "host_started");
        assert.equal(startWrites, 1);
        assert.equal(hostStarts, 1);
        terminateAtBoundary(begun.recoveryId);
      }
      const admissionBaseline = fs.readFileSync(statePath);
      const admissionHost = host.borrowOwnedHostRecoverySnapshot(management);
      const admissionMarker = fs.readFileSync(admissionHost.hostPaths.marker);
      const completeBaseline = captureCoordinatorFiles();
      for (const name of [
        "state.lock",
        "history.jsonl",
        "history.pending.jsonl",
        "unexpected.json",
      ]) {
        const file = path.join(path.dirname(statePath), name);
        try {
          fs.writeFileSync(file, "oracle mutation", { flag: "wx" });
          assert.throws(() =>
            assert.deepEqual(captureCoordinatorFiles(), completeBaseline),
          );
        } finally {
          fs.unlinkSync(file);
        }
        assert.deepEqual(captureCoordinatorFiles(), completeBaseline);
      }
      try {
        fs.appendFileSync(statePath, "oracle mutation");
        assert.throws(() =>
          assert.deepEqual(captureCoordinatorFiles(), completeBaseline),
        );
      } finally {
        fs.writeFileSync(statePath, admissionBaseline);
      }
      assert.deepEqual(captureCoordinatorFiles(), completeBaseline);
      const backup = path.join(root, "admission-state-backup");
      fs.renameSync(statePath, backup);
      try {
        fs.writeFileSync(statePath, admissionBaseline, { flag: "wx" });
        assert.throws(() =>
          assert.deepEqual(captureCoordinatorFiles(), completeBaseline),
        );
      } finally {
        if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
        fs.renameSync(backup, statePath);
      }
      assert.deepEqual(captureCoordinatorFiles(), completeBaseline);
      for (const fault of [
        "invalid_current",
        "invalid_pending",
        "unknown_entry",
        "same_home_after_read",
      ]) {
        const pending = path.join(
          path.dirname(statePath),
          "state.pending.json",
        );
        const unknown = path.join(path.dirname(statePath), "unexpected.json");
        let reached = 0;
        const hostBefore = hostStarts;
        let expected = admissionBaseline;
        let expectedFiles = captureCoordinatorFiles();
        try {
          if (fault === "invalid_current") {
            fs.writeFileSync(statePath, "invalid current");
            expected = fs.readFileSync(statePath);
            reached++;
          }
          if (fault === "invalid_pending") {
            fs.writeFileSync(pending, "foreign pending", { flag: "wx" });
            reached++;
          }
          if (fault === "unknown_entry") {
            fs.writeFileSync(unknown, "unknown fixture", { flag: "wx" });
            reached++;
          }
          if (fault === "same_home_after_read") {
            afterStateRead = () => {
              const concurrentIdentity =
                baseline.prepareRuntimeOwnedRepositoryDockerOperationIdentity(
                  { ...plan, operationId: otherBinding.operationId },
                  other,
                  randomBytes(32).toString("hex"),
                  "workbench",
                );
              assert.ok(concurrentIdentity);
              const injected =
                actualStore.saveRuntimeOwnedCoordinatorOperationStart(
                  other,
                  concurrentIdentity,
                );
              assert.equal(injected.status, "completed");
              assert.equal(injected.snapshotConfirmed, true);
              assert.equal(injected.lockReleased, true);
              expected = fs.readFileSync(statePath);
              expectedFiles = captureCoordinatorFiles();
              reached++;
            };
          }
          if (fault !== "same_home_after_read")
            expectedFiles = captureCoordinatorFiles();
          const refused = owner.beginRuntimeOwnedDockerRecovery(
            plan,
            management,
          );
          assert.ok(
            refused && refused.status === "blocked",
            JSON.stringify({ fault, refused }),
          );
          assert.equal(reached, 1);
          assert.equal(afterStateRead, null);
          assert.equal(hostStarts, hostBefore);
          assert.deepEqual(captureCoordinatorFiles(), expectedFiles);
          assert.deepEqual(fs.readFileSync(statePath), expected);
          assert.deepEqual(
            fs.readFileSync(admissionHost.hostPaths.marker),
            admissionMarker,
          );
          assert.equal(
            host.borrowOwnedHostRecoverySnapshot(management).snapshot.token,
            admissionHost.snapshot.token,
          );
          if (fault === "invalid_pending")
            assert.equal(fs.readFileSync(pending, "utf8"), "foreign pending");
          if (fault === "unknown_entry")
            assert.equal(fs.readFileSync(unknown, "utf8"), "unknown fixture");
          if ("recoveryCapability" in refused) {
            assert.equal(
              owner.verifyRuntimeOwnedDockerRecoveryBinding(
                refused.recoveryCapability,
                refused.recoveryId,
                management,
                hash,
              ),
              false,
            );
            assert.equal(
              owner.markRuntimeOwnedDockerResourceSubmission(
                refused.recoveryCapability,
                "create_provider",
              ),
              false,
            );
            assert.equal(
              owner.prepareRuntimeOwnedDockerHostCleanup(
                refused.recoveryCapability,
              ),
              null,
            );
            assert.equal(
              owner.abandonRuntimeOwnedDockerRecovery(
                refused.recoveryCapability,
              ),
              true,
            );
          }
          const available =
            locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash);
          assert.ok(available);
          assert.equal(available.release(), true);
          assert.deepEqual(captureCoordinatorFiles(), expectedFiles);
          admissionChecks.push(fault);
        } finally {
          afterStateRead = null;
          fs.writeFileSync(statePath, admissionBaseline);
          for (const file of [pending, unknown])
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      }
      const begun = owner.beginRuntimeOwnedDockerRecovery(plan, management);
      assert.ok(begun && begun.status === "ready", JSON.stringify(begun));
      assert.deepEqual(owner.inspectRuntimeOwnedDockerTaskAdmission(root), {
        status: "available",
        reason: "coordinator_current_admission_available",
        lockReleased: true,
      });
      capability = begun.recoveryCapability;
      const before = fs.readFileSync(statePath);
      const snapshot = host.borrowOwnedHostRecoverySnapshot(management);
      const marker = fs.readFileSync(snapshot.hostPaths.marker);
      assert.equal(
        locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash),
        null,
      );
      assert.equal(
        owner.abandonRuntimeOwnedDockerRecovery({ ...capability }),
        false,
      );
      assert.equal(owner.abandonRuntimeOwnedDockerRecovery(capability), true);
      assert.equal(owner.abandonRuntimeOwnedDockerRecovery(capability), true);
      assert.deepEqual(fs.readFileSync(statePath), before);
      assert.deepEqual(fs.readFileSync(snapshot.hostPaths.marker), marker);
      assert.equal(
        owner.verifyRuntimeOwnedDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          begun.recoveryId,
        ),
        false,
      );
      assert.equal(
        owner.prepareRuntimeOwnedDockerHostCleanup(capability),
        null,
      );
      const reacquired =
        locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash);
      assert.ok(reacquired);
      assert.equal(reacquired.release(), true);
      const startsBeforeConflict = hostStarts;
      const writesBeforeConflict = startWrites;
      const filesBeforeConflict = captureCoordinatorFiles();
      assert.equal(
        owner.inspectRuntimeOwnedDockerTaskAdmission(root).status,
        "available",
      );
      assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
      const conflict = owner.beginRuntimeOwnedDockerRecovery(plan, management);
      assert.ok(conflict && conflict.status === "blocked");
      assert.equal("recoveryCapability" in conflict, false);
      assert.equal(hostStarts, startsBeforeConflict);
      assert.equal(startWrites, writesBeforeConflict);
      assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
      assert.deepEqual(fs.readFileSync(statePath), before);
      assert.deepEqual(fs.readFileSync(snapshot.hostPaths.marker), marker);
      const afterConflict =
        locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash);
      assert.ok(afterConflict);
      assert.equal(afterConflict.release(), true);
      assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
      admissionChecks.push("durable_same_home_after_abandon");
      const head = path.join(root, ".git", "HEAD"),
        headBefore = fs.readFileSync(path.join(root, ".git", "HEAD"));
      let invalidated = 0;
      const rootPlan = Object.freeze({
        ...plan,
        stableLogicalHomeBindingHash: randomBytes(32).toString("hex"),
      });
      for (const operation of JSON.parse(before.toString("utf8")).operations) {
        assert.notEqual(
          JSON.parse(operation.identityJson).stableLogicalHomeBindingHash,
          rootPlan.stableLogicalHomeBindingHash,
        );
      }
      const readsBeforeInvalidation = stateReads.length;
      try {
        observedPlan = rootPlan;
        afterHomeAcquire = () => {
          fs.writeFileSync(head, "ref: refs/heads/unborn-fixture\n");
          invalidated++;
        };
        const rootRefused = owner.beginRuntimeOwnedDockerRecovery(
          rootPlan,
          management,
        );
        assert.ok(rootRefused && rootRefused.status === "blocked");
        assert.equal(invalidated, 1);
        assert.equal(afterHomeAcquire, null);
        assert.equal("recoveryCapability" in rootRefused, false);
        assert.equal(hostStarts, startsBeforeConflict);
        assert.equal(startWrites, writesBeforeConflict);
        assert.equal(stateReads.length, readsBeforeInvalidation + 1);
        assert.equal(stateReads.at(-1)?.status, "blocked");
        assert.equal(stateReads.at(-1)?.value, null);
        assert.equal(
          stateReads.at(-1)?.reason,
          "coordinator_state_owner_invalid",
        );
        assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
        assert.deepEqual(fs.readFileSync(statePath), before);
        assert.deepEqual(fs.readFileSync(snapshot.hostPaths.marker), marker);
        const released = locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(
          rootPlan.stableLogicalHomeBindingHash,
        );
        assert.ok(released);
        assert.equal(released.release(), true);
        assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
        admissionChecks.push("root_invalid_after_home_acquire");
      } finally {
        observedPlan = plan;
        afterHomeAcquire = null;
        fs.writeFileSync(head, headBefore);
      }
      assert.equal(
        await host.abandonOwnedHostOperationGenerationLock(management),
        true,
      );
      generationReleased = true;
      assert.deepEqual(fs.readFileSync(statePath), before);
      process.stdout.write(
        JSON.stringify({
          pid: process.pid,
          recoveryId: begun.recoveryId,
          generationReleased,
          admissionChecks,
        }),
      );
    } finally {
      storeMock.restore();
      submissionMock.restore();
    }
  } catch (error) {
    if (mode !== "auth_create_failure") throw error;
    primaryFailure = error;
  } finally {
    if (crashArmed)
      fs.writeFileSync(path.join(root, "unexpected-finally"), "executed", {
        flag: "wx",
      });
    try {
      if (owner && capability) {
        abandonCalls++;
        assert.equal(owner.abandonRuntimeOwnedDockerRecovery(capability), true);
      }
      if (!generationReleased) {
        assert.equal(
          await host.abandonOwnedHostOperationGenerationLock(management),
          true,
        );
        generationReleased = true;
      }
      if (mode === "auth_create_failure") {
        assert.equal(primaryFailure, injectedFailure);
        assert.equal(faultReached, 1);
        assert.equal(abandonCalls, 1);
        assert.equal(realDockerCalls, 0);
        assert.equal(crashArmed, false);
        assert.ok(authExpectedBytes && authRecoveryId && authHostBefore);
        assert.deepEqual(fs.readFileSync(statePath), authExpectedBytes);
        const currentPaths =
          host.borrowOwnedHostRecoverySnapshot(management).hostPaths;
        const currentHost = fs.lstatSync(currentPaths.root, { bigint: true });
        const currentMarker = fs.lstatSync(currentPaths.marker, {
          bigint: true,
        });
        assert.deepEqual(
          [currentHost.dev, currentHost.ino, currentHost.birthtimeNs].map(
            String,
          ),
          authHostBefore.root,
        );
        assert.deepEqual(
          [currentMarker.dev, currentMarker.ino, currentMarker.birthtimeNs].map(
            String,
          ),
          authHostBefore.markerIdentity,
        );
        assert.deepEqual(
          fs.readFileSync(currentPaths.marker),
          authHostBefore.marker,
        );
        const lease =
          locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash);
        assert.ok(lease);
        assert.equal(lease.release(), true);
        assert.equal(
          fs.existsSync(
            path.join(path.dirname(statePath), "state.pending.json"),
          ),
          false,
        );
        assert.equal(
          fs.existsSync(path.join(path.dirname(statePath), "state.lock")),
          false,
        );
        process.stdout.write(
          JSON.stringify({
            pid: process.pid,
            recoveryId: authRecoveryId,
            fault: authFault,
            faultReached,
            abandonCalls,
            realDockerCalls,
            dockerCalls,
            primaryFailure: injectedFailure.message,
            generationReleased,
            stateSha256: createHash("sha256")
              .update(authExpectedBytes)
              .digest("hex"),
            hostRetained: true,
            homeLeaseReacquired: true,
          }),
        );
        process.exitCode = 1;
      }
    } finally {
      homeMock.restore();
      lockMock.restore();
    }
  }
} else {
  const id = process.argv[3];
  assert.equal(typeof id, "string");
  const interruption = process.argv[4];
  const admissionVerification = process.argv[5];
  assert.ok(
    admissionVerification === undefined ||
      (admissionVerification === "verify_admission" && interruption === "none"),
  );
  assert.ok(
    interruption === undefined ||
      interruption === "none" ||
      interruption === "pending_saved" ||
      interruption === "host_removed" ||
      interruption === "pending_writer_blocked" ||
      interruption === "confirmed_writer_blocked",
  );
  const before = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const target = before.operations.find(
    (item: { recoveryId: string }) => item.recoveryId === id,
  );
  assert.ok(target);
  assert.ok(
    target.resources.every(
      (resource: { request: string }) => resource.request === "not_requested",
    ),
  );
  const identity = JSON.parse(target.identityJson);
  const native = path.join(
    distribution,
    "template",
    "tools",
    "domain-model",
    "windows-x64",
    "crdd-platform-access.exe",
  );
  const supervisor = fileURLToPath(
    new URL("../../../platform-access/src/lock/supervisor.ts", import.meta.url),
  );
  const generation = createHash("sha256")
    .update("crdd-host-operation-generation-v1\0")
    .update(identity.initialHostRecovery.record.rootName)
    .update("\0")
    .update(identity.initialHostRecoveryId.split(".")[2])
    .digest("hex");
  const supervisorPipe = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${generation.slice(0, 32)}`;
  const originals = new Map<string, unknown>();
  const violations: string[] = [];
  const calls: string[] = [];
  let recoveryStoreMock: { restore(): void } | null = null;
  let recoveryHostMock: { restore(): void } | null = null;
  let admissionStoreMock: { restore(): void } | null = null;
  let admissionSubmissionMock: { restore(): void } | null = null;
  let admissionHostMock: { restore(): void } | null = null;
  const recoveryAdmissionChecks: string[] = [];
  const admissionMutations: string[] = [];
  let admissionHostRecoveries = 0;
  let interruptionReached = 0;
  let finalWriterCalls = 0;
  let checkpointWriterCalls = 0;
  let actualCheckpointWriterCalls = 0;
  let underlyingFinalWriterCalls = 0;
  let hostRecoveryCalls = 0;
  let refusedWriterCalls = 0;
  let interruptionArmed = false;
  /**
   * 清掃途中の実保存・物理状態を同期通知し、回収子を終了処理なしで止める。
   * @responsibility pending確定とconfirmed保存前の有限切断点を分離する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同exact IDの固定hookへ一回到達し、指定した実状態を確認済みである。
   * @stimulus 同期相関packetを全量書込み、自己SIGKILLを発行する。
   * @observation 親がProcess終端、finally未実行、現在本文とHost実体を独立に読む。
   * @oracle kill返却後の継続は失敗とし、正常回復へ代替しない。
   * @cleanup N/A: 意図的切断のため次のfresh子が同IDで回収する。
   * @boundary 自己生成回収子だけ。Docker／Provider要求は既存allowlistで拒否する。
   */
  function interruptRecovery(): never {
    interruptionArmed = true;
    assert.equal(interruptionReached, 1);
    assert.equal(finalWriterCalls, 0);
    assert.deepEqual(violations, []);
    const packet = Buffer.from(
      JSON.stringify({
        pid: process.pid,
        recoveryId: id,
        phase: interruption,
        reached: interruptionReached,
        finalWriterCalls,
        checkpointWriterCalls,
        actualCheckpointWriterCalls,
        underlyingFinalWriterCalls,
        hostRecoveryCalls,
        calls,
        violations,
        observerRejectionConfirmed: true,
      }),
    );
    assert.equal(fs.writeSync(1, packet), packet.length);
    process.kill(process.pid, "SIGKILL");
    throw new Error("recovery_fixture_process_survived");
  }
  const processApi = cp as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  for (const name of [
    "spawn",
    "spawnSync",
    "execFile",
    "execFileSync",
    "exec",
    "execSync",
    "fork",
  ]) {
    const original = processApi[name];
    assert.ok(original);
    originals.set(name, original);
    processApi[name] = (...args: unknown[]) => {
      const [file, argv, options] = args;
      const vector = Array.isArray(argv) ? argv : null;
      const isNative =
        file === native && vector !== null && vector.length === 0;
      const isSupervisor =
        file === process.execPath &&
        vector?.length === 2 &&
        vector[0] === supervisor &&
        vector[1] === supervisorPipe;
      const cwd =
        options && typeof options === "object"
          ? (options as { cwd?: unknown }).cwd
          : undefined;
      const gitCommand = vector?.[0] === "-C" ? vector[2] : vector?.[0];
      const gitRoot = vector?.[0] === "-C" ? vector[1] : cwd;
      const isReadOnlyGit =
        file === "git" &&
        (gitRoot === root || gitRoot === distribution) &&
        [
          "rev-parse",
          "cat-file",
          "ls-files",
          "show",
          "diff",
          "status",
        ].includes(String(gitCommand));
      const shell =
        options && typeof options === "object"
          ? (options as { shell?: unknown }).shell
          : undefined;
      if (
        !(isNative || isSupervisor || isReadOnlyGit) ||
        (shell !== undefined && shell !== false)
      ) {
        violations.push(name);
        throw new Error("abandon_fixture_unexpected_process_request");
      }
      calls.push(isNative ? "native" : isSupervisor ? "supervisor" : "git");
      return Reflect.apply(original, cp, args);
    };
  }
  syncBuiltinESMExports();
  try {
    for (const name of originals.keys()) {
      assert.throws(
        () => processApi[name]?.("docker", ["version"], { shell: false }),
        /abandon_fixture_unexpected_process_request/u,
      );
    }
    assert.deepEqual(violations, [...originals.keys()]);
    violations.splice(0);
    if (admissionVerification === "verify_admission") {
      const actualStore = await import("../../../domain-model/src/index.ts");
      const actualHost = await import("../../src/execution/operation.ts");
      // 公開回復が呼び得る保存・出版入口を明示する。安全なRepository借用と実Readerは代役にしない。
      const mutationNames = [
        "checkpointRuntimeOwnedCoordinatorCleanup",
        "checkpointRuntimeOwnedCoordinatorLifecycle",
        "checkpointRuntimeOwnedCoordinatorResource",
        "checkpointRuntimeOwnedCoordinatorResourceNotIssued",
        "completeRuntimeOwnedCoordinatorCurrentRecovery",
        "registerRuntimeOwnedCoordinatorRecoveryResultDelivery",
        "advanceRuntimeOwnedCoordinatorRecoveryHistory",
        "writeRuntimeOwnedCoordinatorRestartCheckpoint",
        "writeRuntimeOwnedCoordinatorRecoveryTerminal",
        "writeRuntimeOwnedCoordinatorRecoveryCheckpoint",
        "writeRuntimeOwnedCoordinatorRecoveredHostCleanup",
        "saveRuntimeOwnedCoordinatorOperationStart",
        "completeRuntimeOwnedCoordinatorSettlement",
        "settleRuntimeOwnedCoordinatorResult",
      ] as const;
      admissionStoreMock = mock.module(
        new URL("../../../domain-model/src/index.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualStore,
            ...Object.fromEntries(
              mutationNames.map((name) => {
                const original = actualStore[name];
                assert.equal(typeof original, "function");
                return [
                  name,
                  (...args: unknown[]) => {
                    admissionMutations.push(name);
                    return Reflect.apply(original, undefined, args);
                  },
                ];
              }),
            ),
          },
        },
      );
      const actualSubmission = await import(
        "../../src/execution/controller.ts"
      );
      admissionSubmissionMock = mock.module(
        new URL("../../src/execution/controller.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualSubmission,
            ...Object.fromEntries(
              (
                [
                  "beginRuntimeOwnedCoordinatorHostSubmission",
                  "completeRuntimeOwnedCoordinatorHostSubmission",
                ] as const
              ).map((name) => [
                name,
                (...args: unknown[]) => {
                  admissionMutations.push(name);
                  return Reflect.apply(actualSubmission[name], undefined, args);
                },
              ]),
            ),
          },
        },
      );
      admissionHostMock = mock.module(
        new URL("../../src/execution/operation.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualHost,
            recoverOwnedOperationDirectories: (
              ...args: Parameters<
                typeof actualHost.recoverOwnedOperationDirectories
              >
            ) => {
              admissionHostRecoveries++;
              return actualHost.recoverOwnedOperationDirectories(...args);
            },
          },
        },
      );
    }
    if (interruption !== undefined && interruption !== "none") {
      const actualStore = await import("../../../domain-model/src/index.ts");
      const actualHost = await import("../../src/execution/operation.ts");
      recoveryHostMock = mock.module(
        new URL("../../src/execution/operation.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualHost,
            recoverOwnedOperationDirectories: (
              ...args: Parameters<
                typeof actualHost.recoverOwnedOperationDirectories
              >
            ) => {
              hostRecoveryCalls++;
              assert.equal(args[0], target.host.currentToken);
              assert.equal(args[2], identity.hostPaths.root);
              return actualHost.recoverOwnedOperationDirectories(...args);
            },
          },
        },
      );
      recoveryStoreMock = mock.module(
        new URL("../../../domain-model/src/index.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualStore,
            writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
              ...args: Parameters<
                typeof actualStore.writeRuntimeOwnedCoordinatorRecoveryCheckpoint
              >
            ) => {
              assert.equal(args[1], id);
              checkpointWriterCalls++;
              if (
                interruption === "pending_writer_blocked" &&
                args[3] === "host"
              ) {
                refusedWriterCalls++;
                assert.deepEqual(args[4], {
                  ...target.host,
                  cleanup: "pending",
                });
                return Object.freeze({
                  status: "blocked",
                  snapshotConfirmed: false,
                  lockReleased: true,
                });
              }
              actualCheckpointWriterCalls++;
              const saved =
                actualStore.writeRuntimeOwnedCoordinatorRecoveryCheckpoint(
                  ...args,
                );
              if (
                interruption === "pending_saved" &&
                args[1] === id &&
                args[3] === "host"
              ) {
                interruptionReached++;
                assert.equal(saved.status, "completed");
                assert.equal(saved.snapshotConfirmed, true);
                assert.equal(saved.lockReleased, true);
                const current = JSON.parse(fs.readFileSync(statePath, "utf8"));
                const operation = current.operations.find(
                  (item: { recoveryId: string }) => item.recoveryId === id,
                );
                assert.ok(operation);
                assert.equal(operation.host.cleanup, "pending");
                assert.equal(
                  operation.host.currentToken,
                  target.host.currentToken,
                );
                assert.equal(operation.host.pendingTransitionJson, null);
                assert.deepEqual(args[4], operation.host);
                assert.equal(
                  fs.lstatSync(identity.hostPaths.root).isDirectory(),
                  true,
                );
                assert.equal(
                  fs.lstatSync(identity.hostPaths.marker).isFile(),
                  true,
                );
                interruptRecovery();
              }
              return saved;
            },
            writeRuntimeOwnedCoordinatorRecoveredHostCleanup: (
              ...args: Parameters<
                typeof actualStore.writeRuntimeOwnedCoordinatorRecoveredHostCleanup
              >
            ) => {
              if (interruption === "confirmed_writer_blocked") {
                refusedWriterCalls++;
                finalWriterCalls++;
                assert.equal(args[1], id);
                assert.equal(hostRecoveryCalls, 0);
                assert.throws(() => fs.lstatSync(identity.hostPaths.root), {
                  code: "ENOENT",
                });
                assert.throws(() => fs.lstatSync(identity.hostPaths.marker), {
                  code: "ENOENT",
                });
                return Object.freeze({
                  status: "blocked",
                  snapshotConfirmed: false,
                  lockReleased: true,
                });
              }
              if (interruption === "host_removed" && args[1] === id) {
                interruptionReached++;
                const current = JSON.parse(fs.readFileSync(statePath, "utf8"));
                const operation = current.operations.find(
                  (item: { recoveryId: string }) => item.recoveryId === id,
                );
                assert.ok(operation);
                assert.equal(operation.host.cleanup, "pending");
                assert.equal(
                  operation.host.currentToken,
                  target.host.currentToken,
                );
                assert.equal(operation.host.pendingTransitionJson, null);
                assert.deepEqual(args[2], fs.readFileSync(statePath));
                assert.throws(() => fs.lstatSync(identity.hostPaths.root), {
                  code: "ENOENT",
                });
                assert.throws(() => fs.lstatSync(identity.hostPaths.marker), {
                  code: "ENOENT",
                });
                interruptRecovery();
              }
              finalWriterCalls++;
              underlyingFinalWriterCalls++;
              return actualStore.writeRuntimeOwnedCoordinatorRecoveredHostCleanup(
                ...args,
              );
            },
          },
        },
      );
    }
    // 実Storeの依存が通常namespaceを先に読むため、hook登録後の同じSourceを別namespaceで結合する。
    const recovery =
      interruption === undefined
        ? await import("../../src/execution/recovery.ts")
        : await import(
            new URL(
              "../../src/execution/recovery.ts?cleanup-interruption",
              import.meta.url,
            ).href
          );
    if (admissionVerification === "verify_admission") {
      const model = await import("../../../domain-model/src/index.ts");
      const baselineBytes = fs.readFileSync(statePath);
      const baselineFiles = captureCoordinatorFiles();
      const pendingPath = path.join(
        path.dirname(statePath),
        "state.pending.json",
      );
      const unknownPath = path.join(path.dirname(statePath), "unexpected.json");
      /**
       * 対象と非対象のHost実体を読取りだけで捕捉する。
       * @responsibility 回復拒否がHostを処置していないことを本文と実体で判定する。
       * @trace PRL-IT-013
       * @trace ERB-IT-003
       * @precondition 自己生成した二操作のHost Rootとmarkerが残る。
       * @stimulus 各Root・markerの実体とmarker本文を取得する。
       * @observation dev／ino／birthtime、種別、Root直下名、marker bytes。
       * @oracle 対象も非対象も同じ実体・内容を保持する。
       * @cleanup N/A: 読取りだけ。
       * @boundary Repository-local自己生成Host。
       */
      function captureAdmissionHosts() {
        return before.operations.map((operation: { identityJson: string }) => {
          const value = JSON.parse(operation.identityJson);
          return [value.hostPaths.root, value.hostPaths.marker].map(
            (file: string) => {
              assert.ok(path.resolve(file).startsWith(`${root}${path.sep}`));
              const stat = fs.lstatSync(file, { bigint: true });
              assert.equal(stat.isSymbolicLink(), false);
              return {
                file,
                identity: [stat.dev, stat.ino, stat.birthtimeNs].map(String),
                directory: stat.isDirectory(),
                content: stat.isDirectory()
                  ? fs.readdirSync(file).sort()
                  : fs.readFileSync(file),
              };
            },
          );
        });
      }
      const baselineHosts = captureAdmissionHosts();
      for (const fault of [
        "invalid_current",
        "pending_previous_mismatch",
        "unknown_entry",
        "binding_field_corrupt",
      ]) {
        try {
          if (fault === "invalid_current")
            fs.writeFileSync(statePath, "invalid current");
          if (fault === "pending_previous_mismatch") {
            const candidate = model.prepareCoordinatorStateHostSnapshot(
              baselineBytes,
              id,
              { ...target.host, cleanup: "pending" },
              before.repositoryBinding,
            );
            assert.ok(candidate);
            const changed = JSON.parse(candidate.toString());
            changed.previous.payloadSha256 = "0".repeat(64);
            const bytes = Buffer.from(`${encodeRuntimeStateValue(changed)}\n`);
            assert.ok(
              model.decodeRuntimeDomainSnapshot(
                bytes,
                before.repositoryBinding,
              ),
            );
            fs.writeFileSync(pendingPath, bytes, { flag: "wx" });
          }
          if (fault === "unknown_entry")
            fs.writeFileSync(unknownPath, "fixture", { flag: "wx" });
          if (fault === "binding_field_corrupt") {
            const changed = structuredClone(before);
            changed.repositoryBinding =
              before.repositoryBinding === "0".repeat(64)
                ? "1".repeat(64)
                : "0".repeat(64);
            const bytes = Buffer.from(`${encodeRuntimeStateValue(changed)}\n`);
            assert.equal(
              model.decodeRuntimeDomainSnapshot(
                bytes,
                before.repositoryBinding,
              ),
              null,
            );
            fs.writeFileSync(statePath, bytes);
          }
          const injectedFiles = captureCoordinatorFiles();
          const injectedHosts = captureAdmissionHosts();
          assert.deepEqual(injectedHosts, baselineHosts);
          const rejected: unknown =
            await recovery.recoverRuntimeOwnedDockerTaskForCurrentConsumer(
              id,
              verified.capability,
            );
          assert.deepEqual(rejected, {
            contract: "crdd-coordinator/current-task-recovery",
            status: "blocked",
            reason: "docker_task_recovery_preparation_unconfirmed",
            recoveryId: id,
            dockerCleanupConfirmed: false,
            hostCleanupConfirmed: false,
            locksReleased: true,
            historyConfirmed: false,
            deliveryPending: false,
            operationRetained: null,
            operationRemovalConfirmed: false,
            taskRecoveryCompleted: false,
            cleanupReason: null,
          });
          assert.deepEqual(admissionMutations, []);
          assert.equal(admissionHostRecoveries, 0);
          assert.deepEqual(violations, []);
          assert.deepEqual(captureCoordinatorFiles(), injectedFiles);
          assert.deepEqual(captureAdmissionHosts(), injectedHosts);
          recoveryAdmissionChecks.push(fault);
        } finally {
          fs.writeFileSync(statePath, baselineBytes);
          for (const file of [pendingPath, unknownPath]) {
            fs.rmSync(file, { force: true });
          }
        }
        assert.deepEqual(captureCoordinatorFiles(), baselineFiles);
        assert.deepEqual(captureAdmissionHosts(), baselineHosts);
      }
      assert.equal(recoveryAdmissionChecks.length, 4);
    }
    const report =
      await recovery.recoverRuntimeOwnedDockerTaskForCurrentConsumer(
        id,
        verified.capability,
      );
    assert.deepEqual(violations, []);
    if (
      interruption === "pending_writer_blocked" ||
      interruption === "confirmed_writer_blocked"
    ) {
      assert.equal(refusedWriterCalls, 1);
      assert.deepEqual(report, {
        contract: "crdd-coordinator/current-task-recovery",
        status: "blocked",
        reason: "docker_task_recovery_host_cleanup_unconfirmed",
        recoveryId: id,
        dockerCleanupConfirmed: true,
        hostCleanupConfirmed: false,
        locksReleased: true,
        historyConfirmed: false,
        deliveryPending: false,
        operationRetained: null,
        operationRemovalConfirmed: false,
        taskRecoveryCompleted: false,
        cleanupReason: null,
      });
      assert.equal(hostRecoveryCalls, 0);
      assert.equal(underlyingFinalWriterCalls, 0);
      process.stdout.write(
        JSON.stringify({
          pid: process.pid,
          recoveryId: id,
          report,
          phase: interruption,
          reached: refusedWriterCalls,
          checkpointWriterCalls,
          actualCheckpointWriterCalls,
          finalWriterCalls,
          underlyingFinalWriterCalls,
          hostRecoveryCalls,
          calls,
          violations,
          observerRejectionConfirmed: true,
        }),
      );
    } else {
      if (admissionVerification === "verify_admission") {
        assert.ok(
          admissionMutations.includes(
            "writeRuntimeOwnedCoordinatorRecoveryCheckpoint",
          ),
        );
        assert.ok(
          admissionMutations.includes(
            "completeRuntimeOwnedCoordinatorCurrentRecovery",
          ),
        );
        assert.ok(admissionHostRecoveries > 0);
      }
      assert.equal(report.status, "recovered", JSON.stringify(report));
      assert.equal(report.recoveryId, id);
      assert.equal(report.dockerCleanupConfirmed, true);
      assert.equal(report.hostCleanupConfirmed, true);
      assert.equal(report.locksReleased, true);
      assert.equal(report.historyConfirmed, true);
      assert.equal(report.operationRemovalConfirmed, true);
      assert.equal(report.taskRecoveryCompleted, true);
      assert.equal(report.operationRetained, false);
      assert.equal(report.deliveryPending, false);
      assert.equal(report.cleanupReason, null);
      assert.throws(() => fs.lstatSync(identity.hostPaths.root), {
        code: "ENOENT",
      });
      assert.throws(() => fs.lstatSync(identity.hostPaths.marker), {
        code: "ENOENT",
      });
      process.stdout.write(
        JSON.stringify({
          pid: process.pid,
          report,
          calls,
          violations,
          observerRejectionConfirmed: true,
          recoveryAdmissionChecks,
        }),
      );
    }
  } finally {
    if (interruptionArmed)
      fs.writeFileSync(
        path.join(root, "unexpected-recovery-finally"),
        "executed",
        { flag: "wx" },
      );
    recoveryStoreMock?.restore();
    recoveryHostMock?.restore();
    admissionStoreMock?.restore();
    admissionSubmissionMock?.restore();
    admissionHostMock?.restore();
    for (const [name, original] of originals)
      processApi[name] = original as (...args: unknown[]) => unknown;
    syncBuiltinESMExports();
  }
}
