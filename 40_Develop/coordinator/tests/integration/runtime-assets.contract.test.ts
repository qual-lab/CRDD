/**
 * 現行隔離資産とAI Adapter構成の相関を確認する。
 *
 * @packageDocumentation
 * @responsibility unknown gate試験の前提となる資産相関だけを検証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope レシピ、Provider設定、助言Image準備の三入力搬送。
 * @boundary REQ-000016由来の構成前提。Local Item全体の成立は主張しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describeDockerProviderAssets } from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";

import buildInputs from "../../../docker-isolation/images/build-inputs.json" with {
  type: "json",
};

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
      input: {
        provider: "codex",
        mode: "isolated_task",
        taskRole,
        effort: "low",
      },
    } as const;
    const neutral = planProviderExecution(request);
    assert.equal(neutral.plan?.command, "codex");
    const locations = {
      commandPath: "/configured/codex",
      workingDirectory: "/configured/work",
      providerHomeDirectory: "/configured/home",
      executorSchemaPath: "/configured/executor.json",
      reviewerSchemaPath: "/configured/reviewer.json",
    };
    const bound = planProviderExecution(request, locations);
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
            "adviceIdentity",
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
    for (const purpose of ["probe", "task", "advice"] as const) {
      const locations = describeDockerProviderExecutionLocations(
        provider,
        purpose,
      );
      assert.equal(Object.isFrozen(locations), true);
      const expected =
        provider === "codex" && purpose === "advice"
          ? describeDockerProviderAssets("codex").adviceIdentity.executablePath
          : assets.identity.executablePath;
      assert.equal(locations.commandPath, expected);
      assert.equal("fixedImageDigest" in locations, false);
    }
  }
  assert.throws(() => describeDockerProviderAssets("unknown" as "codex"));
  assert.throws(() =>
    describeDockerProviderExecutionLocations("codex", "unknown" as "task"),
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
 * 固定Sourceの一つの関数本体をそのまま取得する。
 * @responsibility 試験がProductionと別の収集実装を作ることを防ぐ。
 * @trace ERB-IT-004
 * @precondition 対象は改行で閉じる名前付き関数である。
 * @stimulus 固定名の宣言開始と最上位の閉括弧を取得する。
 * @observation 型除去前の実関数Source。
 * @oracle 未発見や曖昧な切出しで試験を進めない。
 * @cleanup N/A: メモリ上の文字列処理だけ。
 * @boundary ERB-IT-004=Integration: 現在Source→限定VM。
 */
function actualFunction(text: string, name: string) {
  const start = text.indexOf(`function ${name}(`);
  const end = text.indexOf("\n}", start) + 2;
  assert.ok(start >= 0 && end > start, name);
  return text.slice(start, end);
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
      "65534:65534 0555 codex /opt/crdd/providers/codex/0.149.1/codex",
      "65534:65534 0555 bwrap /opt/crdd/providers/codex/0.149.1/codex-resources/bwrap",
      "0:0 0444 codex-result-schema.json /etc/crdd/codex-result-schema.json",
      "0:0 0444 codex-executor-result-schema.json /etc/crdd/codex-executor-result-schema.json",
      "0:0 0444 codex-reviewer-result-schema.json /etc/crdd/codex-reviewer-result-schema.json",
    ],
    "claude-provider.Dockerfile": [
      "65534:65534 0555 claude /opt/crdd/providers/claude/2.1.220/claude",
      "0:0 0444 claude-managed-settings.json /etc/claude-code/managed-settings.json",
      "0:0 0444 claude-task-settings.json /etc/crdd/claude-task-settings.json",
    ],
    "codex-advice-provider.Dockerfile": [
      "0:0 0555 codex /opt/crdd/providers/codex/0.159.2/codex",
      "0:0 0555 codex-code-mode-host /opt/crdd/providers/codex/0.159.2/codex-code-mode-host",
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
    assert.deepEqual(
      imageCopies,
      recipe === "codex-advice-provider.Dockerfile"
        ? [
            "COPY --from=crdd-codex@sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c --chown=0:0 --chmod=0555 /opt/crdd/providers/codex/0.149.1/codex-resources/bwrap /opt/crdd/providers/codex/0.159.2/codex-resources/bwrap",
          ]
        : [],
    );
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
  const preparation = source(
    "40_Develop/coordinator/scripts/prepare-codex-advice-image.ts",
  );
  assert.ok(
    preparation.includes(
      "40_Develop/docker-isolation/images/codex-advice-provider.Dockerfile",
    ),
  );
  assert.ok(preparation.includes('name: "codex-code-mode-host"'));
  assert.ok(preparation.includes('path.join(context, "Dockerfile")'));
  assert.doesNotMatch(preparation, /coordinator\/runtime/u);
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
    ...buildInputs.codex.adviceIdentity,
    ...describeDockerProviderAssets("codex").adviceIdentity,
  };
  const claude = describeDockerProviderAssets("claude");
  const declarations = [
    {
      recipe: codex.imageBuildDefinition,
      name: "codex-provider.Dockerfile",
      identity: codex,
      extra: [codex.bwrapBinaryPath],
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
    describeDockerProviderExecutionLocations("claude", "task").commandPath,
    claude.identity.executablePath,
  );
  for (const [name, expected] of [
    ["claude-managed-settings.json", buildInputs.claude.managedSettingsSha256],
    ["claude-task-settings.json", buildInputs.claude.taskSettingsSha256],
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
 * 助言Image準備の実関数を入力搬送に限定して観測する。
 * @responsibility レシピの取得先変更が三入力contextへ実bytesを届けることを確認する。
 * @trace ERB-IT-004
 * @precondition binary検証の既知Hashは仮依存とし、公式配布検証の根拠には使わない。
 * @stimulus 実prepare本体へ仮binaryと実recipeを渡し書込みをメモリで捕捉する。
 * @observation 出力3名、各bytes、Build・Provider要求の非発行。
 * @oracle 元資産をコピーした別実装でなく実本体が実recipeを搬送する。
 * @cleanup N/A: メモリFSだけを書き換える。
 * @boundary ERB-IT-004=Integration: 実準備本体→三入力context。
 */
test("助言Imageの実準備本体は公式入力二件と移管レシピだけを搬送する", () => {
  const relative =
    "40_Develop/coordinator/scripts/prepare-codex-advice-image.ts";
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const script = source(relative);
  const body = actualFunction(script, "prepareCodexAdviceImage").replaceAll(
    "import.meta.url",
    JSON.stringify(new URL(`../../../../${relative}`, import.meta.url).href),
  );
  const binary = path.join(root, ".crdd", "tmp", "fixed-codex-input");
  const host = path.join(root, ".crdd", "tmp", "fixed-host-input");
  const recipePath = path.join(
    root,
    "40_Develop",
    "docker-isolation",
    "images",
    "codex-advice-provider.Dockerfile",
  );
  const recipe = fs.readFileSync(recipePath);
  const codexBytes = Buffer.from("fixture-codex");
  const hostBytes = Buffer.from("fixture-host");
  const written = new Map<string, Buffer>();
  const output = path.join(root, ".crdd", "tmp", "codex-advice-image-fixture");
  const run = runInNewContext(
    `${stripTypeScriptTypes(body)}; prepareCodexAdviceImage`,
    {
      buildInputs,
      path,
      fileURLToPath,
      Buffer,
      verifyRepositoryRoot: () => ({ status: "completed", capability: {} }),
      ensureRepositoryRuntimeDataArea: () => ({}),
      requireReadyRepositoryRuntimeDataArea: () => ({
        directory: path.dirname(output),
      }),
      createHash: () => ({
        update: (bytes: Buffer) => ({
          digest: () =>
            bytes === codexBytes
              ? "1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e"
              : bytes === hostBytes
                ? "5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03"
                : "unexpected",
        }),
      }),
      fs: {
        realpathSync: { native: (target: string) => target },
        lstatSync: (target: string) => ({
          isFile: () => target === binary || target === host,
          isSymbolicLink: () => false,
          size: target === binary ? 286754152 : 74068880,
        }),
        readFileSync: (target: string) => {
          if (target === binary) return codexBytes;
          if (target === host) return hostBytes;
          assert.equal(target, recipePath);
          return fs.readFileSync(target);
        },
        mkdtempSync: (prefix: string) => {
          assert.equal(
            prefix,
            path.join(path.dirname(output), "codex-advice-image-"),
          );
          return output;
        },
        writeFileSync: (
          target: string,
          bytes: Buffer,
          options: { flag: string },
        ) => {
          assert.equal(path.dirname(target), output);
          assert.equal(options.flag, "wx");
          assert.equal(written.has(path.basename(target)), false);
          written.set(path.basename(target), Buffer.from(bytes));
        },
      },
    },
  ) as (
    codex: string,
    host: string,
  ) => { dockerBuildPerformed: boolean; providerRequestIssued: boolean };
  const result = run(binary, host);
  assert.deepEqual([...written.keys()].sort(), [
    "Dockerfile",
    "codex",
    "codex-code-mode-host",
  ]);
  assert.deepEqual(written.get("codex"), codexBytes);
  assert.deepEqual(written.get("codex-code-mode-host"), hostBytes);
  assert.deepEqual(written.get("Dockerfile"), recipe);
  assert.equal(result.dockerBuildPerformed, false);
  assert.equal(result.providerRequestIssued, false);
});
