/**
 * 用途固有構成の検査がExecutorへ移管されたことを確認する。
 * @packageDocumentation
 * @responsibility 固定Image・Role・Mount・Policy・Tokenの拒否を新Ownerで反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 合成入力と有限metadata代役のみ。Docker・Process・外部AIなし。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  getAuthenticationDefinition,
  resolveModelSelection,
} from "../../../ai-adapter/src/index.ts";
import { prepareProviderEnvironment } from "../../../ai-adapter/src/provider/validation.ts";
import { describeIsolationConfiguration } from "../../../docker-isolation/src/index.ts";
import {
  dockerIsolationCommandsMatch,
  planDockerIsolationCommands,
} from "../../../docker-isolation/tests/support/execution-plan.ts";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import type { TestAttemptPlan } from "../../scripts/executor-test.ts";
import {
  prepareAttempt,
  resolveIsolationCommandInput,
  resolveProviderExecution,
} from "../../scripts/executor-test.ts";
import { attemptPlan, attemptTarget } from "../fixtures/attempt-plan.ts";

/**
 * 旧DI結合処理の正負条件をExecutorの本番構築で確認する。
 * @responsibility 三用途の選択と技術固定条件を分離しても拒否を欠落させない。
 * @trace ERB-UT-023
 * @precondition 固定Catalogと合成所在・Tokenを使用する。
 * @stimulus 両Provider・三用途、Role・Image・Policy・Token・Command差を渡す。
 * @observation 初回構成と元Commandから再取得した構成、拒否時null。
 * @oracle 同じ構成だけ再現し、不正な用途相関と部分差替えは拒否する。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary Executorの用途構築とDIのargv Compiler。
 */
test("用途構成はExecutorで一意に結合し固定条件差を拒否する", () => {
  const temporary = "C:/synthetic/tmp";
  const source = readFileSync(
    new URL("../../src/lifecycle/attempt.ts", import.meta.url),
    "utf8",
  );
  for (const provider of ["codex", "claude"] as const) {
    const synthetic = attemptPlan();
    const original = prepareAttempt(
      { randomBytes: (size) => Buffer.alloc(size, 1) },
      {
        kind: "attempt",
        purpose: "probe",
        selection: {
          ...synthetic.executionSelection,
          provider,
          modelIdentifier: provider === "codex" ? "gpt-5.5" : "opus",
          identifierKind: provider === "codex" ? "exact" : "alias",
        },
        target: {
          ...attemptTarget(synthetic, "C:/synthetic/work", temporary),
          provider,
        },
      },
    );
    assert.ok(original);
    for (const purpose of ["probe", "advice", "task"] as const) {
      const catalog = describeIsolationConfiguration(provider);
      const chosen = resolveModelSelection({
        provider,
        modelIdentifier:
          provider === "codex" && purpose === "advice"
            ? "gpt-5.6-sol"
            : original.executionSelection.modelIdentifier,
        reasoningEffort: "low",
        purpose: purpose === "advice" ? "advice" : "task",
      });
      assert.equal(chosen.status, "resolved");
      if (chosen.status !== "resolved") throw Error("fixture");
      const plan: TestAttemptPlan = {
        ...original,
        operationMode:
          purpose === "task"
            ? "isolated_task"
            : purpose === "advice"
              ? "workbench_advice"
              : "boolean_probe",
        executionSelection: chosen.value,
        providerImageDigest:
          purpose === "advice" && provider === "codex"
            ? describeIsolationConfiguration("codex").assets.alternateIdentity
                .fixedImageDigest
            : catalog.assets.fixedImageDigest,
        taskRole: purpose === "task" ? "reviewer" : null,
        taskWorkload: {
          readPathCount: 1,
          allowedPathCount: 1,
          acceptanceCriterionCount: 1,
          remediationFindingCount: 0,
        },
        providerInput: purpose === "probe" ? null : "synthetic",
        adviceAllowedReferences:
          purpose === "advice" ? ["synthetic-reference"] : null,
        workspaceSourcePath: purpose === "task" ? "C:/synthetic/work" : null,
        workspaceMountMode: purpose === "task" ? "read_only" : null,
      };
      const created = resolveIsolationCommandInput(
        plan,
        temporary,
        "a".repeat(64),
      );
      assert.ok(created, `${provider}/${purpose}`);
      const commands = planDockerIsolationCommands(created);
      assert.ok(commands);
      const captured = { ...plan, commands };
      assert.deepEqual(
        resolveIsolationCommandInput(captured, temporary),
        created,
      );
      assert.equal(
        resolveIsolationCommandInput(plan, temporary, "wrong"),
        null,
      );
      for (const change of [
        { providerImageDigest: `sha256:${"0".repeat(64)}` },
        { proxyImageDigest: `sha256:${"0".repeat(64)}` },
        { operationMode: "unsupported" },
        {
          additionalHosts: {
            provider: provider === "codex" ? "claude" : "codex",
          },
        },
        purpose === "task"
          ? { workspaceMountMode: "read_write" }
          : { workspaceSourcePath: "C:/synthetic/work" },
        purpose === "task" ? { taskRole: null } : { taskRole: "reviewer" },
      ]) {
        assert.equal(
          resolveIsolationCommandInput(
            { ...plan, ...change } as TestAttemptPlan,
            temporary,
            "a".repeat(64),
          ),
          null,
        );
      }
      const execution = resolveProviderExecution(plan);
      assert.ok(execution);
      assert.equal(
        resolveIsolationCommandInput(plan, temporary, "a".repeat(64), {
          ...execution,
          provider: provider === "codex" ? "claude" : "codex",
        } as typeof execution),
        null,
      );
      for (const change of ["image"]) {
        const resolve = runInNewContext(
          `${sourceDeclaration(source, "resolveIsolationCommandInput")}\nresolveIsolationCommandInput`,
          {
            prepareProviderEnvironment,
            getAuthenticationDefinition,
            describeIsolationConfiguration: (p: "codex" | "claude") => {
              const value = describeIsolationConfiguration(p);
              return {
                ...value,
                assets: {
                  ...value.assets,
                  ...(change === "image"
                    ? { fixedDigestImageRequired: false }
                    : {}),
                },
                proxy: {
                  ...value.proxy,
                  ...(change === "internal"
                    ? { providerNetworkInternal: false }
                    : {}),
                  ...(change === "direct"
                    ? { providerDirectExternalNetwork: true }
                    : {}),
                  ...(change === "networks" ? { proxyNetworks: [] } : {}),
                },
              };
            },
          },
        ) as typeof resolveIsolationCommandInput;
        assert.equal(
          resolve(plan, temporary, "a".repeat(64), execution),
          null,
          change,
        );
      }
      const altered = commands.map((command) => ({
        ...command,
        argv:
          command.purpose === "create_proxy"
            ? command.argv.map((value) =>
                value.replaceAll("a".repeat(64), "b".repeat(64)),
              )
            : command.argv,
      }));
      const mismatch = resolveIsolationCommandInput(
        { ...plan, commands: altered } as TestAttemptPlan,
        temporary,
      );
      assert.ok(mismatch);
      assert.equal(dockerIsolationCommandsMatch(mismatch, altered), false);
      for (const mutation of [
        commands.slice(1),
        [...commands].reverse(),
        commands.map((c, i) =>
          i === 0 ? { ...c, argv: [...c.argv, "--unexpected"] } : c,
        ),
      ])
        assert.equal(dockerIsolationCommandsMatch(created, mutation), false);
    }
  }
});
