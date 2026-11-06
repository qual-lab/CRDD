/**
 * 共通資源入口の同期Containerと固定Directory接続を確認する。
 * @responsibility 技術順序・同期性・元Promiseと取消の保持を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 有限依存だけを使用し、Docker・Native・既存保持物は操作しない。
 * @packageDocumentation
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test, { mock } from "node:test";
import { types } from "node:util";
import { runInNewContext } from "node:vm";

/**
 * 移管したContainerの合成順序を実本文で確認する。
 * @responsibility 不存在と不明を区別し、各要求前の取消を維持する。
 * @trace ERB-UT-023
 * @precondition 低位Docker接続は有限代役。
 * @stimulus 不存在・存在・不明・取消。
 * @observation 操作列と返却結果。
 * @oracle 不存在ならinspectせず、取消後は要求0。
 * @cleanup VMのみ。実資源なし。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("Container技術Ownerは三軸不存在を先行し取消後の要求を止める", () => {
  const source = fs.readFileSync(
    new URL("../../src/cleanup/container.ts", import.meta.url),
    "utf8",
  );
  const body = source.slice(
    source.indexOf("export function inspectContainerResources"),
  );
  const calls: string[] = [];
  let absent = false,
    present = true;
  const controller = new AbortController();
  const target = {
    kind: "container",
    configuration: {
      id: "a".repeat(64),
      name: "fixed",
      ownershipLabel: "fixed",
    },
    managementDirectory: "management",
    signal: controller.signal,
  };
  const api = runInNewContext(
    `${stripTypeScriptTypes(body).replaceAll("export ", "")};({inspectContainerResources,cleanupContainerResources})`,
    {
      Object,
      Error,
      types,
      createDockerContainerBinding: (directory: string) => {
        assert.equal(directory, "management");
        return {
          environment: () => ({}),
          verifyCli: () => {
            calls.push("verify");
          },
        };
      },
      observeDockerContainerAbsence: (
        binding: { verifyCli: () => void },
        value: unknown,
      ) => {
        binding.verifyCli();
        assert.equal((value as { id: string }).id, target.configuration.id);
        calls.push("absence");
        return { status: absent ? "confirmed" : "blocked" };
      },
      inspectDockerContainer: (
        binding: { verifyCli: () => void },
        value: unknown,
      ) => {
        binding.verifyCli();
        assert.equal(value, target.configuration);
        calls.push("inspect");
        return present
          ? { runningConfirmed: true, snapshot: { resources: [] } }
          : null;
      },
      cleanupDockerContainer: (
        binding: { verifyCli: () => void },
        value: unknown,
        signal: unknown,
      ) => {
        binding.verifyCli();
        assert.equal(value, target.configuration);
        assert.equal(signal, controller.signal);
        calls.push("cleanup");
        return { confirmed: true, reason: "confirmed" };
      },
    },
  );
  assert.equal(api.inspectContainerResources(target).observation, "present");
  assert.deepEqual(calls, ["verify", "absence", "verify", "inspect"]);
  calls.length = 0;
  absent = true;
  assert.equal(api.inspectContainerResources(target).observation, "absent");
  assert.deepEqual(calls, ["verify", "absence"]);
  absent = false;
  present = false;
  assert.equal(api.inspectContainerResources(target).observation, "unknown");
  calls.length = 0;
  assert.equal(api.cleanupContainerResources(target).confirmed, true);
  assert.deepEqual(calls, ["verify", "cleanup"]);
  controller.abort();
  calls.length = 0;
  assert.throws(() => api.inspectContainerResources(target), {
    name: "AbortError",
  });
  assert.throws(() => api.cleanupContainerResources(target), {
    name: "AbortError",
  });
  assert.deepEqual(calls, []);
});

/**
 * 公開入口が技術対象だけで振り分け元の同期性を保つことを確認する。
 * @responsibility Directory入力・結果・Promiseを包み直さない。
 * @trace ERB-UT-023
 * @precondition 下位の限定操作はModule代役。
 * @stimulus Container・DirectoryとDirectory観測不能。
 * @observation 同じ対象・結果・Promise参照。
 * @oracle 別用途の実行・変換・補完0。
 * @cleanup mock解除。実資源なし。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("DI共通公開入口はContainer同期結果とDirectory元Promiseを保持する", async () => {
  const container = await import("../../src/cleanup/container.ts");
  const directory = await import("../../src/docker-desktop/repair-session.ts");
  const inspected = Object.freeze({
    observation: "unknown",
    runningConfirmed: false,
    snapshot: null,
  });
  const cleaned = Object.freeze({ confirmed: false, reason: "unconfirmed" });
  const input = Object.freeze({ synthetic: true });
  const pending = Promise.resolve(
    Object.freeze({ request: "unknown", absence: "unknown" }),
  );
  const target = {
    kind: "container",
    configuration: {},
    managementDirectory: "unused",
  };
  const first = mock.module(
    new URL("../../src/cleanup/container.ts", import.meta.url).href,
    {
      namedExports: {
        ...container,
        inspectContainerResources: (value: unknown) => {
          assert.equal(value, target);
          return inspected;
        },
        cleanupContainerResources: (value: unknown) => {
          assert.equal(value, target);
          return cleaned;
        },
      },
    },
  );
  const second = mock.module(
    new URL("../../src/docker-desktop/repair-session.ts", import.meta.url).href,
    {
      namedExports: {
        ...directory,
        observeRepairDirectories: (value: unknown) => {
          assert.equal(value, input);
          return null;
        },
        cleanupRepairDirectory: (value: unknown) => {
          assert.equal(value, input);
          return pending;
        },
      },
    },
  );
  try {
    const api = await import("../../src/index.ts");
    assert.equal(api.inspectIsolation(target as never), inspected);
    assert.equal(api.cleanupIsolation(target as never), cleaned);
    assert.equal(
      api.inspectIsolation({
        kind: "docker_runtime_directory",
        input,
      } as never),
      null,
    );
    assert.equal(
      api.cleanupIsolation({
        kind: "docker_runtime_directory",
        input,
      } as never),
      pending,
    );
    assert.equal(
      await pending,
      await api.cleanupIsolation({
        kind: "docker_runtime_directory",
        input,
      } as never),
    );
  } finally {
    second.restore();
    first.restore();
  }
});
