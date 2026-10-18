/**
 * 読取り助言の試験器を外部AIなしで検証する。
 * @trace ERB-IT-021
 * @level IT
 * @scope Docker比較、公開HTTP搬送、一次失敗と終了観測。
 * @boundary 合成inventory／有限Owner→正式試験Source。実Provider成功の根拠ではない。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  gitRepositoryRevisionAdapter,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  startWorkbench,
  readWorkbenchProjectSurface,
} from "../../src/index.ts";
import {
  assessVerificationDockerInventory,
  createWorkbenchAiVerificationHttpClient,
  type VerificationDockerInventory,
} from "../../scripts/ai-verification-http.ts";

/**
 * @trace ERB-IT-021
 * @precondition Docker CLI出力だけを有限代役に置き換える。
 * @stimulus 正常inspect、IPAM／Options差、欠測・不正JSON・取得失敗を与える。
 * @observation 実Readerの戻り値とConfiguration Hash。
 * @oracle 不完全観測を空配列へ畳まず、意味上の構成差をHashへ反映する。
 * @cleanup N/A: Docker CLIを実行しない。
 */
test("実inventory Readerは欠測を拒否しIPAMとOptions差を比較へ搬送する", () => {
  const source = fs.readFileSync(
    new URL("../../scripts/ai-verification-http.ts", import.meta.url),
    "utf8",
  );
  const body = source
    .slice(
      source.indexOf("const digest ="),
      source.indexOf("/**\n * 標準Network"),
    )
    .replaceAll("export function", "function");
  assert.ok(body.includes("function validInventory"));
  const raw = () => ({
    containers: [
      {
        Id: id(10),
        Name: "/existing",
        Image: id(20),
        State: { Status: "exited" },
        Config: { User: "1000", WorkingDir: "/work", Cmd: [], Entrypoint: [] },
        HostConfig: {},
        Mounts: [],
      },
    ],
    networks: base.networks.map((n) => ({
      Id: n.id,
      Name: n.name,
      Driver: n.driver,
      Scope: n.scope,
      Internal: false,
      EnableIPv4: true,
      EnableIPv6: false,
      Options: n.defaultBridge
        ? { "com.docker.network.bridge.default_bridge": "true" }
        : {},
      IPAM: { Driver: "default", Config: [], Options: null },
      Labels: null,
      Containers: {},
      Attachable: false,
      Ingress: false,
      ConfigOnly: false,
      ConfigFrom: {},
    })),
  });
  const run = (data: ReturnType<typeof raw>, fault = "") =>
    runInNewContext(
      stripTypeScriptTypes(`${body}\nobserveVerificationDockerInventory();`),
      {
        createHash,
        execFileSync: (
          _command: string,
          args: string[],
          options: { maxBuffer: number; timeout: number },
        ) => {
          assert.equal(options.maxBuffer, 1024 * 1024);
          assert.equal(options.timeout, 20_000);
          if (fault === "failure")
            throw new Error("synthetic_capacity_or_transport_failure");
          if (args[0] === "ps") return `${id(10)}\n`;
          if (args[0] === "network" && args[1] === "ls")
            return data.networks.map((n) => n.Id).join("\n");
          if (fault === "json") return "{";
          return JSON.stringify(
            args[0] === "container" ? data.containers : data.networks,
          );
        },
      },
    );
  const baseline = run(raw());
  assert.ok(baseline);
  const changed = raw();
  const bridge = changed.networks[0];
  assert.ok(bridge);
  bridge.IPAM.Driver = "changed";
  assert.notEqual(
    run(changed)?.networks[0]?.configurationHash,
    baseline.networks[0]?.configurationHash,
  );
  bridge.IPAM.Driver = "default";
  Object.assign(bridge.Options, { mtu: "1400" });
  assert.notEqual(
    run(changed)?.networks[0]?.configurationHash,
    baseline.networks[0]?.configurationHash,
  );
  assert.equal(run(raw(), "failure"), null);
  assert.equal(run(raw(), "json"), null);
  for (const [section, fields] of [
    ["container", ["Config", "State", "HostConfig", "Mounts"]],
    ["config", ["User", "WorkingDir", "Cmd", "Entrypoint"]],
    [
      "network",
      [
        "Internal",
        "EnableIPv4",
        "EnableIPv6",
        "IPAM",
        "Containers",
        "Options",
        "Labels",
        "Attachable",
        "Ingress",
        "ConfigOnly",
        "ConfigFrom",
      ],
    ],
    ["ipam", ["Driver", "Config", "Options"]],
  ] as const) {
    for (const field of fields) {
      for (const invalid of [undefined, 42]) {
        const fixture = raw();
        const target =
          section === "container"
            ? fixture.containers[0]
            : section === "config"
              ? fixture.containers[0]?.Config
              : section === "ipam"
                ? fixture.networks[0]?.IPAM
                : fixture.networks[0];
        assert.ok(target);
        if (invalid === undefined) Reflect.deleteProperty(target, field);
        else Reflect.set(target, field, invalid);
        assert.equal(run(fixture), null, `${section}.${field}:${invalid}`);
      }
    }
  }
  for (const field of [
    "IPAM",
    "Containers",
    "Options",
    "Labels",
    "ConfigFrom",
  ]) {
    const fixture = raw();
    assert.ok(fixture.networks[0]);
    Reflect.set(fixture.networks[0], field, []);
    assert.equal(run(fixture), null, field);
  }
  const nullable = raw();
  assert.ok(nullable.containers[0]);
  assert.ok(nullable.networks[0]);
  Object.assign(nullable.containers[0].Config, {
    Cmd: null,
    Entrypoint: null,
  });
  Object.assign(nullable.networks[0].IPAM, { Config: null, Options: null });
  assert.ok(run(nullable));
  Reflect.deleteProperty(bridge, "IPAM");
  assert.equal(run(changed), null);
});

const id = (n: number) => n.toString(16).padStart(64, "0");
type MutableInventory = {
  containers: [Record<string, unknown>, ...Record<string, unknown>[]];
  networks: [
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
  ];
};
const base: VerificationDockerInventory = {
  containers: [
    {
      id: id(10),
      name: "/existing",
      image: id(20),
      state: "exited",
      configurationHash: id(30),
    },
  ],
  networks: [
    {
      id: id(1),
      name: "bridge",
      driver: "bridge",
      scope: "local",
      defaultBridge: true,
      configurationHash: id(31),
    },
    {
      id: id(2),
      name: "host",
      driver: "host",
      scope: "local",
      defaultBridge: false,
      configurationHash: id(32),
    },
    {
      id: id(3),
      name: "none",
      driver: "null",
      scope: "local",
      defaultBridge: false,
      configurationHash: id(33),
    },
    {
      id: id(4),
      name: "user",
      driver: "bridge",
      scope: "local",
      defaultBridge: false,
      configurationHash: id(34),
    },
  ],
};

/**
 * @trace ERB-IT-021
 * @precondition 合成の既存Containerと標準／利用者Networkを用意する。
 * @stimulus ID世代差・属性差・欠測・重複・未回収を与える。
 * @observation 比較status、理由、専用診断と追加／消失ID。
 * @oracle 標準ID差だけを構成不変と分け、他の不明・変更を成功にしない。
 * @cleanup N/A: 値だけの比較。
 */
test("Docker比較は標準ID差を区別し不明・構成差・利用者資源差を拒否する", () => {
  assert.equal(
    assessVerificationDockerInventory(base, base, true).status,
    "verified",
  );
  const changed = structuredClone(base);
  const bridge = changed.networks[0];
  assert.ok(bridge);
  (bridge as { id: string }).id = id(101);
  const allowed = assessVerificationDockerInventory(base, changed, true);
  assert.equal(allowed.status, "verified");
  assert.equal(allowed.standardNetworkIdentityChanged, true);
  assert.equal(allowed.reason, "standard_network_identity_changed");
  assert.deepEqual(allowed.addedNetworks, [id(101)]);
  assert.deepEqual(allowed.removedNetworks, [id(1)]);
  assert.equal(
    assessVerificationDockerInventory(base, changed, false).status,
    "blocked",
  );
  for (const change of [
    (v: MutableInventory) => {
      v.networks[0].configurationHash = id(99);
    },
    (v: MutableInventory) => {
      v.networks[3].id = id(99);
    },
    (v: MutableInventory) => {
      v.containers[0].state = "running";
    },
    (v: MutableInventory) => {
      v.containers.push({
        ...v.containers[0],
        id: id(99),
        name: "/unexpected",
      });
    },
    (v: MutableInventory) => {
      v.networks.push({ ...v.networks[3], id: id(99), name: "unexpected" });
    },
  ]) {
    const value = structuredClone(base);
    change(value as unknown as MutableInventory);
    assert.equal(
      assessVerificationDockerInventory(base, value, true).status,
      "blocked",
    );
  }
  for (const change of [
    (v: MutableInventory) => {
      v.networks[0].defaultBridge = false;
    },
    (v: MutableInventory) => {
      v.networks[1].driver = "bridge";
    },
    (v: MutableInventory) => {
      v.networks[2].scope = "swarm";
    },
    (v: MutableInventory) => {
      v.networks.push({ ...v.networks[0] });
    },
    (v: MutableInventory) => {
      v.networks.splice(0, 1);
    },
    (v: MutableInventory) => {
      v.containers[0].configurationHash = null;
    },
  ]) {
    const value = structuredClone(base);
    change(value as unknown as MutableInventory);
    assert.equal(
      assessVerificationDockerInventory(base, value, true).status,
      "unknown",
    );
  }
  for (const value of [
    null,
    {},
    { containers: [], networks: [] },
    { containers: null, networks: base.networks },
  ]) {
    assert.equal(
      assessVerificationDockerInventory(value, base, true).status,
      "unknown",
    );
    assert.equal(
      assessVerificationDockerInventory(base, value, true).status,
      "unknown",
    );
  }
});

/**
 * @trace ERB-IT-021
 * @precondition 正式CLIを未同意又は不正引数で起動する。
 * @stimulus 同意なし、未知Provider、余剰引数。
 * @observation exit64と案内だけ。
 * @oracle Server／Docker／Provider要求へ進まない。
 * @cleanup 子Processの終了を待つ。
 */
test("実AI試験CLIは明示同意と固定Provider以外を起動前に拒否する", () => {
  const script = fileURLToPath(
    new URL("../../scripts/verify-readonly-ai.ts", import.meta.url),
  );
  for (const args of [
    [],
    ["--provider", "claude"],
    ["--provider", "unknown", "--external-send-confirmed"],
    ["--provider", "claude", "--external-send-confirmed", "extra"],
  ]) {
    let status: number | null = null;
    try {
      execFileSync(process.execPath, [script, ...args], {
        timeout: 15_000,
        stdio: "pipe",
      });
    } catch (error) {
      status = (error as { status: number }).status;
    }
    assert.equal(status, 64);
  }
});

/**
 * @trace ERB-IT-021
 * @precondition 正式main本文と公開HTTPを使い、Provider OwnerとCLI観測だけ有限代役へ置く。
 * @stimulus 成功、標準世代差、一次失敗＋close失敗、cleanup不明を与える。
 * @observation start一回、固定Input、最終評価と終了Code。
 * @oracle 外部AIなしで本文搬送を維持し、失敗をclose又は比較成功で消さない。
 * @cleanup 実loopback ServerとSocketをcloseする。
 * @boundary Source本文の結合であり、実AI又は実Docker再実行ではない。
 */
test("正式試験mainは公開HTTPで一回だけ依頼し失敗と終了観測を分ける", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const surface = await readWorkbenchProjectSurface(root);
  const source = fs.readFileSync(
    new URL("../../scripts/verify-readonly-ai.ts", import.meta.url),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("async function main()"),
    source.indexOf("\nawait main().catch"),
  );
  assert.ok(body.length > 100);
  for (const scenario of [
    "success",
    "generation",
    "primary-close",
    "cleanup",
    "after-paused",
    "after-restarting",
    "before-paused",
    "before-restarting",
  ] as const) {
    let starts = 0;
    let observation = 0;
    const output: string[] = [];
    const processState = {
      argv: [
        "node",
        "script",
        "--provider",
        "claude",
        "--external-send-confirmed",
      ],
      cwd: () => root,
      stderr: { write: () => true },
      exitCode: 0,
    };
    const snapshot = {
      requestId: "synthetic-verification",
      mode: "read_only_advice" as const,
      profileId: "PROFILE-200001",
      status: "completed" as const,
      executionStatus: "completed",
      reason: null,
      cleanupConfirmed: scenario !== "cleanup",
      recoveryIds: [],
      secondaryFailures: [],
      facts: [{ text: "synthetic", references: ["PROJECT_CONTEXT.md"] }],
      sharedAnalysis: [],
      additionalInferences: [],
      nextOptions: [],
      candidate: null,
    };
    const fakeOwner = {
      start: async (input: {
        contextReferences: string[];
        mode: string;
        externalSendConfirmed: boolean;
      }) => {
        starts++;
        assert.deepEqual([...input.contextReferences], ["PROJECT_CONTEXT.md"]);
        assert.equal(input.mode, "read_only_advice");
        assert.equal(input.externalSendConfirmed, true);
        if (scenario === "primary-close") throw new Error("synthetic_primary");
        return {
          status: "accepted" as const,
          requestId: snapshot.requestId,
          reason: null,
        };
      },
      observe: async () => snapshot,
      cancel: async () => snapshot,
      close: async () => {},
    };
    const catalog = {
      revision: 0,
      catalog: {
        profiles: [
          {
            profileId: "PROFILE-200001",
            exactModelId: "opus",
            adapterId: "claude",
            selectionRoles: ["coordinator"],
          },
        ],
        adapters: [{ adapterId: "claude", provider: "claude" }],
      },
    };
    const execution = runInNewContext(
      stripTypeScriptTypes(`${body}\nmain();`),
      {
        assert,
        createHash,
        Buffer,
        join,
        URLSearchParams,
        Error,
        process: processState,
        console: { log: (v: string) => output.push(v) },
        execFileSync: () => {
          throw new Error("git_process_forbidden");
        },
        gitRepositoryRevisionAdapter: (directory: string) => {
          const expected = gitRepositoryRevisionAdapter(directory);
          const previous = process.env.GIT_DIR;
          try {
            process.env.GIT_DIR = join(root, "nonexistent-synthetic-git-dir");
            const actual = gitRepositoryRevisionAdapter(directory);
            assert.deepEqual(actual, expected);
            return actual;
          } finally {
            if (previous === undefined) delete process.env.GIT_DIR;
            else process.env.GIT_DIR = previous;
          }
        },
        readFileSync: () => Buffer.from("synthetic context"),
        verifyRepositoryRoot,
        createRepositoryAiProfileCatalogStore: () => ({
          status: "ready",
          store: { snapshot: () => catalog },
        }),
        readWorkbenchProjectSurface: async () => surface,
        createRepositoryTaskRequests: () => fakeOwner,
        startWorkbench: async (input: Parameters<typeof startWorkbench>[0]) => {
          const handle = await startWorkbench(input);
          return {
            ...handle,
            close: async () => {
              await handle.close();
              if (scenario === "primary-close")
                throw new Error("synthetic_close");
            },
          };
        },
        createWorkbenchAiVerificationHttpClient,
        assessVerificationDockerInventory,
        observeVerificationDockerInventory: () => {
          const value = structuredClone(base);
          if (scenario === "before-paused")
            (value.containers[0] as { state: string }).state = "paused";
          if (scenario === "before-restarting")
            (value.containers[0] as { state: string }).state = "restarting";
          if (observation++ > 0) {
            if (scenario === "generation")
              (value.networks[0] as { id: string }).id = id(101);
            if (scenario === "after-paused")
              (value.containers[0] as { state: string }).state = "paused";
            if (scenario === "after-restarting")
              (value.containers[0] as { state: string }).state = "restarting";
          }
          return value;
        },
        delay: () => Promise.resolve(),
      },
    );
    if (scenario.startsWith("before-")) {
      await assert.rejects(execution, /docker_preflight_unconfirmed/u);
      assert.equal(starts, 0);
      continue;
    }
    await execution;
    assert.equal(starts, 1, JSON.stringify(output));
    const result = JSON.parse(output.at(-1) ?? "null");
    assert.equal(result.fullE2eVerified, false);
    assert.equal(result.wholeRepositoryUnchangedClaimed, false);
    assert.equal(result.projectContextUnchanged, true);
    assert.equal(result.revisionUnchanged, true);
    assert.equal(
      result.limitedProbePassed,
      scenario === "success" || scenario === "generation",
    );
    assert.equal(
      processState.exitCode,
      scenario === "success" || scenario === "generation" ? 0 : 2,
    );
    if (scenario === "generation")
      assert.equal(result.resources.standardNetworkIdentityChanged, true);
    if (scenario === "primary-close") {
      assert.ok(result.primaryFailure);
      assert.equal(result.closeFailure, "synthetic_close");
    }
  }
});
