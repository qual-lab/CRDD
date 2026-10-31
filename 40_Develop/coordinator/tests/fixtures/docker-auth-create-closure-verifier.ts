/**
 * 承認済み認証create切断試験を、実Producerから現在回収まで統括する手動入口。
 * @packageDocumentation
 * @responsibility 新品の専用Root、一回のDesktop再起動、削除前保存と終了観測を検査する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定Imageの停止Container一件のみ。通常runnerからは実行しない。
 * @boundary 実Docker／実Owner／現在保存。daemon queueや将来の遅延createを証明しない。
 */

import assert from "node:assert/strict";
import cp, {
  execFileSync,
  type SpawnSyncReturns,
  spawnSync,
} from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { mock } from "node:test";
import {
  setTimeout as delay,
  setImmediate as yieldEvents,
} from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type {
  CoordinatorStateSnapshot,
  CoordinatorStateTaskOperation,
} from "../../../domain-model/src/index.ts";

const fixedImage =
  "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
const endpoint = "npipe:////./pipe/dockerDesktopLinuxEngine";

/**
 * 自己生成試験Rootの削除前実体を上限付きで捕捉する。
 * @responsibility 未知のトップ領域、reparse、未知種別と走査中の不一致を拒否する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 呼出し元がexact Rootと元実体を所有している。
 * @stimulus 通常file／Directoryだけを最大2048entry・合計16MiBまで読む。
 * @observation 相対Path・種別・実体・Directory名集合・File SHA-256。
 * @oracle 二走査の不一致を拒否し、観測一致を原子的差替え防止とは扱わない。
 * @cleanup N/A: この関数自体は削除しない。
 * @boundary 試験Root配下だけのFilesystem観測。
 */
export function captureAuthCreateCleanupTree(root: string) {
  assert.equal(fs.realpathSync(root), root);
  assert.deepEqual(fs.readdirSync(root).sort(), [
    ".crdd",
    ".git",
    "docker-config",
  ]);
  for (const name of [".git", ".crdd", "docker-config"])
    assert.equal(fs.lstatSync(path.join(root, name)).isDirectory(), true);
  const pending = [""];
  const entries: Array<{
    relative: string;
    kind: string;
    identity: string[];
    names: string[] | null;
    sha256: string | null;
  }> = [];
  let totalBytes = 0;
  while (pending.length) {
    assert.ok(entries.length < 2048);
    const relative = pending.pop();
    assert.notEqual(relative, undefined);
    const location = path.join(root, relative ?? "");
    const before = fs.lstatSync(location, { bigint: true });
    assert.equal(before.isSymbolicLink(), false);
    assert.equal(fs.realpathSync(location), location);
    assert.ok(before.isDirectory() || before.isFile());
    const identity = [before.dev, before.ino, before.birthtimeNs].map(String);
    let names: string[] | null = null;
    let sha256: string | null = null;
    if (before.isDirectory()) {
      names = fs.readdirSync(location).sort();
      for (const name of names) pending.push(path.join(relative ?? "", name));
    } else {
      totalBytes += Number(before.size);
      assert.ok(totalBytes <= 16 * 1024 * 1024);
      const bytes = fs.readFileSync(location);
      assert.equal(BigInt(bytes.length), before.size);
      sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    const after = fs.lstatSync(location, { bigint: true });
    assert.deepEqual(
      [after.dev, after.ino, after.birthtimeNs].map(String),
      identity,
    );
    assert.equal(after.size, before.size);
    assert.equal(after.mtimeNs, before.mtimeNs);
    entries.push({
      relative: relative ?? "",
      kind: before.isDirectory() ? "directory" : "file",
      identity,
      names,
      sha256,
    });
  }
  return entries;
}

/**
 * 現在本文だけから一意な認証作成対象を選ぶ。
 * @responsibility packet欠測時も名前からIDを捏造せず、診断できるexact参照だけを返す。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 呼出し元が実Readerのcodec・Root・解放確認を完了している。
 * @stimulus 資源要求と未開始／未送信の共同条件を照合する。
 * @observation 一意なTask操作または拒否。
 * @oracle 対象0件・複数・固定Image差・開始済みを拒否する。
 * @cleanup N/A: 値の観測のみ。
 * @boundary 実Readerの検証済みSnapshotと試験相関。
 */
export function selectAuthCreateTarget(snapshot: CoordinatorStateSnapshot) {
  const candidates = snapshot.operations.filter(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" &&
      value.resources.some(
        (resource) =>
          resource.purpose === "create_subscription_auth_probe" &&
          ["intent_saved", "unknown"].includes(resource.request),
      ),
  );
  assert.equal(candidates.length, 1);
  const operation = candidates[0];
  assert.ok(operation);
  assert.equal(operation.execution.providerStart, "not_started");
  assert.equal(operation.execution.externalSend, "not_issued");
  assert.equal(operation.execution.sharedWrite, "not_issued");
  const identity = JSON.parse(operation.identityJson);
  assert.equal(identity.images.provider, fixedImage);
  assert.equal(identity.workspaceMountMode, null);
  return operation;
}

/**
 * 同期Producer終端と通知本文を、現在保存へ結合する。
 * @responsibility kill境界の正対照と保存済みunknownを共同で要求する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実Readerで選んだ同じ操作と現在本文bytesを受ける。
 * @stimulus 子結果、packet全field、同exact資源を照合する。
 * @observation 検証済みContainer IDまたは例外。
 * @oracle timeout・signal・packet欠測・ID差・保存差では先へ進まない。
 * @cleanup N/A: 失敗時も削除・再起動を発行しない。
 * @boundary 子Process通知と現在保存の間。
 */
export function verifyAuthCreateProducer(
  child: SpawnSyncReturns<string>,
  operation: CoordinatorStateTaskOperation,
  stateBytes: Buffer,
) {
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 1);
  assert.ok(Number.isSafeInteger(child.pid) && child.pid > 0);
  const packet = JSON.parse(child.stdout);
  const identity = JSON.parse(operation.identityJson);
  assert.equal(packet.pid, child.pid);
  assert.equal(packet.recoveryId, operation.recoveryId);
  assert.equal(packet.phase, "auth_create_unknown");
  assert.equal(packet.hostStarts, 1);
  assert.equal(packet.receiptRegistered, false);
  assert.equal(packet.providerStarted, false);
  assert.equal(packet.containerName, identity.resources.auth);
  assert.equal(packet.ownershipLabel, identity.ownershipLabel);
  assert.equal(packet.image, fixedImage);
  assert.match(packet.dockerId, /^[a-f0-9]{64}$/u);
  assert.ok(
    Number.isSafeInteger(packet.createCli.pid) && packet.createCli.pid > 0,
  );
  assert.equal(packet.createCli.status, 0);
  assert.equal(packet.createCli.signal, null);
  assert.equal(packet.createCli.stderrBytes, 0);
  assert.ok([64, 65, 66].includes(packet.createCli.stdoutBytes));
  assert.equal(
    packet.stateSha256,
    createHash("sha256").update(stateBytes).digest("hex"),
  );
  assert.deepEqual(
    operation.resources.find(
      (value) => value.purpose === "create_subscription_auth_probe",
    ),
    {
      purpose: "create_subscription_auth_probe",
      request: "unknown",
      dockerId: null,
      receiptSource: null,
      observation: "unobserved",
      absence: null,
    },
  );
  assert.ok(
    operation.resources.every(
      (value) =>
        value.purpose === "create_subscription_auth_probe" ||
        value.request === "not_requested",
    ),
  );
  return packet.dockerId as string;
}

/**
 * 一覧実IDへ結合した標準bridgeの比較材料を固定する。
 * @responsibility 名前だけの除外をせず、一件の未使用標準bridgeと閉じた構成を要求する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition inspectionsは成功した実ID指定inspectのJSON本文である。
 * @stimulus 全一覧IDとの一致、標準指定、空Containerと既知shapeを照合する。
 * @observation 実IDと、Id／Createdだけを除いた比較対象の全field。
 * @oracle 欠測・重複・未知shape・名前だけのbridge・使用中を拒否する。
 * @cleanup N/A: 同期の値検査だけで資源を取得しない。
 * @boundary 手動試験内の非対象Network比較。削除対象やAuthorityを生成しない。
 */
export function projectAuthCreateDefaultBridge(
  inspections: ReadonlyArray<{ id: string; value: Record<string, unknown> }>,
) {
  assert.ok(inspections.length > 0 && inspections.length <= 128);
  assert.equal(
    new Set(inspections.map(({ id }) => id)).size,
    inspections.length,
  );
  for (const { id, value } of inspections) {
    assert.match(id, /^[a-f0-9]{64}$/u);
    assert.ok(value && typeof value === "object" && !Array.isArray(value));
    assert.equal(value.Id, id);
    assert.equal(typeof value.Name, "string");
  }
  const bridges = inspections.filter(({ value }) => value.Name === "bridge");
  assert.equal(bridges.length, 1);
  const bridge = bridges[0]?.value;
  assert.ok(bridge);
  assert.deepEqual(
    Object.keys(bridge).sort(),
    [
      "Name",
      "Id",
      "Created",
      "Scope",
      "Driver",
      "EnableIPv4",
      "EnableIPv6",
      "IPAM",
      "Internal",
      "Attachable",
      "Ingress",
      "ConfigFrom",
      "ConfigOnly",
      "Options",
      "Labels",
      "Containers",
      "Status",
    ].sort(),
  );
  assert.equal(bridge.Driver, "bridge");
  assert.equal(bridge.Scope, "local");
  assert.equal(typeof bridge.Created, "string");
  assert.ok(!Number.isNaN(Date.parse(bridge.Created as string)));
  for (const name of ["EnableIPv4", "EnableIPv6"])
    assert.equal(typeof bridge[name], "boolean");
  for (const name of ["Internal", "Attachable", "Ingress", "ConfigOnly"])
    assert.equal(bridge[name], false);
  for (const name of [
    "IPAM",
    "ConfigFrom",
    "Options",
    "Labels",
    "Containers",
    "Status",
  ])
    assert.ok(
      bridge[name] &&
        typeof bridge[name] === "object" &&
        !Array.isArray(bridge[name]),
    );
  assert.deepEqual(bridge.Containers, {});
  assert.deepEqual(bridge.ConfigFrom, { Network: "" });
  const options = bridge.Options as Record<string, unknown>;
  assert.equal(options["com.docker.network.bridge.default_bridge"], "true");
  assert.ok(Object.values(options).every((value) => typeof value === "string"));
  assert.ok(
    Object.values(bridge.Labels as object).every(
      (value) => typeof value === "string",
    ),
  );
  const ipam = bridge.IPAM as Record<string, unknown>;
  assert.deepEqual(Object.keys(ipam).sort(), ["Config", "Driver", "Options"]);
  assert.equal(ipam.Driver, "default");
  assert.ok(
    ipam.Options === null ||
      (typeof ipam.Options === "object" && !Array.isArray(ipam.Options)),
  );
  assert.ok(
    Array.isArray(ipam.Config) &&
      ipam.Config.length > 0 &&
      ipam.Config.length <= 2,
  );
  for (const config of ipam.Config) {
    assert.deepEqual(Object.keys(config).sort(), ["Gateway", "Subnet"]);
    assert.ok(typeof config.Subnet === "string" && config.Subnet.length > 0);
    assert.ok(typeof config.Gateway === "string" && config.Gateway.length > 0);
  }
  const { Id, Created: _created, ...configuration } = bridge;
  return { id: Id as string, configuration };
}

/**
 * 一回の承認済み実証だけを既存Runtimeへ接続する。
 * @responsibility 既存資源の保全と実操作前Gateを満たす時だけ次段へ進める。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 明示承認引数、Windows、新品exact Root、停止済み既存資源である。
 * @stimulus 固定子、既存再起動一回、実DI回収と二回のfresh不存在を直列実行する。
 * @observation 同ID、保存順、再起動通知、全排他解放、Hostと資源集合の終了状態。
 * @oracle どの段階の不明でも後続Effectを止め、同Rootを保持する。
 * @cleanup 全確認後だけ自己生成Rootを削除し、失敗Rootは削除しない。
 * @boundary 実CLIと本番同等Owner。既存永続データの削除・Provider依頼は行わない。
 */
async function executeApprovedAuthCreateClosure() {
  const absentAuth = process.argv[3] === "--verify-absent-auth";
  assert.deepEqual(
    process.argv.slice(2),
    absentAuth
      ? ["--execute-approved", "--verify-absent-auth"]
      : ["--execute-approved"],
  );
  assert.equal(process.platform, "win32");
  assert.ok(process.execArgv.includes("--experimental-test-module-mocks"));
  const distribution = fs.realpathSync(
    fileURLToPath(new URL("../../../..", import.meta.url)),
  );
  const root = path.join(distribution, ".crdd", "tests", "auth-create-closure");
  const vc = await import("../../../version-control/src/index.ts");
  const distributionVerified = vc.verifyRepositoryRoot(distribution);
  assert.equal(distributionVerified.status, "completed");
  assert.equal(
    vc.resolveVerifiedRepositoryRoot(distributionVerified.capability),
    distribution,
  );
  const domain = await import("../../../domain-model/src/index.ts");
  const area = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      distribution,
      "tests",
    ),
    "auth_create_closure",
  );
  assert.equal(area.directory, path.dirname(root));
  assert.equal(fs.realpathSync(area.directory), area.directory);
  assert.equal(fs.lstatSync(area.directory).isSymbolicLink(), false);
  assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
  fs.mkdirSync(root);
  const rootStat = fs.lstatSync(root, { bigint: true });
  const rootIdentity = [rootStat.dev, rootStat.ino, rootStat.birthtimeNs].map(
    String,
  );
  let stage = "prepare";
  let recoveryId: string | null = null;
  let verificationCompleted = false;
  let rootCleanupConfirmed = false;
  let recoverObservedCalls = 0;
  let rmRequests = 0;
  let rmSuccesses = 0;
  let restartCalls = 0;
  let restartResultClass = "not_observed";
  let restartStopFailure: string | null = null;
  let restartStartFailure: string | null = null;
  let preparationRmRequests = 0;
  let preparationRmSuccesses = 0;
  let absenceRounds = 0;
  let closureSaves = 0;
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.on("SIGINT", cancel);
  const isolation = await import("../../../docker-isolation/src/index.ts");
  const store = await import("../../../domain-model/src/index.ts");
  let isolationMock: { restore(): void } | null = null;
  let lifecycleMock: { restore(): void } | null = null;
  let storeMock: { restore(): void } | null = null;
  const originalSpawnSync = cp.spawnSync;
  let processObserverInstalled = false;
  try {
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { windowsHide: true },
    );
    const verified = vc.verifyRepositoryRoot(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const rootCapability = verified.capability;
    assert.equal(vc.resolveVerifiedRepositoryRoot(rootCapability), root);
    const config = path.join(root, "docker-config");
    fs.mkdirSync(config);
    const configIdentity =
      isolation.observeDockerRecoveryConfigIdentity(config);
    const trust = isolation.observeTrustedDockerCli();
    const env = isolation.createDockerCliEnvironment({
      dockerConfig: null,
      dockerHome: null,
    });
    assert.ok(env);
    const environment = env;
    /**
     * 親の固定観測と明示準備回収を最小環境で実行する。
     * @responsibility CLI／空config／Rootと取消を各要求直前に照合する。
     * @trace PRL-IT-013
     * @precondition argvはこのfixture内の固定観測と自己生成exact ID回収だけが構築する。
     * @stimulus shellなし、有界同期CLIを一回実行する。
     * @observation 元error・signal・statusと本文。
     * @oracle 非成功・stderr・Root差・取消を拒否し空集合に変換しない。
     * @cleanup 自己生成Containerは明示準備段階で一回だけ回収し、configは正常最終処置で回収する。
     * @boundary 親の観測から固定Docker Engine。
     */
    function readDocker(argv: readonly string[]) {
      assert.equal(abort.signal.aborted, false);
      assert.equal(vc.resolveVerifiedRepositoryRoot(rootCapability), root);
      assert.equal(
        isolation.observeDockerRecoveryConfigIdentity(config),
        configIdentity,
      );
      const executable = isolation.verifyTrustedDockerCliSnapshot(trust);
      const result = spawnSync(
        executable,
        ["--host", endpoint, "--config", config, ...argv],
        {
          shell: false,
          windowsHide: true,
          encoding: "utf8",
          env: environment,
          timeout: 10_000,
          maxBuffer: 1_048_576,
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 0);
      assert.equal(result.stderr, "");
      return result.stdout;
    }
    let bridgeBaseline: ReturnType<
      typeof projectAuthCreateDefaultBridge
    > | null = null;
    let initialBridgeId = "";
    let producerBridgeAccepted = false;
    let bridgeRestartAccepted = false;
    /**
     * 全資源集合と既存Containerの非秘密投影を捕捉する。
     * @responsibility 試験対象一件以外の追加・消失・状態差を検出する。
     * @trace PRL-IT-013
     * @precondition 専用configとCLIを再照合できる。
     * @stimulus 全一覧と既存Containerの固定fieldだけを読む。
     * @observation ID集合、名前・Image ID・状態・稼働boolean。
     * @oracle 稼働中Container、一覧不明、不正IDを拒否する。
     * @cleanup N/A: 観測だけ。Volume内容無変更の証明にはしない。
     * @boundary Engine資源の集合観測。
     */
    function baseline(
      exclude: string | null = null,
      afterRestart = false,
      afterProducer = false,
    ) {
      const containers = readDocker([
        "container",
        "ls",
        "--all",
        "--no-trunc",
        "--format",
        "{{.ID}}",
      ])
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .sort();
      assert.ok(containers.every((id) => /^[a-f0-9]{64}$/u.test(id)));
      const networks = readDocker([
        "network",
        "ls",
        "--no-trunc",
        "--format",
        "{{.ID}}",
      ])
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .sort();
      assert.ok(networks.length > 0 && networks.length <= 128);
      assert.equal(new Set(networks).size, networks.length);
      assert.ok(networks.every((id) => /^[a-f0-9]{64}$/u.test(id)));
      const bridge = projectAuthCreateDefaultBridge(
        networks.map((id) => ({
          id,
          value: JSON.parse(
            readDocker(["network", "inspect", id, "--format", "{{json .}}"]),
          ),
        })),
      );
      if (bridgeBaseline === null) {
        assert.equal(afterRestart, false);
        assert.equal(afterProducer, false);
        bridgeBaseline = bridge;
        initialBridgeId = bridge.id;
      } else {
        assert.deepEqual(bridge.configuration, bridgeBaseline.configuration);
        if (afterProducer) {
          assert.equal(afterRestart, false);
          assert.equal(stage, "restart");
          assert.equal(restartCalls, 0);
          assert.equal(producerBridgeAccepted, false);
          producerBridgeAccepted = true;
          bridgeBaseline = bridge;
        } else if (afterRestart) {
          assert.equal(producerBridgeAccepted, true);
          assert.equal(stage, "recover");
          assert.equal(restartCalls, 1);
          assert.equal(restartResultClass, "completed");
          assert.equal(bridgeRestartAccepted, false);
          bridgeRestartAccepted = true;
          bridgeBaseline = bridge;
        } else assert.equal(bridge.id, bridgeBaseline.id);
      }
      return {
        containers: containers
          .filter((id) => id !== exclude)
          .map((id) => {
            const item = JSON.parse(
              readDocker([
                "container",
                "inspect",
                id,
                "--format",
                "[{{json .Id}},{{json .Name}},{{json .Image}},{{json .State.Status}},{{json .State.Running}}]",
              ]),
            );
            assert.equal(item.length, 5);
            assert.equal(item[0], id);
            assert.equal(item[4], false);
            return item;
          }),
        networks: networks
          .map((id) => (id === bridge.id ? initialBridgeId : id))
          .sort(),
        volumes: readDocker(["volume", "ls", "--format", "{{.Name}}"])
          .trim()
          .split(/\r?\n/u)
          .filter(Boolean)
          .sort(),
        images: [
          ...new Set(
            readDocker(["image", "ls", "--quiet", "--no-trunc"])
              .trim()
              .split(/\r?\n/u)
              .filter(Boolean),
          ),
        ].sort(),
      };
    }
    assert.equal(
      readDocker([
        "image",
        "inspect",
        fixedImage,
        "--format",
        "{{.Id}}",
      ]).trim(),
      fixedImage,
    );
    const before = baseline();
    stage = "producer";
    assert.deepEqual(baseline(), before);
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        fileURLToPath(
          new URL("./docker-recovery-abandon-worker.ts", import.meta.url),
        ),
        "auth_create_unknown",
      ],
      {
        cwd: root,
        shell: false,
        windowsHide: true,
        encoding: "utf8",
        timeout: 90_000,
        maxBuffer: 64 * 1024,
      },
    );
    await yieldEvents();
    const saved =
      store.readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    assert.equal(saved.status, "completed");
    assert.equal(saved.lockReleased, true);
    assert.ok(saved.value);
    const target = selectAuthCreateTarget(saved.value.snapshot);
    recoveryId = target.recoveryId;
    const statePath = path.join(root, ".crdd", "domain-model", "state.json");
    const dockerId = verifyAuthCreateProducer(
      child,
      target,
      fs.readFileSync(statePath),
    );
    assert.throws(() => fs.lstatSync(path.join(root, "unexpected-finally")), {
      code: "ENOENT",
    });
    const otherOperations = saved.value.snapshot.operations.filter(
      (item) => item.recoveryId !== recoveryId,
    );
    const identity = JSON.parse(target.identityJson);
    let discovered = false;
    let discoveries = 0;
    const restartEvents: string[] = [];
    /**
     * fresh Readerで同exact操作を取得する。
     * @responsibility 保存不明を旧Snapshotやpacketで代替しない。
     * @trace PRL-IT-013
     * @precondition 現在Root Capabilityが有効である。
     * @stimulus 本番Readerと短期排他を使用する。
     * @observation 対象操作と非対象全文。
     * @oracle Reader／解放不明・非対象差は拒否する。
     * @cleanup Readerが短期排他を解放する。
     * @boundary 親観測と現在保存。
     */
    function currentTarget() {
      const current =
        store.readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
      assert.equal(current.status, "completed");
      assert.equal(current.lockReleased, true);
      assert.ok(current.value);
      assert.deepEqual(
        current.value.snapshot.operations.filter(
          (item) => item.recoveryId !== recoveryId,
        ),
        otherOperations,
      );
      const item = current.value.snapshot.operations.find(
        (item): item is CoordinatorStateTaskOperation =>
          item.kind === "docker_task" && item.recoveryId === recoveryId,
      );
      assert.ok(item);
      return item;
    }
    cp.spawnSync = ((...args: unknown[]) => {
      if (args[0] === trust.executablePath) {
        assert.ok(Array.isArray(args[1]));
        const argv = args[1] as string[];
        if (argv[2] === "container") {
          assert.deepEqual(argv, [
            "--host",
            endpoint,
            "container",
            "ls",
            "--quiet",
            "--no-trunc",
          ]);
          return Reflect.apply(originalSpawnSync, cp, args);
        }
        if (argv[2] === "version") {
          assert.deepEqual(argv, [
            "--host",
            endpoint,
            "version",
            "--format",
            "{{json .Server}}",
          ]);
          return Reflect.apply(originalSpawnSync, cp, args);
        }
        assert.deepEqual(argv.slice(0, 3), ["--host", endpoint, "--config"]);
        assert.equal(typeof argv[3], "string");
        assert.ok(path.isAbsolute(argv[3] ?? ""));
        const command = argv.slice(4);
        const readOnly =
          command[0] === "version" ||
          command[0] === "info" ||
          (["container", "network", "image", "volume"].includes(
            command[0] ?? "",
          ) &&
            ["ls", "inspect"].includes(command[1] ?? ""));
        if (!readOnly) {
          assert.deepEqual(command, ["container", "rm", "--force", dockerId]);
          if (absentAuth && stage === "prepare_absence") {
            preparationRmRequests++;
            assert.equal(preparationRmRequests, 1);
            const result = Reflect.apply(originalSpawnSync, cp, args);
            if (
              !result.error &&
              result.status === 0 &&
              result.signal === null &&
              result.stderr === ""
            )
              preparationRmSuccesses++;
            return result;
          }
          assert.equal(absentAuth, false);
          assert.equal(discovered, true);
          assert.deepEqual(
            currentTarget().resources.find(
              (item) => item.purpose === "create_subscription_auth_probe",
            ),
            {
              purpose: "create_subscription_auth_probe",
              request: "identified",
              dockerId,
              receiptSource: "runtime_reconciliation",
              observation: "present",
              absence: null,
            },
          );
          rmRequests++;
          assert.equal(rmRequests, 1);
          const result = Reflect.apply(originalSpawnSync, cp, args);
          if (
            !result.error &&
            result.status === 0 &&
            result.signal === null &&
            result.stderr === ""
          )
            rmSuccesses++;
          return result;
        }
      }
      return Reflect.apply(originalSpawnSync, cp, args);
    }) as typeof cp.spawnSync;
    processObserverInstalled = true;
    syncBuiltinESMExports();
    isolationMock = mock.module(
      new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
      {
        namedExports: {
          ...isolation,
          restartDockerRuntime: async (
            input: Parameters<typeof isolation.restartDockerRuntime>[0],
          ) => {
            restartCalls++;
            assert.equal(restartCalls, 1);
            return isolation.restartDockerRuntime({
              ...input,
              onRequesting: () => {
                const result = input.onRequesting();
                assert.equal(result, undefined);
                restartEvents.push("before_request");
                return result;
              },
              onEvent: (event) => {
                input.onEvent?.(event);
                restartEvents.push(event.event);
                currentTarget();
              },
            });
          },
          createDockerTaskRecoveryExecutor: (
            input: Parameters<
              typeof isolation.createDockerTaskRecoveryExecutor
            >[0],
          ) => {
            const created = isolation.createDockerTaskRecoveryExecutor(input);
            if (created.status !== "ready") return created;
            return {
              ...created,
              executor: {
                ...created.executor,
                discoverSubmitted: (
                  expectation: Parameters<
                    typeof created.executor.discoverSubmitted
                  >[0],
                ) => {
                  assert.equal(
                    expectation.purpose,
                    "create_subscription_auth_probe",
                  );
                  const found = created.executor.discoverSubmitted(expectation);
                  assert.equal(found, absentAuth ? null : dockerId);
                  discoveries++;
                  assert.equal(discoveries, 1);
                  discovered = !absentAuth;
                  return found;
                },
                observeAbsent: (
                  ...args: Parameters<typeof created.executor.observeAbsent>
                ) => {
                  assert.equal(absentAuth, true);
                  assert.equal(args[0], "container");
                  assert.equal(args[1], identity.resources.auth);
                  assert.equal(args[2], identity.ownershipLabel);
                  assert.equal(args.length, 3);
                  const observed = created.executor.observeAbsent(...args);
                  assert.equal(observed, true);
                  absenceRounds++;
                  assert.ok(absenceRounds <= 2);
                  currentTarget();
                  return observed;
                },
                recoverObserved: (
                  ...args: Parameters<typeof created.executor.recoverObserved>
                ) => {
                  assert.equal(discovered, true);
                  assert.equal(
                    args[0].purpose,
                    "create_subscription_auth_probe",
                  );
                  assert.equal(args[0].dockerId, dockerId);
                  assert.deepEqual(
                    currentTarget().resources.find(
                      (item) =>
                        item.purpose === "create_subscription_auth_probe",
                    ),
                    {
                      purpose: "create_subscription_auth_probe",
                      request: "identified",
                      dockerId,
                      receiptSource: "runtime_reconciliation",
                      observation: "present",
                      absence: null,
                    },
                  );
                  recoverObservedCalls++;
                  assert.equal(recoverObservedCalls, 1);
                  return created.executor.recoverObserved(...args);
                },
              },
            };
          },
        },
      },
    );
    if (absentAuth)
      storeMock = mock.module(
        new URL("../../../domain-model/src/index.ts", import.meta.url).href,
        {
          namedExports: {
            ...store,
            writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure: (
              ...args: Parameters<
                typeof store.writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure
              >
            ) => {
              assert.equal(args[1], recoveryId);
              assert.equal(absenceRounds, 2);
              const result =
                store.writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure(
                  ...args,
                );
              assert.equal(result.status, "completed");
              assert.equal(result.snapshotConfirmed, true);
              assert.equal(result.lockReleased, true);
              const auth = currentTarget().resources.find(
                (value) => value.purpose === "create_subscription_auth_probe",
              );
              assert.ok(auth);
              assert.equal(auth.request, "unknown");
              assert.equal(auth.dockerId, null);
              assert.equal(auth.receiptSource, null);
              assert.equal(auth.observation, "absent");
              assert.equal(auth.absence?.dockerId, null);
              closureSaves++;
              assert.equal(closureSaves, 1);
              return result;
            },
          },
        },
      );
    const lifecycle = (await import(
      new URL(
        "../../src/execution/recovery.ts?auth-create-parent",
        import.meta.url,
      ).href
    )) as typeof import("../../src/execution/recovery.ts");
    lifecycleMock = mock.module(
      new URL("../../src/execution/recovery.ts", import.meta.url).href,
      { namedExports: { ...lifecycle } },
    );
    const { expectedRecoveryResources } = await import(
      "./recovery-resource-expectations.ts"
    );
    const expectation = expectedRecoveryResources(target).find(
      (value) => value.purpose === "create_subscription_auth_probe",
    )?.expectations[0];
    assert.ok(expectation);
    const authExpectation = expectation;
    /**
     * 同じ停止Containerが存在し、元隔離構成を満たすことを確認する。
     * @responsibility 再起動による消失を回収成功の正対照にしない。
     * @trace PRL-IT-013
     * @precondition 同じpacket IDと現在保存から期待値を導出済みである。
     * @stimulus ID指定inspectをfresh実行する。
     * @observation 単一ID・固定構成・created状態。
     * @oracle ID差・欠測・構成差・起動済みは拒否する。
     * @cleanup N/A: 読取りのみ。
     * @boundary 実Engineの正対照。
     */
    function positiveControl() {
      const values = JSON.parse(readDocker(["container", "inspect", dockerId]));
      assert.equal(values.length, 1);
      assert.equal(
        isolation.dockerResourceConfigurationMatches(values[0], {
          ...authExpectation,
          dockerId,
        }),
        true,
      );
      assert.equal(values[0].State.Status, "created");
    }
    stage = "restart";
    positiveControl();
    currentTarget();
    assert.deepEqual(baseline(dockerId, false, true), before);
    const restart = (await import(
      new URL(
        "../../src/execution/recovery.ts?auth-create-parent",
        import.meta.url,
      ).href
    )) as typeof import("../../src/execution/recovery.ts");
    const restarted = await restart.restartRuntimeOwnedDockerForRecovery(
      recoveryId,
      abort.signal,
      rootCapability,
    );
    restartStopFailure = restarted.stopFailure;
    restartStartFailure = restarted.startFailure;
    restartResultClass =
      restarted.status === "completed"
        ? "completed"
        : restarted.status === "blocked"
          ? "blocked"
          : "invalid_joint_result";
    assert.equal(restarted.status, "completed");
    assert.equal(restarted.restartCompleted, true);
    assert.equal(restarted.cleanupConfirmed, true);
    assert.equal(restarted.primaryFailure, null);
    assert.equal(restarted.cleanupFailure, null);
    assert.equal(restartCalls, 1);
    assert.deepEqual(restartEvents, [
      "before_request",
      "request_accepted",
      "settled",
    ]);
    const restartCheckpoint = currentTarget().dockerRestart;
    assert.ok(restartCheckpoint);
    assert.equal(restartCheckpoint.request, "confirmed");
    assert.equal(restartCheckpoint.cleanup, "confirmed");
    assert.equal(restartCheckpoint.result?.status, "completed");
    if (absentAuth) {
      assert.equal(restarted.recoveryId, recoveryId);
      assert.equal(restartCheckpoint.result?.request, "confirmed");
      assert.equal(restartCheckpoint.result?.effectOutcomeUnknown, false);
    }
    stage = "recover";
    positiveControl();
    assert.deepEqual(baseline(dockerId, true), before);
    if (absentAuth) {
      stage = "prepare_absence";
      const currentAuth = currentTarget().resources.find(
        (value) => value.purpose === "create_subscription_auth_probe",
      );
      assert.deepEqual(
        currentAuth,
        target.resources.find(
          (value) => value.purpose === "create_subscription_auth_probe",
        ),
      );
      positiveControl();
      assert.deepEqual(baseline(dockerId), before);
      const stateBefore = fs.lstatSync(statePath, { bigint: true });
      assert.equal(stateBefore.isSymbolicLink(), false);
      assert.equal(stateBefore.isFile(), true);
      const preservedBefore = {
        identity: [
          stateBefore.dev,
          stateBefore.ino,
          stateBefore.birthtimeNs,
        ].map(String),
        bytes: fs.readFileSync(statePath),
        operation: currentTarget(),
      };
      assert.equal(
        readDocker(["container", "rm", "--force", dockerId]).trim(),
        dockerId,
      );
      assert.equal(preparationRmRequests, 1);
      assert.equal(preparationRmSuccesses, 1);
      for (const filters of [
        [`id=${dockerId}`],
        [
          `name=^/${identity.resources.auth}$`,
          `label=${identity.ownershipLabel}`,
        ],
      ])
        assert.equal(
          readDocker([
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((value) => ["--filter", value]),
            "--format",
            "{{.ID}}",
          ]).trim(),
          "",
        );
      assert.deepEqual(baseline(), before);
      const stateAfter = fs.lstatSync(statePath, { bigint: true });
      assert.equal(stateAfter.isSymbolicLink(), false);
      assert.equal(stateAfter.isFile(), true);
      const preservedAfter = {
        identity: [stateAfter.dev, stateAfter.ino, stateAfter.birthtimeNs].map(
          String,
        ),
        bytes: fs.readFileSync(statePath),
        operation: currentTarget(),
      };
      assert.deepEqual(preservedAfter, preservedBefore);
      stage = "recover";
    }
    const recovered =
      await lifecycle.recoverRuntimeOwnedDockerTaskForCurrentConsumer(
        recoveryId,
        rootCapability,
        abort.signal,
      );
    assert.equal(recovered.status, "recovered");
    assert.equal(recovered.taskRecoveryCompleted, true);
    assert.equal(recovered.dockerCleanupConfirmed, true);
    assert.equal(recovered.hostCleanupConfirmed, true);
    assert.equal(recovered.locksReleased, true);
    assert.equal(recovered.historyConfirmed, true);
    assert.equal(discoveries, 1);
    assert.equal(recoverObservedCalls, absentAuth ? 0 : 1);
    assert.equal(rmRequests, absentAuth ? 0 : 1);
    assert.equal(rmSuccesses, absentAuth ? 0 : 1);
    if (absentAuth) {
      assert.equal(absenceRounds, 2);
      assert.equal(closureSaves, 1);
    }
    stage = "absence";
    for (let sample = 0; sample < 2; sample++) {
      if (sample) await delay(250);
      for (const filters of [
        [`id=${dockerId}`],
        [`name=^/${identity.resources.auth}$`],
        [
          `name=^/${identity.resources.auth}$`,
          `label=${identity.ownershipLabel}`,
        ],
      ])
        assert.equal(
          readDocker([
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((value) => ["--filter", value]),
            "--format",
            "{{.ID}}",
          ]).trim(),
          "",
        );
    }
    assert.deepEqual(baseline(), before);
    const final =
      store.readRuntimeOwnedCoordinatorRecoverySnapshot(rootCapability);
    assert.equal(final.status, "completed");
    assert.equal(final.lockReleased, true);
    assert.ok(final.value);
    assert.deepEqual(final.value.snapshot.operations, otherOperations);
    for (const location of [identity.hostPaths.root, identity.hostPaths.marker])
      assert.throws(() => fs.lstatSync(location), { code: "ENOENT" });
    verificationCompleted = true;
    stage = "root_cleanup";
    const cleanupTree = captureAuthCreateCleanupTree(root);
    assert.deepEqual(captureAuthCreateCleanupTree(root), cleanupTree);
    assert.equal(abort.signal.aborted, false);
    assert.equal(path.dirname(root), area.directory);
    assert.equal(fs.realpathSync(area.directory), area.directory);
    assert.equal(fs.realpathSync(root), root);
    const currentRoot = fs.lstatSync(root, { bigint: true });
    assert.deepEqual(
      [currentRoot.dev, currentRoot.ino, currentRoot.birthtimeNs].map(String),
      rootIdentity,
    );
    fs.rmSync(root, { recursive: true, force: true });
    assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
    rootCleanupConfirmed = true;
    process.stdout.write(
      `${JSON.stringify({ contract: "crdd-coordinator/auth-create-closure-verification", status: "completed", recoveryId, restartCalls, recoverObservedCalls, rmRequests, rmSuccesses, ...(absentAuth ? { mode: "absent_auth", preparationRmRequests, preparationRmSuccesses, absenceRounds, closureSaves } : {}), absenceSamples: 2, verificationCompleted, rootCleanupConfirmed, providerRequestIssued: false, preexistingPersistentDataDeleted: false, genericUnknownClosureVerified: false })}\n`,
    );
  } catch (error) {
    process.exitCode = 2;
    let failureClass = "unknown";
    let failureCode: string | null = null;
    let failureLine: number | null = null;
    let baselineDifference: string[] = [];
    let networkSetDifference: {
      addedIds: string[];
      removedIds: string[];
    } | null = null;
    try {
      if (error instanceof Error) {
        failureClass =
          error instanceof assert.AssertionError ? "assertion" : "exception";
        const code = (error as Error & { code?: unknown }).code;
        if (
          typeof code === "string" &&
          [
            "ERR_ASSERTION",
            "ERR_MODULE_NOT_FOUND",
            "ERR_MODULE_NOT_MOCKED",
            "ERR_INVALID_ARG_VALUE",
          ].includes(code)
        )
          failureCode = code;
        const ownUrl = import.meta.url;
        const frame = error.stack
          ?.split("\n")
          .find(
            (line) =>
              line.trim().startsWith("at ") &&
              (line.includes(`(${ownUrl}:`) ||
                line.trim().startsWith(`at ${ownUrl}:`)),
          );
        const suffix = frame?.slice(frame.indexOf(ownUrl) + ownUrl.length);
        const match = suffix && /^:(\d+):\d+\)?$/u.exec(suffix);
        if (match) failureLine = Number(match[1]);
        if (error instanceof assert.AssertionError) {
          const actual =
            typeof error.actual === "object" && error.actual !== null
              ? (error.actual as Record<string, unknown>)
              : null;
          const expected =
            typeof error.expected === "object" && error.expected !== null
              ? (error.expected as Record<string, unknown>)
              : null;
          const fields = ["containers", "networks", "volumes", "images"];
          if (
            actual &&
            expected &&
            fields.every(
              (field) =>
                Object.hasOwn(actual, field) &&
                Object.hasOwn(expected, field) &&
                Array.isArray(actual[field]) &&
                Array.isArray(expected[field]),
            ) &&
            Object.keys(actual).length === fields.length &&
            Object.keys(expected).length === fields.length
          ) {
            baselineDifference = fields.filter(
              (field) =>
                JSON.stringify(actual[field]) !==
                JSON.stringify(expected[field]),
            );
            // 診断だけの上限。超過時も元の停止理由・比較結果は維持する。
            try {
              const snapshots: string[][] = [];
              for (const value of [actual.networks, expected.networks]) {
                if (!Array.isArray(value)) throw new Error("network_shape");
                const length = value.length;
                if (!Number.isInteger(length) || length < 0 || length > 128)
                  throw new Error("network_bound");
                const ids: string[] = [];
                for (let index = 0; index < length; index++) {
                  const descriptor = Object.getOwnPropertyDescriptor(
                    value,
                    String(index),
                  );
                  if (
                    !descriptor ||
                    !Object.hasOwn(descriptor, "value") ||
                    typeof descriptor.value !== "string" ||
                    !/^[a-f0-9]{64}$/u.test(descriptor.value)
                  )
                    throw new Error("network_id");
                  ids.push(descriptor.value);
                }
                snapshots.push(ids);
              }
              const actualIds = new Set(snapshots[0]);
              const expectedIds = new Set(snapshots[1]);
              if (baselineDifference.includes("networks"))
                networkSetDifference = {
                  addedIds: [...actualIds]
                    .filter((id) => !expectedIds.has(id))
                    .sort(),
                  removedIds: [...expectedIds]
                    .filter((id) => !actualIds.has(id))
                    .sort(),
                };
            } catch {
              networkSetDifference = null;
            }
          }
        }
      }
    } catch {
      failureClass = "unknown";
      failureCode = null;
      failureLine = null;
    }
    process.stdout.write(
      `${JSON.stringify({ contract: "crdd-coordinator/auth-create-closure-verification", status: "blocked", stage, recoveryId, verificationCompleted, rootCleanupConfirmed, rootMayRemain: !rootCleanupConfirmed, containerMayRemain: !verificationCompleted && stage !== "prepare", automaticRetryIssued: false, diagnostic: { failureClass, failureCode, failureLine, restartResultClass, restartStopFailure, restartStartFailure, restartCalls, recoverObservedCalls, rmRequests, rmSuccesses, ...(baselineDifference.length ? { baselineDifference } : {}), ...(networkSetDifference ? { networkSetDifference } : {}), ...(absentAuth ? { preparationRmRequests, preparationRmSuccesses, absenceRounds, closureSaves } : {}) } })}\n`,
    );
  } finally {
    lifecycleMock?.restore();
    storeMock?.restore();
    isolationMock?.restore();
    if (processObserverInstalled) {
      cp.spawnSync = originalSpawnSync;
      syncBuiltinESMExports();
    }
    process.off("SIGINT", cancel);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await executeApprovedAuthCreateClosure();
