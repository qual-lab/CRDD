/**
 * 放棄した実Ownerと別Process回復を分離する固定試験子入口。
 * @packageDocumentation
 * @responsibility 自己生成Repositoryで旧Owner終了・清掃途中切断と本番consumer回復を検証する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @level IT
 * @scope 実Root・Host・Writerと試験Root内の実wx排他。通常Host試験はHome観測と固定切断hookを模擬し、停止前Lock実体を通知して親の停止下明示処置へ接続する。auth_create_failureはDocker代役と通常例外を確認し、明示したauth_create_unknownだけは従来の所在・専用承認Rootで固定Imageの停止Containerを一件作成する。
 * @boundary 旧Owner Processの終了後の現在回復。専用モードの同期CLI終了は子孫tree／daemon queue終端の証明ではない。
 */

import assert from "node:assert/strict";
import cp from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import { containerCreation } from "../../../docker-isolation/src/execution/preparation.ts";
import { DIAGNOSTIC_IMAGE } from "../../../docker-isolation/src/image/assets.ts";
import {
  type IsolationRequest,
  prepareIsolation,
} from "../../../docker-isolation/src/index.ts";
import type {
  ExecutionOperationRecord,
  OperationRecord,
} from "../../../execution-model/src/index.ts";
import { getIsolationSettings } from "../../src/lifecycle/environment.ts";
import { canonicalJson } from "../support/contract-assertions.ts";
import { sourceUrl } from "../support/task-requests.ts";
import { recoveryEnvironmentFixtureUrl } from "../support/recovery.ts";
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
const authCreateImage = DIAGNOSTIC_IMAGE;
const authCreateImageId =
  "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
if (mode === "auth_create_failure") {
  assert.equal(process.platform, "win32");
  assert.equal(path.dirname(root), path.join(distribution, ".crdd", "tests"));
  assert.match(path.basename(root), /^auth-create-failure-[a-zA-Z0-9]+$/u);
  assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
}
const vc = await import("../../../version-control/src/index.ts");
const verified = vc.getRepository(root);
assert.equal(verified.status, "completed");
assert.ok(verified.capability);
assert.equal(vc.resolveVerifiedRepositoryRoot(verified.capability), root);
const statePath = path.join(root, ".crdd", "execution-model", "state.json");
// この有限な親子試験だけで共有する所在。実ユーザーHomeと保護Policyは触らない。
const environment =
  mode === "auth_create_unknown"
    ? await import("../../src/lifecycle/environment.ts")
    : null;
const fixtureHomeDirectory =
  mode === "auth_create_unknown"
    ? environment?.providerHomesDirectoryCandidate()
    : path.join(root, ".crdd", "tests", "reentry-home-locks");
const fixtureRuntimeDirectory = path.join(
  root,
  ".crdd",
  "tests",
  "reentry-runtime-locks",
);
if (mode !== "auth_create_unknown") {
  assert.equal(typeof fixtureHomeDirectory, "string");
  fs.mkdirSync(fixtureHomeDirectory as string, { recursive: true });
  fs.mkdirSync(fixtureRuntimeDirectory, { recursive: true });
}

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

/** 停止前の元Lock実体を親へ渡す。製品の回復許可や自動清掃には使用しない。 */
function captureFixtureLocks() {
  if (mode === "auth_create_unknown") return [];
  const entries = [];
  for (const directory of [
    path.join(root, ".crdd", "lock"),
    fixtureHomeDirectory,
    fixtureRuntimeDirectory,
  ]) {
    assert.equal(typeof directory, "string");
    for (const name of fs
      .readdirSync(directory as string)
      .filter((name) => name.endsWith(".lock"))) {
      const file = path.join(directory as string, name);
      const stat = fs.lstatSync(file, { bigint: true });
      assert.equal(stat.isFile(), true);
      assert.equal(stat.isSymbolicLink(), false);
      assert.equal(stat.nlink, 1n);
      const bytes = fs.readFileSync(file);
      assert.equal(JSON.parse(bytes.toString()).owner.processId, process.pid);
      entries.push({
        path: path.relative(root, file),
        identity: [stat.dev, stat.ino, stat.birthtimeNs].map(String),
        bytes: bytes.toString("base64"),
      });
    }
  }
  return entries;
}

/**
 * 自己生成Host Rootと六子Directoryの実体を観測する。
 * @responsibility 退役markerではなく実際の保存Receipt対象を比較する。
 * @trace PRL-IT-013
 * @boundary 読取り専用。回収許可や不存在証明を生成しない。
 */
function captureHostRoot(target: string) {
  const stat = fs.lstatSync(target, { bigint: true });
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true);
  const identity = (value: fs.BigIntStats) =>
    [value.dev, value.ino, value.birthtimeNs].map(String);
  return {
    root: identity(stat),
    children: fs
      .readdirSync(target)
      .sort()
      .map((name) => {
        const child = fs.lstatSync(path.join(target, name), { bigint: true });
        assert.equal(child.isDirectory() && !child.isSymbolicLink(), true);
        return { name, identity: identity(child) };
      }),
  };
}

if (mode !== "recovery") {
  const domain = await import("../../../execution-model/src/index.ts");
  const host = await import("../../src/lifecycle/host.ts");
  const repository = await import("../../src/lifecycle/host.ts");
  const observeOperation = (owner: unknown) =>
    domain.readState(host.operationStateInput(owner), { scope: "operation" });
  const homes = await import("../../src/lifecycle/environment.ts");
  const locks = await import("../../src/lifecycle/host.ts");
  const areas = await import("../../src/lifecycle/host.ts");
  areas.requireReadyRepositoryExecutionDataArea(
    areas.ensureRepositoryExecutionDataAreaFromWorkingDirectory(root, "tests"),
    "abandon_fixture",
  );
  const owned = host.createOwnedOperationDirectories({
    root: verified.capability,
    purpose: "advice",
    recordingCurrent: () => true,
  });
  assert.ok(owned.directories);
  const directories = owned.directories;
  const otherOwned = host.createOwnedOperationDirectories({
    root: verified.capability,
    purpose: "advice",
    recordingCurrent: () => true,
  });
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
  assert.equal(observeOperation(management).status, "completed");
  const hash = randomBytes(32).toString("hex"),
    suffix = randomBytes(8).toString("hex");
  const plan = Object.freeze({
    provider: "codex" as const,
    consumer: "workbench" as const,
    operationId: binding.operationId,
    executionSelection: executionSelection("executor", {
      provider: "codex",
      model: "gpt-5.5",
      effort: "low",
    }),
    taskAttempt: 0 as const,
    providerHomeIdentityHash: hash,
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
  const baseline = await import("../../src/lifecycle/environment.ts");
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
    domain.saveOperationStart(
      host.operationStartInput(other, () => null),
      otherIdentity,
    ).status,
    "completed",
  );
  let observedPlan = plan;
  let afterStateRead: (() => void) | null = null;
  let startWrites = 0;
  const stateReads: ReturnType<typeof observeOperation>[] = [];
  const admissionChecks: string[] = [];
  const homeMock = mock.module(
    new URL("../../src/lifecycle/environment.ts", import.meta.url).href,
    {
      namedExports: {
        ...homes,
        providerHomesDirectoryCandidate:
          mode === "auth_create_unknown"
            ? homes.providerHomesDirectoryCandidate
            : () => fixtureHomeDirectory,
        runtimeStateDirectoryCandidate:
          mode === "auth_create_unknown"
            ? homes.runtimeStateDirectoryCandidate
            : () => fixtureRuntimeDirectory,
        inspectRuntimeOwnedWindowsProviderHomeCandidate: () => ({
          status: "candidate",
          providerHome: observedPlan,
        }),
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
  let authHostBefore: ReturnType<typeof captureHostRoot> | null = null;
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
        startWrites,
        ...(mode === "auth_create_unknown"
          ? {}
          : { locks: captureFixtureLocks() }),
      }),
    );
    assert.equal(fs.writeSync(1, packet), packet.length);
    process.kill(process.pid, "SIGKILL");
    throw new Error("crash_fixture_process_survived");
  }
  try {
    const authCheckpointResults: ReturnType<
      typeof domain.saveOperationCheckpoint
    >[] = [];
    const domainMock = mock.module(
      new URL("../../../execution-model/src/index.ts", import.meta.url).href,
      {
        namedExports: {
          ...domain,
          saveOperationStart: (
            ...args: Parameters<typeof domain.saveOperationStart>
          ) => {
            const input = args[0];
            if (
              typeof args[1] !== "string" ||
              input === null ||
              typeof input !== "object" ||
              !("identity" in input) ||
              !("observeSettlementRepository" in input)
            )
              return domain.saveOperationStart(...args);
            startWrites++;
            const result = domain.saveOperationStart(...args);
            if (
              (mode === "cleanup_withheld" || mode === "parent_terminated") &&
              input.identity === management
            ) {
              assert.equal(result.status, "completed");
              assert.equal(result.snapshotConfirmed, true);
              assert.equal(result.lockReleased, true);
              assert.equal(typeof result.recoveryId, "string");
            }
            if (mode === "state_saved" && input.identity === management) {
              assert.equal(startWrites, 1);
              assert.equal(result.status, "completed");
              assert.equal(result.snapshotConfirmed, true);
              assert.equal(result.lockReleased, true);
              assert.equal(typeof result.recoveryId, "string");
              assert.ok(result.recoveryId);
              terminateAtBoundary(result.recoveryId);
            }
            return result;
          },
          saveOperationCheckpoint: (
            ...args: Parameters<typeof domain.saveOperationCheckpoint>
          ) => {
            const result = domain.saveOperationCheckpoint(...args);
            if (authCreateMode && args[2].kind === "resource")
              authCheckpointResults.push(result);
            return result;
          },
          readState: new Proxy(domain.readState, {
            apply(target, receiver, args) {
              const result = Reflect.apply(target, receiver, args);
              if (args.length === 2 && args[1]?.scope === "operation") {
                stateReads.push(result as ReturnType<typeof observeOperation>);
                if (afterStateRead) {
                  const hook = afterStateRead;
                  afterStateRead = null;
                  hook();
                }
              }
              return result;
            },
          }),
        },
      },
    );
    try {
      owner = await import(
        recoveryEnvironmentFixtureUrl(
          new URL("../../src/lifecycle/environment.ts", import.meta.url),
        )
      );
      assert.ok(owner);
      if (mode !== "producer") {
        const begun = owner.beginRuntimeOwnedDockerRecovery(plan, management);
        assert.ok(begun && begun.status === "ready", JSON.stringify(begun));
        capability = begun.recoveryCapability;
        if (authCreateMode) {
          authRecoveryId = begun.recoveryId;

          assert.equal(startWrites, 1);
          assert.deepEqual(fs.readdirSync(directories.providerHome), []);
          const config = path.join(
            directories.management,
            "auth-create-config",
          );
          fs.mkdirSync(config);
          const resource: IsolationRequest["resources"][number] = {
            kind: "container",
            key: "create_subscription_auth_probe",
            name: plan.authContainerName,
            ownershipLabel: plan.ownershipLabel,
            image: authCreateImage,
            argv: ["python", "-c", "pass"],
            environment: { HOME: "/provider-home" },
            mounts: [
              {
                source: directories.providerHome,
                target: "/provider-home",
                readOnly: true,
              },
            ],
            network: null,
            networkAlias: null,
            user: "65532:65532",
            workingDirectory: null,
            entrypoint: null,
            tmpfsBytes: null,
            interactive: false,
            tty: false,
            init: false,
            seccomp: null,
          };
          const request: IsolationRequest = {
            managementDirectory: directories.management,
            resources: [resource],
            steps: [
              {
                key: "create",
                action: "create",
                resource: resource.key,
                timeoutMs: 15000,
              },
            ],
            cleanupOrder: [resource.key],
            setupTimeoutMs: 15000,
            unreceiptedAbsence: "retain",
            verifyLabelAbsence: true,
          };
          const prepared = prepareIsolation(request, getIsolationSettings());
          assert.ok(prepared);
          const frame = {
            snapshot: prepared.resources,
            cleanup: {
              cleanupOrder: request.cleanupOrder,
              setupTimeoutMs: request.setupTimeoutMs,
              unreceiptedAbsence: request.unreceiptedAbsence,
              verifyLabelAbsence: request.verifyLabelAbsence,
            },
          };
          const createArgv = containerCreation(resource, null);
          const expected = [
            "create",
            "--pull=never",
            "--network",
            "none",
            "--read-only",
            "--name",
            plan.authContainerName,
            "--label",
            plan.ownershipLabel,
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--user=65532:65532",
            "--env",
            "HOME=/provider-home",
            "--mount",
            `type=bind,src=${directories.providerHome},dst=/provider-home,bind-propagation=rprivate,readonly`,
            authCreateImage,
            "python",
            "-c",
            "pass",
          ];
          assert.deepEqual(createArgv, expected);
          assert.equal(authCheckpointResults.length, 0);
          assert.equal(
            owner.recordDockerResourceEvent(
              begun.recoveryCapability,
              "create_subscription_auth_probe",
              frame,
              "submission",
            ),
            true,
          );
          assert.equal(authCheckpointResults.length, 1);
          const intent = authCheckpointResults[0];
          assert.ok(intent);
          assert.equal(intent.status, "completed");
          assert.equal(intent.snapshotConfirmed, true);
          assert.equal(intent.lockReleased, true);
          const savedIntent = observeOperation(management);
          assert.equal(savedIntent.status, "completed");
          assert.equal(savedIntent.lockReleased, true);
          assert.ok(savedIntent.value);
          const intentOperation: ExecutionOperationRecord | undefined =
            savedIntent.value.snapshot.operations.find(
              (value: OperationRecord): value is ExecutionOperationRecord =>
                value.kind === "docker_task" &&
                value.recoveryId === begun.recoveryId,
            );
          assert.ok(intentOperation);
          assert.ok(intentOperation.resources);
          const auth = intentOperation.resources.snapshot.resources.find(
            (value) => value.key === resource.key,
          );
          const authCheckpoint = intentOperation.resources.checkpoints.find(
            (value) => value.key === resource.key,
          );
          assert.ok(auth);
          assert.equal(auth.identity.dockerId, null);
          assert.equal(auth.request, "not_issued");
          assert.deepEqual(authCheckpoint, {
            key: resource.key,
            submission: "intent_saved",
            receiptSource: null,
            observation: "unobserved",
            absenceEvidenceSha256: null,
          });
          authExpectedBytes = Buffer.from(
            `${canonicalJson(savedIntent.value.snapshot)}\n`,
          );
          authHostBefore = captureHostRoot(owned.root);
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
                User: "65532:65532",
                Labels: { "crdd.coordinator.runtime": suffix },
              },
              HostConfig: {
                ReadonlyRootfs: true,
                Privileged: false,
                CapDrop: ["ALL"],
                CapAdd: [],
                SecurityOpt: ["no-new-privileges"],
                PidsLimit: 0,
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
                  ? `${authCreateImageId}\n`
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
          assert.equal(image.stdout.trim(), authCreateImageId);
          const created = runAuthDocker([...dockerPrefix, ...createArgv]);
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
          assert.equal(values[0].Id, dockerId);
          assert.equal(values[0].Name, "/" + resource.name);
          assert.deepEqual(
            values[0].Config.Labels,
            Object.fromEntries([resource.ownershipLabel.split("=")]),
          );
          assert.equal(values[0].State.Status, "created");
          if (authFault === "before_unknown") {
            faultReached++;
            throw injectedFailure;
          }
          // Intentは耐久保存済み。Receiptを保存しない故障窓なので追加の推測更新は行わない。
          const expectedUnknown = authExpectedBytes;
          if (authFault === "after_unknown") {
            faultReached++;
            throw injectedFailure;
          }
          const savedUnknown = observeOperation(management);
          assert.equal(savedUnknown.status, "completed");
          assert.equal(savedUnknown.lockReleased, true);
          assert.ok(savedUnknown.value);
          assert.deepEqual(
            Buffer.from(`${canonicalJson(savedUnknown.value.snapshot)}\n`),
            expectedUnknown,
          );
          authExpectedBytes = expectedUnknown;
          const unknownOperation: ExecutionOperationRecord | undefined =
            savedUnknown.value.snapshot.operations.find(
              (value: OperationRecord): value is ExecutionOperationRecord =>
                value.kind === "docker_task" &&
                value.recoveryId === begun.recoveryId,
            );
          assert.ok(unknownOperation);
          assert.ok(unknownOperation.resources);
          const unknownAuth =
            unknownOperation.resources.snapshot.resources.find(
              (value) => value.key === resource.key,
            );
          const unknownCheckpoint = unknownOperation.resources.checkpoints.find(
            (value) => value.key === resource.key,
          );
          assert.ok(unknownAuth && unknownCheckpoint);
          assert.equal(unknownAuth.request, "not_issued");
          assert.equal(unknownCheckpoint.submission, "intent_saved");
          const receiptRegistered =
            unknownAuth.identity.dockerId !== null ||
            unknownCheckpoint.receiptSource !== null;
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
          const current = observeOperation(management);
          assert.equal(current.status, "completed");
          assert.equal(current.lockReleased, true);
          assert.ok(current.value);
          const target: ExecutionOperationRecord | undefined =
            current.value.snapshot.operations.find(
              (item): item is ExecutionOperationRecord =>
                item.kind === "docker_task" &&
                item.recoveryId === begun.recoveryId,
            );
          assert.ok(target?.kind === "docker_task");
          assert.equal(target.resources, null);
          assert.equal(target.execution.providerStart, "not_started");
          assert.equal(target.execution.externalSend, "not_issued");
          assert.equal(target.execution.sharedWrite, "not_issued");
          assert.equal(startWrites, 1);
          assert.equal(realDockerCalls, 0);
          assert.equal(abandonCalls, 0);
          crashArmed = true;
          const packet = Buffer.from(
            `${JSON.stringify({ pid: process.pid, recoveryId: begun.recoveryId, phase: mode, startWrites, operationRoot: root, cleanupObserved: false, authCreateDockerCalls: realDockerCalls, locks: captureFixtureLocks() })}\n`,
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
        terminateAtBoundary(begun.recoveryId);
      }
      const admissionBaseline = fs.readFileSync(statePath);
      const admissionHost = domain
        .readState(verified.capability, { scope: "recovery" })
        .value?.snapshot.operations.find(
          (item) =>
            item.kind === "host_operation" &&
            item.operationId === binding.operationId,
        );
      assert.ok(admissionHost);
      const admissionRoot = captureHostRoot(owned.root);
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
        const writesBeforeAdmission = startWrites;
        const pending = path.join(
          path.dirname(statePath),
          "state.pending.json",
        );
        const unknown = path.join(path.dirname(statePath), "unexpected.json");
        let reached = 0;
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
              const injected = domain.saveOperationStart(
                host.operationStartInput(other, () => null),
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
            refused === null || refused.status === "blocked",
            JSON.stringify({ fault, refused }),
          );
          assert.equal(reached, 1);
          assert.equal(afterStateRead, null);
          assert.equal(
            startWrites,
            writesBeforeAdmission + (fault === "same_home_after_read" ? 1 : 0),
          );
          assert.deepEqual(captureCoordinatorFiles(), expectedFiles);
          assert.deepEqual(fs.readFileSync(statePath), expected);
          assert.deepEqual(captureHostRoot(owned.root), admissionRoot);
          if (fault === "invalid_pending")
            assert.equal(fs.readFileSync(pending, "utf8"), "foreign pending");
          if (fault === "unknown_entry")
            assert.equal(fs.readFileSync(unknown, "utf8"), "unknown fixture");
          if (refused !== null && "recoveryCapability" in refused) {
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
              owner.recordDockerResourceEvent(
                refused.recoveryCapability,
                "create_provider",
                {
                  snapshot: { resources: [] },
                  cleanup: {
                    cleanupOrder: [],
                    setupTimeoutMs: 15000,
                    unreceiptedAbsence: "retain",
                    verifyLabelAbsence: true,
                  },
                },
                "submission",
              ),
              false,
            );
            assert.equal(
              owner.canPrepareRuntimeOwnedDockerHostCleanup(
                refused.recoveryCapability,
                undefined,
              ),
              false,
            );
            assert.equal(
              owner.abandonRuntimeOwnedDockerRecovery(
                refused.recoveryCapability,
              ),
              false,
            );
          }
          const availableAcquisition = locks.acquireProviderHomeLock(
            hash,
            fixtureHomeDirectory,
          );
          assert.ok(availableAcquisition.status === "acquired");
          const available = availableAcquisition.lock;
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
        assert.deepEqual(
          domain
            .readState(verified.capability, { scope: "recovery" })
            .value?.snapshot.operations.find(
              (item) =>
                item.kind === "host_operation" &&
                item.operationId === binding.operationId,
            ),
          admissionHost,
        );
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
      const hostRootBefore = captureHostRoot(owned.root);
      // Coordinatorの開始記録はHomeを取得しない。実取得・解放はExecutorの責務。
      const independentHome = locks.acquireProviderHomeLock(
        hash,
        fixtureHomeDirectory,
      );
      assert.equal(
        independentHome.status,
        "acquired",
        JSON.stringify(independentHome),
      );
      assert.ok(independentHome.status === "acquired");
      assert.equal(independentHome.lock.release(), true);
      assert.equal(
        owner.abandonRuntimeOwnedDockerRecovery({ ...capability }),
        false,
      );
      assert.equal(owner.abandonRuntimeOwnedDockerRecovery(capability), false);
      assert.equal(owner.abandonRuntimeOwnedDockerRecovery(capability), false);
      assert.deepEqual(fs.readFileSync(statePath), before);
      assert.deepEqual(captureHostRoot(owned.root), hostRootBefore);
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
        owner.canPrepareRuntimeOwnedDockerHostCleanup(
          capability,
          observeOperation(management).value?.operationStates.find(
            (state) => state.operation.recoveryId === begun.recoveryId,
          ),
        ),
        false,
      );
      const reacquiredAcquisition = locks.acquireProviderHomeLock(
        hash,
        fixtureHomeDirectory,
      );
      assert.ok(reacquiredAcquisition.status === "acquired");
      const reacquired = reacquiredAcquisition.lock;
      assert.ok(reacquired);
      assert.equal(reacquired.release(), true);
      const writesBeforeConflict = startWrites;
      const filesBeforeConflict = captureCoordinatorFiles();
      assert.equal(
        owner.inspectRuntimeOwnedDockerTaskAdmission(root).status,
        "available",
      );
      assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
      const conflict = owner.beginRuntimeOwnedDockerRecovery(plan, management);
      assert.ok(conflict === null || conflict.status === "blocked");
      assert.equal(
        conflict !== null && "recoveryCapability" in conflict,
        false,
      );
      assert.equal(startWrites, writesBeforeConflict);
      assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
      assert.deepEqual(fs.readFileSync(statePath), before);
      assert.deepEqual(captureHostRoot(owned.root), hostRootBefore);
      const afterConflictAcquisition = locks.acquireProviderHomeLock(
        hash,
        fixtureHomeDirectory,
      );
      assert.ok(afterConflictAcquisition.status === "acquired");
      const afterConflict = afterConflictAcquisition.lock;
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
        if (operation.kind !== "docker_task") continue;
        assert.notEqual(
          JSON.parse(operation.identityJson).stableLogicalHomeBindingHash,
          rootPlan.stableLogicalHomeBindingHash,
        );
      }
      const readsBeforeInvalidation = stateReads.length;
      try {
        observedPlan = rootPlan;
        afterStateRead = () => {
          fs.writeFileSync(head, "ref: refs/heads/unborn-fixture\n");
          invalidated++;
        };
        const rootFailures: unknown[] = [];
        const rootRefused = owner.beginRuntimeOwnedDockerRecovery(
          rootPlan,
          management,
          (diagnostic) => {
            rootFailures.push(diagnostic);
          },
        );
        assert.ok(
          rootRefused === null || rootRefused.status === "blocked",
          JSON.stringify(rootFailures),
        );
        assert.equal(invalidated, 1);
        assert.equal(afterStateRead, null);
        if (rootRefused !== null && "recoveryCapability" in rootRefused)
          assert.equal(
            owner.verifyRuntimeOwnedDockerRecoveryBinding(
              rootRefused.recoveryCapability,
              rootRefused.recoveryId,
              management,
              rootPlan.stableLogicalHomeBindingHash,
            ),
            false,
          );
        assert.equal(startWrites, writesBeforeConflict + 1);
        assert.equal(stateReads.length, readsBeforeInvalidation + 1);
        // 完全State観測後の失効は、保存入口のRoot再照合でEffect前に拒否する。
        const invalidationReads = stateReads.slice(readsBeforeInvalidation);
        assert.equal(invalidationReads[0]?.status, "completed");
        assert.ok(invalidationReads[0]?.value);
        assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
        assert.deepEqual(fs.readFileSync(statePath), before);
        assert.deepEqual(captureHostRoot(owned.root), hostRootBefore);
        const releasedAcquisition = locks.acquireProviderHomeLock(
          rootPlan.stableLogicalHomeBindingHash,
          fixtureHomeDirectory,
        );
        assert.ok(releasedAcquisition.status === "acquired");
        const released = releasedAcquisition.lock;
        assert.ok(released);
        assert.equal(released.release(), true);
        assert.deepEqual(captureCoordinatorFiles(), filesBeforeConflict);
        admissionChecks.push("root_invalid_after_state_read");
      } finally {
        observedPlan = plan;
        afterStateRead = null;
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
      domainMock.restore();
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
        assert.equal(
          owner.abandonRuntimeOwnedDockerRecovery(capability),
          false,
        );
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
        assert.deepEqual(captureHostRoot(owned.root), authHostBefore);
        const lease = locks.acquireProviderHomeLock(hash, fixtureHomeDirectory);
        assert.ok(lease.status === "acquired");
        assert.equal(lease.lock.release(), true);
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
  assert.equal(target.resources, null);
  const targetHost = before.operations.find(
    (item: { kind: string; operationId: string }) =>
      item.kind === "host_operation" &&
      item.operationId === JSON.parse(target.identityJson).operationId,
  );
  assert.ok(targetHost);
  const hostRoot = path.join(
    root,
    ".crdd",
    "operations",
    targetHost.operationId,
  );
  const originals = new Map<string, unknown>();
  const violations: string[] = [];
  const calls: string[] = [];
  let recoveryStoreMock: { restore(): void } | null = null;
  let recoveryHostMock: { restore(): void } | null = null;
  let admissionStoreMock: { restore(): void } | null = null;
  let admissionHostMock: { restore(): void } | null = null;
  const recoveryAdmissionChecks: string[] = [];
  const admissionMutations: string[] = [];
  let admissionHostRecoveries = 0;
  let interruptionReached = 0;
  let finalWriterCalls = 0;
  let checkpointWriterCalls = 0;
  const checkpointKinds: string[] = [];
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
        checkpointKinds,
        actualCheckpointWriterCalls,
        underlyingFinalWriterCalls,
        hostRecoveryCalls,
        calls,
        violations,
        locks: captureFixtureLocks(),
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
      if (!isReadOnlyGit || (shell !== undefined && shell !== false)) {
        violations.push(name);
        throw new Error("abandon_fixture_unexpected_process_request");
      }
      calls.push("git");
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
      const actualStore = await import("../../../execution-model/src/index.ts");
      const actualHost = await import("../../src/lifecycle/host.ts");
      // 公開回復が呼び得る保存・出版入口を明示する。安全なRepository借用と実Readerは代役にしない。
      const mutationNames = [
        "saveOperationCheckpoint",
        "completeRecovery",
        "saveRecoveryHistory",
        "saveRecoveryCheckpoint",
        "saveOperationStart",
        "completeOperation",
      ] as const;
      admissionStoreMock = mock.module(
        new URL("../../../execution-model/src/index.ts", import.meta.url).href,
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
      admissionHostMock = mock.module(
        new URL("../../src/lifecycle/host.ts", import.meta.url).href,
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
      const actualStore = await import("../../../execution-model/src/index.ts");
      const refused = actualStore.saveOperationCheckpoint(null, null, {
        kind: "host_operation",
        value: null,
      });
      recoveryStoreMock = mock.module(
        new URL("../../../execution-model/src/index.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualStore,
            saveOperationCheckpoint: (
              ...args: Parameters<typeof actualStore.saveOperationCheckpoint>
            ) => {
              const request = args[2];
              if (request.kind !== "host_operation")
                return actualStore.saveOperationCheckpoint(...args);
              const value = request.value;
              assert.ok(value !== null && typeof value === "object");
              assert.ok("operation" in value);
              const update = value.operation;
              assert.ok(update !== null && typeof update === "object");
              assert.ok(
                "operationId" in update &&
                  "cleanup" in update &&
                  "phase" in update,
              );
              assert.equal(update.operationId, targetHost.operationId);
              if (update.cleanup === "pending") {
                checkpointWriterCalls++;
                checkpointKinds.push("host_operation");
                if (interruption === "pending_writer_blocked") {
                  refusedWriterCalls++;
                  assert.equal(fs.existsSync(hostRoot), true);
                  return {
                    ...refused,
                    recoveryId: targetHost.recoveryId,
                    lockReleased: true,
                  };
                }
                actualCheckpointWriterCalls++;
                const result = actualStore.saveOperationCheckpoint(...args);
                if (interruption === "pending_saved") {
                  assert.equal(
                    result.snapshotConfirmed && result.lockReleased,
                    true,
                  );
                  assert.equal(fs.existsSync(hostRoot), true);
                  interruptionReached++;
                  interruptRecovery();
                }
                return result;
              }
              if (
                update.phase === "terminal" &&
                update.cleanup === "confirmed"
              ) {
                finalWriterCalls++;
                assert.equal(fs.existsSync(hostRoot), false);
                if (interruption === "confirmed_writer_blocked") {
                  refusedWriterCalls++;
                  return {
                    ...refused,
                    recoveryId: targetHost.recoveryId,
                    lockReleased: true,
                  };
                }
                underlyingFinalWriterCalls++;
              }
              return actualStore.saveOperationCheckpoint(...args);
            },
            saveRecoveryCheckpoint: (
              ...args: Parameters<typeof actualStore.saveRecoveryCheckpoint>
            ) => actualStore.saveRecoveryCheckpoint(...args),
          },
        },
      );
      // 既存のHost Writer importを、上のEM代役が有効な状態で結び直す。
      // 回復子には生成元Processの生Ownerがなく、このModuleで取得と解放をそろえる。
      const actualHost: typeof import("../../src/lifecycle/host.ts") =
        await import(
          new URL(
            "../../src/lifecycle/host.ts?host-writer-interruption",
            import.meta.url,
          ).href
        );
      recoveryHostMock = mock.module(
        new URL("../../src/lifecycle/host.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualHost,
            recoverOwnedOperationDirectories: (
              ...args: Parameters<
                typeof actualHost.recoverOwnedOperationDirectories
              >
            ) => {
              hostRecoveryCalls++;
              assert.equal(args[0], targetHost.recoveryId);
              return actualHost.recoverOwnedOperationDirectories(...args);
            },
          },
        },
      );
      if (interruption === "host_removed") {
        const remove = fs.rmSync;
        mock.method(
          fs,
          "rmSync",
          (file: fs.PathLike, options?: fs.RmOptions) => {
            const result = remove(file, options);
            if (String(file) === hostRoot) {
              assert.equal(fs.existsSync(hostRoot), false);
              const current = JSON.parse(
                fs.readFileSync(statePath, "utf8"),
              ).operations.find(
                (item: { kind: string; operationId: string }) =>
                  item.kind === "host_operation" &&
                  item.operationId === targetHost.operationId,
              );
              assert.equal(current.cleanup, "pending");
              interruptionReached++;
              interruptRecovery();
            }
            return result;
          },
        );
      }
    }
    // 通常Moduleのexport代役では、同じSource内の所在呼出しを差し替えられない。
    const origin = new URL(
      "../../src/lifecycle/environment.ts",
      import.meta.url,
    );
    let recoverySource = fs.readFileSync(origin, "utf8");
    assert.equal(typeof fixtureHomeDirectory, "string");
    for (const [candidate, fixtureDirectory] of [
      ["providerHomesDirectoryCandidate", fixtureHomeDirectory],
      ["runtimeStateDirectoryCandidate", fixtureRuntimeDirectory],
    ] as const) {
      const declaration = new RegExp(
        "^export function " +
          candidate +
          "\\(\\)(?:: string \\| null)? \\{[\\s\\S]*?^\\}",
        "gmu",
      );
      assert.equal([...recoverySource.matchAll(declaration)].length, 1);
      recoverySource = recoverySource.replace(
        declaration,
        () =>
          `export function ${candidate}() { return ${JSON.stringify(fixtureDirectory)}; }`,
      );
    }
    const recovery = (await import(
      sourceUrl(stripTypeScriptTypes(recoverySource), origin, new Map())
    )) as typeof import("../../src/lifecycle/environment.ts");
    assert.equal(
      recovery.providerHomesDirectoryCandidate(),
      fixtureHomeDirectory,
    );
    assert.equal(
      recovery.runtimeStateDirectoryCandidate(),
      fixtureRuntimeDirectory,
    );
    if (admissionVerification === "verify_admission") {
      const model = await import("../../../execution-model/src/index.ts");
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
        return before.operations
          .filter((item: { kind: string }) => item.kind === "host_operation")
          .map((item: { operationId: string }) =>
            captureHostRoot(
              path.join(root, ".crdd", "operations", item.operationId),
            ),
          );
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
            const changed = structuredClone(before);
            changed.revision++;
            changed.previous = {
              revision: before.revision,
              payloadSha256: createHash("sha256")
                .update(baselineBytes)
                .digest("hex"),
            };
            changed.operations.find(
              (item: { kind: string; operationId: string }) =>
                item.kind === "host_operation" &&
                item.operationId === targetHost.operationId,
            ).cleanup = "pending";
            changed.previous.payloadSha256 = "0".repeat(64);
            const bytes = Buffer.from(`${canonicalJson(changed)}\n`);
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
            const bytes = Buffer.from(`${canonicalJson(changed)}\n`);
            fs.writeFileSync(statePath, bytes);
            const observed: ReturnType<typeof model.readState> =
              model.readState(verified.capability, { scope: "recovery" });
            assert.equal(observed.status, "blocked");
            assert.equal(observed.value, null);
            assert.deepEqual(fs.readFileSync(statePath), bytes);
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
        operationRetained: null,
        operationRemovalConfirmed: false,
        taskRecoveryCompleted: false,
        cleanupReason: null,
      });
      assert.equal(hostRecoveryCalls, 1);
      assert.equal(underlyingFinalWriterCalls, 0);
      process.stdout.write(
        JSON.stringify({
          pid: process.pid,
          recoveryId: id,
          report,
          phase: interruption,
          reached: refusedWriterCalls,
          checkpointWriterCalls,
          checkpointKinds,
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
      assert.equal(report.status, "recovered", JSON.stringify(report));
      if (admissionVerification === "verify_admission") {
        assert.ok(admissionMutations.includes("saveRecoveryCheckpoint"));
        assert.ok(admissionMutations.includes("completeRecovery"));
        assert.ok(admissionHostRecoveries > 0);
      }
      assert.equal(report.recoveryId, id);
      assert.equal(report.dockerCleanupConfirmed, true);
      assert.equal(report.hostCleanupConfirmed, true);
      assert.equal(report.locksReleased, true);
      assert.equal(report.historyConfirmed, true);
      assert.equal(report.operationRemovalConfirmed, true);
      assert.equal(report.taskRecoveryCompleted, true);
      assert.equal(report.operationRetained, false);
      assert.equal(Object.hasOwn(report, "deliveryPending"), false);
      assert.equal(report.cleanupReason, null);
      assert.throws(() => fs.lstatSync(hostRoot), {
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
    mock.restoreAll();
    recoveryStoreMock?.restore();
    recoveryHostMock?.restore();
    admissionStoreMock?.restore();
    admissionHostMock?.restore();
    for (const [name, original] of originals)
      processApi[name] = original as (...args: unknown[]) => unknown;
    syncBuiltinESMExports();
  }
}
