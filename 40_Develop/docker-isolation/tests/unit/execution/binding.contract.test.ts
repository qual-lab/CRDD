/**
 * 初回構築と開始前再照合の正規構成を反証する。
 * @packageDocumentation
 * @responsibility 共通構築の両方式とToken・Digest・Mount差を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 合成CLI・所在・Tokenだけ。Docker・Process・外部AIなし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../domain-model/tests/support/source-declaration.ts";
import {
  bindProviderCommand,
  describeDockerProviderAssets,
  describeDockerProxyTopology,
  planDockerIsolationCommands,
  dockerIsolationCommandsMatch,
  type ProviderCommandBinding,
} from "../../../src/index.ts";

/**
 * 両Provider・三用途で同じ構成を再生成する。
 * @responsibility 構築と照合でImage・Mount・Proxy条件を分岐させない。
 * @trace ERB-UT-023
 * @precondition 固定Digestと合成入力だけを使用する。
 * @stimulus createとverify、不正Token・Digest・Role・Command差を照合する。
 * @observation 正規構成と九Commandの一致、拒否時null。
 * @oracle 正常な同構成だけ再現し、差替えを完全一致へ昇格しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary Docker技術構成。Authority原本の拒否はExecutor側の既存試験で確認。
 */
test("Provider結合は両方式で一つの規則を使い、部分Token差と技術条件差を拒否する", () => {
  const source = readFileSync(
    new URL("../../../src/execution/binding.ts", import.meta.url),
    "utf8",
  );
  const preparation = readFileSync(
    new URL("../../../../executor/src/attempt/execute.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    preparation,
    /fixedDigestImageRequired|providerNetworkInternal|providerDirectExternalNetwork|proxyNetworks\.length/,
  );
  for (const provider of ["codex", "claude"] as const)
    for (const purpose of ["probe", "advice", "task"] as const) {
      const assets = describeDockerProviderAssets(provider);
      const input: ProviderCommandBinding = {
        provider,
        purpose,
        role: purpose === "task" ? "reviewer" : null,
        execution: { provider, argv: ["--version"], environment: {} },
        authentication: {
          argv: ["auth", "status"],
          homeEnvironmentVariable: provider === "codex" ? "CODEX_HOME" : null,
        },
        resources: {
          authenticationContainerName: "crdd-auth-0101010101010101",
          executionContainerName: `crdd-${provider}-0101010101010101`,
          proxyContainerName: "crdd-proxy-0101010101010101",
          internalNetworkName: "crdd-internal-0101010101010101",
          egressNetworkName: "crdd-egress-0101010101010101",
          ownershipLabel: "crdd.coordinator.runtime=0101010101010101",
          executionImageDigest:
            purpose === "advice" && provider === "codex"
              ? describeDockerProviderAssets("codex").adviceIdentity
                  .fixedImageDigest
              : assets.fixedImageDigest,
          proxyImageDigest: describeDockerProxyTopology(provider).imageDigest,
        },
        homeSourcePath: "C:/synthetic/home",
        temporarySourcePath: "C:/synthetic/tmp",
        workspace:
          purpose === "task"
            ? { sourcePath: "C:/synthetic/work", readOnly: true }
            : null,
        networkPolicy: null,
        mode: "create",
        proxyToken: "a".repeat(64),
      };
      const created = bindProviderCommand(input);
      assert.ok(created);
      for (const change of ["image", "internal", "direct", "networks"]) {
        const bind = runInNewContext(
          `${sourceDeclaration(source, "bindProviderCommand")}\nbindProviderCommand`,
          {
            describeDockerProviderAssets: (p: "codex" | "claude") => ({
              ...describeDockerProviderAssets(p),
              ...(change === "image"
                ? { fixedDigestImageRequired: false }
                : {}),
            }),
            describeDockerProxyTopology: (p: "codex" | "claude") => ({
              ...describeDockerProxyTopology(p),
              ...(change === "internal"
                ? { providerNetworkInternal: false }
                : {}),
              ...(change === "direct"
                ? { providerDirectExternalNetwork: true }
                : {}),
              ...(change === "networks" ? { proxyNetworks: [] } : {}),
            }),
          },
        ) as typeof bindProviderCommand;
        assert.equal(bind(input), null, change);
      }
      const commands = planDockerIsolationCommands(created);
      assert.ok(commands);
      const { proxyToken: _token, ...base } = input;
      const verified = bindProviderCommand({
        ...base,
        mode: "verify",
        commands,
      });
      assert.deepEqual(verified, created);
      assert.equal(
        bindProviderCommand({ ...input, proxyToken: "wrong" }),
        null,
      );
      assert.equal(
        bindProviderCommand({
          ...input,
          resources: {
            ...input.resources,
            executionImageDigest: `sha256:${"0".repeat(64)}`,
          },
        }),
        null,
      );
      assert.equal(
        bindProviderCommand({
          ...input,
          mode: "verify",
          commands,
        } as unknown as ProviderCommandBinding),
        null,
      );
      if (purpose === "task")
        assert.equal(
          bindProviderCommand({
            ...input,
            workspace: { sourcePath: "C:/synthetic/work", readOnly: false },
          }),
          null,
        );
      const altered = commands.map((command) => ({
        ...command,
        argv:
          command.purpose === "create_proxy"
            ? command.argv.map((value) =>
                value.replaceAll("a".repeat(64), "b".repeat(64)),
              )
            : command.argv,
      }));
      const mismatch = bindProviderCommand({
        ...base,
        mode: "verify",
        commands: altered,
      });
      assert.ok(mismatch);
      assert.equal(dockerIsolationCommandsMatch(mismatch, altered), false);
      for (const mutation of [
        commands.slice(1),
        [...commands].reverse(),
        commands.map((c, i) =>
          i === 0 ? { ...c, argv: [...c.argv, "--unexpected"] } : c,
        ),
      ]) {
        assert.equal(dockerIsolationCommandsMatch(created, mutation), false);
      }
    }
});
