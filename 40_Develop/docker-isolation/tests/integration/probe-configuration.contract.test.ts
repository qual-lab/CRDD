/**
 * Probeの固定構成とRepository内mountのFilesystem照合を検証する。
 * @packageDocumentation
 * @responsibility 固定構成差・payload差・Path観測不能を一致へ丸めない。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実Repository-local Directoryと同期realpath。Docker実行・回収は含まない。
 * @boundary ERB-IT-004=Direct Boundary: DI構成判定→実Filesystem。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveVerifiedRepositoryRoot,
  getRepository,
} from "../../../version-control/src/index.ts";
import { dockerContainerConfigurationMatches } from "../../src/cleanup/configuration.ts";
import {
  cleanupDockerContainer,
  inspectDockerContainer,
  observeDockerContainerAbsence,
} from "../../src/cleanup/container.ts";

import type { DockerContainerConfigurationExpectation } from "../../src/cleanup/configuration.ts";

/**
 * 検証済みRepository内の三mountと独立したinspect正対照を作る。
 * @responsibility 自己生成範囲だけを作成し、実Filesystem照合を成立させる。
 * @trace ERB-IT-004
 * @precondition 最寄りRepositoryがCRDD Rootと一致する。
 * @stimulus 一意な試験Directoryと三子Directoryを作成する。
 * @observation 期待構成、独立inspect値と自己生成Root。
 * @oracle 固定Probe構成と三Pathだけを再現する。
 * @cleanup 試験終了時にmockを戻して同じ自己生成Rootだけを削除する。
 * @boundary Repository-localの自己生成Filesystem。
 */
function fixture(t: TestContext) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  assert.equal(
    resolveVerifiedRepositoryRoot(verified.capability),
    path.resolve(root),
  );
  const tests = path.join(path.resolve(root), ".crdd", "tests");
  fs.mkdirSync(tests, { recursive: true });
  assert.equal(fs.realpathSync.native(tests), tests);
  const directory = fs.mkdtempSync(path.join(tests, "probe-configuration-"));
  const mounts = {
    workspace: path.join(directory, "workspace"),
    providerHome: path.join(directory, "provider-home"),
    tmp: path.join(directory, "tmp"),
  };
  for (const value of Object.values(mounts)) fs.mkdirSync(value);
  t.after(() => {
    t.mock.restoreAll();
    assert.equal(fs.realpathSync.native(directory), directory);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const expected: DockerContainerConfigurationExpectation = {
    id: "a".repeat(64),
    name: "crdd-coordinator-probe-probe-123",
    ownershipLabel: "crdd.coordinator.probe=probe-123",
    image:
      "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
    user: "65532:65532",
    entrypoint: ["python"],
    commands: [
      ["-c", "probe-a"],
      ["-c", "probe-b"],
    ],
    mounts: {
      "/operation/workspace": { source: mounts.workspace, readWrite: true },
      "/operation/provider-home": {
        source: mounts.providerHome,
        readWrite: true,
      },
      "/operation/tmp": { source: mounts.tmp, readWrite: true },
    },
  };
  const inspect = {
    Id: expected.id,
    Name: "/crdd-coordinator-probe-probe-123",
    Config: {
      Labels: { "crdd.coordinator.probe": "probe-123" },
      Image:
        "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
      User: "65532:65532",
      Entrypoint: ["python"],
      Cmd: ["-c", "probe-a"],
    },
    HostConfig: {
      NetworkMode: "none",
      ReadonlyRootfs: true,
      Privileged: false,
      PidsLimit: 0,
      CapDrop: ["ALL"],
      CapAdd: null,
      Devices: null,
      SecurityOpt: ["no-new-privileges"],
    },
    Mounts: [
      {
        Destination: "/operation/workspace",
        Source: mounts.workspace,
        Type: "bind",
        RW: true,
      },
      {
        Destination: "/operation/provider-home",
        Source: mounts.providerHome,
        Type: "bind",
        RW: true,
      },
      {
        Destination: "/operation/tmp",
        Source: mounts.tmp,
        Type: "bind",
        RW: true,
      },
    ],
  };
  return { directory, expected, inspect };
}

/**
 * 完全構成の各field差を独立入力で拒否する。
 * @responsibility 旧Probeの完全構成保証を共通Container処理で維持する。
 * @trace ERB-IT-004
 * @precondition 合成inspectとRepository-local三mount。
 * @stimulus 所有・Image・Command・隔離・Mountの各fieldを単独変更。
 * @observation 一致判定とgetter呼出し。
 * @oracle 全差分はfalse、固定候補だけtrue。
 * @cleanup fixture終了時に自己生成領域だけを回収する。
 */
test("共通Container照合は完全Command・所有・隔離条件を保持する", (t) => {
  const f = fixture(t);
  assert.equal(
    dockerContainerConfigurationMatches(f.inspect, f.expected),
    true,
  );
  const changes: readonly ((v: typeof f.inspect) => void)[] = [
    (v) => {
      v.Id = "b".repeat(64);
    },
    (v) => {
      v.Name = "/other";
    },
    (v) => {
      v.Config.Labels["crdd.coordinator.probe"] = "other";
    },
    (v) => {
      v.Config.Image = "other";
    },
    (v) => {
      v.Config.User = "0:0";
    },
    (v) => {
      v.Config.Entrypoint = ["sh"];
    },
    (v) => {
      v.Config.Cmd = ["-c", "other"];
    },
    (v) => {
      v.Config.Cmd = ["probe-a"];
    },
    (v) => {
      v.HostConfig.NetworkMode = "bridge";
    },
    (v) => {
      v.HostConfig.ReadonlyRootfs = false;
    },
    (v) => {
      v.HostConfig.Privileged = true;
    },
    (v) => {
      v.HostConfig.CapDrop = [];
    },
    (v) => {
      v.HostConfig.SecurityOpt = [];
    },
    (v) => {
      (v.Mounts[0] ?? assert.fail("fixture_mount_missing")).RW = false;
    },
    (v) => {
      (v.Mounts[0] ?? assert.fail("fixture_mount_missing")).Type = "volume";
    },
    (v) => {
      (v.Mounts[0] ?? assert.fail("fixture_mount_missing")).Destination =
        "/other";
    },
    (v) => {
      v.Mounts.pop();
    },
    (v) => {
      v.Mounts.push({
        ...(v.Mounts[0] ?? assert.fail("fixture_mount_missing")),
      });
    },
  ];
  for (const change of changes) {
    const v = structuredClone(f.inspect);
    change(v);
    assert.equal(dockerContainerConfigurationMatches(v, f.expected), false);
  }
  for (const key of ["Id", "Name", "Config", "HostConfig", "Mounts"]) {
    const v = structuredClone(f.inspect);
    let calls = 0;
    Object.defineProperty(v, key, {
      get() {
        calls++;
        throw Error("getter");
      },
    });
    assert.equal(dockerContainerConfigurationMatches(v, f.expected), false);
    assert.equal(calls, 0);
  }
  for (const field of ["CapAdd", "Devices"]) {
    const v: Record<string, unknown> = structuredClone(f.inspect);
    (v.HostConfig as Record<string, unknown>)[field] = ["extra"];
    assert.equal(dockerContainerConfigurationMatches(v, f.expected), false);
  }
  const second = structuredClone(f.inspect);
  second.Config.Cmd = ["-c", "probe-b"];
  assert.equal(dockerContainerConfigurationMatches(second, f.expected), true);
});

/**
 * Mount元の実体差・観測不能・aliasを反証する。
 * @responsibility 文字列一致へのfallbackを禁止する。
 * @trace ERB-IT-004
 * @precondition 自己生成した三mount。
 * @stimulus 別Directory、欠測、realpath例外、同実体Path表現差。
 * @observation 一致判定。
 * @oracle 同実体のみtrue、観測不能はfalse。
 * @cleanup fixtureの同じRootだけを回収する。
 */
test("共通Container照合はMount元実体をfresh確認する", (t) => {
  const f = fixture(t);
  const changed = structuredClone(f.inspect);
  (changed.Mounts[0] ?? assert.fail("fixture_mount_missing")).Source = (
    f.expected.mounts["/operation/tmp"] ?? assert.fail("fixture_mount_missing")
  ).source;
  assert.equal(dockerContainerConfigurationMatches(changed, f.expected), false);
  (changed.Mounts[0] ?? assert.fail("fixture_mount_missing")).Source =
    path.join(f.directory, "absent");
  assert.equal(dockerContainerConfigurationMatches(changed, f.expected), false);
  const original = fs.realpathSync.native;
  t.mock.method(fs.realpathSync, "native", () => {
    throw Error("unavailable");
  });
  assert.equal(
    dockerContainerConfigurationMatches(f.inspect, f.expected),
    false,
  );
  t.mock.restoreAll();
  assert.equal(fs.realpathSync.native, original);
  const alias = structuredClone(f.inspect);
  (alias.Mounts[0] ?? assert.fail("fixture_mount_missing")).Source = path.join(
    f.directory,
    "workspace",
    "..",
    "workspace",
  );
  assert.equal(dockerContainerConfigurationMatches(alias, f.expected), true);
});

/**
 * 共通inspectから実ID削除・三軸不存在までの順序を確認する。
 * @responsibility 失敗と現在Owner喪失を成功へ丸めない。
 * @trace ERB-IT-004
 * @precondition spawnSyncだけを有限代役へ置換する。
 * @stimulus 正常、各観測残存、remove失敗、構成差、削除直前Owner喪失。
 * @observation 固定argv・順序・返却結果。
 * @oracle inspect→remove→ID→名前→Labelの共同成功だけconfirmed。
 * @cleanup Builtinを復元し自己生成領域だけ回収する。実Dockerなし。
 */
test("共通Container回収は実ID・三軸・現在Ownerを保持する", (t) => {
  const f = fixture(t);
  const calls: string[] = [];
  let fault = "";
  let inspected: unknown = { ...f.inspect, State: { Running: true } };
  const binding = {
    verifyCli: () => "fixture",
    environment: () => Object.freeze({}),
  };
  t.mock.method(
    childProcess,
    "spawnSync",
    (_exe: unknown, args: unknown, options: unknown) => {
      assert.equal(_exe, "fixture");
      assert.ok(Array.isArray(args));
      const argv = args as string[];
      assert.deepEqual(argv.slice(0, 2), [
        "-H",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
      ]);
      const request = argv.slice(2),
        filter = request.at(-1) ?? "";
      const purpose =
        request[1] === "inspect"
          ? "inspect"
          : request[1] === "rm"
            ? "remove"
            : filter.startsWith("id=")
              ? "id"
              : filter.startsWith("name=")
                ? "name"
                : "label";
      calls.push(purpose);
      const o = options as {
        timeout: number;
        maxBuffer: number;
        shell: boolean;
      };
      assert.equal(o.timeout, 10000);
      assert.equal(o.maxBuffer, 64 * 1024);
      assert.equal(o.shell, false);
      if (purpose === "inspect")
        assert.deepEqual(request, ["container", "inspect", f.expected.id]);
      if (purpose === "remove")
        assert.deepEqual(request, [
          "container",
          "rm",
          "--force",
          f.expected.id,
        ]);
      const stdout =
        purpose === "inspect"
          ? fault === "json"
            ? "invalid"
            : JSON.stringify([inspected])
          : fault === purpose
            ? f.expected.id + "\n"
            : "";
      return {
        status: fault === "remove" && purpose === "remove" ? 1 : 0,
        signal: null,
        error: null,
        stdout,
        stderr: "",
      };
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  assert.equal(
    inspectDockerContainer(binding, f.expected)?.runningConfirmed,
    true,
  );
  const minimal = {
    id: f.expected.id,
    name: f.expected.name,
    ownershipLabel: f.expected.ownershipLabel,
  };
  assert.equal(
    inspectDockerContainer(binding, minimal)?.runningConfirmed,
    true,
  );
  inspected = {
    ...f.inspect,
    Config: { ...f.inspect.Config, Image: "different-diagnostic-image" },
  };
  assert.ok(inspectDockerContainer(binding, minimal)?.snapshot);
  assert.equal(inspectDockerContainer(binding, f.expected), null);
  inspected = { ...f.inspect, State: {} };
  assert.equal(
    inspectDockerContainer(binding, minimal)?.runningConfirmed,
    false,
  );
  for (const malformed of [
    { ...minimal, image: "partial" },
    { ...minimal, extra: true },
  ]) {
    const count = calls.length;
    assert.throws(
      () => inspectDockerContainer(binding, malformed),
      /projection_invalid/,
    );
    assert.equal(calls.length, count);
  }
  inspected = { ...f.inspect, State: { Running: true } };
  calls.length = 0;
  assert.equal(cleanupDockerContainer(binding, f.expected).confirmed, true);
  assert.deepEqual(calls, ["inspect", "remove", "id", "name", "label"]);
  for (fault of ["remove", "id", "name", "label", "json"]) {
    calls.length = 0;
    assert.equal(cleanupDockerContainer(binding, f.expected).confirmed, false);
    if (fault === "json") assert.deepEqual(calls, ["inspect"]);
  }
  fault = "";
  calls.length = 0;
  assert.equal(
    cleanupDockerContainer(binding, f.expected, AbortSignal.abort()).confirmed,
    false,
  );
  assert.deepEqual(calls, ["inspect"]);
  inspected = { ...f.inspect, Name: "/other" };
  calls.length = 0;
  assert.equal(cleanupDockerContainer(binding, f.expected).confirmed, false);
  assert.deepEqual(calls, ["inspect"]);
  const target = {
    id: f.expected.id,
    name: f.expected.name,
    ownershipLabel: f.expected.ownershipLabel,
  };
  for (fault of ["id", "name", "label"])
    assert.equal(
      observeDockerContainerAbsence(binding, target).status,
      "blocked",
    );
  fault = "";
  assert.equal(
    observeDockerContainerAbsence(binding, target).status,
    "confirmed",
  );
});

/**
 * 入力捕捉・容量・不正応答を実操作前後で拒否する。
 * @responsibility Proxy・accessor・余剰・後発変更の既存境界を保持する。
 * @trace ERB-IT-004
 * @precondition 有限Process代役のみ。
 * @stimulus 不正構成と可変構成、容量超過・Signal・stderr・非0。
 * @observation 要求数と観測結果。
 * @oracle 不正入力は要求0、後発変更を採用せず観測失敗はnull。
 * @cleanup Builtinを復元し自己生成領域だけ回収する。
 */
test("共通Container観測は動的入力・容量超過を成功化しない", (t) => {
  const f = fixture(t);
  let calls = 0;
  let response = {
    status: 0,
    signal: null as string | null,
    error: null as Error | null,
    stdout: JSON.stringify([f.inspect]),
    stderr: "",
  };
  const mutable = structuredClone(f.expected);
  const binding = {
    verifyCli: () => {
      Object.defineProperty(mutable.commands[0], "1", { value: "changed" });
      return "fixture";
    },
    environment: () => Object.freeze({}),
  };
  t.mock.method(childProcess, "spawnSync", () => {
    calls++;
    return response;
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  for (const value of [
    null,
    {},
    new Proxy(f.expected, {}),
    { ...f.expected, extra: 1 },
    { ...f.expected, id: "bad" },
    { ...f.expected, commands: [] },
  ]) {
    assert.throws(() =>
      inspectDockerContainer(
        binding,
        value as DockerContainerConfigurationExpectation,
      ),
    );
    assert.equal(calls, 0);
  }
  const accessor = { ...f.expected };
  Object.defineProperty(accessor, "image", {
    get() {
      throw Error("getter");
    },
  });
  assert.throws(() => inspectDockerContainer(binding, accessor));
  assert.equal(calls, 0);
  assert.equal(
    inspectDockerContainer(binding, mutable)?.runningConfirmed,
    false,
  );
  for (const patch of [
    { status: 1 },
    { signal: "SIGTERM" },
    { error: Error("failed") },
    { stderr: "warning" },
    { stdout: "x".repeat(64 * 1024 + 1) },
    { stdout: "[]" },
  ]) {
    response = {
      status: 0,
      signal: null,
      error: null,
      stdout: JSON.stringify([f.inspect]),
      stderr: "",
      ...patch,
    };
    assert.equal(inspectDockerContainer(binding, f.expected), null);
  }
});
