/**
 * coordinator:integration:development-native-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:development-native-observationが所有する検証責務を実行する。
 * @trace ERB-IT-004
 * @level IT
 * @scope development、native、observation
 * @boundary ERB-IT-004=Direct Boundary: Observer→Effect Gate
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { observeProviderHome } from "../../../executor/scripts/provider-home.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "../../src/execution/authority.ts";

test("開発実行はNativeなしでも元SourceとGitの前後一致を要求する", () => {
  const source = readFileSync(
    new URL("../../src/execution/diagnostics.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("platform-access/src"), false);
  const body = stripTypeScriptTypes(
    sourceDeclaration(source, "observeProduction"),
  );
  for (const scenario of [
    "normal",
    "revision",
    "tree",
    "source",
    "missing_source",
    "git_changed",
  ]) {
    const sourceObservations = new WeakMap<object, object>();
    let reads = 0;
    const repository = { revisionIdentity: "commit", snapshotIdentity: "tree" };
    const observe = runInNewContext(`(${body})`, {
      getRepository: () => ({ capability: {} }),
      readRepositorySnapshot: () => {
        reads++;
        return scenario === "git_changed" && reads === 2
          ? { ...repository, snapshotIdentity: "other" }
          : repository;
      },
      observeRuntimeOwnedDevelopmentSource: () =>
        scenario === "missing_source"
          ? null
          : {
              sourceSha256: "source",
              sourceIdentitySha256: "physical",
              scope: "scope",
            },
      sourceObservations,
      digest: JSON.stringify,
    }) as (input: object) => object | null;
    const result = observe({
      repositoryRoot: "root",
      expectedCommit: scenario === "revision" ? "other" : "commit",
      expectedTree: scenario === "tree" ? "other" : "tree",
      expectedSourceSha256: scenario === "source" ? "other" : "source",
    });
    if (scenario === "normal") {
      assert.ok(result);
      assert.equal(reads, 2);
      assert.equal(Object.hasOwn(result, "nativeIdentitySha256"), false);
      assert.deepEqual(
        JSON.parse(JSON.stringify(sourceObservations.get(result))),
        { scope: "scope", expectedSourceSha256: "source" },
      );
    } else assert.equal(result, null, scenario);
  }
});

test("Provider HomeはNode実体を観測し内容更新を許し旧LockとLinkを拒否する", {
  skip: process.platform !== "win32",
}, () => {
  const fixture = createRepositoryTestDirectory("provider-home-node-");
  const previous = process.env.LOCALAPPDATA;
  const parent = path.join(fixture.path, "Qual-Lab", "CRDD", "ProviderHomes");
  const home = path.join(parent, "codex");
  const other = path.join(parent, "claude");
  try {
    process.env.LOCALAPPDATA = fixture.path;
    mkdirSync(home, { recursive: true });
    mkdirSync(other);
    const first = inspectRuntimeOwnedWindowsProviderHomeCandidate("codex");
    assert.equal(first.status, "candidate");
    assert.equal(first.processEffectIssued, false);
    assert.equal(first.helperSpawnAttempts, 0);
    assert.equal("providerHomeProtectionHash" in first, false);
    assert.equal("localUserBindingHash" in first, false);
    const observed = consumeRuntimeOwnedProviderHomeObservationCapability(
      first.observationCapability,
    );
    assert.ok(observed);
    for (const candidate of [home, home.toUpperCase()]) {
      const standalone = observeProviderHome("codex", candidate);
      assert.equal(standalone.status, "candidate");
      assert.equal(
        standalone.providerHomeIdentityHash,
        observed.providerHomeIdentityHash,
      );
      assert.equal(
        standalone.stableLogicalHomeBindingHash,
        observed.stableLogicalHomeBindingHash,
      );
    }
    writeFileSync(path.join(home, "non-secret-fixture.txt"), "updated");
    const updated = inspectRuntimeOwnedWindowsProviderHomeCandidate("codex");
    const current = consumeRuntimeOwnedProviderHomeObservationCapability(
      updated.observationCapability,
    );
    assert.ok(current);
    assert.equal(
      current.providerHomeIdentityHash,
      observed.providerHomeIdentityHash,
    );
    assert.equal(
      current.stableLogicalHomeBindingHash,
      observed.stableLogicalHomeBindingHash,
    );
    const claude = inspectRuntimeOwnedWindowsProviderHomeCandidate("claude");
    const separate = consumeRuntimeOwnedProviderHomeObservationCapability(
      claude.observationCapability,
    );
    assert.ok(separate);
    assert.notEqual(
      separate.stableLogicalHomeBindingHash,
      current.stableLogicalHomeBindingHash,
    );
    const priorLock = path.join(
      parent,
      `executor.provider-home.${"a".repeat(64)}.lock`,
    );
    writeFileSync(priorLock, "unresolved-fixture");
    assert.equal(
      inspectRuntimeOwnedWindowsProviderHomeCandidate("codex").reason,
      "provider_home_prior_lock_unresolved",
    );
    assert.equal(readFileSync(priorLock, "utf8"), "unresolved-fixture");
    assert.equal(observeProviderHome("codex", home).status, "blocked");
    rmSync(priorLock);
    const saved = path.join(parent, "saved-codex");
    renameSync(home, saved);
    symlinkSync(saved, home, "junction");
    assert.equal(
      inspectRuntimeOwnedWindowsProviderHomeCandidate("codex").status,
      "blocked",
    );
    rmSync(home);
    writeFileSync(home, "not-directory");
    assert.equal(
      inspectRuntimeOwnedWindowsProviderHomeCandidate("codex").status,
      "blocked",
    );
    rmSync(home);
    assert.equal(
      inspectRuntimeOwnedWindowsProviderHomeCandidate("codex").status,
      "blocked",
    );
  } finally {
    if (previous === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous;
    fixture.cleanup();
  }
});

/**
 * 実Source観測本文をRepository内の自己生成Fixtureへ結合する。
 *
 * @responsibility 公開Root注入口を増やさず、実Filesystemの反例を確認する。
 * @trace ERB-IT-004
 * @precondition 現行Source本文を読める。
 * @stimulus 固定10対象Packageと対象外の旧Coordinator一Directoryを最小Sourceで構成し、試験コピーのRoot定数だけを置き換える。
 * @observation 実本文の観測結果と自己生成Root。
 * @oracle 呼出し元が内容Hash・実体Hash・拒否を比較できる。
 * @cleanup 呼出し元のfinallyで自己生成Rootだけを削除する。
 * @boundary Node Filesystem。Docker・Native実行・外部AIには到達しない。
 */
async function createSourceObservationFixture(readMutation = "") {
  const directory = createRepositoryTestDirectory("development-source-");
  const root = directory.path;
  try {
    const fullSource = readFileSync(
      new URL("../../src/execution/diagnostics.ts", import.meta.url),
      "utf8",
    );
    const declarations = [
      "SOURCE_SCOPE",
      "PACKAGES",
      "DIRECTORIES",
      "sourceRoot",
      "readDirectoryNames",
      "captureDevelopmentSource",
      "observeRuntimeOwnedDevelopmentSource",
    ];
    const source =
      'import { createHash } from "node:crypto";\nimport { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync } from "node:fs";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";' +
      "\n" +
      declarations
        .map((name) => sourceDeclaration(fullSource, name))
        .join("\n") +
      "\nexport { observeRuntimeOwnedDevelopmentSource };";
    const names = [
      "access-management",
      "ai-adapter",
      "coordinator",
      "docker-isolation",
      "domain-model",
      "execution-intelligence",
      "lock",
      "mcp-server",
      "orchestrator",
      "version-control",
    ];
    for (const name of names) {
      const directory = path.join(root, "40_Develop", name);
      mkdirSync(path.join(directory, "src"), { recursive: true });
      writeFileSync(path.join(directory, "package.json"), "{}");
      writeFileSync(
        path.join(directory, "src", "entry.ts"),
        "export const value = 1;\n",
      );
    }
    const replaced = source.replace(
      /const sourceRoot = path.resolve\([\s\S]*?\);/u,
      `const sourceRoot = ${JSON.stringify(root)};`,
    );
    assert.notEqual(replaced, source);
    let compiled = stripTypeScriptTypes(replaced);
    if (readMutation) {
      const needle = "const count = readSync(";
      assert.equal(compiled.split(needle).length, 2);
      compiled = `import { writeFileSync as changeFile } from "node:fs"; let sourceReads = 0;\n${compiled.replace(needle, `const count = ((...args) => { const result = readSync(...args); if (++sourceReads === 1) { ${readMutation} } return result; })(`)}`;
    }
    const loaded = (await import(
      `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
    )) as {
      observeRuntimeOwnedDevelopmentSource: () => null | Readonly<{
        scope: string;
        sourceSha256: string;
        sourceIdentitySha256: string;
        fileCount: number;
        totalBytes: number;
      }>;
    };
    return {
      root,
      cleanup: directory.cleanup,
      observe: loaded.observeRuntimeOwnedDevelopmentSource,
    };
  } catch (error) {
    directory.cleanup();
    throw error;
  }
}

if (process.argv[2] !== "--probe") {
  /**
   * 内容と実体の分離、Scope内外の変更を実Filesystemで確認する。
   *
   * @responsibility Snapshotをコピー署名やRoot実体Hashと混同しないことを検証する。
   * @trace ERB-IT-004
   * @precondition 固定10対象Packageと対象外の旧Coordinator一Directoryの通常Fileが存在する。
   * @stimulus 対象外更新、config／schemasの追加・内容変更・削除、任意Scope追加、同内容File交換を行う。
   * @observation 各観測の内容Hashと実体Hash。
   * @oracle 対象外は不変、対象内追加・内容変更は内容差、同内容交換は実体差となる。
   * @cleanup Fixture Rootをfinallyで削除する。
   * @boundary 実Node Filesystemの読取り・File実体。
   */
  test("development source snapshot separates content, identity and excluded data", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const first = fixture.observe();
      assert.ok(first);
      assert.equal(first.fileCount, 18);
      assert.equal(first.scope, "crdd-development-source-snapshot/v3");
      assert.ok(Object.isFrozen(first));
      writeFileSync(
        path.join(
          fixture.root,
          "40_Develop",
          "orchestrator",
          "src",
          "entry.ts",
        ),
        "export const value = 999;\n",
      );
      assert.deepEqual(fixture.observe(), first);

      mkdirSync(path.join(fixture.root, ".crdd"));
      writeFileSync(path.join(fixture.root, ".crdd", "ignored.json"), "{}");
      writeFileSync(path.join(fixture.root, ".env"), "SYNTHETIC=true");
      assert.deepEqual(fixture.observe(), first);
      const adapter = path.join(fixture.root, "40_Develop", "ai-adapter");
      for (const name of ["config", "schemas"]) {
        const directory = path.join(adapter, name);
        mkdirSync(directory);
        const added = fixture.observe();
        assert.ok(added);
        assert.notEqual(added.sourceSha256, first.sourceSha256);
        const asset = path.join(directory, "asset.json");
        writeFileSync(asset, "{}");
        const populated = fixture.observe();
        assert.ok(populated);
        assert.notEqual(populated.sourceSha256, added.sourceSha256);
        writeFileSync(asset, '{"changed":true}');
        const edited = fixture.observe();
        assert.ok(edited);
        assert.notEqual(edited.sourceSha256, populated.sourceSha256);
        rmSync(directory, { recursive: true });
        assert.equal(fixture.observe()?.sourceSha256, first.sourceSha256);
      }
      const base = path.join(fixture.root, "40_Develop", "coordinator");
      mkdirSync(path.join(base, "policies"));
      const withPolicy = fixture.observe();
      assert.ok(withPolicy);
      assert.notEqual(withPolicy.sourceSha256, first.sourceSha256);
      rmSync(path.join(base, "policies"), { recursive: true });
      const file = path.join(base, "src", "entry.ts");
      renameSync(file, path.join(base, "outside-source.txt"));
      writeFileSync(file, "export const value = 1;\n");
      const replaced = fixture.observe();
      assert.ok(replaced);
      assert.equal(replaced.sourceSha256, first.sourceSha256);
      assert.notEqual(
        replaced.sourceIdentitySha256,
        first.sourceIdentitySha256,
      );
      writeFileSync(file, "export const value = 2;\n");
      const changed = fixture.observe();
      assert.ok(changed);
      assert.notEqual(changed.sourceSha256, first.sourceSha256);
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * 診断Sourceの容量と深さを独自の予算で拒否しない。
   * @responsibility 旧1MiB／64MiB／深度8を超える正常な固定Scopeを確認する。
   * @trace ERB-IT-004
   * @precondition Repository-localの自己生成最小Sourceだけを使う。
   * @stimulus 合計66MiBの通常Fileと深度10のDirectoryを追加する。
   * @observation 全Fileの件数・byte数、内容Hashと実体Hash。
   * @oracle 固定Scope全体の二読取りを完了し、容量だけでnullにしない。
   * @cleanup 自己生成Fixtureをfinallyで回収する。
   * @boundary Node Filesystemの診断読取り。実AI・Docker・Git Objectは使わない。
   */
  test("development source snapshot observes normal source beyond former capacity and depth budgets", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const source = path.join(
        fixture.root,
        "40_Develop",
        "coordinator",
        "src",
      );
      const content = Buffer.alloc(33 * 1024 * 1024, 0x61);
      writeFileSync(path.join(source, "large-a.ts"), content);
      writeFileSync(path.join(source, "large-b.ts"), content);
      const nested = path.join(
        source,
        ...Array.from({ length: 10 }, (_, i) => `nested-${i}`),
      );
      mkdirSync(nested, { recursive: true });
      writeFileSync(
        path.join(nested, "entry.ts"),
        "export const nested = true;\n",
      );
      const observed = fixture.observe();
      assert.ok(observed);
      assert.equal(observed.fileCount, 21);
      assert.ok(observed.totalBytes > 64 * 1024 * 1024);
      assert.equal(observed.sourceSha256.length, 64);
      assert.equal(observed.sourceIdentitySha256.length, 64);
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * 必須Scopeの欠落・空SourceとFile以外の入力を拒否する。
   *
   * @responsibility 部分Snapshotとlink経由の外部Sourceを成功へ畳まない。
   * @trace ERB-IT-004
   * @precondition 最小Fixtureが観測可能である。
   * @stimulus 必須File削除、package.jsonのDirectory化、Source空化とjunctionを作る。
   * @observation 観測結果。
   * @oracle 各不完全入力がnullとなる。
   * @cleanup 自己生成Fixtureだけをfinallyで削除する。
   * @boundary 実Filesystemの種別と存在確認。
   */
  test("Host Windows: development source snapshot rejects missing, empty and linked scope", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const base = path.join(fixture.root, "40_Develop", "coordinator");
      const manifest = path.join(base, "package.json");
      rmSync(manifest);
      assert.equal(fixture.observe(), null);
      mkdirSync(manifest);
      assert.equal(fixture.observe(), null);
      rmSync(manifest, { recursive: true });
      writeFileSync(manifest, "{}");
      rmSync(path.join(base, "src", "entry.ts"));
      assert.equal(fixture.observe(), null);
      writeFileSync(
        path.join(base, "src", "entry.ts"),
        "export const value = 1;\n",
      );
      const outside = path.join(fixture.root, "outside-source.txt");
      writeFileSync(outside, "outside unchanged");
      linkSync(outside, path.join(base, "src", "hardlink.ts"));
      assert.equal(fixture.observe(), null);
      assert.equal(readFileSync(outside, "utf8"), "outside unchanged");
      rmSync(path.join(base, "src", "hardlink.ts"));
      for (const name of ["policies", "config", "schemas"]) {
        const alias = path.join(base, name);
        symlinkSync(path.join(base, "src"), alias, "junction");
        assert.equal(fixture.observe(), null);
        rmSync(alias);
      }
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * File byte数と階層の旧上限を超える正常観測を確認する。
   *
   * @responsibility 正常Sourceを旧容量・深度予算だけで拒否しない。
   * @trace ERB-IT-004
   * @precondition 通常Fixtureが存在する。
   * @stimulus 1MiB境界、超過、深さ8境界と超過を生成する。
   * @observation Snapshotの成功と全内容の件数・容量。
   * @oracle 旧境界の両側を受理する。
   * @cleanup 自己生成Fixture全体をfinallyで削除する。
   * @boundary 実Filesystemの通常FileとDirectory。
   */
  test("development source snapshot accepts source beyond former single-file and depth limits", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const base = path.join(fixture.root, "40_Develop", "coordinator", "src");
      const file = path.join(base, "entry.ts");
      writeFileSync(file, Buffer.alloc(1024 * 1024));
      assert.ok(fixture.observe());
      writeFileSync(file, Buffer.alloc(1024 * 1024 + 1));
      assert.ok(fixture.observe());
      writeFileSync(file, "x");
      const deepest = path.join(base, ...Array<string>(8).fill("nested"));
      mkdirSync(deepest, { recursive: true });
      assert.ok(fixture.observe());
      writeFileSync(path.join(deepest, "too-deep.ts"), "x");
      assert.ok(fixture.observe());
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * 全体File数、Directory数、合計byteの境界を実際に構成する。
   *
   * @responsibility Sourceの正常増加を独自の集合予算で拒否しない。
   * @trace ERB-IT-004
   * @precondition 9対象Package・18通常File（別に対象外の旧Coordinator一Directory）の最小Fixtureが存在する。
   * @stimulus File数2048、Directory数2048、64MiBの境界と各超過を作る。
   * @observation 各Snapshotの件数・byte数。
   * @oracle 旧境界の両側で対象全体を観測する。
   * @cleanup 自己生成Fixtureをfinallyで全回収する。
   * @boundary 実Node Filesystemと固定Scopeの観測。
   */
  test("development source snapshot accepts aggregate counts and bytes beyond former limits", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const base = path.join(fixture.root, "40_Develop", "coordinator", "src");
      const extras = path.join(base, "extras");
      mkdirSync(extras);
      for (let i = 0; i < 2030; i += 1)
        writeFileSync(path.join(extras, `${i}.ts`), "");
      assert.equal(fixture.observe()?.fileCount, 2048);
      writeFileSync(path.join(extras, "overflow.ts"), "");
      assert.equal(fixture.observe()?.fileCount, 2049);
      rmSync(extras, { recursive: true });
      mkdirSync(extras);
      for (let i = 0; i < 2038; i += 1) mkdirSync(path.join(extras, String(i)));
      assert.ok(fixture.observe());
      mkdirSync(path.join(extras, "overflow"));
      assert.ok(fixture.observe());
      rmSync(extras, { recursive: true });
      const original = fixture.observe();
      assert.ok(original);
      const block = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < 63; i += 1)
        writeFileSync(path.join(base, `large-${i}`), block);
      writeFileSync(
        path.join(base, "last-block"),
        block.subarray(0, block.length - original.totalBytes),
      );
      assert.equal(fixture.observe()?.totalBytes, 64 * 1024 * 1024);
      writeFileSync(path.join(base, "one-byte-over"), "x");
      assert.equal(fixture.observe()?.totalBytes, 64 * 1024 * 1024 + 1);
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * 読取り中の内容差替えを実本文の読取り境界へ注入する。
   *
   * @responsibility 前後確認を省いたSnapshotが正常値を返さないことを検証する。
   * @trace ERB-IT-004
   * @precondition Fixtureの最初の読取りでだけ変更する試験コピーを使用する。
   * @stimulus readSync直後に読取り中のScope内Fileを書き換える。
   * @observation 二読取りの観測結果。
   * @oracle 途中差のある候補はnullとなる。
   * @cleanup 自己生成Fixtureだけをfinallyで削除する。
   * @boundary 実Filesystemと計測用の読取り後hook。製品APIへ注入口を追加しない。
   */
  test("development source snapshot rejects a change between observations", async () => {
    const fixture = await createSourceObservationFixture(
      'changeFile(path.join(sourceRoot, "40_Develop", "version-control", "src", "entry.ts"), "export const value = 2;\\n");',
    );
    try {
      assert.equal(fixture.observe(), null);
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * 列挙の実本文で固定上限の撤去とhandle回収を確認する。
   *
   * @responsibility 旧上限を超える通常列挙と失敗時のhandle回収を確認する。
   * @trace ERB-IT-004
   * @precondition 現行私有関数の本文を試験VMへ読み込む。
   * @stimulus 4096件・5000件・readSync例外・closeSync例外を返すDirectory handleを使う。
   * @observation 読取り回数、close回数、返却件数または例外。
   * @oracle 両件数とも全名を整列し、全経路でclose一回。
   * @cleanup VM内の値だけを扱い、実Directory handleは生成しない。
   * @boundary 実列挙本文からNode Directory handle契約への呼出し。
   */
  test("development source snapshot enumerates beyond the former limit and closes its exact handle", () => {
    const source = stripTypeScriptTypes(
      readFileSync(
        new URL("../../src/execution/diagnostics.ts", import.meta.url),
        "utf8",
      ),
    );
    const start = source.indexOf("function readDirectoryNames(");
    const end = source.indexOf("\n}", start) + 2;
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    for (const scenario of [
      "boundary",
      "overflow",
      "read-failure",
      "close-failure",
    ]) {
      let reads = 0;
      let closes = 0;
      const invoke = runInNewContext(
        `${body}; () => readDirectoryNames("fixture")`,
        {
          opendirSync: (directory: string) => {
            assert.equal(directory, "fixture");
            return {
              readSync: () => {
                reads += 1;
                if (scenario === "read-failure")
                  throw new Error("read-failure");
                const count = scenario === "overflow" ? 5000 : 4096;
                return reads <= count
                  ? { name: String(count - reads).padStart(4, "0") }
                  : null;
              },
              closeSync: () => {
                closes += 1;
                if (scenario === "close-failure")
                  throw new Error("close-failure");
              },
            };
          },
        },
      ) as () => string[];
      if (scenario === "boundary" || scenario === "overflow") {
        const names = invoke();
        const count = scenario === "overflow" ? 5000 : 4096;
        assert.equal(names.length, count);
        assert.equal(names[0], "0000");
        assert.equal(names[count - 1], String(count - 1));
      } else {
        assert.throws(invoke, { message: scenario });
      }
      assert.equal(closes, 1);
      assert.equal(
        reads,
        scenario === "read-failure" ? 1 : scenario === "overflow" ? 5001 : 4097,
      );
    }
  });

  /**
   * 既存実測Toolの読取り入口が同じ期待Hashを返すことを確認する。
   *
   * @responsibility Source照会をTask実行・署名・出力Directory作成から分離する。
   * @trace ERB-IT-004
   * @precondition 現行Repositoryの固定Sourceが観測可能である。
   * @stimulus 実CLIを--describe-sourceで起動し、余剰Root引数も与える。
   * @observation JSON結果、終了Code、tests直下の前後集合。
   * @oracle 同じScope/Hash/件数を返し、実体Hash非公開、余剰引数拒否、Directory追加0。
   * @cleanup 読取りだけを実行し生成物を持たない。
   * @boundary 実Node子ProcessのCLI入口。Docker・Providerへは到達しない。
   */
  test("development source snapshot CLI describes the fixed source without creating a run", async () => {
    const root = path.resolve(
      fileURLToPath(new URL("../../../../", import.meta.url)),
    );
    const script = path.join(
      root,
      "40_Develop",
      "coordinator",
      "scripts",
      "measure-development-providers.ts",
    );
    const tests = path.join(root, ".crdd", "tests");
    /**
     * tests直下の存在状態を、作成せず読み取る。
     *
     * @responsibility 未初期化と読取り失敗を区別してCLIの書込み有無を比較する。
     * @trace ERB-IT-004
     * @precondition 対象はこのRepositoryのtests直下に固定される。
     * @stimulus Directory種別と名前集合を読み取る。
     * @observation ENOENTはnull、通常Directoryは整列名配列。
     * @oracle link・種別差・権限拒否を不存在へ丸めない。
     * @cleanup 読取りのみで生成物を持たない。
     * @boundary 実Node Filesystemの非変更観測。
     */
    const inventory = () => {
      try {
        const metadata = lstatSync(tests);
        assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink());
        return readdirSync(tests).sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    };
    const source = readFileSync(script, "utf8");
    const mainStart = source.indexOf("async function main() {");
    const mainEnd = source.indexOf(
      "\nif (path.resolve(process.argv[1]",
      mainStart,
    );
    assert.ok(mainStart >= 0 && mainEnd > mainStart);
    const body = source.slice(mainStart, mainEnd);
    const needles = [
      'process.argv[2] === "--describe-source"',
      "    return;",
      "resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd())",
      'JSON.parse(fs.readFileSync(inputPath, "utf8"))',
      "await runDevelopmentProviderMeasurement(",
    ];
    const positions = needles.map((needle) => {
      assert.equal(body.split(needle).length, 2, needle);
      return body.indexOf(needle);
    });
    assert.ok((positions[0] as number) < (positions[1] as number));
    for (const position of positions.slice(2))
      assert.ok((positions[1] as number) < position);
    const before = inventory();
    const { observeRuntimeOwnedDevelopmentSource } = await import(
      "../../src/execution/diagnostics.ts"
    );
    const expected = observeRuntimeOwnedDevelopmentSource();
    assert.ok(expected);
    const execution = spawnSync(
      process.execPath,
      [script, "--describe-source"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 15_000,
        shell: false,
        windowsHide: true,
      },
    );
    assert.equal(execution.error, undefined);
    assert.equal(execution.status, 0, execution.stderr);
    assert.deepEqual(JSON.parse(execution.stdout), {
      status: "observed",
      scope: expected.scope,
      expectedSourceSha256: expected.sourceSha256,
      fileCount: expected.fileCount,
      totalBytes: expected.totalBytes,
      releaseAuthorityConferred: false,
      providerEffectIssued: false,
    });
    const rejected = spawnSync(
      process.execPath,
      [script, "--describe-source", root],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 15_000,
        shell: false,
        windowsHide: true,
      },
    );
    assert.equal(rejected.error, undefined);
    assert.equal(rejected.status, 2);
    assert.equal(JSON.parse(rejected.stdout).status, "blocked");
    assert.deepEqual(inventory(), before);
  });
}
