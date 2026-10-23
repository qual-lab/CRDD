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
import { sourceDeclaration } from "../support/source-declaration.ts";
import { describeProviderHomeObservationContract } from "../../../platform-access/src/index.ts";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  linkSync,
  lstatSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test, { mock } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createRepositoryTestDirectory } from "../../../domain-model/tests/support/repository-test-directory.ts";

/**
 * 実Source観測本文をRepository内の自己生成Fixtureへ結合する。
 *
 * @responsibility 公開Root注入口を増やさず、実Filesystemの反例を確認する。
 * @trace ERB-IT-004
 * @precondition 現行Source本文を読める。
 * @stimulus 固定9対象Packageと対象外の旧Coordinator一Directoryを最小Sourceで構成し、試験コピーのRoot定数だけを置き換える。
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
      "MAX_FILES",
      "MAX_DIRECTORIES",
      "MAX_FILE_BYTES",
      "MAX_TOTAL_BYTES",
      "MAX_DEPTH",
      "readBoundedDirectoryNames",
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
      "mcp-server",
      "orchestrator",
      "platform-access",
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
   * @precondition 固定9対象Packageと対象外の旧Coordinator一Directoryの通常Fileが存在する。
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
      assert.equal(first.scope, "crdd-development-source-snapshot/v2");
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
   * File byte数と階層の上限で観測を停止する。
   *
   * @responsibility Source追加による無制限読取りを防止する。
   * @trace ERB-IT-004
   * @precondition 通常Fixtureが存在する。
   * @stimulus 1MiB境界、超過、深さ8境界と超過を生成する。
   * @observation 有界Snapshotの成功またはnull。
   * @oracle 境界内を受理し、単一Fileと深さの超過を拒否する。
   * @cleanup 自己生成Fixture全体をfinallyで削除する。
   * @boundary 実Filesystemと有界File読取り。
   */
  test("development source snapshot enforces single-file and depth limits", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const base = path.join(fixture.root, "40_Develop", "coordinator", "src");
      const file = path.join(base, "entry.ts");
      writeFileSync(file, Buffer.alloc(1024 * 1024));
      assert.ok(fixture.observe());
      writeFileSync(file, Buffer.alloc(1024 * 1024 + 1));
      assert.equal(fixture.observe(), null);
      writeFileSync(file, "x");
      const deepest = path.join(base, ...Array<string>(8).fill("nested"));
      mkdirSync(deepest, { recursive: true });
      assert.ok(fixture.observe());
      writeFileSync(path.join(deepest, "too-deep.ts"), "x");
      assert.equal(fixture.observe(), null);
    } finally {
      fixture.cleanup();
    }
  });

  /**
   * 全体File数、Directory数、合計byteの境界を実際に構成する。
   *
   * @responsibility 個別File上限だけで全体有界性を推定しない。
   * @trace ERB-IT-004
   * @precondition 9対象Package・18通常File（別に対象外の旧Coordinator一Directory）の最小Fixtureが存在する。
   * @stimulus File数2048、Directory数2048、64MiBの境界と各超過を作る。
   * @observation 各Snapshotの件数・byte数と拒否。
   * @oracle 各上限を受理し、一つでも超えたらnullとする。
   * @cleanup 自己生成Fixtureをfinallyで全回収する。
   * @boundary 実Node Filesystemと固定Scopeの有界観測。
   */
  test("development source snapshot enforces aggregate count and byte limits", async () => {
    const fixture = await createSourceObservationFixture();
    try {
      const base = path.join(fixture.root, "40_Develop", "coordinator", "src");
      const extras = path.join(base, "extras");
      mkdirSync(extras);
      for (let i = 0; i < 2030; i += 1)
        writeFileSync(path.join(extras, `${i}.ts`), "");
      assert.equal(fixture.observe()?.fileCount, 2048);
      writeFileSync(path.join(extras, "overflow.ts"), "");
      assert.equal(fixture.observe(), null);
      rmSync(extras, { recursive: true });
      mkdirSync(extras);
      for (let i = 0; i < 2038; i += 1) mkdirSync(path.join(extras, String(i)));
      assert.ok(fixture.observe());
      mkdirSync(path.join(extras, "overflow"));
      assert.equal(fixture.observe(), null);
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
      assert.equal(fixture.observe(), null);
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
   * 列挙の実本文で上限とhandle回収を確認する。
   *
   * @responsibility 拒否前の無制限列挙と失敗時のhandle残存を検出する。
   * @trace ERB-IT-004
   * @precondition 現行私有関数の本文を試験VMへ読み込む。
   * @stimulus 4096件・4097件・readSync例外・closeSync例外を返すDirectory handleを使う。
   * @observation 読取り回数、close回数、返却件数または例外。
   * @oracle 正常は整列4096名、超過は4097読取り時に停止し、全経路でclose一回。
   * @cleanup VM内の値だけを扱い、実Directory handleは生成しない。
   * @boundary 実列挙本文からNode Directory handle契約への呼出し。
   */
  test("development source snapshot bounds enumeration and closes its exact handle", () => {
    const source = stripTypeScriptTypes(
      readFileSync(
        new URL("../../src/execution/diagnostics.ts", import.meta.url),
        "utf8",
      ),
    );
    const start = source.indexOf("function readBoundedDirectoryNames(");
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
        `${body}; () => readBoundedDirectoryNames("fixture")`,
        {
          MAX_FILES: 2048,
          MAX_DIRECTORIES: 2048,
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
      if (scenario === "boundary") {
        const names = invoke();
        assert.equal(names.length, 4096);
        assert.equal(names[0], "0000");
        assert.equal(names[4095], "4095");
      } else {
        assert.throws(invoke, {
          message:
            scenario === "overflow"
              ? "development_source_directory_limit"
              : scenario,
        });
      }
      assert.equal(closes, 1);
      assert.equal(reads, scenario === "read-failure" ? 1 : 4097);
    }
  });

  /**
   * 本番観測本文の元token・新token・借用tokenを別々に反証する。
   *
   * @responsibility 同じArtifact内容だけで元実体の失効を上書きしないことを確認する。
   * @trace ERB-IT-004
   * @precondition 現行観測・借用の実関数本文と私有MapをVMで結合する。
   * @stimulus Map欠測、旧token前後・新token最終の失敗と借用失敗を与える。
   * @observation 返却値、照合順、保存されたtokenとSource情報。
   * @oracle 同内容差替えを拒否し、各確認を省く変異は同じOracleで失敗する。
   * @cleanup VM内の非Authority値だけを扱い実Process・Filesystemを生成しない。
   * @boundary 実Session観測本文→PA観測契約。実Nativeの実体確認はPA試験が所有する。
   */
  test("development session preserves original native observations across fresh snapshots", () => {
    const source = stripTypeScriptTypes(
      readFileSync(
        new URL("../../src/execution/diagnostics.ts", import.meta.url),
        "utf8",
      ),
    );
    const start = source.indexOf("function observeProduction(");
    const end = source.indexOf("\n}", start) + 2;
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    /**
     * 同じ観測本文へ各失敗を与える。
     *
     * @responsibility 本番確認の省略と誤結合を同じ期待結果で検出する。
     * @trace ERB-IT-004
     * @precondition selectedは実本文または一箇所だけを変えた反例。
     * @stimulus 元token欠測・旧実体交換・新観測失効を順に実行する。
     * @observation token照合順とMap保存値。
     * @oracle 正常だけがcandidate用Identityを返し、旧token失効はfresh観測でも拒否する。
     * @cleanup 実資源を作らずVM終了で局所値を解放する。
     * @boundary 実本番本文と独立した観測結果Oracle。
     */
    const oracle = (selected: string) => {
      for (const scenario of [
        "normal",
        "map-missing",
        "old-first",
        "old-second",
        "new-final",
        "same-bytes-replaced",
      ]) {
        const prior = Object.freeze({});
        const oldToken = "a".repeat(64);
        const newToken = "b".repeat(64);
        const artifact = Object.freeze({
          relativePath: "native.exe",
          target: "windows",
          protocolRevision: 3,
          rustToolchain: "fixed",
          byteLength: 1,
          sha256: "1".repeat(64),
        });
        const map = new WeakMap<
          object,
          {
            identitySha256: string;
            verification: object;
            sourceObservation: object;
          }
        >();
        if (scenario !== "map-missing")
          map.set(prior, {
            identitySha256: oldToken,
            verification: {},
            sourceObservation: {},
          });
        const events: string[] = [];
        let oldChecks = 0;
        let replaced = false;
        const observe = runInNewContext(`(${selected})`, {
          nativeVerifications: map,
          sourceDistributionRoot: "fixed-source",
          digest: (value: unknown) => JSON.stringify(value),
          inspectRepositoryIdentityCandidate: () => {
            events.push("repository");
            return { commit: "a", tree: "b" };
          },
          observeRuntimeOwnedDevelopmentSource: () => {
            events.push("source");
            return {
              scope: "crdd-development-source-snapshot/v2",
              sourceSha256: "c",
              sourceIdentitySha256: "source-identity",
            };
          },
          observeNativeArtifact: (root: string, expected?: string) => {
            assert.equal(root, "fixed-source");
            if (expected === undefined) {
              events.push("begin");
              replaced = scenario === "same-bytes-replaced";
              return {
                artifact,
                identitySha256: newToken,
                bootstrapVerified: true,
              };
            }
            assert.ok(expected === oldToken || expected === newToken);
            events.push(expected === oldToken ? "verify-old" : "verify-new");
            if (expected === oldToken) {
              oldChecks += 1;
              if (
                replaced ||
                scenario === "old-first" ||
                (scenario === "old-second" && oldChecks === 2)
              )
                return null;
            } else if (scenario === "new-final") return null;
            return {
              artifact,
              identitySha256: expected,
              bootstrapVerified: true,
            };
          },
        }) as (configuration: unknown, prior: object) => object | null;
        const result = observe(
          {
            repositoryRoot: "task-repository",
            expectedCommit: "a",
            expectedTree: "b",
            expectedSourceSha256: "c",
          },
          prior,
        );
        if (scenario === "normal") {
          assert.ok(result);
          assert.deepEqual(events, [
            "verify-old",
            "repository",
            "source",
            "begin",
            "repository",
            "verify-old",
            "verify-new",
          ]);
          const saved = map.get(result);
          assert.ok(saved);
          assert.equal(saved.identitySha256, newToken);
          assert.equal(
            Reflect.get(saved.verification, "platformAccessArtifact"),
            artifact,
          );
          assert.equal(
            JSON.stringify(saved.sourceObservation),
            JSON.stringify({
              scope: "crdd-development-source-snapshot/v2",
              expectedSourceSha256: "c",
            }),
          );
          assert.ok(Object.isFrozen(saved.sourceObservation));
        } else {
          assert.equal(result, null, scenario);
          if (scenario === "map-missing" || scenario === "old-first")
            assert.equal(events.includes("source"), false);
        }
      }
    };
    oracle(body);
    for (const pattern of [
      /if\s*\(\s*priorIdentity !== undefined\s*&&\s*\(!prior\s*\|\|\s*!observeNativeArtifact\(\s*sourceDistributionRoot,\s*prior.identitySha256,?\s*\)\)\s*\)\s*return null;/u,
      /if\s*\(\s*prior\s*&&\s*!observeNativeArtifact\(\s*sourceDistributionRoot,\s*prior.identitySha256,?\s*\)\s*\)\s*return null;/u,
      /if\s*\(!observeNativeArtifact\(sourceDistributionRoot, native.identitySha256\)\)\s*return null;/u,
    ]) {
      const changed = body.replace(pattern, "");
      assert.notEqual(changed, body);
      assert.throws(() => oracle(changed), { name: "AssertionError" });
    }
    const borrowStart = source.indexOf(
      "function borrowRuntimeOwnedDevelopmentNativeObservation(",
    );
    const borrowEnd = source.indexOf("\n}", borrowStart) + 2;
    assert.ok(borrowStart >= 0 && borrowEnd > borrowStart);
    const borrowBody = source.slice(borrowStart, borrowEnd);
    for (const scenario of ["normal", "missing", "invalid", "throws"]) {
      const identity = Object.freeze({});
      const token = "c".repeat(64);
      const verification = Object.freeze({ status: "candidate" });
      const map = new WeakMap<object, object>();
      if (scenario !== "missing")
        map.set(identity, { identitySha256: token, verification });
      let checks = 0;
      const borrow = runInNewContext(`(${borrowBody})`, {
        productionRuntime: {
          borrowNativeObservation: () => ({
            identity,
            distributionRoot: "fixed-source",
          }),
        },
        nativeVerifications: map,
        observeNativeArtifact: (root: string, received?: string) => {
          assert.equal(root, "fixed-source");
          assert.equal(received, token);
          checks += 1;
          if (scenario === "throws") throw new Error("observation_failed");
          return scenario === "invalid"
            ? null
            : { identitySha256: token, bootstrapVerified: true };
        },
      }) as (context: object, initialize: boolean) => object | null;
      const result = borrow({}, false);
      assert.equal(checks, scenario === "missing" ? 0 : 1);
      if (scenario === "normal") {
        assert.ok(result);
        assert.equal(Reflect.get(result, "verification"), verification);
        assert.equal("expectedRelease" in result, false);
      } else assert.equal(result, null);
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

const targets = ["codex", "claude", "state", "state-init"];
const scenarios = [
  "normal",
  "pre-artifact",
  "post-artifact",
  "post-source",
  "post-native",
  "post-repository",
  "native-null",
  "native-throw",
  "environment",
  "unknown-context",
  "cancel",
  "expiry",
  "cleanup-cancel",
  "cleanup-expiry",
  "checkout-normal",
  "checkout-bootstrap-missing",
  "checkout-artifact-mismatch",
  "checkout-pre-token",
  "checkout-post-token",
  "checkout-post-artifact-mismatch",
  "admission-source-hash",
  "source-hash-mismatch",
  "old-token-stale",
  "old-token-throw",
  "old-token-second",
  "new-token-final",
  "borrow-token-stale",
  "borrow-token-throw",
  "post-borrow-token",
  "cleanup-old-token-stale",
];

/**
 * runProbeのTest準備責務を実行する。
 *
 * @responsibility runProbeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runProbeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
async function runProbe(target: string, scenario: string) {
  for (const relative of [
    "execution/diagnostics.ts",
    "execution/authority.ts",
    "execution/authority.ts",
  ]) {
    const current = readFileSync(
      new URL(`../../src/${relative}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      current,
      /package-verification\.ts|platform-access\/release-identity\.ts|inspectFixedDevelopmentCoordinatorPackageCandidate|inspectVerifiedNativeDistributionCandidate|verifyBundledCoordinatorPackageFromFixedManifestCandidate/u,
      relative,
    );
  }
  const realNow = Date.now;
  let simulatedTime: number | null = null;
  mock.method(Date, "now", () => simulatedTime ?? realNow());
  const root = path.resolve(
    fileURLToPath(new URL("../../../..", import.meta.url)),
  );
  const artifact = Object.freeze({
    relativePath:
      "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
    target: "x86_64-pc-windows-msvc",
    protocolRevision: 3,
    rustToolchain: "1.94.1-x86_64-pc-windows-msvc",
    byteLength: 1,
    sha256: "1".repeat(64),
  });
  let nativeCalls = 0;
  let identitySequence = 0;
  let nativeEffectObservations = 0;
  let publicObservationCalls = 0;
  let readerCalls = 0;
  let provenanceCalls = 0;
  let admissionToken: string | null = null;
  let latestBootstrapToken: string | null = null;
  let warmedToken: string | null = null;
  let priorTokenChecks = 0;
  const bootstrapTokens = new Set<string>();
  const isCheckout = scenario.startsWith("checkout-");
  let isArmed = false;
  const management = Object.freeze({});
  const repositoryBinding = Object.freeze({});
  /**
   * moduleUrlのTest準備責務を実行する。
   *
   * @responsibility moduleUrlがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-004
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus moduleUrlを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
   */
  const moduleUrl = (name: string) => {
    if (name === "native-artifact-observation")
      return new URL("../../../platform-access/src/index.ts", import.meta.url)
        .href;
    const sources: Record<string, string> = {
      "repository-operation-runtime": "execution/operation.ts",
      "execution-environment": "execution/operation.ts",
      "development-source-observation": "execution/diagnostics.ts",
    };
    assert.ok(sources[name], name);
    return new URL(`../../src/${sources[name]}`, import.meta.url).href;
  };
  await mock.module(
    new URL("../../scripts/native-git-provenance.ts", import.meta.url).href,
    {
      namedExports: {
        inspectPlatformAccessNativeGitProvenanceCandidate: () => {
          provenanceCalls += 1;
          throw new Error("runtime_must_not_use_git_provenance");
        },
      },
    },
  );
  await mock.module(
    new URL("../../src/execution/advice.ts", import.meta.url).href,
    {
      namedExports: {
        createRuntimeOwnedProviderAdviceRuntime: () => {
          throw new Error("advice_runtime_not_used_by_native_observation");
        },
        classifyProviderAdviceHostFailure: () => {
          throw new Error("advice_failure_not_used_by_native_observation");
        },
        recoverProviderAdviceHostOperation: () => {
          throw new Error("advice_recovery_not_used_by_native_observation");
        },
      },
    },
  );
  await mock.module(moduleUrl("repository-operation-runtime"), {
    namedExports: {
      verifyOwnedOperationManagementCapability: (operation: object) => {
        assert.equal(operation, management);
        return { operationId: "fixture-operation" };
      },
      verifyRuntimeOwnedRepositoryBindingCapability: () => {
        throw new Error("binding_verification_not_used_by_native_observation");
      },
      borrowRuntimeOwnedRepositorySource: (
        repository: object,
        operation: object,
      ) =>
        repository === repositoryBinding && operation === management
          ? {
              operationId: "fixture-operation",
              repositoryRoot: root,
              revision: "a".repeat(40),
            }
          : null,
    },
  });
  const versionControlUrl = new URL(
    "../../../version-control/src/index.ts",
    import.meta.url,
  ).href;
  await mock.module(versionControlUrl, {
    namedExports: {
      ...(await import(versionControlUrl)),
      inspectRepositoryIdentityCandidate: () => ({
        commit:
          isArmed &&
          nativeEffectObservations > 0 &&
          scenario === "post-repository"
            ? "9".repeat(40)
            : "a".repeat(40),
        tree: "b".repeat(40),
      }),
    },
  });
  /**
   * 観測時点に応じた合成Source Identityを返す。
   * @responsibility Effect前後の再照合に使う合成Identityだけを生成する。
   * @trace ERB-IT-004
   * @precondition scenarioとisArmedはこの試験だけが所有する。
   * @stimulus Effect前後又は明示したHash不一致を選ぶ。
   * @observation 固定Hashと合成件数を観測する。
   * @oracle 指定した段階だけIdentityが変わり、実Sourceを読まない。
   * @effect N/A: 合成値を生成するだけ。
   * @cleanup N/A: 資源を作成しない。
   * @boundary Native観測の有限代役と実行前後の照合。
   */
  const sourceObservation = () => ({
    scope: "crdd-development-source-snapshot/v2",
    sourceSha256:
      isArmed && scenario === "source-hash-mismatch"
        ? "9".repeat(64)
        : "c".repeat(64),
    sourceIdentitySha256:
      isArmed && nativeEffectObservations > 0 && scenario === "post-source"
        ? "9".repeat(64)
        : "2".repeat(64),
    fileCount: 22,
    totalBytes: 275,
  });
  const artifactMock = {
    namedExports: {
      WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE: "test_only",
      observeNativeArtifact: (distributionRoot: string, token?: string) => {
        if (token !== undefined) {
          if (isArmed) {
            if (token === admissionToken) {
              priorTokenChecks += 1;
              if (scenario === "old-token-throw")
                throw new Error("original_token_observation_failed");
              if (
                scenario === "old-token-stale" ||
                scenario === "cleanup-old-token-stale" ||
                (scenario === "old-token-second" && priorTokenChecks === 2)
              )
                return null;
            }
            if (
              scenario === "new-token-final" &&
              token === latestBootstrapToken &&
              token !== admissionToken
            )
              return null;
            if (scenario === "borrow-token-stale" && token === warmedToken)
              return null;
            if (scenario === "borrow-token-throw" && token === warmedToken)
              throw new Error("borrow_token_observation_failed");
            if (
              scenario === "post-borrow-token" &&
              nativeEffectObservations > 0 &&
              bootstrapTokens.has(token)
            )
              return null;
          }
          return { artifact, identitySha256: token, bootstrapVerified: true };
        }

        assert.equal(path.resolve(distributionRoot), root);
        nativeCalls += 1;
        if (isArmed && scenario === "native-throw")
          throw new Error("private_observation_failure");
        if (
          isArmed &&
          (scenario === "native-null" ||
            scenario === "checkout-bootstrap-missing")
        )
          return null;
        const currentIdentity = (++identitySequence)
          .toString(16)
          .padStart(64, "0");
        bootstrapTokens.add(currentIdentity);
        admissionToken ??= currentIdentity;
        latestBootstrapToken = currentIdentity;
        return {
          artifact:
            isArmed &&
            nativeEffectObservations > 0 &&
            scenario === "post-native"
              ? { ...artifact, sha256: "9".repeat(64) }
              : artifact,
          identitySha256: currentIdentity,
          bootstrapVerified: true,
        };
      },
    },
  };
  /**
   * PA公開APIの固定結果と開発Readerの投影だけを代替する。
   * @responsibility Native内部の検出ではなく、上位の処置・Capability非発行を確認する。
   * @trace ERB-IT-004
   * @precondition 故障名は旧結合CaseとPA側検出Caseへ対応付け済み。
   * @stimulus 選択対象と任意Readerを受ける。
   * @observation 公開API到達、Reader回数、固定結果のEffect。
   * @oracle 初回拒否はEffectなし、後確認拒否は発行済み事実を保持する。
   * @cleanup N/A: Native・Filesystem・外部AIは操作しない。
   * @boundary PA公開APIの結果代替。実Native検出の証明ではない。
   */
  const observeNativeResult = (
    provider: string | null,
    rootPath: unknown,
    initialize: boolean,
    reader?: () => {
      distributionRoot: string;
      expectedArtifact: unknown;
    } | null,
  ) => {
    publicObservationCalls += 1;
    assert.equal(typeof rootPath, "string");
    assert.equal(initialize, target === "state-init");
    if (provider !== null) assert.equal(provider, target);
    /**
     * 固定された公開失敗結果を構築する。
     * @responsibility 模擬結果の開始・終了・初期化Effectだけを保持する。
     * @trace ERB-IT-004
     * @precondition 故障Caseから決めた固定理由とEffectを渡す。
     * @stimulus 停止結果を要求する。
     * @observation immutableな公開結果を返す。
     * @oracle 上位が処置の期待条件を確認する。
     * @cleanup N/A: 局所値だけ。
     * @boundary PA公開結果の代替であり実Native観測ではない。
     */
    const blocked = (reason: string, effect: boolean) =>
      Object.freeze({
        status: "blocked",
        reason,
        processEffectIssued: effect,
        helperExitConfirmed: effect,
        artifactVerifiedBeforeAndAfter: false,
        filesystemEffectIssued: initialize && effect,
      });
    if (reader) {
      readerCalls += 1;
      const first = reader();
      if (!first) return blocked("development_context_invalid", false);
      assert.equal(first.distributionRoot, root);
      assert.deepEqual(first.expectedArtifact, artifact);
    }
    // 固定した公開結果の注入。Artifact検出手順をここへ再実装しない。
    const earlyFailure: Readonly<Record<string, string>> = {
      "pre-artifact": "artifact_not_verified",
      environment: "environment_unavailable",
      "checkout-bootstrap-missing": "artifact_bootstrap_unavailable",
      "checkout-artifact-mismatch": "artifact_not_verified",
      "checkout-pre-token": "artifact_changed",
    };
    const earlyReason = earlyFailure[scenario];
    if (earlyReason) return blocked(earlyReason, false);
    nativeEffectObservations += 1;
    const lateFailure: Readonly<Record<string, string>> = {
      "post-artifact": "artifact_changed",
      "checkout-post-token": "artifact_changed",
      "checkout-post-artifact-mismatch": "artifact_changed",
    };
    const lateReason = lateFailure[scenario];
    if (lateReason) return blocked(lateReason, true);
    if (reader) {
      readerCalls += 1;
      if (!reader()) return blocked("artifact_changed", true);
    }
    return Object.freeze({
      status: "candidate",
      reason: provider
        ? "runtime_owned_provider_home_observed_candidate"
        : "runtime_owned_runtime_state_observed_candidate",
      ...(provider
        ? {
            provider,
            providerHomeIdentityHash: "1".repeat(64),
            providerHomeProtectionHash: "2".repeat(64),
            principalObservation: {
              primaryToken: true,
              interactiveGroup: true,
              serviceGroup: false,
              batchGroup: false,
              networkGroup: false,
              restrictedToken: false,
              appContainer: false,
              nonzeroSession: true,
            },
            homeObservation: {
              directory: true,
              fixedVolume: true,
              noReparseChain: true,
              stableIdentity: true,
              ownerSelectedUser: true,
              daclProtected: true,
              writersRestricted: true,
              selectedUserFullControl: true,
              systemFullControl: true,
            },
            operationCapabilityIssued: false,
          }
        : {
            runtimeStateIdentityHash: "1".repeat(64),
            runtimeStateProtectionHash: "2".repeat(64),
          }),
      localUserBindingHash: "3".repeat(64),
      stableLogicalHomeBindingHash: "4".repeat(64),
      selectedUserBindingVerified: true,
      protectionVerified: true,
      stableIdentityObserved: true,
      pathReported: false,
      principalReported: false,
      aclReported: false,
      credentialContentRead: false,
      runtimeAuthorityIssued: false,
      mountGrantIssued: false,
      networkEffectIssued: false,
      processEffectIssued: true,
      helperExitConfirmed: true,
      artifactVerifiedBeforeAndAfter: true,
      filesystemEffectIssued: initialize,
      executionSourceKind: reader
        ? "fixed_development_candidate"
        : "fixed_bootstrap_native_artifact",
    });
  };
  await mock.module(moduleUrl("native-artifact-observation"), {
    namedExports: {
      ...Object.fromEntries(
        Object.entries(
          await import(moduleUrl("native-artifact-observation")),
        ).map(([name, value]) => [
          name,
          typeof value === "function"
            ? () => {
                throw new Error("native_observation_dependency_not_allowed");
              }
            : value,
        ]),
      ),
      ...artifactMock.namedExports,
      observeWindowsProviderHome: (
        provider: string,
        homePath: string,
        reader?: Parameters<typeof observeNativeResult>[3],
      ) => observeNativeResult(provider, homePath, false, reader),
      observeWindowsRuntimeState: (
        rootPath: string,
        initialize: boolean,
        reader?: Parameters<typeof observeNativeResult>[3],
      ) => observeNativeResult(null, rootPath, initialize, reader),
      describeProviderHomeObservationContract,
    },
  });
  const diagnosticsUrl = moduleUrl("development-source-observation");
  const diagnosticsSource = readFileSync(fileURLToPath(diagnosticsUrl), "utf8");
  const declarations = [
    "STATE_LABELS",
    "Interval",
    "createDevelopmentExecutionTiming",
    "writeDevelopmentMeasurementProgress",
    "HASH_PATTERN",
    "MAX_DURATION_MS",
    "CONFIG_KEYS",
    "TASK_KEYS",
    "OBSERVATION_KEYS",
    "Provider",
    "Role",
    "StopReason",
    "Refusal",
    "ConstraintResult",
    "Observation",
    "TaskState",
    "InvocationState",
    "parseObservation",
    "refuse",
    "record",
    "createDevelopmentMeasurementConstraints",
    "developmentMeasurementSessionCONFIG_KEYS",
    "SHA256",
    "COMMIT",
    "developmentMeasurementSessionMAX_DURATION_MS",
    "sourceDistributionRoot",
    "developmentMeasurementSessionProvider",
    "developmentMeasurementSessionRole",
    "Constraints",
    "TaskRequest",
    "Task",
    "Configuration",
    "Identity",
    "NativeVerification",
    "nativeVerifications",
    "Dependencies",
    "Session",
    "TaskBinding",
    "digest",
    "snapshotTask",
    "snapshotConfiguration",
    "observeProduction",
    "blocked",
    "createSessionRuntime",
    "productionRuntime",
    "requestRuntimeOwnedDevelopmentMeasurementSession",
    "inspectRuntimeOwnedDevelopmentMeasurementSession",
    "readRuntimeOwnedDevelopmentMeasurementTasks",
    "cancelRuntimeOwnedDevelopmentMeasurementSession",
    "borrowRuntimeOwnedDevelopmentNativeObservation",
    "inspectRuntimeOwnedDevelopmentOperationContext",
    "reserveRuntimeOwnedDevelopmentMeasurementTask",
    "createIsolatedDevelopmentMeasurementSessionCandidate",
  ]
    .map((name) => sourceDeclaration(diagnosticsSource, name))
    .join("\n");
  const observationKey = "__crddNativeObservationFixture";
  (globalThis as Record<string, unknown>)[observationKey] = sourceObservation;
  const imports = [
    'import { createHash } from "node:crypto";',
    'import path from "node:path";',
    'import { performance } from "node:perf_hooks";',
    'import { fileURLToPath } from "node:url";',
    'import { types as utilTypes } from "node:util";',
    `import { isRuntimeProcessEffectBlocked } from "${new URL("../../src/execution/process-safety-state.ts", import.meta.url).href}";`,
    `import { snapshotCoordinatorTaskRequest } from "${new URL("../../src/execution/request.ts", import.meta.url).href}";`,
    `import { verifyOwnedOperationManagementCapability, borrowRuntimeOwnedRepositorySource } from "${moduleUrl("execution-environment")}";`,
    `import { snapshotPlainArray, snapshotPlainRecord } from "${new URL("../../../domain-model/src/index.ts", import.meta.url).href}";`,
    `import { observeNativeArtifact } from "${moduleUrl("native-artifact-observation")}";`,
    `import { inspectRepositoryIdentityCandidate } from "${versionControlUrl}";`,
    `const observeRuntimeOwnedDevelopmentSource = globalThis[${JSON.stringify(observationKey)}];`,
  ].join("\n");
  const sessionSource = `${imports}\n${declarations.replaceAll("import.meta.url", JSON.stringify(diagnosticsUrl))}\nexport { createDevelopmentExecutionTiming, writeDevelopmentMeasurementProgress, createDevelopmentMeasurementConstraints, requestRuntimeOwnedDevelopmentMeasurementSession, inspectRuntimeOwnedDevelopmentMeasurementSession, readRuntimeOwnedDevelopmentMeasurementTasks, cancelRuntimeOwnedDevelopmentMeasurementSession, borrowRuntimeOwnedDevelopmentNativeObservation, inspectRuntimeOwnedDevelopmentOperationContext, reserveRuntimeOwnedDevelopmentMeasurementTask, createIsolatedDevelopmentMeasurementSessionCandidate };`;
  const session = await import(
    `data:text/javascript;base64,${Buffer.from(sessionSource).toString("base64")}`
  );
  delete (globalThis as Record<string, unknown>)[observationKey];
  await mock.module(diagnosticsUrl, {
    namedExports: {
      ...session,
      observeRuntimeOwnedDevelopmentSource: sourceObservation,
    },
  });
  const authoritySource = readFileSync(
    new URL("../../src/execution/authority.ts", import.meta.url),
    "utf8",
  );
  const authorityDeclarations = [
    "rootCapabilities",
    "protectedRootBlocked",
    "rootPathCandidate",
    "inspectRuntimeOwnedWindowsProtectedRoot",
    "inspectRuntimeOwnedWindowsRuntimeState",
    "consumeRuntimeOwnedRuntimeStateRootCapability",
    "describeRuntimeStateWindowsAdapterContract",
    "PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT",
    "PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION",
    "HELPER_TIMEOUT_MS",
    "OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS",
    "observationCapabilities",
    "mountSourceCapabilities",
    "runtimeOwnedProviderHomeMountSourceCandidate",
    "providerHomeWindowsAdapterBlocked",
    "inspectRuntimeOwnedWindowsProviderHomeCandidate",
    "consumeRuntimeOwnedProviderHomeObservationCapability",
    "consumeRuntimeOwnedProviderHomeMountSourceCapability",
    "revokeRuntimeOwnedProviderHomeMountSourceCapability",
    "describeProviderHomeWindowsAdapterContract",
    "AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES",
    "WINDOWS_RESERVED_BASENAME",
    "RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS",
    "reservedNameSpecialUppercaseMapping",
    "reservedNameLimitedUppercase",
    "hasSupportedCommonPathBytes",
    "isSupportedWindowsAbsolutePathCandidate",
    "describeAuthorityRootPathLexicalContract",
    "isSupportedPosixAbsolutePathCandidate",
    "isSupportedAuthorityRootAbsolutePath",
  ]
    .map((name) => sourceDeclaration(authoritySource, name))
    .join("\n");
  const authorityImports = [
    'import path from "node:path";',
    'import { performance } from "node:perf_hooks";',
    `import { snapshotPlainRecord } from "${new URL("../../../domain-model/src/index.ts", import.meta.url).href}";`,
    `import { observeWindowsProviderHome, observeWindowsRuntimeState, WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE, describeProviderHomeObservationContract } from "${moduleUrl("native-artifact-observation")}";`,
    `import { borrowRuntimeOwnedDevelopmentNativeObservation } from "${diagnosticsUrl}";`,
  ].join("\n");
  const provider = await import(
    `data:text/javascript;base64,${Buffer.from(`${authorityImports}\n${authorityDeclarations}\nexport { inspectRuntimeOwnedWindowsProviderHomeCandidate, inspectRuntimeOwnedWindowsRuntimeState, consumeRuntimeOwnedProviderHomeObservationCapability, consumeRuntimeOwnedProviderHomeMountSourceCapability, revokeRuntimeOwnedProviderHomeMountSourceCapability, consumeRuntimeOwnedRuntimeStateRootCapability };`).toString("base64")}`
  );
  const store = provider;
  const tasks = ["codex", "claude"].map((executor) => ({
    frontProvider: executor === "codex" ? "claude" : "codex",
    requestedExecutorProvider: executor,
    objective: "Bounded fixture",
    acceptanceCriteria: ["Expected content"],
    allowedPaths: ["fixture.txt"],
    readPaths: ["fixture.txt"],
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  }));
  const expiresAtMs = Date.now() + 60_000;
  const admitted =
    await session.requestRuntimeOwnedDevelopmentMeasurementSession(
      {
        repositoryRoot: root,
        expectedCommit: "a".repeat(40),
        expectedTree: "b".repeat(40),
        expectedSourceSha256:
          scenario === "admission-source-hash"
            ? "d".repeat(64)
            : "c".repeat(64),
        tasks,
        expiresAtMs,
      },
      new AbortController().signal,
    );
  if (scenario === "admission-source-hash") {
    assert.equal(admitted.status, "blocked");
    assert.equal(admitted.capability, null);
    assert.equal(nativeCalls, 0);
    assert.equal(nativeEffectObservations, 0);
    assert.equal(publicObservationCalls, 0);
    assert.equal(readerCalls, 0);
    process.stdout.write(
      JSON.stringify({
        target,
        scenario,
        adapterNativeCalls: 0,
        nativeEffectObservations: 0,
      }),
    );
    return;
  }
  assert.ok(admitted.capability);
  assert.deepEqual(
    session.inspectRuntimeOwnedDevelopmentMeasurementSession(
      admitted.capability,
    )?.sourceObservation,
    {
      scope: "crdd-development-source-snapshot/v2",
      expectedSourceSha256: "c".repeat(64),
    },
  );
  const boundary = session.reserveRuntimeOwnedDevelopmentMeasurementTask(
    admitted.capability,
    tasks[0],
    root,
  );
  assert.ok(boundary);
  assert.equal(boundary.bindOperation(management, repositoryBinding), true);
  const cleanupContext =
    session.inspectRuntimeOwnedDevelopmentOperationContext(
      management,
    )?.cleanupContext;
  assert.ok(cleanupContext);
  const context = isCheckout
    ? undefined
    : scenario === "unknown-context"
      ? {}
      : scenario.startsWith("cleanup-")
        ? cleanupContext
        : boundary.context;
  if (scenario === "normal" || scenario.startsWith("borrow-token-")) {
    assert.ok(context);
    const first = session.borrowRuntimeOwnedDevelopmentNativeObservation(
      context,
      false,
    );
    const second = session.borrowRuntimeOwnedDevelopmentNativeObservation(
      context,
      false,
    );
    assert.ok(first && second);
    assert.equal(first.distributionRoot, root);
    assert.equal("expectedRelease" in first, false);
    assert.deepEqual(first.verification.platformAccessArtifact, artifact);
    assert.equal(
      Reflect.get(first, "verification"),
      Reflect.get(second, "verification"),
    );
  }
  warmedToken = latestBootstrapToken;
  if (scenario.endsWith("cancel")) {
    assert.equal(
      session.cancelRuntimeOwnedDevelopmentMeasurementSession(
        admitted.capability,
      ),
      true,
    );
  }
  if (scenario.endsWith("expiry")) simulatedTime = expiresAtMs + 1;
  nativeCalls = 0;
  isArmed = true;
  const result =
    target === "codex" || target === "claude"
      ? provider.inspectRuntimeOwnedWindowsProviderHomeCandidate(
          target,
          context,
        )
      : store.inspectRuntimeOwnedWindowsRuntimeState(
          target.endsWith("-init"),
          context,
        );
  const shouldReturnCandidate =
    scenario === "checkout-normal" ||
    scenario === "normal" ||
    scenario === "post-source" ||
    scenario === "post-native" ||
    scenario === "post-repository" ||
    ((scenario === "cleanup-cancel" || scenario === "cleanup-expiry") &&
      !target.endsWith("-init"));
  assert.equal(result.status, shouldReturnCandidate ? "candidate" : "blocked");
  assert.equal(
    result.filesystemEffectIssued,
    target === "state-init" && nativeEffectObservations > 0,
    "初期化を要求した公開結果のEffectは失敗時も上位へ保持する",
  );
  const adapterNativeCalls = nativeCalls;
  if (
    [
      "source-hash-mismatch",
      "old-token-stale",
      "old-token-throw",
      "borrow-token-stale",
      "borrow-token-throw",
      "cleanup-old-token-stale",
    ].includes(scenario)
  )
    assert.equal(adapterNativeCalls, 0);
  if (scenario === "old-token-second") {
    assert.equal(priorTokenChecks, 2);
    assert.equal(adapterNativeCalls, 1);
  }
  if (scenario === "new-token-final") assert.equal(adapterNativeCalls, 1);
  if (shouldReturnCandidate) {
    assert.equal(
      adapterNativeCalls,
      scenario === "normal" || isCheckout ? 0 : 1,
      "one full check per lifecycle boundary; adapter post-observation reuses the same binding",
    );
    assert.equal(nativeEffectObservations, 1);
    assert.equal(result.artifactVerifiedBeforeAndAfter, true);
    if (isCheckout) {
      assert.equal(provenanceCalls, 0);
      assert.equal(
        result.executionSourceKind,
        "fixed_bootstrap_native_artifact",
      );
      assert.equal(result.nativeSourceRevision, null);
      assert.equal("releaseIdentityVerified" in result, false);
      assert.equal("nativeReleaseIdentityVerified" in result, false);
    }
    const capability =
      "observationCapability" in result
        ? result.observationCapability
        : result.rootCapability;
    assert.ok(capability);
    if (
      scenario === "post-source" ||
      scenario === "post-native" ||
      scenario === "post-repository"
    ) {
      assert.equal(
        boundary.beginInvocation(
          target === "claude" ? "claude" : "codex",
          "executor",
        ),
        null,
        "the next provider-effect boundary must reject the changed identity",
      );
    }
  } else {
    const isAfterSpawn =
      scenario.startsWith("post-") || scenario.startsWith("checkout-post-");
    assert.equal(nativeEffectObservations, isAfterSpawn ? 1 : 0);
    assert.equal(result.manualRecoveryRequired, isAfterSpawn);
    assert.equal(result.helperExitConfirmed, isAfterSpawn);
    const capability =
      "observationCapability" in result
        ? result.observationCapability
        : result.rootCapability;
    assert.equal(capability, null);
    if (isCheckout) {
      assert.equal(provenanceCalls, 0);
    }
  }
  assert.equal(publicObservationCalls, 1, "上位はPA公開観測へ一回だけ配送する");
  assert.equal(
    readerCalls,
    isCheckout
      ? 0
      : nativeEffectObservations > 0 && scenario !== "post-artifact"
        ? 2
        : 1,
    "固定結果の停止段階に対応したReader搬送",
  );
  assert.equal(
    session.cancelRuntimeOwnedDevelopmentMeasurementSession(
      admitted.capability,
    ),
    true,
  );
  assert.equal(
    session.borrowRuntimeOwnedDevelopmentNativeObservation(
      boundary.context,
      false,
    ),
    null,
  );
  process.stdout.write(
    JSON.stringify({
      target,
      scenario,
      adapterNativeCalls,
      nativeEffectObservations,
    }),
  );
}

if (process.argv[2] === "--probe") {
  await runProbe(process.argv[3] ?? "", process.argv[4] ?? "");
} else {
  for (const target of targets)
    for (const scenario of scenarios) {
      /**
       * 本番SessionとPA公開結果の結合: ${target} / ${scenario}を検証する。
       *
       * @responsibility 本番SessionとPA公開結果の結合: ${target} / ${scenario}の合否判定を所有する。
       * @trace ERB-IT-004
       * @precondition Test Fileが構築するfixtureと入力を使用する。
       * @stimulus 本番SessionとPA公開結果の結合: ${target} / ${scenario}の対象操作を実行する。
       * @observation 結果、状態、Effectおよび終了後条件を観測する。
       * @oracle Test本文のassertionが期待条件を満たす。
       * @cleanup Test本文または登録済みhookが作成資源を清掃する。
       * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
       */
      test(`本番SessionとPA公開結果の結合: ${target} / ${scenario}`, (context) => {
        if (process.platform !== "win32") {
          context.skip("Windows native adapter");
          return;
        }
        const result = spawnSync(
          process.execPath,
          [
            "--experimental-test-module-mocks",
            "--no-warnings",
            fileURLToPath(import.meta.url),
            "--probe",
            target,
            scenario,
          ],
          { encoding: "utf8", shell: false, timeout: 15_000 },
        );
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(
          [
            JSON.parse(result.stdout).target,
            JSON.parse(result.stdout).scenario,
          ],
          [target, scenario],
        );
      });
    }
}
