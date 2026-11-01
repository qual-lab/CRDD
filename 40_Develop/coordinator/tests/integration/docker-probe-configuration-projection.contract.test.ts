/**
 * 旧固定Probe回復のExecutor接続を確認する。
 * @packageDocumentation
 * @responsibility 正式回復入口から技術手順を撤去し同じ元構成・Owner・IDを渡す。
 * @trace ERB-IT-004
 * @level IT
 * @scope 有限Host／Executor代役。実Docker・実AIなし。
 * @boundary 回復記録→Coordinator→既存Executor資源入口。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration as functionSource } from "../../../domain-model/tests/support/source-declaration.ts";
import {
  describeDockerProbeConfiguration,
  type DockerContainerConfigurationExpectation,
} from "../../../docker-isolation/src/index.ts";

/**
 * 構成不明の回復対象は同じ参照を残して停止する。
 * @responsibility 元記録・六候補・Ownerを既存資源APIへ渡す。
 * @trace ERB-IT-004
 * @precondition 正式回復の実本文と有限依存を使用する。
 * @stimulus 現在世代でunknown観測を返す。
 * @observation 元ID・構成・処置回数・返却参照。
 * @oracle unknownでは削除0、元回復参照を保持。
 * @cleanup VMの終了だけ。実資源なし。
 */
test("旧record回復は六候補をExecutorへ渡し不明時に削除しない", () => {
  const s = fs.readFileSync(
    new URL("../../src/execution/diagnostics.ts", import.meta.url),
    "utf8",
  );
  const body = functionSource(s, "recoverDockerIsolationProbe");
  assert.doesNotMatch(
    body,
    /createDockerProbeRuntimeBinding|inspectDockerContainer|cleanupDockerContainer/u,
  );
  const nonce = "123e4567-e89b-42d3-a456-426614174000",
    rootName = "crdd-coordinator-doctor-" + nonce;
  const root = path.resolve(".crdd/tests", rootName),
    id = "a".repeat(64),
    probeId = "old-probe";
  const mounts = {
    workspace: path.join(root, "workspace"),
    providerHome: path.join(root, "provider-home"),
    tmp: path.join(root, "tmp"),
    management: path.join(root, "management"),
  };
  let inspected = 0;
  const recover = runInNewContext(
    `(()=>{${body};return recoverDockerIsolationProbe})()`,
    {
      Object,
      path,
      fs: { realpathSync: (v: string) => v },
      parseDockerProbeRecoveryToken: () => ({ rootName }),
      acquireHostOperationRecoveryGenerationByIdentity: () => ({}),
      releaseHostOperationRecoveryGeneration: () => true,
      loadDockerProbeRecoveryRecord: () => ({
        record: {
          hostRecoveryId: "host",
          container: { id },
          probeId,
          rootName,
        },
        parsed: { rootName },
        root,
        children: mounts,
      }),
      parseHostRecoveryToken: () => ({ rootName, nonce }),
      requireDockerProbeRecoveryMounts: () => mounts,
      verifyHostOperationRecoveryGeneration: () => {},
      describeDockerProbeConfiguration: (
        profile: Parameters<typeof describeDockerProbeConfiguration>[0],
        id: Parameters<typeof describeDockerProbeConfiguration>[1],
        m: Parameters<typeof describeDockerProbeConfiguration>[2],
      ) =>
        describeDockerProbeConfiguration(
          profile,
          structuredClone(id),
          structuredClone(m),
        ),
      inspectResources: (target: {
        configuration: DockerContainerConfigurationExpectation;
      }) => {
        assert.equal(Object.hasOwn(target, "assertOwner"), false);
        assert.equal(target.configuration.id, id);
        assert.equal(
          target.configuration.name,
          "crdd-coordinator-probe-" + probeId,
        );
        assert.equal(target.configuration.commands.length, 6);
        inspected++;
        return { observation: "unknown", runningConfirmed: false };
      },
      cleanupResources: () => {
        throw Error("unexpected_cleanup");
      },
      normalizeFailure: () => "unexpected_failure",
    },
  ) as (token: string, root: string) => unknown;
  assert.deepEqual(JSON.parse(JSON.stringify(recover("old-token", root))), {
    status: "blocked",
    reason: "docker_recovery_container_mismatch",
    recoveryId: "old-token",
  });
  assert.equal(inspected, 1);
});
