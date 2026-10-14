/**
 * Host保存先準備とCLI起動条件を検証する。
 * @packageDocumentation
 * @responsibility 自己生成Rootだけで部分作成・旧入力・拒否・対話終了を反証する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @trace RFD-IT-017
 * @level IT
 * @scope access-management/initialization、Host入口の局所接続
 * @boundary 実Filesystemと局所TTY代役。実Host TTYは対象外。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PassThrough, Writable } from "node:stream";
import test, { type TestContext } from "node:test";
import {
  prepareHostInitializationRoot,
  readExistingHostRoot,
  resolveHostRootInput,
  runHostAccessCommand,
  initializeFromHost,
  createCredentialMaterial,
  parseAccessManagementState,
  exchangeCredentialsFromHost,
  recordCredentialPresentation,
  readAccessManagementState,
  type AccessManagementState,
} from "../../../src/index.ts";
import {
  resolveCrosRuntimeRoots,
  type CrosRootInput,
} from "../../../../domain-model/src/index.ts";
import {
  verifyRepositoryRootFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
} from "../../../../version-control/src/index.ts";

/**
 * Repository markerのDirectoryとworktree File両形態を検査する。
 * @responsibility .gitの種類だけで正規worktreeを拒否しない。
 * @trace RFD-IT-025
 * @precondition Root自体は既存VCS verifierで別途確定する。
 * @stimulus .gitのlstatを取得する。
 * @observation 通常FileまたはDirectory、非linkを確認する。
 * @oracle markerの種類をRoot Authorityの証明にしない。
 * @cleanup N/A: metadata読取りだけ。
 * @boundary 試験Root確定とmarker形態確認。
 */
function assertRepositoryMarker(markerPath: string): void {
  const marker = fs.lstatSync(markerPath);
  assert.equal(marker.isSymbolicLink(), false);
  assert.ok(marker.isDirectory() || marker.isFile());
}

/**
 * 用途限定の模擬OS baseをRepository内に準備する。
 * @responsibility Host実領域を使わず、生成Rootと清掃範囲を一致させる。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition WindowsまたはLinuxでRepository実Rootを確認する。
 * @stimulus .crdd/tests配下に一回性Directoryと模擬Host baseを作る。
 * @observation realpathと親包含、生成済みPathを確認する。
 * @oracle 実AppData／Homeへの書込み0。
 * @cleanup exact試験Rootのみ削除し不存在を確認する。
 * @boundary Repository-local試験領域とHost構成代役。
 */
function fixture(t: TestContext) {
  const repository = path.resolve(import.meta.dirname, "../../../../..");
  const verified = verifyRepositoryRootFromWorkingDirectory(repository);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw new Error("test_repository_unverified");
  assert.equal(resolveVerifiedRepositoryRoot(verified.capability), repository);
  assertRepositoryMarker(path.join(repository, ".git"));
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "access-management-host-"),
  );
  const base = path.join(directory, "host");
  fs.mkdirSync(base);
  const input: CrosRootInput =
    process.platform === "win32"
      ? {
          platform: "win32",
          publisher: "qual-lab",
          application: "cros",
          trustDomainId: "local-test",
          localAppData: base,
        }
      : {
          platform: "linux",
          publisher: "qual-lab",
          application: "cros",
          trustDomainId: "local-test",
          homeDirectory: base,
          xdgStateHome: base,
        };
  const resolved = resolveCrosRuntimeRoots(input);
  assert.ok(resolved);
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const environment =
    process.platform === "win32"
      ? { CROS_TRUST_DOMAIN_ID: "local-test", LOCALAPPDATA: base }
      : {
          CROS_TRUST_DOMAIN_ID: "local-test",
          HOME: base,
          XDG_STATE_HOME: base,
        };
  return { directory, base, input, environment, state: resolved.state };
}

/**
 * 通常起動用のRoot確認が初期化や作成を行わないことを確認する。
 * @responsibility 不在拒否と既存実体読取りを区別し、管理内容を変更しない。
 * @trace RFD-IT-024
 * @precondition 自己生成の空Host baseだけを使う。
 * @stimulus 不在・既存・非Directoryの保存先と不足環境を確認する。
 * @observation Directory一覧、保存内容、Root結果を直接比較する。
 * @oracle 不在と不正はnull、既存だけRootを返し、全呼出しで作成・内容変更0。
 * @cleanup Fixtureがexact Rootを回収する。
 * @boundary 公開Root入力選択と実Filesystem読取り。
 */
test("通常起動のHost Root読取りは保存先を作成しない", (t) => {
  const f = fixture(t);
  assert.deepEqual(resolveHostRootInput(f.environment), f.input);
  assert.equal(resolveHostRootInput({}), null);
  assert.equal(readExistingHostRoot(f.input), null);
  assert.deepEqual(fs.readdirSync(f.base), []);
  const prepared = prepareHostInitializationRoot(f.input);
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  const marker = path.join(f.state, "access-management.json");
  fs.writeFileSync(marker, "unparsed-state-marker");
  const before = fs.readdirSync(f.state);
  assert.equal(readExistingHostRoot(f.input)?.root, prepared.root.root);
  assert.deepEqual(fs.readdirSync(f.state), before);
  assert.equal(fs.readFileSync(marker, "utf8"), "unparsed-state-marker");
  fs.unlinkSync(marker);
  fs.rmdirSync(f.state);
  fs.writeFileSync(f.state, "not-directory");
  assert.equal(readExistingHostRoot(f.input), null);
  assert.equal(fs.readFileSync(f.state, "utf8"), "not-directory");
});

/**
 * 通常Reader固有のRoot境界と二観測相関を反証する。
 * @responsibility 初回準備の試験を流用せず、読取り入口の拒否とEffect0を観測する。
 * @trace RFD-IT-024
 * @precondition 自己生成Root、junctionとmetadata故障注入を使用する。
 * @stimulus Root／親Link、異OS、相対base、検証後dev／ino差を与える。
 * @observation null、Filesystem変更呼出し数、既存markerのbyteを確認する。
 * @oracle 全反例でCapabilityなし、作成・更新・削除0、target不変。
 * @cleanup 注入をfinallyで復元し、Fixtureだけが自己生成領域を回収する。
 * @boundary 通常Root読取りとFilesystem実体Identity。
 */
test("通常Host ReaderはLinkと入力不正と二観測のIdentity差を拒否する", (t) => {
  for (const mode of [
    "root-link",
    "parent-link",
    "platform",
    "relative",
    "dev",
    "ino",
  ] as const) {
    const f = fixture(t);
    const target = path.join(f.directory, "target");
    fs.mkdirSync(target);
    const marker = path.join(target, "marker.txt");
    fs.writeFileSync(marker, "unchanged-target");
    let input = f.input;
    if (mode === "root-link") {
      fs.mkdirSync(path.dirname(f.state), { recursive: true });
      fs.symlinkSync(target, f.state, "junction");
    } else if (mode === "parent-link") {
      fs.mkdirSync(path.join(target, "cros", "local-test"), {
        recursive: true,
      });
      fs.symlinkSync(target, path.join(f.base, "qual-lab"), "junction");
    } else {
      assert.equal(prepareHostInitializationRoot(f.input).status, "ready");
      if (mode === "platform") {
        input =
          process.platform === "win32"
            ? {
                platform: "linux",
                publisher: "qual-lab",
                application: "cros",
                trustDomainId: "local-test",
                homeDirectory: f.base,
              }
            : {
                platform: "win32",
                publisher: "qual-lab",
                application: "cros",
                trustDomainId: "local-test",
                localAppData: f.base,
              };
      } else if (mode === "relative") {
        input =
          f.input.platform === "win32"
            ? { ...f.input, localAppData: "relative-base" }
            : {
                ...f.input,
                homeDirectory: "relative-base",
                xdgStateHome: "relative-base",
              };
      }
    }
    let effects = 0;
    /**
     * 通常Host Readerからの書込み要求を試験失敗にする。
     * @responsibility 不正入力時に保存先作成・削除がないことを計測する。
     * @trace RFD-IT-025
     * @precondition 自己生成RootでFilesystem書込み関数を差し替える。
     * @stimulus mkdir・write・remove系の呼出し。
     * @observation 呼出し数と固定例外。
     * @oracle 通常ReaderのFilesystem書込み0。
     * @cleanup t.mockが各関数を復元する。
     * @boundary 通常Host読取りの禁止Effect監視。
     */
    const rejectEffect = () => {
      effects++;
      throw new Error("unexpected_reader_effect");
    };
    t.mock.method(fs, "mkdirSync", rejectEffect);
    t.mock.method(fs, "writeFileSync", rejectEffect);
    t.mock.method(fs, "rmSync", rejectEffect);
    t.mock.method(fs, "unlinkSync", rejectEffect);
    t.mock.method(fs, "rmdirSync", rejectEffect);
    const lstat = fs.lstatSync;
    let bigintRootVisits = 0;
    if (mode === "dev" || mode === "ino") {
      t.mock.method(fs, "lstatSync", ((
        entry: fs.PathLike,
        options?: fs.StatOptions,
      ) => {
        const metadata = lstat(entry, options);
        if (
          String(entry) === f.state &&
          options?.bigint &&
          ++bigintRootVisits === 3
        ) {
          const original = metadata as fs.BigIntStats;
          return Object.assign(Object.create(original), {
            [mode]: original[mode] + 1n,
          });
        }
        return metadata;
      }) as typeof fs.lstatSync);
    }
    try {
      assert.equal(readExistingHostRoot(input), null, mode);
      assert.equal(effects, 0, mode);
      assert.equal(fs.readFileSync(marker, "utf8"), "unchanged-target");
      if (mode === "dev" || mode === "ino") assert.ok(bigintRootVisits >= 3);
    } finally {
      t.mock.restoreAll();
    }
  }
});

/**
 * 不足chainの作成と既存Root再利用を確認する。
 * @responsibility 作成集合と保存Authorityを混同しない。
 * @trace RFD-IT-024
 * @precondition 空の模擬OS base。
 * @stimulus 準備を二回呼び、無関係なFileも置く。
 * @observation 作成Path集合、Capability、旧入力分類とAM current不存在。
 * @oracle 初回3Directory、再入場0、無関係Fileで開始分類を変えない。
 * @cleanup FixtureがRootを回収する。
 * @boundary 公開Host Root準備と実Filesystem。
 */
test("Host Rootは不足chainだけ作成し再入場で追加作成しない", (t) => {
  const f = fixture(t);
  const first = prepareHostInitializationRoot(f.input);
  assert.equal(first.status, "ready");
  assert.deepEqual(first.createdDirectories, [
    path.join(f.base, "qual-lab"),
    path.join(f.base, "qual-lab", "cros"),
    f.state,
  ]);
  if (first.status !== "ready") return;
  assert.deepEqual(first.observePrevious(), {
    management: "uninitialized",
    attempt: "absent",
    reason: "legacy_inputs_absent",
  });
  fs.writeFileSync(path.join(f.state, "unrelated.txt"), "not-management");
  const again = prepareHostInitializationRoot(f.input);
  assert.equal(again.status, "ready");
  assert.deepEqual(again.createdDirectories, []);
  assert.equal(
    again.status === "ready" && again.observePrevious().reason,
    "legacy_inputs_absent",
  );
  assert.equal(
    fs.existsSync(path.join(f.state, "access-management.json")),
    false,
  );
  for (const base of [`${f.base}${path.sep}`, `${f.base}${path.sep}.`]) {
    const input: CrosRootInput =
      process.platform === "win32"
        ? { ...f.input, localAppData: base }
        : { ...f.input, xdgStateHome: base };
    const normalized = prepareHostInitializationRoot(input);
    assert.equal(normalized.status, "ready");
    assert.deepEqual(normalized.createdDirectories, []);
    if (normalized.status === "ready")
      assert.equal(normalized.root.root, first.root.root);
  }
});

/**
 * 未作成の宣言state baseをexact祖先chainから準備する。
 * @responsibility base自体の不足を有効Root構成の拒否へ変換しない。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 未作成の模擬LOCALAPPDATA／XDG_STATE_HOME。Linux HOMEは既存。
 * @stimulus 複数不足祖先、部分作成故障、file／link／観測不能を与える。
 * @observation exact作成順序とblockedの作成集合。
 * @oracle roots.stateの祖先以外作成0、既知部分作成は保持。
 * @cleanup Fixture回収と注入解除。
 * @boundary 現実行OSのFilesystem。同じ不足chain算法の反証で他OS実行は主張しない。
 */
test("Hostの未作成宣言baseを既存祖先からexact順に作成する", (t) => {
  for (const mode of [
    "normal",
    "partial",
    "file",
    "link",
    "unknown",
  ] as const) {
    const f = fixture(t);
    const first = path.join(f.base, "state-parent");
    const missing = path.join(first, "state-base");
    const input: CrosRootInput =
      process.platform === "win32"
        ? { ...f.input, localAppData: missing }
        : { ...f.input, xdgStateHome: missing };
    const target = resolveCrosRuntimeRoots(input);
    assert.ok(target);
    if (mode === "file") fs.writeFileSync(first, "not-directory");
    if (mode === "link") fs.symlinkSync(f.base, first, "junction");
    const mkdir = fs.mkdirSync;
    const lstat = fs.lstatSync;
    fs.mkdirSync = ((
      directory: fs.PathLike,
      options?: fs.MakeDirectoryOptions,
    ) => {
      if (mode === "partial" && String(directory) === missing)
        throw Object.assign(new Error("synthetic_base_mkdir"), {
          code: "EACCES",
        });
      return mkdir(directory, options);
    }) as typeof fs.mkdirSync;
    if (mode === "unknown")
      Object.defineProperty(fs, "lstatSync", {
        value: ((directory: fs.PathLike, options?: fs.StatOptions) => {
          if (String(directory) === first)
            throw Object.assign(new Error("synthetic_base_lstat"), {
              code: "EACCES",
            });
          return lstat(directory, options);
        }) as typeof fs.lstatSync,
      });
    try {
      const result = prepareHostInitializationRoot(input);
      assert.equal(result.status, mode === "normal" ? "ready" : "blocked");
      assert.deepEqual(
        result.createdDirectories,
        mode === "normal"
          ? [
              first,
              missing,
              path.join(missing, "qual-lab"),
              path.join(missing, "qual-lab", "cros"),
              target.state,
            ]
          : mode === "partial"
            ? [first]
            : [],
      );
      if (mode === "partial")
        assert.equal(fs.statSync(first).isDirectory(), true);
    } finally {
      fs.mkdirSync = mkdir;
      Object.defineProperty(fs, "lstatSync", { value: lstat });
    }
  }
});

/**
 * worktreeの通常File marker形態もfixture検査を通る。
 * @responsibility VCS Root検証とmarker種類の受理を別に確認する。
 * @trace RFD-IT-025
 * @precondition 確定Repository内の自己生成試験Root。
 * @stimulus 模擬marker Fileを作り同じ検査関数で確認する。
 * @observation 通常Fileの受理と、Directory形態を使う通常fixtureの成功。
 * @oracle 実Repositoryの.git変更0。模擬markerを有効Repositoryと主張しない。
 * @cleanup Fixture回収。
 * @boundary 試験専用marker形態検査。
 */
test("Host試験fixtureはworktreeのFile marker形態を受理する", (t) => {
  const f = fixture(t);
  const marker = path.join(f.directory, ".git");
  fs.writeFileSync(marker, "gitdir: synthetic-test-only\n");
  assertRepositoryMarker(marker);
  assert.equal(fs.lstatSync(marker).isFile(), true);
});

/**
 * 親・Root境界と部分作成故障を区別する。
 * @responsibility mkdir済みEffectを消さず、不正境界へ保存Capabilityを発行しない。
 * @trace RFD-IT-025
 * @precondition 自己生成baseとfile／junction、mkdir故障注入。
 * @stimulus 不正親、link親、部分mkdir失敗、EEXIST競合を与える。
 * @observation blocked／ready、exact作成集合、現存Directory。
 * @oracle 部分失敗の既知作成は保持し、自動削除・修復0。
 * @cleanup 注入をfinallyで戻しFixtureが回収する。
 * @boundary Host Root準備と実Filesystem。
 */
test("Host Rootは不正親と部分作成・競合を別に処置する", (t) => {
  for (const mode of [
    "file",
    "link",
    "root-file",
    "root-link",
    "partial",
    "race",
  ] as const) {
    const f = fixture(t);
    const publisher = path.join(f.base, "qual-lab");
    if (mode === "file") fs.writeFileSync(publisher, "not-directory");
    if (mode === "link") {
      const target = path.join(f.directory, "link-target");
      fs.mkdirSync(target);
      fs.symlinkSync(target, publisher, "junction");
    }
    if (mode === "root-file" || mode === "root-link") {
      fs.mkdirSync(path.dirname(f.state), { recursive: true });
      if (mode === "root-file") fs.writeFileSync(f.state, "not-root");
      else fs.symlinkSync(f.base, f.state, "junction");
    }
    const mkdir = fs.mkdirSync;
    fs.mkdirSync = ((
      target: fs.PathLike,
      options?: fs.MakeDirectoryOptions,
    ) => {
      if (mode === "partial" && String(target) === path.join(publisher, "cros"))
        throw Object.assign(new Error("synthetic_mkdir_failure"), {
          code: "EACCES",
        });
      if (mode === "race" && String(target) === publisher) {
        mkdir(target, options);
        throw Object.assign(new Error("synthetic_eexist"), { code: "EEXIST" });
      }
      return mkdir(target, options);
    }) as typeof fs.mkdirSync;
    try {
      const result = prepareHostInitializationRoot(f.input);
      assert.equal(result.status, mode === "race" ? "ready" : "blocked");
      assert.deepEqual(
        result.createdDirectories,
        mode === "partial"
          ? [publisher]
          : mode === "race"
            ? [path.join(publisher, "cros"), f.state]
            : [],
      );
      if (mode === "partial")
        assert.equal(fs.statSync(publisher).isDirectory(), true);
    } finally {
      fs.mkdirSync = mkdir;
    }
  }
});

/**
 * 最終Rootの準備中置換と準備後置換を検出する。
 * @responsibility 既存CapabilityのPathだけから同実体を推定しない。
 * @trace RFD-IT-025
 * @precondition 自己生成Rootとrealpath中の置換注入。
 * @stimulus Capability作成時または準備後にRootを退避し別実体を置く。
 * @observation blockedまたは旧入力unknown、作成集合、対象外保持。
 * @oracle 根拠不一致から初期化0、自動回収0。
 * @cleanup 注入を戻しFixtureが両自己生成Rootを回収する。
 * @boundary Root実体とHost準備・旧入力Observer。
 */
test("Host Rootは準備中と準備後の実体置換を受理しない", (t) => {
  const f = fixture(t);
  const realpath = fs.realpathSync.native;
  let visits = 0;
  fs.realpathSync.native = ((target: fs.PathLike) => {
    if (String(target) === f.state && ++visits === 3) {
      fs.renameSync(f.state, `${f.state}-old`);
      fs.mkdirSync(f.state);
    }
    return realpath(target);
  }) as typeof fs.realpathSync.native;
  try {
    assert.equal(prepareHostInitializationRoot(f.input).status, "blocked");
  } finally {
    fs.realpathSync.native = realpath;
  }
  const g = fixture(t);
  const prepared = prepareHostInitializationRoot(g.input);
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  const oldIdentity = fs.lstatSync(g.state, { bigint: true });
  const oldNumber = fs.lstatSync(g.state).ino;
  fs.renameSync(g.state, `${g.state}-old`);
  fs.mkdirSync(g.state);
  const newIdentity = fs.lstatSync(g.state, { bigint: true });
  assert.notEqual(oldIdentity.ino, newIdentity.ino);
  t.diagnostic(
    JSON.stringify({
      exactIdentityDistinct: oldIdentity.ino !== newIdentity.ino,
      numberIdentityEqual: oldNumber === fs.lstatSync(g.state).ino,
      safeNumberRange:
        oldIdentity.ino <= BigInt(Number.MAX_SAFE_INTEGER) &&
        newIdentity.ino <= BigInt(Number.MAX_SAFE_INTEGER),
    }),
  );
  assert.equal(
    prepared.observePrevious().reason,
    "host_previous_inputs_unknown",
  );
});

/**
 * 旧入力の存在・不明を確認済み不存在へ変換しない。
 * @responsibility 旧本文を読まず正規不在だけ初回tupleへ渡す。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Rootと旧二領域のdirectory／file／link／観測故障。
 * @stimulus 各旧入力とRoot linkを配置して観測する。
 * @observation 既知存在・unknown理由、生成AM current不存在。
 * @oracle linkも既知存在、EACCESはunknown。旧内容採用・削除0。
 * @cleanup Fixture回収と故障注入解除。
 * @boundary Host旧入力metadata観測。
 */
test("Host旧入力は存在と観測不能を区別して新初期化しない", async (t) => {
  for (const mode of [
    "management",
    "recovery",
    "both",
    "link",
    "unknown",
  ] as const) {
    const f = fixture(t);
    const prepared = prepareHostInitializationRoot(f.input);
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready") return;
    const management = path.join(f.state, "credential-registry");
    if (mode === "management" || mode === "both") fs.mkdirSync(management);
    if (mode === "recovery" || mode === "both")
      fs.writeFileSync(
        path.join(f.state, "credential-access-recovery"),
        "old-input",
      );
    if (mode === "link") fs.symlinkSync(f.base, management, "junction");
    const lstat = fs.lstatSync;
    if (mode === "unknown")
      Object.defineProperty(fs, "lstatSync", {
        value: ((target: fs.PathLike, options?: fs.StatOptions) => {
          if (String(target) === management)
            throw Object.assign(new Error("synthetic_access_denied"), {
              code: "EACCES",
            });
          return lstat(target, options);
        }) as typeof fs.lstatSync,
      });
    try {
      const observed = prepared.observePrevious();
      assert.equal(
        observed.reason,
        mode === "unknown"
          ? "host_previous_inputs_unknown"
          : mode === "both"
            ? "legacy_inputs_present"
            : mode === "recovery"
              ? "legacy_recovery_present"
              : "legacy_management_present",
      );
      const terminal = Object.assign(
        new Writable({
          write() {
            assert.fail("forbidden_key_write");
          },
        }),
        { isTTY: true },
      ) as unknown as NodeJS.WriteStream;
      const result = await initializeFromHost(
        prepared.root,
        "管理者",
        true,
        () => {
          const state = prepared.observePrevious();
          return [state.management, state.attempt];
        },
        terminal,
        new AbortController().signal,
      );
      assert.equal(result.status, "blocked");
      assert.equal(
        fs.existsSync(path.join(f.state, "access-management.json")),
        false,
      );
    } finally {
      Object.defineProperty(fs, "lstatSync", { value: lstat });
    }
  }
});

/**
 * 生成前と保存Lock内の旧入力差を拒否する。
 * @responsibility 最初の不存在を後続保存の許可へ流用しない。
 * @trace RFD-IT-025
 * @precondition 準備済み自己生成Root、同期旧入力Observer。
 * @stimulus 二回目の観測前に旧管理Directoryを出現させる。
 * @observation 観測回数、AM current不存在と鍵出力0。
 * @oracle Lock内再照合で新User／資格保存0、旧入力削除0。
 * @cleanup Fixtureがexact試験Rootを回収する。
 * @boundary Host生成前観測→AM保存Lock内観測。
 */
test("Host旧入力の観測間変化は相関出版を停止する", async (t) => {
  const f = fixture(t);
  const prepared = prepareHostInitializationRoot(f.input);
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  let reads = 0;
  const output = Object.assign(
    new Writable({
      write() {
        assert.fail("forbidden_output");
      },
    }),
    { isTTY: true },
  ) as unknown as NodeJS.WriteStream;
  const result = await initializeFromHost(
    prepared.root,
    "管理者",
    true,
    () => {
      if (++reads === 2)
        fs.mkdirSync(path.join(f.state, "credential-registry"));
      const observed = prepared.observePrevious();
      return [observed.management, observed.attempt];
    },
    output,
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(reads, 2);
  assert.equal(
    fs.existsSync(path.join(f.state, "access-management.json")),
    false,
  );
  assert.equal(
    fs.statSync(path.join(f.state, "credential-registry")).isDirectory(),
    true,
  );
});

/**
 * CLIの入力拒否はRoot準備より先に閉じる。
 * @responsibility help・不正引数・環境不足・非TTYをFilesystem Effect0へ接続する。
 * @trace RFD-IT-025
 * @precondition 自己生成baseと非TTY入出力、実公開bin／配布入口。
 * @stimulus 各拒否を公開commandと実子Processで呼ぶ。
 * @observation Exit code、state Root不存在、Secret・Path非公開。
 * @oracle mkdir・prompt・AM保存0。未知引数から暗黙初期化しない。
 * @cleanup 子Processjoin、Fixture回収、自己所有stream破棄。
 * @boundary CLI公開入口の拒否。実Host成功縦断ではない。
 */
test("Host CLIのhelpと不正起動・非TTYはRootを作らない", async (t) => {
  const f = fixture(t);
  const input = new PassThrough() as unknown as NodeJS.ReadStream;
  let notices = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      notices += chunk.toString();
      callback();
    },
  }) as unknown as NodeJS.WriteStream;
  for (const args of [
    ["--help"],
    [],
    ["--initialize", "--initialize"],
    ["--initialize", "extra"],
    ["--unknown"],
    ["--initialize"],
    ["--exchange-user"],
    ["--exchange-user", "invalid"],
    ["--exchange-all", "00000000-0000-4000-8000-000000000003"],
  ]) {
    const code = await runHostAccessCommand(
      args,
      f.environment,
      input,
      output,
      new AbortController().signal,
    );
    assert.equal(code, args[0] === "--help" ? 0 : 64);
    assert.equal(fs.existsSync(f.state), false);
  }
  assert.equal(
    await runHostAccessCommand(
      ["--initialize"],
      {},
      input,
      output,
      new AbortController().signal,
    ),
    64,
  );
  assert.equal(notices.includes(f.base), false);
  assert.equal(notices.includes("cros.v1."), false);
  assert.equal(notices.includes("初回管理者の表示名（"), false);
  const repository = path.resolve(import.meta.dirname, "../../../../..");
  for (const entry of [
    path.join(
      repository,
      "40_Develop",
      "access-management",
      "bin",
      "access-management.ts",
    ),
    path.join(repository, "template", "tools", "crdd-access-management.ts"),
  ]) {
    for (const flag of ["--help", "--initialize", "--unknown"]) {
      const child = spawnSync(process.execPath, [entry, flag], {
        encoding: "utf8",
        env: { ...process.env, ...f.environment },
        timeout: 15_000,
      });
      assert.equal(child.status, flag === "--help" ? 0 : 64);
      assert.equal(child.error, undefined);
      assert.equal(child.stderr, "");
      assert.equal(child.stdout.includes(f.base), false);
      assert.equal(fs.existsSync(f.state), false);
    }
  }
  assert.equal(input.destroyed, false);
  assert.equal(output.destroyed, false);
  input.destroy();
  output.destroy();
});

/**
 * Host交換の公開CLIを対象確認から一度提示・記録終了まで検証する。
 * @responsibility 対象拒否と人間確認、待機中の改訂変更を保存結果と区別する。
 * @trace RFD-IT-017
 * @trace RFD-IT-025
 * @precondition 自己生成Host baseと実Schemaの管理状態、局所TTY代役だけ。
 * @stimulus 指定／全員交換、拒否・取消・改訂競合、prepared／revoked再開、stored置換とconfirmed終了。
 * @observation Exit code、鍵提示回数、資格失効、交換記録、改訂とListener。
 * @oracle 正規yesだけ一度提示して記録を閉じ、拒否・競合では資格を変更しない。
 * @cleanup Fixtureがexact Rootを回収し、試験Ownerがstreamを破棄する。
 * @boundary 公開CLI→readline→実保存。実Host TTYの成立は主張しない。
 */
test("Host交換CLIは確認した対象だけ一度提示し拒否と競合では交換しない", {
  timeout: 30_000,
}, async (t) => {
  for (const mode of [
    "targeted",
    "all",
    "unknown",
    "nonadmin",
    "no",
    "eof",
    "cancel",
    "revision",
    "prepared",
    "revoked",
    "stored",
    "confirmed",
    "initial",
    "initial_all",
    "settled",
  ] as const) {
    const f = fixture(t);
    assert.equal(prepareHostInitializationRoot(f.input).status, "ready");
    const admin = "00000000-0000-4000-8000-000000000003";
    const developer = "00000000-0000-4000-8000-000000000004";
    const material = createCredentialMaterial();
    const current = path.join(f.state, "access-management.json");
    const state: AccessManagementState = {
      contract: "crdd-access-management/state",
      schemaRevision: 2,
      revision: 1,
      operationId: "00000000-0000-4000-8000-000000000001",
      users: [
        { userId: admin, username: "管理者", role: "administrator" },
        { userId: developer, username: "開発者", role: "developer" },
      ],
      roleContentAccess: [
        { role: "developer", workspaceIds: ["development"] },
        { role: "manager", workspaceIds: ["development", "management"] },
        { role: "administrator", workspaceIds: [] },
      ],
      credentials: [
        {
          credentialId: material.credentialId,
          userId: admin,
          tokenVersion: 1,
          tokenSalt: material.tokenSalt,
          tokenVerifier: material.tokenVerifier,
          revoked: false,
          operationId: "00000000-0000-4000-8000-000000000002",
          presentation: "confirmed",
        },
      ],
      registeredRepositories: [],
      exposure: [],
      unresolvedKeyExchanges: [],
      initialization: {
        stage: "completed",
        attemptId: "00000000-0000-4000-8000-000000000002",
        initialUserId: admin,
        initialCredentialId: material.credentialId,
        confirmationCredentialId: material.credentialId,
        connection: "confirmed",
      },
    };
    if (mode === "initial" || mode === "initial_all") {
      const initialUser = state.users[0];
      assert.ok(initialUser);
      state.users = [initialUser];
      state.initialization = {
        stage: "credential_stored",
        attemptId: "00000000-0000-4000-8000-000000000002",
        userId: admin,
        initialCredentialId: material.credentialId,
        confirmationCredentialId: material.credentialId,
      };
    }
    assert.equal(
      parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
      "parsed",
    );
    fs.writeFileSync(current, JSON.stringify(state));
    const priorOperation = "00000000-0000-4000-8000-000000000090";
    if (
      ["prepared", "revoked", "stored", "confirmed", "settled"].includes(mode)
    ) {
      const root = prepareHostInitializationRoot(f.input);
      assert.equal(root.status, "ready");
      if (root.status !== "ready") return;
      const rename = fs.renameSync;
      let publications = 0;
      fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
        const result = rename(from, to);
        if (
          String(to) === current &&
          ++publications ===
            (mode === "prepared" || mode === "settled"
              ? 1
              : mode === "revoked"
                ? 2
                : -1)
        )
          throw new Error("synthetic_exchange_publication");
        return result;
      }) as typeof fs.renameSync;
      try {
        const exchanged = exchangeCredentialsFromHost(
          root.root,
          1,
          priorOperation,
          "targeted",
          admin,
          [material.credentialId],
          true,
        );
        assert.equal(
          exchanged.status,
          mode === "prepared" || mode === "revoked" || mode === "settled"
            ? "unavailable"
            : "completed",
        );
      } finally {
        fs.renameSync = rename;
      }
      // 先行故障の短命材料を保存Ownerで処置し、CLIのfresh観測と分ける。
      if (mode !== "settled") {
        const observed = readAccessManagementState(root.root);
        assert.equal(observed.status, "completed");
        const settled = readAccessManagementState(root.root);
        assert.equal(settled.status, "completed");
      }
      if (mode === "confirmed") {
        const saved = JSON.parse(fs.readFileSync(current, "utf8"));
        const credential = saved.credentials[1];
        let presentationOperationId: string | undefined;
        for (const target of ["unconfirmed", "confirmed"] as const) {
          const result = recordCredentialPresentation(root.root, {
            credentialId: credential.credentialId,
            issuanceOperationId: priorOperation,
            expectedRevision: JSON.parse(fs.readFileSync(current, "utf8"))
              .revision,
            target,
            ...(presentationOperationId ? { presentationOperationId } : {}),
          });
          assert.equal(result.status, "completed");
          if (result.status === "completed")
            presentationOperationId = result.value.presentationOperationId;
        }
      }
    }
    const before = fs.readFileSync(current);
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
    }) as unknown as NodeJS.ReadStream;
    let prompts = 0,
      keyWrites = 0;
    const controller = new AbortController();
    const output = Object.assign(
      new Writable({
        write(chunk, _encoding, callback) {
          const text = chunk.toString();
          if (text.includes("接続鍵（一度だけ表示します")) keyWrites++;
          if (text.includes("実行する場合だけ yes")) {
            prompts++;
            setImmediate(() => {
              if (mode === "revision") {
                state.revision++;
                fs.writeFileSync(current, JSON.stringify(state));
              }
              if (mode === "eof") input.emit("end");
              else if (mode === "cancel") controller.abort();
              else input.push(mode === "no" ? "no\r" : "yes\r");
            });
          }
          callback();
        },
      }),
      { isTTY: true, columns: 80 },
    ) as unknown as NodeJS.WriteStream;
    const accepted = [
      "targeted",
      "all",
      "prepared",
      "revoked",
      "stored",
      "confirmed",
      "initial",
      "settled",
    ].includes(mode);
    let code = await runHostAccessCommand(
      [
        mode === "all" || mode === "nonadmin" || mode === "initial_all"
          ? "--exchange-all"
          : "--exchange-user",
        mode === "unknown"
          ? "00000000-0000-4000-8000-000000000099"
          : mode === "nonadmin" || mode === "confirmed"
            ? developer
            : admin,
      ],
      f.environment,
      input,
      output,
      controller.signal,
    );
    if (mode === "settled") {
      assert.equal(code, 2);
      assert.equal(prompts, 0);
      assert.equal(keyWrites, 0);
      assert.deepEqual(fs.readFileSync(current), before);
      assert.deepEqual(fs.readdirSync(f.state), ["access-management.json"]);
      code = await runHostAccessCommand(
        ["--exchange-user", admin],
        f.environment,
        input,
        output,
        controller.signal,
      );
    }
    assert.equal(code, accepted ? 0 : 2, mode);
    assert.equal(keyWrites, accepted && mode !== "confirmed" ? 1 : 0, mode);
    assert.equal(
      prompts,
      mode === "unknown" || mode === "nonadmin" || mode === "initial_all"
        ? 0
        : 1,
      mode,
    );
    const after = JSON.parse(fs.readFileSync(current, "utf8"));
    assert.equal(after.unresolvedKeyExchanges.length, 0);
    assert.deepEqual(after.users, state.users);
    assert.deepEqual(after.roleContentAccess, state.roleContentAccess);
    if (accepted) {
      assert.equal(after.credentials.length, mode === "stored" ? 3 : 2);
      assert.equal(after.credentials[0].revoked, true);
      assert.equal(after.credentials.at(-1).presentation, "confirmed");
      if (
        mode === "prepared" ||
        mode === "revoked" ||
        mode === "confirmed" ||
        mode === "settled"
      )
        assert.equal(after.credentials.at(-1).operationId, priorOperation);
      if (mode === "stored") {
        assert.equal(after.credentials[1].revoked, true);
        assert.notEqual(after.credentials[2].operationId, priorOperation);
      }
    } else if (mode === "revision")
      assert.deepEqual(after.credentials, state.credentials);
    else assert.deepEqual(fs.readFileSync(current), before);
    assert.equal(input.destroyed, false);
    assert.equal(output.destroyed, false);
    assert.equal(input.listenerCount("keypress"), 0);
    assert.equal(output.listenerCount("resize"), 0);
    assert.equal(output.listenerCount("error"), 0);
    assert.equal(output.listenerCount("close"), 0);
    input.destroy();
    output.destroy();
  }
});

/**
 * 局所対話入力を保存と一度提示へ接続し、入力取消を閉じる。
 * @responsibility 初回入口の入力interfaceと共有streamの所有を分離する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition Repository-local baseとTTY代役。実Host TTYではない。
 * @stimulus 正規名・不正名・CtrlC・EOFを入力する。
 * @observation Exit code、資格提示回数、現在段階、入力Listener回収。
 * @oracle 正規入力だけ鍵を一度提示し、取消／不正は鍵0。共有stream非終了。
 * @cleanup 代役streamは試験Ownerが最後に破棄し、FixtureがRootを回収する。
 * @boundary Host command→readline→実保存→TTY代役。
 */
test("Host CLIは表示名を一度入力して保存し取消・EOFを終了する", {
  timeout: 20_000,
}, async (t) => {
  for (const mode of [
    "valid",
    "invalid",
    "cancel",
    "eof",
    "input-error",
    "output-error",
    "output-close",
  ] as const) {
    const f = fixture(t);
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
    }) as unknown as NodeJS.ReadStream;
    let asked = false;
    let prompts = 0;
    let keyWrites = 0;
    const output = Object.assign(
      new Writable({
        write(chunk, _encoding, callback) {
          const text = chunk.toString();
          if (text.includes("初回管理者の表示名（")) prompts++;
          if (text.includes("接続鍵（一度だけ表示します")) keyWrites++;
          if (!asked && text.includes("初回管理者の表示名（")) {
            asked = true;
            setImmediate(() => {
              if (mode === "eof") input.emit("end");
              else if (mode === "input-error")
                input.emit("error", new Error("synthetic_input_error"));
              else if (mode === "output-error")
                output.emit("error", new Error("synthetic_output_error"));
              else if (mode === "output-close") output.emit("close");
              else
                input.push(
                  mode === "valid"
                    ? "管理者\r"
                    : mode === "invalid"
                      ? "  \r"
                      : "\x03",
                );
            });
          }
          callback();
        },
      }),
      { isTTY: true, columns: 80 },
    ) as unknown as NodeJS.WriteStream;
    const code = await runHostAccessCommand(
      ["--initialize"],
      f.environment,
      input,
      output,
      new AbortController().signal,
    );
    assert.equal(code, mode === "valid" ? 0 : 2);
    assert.equal(keyWrites, mode === "valid" ? 1 : 0);
    if (mode === "valid") {
      const before = fs.readFileSync(
        path.join(f.state, "access-management.json"),
      );
      assert.equal(
        await runHostAccessCommand(
          ["--initialize"],
          f.environment,
          input,
          output,
          new AbortController().signal,
        ),
        0,
      );
      assert.equal(keyWrites, 1);
      assert.equal(prompts, 1);
      assert.deepEqual(
        fs.readFileSync(path.join(f.state, "access-management.json")),
        before,
      );
    }
    assert.equal(input.destroyed, false);
    assert.equal(output.destroyed, false);
    assert.equal(input.listenerCount("keypress"), 0);
    assert.equal(output.listenerCount("resize"), 0);
    assert.equal(output.listenerCount("error"), 0);
    assert.equal(output.listenerCount("close"), 0);
    assert.equal(
      fs.existsSync(path.join(f.state, "access-management.json")),
      mode === "valid",
    );
    input.destroy();
    output.destroy();
  }
});
