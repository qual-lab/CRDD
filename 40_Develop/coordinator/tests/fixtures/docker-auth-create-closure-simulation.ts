/**
 * 手動親の実本文を外部Effectなしで評価する固定境界代役。
 * @packageDocumentation
 * @responsibility 統括の順序・相関・停止だけを実assertで検査し、製品Ownerの代わりにしない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @level IT
 * @scope 毎回新品の閉じた評価環境。実Filesystem・Process・Docker・module mockへ接続しない。
 * @boundary 実本文のVM評価と合成境界。codec／Kernel／Nativeの成立は対象外。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";

/**
 * 固定scenarioで親統括を一回評価し、境界到達と処置を返す。
 * @responsibility 正常と単独故障を同じ親本文・同じ合否assertへ通す。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition faultとmutationは呼出し元の閉じた試験値である。
 * @stimulus 一意に抽出した五関数を新しい閉包へ評価し外部境界だけを差替える。
 * @observation 段階、故障到達、要求列、報告、残存、復元とListener終了。
 * @oracle 未知module／argv／Pathは拒否し、正常時は全spy経由を要求する。
 * @cleanup 代役の登録・named binding・Listenerを実本文finallyで復元させる。
 * @boundary 論理統括だけ。合成成功値を実Runtime保証に読み替えない。
 */
export async function simulateAuthCreateClosure(
  fault: string,
  mutation = "none",
  absentAuth = false,
) {
  const fixtureUrl = new URL(
    "./docker-auth-create-closure-verifier.ts",
    import.meta.url,
  ).href;
  const source = fs.readFileSync(new URL(fixtureUrl), "utf8");
  const names = [
    "captureAuthCreateCleanupTree",
    "selectAuthCreateTarget",
    "verifyAuthCreateProducer",
    "projectAuthCreateDefaultBridge",
    "executeApprovedAuthCreateClosure",
  ];
  const bodies = names.map((name, index) => {
    const marker = `${index === names.length - 1 ? "async " : "export "}function ${name}(`;
    assert.equal(source.split(marker).length, 2);
    const start = source.indexOf(marker);
    const end =
      index === names.length - 1
        ? source.indexOf("\nif (", start)
        : source.indexOf("\n/**", start);
    assert.ok(end > start);
    return source.slice(start, end).replace(/^export /u, "");
  });
  let body = bodies.join("\n");
  assert.equal((body.match(/await import\(/gu) ?? []).length, 6);
  assert.ok(
    body.includes(
      'const absentAuth = process.argv[3] === "--verify-absent-auth"',
    ),
  );
  assert.equal((body.match(/syncBuiltinESMExports\(\);/gu) ?? []).length, 2);
  if (mutation === "detach_named_binding")
    body = body.replace("syncBuiltinESMExports();", "void 0;");
  else if (mutation === "omit_preparation_preservation") {
    const guard = "assert.deepEqual(preservedAfter, preservedBefore);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(guard, "void preservedAfter;");
  } else if (mutation === "omit_closure_confirmation") {
    const guard = "assert.equal(result.snapshotConfirmed, true);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(guard, "void result.snapshotConfirmed;");
  } else if (mutation === "omit_round_count") {
    const guard = "assert.equal(absenceRounds, 2);";
    assert.equal(body.split(guard).length, 3);
    body = body.replaceAll(guard, "void absenceRounds;");
  } else if (mutation === "omit_positive_configuration") {
    const guard =
      /assert\.equal\(\s*isolation\.dockerResourceConfigurationMatches\(values\[0\], \{[\s\S]*?\}\),\s*true,\s*\);/u;
    assert.equal([...body.matchAll(new RegExp(guard.source, "gu"))].length, 1);
    body = body.replace(
      guard,
      "void isolation.dockerResourceConfigurationMatches(values[0], { ...authExpectation, dockerId });",
    );
  } else if (mutation === "wrong_lifecycle_import") {
    const original = body;
    const target = "execution/recovery.ts?auth-create-parent";
    assert.equal(body.split(target).length, 2);
    body = body.replace(target, "execution/recovery.ts?unregistered");
    assert.notEqual(body, original);
  } else if (mutation === "omit_identified_guards") {
    const guards =
      /assert\.deepEqual\(\s*currentTarget\(\)\.resources\.find\([\s\S]*?absence: null,\s*\},\s*\);/gu;
    assert.equal([...body.matchAll(guards)].length, 2);
    body = body.replace(guards, "void 0;");
  } else if (mutation === "early_bridge_acceptance") {
    const guard = "assert.deepEqual(baseline(dockerId, false, true), before);";
    assert.ok(body.includes(guard));
    body = body.replace(
      guard,
      "assert.deepEqual(baseline(dockerId, true), before);",
    );
  } else if (mutation === "repeat_producer_bridge_acceptance") {
    const guard = "assert.deepEqual(baseline(dockerId, false, true), before);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(guard, `${guard}\n${guard}`);
  } else if (mutation === "probe_producer_bridge_stability") {
    const guard = "assert.deepEqual(baseline(dockerId, false, true), before);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(
      guard,
      `${guard}\nassert.deepEqual(baseline(dockerId), before);`,
    );
  } else if (mutation === "early_producer_bridge_acceptance") {
    const guard = "assert.deepEqual(baseline(), before);";
    assert.equal(body.split(guard).length, 4);
    body = body.replace(
      guard,
      "assert.deepEqual(baseline(null, false, true), before);",
    );
  } else if (mutation === "repeat_restart_bridge_acceptance") {
    const guard = "assert.deepEqual(baseline(dockerId, true), before);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(guard, `${guard}\n${guard}`);
  } else if (mutation === "omit_bridge_identity_guard") {
    const guard = "else assert.equal(bridge.id, bridgeBaseline.id);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(guard, "else void bridge.id;");
  } else if (mutation === "omit_bridge_configuration_guard") {
    const guard =
      "assert.deepEqual(bridge.configuration, bridgeBaseline.configuration);";
    const pattern =
      /assert\.deepEqual\(\s*bridge\.configuration,\s*bridgeBaseline\.configuration,?\s*\);/u;
    assert.ok(pattern.test(body), guard);
    body = body.replace(pattern, "void bridge.configuration;");
  } else if (mutation === "exclude_all_networks") {
    const pattern = /networks: networks[\s\S]*?\.sort\(\),/u;
    assert.ok(pattern.test(body));
    body = body.replace(pattern, "networks: [],");
  } else if (mutation.startsWith("omit_baseline_")) {
    const guard =
      /assert\.deepEqual\(baseline\((dockerId)?(, (?:true|false)(?:, true)?)?\), before\);/gu;
    assert.equal([...body.matchAll(guard)].length, 6);
    let index = 1;
    body = body.replace(guard, (text, argument, transition) =>
      index++ === [1, 2, 3, 6][Number(mutation.slice(-1)) - 1]
        ? `void baseline(${argument ?? ""}${transition ?? ""});`
        : text,
    );
  } else if (mutation === "omit_manifest_comparison") {
    const guard =
      "assert.deepEqual(captureAuthCreateCleanupTree(root), cleanupTree);";
    assert.equal(body.split(guard).length, 2);
    body = body.replace(guard, "void captureAuthCreateCleanupTree(root);");
  } else if (mutation.startsWith("boundary_")) {
    const replacements: Record<string, [string, string]> = {
      boundary_root: [
        "vc.verifyRepositoryRoot(root)",
        "vc.verifyRepositoryRoot(path.dirname(root))",
      ],
      boundary_capability: [
        "const rootCapability = verified.capability;",
        "const rootCapability = Object.freeze({});",
      ],
      boundary_git: ['"user.name=CRDD Test"', '"user.name=Other"'],
      boundary_config: [
        "observeDockerRecoveryConfigIdentity(config)",
        "observeDockerRecoveryConfigIdentity(root)",
      ],
    };
    const replacement = replacements[mutation];
    assert.ok(replacement);
    assert.ok(body.includes(replacement[0]));
    body = body.replace(replacement[0], replacement[1]);
  } else assert.equal(mutation, "none");
  assert.equal(body.split("return entries;").length, 2);
  body = body.replace(
    "return entries;",
    "manifestCompleted(); return entries;",
  );
  body = stripTypeScriptTypes(body)
    .replaceAll("import.meta.url", "fixtureUrl")
    .replace(/\bimport\(/gu, "loadFixtureModule(");
  const distribution = fileURLToPath(new URL("../../../..", fixtureUrl));
  const area = path.join(distribution, ".crdd", "tests");
  const root = path.join(area, "auth-create-closure");
  const statePath = path.join(root, ".crdd", "coordinator", "state.json");
  const hostRoot = path.join(root, ".crdd", "tests", "owned-host");
  const marker = path.join(root, ".crdd", "tests", "owned-marker");
  const image =
    "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
  const dockerId = "1".repeat(64),
    existingId = "2".repeat(64);
  const endpoint = "npipe:////./pipe/dockerDesktopLinuxEngine";
  const executable =
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
  const events: string[] = [];
  const reports: Array<Record<string, unknown>> = [];
  const listeners = new Map<string, () => void>();
  const mocks = new Map<string, Record<string, unknown>>();
  let hits = 0,
    inode = 1n,
    producerCalls = 0,
    restartCalls = 0,
    recoveryCalls = 0;
  let rawRm = 0,
    rawRmSuccess = 0,
    rootDeletes = 0,
    baselineReads = 0,
    absenceReads = 0;
  let networkInspectCalls = 0;
  let configReads = 0,
    treeReads = 0,
    syncs = 0,
    readerCalls = 0;
  let rootFinalStats = 0;
  let manifestCompletions = 0;
  let gitCalls = 0,
    rootVerifications = 0,
    rootResolutions = 0,
    domainEnsures = 0,
    domainRequires = 0,
    trustObservations = 0,
    trustVerifications = 0,
    environmentCreations = 0;
  const distributionCapability = Object.freeze({});
  const runtimeArea = Object.freeze({ directory: area });
  const trustedCli = Object.freeze({ executablePath: executable });
  let present = false,
    deletedRoot = false,
    namedSpawn: (...args: unknown[]) => unknown;
  const nodes = new Map<
    string,
    { directory: boolean; bytes: Buffer; ino: bigint }
  >();
  /**
   * 合成Filesystemへ単一の既知entryを作る。
   * @responsibility 実FSへ接続せず実体番号を分離する。
   * @trace PRL-IT-013
   * @precondition 呼出し元が固定Pathを構築する。
   * @stimulus 合成Mapを一箇所更新する。
   * @observation 種別・bytes・新実体番号。
   * @oracle 親のmanifestが差を観測できる。
   * @cleanup scenario終了でMap全体を破棄する。
   * @boundary メモリ内のFilesystem代役だけ。
   */
  function put(
    location: string,
    directory: boolean,
    bytes: Buffer = Buffer.alloc(0),
  ) {
    nodes.set(location, { directory, bytes, ino: inode++ });
  }
  for (const directory of [
    distribution,
    path.join(distribution, ".crdd"),
    area,
  ])
    put(directory, true);
  const identity = {
    images: { provider: image },
    resources: { auth: "crdd-auth-0123456789abcdef" },
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    workspaceMountMode: null,
    hostPaths: { root: hostRoot, marker },
  };
  const target = {
    kind: "docker_task",
    recoveryId: "fixture-exact-id",
    identityJson: JSON.stringify(identity),
    execution: {
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    },
    resources: [
      {
        purpose: "create_subscription_auth_probe",
        request: "unknown",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      },
      { purpose: "create_provider", request: "not_requested" },
    ],
    dockerRestart: null as unknown,
  };
  const other = {
    kind: "other_fixture",
    recoveryId: "other-id",
    marker: "preserved",
  };
  let snapshot = {
    operations: [target as Record<string, unknown>, other],
    unresolvedRecoveries: [],
    pendingDeliveries: [],
  };
  const fakeFs = {
    realpathSync: (location: string) => {
      assert.ok(nodes.has(location));
      if (fault === "area_alias" && location === area) {
        hits++;
        return `${area}-alias`;
      }
      if (
        fault === "cleanup_cancel" &&
        location === root &&
        baselineReads >= 5 &&
        hits === 0
      ) {
        hits++;
        listeners.get("SIGINT")?.();
      }
      return location;
    },
    lstatSync: (location: string) => {
      if (
        fault === "root_post_delete_unknown" &&
        deletedRoot &&
        location === root
      ) {
        hits++;
        throw Object.assign(new Error("unobserved"), { code: "EACCES" });
      }
      const node = nodes.get(location);
      if (!node) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      if (location === root && treeReads > 0) {
        rootFinalStats++;
        if (fault === "root_identity" && rootFinalStats === 5) {
          hits++;
          return {
            dev: 1n,
            ino: 99999n,
            birthtimeNs: 99999n,
            mtimeNs: 1n,
            size: 0n,
            isSymbolicLink: () => false,
            isDirectory: () => true,
            isFile: () => false,
          };
        }
      }
      return {
        dev: 1n,
        ino: node.ino,
        birthtimeNs: node.ino,
        mtimeNs: 1n,
        size: BigInt(node.bytes.length),
        isSymbolicLink: () => false,
        isDirectory: () => node.directory,
        isFile: () => !node.directory,
      };
    },
    mkdirSync: (location: string) => {
      assert.ok(!nodes.has(location));
      assert.ok(
        location === root || location === path.join(root, "docker-config"),
      );
      put(location, true);
    },
    readFileSync: (location: string) => {
      const node = nodes.get(location);
      assert.ok(node && !node.directory);
      return Buffer.from(node.bytes);
    },
    readdirSync: (location: string) => {
      assert.ok(nodes.get(location)?.directory);
      if (location === root) {
        treeReads++;
        if (fault === "root_manifest_change" && treeReads === 3) {
          assert.equal(manifestCompletions, 1);
          hits++;
          put(statePath, false, Buffer.from("changed-between-complete-scans"));
        }
        if (fault === "root_manifest") {
          hits++;
          return [".git", ".crdd", "docker-config", "unexpected"];
        }
      }
      return [...nodes.keys()]
        .filter(
          (entry) => entry !== location && path.dirname(entry) === location,
        )
        .map((entry) => path.basename(entry));
    },
    rmSync: (location: string) => {
      assert.equal(location, root);
      rootDeletes++;
      events.push("root_delete");
      if (fault === "root_delete_throw") {
        hits++;
        throw new Error("delete_failed");
      }
      for (const entry of [...nodes.keys()])
        if (entry === root || entry.startsWith(`${root}${path.sep}`))
          nodes.delete(entry);
      deletedRoot = true;
    },
  };
  const fakeProcess = {
    argv: [
      "node",
      fileURLToPath(new URL(fixtureUrl)),
      ...(fault === "no_flag" ? [] : ["--execute-approved"]),
      ...(absentAuth ? ["--verify-absent-auth"] : []),
    ],
    execArgv: ["--experimental-test-module-mocks"],
    platform: fault === "non_windows" ? "linux" : "win32",
    execPath: "fixture-node",
    exitCode: undefined as number | undefined,
    stdout: {
      write: (text: string) => {
        reports.push(JSON.parse(text));
        events.push("report");
      },
    },
    on: (name: string, handler: () => void) => {
      listeners.set(name, handler);
    },
    off: (name: string, handler: () => void) => {
      assert.equal(listeners.get(name), handler);
      listeners.delete(name);
    },
  };
  const capability = Object.freeze({});
  let initialIsolation: Record<string, unknown>;
  let activeLifecycle: Record<string, unknown>;
  /**
   * 固定Docker読取りと一件のrmだけを代役に搬送する。
   * @responsibility 未知exe／argvを拒否して実spawnへfallbackしない。
   * @trace PRL-IT-013
   * @precondition named bindingまたはpass-through元から呼ばれる。
   * @stimulus 子の作成通知と下位Docker要求をメモリへ反映する。
   * @observation 生要求列と資源存在、戻りstatus。
   * @oracle 故障到達と既発生処置を区別する。
   * @cleanup scenarioのメモリだけを破棄する。
   * @boundary 合成Process／Engineだけ。
   */
  function spawn(...args: unknown[]) {
    const argv = args[1] as string[];
    const ok = (stdout: string) => ({
      pid: 91,
      status: 0,
      signal: null,
      stdout,
      stderr: "",
      output: ["", stdout, ""],
    });
    if (args[0] === "fixture-node") {
      producerCalls++;
      events.push("producer");
      assert.deepEqual(argv, [
        "--experimental-test-module-mocks",
        fileURLToPath(
          new URL("./docker-recovery-abandon-worker.ts", fixtureUrl),
        ),
        "auth_create_unknown",
      ]);
      const options = args[2] as {
        cwd: string;
        shell: boolean;
        timeout: number;
      };
      assert.equal(options.cwd, root);
      assert.equal(options.shell, false);
      assert.equal(options.timeout, 90_000);
      for (const directory of [
        path.join(root, ".crdd"),
        path.join(root, ".crdd", "coordinator"),
        path.join(root, ".crdd", "tests"),
        hostRoot,
      ])
        put(directory, true);
      put(marker, false, Buffer.from("marker"));
      const bytes = Buffer.from(JSON.stringify(snapshot));
      put(statePath, false, bytes);
      present = true;
      if (fault === "producer_cancel") {
        hits++;
        listeners.get("SIGINT")?.();
      }
      if (fault === "producer_timeout") {
        hits++;
        return { ...ok(""), error: new Error("timeout"), status: null };
      }
      if (fault === "packet_missing") {
        hits++;
        return { ...ok(""), status: 1 };
      }
      const packet = {
        pid: 91,
        recoveryId: target.recoveryId,
        phase: "auth_create_unknown",
        hostStarts: 1,
        receiptRegistered: false,
        providerStarted: false,
        containerName: identity.resources.auth,
        ownershipLabel: identity.ownershipLabel,
        image,
        dockerId,
        createCli: {
          pid: 92,
          status: 0,
          signal: null,
          stdoutBytes: 65,
          stderrBytes: 0,
        },
        stateSha256: createHash("sha256").update(bytes).digest("hex"),
      };
      if (fault === "packet_id") {
        hits++;
        packet.recoveryId = "other";
      }
      return { ...ok(JSON.stringify(packet)), status: 1 };
    }
    assert.equal(args[0], executable);
    assert.deepEqual(argv.slice(0, 3), ["--host", endpoint, "--config"]);
    const command = argv.slice(4);
    if (command[0] === "container" && command[1] === "rm") {
      assert.deepEqual(command, ["container", "rm", "--force", dockerId]);
      rawRm++;
      events.push("rm");
      if (fault === "rm_failed") {
        hits++;
        return { ...ok(""), status: 1 };
      }
      present = false;
      rawRmSuccess++;
      if (fault === "preparation_state_identity") {
        hits++;
        const state = nodes.get(statePath);
        assert.ok(state);
        put(statePath, false, state.bytes);
      }
      if (fault === "preparation_state_bytes") {
        hits++;
        const state = nodes.get(statePath);
        assert.ok(state);
        state.bytes = Buffer.from("changed-state");
      }
      return ok(`${dockerId}\n`);
    }
    if (command[0] === "container" && command[1] === "ls") {
      if (command.includes("--filter")) {
        const alternatives = [
          [`id=${dockerId}`],
          [`name=^/${identity.resources.auth}$`],
          [
            `name=^/${identity.resources.auth}$`,
            `label=${identity.ownershipLabel}`,
          ],
        ];
        assert.ok(
          alternatives.some(
            (filters) =>
              JSON.stringify(command) ===
              JSON.stringify([
                "container",
                "ls",
                "--all",
                "--no-trunc",
                ...filters.flatMap((value) => ["--filter", value]),
                "--format",
                "{{.ID}}",
              ]),
          ),
        );
        absenceReads++;
        const index = /^absence_([1-6])$/u.exec(fault)?.[1];
        if (index && absenceReads === Number(index)) {
          hits++;
          return ok(`${dockerId}\n`);
        }
        return ok(present ? `${dockerId}\n` : "");
      }
      assert.deepEqual(command, [
        "container",
        "ls",
        "--all",
        "--no-trunc",
        "--format",
        "{{.ID}}",
      ]);
      baselineReads++;
      const index = /^baseline_([1-5])$/u.exec(fault)?.[1];
      if (index && baselineReads === Number(index)) {
        hits++;
        return { ...ok(""), status: 1 };
      }
      if (fault === "recovery_cancel" && baselineReads === 4) {
        hits++;
        listeners.get("SIGINT")?.();
      }
      return ok([existingId, ...(present ? [dockerId] : [])].join("\n"));
    }
    if (command[0] === "container" && command[1] === "inspect") {
      if (command.includes("--format")) {
        assert.equal(command[2], existingId);
        assert.deepEqual(command, [
          "container",
          "inspect",
          existingId,
          "--format",
          "[{{json .Id}},{{json .Name}},{{json .Image}},{{json .State.Status}},{{json .State.Running}}]",
        ]);
        const difference = /^baseline_difference_([2-5])$/u.exec(fault)?.[1];
        const changed = difference && baselineReads === Number(difference);
        if (changed) hits++;
        return ok(
          JSON.stringify([
            existingId,
            changed ? "/changed" : "/existing",
            image,
            "exited",
            false,
          ]),
        );
      }
      assert.equal(command[2], dockerId);
      assert.deepEqual(command, ["container", "inspect", dockerId]);
      if (fault === "positive_after_restart" && restartCalls > 0) {
        hits++;
        return { ...ok("[]"), status: 1 };
      }
      return ok(
        JSON.stringify([{ Id: dockerId, State: { Status: "created" } }]),
      );
    }
    if (command[0] === "image" && command[1] === "inspect") {
      assert.equal(command[2], image);
      assert.deepEqual(command, [
        "image",
        "inspect",
        image,
        "--format",
        "{{.Id}}",
      ]);
      if (fault === "image_missing") {
        hits++;
        return { ...ok(""), status: 1 };
      }
      if (fault === "initial_cancel") {
        hits++;
        listeners.get("SIGINT")?.();
      }
      return ok(image);
    }
    if (command[0] === "image" && command[1] === "ls") {
      assert.deepEqual(command, ["image", "ls", "--quiet", "--no-trunc"]);
      return ok(image);
    }
    if (command[0] === "network" && command[1] === "ls") {
      assert.deepEqual(command, [
        "network",
        "ls",
        "--no-trunc",
        "--format",
        "{{.ID}}",
      ]);
      const changed =
        (fault === "bridge_before_restart_change" && baselineReads >= 2) ||
        ((fault === "bridge_after_producer_change" ||
          fault === "bridge_producer_then_restart") &&
          baselineReads >= 3) ||
        ((fault === "bridge_restart" ||
          fault === "bridge_post_restart_change") &&
          restartCalls > 0);
      const bridgeId =
        fault === "bridge_post_restart_change" && baselineReads >= 5
          ? "6".repeat(64)
          : fault === "bridge_after_producer_recapture_change" &&
              baselineReads >= 4 &&
              restartCalls === 0
            ? "6".repeat(64)
            : fault === "bridge_producer_then_restart" && restartCalls > 0
              ? "6".repeat(64)
              : (changed ? "5" : "3").repeat(64);
      const customId =
        (fault === "custom_network_change" && restartCalls > 0) ||
        (fault === "custom_network_producer_change" && baselineReads >= 3)
          ? "7".repeat(64)
          : "4".repeat(64);
      if (
        changed ||
        customId === "7".repeat(64) ||
        (fault === "bridge_after_producer_recapture_change" &&
          bridgeId === "6".repeat(64))
      )
        hits++;
      return ok(`${bridgeId}\n${customId}`);
    }
    if (command[0] === "network" && command[1] === "inspect") {
      assert.equal(command.length, 5);
      assert.equal(command[3], "--format");
      assert.equal(command[4], "{{json .}}");
      assert.match(command[2] ?? "", /^[34567]{64}$/u);
      networkInspectCalls++;
      if (fault === "bridge_inspect_failure") {
        hits++;
        return { ...ok(""), status: 1 };
      }
      if (command[2] === "4".repeat(64) || command[2] === "7".repeat(64))
        return ok(JSON.stringify({ Id: command[2], Name: "custom" }));
      const bridge = {
        Name: "bridge",
        Id: command[2],
        Created: "2026-10-17T00:00:00Z",
        Scope: "local",
        Driver: "bridge",
        EnableIPv4: true,
        EnableIPv6: false,
        IPAM: {
          Driver: "default",
          Options: null,
          Config: [{ Subnet: "172.17.0.0/16", Gateway: "172.17.0.1" }],
        },
        Internal: false,
        Attachable: false,
        Ingress: false,
        ConfigFrom: { Network: "" },
        ConfigOnly: false,
        Options: { "com.docker.network.bridge.default_bridge": "true" },
        Labels: {},
        Containers: {},
        Status: {},
      };
      if (
        (fault === "bridge_config_change" && restartCalls > 0) ||
        (fault === "bridge_producer_config_change" && baselineReads >= 3)
      ) {
        bridge.IPAM.Config = [
          { Subnet: "172.18.0.0/16", Gateway: "172.17.0.1" },
        ];
        hits++;
      }
      return ok(JSON.stringify(bridge));
    }
    if (command[0] === "volume" && command[1] === "ls") {
      assert.deepEqual(command, ["volume", "ls", "--format", "{{.Name}}"]);
      return ok("existing-volume");
    }
    throw new Error(`unknown_docker_command:${JSON.stringify(command)}`);
  }
  const cp = { spawnSync: spawn };
  const moduleUrl = (relative: string) => new URL(relative, fixtureUrl).href;
  const isolationUrl = moduleUrl("../../../docker-isolation/src/index.ts");
  const lifecycleUrl = moduleUrl("../../src/execution/recovery.ts");
  const loads: string[] = [];
  const expectedLoads = [
    moduleUrl("../../../version-control/src/index.ts"),
    moduleUrl("../../../domain-model/src/index.ts"),
    isolationUrl,
    moduleUrl("../../src/storage/settlement-store.ts"),
    `${lifecycleUrl}?auth-create-parent`,
    moduleUrl("../../src/execution/runtime-restart.ts?auth-create-parent"),
  ];
  /**
   * 明示したmodule順だけを解決する。
   * @responsibility query importとmock前後を本番統括と同じ順で拘束する。
   * @trace PRL-IT-013
   * @precondition 各scenarioが新品の登録表を所有する。
   * @stimulus 実本文のdynamic importに対応する境界を返す。
   * @observation URL列、factory経由、checkpointと資源遷移。
   * @oracle 未登録URL・順序差・迂回を拒否する。
   * @cleanup 実本文のrestoreで登録表を空に戻す。
   * @boundary module解決代役。実Runtime module cacheへ接続しない。
   */
  async function loadFixtureModule(url: string) {
    const resolved = new URL(url, fixtureUrl).href;
    assert.equal(resolved, expectedLoads[loads.length]);
    loads.push(resolved);
    if (loads.length === 1)
      return {
        verifyRepositoryRoot: (location: string) => {
          rootVerifications++;
          assert.ok(location === root || location === distribution);
          return {
            status: "completed",
            capability: location === root ? capability : distributionCapability,
          };
        },
        resolveVerifiedRepositoryRoot: (value: unknown) => {
          rootResolutions++;
          assert.ok(value === capability || value === distributionCapability);
          return value === capability ? root : distribution;
        },
      };
    if (loads.length === 2)
      return {
        ensureRepositoryRuntimeDataAreaFromWorkingDirectory: (
          location: string,
          kind: string,
        ) => {
          domainEnsures++;
          assert.equal(location, distribution);
          assert.equal(kind, "tests");
          return runtimeArea;
        },
        requireReadyRepositoryRuntimeDataArea: (
          value: unknown,
          purpose: string,
        ) => {
          domainRequires++;
          assert.equal(value, runtimeArea);
          assert.equal(purpose, "auth_create_closure");
          return value;
        },
      };
    if (loads.length === 3) {
      initialIsolation = {
        observeDockerRecoveryConfigIdentity: (location: string) => {
          configReads++;
          assert.equal(location, path.join(root, "docker-config"));
          assert.equal(nodes.get(location)?.directory, true);
          assert.equal(
            [...nodes.keys()].filter(
              (entry) => path.dirname(entry) === location,
            ).length,
            0,
          );
          return "config-identity";
        },
        observeTrustedDockerCli: () => {
          trustObservations++;
          return trustedCli;
        },
        verifyTrustedDockerCliSnapshot: (value: unknown) => {
          trustVerifications++;
          assert.equal(value, trustedCli);
          return executable;
        },
        createDockerCliEnvironment: (value: unknown) => {
          environmentCreations++;
          assert.deepEqual(value, { dockerConfig: null, dockerHome: null });
          return { SystemRoot: "C:\\Windows" };
        },
        dockerResourceConfigurationMatches: () => {
          if (fault === "positive_configuration" && restartCalls > 0) {
            hits++;
            return false;
          }
          return true;
        },
        restartDockerRuntime: async (input: {
          beforeRequest(): boolean;
          onEvent(event: unknown): void;
          signal: AbortSignal;
        }) => {
          restartCalls++;
          events.push("restart");
          assert.equal(input.signal, signal);
          if (fault === "restart_throw") {
            hits++;
            throw new Error("restart_failed");
          }
          if (
            fault === "restart_blocked" ||
            fault === "restart_start_blocked"
          ) {
            hits++;
            return {
              status: "blocked",
              restartCompleted: false,
              stopFailure:
                fault === "restart_blocked" ? "engine_unconfirmed" : null,
              startFailure:
                fault === "restart_start_blocked"
                  ? "client_processes_unconfirmed"
                  : null,
            };
          }
          assert.equal(input.beforeRequest(), true);
          if (fault === "restart_notification_missing") hits++;
          else input.onEvent({ event: "request_accepted" });
          input.onEvent({ event: "settled" });
          const result: Record<string, unknown> = {
            status: "completed",
            restartCompleted: true,
            cleanupConfirmed: true,
            primaryFailure: null,
            stopFailure: null,
            startFailure: null,
            cleanupFailure: null,
          };
          const field = fault.startsWith("restart_field_")
            ? fault.slice("restart_field_".length)
            : null;
          if (field) {
            assert.ok(
              [
                "restartCompleted",
                "cleanupConfirmed",
                "primaryFailure",
                "cleanupFailure",
              ].includes(field),
            );
            hits++;
            result[field] = field.endsWith("Failure")
              ? "injected_failure"
              : false;
          }
          return result;
        },
        createDockerTaskRecoveryExecutor: () => ({
          status: "ready",
          executor: {
            discoverSubmitted: () => {
              events.push("discover");
              if (fault === "discovery_id") {
                hits++;
                return "4".repeat(64);
              }
              return absentAuth ? null : dockerId;
            },
            observeAbsent: () => {
              events.push("observe_absent");
              const count = events.filter(
                (value) => value === "observe_absent",
              ).length;
              if (fault === `round_unknown_${count}`) {
                hits++;
                return false;
              }
              if (fault === `round_throw_${count}`) {
                hits++;
                throw new Error("observation_failed");
              }
              return !present;
            },
            recoverObserved: () => {
              events.push("recover_observed");
              if (fault === "recover_rejected") {
                hits++;
                return false;
              }
              if (fault === "rm_missing") {
                hits++;
                return true;
              }
              if (fault === "rm_different_id") {
                hits++;
                namedSpawn(executable, [
                  "--host",
                  endpoint,
                  "--config",
                  path.join(root, "docker-config"),
                  "container",
                  "rm",
                  "--force",
                  "4".repeat(64),
                ]);
                throw new Error("different_rm_survived");
              }
              const result = namedSpawn(executable, [
                "--host",
                endpoint,
                "--config",
                path.join(root, "docker-config"),
                "container",
                "rm",
                "--force",
                dockerId,
              ]) as { status: number };
              if (fault === "rm_duplicate") {
                hits++;
                namedSpawn(executable, [
                  "--host",
                  endpoint,
                  "--config",
                  path.join(root, "docker-config"),
                  "container",
                  "rm",
                  "--force",
                  dockerId,
                ]);
              }
              return result.status === 0;
            },
          },
        }),
      };
      return initialIsolation;
    }
    if (loads.length === 4)
      return {
        writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure: () => {
          events.push("closure_save");
          if (fault === "closure_save_failed") {
            hits++;
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          }
          if (fault === "closure_save_unconfirmed") hits++;
          const auth = target.resources[0];
          assert.ok(auth);
          snapshot.operations[0] = {
            ...target,
            resources: [
              { ...auth, observation: "absent", absence: { dockerId: null } },
            ],
          };
          return {
            status: "completed",
            snapshotConfirmed: fault !== "closure_save_unconfirmed",
            lockReleased: true,
          };
        },
        readRuntimeOwnedCoordinatorRecoverySnapshot: () => {
          readerCalls++;
          if (
            ["rm_reader_unknown", "rm_reader_release"].includes(fault) &&
            events.at(-1) === "recover_observed"
          ) {
            hits++;
            return {
              status: fault === "rm_reader_unknown" ? "blocked" : "completed",
              lockReleased: false,
              value: { snapshot: structuredClone(snapshot) },
            };
          }
          if (fault === "reader_unknown" && readerCalls === 1) {
            hits++;
            return { status: "blocked", lockReleased: true };
          }
          if (fault === "reader_release" && readerCalls === 1) {
            hits++;
            return {
              status: "completed",
              lockReleased: false,
              value: { snapshot: structuredClone(snapshot) },
            };
          }
          if (
            fault === "restart_readback" &&
            target.dockerRestart !== null &&
            hits === 0
          ) {
            hits++;
            return { status: "blocked", lockReleased: true };
          }
          if (
            fault === "final_reader_unknown" &&
            snapshot.operations.length === 1
          ) {
            hits++;
            return { status: "blocked", lockReleased: true };
          }
          return {
            status: "completed",
            lockReleased: true,
            value: { snapshot: structuredClone(snapshot) },
          };
        },
      };
    if (loads.length === 5) {
      assert.ok(mocks.has(isolationUrl));
      activeLifecycle = {
        currentDockerRecoveryResourceExpectations: () => [
          {
            purpose: "create_subscription_auth_probe",
            expectations: [{ purpose: "create_subscription_auth_probe" }],
          },
        ],
        recoverRuntimeOwnedDockerTaskForCurrentConsumer: async (
          _id: string,
          _cap: unknown,
          inputSignal: AbortSignal,
        ) => {
          recoveryCalls++;
          events.push("consumer");
          assert.equal(inputSignal, signal);
          assert.equal(_id, target.recoveryId);
          assert.equal(_cap, capability);
          const factory = mocks.get(isolationUrl)
            ?.createDockerTaskRecoveryExecutor as () => {
            executor: {
              discoverSubmitted(value: unknown): string | null;
              recoverObserved(value: unknown): boolean;
              observeAbsent(...args: unknown[]): boolean;
            };
          };
          const executor = factory().executor;
          const found = executor.discoverSubmitted({
            purpose: "create_subscription_auth_probe",
          });
          if (fault === "discovery_duplicate") {
            hits++;
            executor.discoverSubmitted({
              purpose: "create_subscription_auth_probe",
            });
          }
          let recovered: boolean;
          if (absentAuth) {
            assert.equal(found, null);
            for (const round of [1, 2]) {
              if (fault === "round_omitted" && round === 2) {
                hits++;
                continue;
              }
              assert.equal(
                round,
                events.filter((value) => value === "observe_absent").length + 1,
              );
              if (
                !executor.observeAbsent(
                  "container",
                  identity.resources.auth,
                  identity.ownershipLabel,
                )
              )
                return { status: "blocked" };
            }
            const writer = mocks.get(
              moduleUrl("../../src/storage/settlement-store.ts"),
            )?.writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure as (
              ...args: unknown[]
            ) => {
              status: string;
            };
            recovered =
              writer(undefined, target.recoveryId).status === "completed";
          } else {
            if (fault === "identified_missing") hits++;
            else
              snapshot.operations[0] = {
                ...target,
                resources: [
                  {
                    purpose: "create_subscription_auth_probe",
                    request: "identified",
                    dockerId: found,
                    receiptSource: "runtime_reconciliation",
                    observation: "present",
                    absence: null,
                  },
                ],
              };
            recovered = executor.recoverObserved({
              purpose: "create_subscription_auth_probe",
              dockerId: found,
            });
          }
          if (!recovered) return { status: "blocked" };
          if (fault === "state_retained") hits++;
          else snapshot = { ...snapshot, operations: [other] };
          if (fault === "host_retained") hits++;
          else {
            nodes.delete(hostRoot);
            nodes.delete(marker);
          }
          nodes.set(statePath, {
            directory: false,
            bytes: Buffer.from(JSON.stringify(snapshot)),
            ino: inode++,
          });
          const result: Record<string, unknown> = {
            status: "recovered",
            taskRecoveryCompleted: true,
            dockerCleanupConfirmed: true,
            hostCleanupConfirmed: true,
            locksReleased: true,
            historyConfirmed: true,
          };
          const field = fault.startsWith("recovery_field_")
            ? fault.slice("recovery_field_".length)
            : null;
          if (field) {
            assert.ok(
              [
                "taskRecoveryCompleted",
                "dockerCleanupConfirmed",
                "hostCleanupConfirmed",
                "locksReleased",
                "historyConfirmed",
              ].includes(field),
            );
            hits++;
            result[field] = false;
          }
          return result;
        },
      };
      return activeLifecycle;
    }
    assert.ok(mocks.has(lifecycleUrl));
    return {
      restartRuntimeOwnedDockerForRecovery: async (
        _id: string,
        _capSignal: AbortSignal,
        rootCapability: unknown,
      ) => {
        assert.equal(_id, target.recoveryId);
        assert.equal(rootCapability, capability);
        assert.equal(_capSignal, signal);
        const restart = mocks.get(isolationUrl)?.restartDockerRuntime as (
          input: unknown,
        ) => Promise<Record<string, unknown>>;
        const result = await restart({
          signal,
          beforeRequest: () => {
            if (fault === "restart_save_refused") {
              hits++;
              return false;
            }
            target.dockerRestart = { request: "unknown" };
            return true;
          },
          onEvent: (event: { event: string }) => {
            if (
              fault === "restart_event_save" &&
              event.event === "request_accepted"
            ) {
              hits++;
              throw new Error("save_unconfirmed");
            }
            target.dockerRestart = {
              request:
                event.event === "request_accepted" ? "issued" : "confirmed",
              cleanup: "confirmed",
              result: {
                status: "completed",
                request: "confirmed",
                effectOutcomeUnknown: false,
              },
            };
          },
        });
        if (fault === "restart_checkpoint") {
          hits++;
          target.dockerRestart = {
            request: "issued",
            cleanup: "pending",
            result: null,
          };
        }
        snapshot.operations[0] = { ...target };
        if (fault === "restart_cancel") {
          hits++;
          listeners.get("SIGINT")?.();
        }
        return absentAuth
          ? { ...result, recoveryId: target.recoveryId }
          : result;
      },
    };
  }
  let signal: AbortSignal;
  const FakeAbort = class extends AbortController {
    constructor() {
      super();
      signal = this.signal;
    }
  };
  const fakeMock = {
    module: (
      url: string,
      options: { namedExports: Record<string, unknown> },
    ) => {
      assert.ok(
        [
          isolationUrl,
          lifecycleUrl,
          moduleUrl("../../src/storage/settlement-store.ts"),
        ].includes(url),
      );
      assert.equal(mocks.has(url), false);
      mocks.set(url, options.namedExports);
      return {
        restore: () => {
          assert.equal(mocks.delete(url), true);
        },
      };
    },
  };
  const factory = runInThisContext(`(function(context) {
    const { assert, cp, execFileSync, createHash, fs, path, mock, delay, yieldEvents, fileURLToPath, fixedImage, endpoint, fixtureUrl, process, AbortController, loadFixtureModule, Buffer, URL, Object, manifestCompleted } = context;
    let spawnSync = cp.spawnSync;
    const syncBuiltinESMExports = () => { spawnSync = cp.spawnSync; context.synced(); };
    context.observeNamed(() => spawnSync);
    ${body}
    return executeApprovedAuthCreateClosure();
  })`);
  let namedGetter: () => (...args: unknown[]) => unknown;
  namedSpawn = (...args: unknown[]) => namedGetter()(...args);
  let escaped: unknown;
  let diagnosticIteratorCalls = 0;
  let diagnosticAccessorCalls = 0;
  let inheritedDescriptorHits = 0;
  if (fault === "existing_root") put(root, true);
  if (["no_flag", "non_windows", "existing_root"].includes(fault)) hits++;
  try {
    await factory({
      Object:
        fault === "diagnostic_network_inherited_descriptor"
          ? Object.assign(Object.create(Object), {
              getOwnPropertyDescriptor: (value: object, key: PropertyKey) => {
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (descriptor && !Object.hasOwn(descriptor, "value")) {
                  inheritedDescriptorHits++;
                  return Object.assign(
                    Object.create({ value: "b".repeat(64) }),
                    descriptor,
                  );
                }
                return descriptor;
              },
            })
          : Object,
      assert,
      cp,
      execFileSync: (exe: string, argv: string[], options: unknown) => {
        if (fault.startsWith("diagnostic_")) {
          hits++;
          if (fault.startsWith("diagnostic_network_")) {
            const kind = fault.slice("diagnostic_network_".length);
            const shared = "a".repeat(64),
              added = "b".repeat(64),
              removed = "c".repeat(64);
            const expected: Record<string, unknown> = {
              containers: [],
              networks: [shared, removed],
              volumes: [],
              images: [],
            };
            const actual: Record<string, unknown> = {
              ...expected,
              networks: [added, shared, added],
            };
            if (kind === "iterator" || kind === "second_iterator")
              Object.defineProperty(actual.networks, Symbol.iterator, {
                value: function* () {
                  diagnosticIteratorCalls++;
                  yield kind === "second_iterator" &&
                  diagnosticIteratorCalls === 1
                    ? added
                    : "fixture-private-identity";
                },
              });
            if (kind === "accessor" || kind === "inherited_descriptor")
              Object.defineProperty(actual.networks, "0", {
                get: () => {
                  diagnosticAccessorCalls++;
                  return added;
                },
              });
            if (kind === "added") expected.networks = [shared];
            if (kind === "removed") actual.networks = [shared];
            if (kind === "invalid")
              actual.networks = ["fixture-private-identity"];
            if (kind === "sparse") actual.networks = new Array(1);
            if (kind === "non_array") actual.networks = {};
            if (kind === "missing") delete actual.networks;
            if (kind === "limit") {
              expected.networks = [];
              actual.networks = Array.from({ length: 128 }, (_, i) =>
                i.toString(16).padStart(64, "0"),
              );
            }
            if (kind === "overflow")
              actual.networks = new Array(129).fill(added);
            if (kind === "expected_invalid")
              expected.networks = ["fixture-private-identity"];
            if (kind === "expected_sparse") expected.networks = new Array(1);
            if (kind === "expected_overflow")
              expected.networks = new Array(129).fill(removed);
            throw new assert.AssertionError({ actual, expected });
          }
          if (fault.startsWith("diagnostic_baseline_")) {
            const field = fault.slice("diagnostic_baseline_".length);
            if (field === "inherited") {
              const inherited = {
                containers: [],
                networks: [],
                volumes: [],
                images: [],
              };
              const actual = Object.assign(
                Object.create({
                  ...inherited,
                  images: ["fixture-private-identity"],
                }),
                { a: 1, b: 2, c: 3, d: 4 },
              );
              const expected = Object.assign(Object.create(inherited), {
                a: 1,
                b: 2,
                c: 3,
                d: 4,
              });
              throw new assert.AssertionError({ actual, expected });
            }
            assert.ok(
              ["containers", "networks", "volumes", "images"].includes(field),
            );
            const expected = {
              containers: [],
              networks: [],
              volumes: [],
              images: [],
            };
            throw new assert.AssertionError({
              actual: { ...expected, [field]: ["fixture-private-identity"] },
              expected,
            });
          }
          const failure = new Error("fixture-secret-not-for-report");
          if (fault === "diagnostic_non_error")
            throw "fixture-secret-not-for-report";
          if (fault === "diagnostic_throwing_error")
            throw new Proxy(failure, {
              get: () => {
                throw new Error("fixture-secret-not-for-report");
              },
            });
          if (fault === "diagnostic_message_url") {
            Object.assign(failure, {
              stack: `Error: fixture-secret-not-for-report (${fixtureUrl}:991:2)\n    at fixture (file:///private/foreign.ts:22:2)`,
            });
          } else if (fault === "diagnostic_own_frame") {
            Object.assign(failure, {
              code: "ERR_INVALID_ARG_VALUE",
              stack: `Error: fixture-secret-not-for-report\n    at fixture (${fixtureUrl}:991:2)`,
            });
          } else {
            assert.equal(fault, "diagnostic_foreign_frame");
            Object.assign(failure, {
              code: "private-code",
              stack:
                "Error: fixture-secret-not-for-report\n    at fixture (file:///private/foreign.ts:991:2)",
            });
          }
          throw failure;
        }
        assert.equal(exe, "git");
        assert.deepEqual(options, { windowsHide: true });
        const commands = [
          ["init", "--quiet", root],
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
        ];
        assert.deepEqual(argv, commands[gitCalls]);
        gitCalls++;
        if (gitCalls === 1) put(path.join(root, ".git"), true);
      },
      createHash,
      fs: fakeFs,
      path,
      mock: fakeMock,
      delay: async () => {
        events.push("interval");
      },
      yieldEvents: async () => undefined,
      fileURLToPath,
      fixedImage: image,
      endpoint,
      fixtureUrl,
      process: fakeProcess,
      AbortController: FakeAbort,
      loadFixtureModule,
      Buffer,
      URL,
      manifestCompleted: () => {
        manifestCompletions++;
      },
      synced: () => {
        syncs++;
      },
      observeNamed: (getter: typeof namedGetter) => {
        namedGetter = getter;
      },
    });
  } catch (error) {
    escaped = error;
  }
  assert.equal(cp.spawnSync, spawn);
  assert.equal(mocks.size, 0);
  assert.equal(listeners.size, 0);
  if (syncs) assert.equal(syncs, mutation === "detach_named_binding" ? 1 : 2);
  return {
    fault,
    hits,
    events,
    reports,
    producerCalls,
    restartCalls,
    recoveryCalls,
    rawRm,
    rawRmSuccess,
    rootDeletes,
    rootPresent: nodes.has(root),
    escaped,
    diagnosticIteratorCalls,
    diagnosticAccessorCalls,
    inheritedDescriptorHits,
    exitCode: fakeProcess.exitCode,
    baselineReads,
    networkInspectCalls,
    absenceReads,
    configReads,
    loads,
    syncs,
    manifestCompletions,
    boundaryCalls: {
      gitCalls,
      rootVerifications,
      rootResolutions,
      domainEnsures,
      domainRequires,
      trustObservations,
      trustVerifications,
      environmentCreations,
    },
  };
}
