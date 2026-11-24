/**
 * 現行隔離資産とAI Adapter構成の相関を確認する。
 *
 * @packageDocumentation
 * @responsibility unknown gate試験の前提となる資産相関だけを検証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope レシピ、Provider設定、ビルド入力の照合値。
 * @boundary REQ-000016由来の構成前提。Local Item全体の成立は主張しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { planExecution } from "../../../ai-adapter/src/index.ts";
import buildInputs from "../../../docker-isolation/images/build-inputs.json" with {
  type: "json",
};
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../../docker-isolation/src/image/assets.ts";

/**
 * CLI位置の注入と固定資産の対応を外部実行なしで反証する。
 * @responsibility 既定CLI名を固定バイナリ依存とせず、Docker構成時の実行位置を一貫させる。
 * @trace ERB-IT-004
 * @precondition 現在Sourceの純粋な計画APIと配置APIを使う。
 * @stimulus Codex両Roleの既定・注入計画、Provider三用途と未知入力を比較する。
 * @observation argv内の実行Path・cd・Schema、Home、固定資産と凍結を確認する。
 * @oracle Pathの片側置換や過去検証の固定値で一致を補完しない。
 * @cleanup N/A: 値生成のみでファイル・Process・Dockerを作成しない。
 * @boundary ERB-IT-004=Integration: AIの引数生成とDocker配置の値境界。
 */
test("CLI計画は配置を外から受け、Docker固定資産とは上位で結合する", () => {
  for (const taskRole of ["executor", "reviewer"] as const) {
    const request = {
      provider: "codex",
      purpose: "task",
      modelSelection: {
        provider: "codex",
        modelIdentifier: "gpt-5.5",
        identifierKind: "exact",
        reasoningEffort: "low",
      },
      input: {
        provider: "codex",
        mode: "isolated_task",
        taskRole,
        effort: "low",
      },
    } as const;
    const neutral = planExecution(request);
    assert.equal(neutral.plan?.command, "codex");
    const locations = {
      commandPath: "/configured/codex",
      workingDirectory: "/configured/work",
      providerHomeDirectory: "/configured/home",
      executorSchemaPath: "/configured/executor.json",
      reviewerSchemaPath: "/configured/reviewer.json",
    };
    const bound = planExecution(request, locations);
    assert.equal(bound.status, "ready");
    if (bound.status !== "ready") assert.fail("location_plan_rejected");
    const plan = bound.plan;
    assert.equal(plan.command, locations.commandPath);
    assert.ok(
      plan.argv.some((value) => value.includes('"/configured/codex"="read"')),
    );
    assert.equal(
      plan.argv[plan.argv.indexOf("--cd") + 1],
      locations.workingDirectory,
    );
    assert.equal(
      plan.argv[plan.argv.indexOf("--output-schema") + 1],
      taskRole === "executor"
        ? locations.executorSchemaPath
        : locations.reviewerSchemaPath,
    );
    assert.equal(plan.environment.CODEX_HOME, locations.providerHomeDirectory);
    for (const key of [
      "fixedImageDigest",
      "distributionBinding",
      "workspaceMountMode",
    ])
      assert.equal(key in plan, false, key);
  }
  for (const provider of ["codex", "claude"] as const) {
    const assets = describeDockerProviderAssets(provider);
    assert.equal(Object.isFrozen(assets), true);
    assert.equal(Object.isFrozen(assets.identity), true);
    assert.deepEqual(
      Object.keys(assets).sort(),
      provider === "codex"
        ? [
            "alternateIdentity",
            "autoUpdateAllowed",
            "fixedDigestImageRequired",
            "fixedImageDigest",
            "identity",
            "proxy",
            "runtimePullAllowed",
          ]
        : [
            "autoUpdateAllowed",
            "fixedDigestImageRequired",
            "fixedImageDigest",
            "identity",
            "proxy",
            "runtimePullAllowed",
          ],
    );
    assert.equal(assets.runtimePullAllowed, false);
    assert.equal(assets.autoUpdateAllowed, false);
    assert.equal(Object.isFrozen(assets.proxy), true);
    assert.equal(assets.proxy.runtimePullAllowed, false);
    assert.equal(assets.proxy.autoUpdateAllowed, false);
    assert.equal(assets.proxy, describeDockerProviderAssets("codex").proxy);
    assert.equal("binarySha256" in assets.identity, false);
    assert.equal("archiveSha256" in assets.identity, false);
    assert.equal("sigstoreBundleSha256" in assets.identity, false);
    assert.equal("fixedImageDigest" in assets.identity, false);
    assert.equal("manifestSignatureVerified" in assets, false);
    for (const profile of (provider === "codex"
      ? ["primary", "alternate"]
      : ["primary"]) as readonly ("primary" | "alternate")[]) {
      const locations = describeDockerProviderExecutionLocations(
        provider,
        profile,
      );
      assert.equal(Object.isFrozen(locations), true);
      const expected =
        provider === "codex" && profile === "alternate"
          ? describeDockerProviderAssets("codex").alternateIdentity
              .executablePath
          : assets.identity.executablePath;
      assert.equal(locations.commandPath, expected);
      assert.equal("fixedImageDigest" in locations, false);
    }
  }
  assert.throws(() => describeDockerProviderAssets("unknown" as "codex"));
  assert.throws(() =>
    describeDockerProviderExecutionLocations("codex", "unknown" as "primary"),
  );
});

const PROVIDER_ASSET_PATHS: Readonly<Record<string, string>> = Object.freeze({
  "claude-managed-settings.json": "src/claude/claude-managed-settings.json",
  "claude-task-settings.json": "src/claude/claude-task-settings.json",
  "codex-result-schema.json": "src/codex/codex-result.json",
  "codex-executor-result-schema.json": "src/codex/codex-executor-result.json",
  "codex-reviewer-result-schema.json": "src/codex/codex-reviewer-result.json",
});

/**
 * 現在Repositoryの対象Sourceを読取る。
 *
 * @responsibility 複製fixtureや過去Sourceを現在実装の根拠にしない。
 * @trace ERB-IT-004
 * @precondition 対象は固定Repository相対Sourceに限定する。
 * @stimulus 現在のFileをUTF-8で読取る。
 * @observation Source本文を返す。
 * @oracle 現在の実Ownerの資産相関を確認できる。
 * @cleanup N/A: 読取りだけ。
 * @boundary 現在Source→資産相関の前提確認。
 */
function source(relative: string) {
  return fs.readFileSync(
    new URL(`../../../../${relative}`, import.meta.url),
    "utf8",
  );
}

/**
 * DockerfileのCOPY契約と各資産Ownerを照合する。
 * @responsibility レシピ所在を暗黙のビルドcontextとして扱う配置回帰を拒否する。
 * @trace ERB-IT-004
 * @precondition 公式CLI本体は起動・取得せずレシピを読む。
 * @stimulus 全COPYのbasename、mode、Container内Pathを抽出する。
 * @observation 固定入力の完全一致と設定Ownerからの読取りを観測する。
 * @oracle 旧basenameと権限を維持し、Provider設定はAI Adapterから供給する。
 * @cleanup N/A: Build・Docker要求・ファイル作成なし。
 * @boundary ERB-IT-004=Integration: 隔離レシピ→Provider資産。
 */
test("Dockerビルド入力は隔離レシピとProvider設定を明示的に組み合わせる", () => {
  const expected: Record<string, readonly string[]> = {
    "codex-provider.Dockerfile": [
      "0:0 0555 codex /opt/crdd/providers/codex/0.164.0/codex",
      "0:0 0555 codex-code-mode-host /opt/crdd/providers/codex/0.164.0/codex-code-mode-host",
      "0:0 0555 bwrap /opt/crdd/providers/codex/0.164.0/codex-resources/bwrap",
      "0:0 0444 codex-result-schema.json /etc/crdd/codex-result-schema.json",
      "0:0 0444 codex-executor-result-schema.json /etc/crdd/codex-executor-result-schema.json",
      "0:0 0444 codex-reviewer-result-schema.json /etc/crdd/codex-reviewer-result-schema.json",
    ],
    "claude-provider.Dockerfile": [
      "0:0 0555 claude /opt/crdd/providers/claude/2.1.310/claude",
      "0:0 0444 claude-managed-settings.json /etc/claude-code/managed-settings.json",
      "0:0 0444 claude-task-settings.json /etc/crdd/claude-task-settings.json",
    ],
    "codex-advice-provider.Dockerfile": [
      "0:0 0555 codex /opt/crdd/providers/codex/0.164.0/codex",
      "0:0 0555 codex-code-mode-host /opt/crdd/providers/codex/0.164.0/codex-code-mode-host",
      "0:0 0555 bwrap /opt/crdd/providers/codex/0.164.0/codex-resources/bwrap",
    ],
    "provider-egress-proxy.Dockerfile": [
      "65534:65534 0444 provider-egress-proxy.py /opt/crdd/provider-egress-proxy.py",
    ],
  };
  for (const [recipe, inputs] of Object.entries(expected)) {
    const text = source(`40_Develop/docker-isolation/images/${recipe}`);
    const copies = Array.from(
      text.matchAll(/^COPY --chown=(\S+) --chmod=(\S+) (\S+) (\S+)\r?$/gmu),
      (match) => match.slice(1).join(" "),
    );
    assert.deepEqual(copies, inputs, recipe);
    const imageCopies = text.match(/^COPY --from=.*$/gmu) ?? [];
    assert.deepEqual(imageCopies, []);
    for (const input of inputs) {
      const basename = input.split(" ")[2];
      if (basename?.endsWith(".json")) {
        const assetPath = PROVIDER_ASSET_PATHS[basename];
        assert.ok(assetPath, basename);
        assert.doesNotThrow(() =>
          JSON.parse(source(`40_Develop/ai-adapter/${assetPath}`)),
        );
      }
    }
  }
});

/**
 * レシピの版・実行先をProvider正本へ照合する。
 * @responsibility Docker側とAI Adapter側の同値を独立した固定値だけで確認しない。
 * @trace ERB-IT-004
 * @precondition descriptorはAI Adapterの公開APIから取得する。
 * @stimulus レシピのCOPY先・ENTRYPOINTと版・実行Pathを比較する。
 * @observation 片側だけの変更によるassertion失敗。
 * @oracle Provider版と実行物配置が同一の宣言に属する。
 * @cleanup N/A: メモリ内の比較だけ。
 * @boundary ERB-IT-004=Integration: AI Adapter宣言→隔離レシピ。
 */
function assertProviderRecipe(
  recipe: string,
  identity: { exactVersion: string; executablePath: string },
  extraExecutables: readonly string[] = [],
) {
  assert.ok(identity.executablePath.includes(`/${identity.exactVersion}/`));
  assert.ok(
    recipe.includes(`ENTRYPOINT ${JSON.stringify([identity.executablePath])}`),
  );
  for (const target of [identity.executablePath, ...extraExecutables]) {
    assert.ok(target.includes(`/${identity.exactVersion}/`));
    assert.ok(
      recipe
        .split(/\r?\n/u)
        .some(
          (line) => line.startsWith("COPY ") && line.endsWith(` ${target}`),
        ),
    );
  }
}

/**
 * 公開Provider宣言と移管資産を相関させる。
 * @responsibility 版、レシピ所在、実行Pathと既存設定Hashを同じOwnerへ結合する。
 * @trace ERB-IT-004
 * @precondition 公開descriptorの取得は外部Effectを持たない。
 * @stimulus 正常相関とレシピ側・descriptor側だけの版／Path変異を比較する。
 * @observation 正常の受理と各変異の拒否、canonical設定bytesのHash。
 * @oracle 新しい宣言fieldを作らず、既存のProvider正本との一致を要求する。
 * @cleanup N/A: Source・資産を書き換えない。
 * @boundary ERB-IT-004=Integration: AI公開契約→実移管資産。
 */
test("隔離レシピはDocker Isolationの実行物とAI設定へ結合する", () => {
  const codex = {
    ...buildInputs.codex.identity,
    ...describeDockerProviderAssets("codex").identity,
  };
  const advice = {
    ...buildInputs.codex.identity,
    ...buildInputs.codex.adviceIdentity,
    ...describeDockerProviderAssets("codex").alternateIdentity,
  };
  const claude = describeDockerProviderAssets("claude");
  const declarations = [
    {
      recipe: codex.imageBuildDefinition,
      name: "codex-provider.Dockerfile",
      identity: codex,
      extra: [codex.hostExecutablePath, codex.bwrapBinaryPath],
    },
    {
      recipe: advice.imageBuildDefinition,
      name: "codex-advice-provider.Dockerfile",
      identity: advice,
      extra: [advice.hostExecutablePath, advice.bwrapBinaryPath],
    },
    {
      recipe: "40_Develop/docker-isolation/images/claude-provider.Dockerfile",
      name: "claude-provider.Dockerfile",
      identity: claude.identity,
      extra: [],
    },
  ];
  for (const declaration of declarations) {
    assert.equal(
      declaration.recipe,
      `40_Develop/docker-isolation/images/${declaration.name}`,
    );
    const recipe = source(declaration.recipe);
    const identity = declaration.identity;
    assertProviderRecipe(recipe, identity, declaration.extra);
    assert.throws(
      () =>
        assertProviderRecipe(
          recipe.replaceAll(`/${identity.exactVersion}/`, "/0.0.0-invalid/"),
          identity,
          declaration.extra,
        ),
      assert.AssertionError,
    );
    assert.throws(
      () =>
        assertProviderRecipe(
          recipe,
          { ...identity, exactVersion: "0.0.0-invalid" },
          declaration.extra,
        ),
      assert.AssertionError,
    );
    assert.throws(
      () =>
        assertProviderRecipe(
          recipe,
          { ...identity, executablePath: `${identity.executablePath}-other` },
          declaration.extra,
        ),
      assert.AssertionError,
    );
  }
  assert.equal(
    describeDockerProviderExecutionLocations("claude", "primary").commandPath,
    claude.identity.executablePath,
  );
  for (const [name, expected] of [
    ["claude-managed-settings.json", buildInputs.claude.managedSettingsSha256],
    ["claude-task-settings.json", buildInputs.claude.taskSettingsSha256],
    ["codex-result-schema.json", codex.resultSchemaSha256],
    ["codex-executor-result-schema.json", codex.executorSchemaSha256],
    ["codex-reviewer-result-schema.json", codex.reviewerSchemaSha256],
  ] as const) {
    const assetPath = PROVIDER_ASSET_PATHS[name];
    assert.ok(assetPath, name);
    const bytes = Buffer.from(
      source(`40_Develop/ai-adapter/${assetPath}`).replace(/\r\n/gu, "\n"),
      "utf8",
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expected,
      name,
    );
  }
});

/**
 * ビルド手順が参照する固定レシピと公式実行物の期待値を照合する。
 * @trace ERB-IT-004
 * @stimulus 実Dockerfileのbytesと、両Providerの入力定義を読み取る。
 * @oracle Codexの両レシピが期待Hashと一致し、公式実行物のサイズ・HashとClaude Manifestの対象が一致する。
 * @cleanup N/A: 固定資産の読取りだけを行う。
 * @boundary 公式配布物を取得せず、実Buildや手動作業の成功は証明しない。
 */
test("Providerイメージのビルド入力は固定レシピと期待値を持つ", () => {
  const codex = buildInputs.codex.identity;
  const claude = buildInputs.claude.identity;
  const claudeVersion =
    describeDockerProviderAssets("claude").identity.exactVersion;
  assert.equal(claude.targetPlatform, "linux-x64");
  assert.equal(
    claude.manifestUrl,
    `https://downloads.claude.ai/claude-code-releases/${claudeVersion}/manifest.json`,
  );
  for (const recipe of [codex, buildInputs.codex.adviceIdentity]) {
    const bytes = fs.readFileSync(
      new URL(`../../../../${recipe.imageBuildDefinition}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      recipe.imageBuildDefinitionSha256,
      recipe.imageBuildDefinition,
    );
  }
  for (const [name, size, hash] of [
    ["codex", codex.binaryBytes, codex.binarySha256],
    ["codex-code-mode-host", codex.hostBinaryBytes, codex.hostBinarySha256],
    ["bwrap", codex.bwrapBinaryBytes, codex.bwrapBinarySha256],
    ["claude", claude.binaryBytes, claude.binarySha256],
  ] as const) {
    assert.ok(Number.isSafeInteger(size) && size > 0, name);
    assert.match(hash, /^[a-f0-9]{64}$/u, name);
  }
});
