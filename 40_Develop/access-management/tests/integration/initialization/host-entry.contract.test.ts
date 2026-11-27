/**
 * Host保存先準備とCLI起動条件を検証する。
 * @packageDocumentation
 * @responsibility 自己生成Rootだけで部分作成・保存競合・本人確認済み初期化の拒否を反証する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @level IT
 * @scope access-management/initialization、Host入口の局所接続
 * @boundary 実Filesystem。外部ログインや端末対話はServer側の試験で扱う。
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  initializeAdministratorFromHost,
  linkAccountFromHost,
  readExistingHostRoot,
  readFilesystemStoreDirectory,
  readAccount,
  readCurrentAccess,
  readHostInitializationState,
  resolveHostRootInput,
} from "../../../src/index.ts";
import {
  type CrosRootInput,
  prepareHostInitializationRoot,
  resolveCrosRuntimeRoots,
} from "../../../src/initialization/root.ts";
import { readCurrent } from "../../../src/storage/store.ts";

/**
 * Repository markerのDirectoryとworktree File両形態を検査する。
 * @responsibility .gitの種類だけで正規worktreeを拒否しない。
 * @trace RFD-IT-025
 * @precondition RootはこのSourceの所在と通常ディレクトリの実パスから確認する。
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
  assert.equal(fs.lstatSync(repository).isDirectory(), true);
  assert.equal(fs.realpathSync.native(repository), repository);
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

test("初回の読戻し本文が異なる場合は出版確定を返さない", (t) => {
  const f = fixture(t);
  const current = path.join(f.state, "access-management.json");
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "first-read-back-administrator",
  };
  const signal = new AbortController().signal;
  const open = fs.openSync;
  const read = fs.readSync;
  let currentReader: number | undefined;
  let replacements = 0;
  const openHook = t.mock.method(fs, "openSync", ((
    ...args: Parameters<typeof open>
  ) => {
    const fd = open(...args);
    if (args[0] === current && args[1] === fs.constants.O_RDONLY)
      currentReader = fd;
    return fd;
  }) as typeof open);
  const readHook = t.mock.method(fs, "readSync", ((
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null,
  ) => {
    const count = read(fd, buffer, offset, length, position);
    if (fd === currentReader) {
      const content = buffer.subarray(offset, offset + count);
      const found = content.indexOf(identity.subject);
      if (found !== -1) {
        content[found] = 0x46;
        replacements++;
      }
    }
    return count;
  }) as typeof read);
  const result = initializeAdministratorFromHost(
    f.input,
    "管理者",
    identity,
    signal,
  );
  readHook.mock.restore();
  openHook.mock.restore();
  assert.equal(replacements, 1);
  assert.equal(result.status, "unavailable");
  assert.equal(result.publication, "unconfirmed");
  assert.equal(result.cleanupConfirmed, false);
  const root = readExistingHostRoot(f.input);
  assert.ok(root);
  const saved = readCurrent(root);
  assert.equal(saved.state.revision, 1);
  assert.equal(
    saved.state.users[0]?.accountLinks?.[0]?.subject,
    identity.subject,
  );
  assert.equal(
    initializeAdministratorFromHost(f.input, "管理者", identity, signal).status,
    "unavailable",
  );
  assert.deepEqual(readCurrent(root).bytes, saved.bytes);
});

test("初回出版後もLock解放不明なら完了を返さない", (t) => {
  const f = fixture(t);
  const lock = path.join(f.state, "access-management.state.lock");
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "first-unknown-cleanup-administrator",
  };
  const signal = new AbortController().signal;
  const remove = fs.rmSync;
  const hook = t.mock.method(
    fs,
    "rmSync",
    (...args: Parameters<typeof remove>) => {
      if (args[0] === lock) throw new Error("injected_lock_release_failure");
      remove(...args);
    },
  );
  const result = initializeAdministratorFromHost(
    f.input,
    "管理者",
    identity,
    signal,
  );
  hook.mock.restore();
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") assert.fail("unexpected completion");
  assert.equal(result.publication, "confirmed");
  assert.equal(result.revision, 1);
  assert.equal(result.cleanupConfirmed, false);
  assert.ok(result.lockRecoveryId);
  const current = path.join(f.state, "access-management.json");
  const bytes = fs.readFileSync(current);
  assert.ok(fs.existsSync(lock));
  assert.equal(
    initializeAdministratorFromHost(f.input, "管理者", identity, signal).status,
    "unavailable",
  );
  const root = readExistingHostRoot(f.input);
  assert.ok(root);
  assert.equal(readHostInitializationState(root).status, "unknown");
  assert.ok(fs.existsSync(lock));
  assert.deepEqual(fs.readFileSync(current), bytes);
});

test("Googleで初回管理者を設定すると鍵を作らず、同じ本人だけが通常管理に入れる", (t) => {
  const f = fixture(t);
  const signal = new AbortController().signal;
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "first-google-administrator",
  };
  assert.equal(
    initializeAdministratorFromHost(
      f.input,
      "管理者",
      identity,
      AbortSignal.abort(),
    ).status,
    "unavailable",
  );
  assert.equal(
    initializeAdministratorFromHost(
      f.input,
      "管理者",
      { ...identity, issuer: "https://invalid.test?not-an-issuer" },
      signal,
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readdirSync(f.base), []);
  const initialized = initializeAdministratorFromHost(
    f.input,
    "管理者",
    identity,
    signal,
  );
  assert.equal(initialized.status, "completed");
  const root = readExistingHostRoot(f.input);
  assert.ok(root);
  const saved = readCurrent(root);
  assert.equal(saved.state.revision, 1);
  assert.equal(saved.state.schemaRevision, 4);
  assert.equal(Object.hasOwn(saved.state, "roleContentAccess"), false);
  assert.equal(Object.hasOwn(saved.state, "exposure"), false);
  assert.equal(saved.state.users.length, 1);
  assert.equal(Object.hasOwn(saved.state, "credentials"), false);
  assert.equal(Object.hasOwn(saved.state, "unresolvedKeyExchanges"), false);
  assert.deepEqual(saved.state.initialization, {
    stage: "completed",
    connection: "account_confirmed",
    attemptId: saved.state.operationId,
    initialUserId: saved.state.users[0]?.userId,
  });
  assert.deepEqual(readHostInitializationState(root), {
    status: "existing",
    connection: "account_confirmed",
  });
  assert.equal(
    initializeAdministratorFromHost(
      f.input,
      "別の管理者",
      { ...identity, subject: "different" },
      signal,
    ).status,
    "unavailable",
  );
  assert.deepEqual(readCurrent(root).bytes, saved.bytes);
  assert.equal(
    readAccount(root, { ...identity, subject: "different" }).status,
    "rejected",
  );
  const login = readAccount(root, identity);
  if (login.status !== "completed")
    assert.fail("initial Google account not available");
  assert.equal(login.account.role, "administrator");
  assert.equal(
    readCurrentAccess(root, {
      kind: "account",
      userId: login.account.userId,
      bindingId: login.account.bindingId,
      expiresAt: Date.now() + 60_000,
    }).status,
    "completed",
  );
  assert.deepEqual(
    readCurrent(root).state.initialization,
    saved.state.initialization,
  );
  assert.deepEqual(readCurrent(root).bytes, saved.bytes);
});

test("旧版の範囲設定を含む管理状態を初期化や再紐付けで置き換えない", (t) => {
  const f = fixture(t);
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "first-google-administrator",
  };
  const signal = new AbortController().signal;
  assert.equal(
    initializeAdministratorFromHost(f.input, "管理者", identity, signal).status,
    "completed",
  );
  const root = readExistingHostRoot(f.input);
  assert.ok(root);
  const { state } = readCurrent(root);
  const userId = state.users[0]?.userId;
  assert.ok(userId);
  const marker = path.join(f.state, "access-management.json");
  const before = JSON.stringify({
    ...state,
    schemaRevision: 3,
    credentials: [],
    unresolvedKeyExchanges: [],
    roleContentAccess: [
      { role: "administrator", workspaceIds: [] },
      { role: "manager", workspaceIds: [] },
      { role: "developer", workspaceIds: [] },
    ],
    exposure: [],
  });
  fs.writeFileSync(marker, before);
  const entries = fs.readdirSync(f.state);
  assert.equal(
    readHostInitializationState(root, { settlePending: false }).status,
    "unknown",
  );
  assert.equal(
    initializeAdministratorFromHost(f.input, "管理者", identity, signal).status,
    "unavailable",
  );
  const linked = linkAccountFromHost(
    root,
    userId,
    { ...identity, subject: "replacement-administrator" },
    state.revision,
  );
  assert.equal(linked.status, "unavailable");
  assert.equal(linked.publication, "not_attempted");
  assert.equal(fs.readFileSync(marker, "utf8"), before);
  assert.deepEqual(fs.readdirSync(f.state), entries);
});

test("現行初回設定の別プロセス競合は管理者一人だけを保存する", async (t) => {
  const f = fixture(t);
  const execute = promisify(execFile);
  const entry = new URL("../../../src/index.ts", import.meta.url);
  const provider = "https://login.example.test";
  const attempts = ["first", "second"];
  const results = await Promise.all(
    attempts.map(async (subject) => {
      const script = `
      import { initializeAdministratorFromHost } from ${JSON.stringify(entry.href)};
      const result = initializeAdministratorFromHost(
        ${JSON.stringify(f.input)}, "管理者",
        ${JSON.stringify({ issuer: provider, subject })},
        new AbortController().signal,
      );
      process.stdout.write(JSON.stringify({ status: result.status }));
    `;
      const { stdout } = await execute(
        process.execPath,
        ["--input-type=module", "-e", script],
        {
          timeout: 15_000,
          windowsHide: true,
        },
      );
      return { subject, status: JSON.parse(stdout).status };
    }),
  );
  assert.equal(
    results.filter(({ status }) => status === "unavailable").length,
    1,
  );
  const winners = results.filter(({ status }) => status === "completed");
  assert.equal(winners.length, 1);
  const root = readExistingHostRoot(f.input);
  assert.ok(root);
  const saved = readCurrent(root);
  assert.equal(saved.state.revision, 1);
  assert.equal(saved.state.users.length, 1);
  assert.equal(
    saved.state.users[0]?.accountLinks?.[0]?.subject,
    winners[0]?.subject,
  );
  assert.deepEqual(fs.readdirSync(f.state), ["access-management.json"]);
});

test("初回設定は現行の保存ファイルを置き換えない", async (t) => {
  for (const artifact of [
    "access-management.pending.json",
    "access-management.replace.json",
    "access-management.json",
  ])
    await t.test(artifact, (caseContext) => {
      const f = fixture(caseContext);
      assert.equal(prepareHostInitializationRoot(f.input).status, "ready");
      const marker = path.join(f.state, artifact);
      fs.writeFileSync(marker, "manual-recovery-unchanged");
      const before = fs.readdirSync(f.state);
      assert.equal(
        initializeAdministratorFromHost(
          f.input,
          "管理者",
          {
            issuer: "https://accounts.google.com",
            subject: "first-google-administrator",
          },
          new AbortController().signal,
        ).status,
        "unavailable",
      );
      assert.equal(
        fs.readFileSync(marker, "utf8"),
        "manual-recovery-unchanged",
      );
      assert.deepEqual(fs.readdirSync(f.state), before);
    });
});

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
  assert.equal(readFilesystemStoreDirectory(prepared.root), prepared.root.root);
  assert.throws(() => readFilesystemStoreDirectory({ ...prepared.root }), {
    message: "filesystem_store_root_capability_invalid",
  });
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
 * @observation 作成先、保存先の実体一致と現在状態ファイルの不存在。
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
  assert.equal(first.isCurrent(), true);
  fs.writeFileSync(path.join(f.state, "unrelated.txt"), "not-management");
  const again = prepareHostInitializationRoot(f.input);
  assert.equal(again.status, "ready");
  assert.deepEqual(again.createdDirectories, []);
  assert.equal(again.status === "ready" && again.isCurrent(), true);
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
 * @observation 準備拒否または実体の不一致、作成集合、対象外保持。
 * @oracle 根拠不一致から初期化0、自動回収0。
 * @cleanup 注入を戻しFixtureが両自己生成Rootを回収する。
 * @boundary Root実体とHost準備・実体の再照合。
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
  assert.equal(prepared.isCurrent(), false);
});

/**
 * Lock内で異なる保存先実体を観測した場合は新規保存しない。
 * @trace RFD-IT-025
 * @boundary 実Lockを用い、書込み直前の実体観測だけを差し替える。
 */
test("初回保存はLock内で保存先の実体不一致を観測したら書き込まない", (t) => {
  const f = fixture(t);
  const replacement = fs.lstatSync(f.base, { bigint: true });
  const lock = path.join(f.state, "access-management.state.lock");
  const current = path.join(f.state, "access-management.json");
  const lstat = fs.lstatSync;
  let checkedCurrent = false;
  let lockedRootReads = 0;
  let observedReplacement = false;
  const hook = t.mock.method(
    fs,
    "lstatSync",
    (target: fs.PathLike, options?: fs.StatOptions) => {
      if (target === current && fs.existsSync(lock)) checkedCurrent = true;
      if (
        checkedCurrent &&
        !observedReplacement &&
        path.resolve(String(target)) === f.state &&
        options?.bigint &&
        fs.existsSync(lock) &&
        ++lockedRootReads === 2
      ) {
        observedReplacement = true;
        return replacement;
      }
      return lstat(target, options);
    },
  );
  try {
    const result = initializeAdministratorFromHost(
      f.input,
      "管理者",
      { issuer: "https://accounts.google.com", subject: "first-admin" },
      new AbortController().signal,
    );
    assert.equal(observedReplacement, true, JSON.stringify(result));
    assert.equal(result.status, "unavailable");
    assert.equal(result.publication, "not_attempted");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(fs.existsSync(current), false);
    assert.deepEqual(fs.readdirSync(f.state), []);
  } finally {
    hook.mock.restore();
  }
});
