/**
 * coordinator:integration:development-native-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:development-native-observationが所有する検証責務を実行する。
 * @trace ERB-IT-004
 * @trace AIT-IT-002
 * @level IT
 * @scope development、native、observation
 * @boundary ERB-IT-004=Direct Boundary: Observer→Effect Gate
 */
import assert from "node:assert/strict";
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
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { observeRuntimeOwnedDevelopmentSource } from "../../src/task/development-source-observation.ts";

/**
 * 実Source観測本文をRepository内の自己生成Fixtureへ結合する。
 *
 * @responsibility 公開Root注入口を増やさず、実Filesystemの反例を確認する。
 * @trace ERB-IT-004
 * @precondition 現行Source本文を読める。
 * @stimulus 固定11Packageを最小Sourceで構成し、試験コピーのRoot定数だけを置き換える。
 * @observation 実本文の観測結果と自己生成Root。
 * @oracle 呼出し元が内容Hash・実体Hash・拒否を比較できる。
 * @cleanup 呼出し元のfinallyで自己生成Rootだけを削除する。
 * @boundary Node Filesystem。Docker・Native実行・外部AIには到達しない。
 */
async function createSourceObservationFixture(readMutation = "") {
  const directory = createRepositoryTestDirectory("development-source-");
  const root = directory.path;
  try {
    const source = readFileSync(
      new URL(
        "../../src/task/development-source-observation.ts",
        import.meta.url,
      ),
      "utf8",
    );
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
   * @precondition 固定11Packageの通常Fileが存在する。
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
      assert.equal(first.fileCount, 20);
      assert.equal(first.scope, "crdd-development-source-snapshot/v1");
      assert.ok(Object.isFrozen(first));
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
   * @precondition 10Package・20通常Fileの最小Fixtureが存在する。
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
      for (let i = 0; i < 2028; i += 1)
        writeFileSync(path.join(extras, `${i}.ts`), "");
      assert.equal(fixture.observe()?.fileCount, 2048);
      writeFileSync(path.join(extras, "overflow.ts"), "");
      assert.equal(fixture.observe(), null);
      rmSync(extras, { recursive: true });
      mkdirSync(extras);
      for (let i = 0; i < 2037; i += 1) mkdirSync(path.join(extras, String(i)));
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
        new URL(
          "../../src/task/development-source-observation.ts",
          import.meta.url,
        ),
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
        new URL(
          "../../src/task/development-measurement-session.ts",
          import.meta.url,
        ),
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
        const oldToken = Object.freeze({});
        const newToken = Object.freeze({});
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
          { token: object; verification: object; sourceObservation: object }
        >();
        if (scenario !== "map-missing")
          map.set(prior, {
            token: oldToken,
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
              scope: "crdd-development-source-snapshot/v1",
              sourceSha256: "c",
              sourceIdentitySha256: "source-identity",
            };
          },
          beginPlatformAccessBootstrapObservation: (root: string) => {
            assert.equal(root, "fixed-source");
            events.push("begin");
            replaced = scenario === "same-bytes-replaced";
            return { artifact, token: newToken };
          },
          verifyPlatformAccessArtifactObservation: (token: object) => {
            assert.ok(token === oldToken || token === newToken);
            events.push(token === oldToken ? "verify-old" : "verify-new");
            if (token === oldToken) {
              oldChecks += 1;
              return !(
                replaced ||
                scenario === "old-first" ||
                (scenario === "old-second" && oldChecks === 2)
              );
            }
            return scenario !== "new-final";
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
          assert.equal(saved.token, newToken);
          assert.equal(
            Reflect.get(saved.verification, "platformAccessArtifact"),
            artifact,
          );
          assert.equal(
            JSON.stringify(saved.sourceObservation),
            JSON.stringify({
              scope: "crdd-development-source-snapshot/v1",
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
      /if\s*\(\s*priorIdentity !== undefined &&\s*\(!prior \|\| !verifyPlatformAccessArtifactObservation\(prior.token\)\)\s*\)\s*return null;/u,
      /if\s*\(prior && !verifyPlatformAccessArtifactObservation\(prior.token\)\)\s*return null;/u,
      /if\s*\(!verifyPlatformAccessArtifactObservation\(native.token\)\)\s*return null;/u,
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
      const token = Object.freeze({});
      const verification = Object.freeze({ status: "candidate" });
      const map = new WeakMap<object, object>();
      if (scenario !== "missing") map.set(identity, { token, verification });
      let checks = 0;
      const borrow = runInNewContext(`(${borrowBody})`, {
        productionRuntime: {
          borrowNativeObservation: () => ({
            identity,
            distributionRoot: "fixed-source",
          }),
        },
        nativeVerifications: map,
        verifyPlatformAccessArtifactObservation: (received: object) => {
          assert.equal(received, token);
          checks += 1;
          if (scenario === "throws") throw new Error("observation_failed");
          return scenario !== "invalid";
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
  test("development source snapshot CLI describes the fixed source without creating a run", () => {
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
    "task/development-measurement-session.ts",
    "provider/home-windows-adapter.ts",
    "platform-access/protected-root-windows-adapter.ts",
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
  let spawnCalls = 0;
  let artifactCalls = 0;
  let provenanceCalls = 0;
  let tokenCalls = 0;
  let admissionToken: object | null = null;
  let latestBootstrapToken: object | null = null;
  let warmedToken: object | null = null;
  let priorTokenChecks = 0;
  const bootstrapTokens = new WeakSet<object>();
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
      "repository-operation-runtime": "repository-operation/binding.ts",
      "execution-environment":
        "host-execution/operation-workspace-lifecycle.ts",
      "development-source-observation":
        "task/development-source-observation.ts",
    };
    assert.ok(sources[name], name);
    return new URL(`../../src/${sources[name]}`, import.meta.url).href;
  };
  await mock.module(
    new URL("../../src/diagnostics/native-git-provenance.ts", import.meta.url)
      .href,
    {
      namedExports: {
        inspectPlatformAccessNativeGitProvenanceCandidate: () => {
          provenanceCalls += 1;
          throw new Error("runtime_must_not_use_git_provenance");
        },
      },
    },
  );
  await mock.module(moduleUrl("repository-operation-runtime"), {
    namedExports: {
      inspectRepositoryIdentityCandidate: () => ({
        commit:
          isArmed && spawnCalls > 0 && scenario === "post-repository"
            ? "9".repeat(40)
            : "a".repeat(40),
        tree: "b".repeat(40),
      }),
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
  await mock.module(moduleUrl("execution-environment"), {
    namedExports: {
      verifyOwnedOperationManagementCapability: (operation: object) => {
        assert.equal(operation, management);
        return { operationId: "fixture-operation" };
      },
    },
  });
  await mock.module(moduleUrl("development-source-observation"), {
    namedExports: {
      observeRuntimeOwnedDevelopmentSource: () => ({
        scope: "crdd-development-source-snapshot/v1",
        sourceSha256:
          isArmed && scenario === "source-hash-mismatch"
            ? "9".repeat(64)
            : "c".repeat(64),
        sourceIdentitySha256:
          isArmed && spawnCalls > 0 && scenario === "post-source"
            ? "9".repeat(64)
            : "2".repeat(64),
        fileCount: 22,
        totalBytes: 275,
      }),
    },
  });
  await mock.module(moduleUrl("native-artifact-observation"), {
    namedExports: {
      createWindowsNativeHelperEnvironment: () =>
        scenario === "environment" ? null : Object.freeze({}),
      WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE: "test_only",
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: artifact.relativePath,
      observePlatformAccessArtifactCandidate: () => {
        artifactCalls += 1;
        const isMismatch =
          (scenario === "pre-artifact" && artifactCalls === 1) ||
          (scenario === "post-artifact" && artifactCalls === 2) ||
          (scenario === "checkout-artifact-mismatch" && artifactCalls === 1) ||
          (scenario === "checkout-post-artifact-mismatch" &&
            artifactCalls === 2);
        return {
          status: "candidate",
          artifact: isMismatch
            ? { ...artifact, sha256: "9".repeat(64) }
            : artifact,
        };
      },
      beginPlatformAccessArtifactObservation: () => ({
        artifact,
        token: Object.freeze({}),
      }),
      beginPlatformAccessBootstrapObservation: (distributionRoot: string) => {
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
        const token = Object.freeze({});
        bootstrapTokens.add(token);
        admissionToken ??= token;
        latestBootstrapToken = token;
        return {
          artifact:
            isArmed && spawnCalls > 0 && scenario === "post-native"
              ? { ...artifact, sha256: "9".repeat(64) }
              : artifact,
          token,
        };
      },
      verifyPlatformAccessArtifactObservation: (token: object) => {
        tokenCalls += 1;
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
              return false;
          }
          if (
            scenario === "new-token-final" &&
            token === latestBootstrapToken &&
            token !== admissionToken
          )
            return false;
          if (scenario === "borrow-token-stale" && token === warmedToken)
            return false;
          if (scenario === "borrow-token-throw" && token === warmedToken)
            throw new Error("borrow_token_observation_failed");
          if (
            scenario === "post-borrow-token" &&
            spawnCalls > 0 &&
            bootstrapTokens.has(token)
          )
            return false;
        }
        return !(
          (isArmed && scenario === "checkout-pre-token" && tokenCalls === 1) ||
          (isArmed && scenario === "checkout-post-token" && tokenCalls === 2)
        );
      },
    },
  });
  await mock.module("node:child_process", {
    namedExports: {
      spawnSync: (
        _executable: string,
        argv: string[],
        options: { input: Buffer; shell: boolean },
      ) => {
        spawnCalls += 1;
        assert.deepEqual(argv, []);
        assert.equal(options.shell, false);
        // The real request encoder and response validator share this fixed native wire contract.
        const bytes = Buffer.alloc(182);
        bytes.write("CRDDHO02", 0, "ascii");
        bytes.writeUInt16LE(3, 8);
        assert.equal(options.input.length, 76);
        bytes[10] = options.input[10] ?? 0;
        bytes[11] = 1;
        options.input.copy(bytes, 12, 12, 44);
        bytes.writeUInt16LE(100, 44);
        bytes.writeUInt32LE(0x83, 46);
        bytes.writeUInt32LE(0x1ff, 50);
        for (let n = 0; n < 4; n += 1)
          bytes.fill(n + 1, 54 + n * 32, 86 + n * 32);
        return {
          pid: 123,
          status: 0,
          signal: null,
          stdout: bytes,
          stderr: Buffer.alloc(0),
        };
      },
    },
  });
  const session = await import(
    "../../src/task/development-measurement-session.ts"
  );
  const provider = await import("../../src/provider/home-windows-adapter.ts");
  const store = await import(
    "../../src/platform-access/protected-root-windows-adapter.ts"
  );
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
    assert.equal(spawnCalls, 0);
    process.stdout.write(
      JSON.stringify({
        target,
        scenario,
        adapterNativeCalls: 0,
        spawnCalls: 0,
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
      scope: "crdd-development-source-snapshot/v1",
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
  tokenCalls = 0;
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
      scenario === "normal" ? 0 : 1,
      "one full check per lifecycle boundary; adapter post-observation reuses the same binding",
    );
    assert.equal(spawnCalls, 1);
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
    assert.equal(spawnCalls, isAfterSpawn ? 1 : 0);
    assert.equal(result.manualRecoveryRequired, isAfterSpawn);
    assert.equal(result.helperExitConfirmed, isAfterSpawn);
    const capability =
      "observationCapability" in result
        ? result.observationCapability
        : result.rootCapability;
    assert.equal(capability, null);
    if (isCheckout) {
      assert.equal(provenanceCalls, 0);
      assert.equal(
        artifactCalls,
        scenario === "checkout-post-token"
          ? 1
          : isAfterSpawn
            ? 2
            : scenario === "checkout-bootstrap-missing"
              ? 0
              : 1,
      );
    }
  }
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
    JSON.stringify({ target, scenario, adapterNativeCalls, spawnCalls }),
  );
}

if (process.argv[2] === "--probe") {
  await runProbe(process.argv[3] ?? "", process.argv[4] ?? "");
} else {
  for (const target of targets)
    for (const scenario of scenarios) {
      /**
       * 本番sessionとnative Adapterの結合: ${target} / ${scenario}を検証する。
       *
       * @responsibility 本番sessionとnative Adapterの結合: ${target} / ${scenario}の合否判定を所有する。
       * @trace ERB-IT-004
       * @precondition Test Fileが構築するfixtureと入力を使用する。
       * @stimulus 本番sessionとnative Adapterの結合: ${target} / ${scenario}の対象操作を実行する。
       * @observation 結果、状態、Effectおよび終了後条件を観測する。
       * @oracle Test本文のassertionが期待条件を満たす。
       * @cleanup Test本文または登録済みhookが作成資源を清掃する。
       * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
       */
      test(`本番sessionとnative Adapterの結合: ${target} / ${scenario}`, (context) => {
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
  /**
   * Host記録と対象観測の出所前後照合を実本文で反証する。
   *
   * @responsibility 通常Bootstrap観測の欠測・実体差、開発再借用、取消と記録Effectの不明を区別する。
   * @trace AIT-IT-002
   * @trace ERB-IT-004
   * @precondition 現Sourceの二private実行本文と非Authorityのmemory依存だけを使う。
   * @stimulus 二クラスのsave/read/observeに出所・実体・token・搬送・取消の故障を注入する。
   * @observation 発行・decoder回数、終了、参照、記録Effect、出所情報を取得する。
   * @oracle 前提拒否はspawn0、post拒否はdecode0、saveは不明を保持。各比較を外した変異は専用反例で誤成功する。
   * @cleanup N/A: 実Process・Filesystem・Docker・Providerは操作しない。
   * @boundary 本番Adapter本文と模擬Native依存。実Native Protocol・ACL・E2Eは未証明。
   */
  test("Host Native実行は署名なしの出所前後照合と部分結果を保持する", () => {
    const source = readFileSync(
      new URL(
        "../../src/host-execution/terminal-windows-adapter.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const artifact = Object.freeze({
      relativePath: "fixed/native.exe",
      target: "windows",
      protocolRevision: 3,
      rustToolchain: "fixed",
      byteLength: 1,
      sha256: "fixed",
    });
    for (const mode of ["save", "read", "observe"] as const) {
      const functionName =
        mode === "observe"
          ? "executeTerminalObservationRequest"
          : "executeHostTerminalRecordRequest";
      const start = source.indexOf(`function ${functionName}<`);
      const end = source.indexOf("\n/**", start);
      assert.ok(start >= 0 && end > start);
      const body = stripTypeScriptTypes(source.slice(start, end));
      for (const recordClass of ["eleven", "known_file"] as const) {
        for (const scenario of [
          "normal",
          "initial_missing",
          "initial_throw",
          "initial_artifact",
          "begin_missing",
          "pre_token_false",
          "pre_token_throw",
          "post_token_false",
          "post_token_throw",
          "post_direct_artifact",
          "transport",
          "exit_mismatch",
          "dev_initial",
          "dev_verification",
          "dev_final",
          "dev_normal",
          ...(mode === "observe"
            ? []
            : ["cancel_before", "cancel_at_environment", "cancel_after"]),
        ]) {
          const mutation =
            scenario === "post_token_false" || scenario === "pre_token_false"
              ? {
                  pattern:
                    /!verifyPlatformAccessArtifactObservation\(artifactObservation\.token\)/gu,
                  replacement:
                    "(verifyPlatformAccessArtifactObservation(artifactObservation.token), false)",
                }
              : scenario === "post_direct_artifact"
                ? {
                    pattern:
                      /JSON\.stringify\(before\.artifact\)\s*!==\s*JSON\.stringify\(after\.artifact\)/u,
                    replacement: "false",
                  }
                : null;
          for (const isMutant of mutation ? [false, true] : [false]) {
            const label = `${mode}/${recordClass}/${scenario}/mutant=${isMutant}`;
            const selectedBody =
              isMutant && mutation
                ? body.replace(mutation.pattern, mutation.replacement)
                : body;
            if (isMutant) assert.notEqual(selectedBody, body, label);
            let launches = 0;
            let provenanceCalls = 0;
            let artifactCalls = 0;
            let borrowCalls = 0;
            let decodeCalls = 0;
            let tokenCalls = 0;
            const request = Object.freeze({});
            const contexts = new WeakMap([
              [
                request,
                { reference: "fixture-reference", bytesBase64: "AA==" },
              ],
            ]);
            const controller = new AbortController();
            if (scenario === "cancel_before") controller.abort();
            const development = scenario.startsWith("dev_");
            const execute = runInNewContext(`(${selectedBody})`, {
              Buffer,
              Object,
              JSON,
              path,
              process: { platform: "win32" },
              bundledDistributionRoot: "fixed-distribution",
              PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: "fixed/native.exe",
              MAX_SAVE_RESPONSE_BYTES: 2048,
              MAX_RESPONSE_BYTES: 4096,
              borrowRuntimeOwnedDevelopmentNativeObservation: () => {
                borrowCalls += 1;
                return scenario === "dev_initial" ||
                  (scenario === "dev_final" && borrowCalls === 2)
                  ? null
                  : {
                      distributionRoot: "fixed-distribution",
                      verification: {
                        status:
                          scenario === "dev_verification"
                            ? "blocked"
                            : "candidate",
                        platformAccessArtifact: artifact,
                      },
                    };
              },
              inspectPlatformAccessNativeGitProvenanceCandidate: () => {
                provenanceCalls += 1;
                throw new Error("runtime_must_not_read_git_provenance");
              },
              beginPlatformAccessBootstrapObservation: () => {
                if (scenario === "initial_throw") throw new Error("bootstrap");
                return ["initial_missing", "begin_missing"].includes(scenario)
                  ? null
                  : { artifact, token: {} };
              },
              observePlatformAccessArtifactCandidate: () => {
                artifactCalls += 1;
                return {
                  status: "candidate",
                  artifact:
                    (scenario === "initial_artifact" && artifactCalls === 1) ||
                    (scenario === "post_direct_artifact" && artifactCalls === 2)
                      ? { ...artifact, sha256: "changed" }
                      : artifact,
                };
              },
              beginPlatformAccessArtifactObservation: () =>
                scenario === "begin_missing" ? null : { artifact, token: {} },
              verifyPlatformAccessArtifactObservation: () => {
                tokenCalls += 1;
                const stage = tokenCalls === 1 ? "pre" : "post";
                if (scenario === `${stage}_token_throw`)
                  throw new Error("fixture");
                return scenario !== `${stage}_token_false`;
              },
              createWindowsHostTerminalHelperEnvironment: () => {
                if (scenario === "cancel_at_environment") controller.abort();
                return {};
              },
              spawnSync: (
                _file: string,
                argv: string[],
                options: { shell: boolean; timeout: number; input: Buffer },
              ) => {
                launches += 1;
                assert.equal(options.shell, false, label);
                assert.equal(options.timeout, 5000, label);
                assert.deepEqual(
                  Array.from(argv),
                  [
                    `--host-terminal-${recordClass === "known_file" ? "known-file-" : ""}${mode}`,
                  ],
                  label,
                );
                if (scenario === "cancel_after") controller.abort();
                return {
                  pid: 1,
                  status:
                    scenario === "transport"
                      ? null
                      : scenario === "exit_mismatch"
                        ? 2
                        : 0,
                  signal: null,
                  ...(scenario === "transport"
                    ? { error: new Error("fixture") }
                    : {}),
                  stdout: Buffer.alloc(0),
                  stderr: Buffer.alloc(0),
                };
              },
            }) as (...args: unknown[]) => Record<string, unknown>;
            /**
             * 拒否時に出力Decoderへ到達しないことを計数する。
             * @responsibility 拒否時に出力Decoderへ到達しないことを計数する。
             * @trace AIT-IT-002
             * @trace ERB-IT-004
             * @precondition 保存・観測結果の有限Decoder代役。
             * @stimulus 呼出し時だけdecodeCallsを増やし固定phaseを返す。
             * @observation decodeCallsと開始拒否結果。
             * @oracle 出力読取り前の拒否ではDecoder呼出し0。
             * @cleanup N/A: 計数と返却値のみ。
             * @boundary Native起動境界の代役。実Native処置は行わない。
             */
            const decode = () => {
              decodeCalls += 1;
              return {
                status: mode === "save" ? "saved" : "observed",
                recordEffectIssued: mode === "save",
                observation: { phase: 3 },
              };
            };
            const result =
              mode === "observe"
                ? execute(
                    request,
                    development ? {} : undefined,
                    recordClass,
                    contexts,
                    decode,
                  )
                : execute(
                    request,
                    mode,
                    controller.signal,
                    development ? {} : undefined,
                    contexts,
                    decode,
                    decode,
                    `--host-terminal-${recordClass === "known_file" ? "known-file-" : ""}${mode}`,
                  );
            const succeeds =
              isMutant || scenario === "normal" || scenario === "dev_normal";
            assert.equal(
              result.status,
              succeeds
                ? mode === "observe"
                  ? "observed"
                  : "completed"
                : "blocked",
              label,
            );
            const noLaunch =
              !isMutant &&
              (scenario.startsWith("initial_") ||
                scenario.startsWith("pre_token_") ||
                scenario === "begin_missing" ||
                scenario === "dev_initial" ||
                scenario === "dev_verification" ||
                scenario === "cancel_before" ||
                scenario === "cancel_at_environment");
            assert.equal(launches, noLaunch ? 0 : 1, label);
            assert.equal(
              result.helperExitConfirmed,
              launches === 1 && scenario !== "transport",
              label,
            );
            if (mode !== "observe") {
              assert.equal(result.reference, "fixture-reference", label);
              assert.equal(
                result.recordEffectIssued,
                mode === "read" || noLaunch
                  ? false
                  : succeeds || scenario === "cancel_after"
                    ? true
                    : null,
                label,
              );
            } else assert.equal(result.filesystemEffectIssued, false, label);
            assert.equal(
              decodeCalls,
              succeeds ||
                scenario === "exit_mismatch" ||
                scenario === "cancel_after"
                ? 1
                : 0,
              label,
            );
            assert.equal(provenanceCalls, 0, label);
            if (scenario === "dev_verification")
              assert.equal(
                result.reason,
                "host_terminal_artifact_bootstrap_unavailable",
              );
            if (scenario === "initial_missing")
              assert.equal(
                result.reason,
                "host_terminal_artifact_bootstrap_unavailable",
              );
            if (scenario === "cancel_before")
              assert.equal(provenanceCalls, 0, label);
            if (mode === "observe" && succeeds) {
              assert.equal(
                Object.isFrozen(result.nativeProvenance),
                true,
                label,
              );
              const metadata = result.nativeProvenance as {
                artifact: object;
                repositoryRevision: object | null;
              };
              assert.equal(Object.isFrozen(metadata.artifact), true, label);
              assert.equal(
                metadata.repositoryRevision === null ||
                  Object.isFrozen(metadata.repositoryRevision),
                true,
                label,
              );
            }
          }
        }
      }
    }
  });

  /**
   * 通常Home／保護Rootの固定Bootstrap接続を実本体で反証する。
   * @responsibility 開始・前後確認省略を、旧配布本文Hashとは独立に検出する。
   * @trace ERB-IT-004
   * @precondition 現在の二Adapter本文を抽出し、外部依存だけを局所代役にする。
   * @stimulus 正常、開始欠測、要求前後token失効と各検査省略を与える。
   * @observation 同token・呼出し順、固定Process構成、結果、要求済み事実を確認する。
   * @oracle 正常だけ候補、前拒否は要求0、後拒否は要求済みを保持。変異は同Oracleで失敗する。
   * @cleanup N/A: 実Process・Filesystem・Docker・Providerは操作しない。
   * @boundary 通常Adapter実本文→PA固定BootstrapとNative Processの局所搬送。
   */
  test("通常NativeのBootstrap開始・前後確認省略を同じOracleで検出する", () => {
    for (const [relative, functionName, provider] of [
      [
        "provider/home-windows-adapter.ts",
        "inspectRuntimeOwnedWindowsProviderHomeCandidate",
        true,
      ],
      [
        "platform-access/protected-root-windows-adapter.ts",
        "inspectRuntimeOwnedWindowsProtectedRoot",
        false,
      ],
    ] as const) {
      const source = readFileSync(
        new URL(`../../src/${relative}`, import.meta.url),
        "utf8",
      );
      const start = source.indexOf(`function ${functionName}(`);
      const end = source.indexOf("\n}\n", start) + 2;
      const sameStart = source.indexOf("function sameArtifact(");
      const sameEnd = source.indexOf("\n}\n", sameStart) + 2;
      assert.ok(
        start > 0 && end > start && sameStart > 0 && sameEnd > sameStart,
      );
      const body = stripTypeScriptTypes(source.slice(start, end));
      const same = stripTypeScriptTypes(source.slice(sameStart, sameEnd));
      /**
       * 同じ本番本文を固定した正常・故障Oracleへ渡す。
       * @responsibility 外部依存代役の呼出し順と前後token参照を確認する。
       * @trace ERB-IT-004
       * @precondition 現本文または一条件だけ変更した本文を受け取る。
       * @stimulus 固定Bootstrap欠測、前失効、後失効、正常を順に実行する。
       * @observation 候補・要求回数・元token・各Process optionを照合する。
       * @oracle 正常と拒否の双方が同じ本文で成立する。
       * @cleanup N/A: memory内の代役だけ。
       * @boundary 実Adapter本文と非Authority局所依存。
       */
      const oracle = (selected: string) => {
        for (const fault of [
          "normal",
          "missing",
          "pre",
          "post",
          "development",
        ] as const) {
          const events: string[] = [];
          const token = Object.freeze({});
          const environment = Object.freeze({});
          const artifact = Object.freeze({
            relativePath: "fixed/native.exe",
            target: "windows",
            protocolRevision: 3,
            rustToolchain: "fixed",
            byteLength: 1,
            sha256: "fixed",
          });
          const request = {
            request: Buffer.alloc(1),
            nonce: "nonce",
            provider: "codex",
          };
          /**
           * 固定Bootstrap試験へ候補の正常観測値を供給する。
           * @responsibility 固定Bootstrap試験へ候補の正常観測値を供給する。
           * @trace ERB-IT-004
           * @precondition 本番Bootstrapを評価するVM入力。
           * @stimulus candidate状態の固定値だけを返す。
           * @observation 後続検証の到達数と固定入口拒否。
           * @oracle 他の不正条件を候補欠測の失敗で隠さない。
           * @cleanup N/A: メモリ値だけ。
           * @boundary 候補観測代役であり旧Storeを生成しない。
           */
          const candidate = () => ({ status: "candidate" });
          let verifies = 0;
          let spawns = 0;
          const execute = runInNewContext(`${same}\n(${selected})`, {
            Buffer,
            Object,
            Date,
            performance,
            path,
            process: { platform: "win32" },
            bundledDistributionRoot: "C:\\fixed",
            executablePath: "C:\\fixed\\native.exe",
            HELPER_TIMEOUT_MS: 5000,
            PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES: 182,
            runtimeOwnedProviderHomeMountSourceCandidate: () => "C:\\home",
            rootPathCandidate: () => "C:\\root",
            createProviderHomeObservationRequest: () => request,

            createRuntimeStateObservationRequest: () => request,
            beginPlatformAccessBootstrapObservation: (root: string) => {
              events.push("begin");
              assert.equal(root, "C:\\fixed");
              return fault === "missing" ? null : { token, artifact };
            },
            beginPlatformAccessArtifactObservation: () => {
              throw new Error("normal_must_use_bootstrap");
            },
            borrowRuntimeOwnedDevelopmentNativeObservation: () => {
              if (fault === "development")
                return {
                  distributionRoot: "C:\\fixed",
                  verification: { status: "blocked" },
                };
              throw new Error("normal_must_not_borrow_development");
            },
            observePlatformAccessArtifactCandidate: () => {
              events.push("artifact");
              return { status: "candidate", artifact };
            },
            verifyPlatformAccessArtifactObservation: (value: object) => {
              assert.equal(value, token);
              verifies += 1;
              events.push(`verify${verifies}`);
              return (
                !(fault === "pre" && verifies === 1) &&
                !(fault === "post" && verifies === 2)
              );
            },
            createWindowsNativeHelperEnvironment: () => environment,
            spawnSync: (
              file: string,
              argv: string[],
              options: {
                env: object;
                shell: boolean;
                windowsHide: boolean;
                timeout: number;
                maxBuffer: number;
                encoding: string;
                input: Buffer;
              },
            ) => {
              assert.equal(file, "C:\\fixed\\native.exe");
              assert.deepEqual(Array.from(argv), []);
              assert.equal(options.env, environment);
              assert.equal(options.shell, false);
              assert.equal(options.windowsHide, true);
              assert.equal(options.timeout, 5000);
              assert.equal(options.maxBuffer, 183);
              assert.equal(options.encoding, "buffer");
              assert.equal(options.input, request.request);
              spawns += 1;
              events.push("spawn");
              return {
                pid: 1,
                status: 0,
                signal: null,
                stdout: Buffer.alloc(182),
                stderr: Buffer.alloc(0),
              };
            },
            evaluateProviderHomeObservationResponseCandidate: candidate,

            evaluateRuntimeStateObservationResponseCandidate: candidate,
            rootCapabilities: new WeakMap(),
            mountSourceCapabilities: new WeakMap(),
            observationCapabilities: new WeakMap(),
            blocked: (reason: string, detail = {}) => ({
              status: "blocked",
              reason,
              processEffectIssued: false,
              ...detail,
            }),
          }) as (...args: unknown[]) => Record<string, unknown>;
          const result = provider
            ? execute("codex", fault === "development" ? {} : undefined)
            : execute(
                "runtime_state",
                false,
                fault === "development" ? {} : undefined,
              );
          assert.equal(
            result.status,
            fault === "normal" ? "candidate" : "blocked",
            `${relative}/${fault}`,
          );
          assert.equal(spawns, fault === "normal" || fault === "post" ? 1 : 0);
          assert.equal(result.processEffectIssued, spawns === 1);
          if (fault === "development")
            assert.match(
              String(result.reason),
              /_artifact_bootstrap_unavailable$/u,
            );
          if (fault === "missing")
            assert.match(
              String(result.reason),
              /_artifact_bootstrap_unavailable$/u,
            );
          if (fault === "normal") {
            assert.deepEqual(events, [
              "begin",
              "artifact",
              "verify1",
              "spawn",
              "verify2",
              "artifact",
            ]);
            assert.equal(result.nativeSourceRevision, null);
            assert.equal(
              result.executionSourceKind,
              "fixed_bootstrap_native_artifact",
            );
          }
        }
      };
      oracle(body);
      const gate =
        "!verifyPlatformAccessArtifactObservation(artifactObservation.token)";
      assert.equal(body.split(gate).length, 3);
      for (const selected of [
        body.replace(
          "beginPlatformAccessBootstrapObservation(distributionRoot)",
          "null",
        ),
        body.replace(gate, "false"),
        body.replaceAll(gate, "false"),
        body.replace("shell: false", "shell: true"),
        body.replace(
          "spawnSync(selectedExecutable, [],",
          'spawnSync(selectedExecutable, ["--other"],',
        ),
      ]) {
        assert.notEqual(selected, body);
        assert.throws(() => oracle(selected), { name: "AssertionError" });
      }
    }
  });
}
