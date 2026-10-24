/**
 * Repository別AI選択設定を実Filesystemで検証する。
 * @packageDocumentation
 * @responsibility 読取り非作成、内容CAS、公開・回収失敗と認可失効を区別する。
 * @trace RCM-IT-005
 * @level IT
 * @scope 新形式AI選択Storeと既存Repository Root・Filesystem排他。
 * @boundary RCM-IT-005=Direct Boundary: Coordinator Store→Repository-local Filesystem。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import {
  AI_SELECTION_MAXIMUM_BYTES,
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "../../src/storage/ai-selection.ts";
import { validateAiSelectionConfig } from "../../src/selection/resolve.ts";
import * as domain from "../../../domain-model/src/index.ts";

/**
 * 合成設定だけを作る。
 * @responsibility 実設定や認証情報を利用しない。
 * @trace RCM-IT-005
 * @precondition 現在の技術Catalog内の組。
 * @stimulus 五役割へ用途に合う合成値を配置する。
 * @observation 独立した設定値。
 * @oracle 作業分類は任意に追加できる。
 * @cleanup N/A: 局所値。
 * @boundary 合成値とStore。
 */
function config() {
  const advice = { provider: "codex", model: "gpt-5.6-sol", effort: "medium" };
  const task = { provider: "codex", model: "gpt-5.5", effort: "medium" };
  return {
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: {
      coordinator: { ...advice },
      executor: { ...task },
      independent_reviewer: { ...task },
      result_integration: { ...advice },
      advice: { ...advice },
    },
    workTypes: { coding: { label: "コード" } },
    overrides: {},
  };
}

/**
 * 今回所有する合成Git Repositoryだけを準備・回収する。
 * @responsibility 検証した親Root直下の自己生成試験物に書込みを限定する。
 * @trace RCM-IT-005
 * @precondition 親Repositoryのtests領域が確認できる。
 * @stimulus 空のGit Repositoryを作る。
 * @observation 発行済みRootと設定Path。
 * @oracle 終了後に今回Rootが存在しない。
 * @cleanup mock復元後、exact自己生成Rootだけを削除して不存在確認。
 * @boundary Repository-local合成領域と既存Root検証。
 */
function fixture(t: test.TestContext, emptyTemplate = false) {
  const parent = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "test_area_unconfirmed",
  ).directory;
  const root = fs.mkdtempSync(path.join(parent, "ai-selection-store-"));
  execFileSync(
    "git",
    ["init", "--quiet", ...(emptyTemplate ? ["--template="] : []), root],
    { windowsHide: true },
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  t.after(() => {
    t.mock.restoreAll();
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  return {
    root,
    capability: verified.capability,
    directory: path.join(root, ".crdd", "config"),
    file: path.join(root, ".crdd", "config", "ai-selection.json"),
  };
}

/**
 * 空Git templateの試験準備と正しい保存拒否を区別する。
 * @responsibility 検証入口が必要なGit info領域を準備し、拒否理由を失わない。
 * @trace RCM-IT-005
 * @precondition 自己生成Repositoryだけを空templateで初期化する。
 * @stimulus info不在の保存と、明示準備後の同じ保存要求を照合する。
 * @observation status・reason・作成Effect・読戻し・Lock残存。
 * @oracle 準備不足ではEffect前拒否、準備後だけ同じ設定を保存する。
 * @cleanup TestContextが自己生成Rootだけ回収し不存在を確認する。
 * @boundary 正式設定API→Git除外登録→Filesystem Store。AI・Dockerは使わない。
 */
test("空templateのGit info未準備は理由付きで拒否し、試験準備後は保存する", (t) => {
  const f = fixture(t, true);
  const info = path.join(f.root, ".git", "info");
  assert.equal(fs.existsSync(info), false);
  const rejected = saveRepositoryAiSelection(
    f.capability,
    { expectedIdentity: null, config: config() },
    () => true,
  );
  assert.equal(rejected.status, "blocked", JSON.stringify(rejected));
  assert.equal(
    rejected.reason,
    "repository_runtime_data_ignore_registration_blocked",
  );
  assert.ok("setupFailure" in rejected);
  assert.equal(rejected.setupFailure?.effectIssued, false);
  assert.equal(rejected.setupFailure?.effectStateUnknown, false);
  assert.equal(rejected.setupFailure?.cleanupConfirmed, true);
  assert.equal(rejected.setupFailure?.recoveryReference, null);
  assert.equal(readRepositoryAiSelection(f.capability).status, "missing");
  assert.equal(fs.existsSync(path.join(f.root, ".crdd")), false);

  // 空templateを使う検証入口自身の準備。製品のGit境界拒否は変更しない。
  fs.mkdirSync(info);
  fs.writeFileSync(path.join(info, "exclude"), "");
  const saved = saveRepositoryAiSelection(
    f.capability,
    { expectedIdentity: null, config: config() },
    () => true,
  );
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  assert.equal(
    readRepositoryAiSelection(f.capability).snapshot?.identity,
    saved.snapshot?.identity,
  );
  assert.match(
    fs.readFileSync(path.join(info, "exclude"), "utf8"),
    /\.crdd\//u,
  );
  assert.deepEqual(fs.readdirSync(f.directory), ["ai-selection.json"]);
});

/**
 * 読取りと認可拒否には設定作成Effectがない。
 * @responsibility 不存在を既定設定へ補完しない。
 * @trace RCM-IT-005
 * @precondition 空の合成Repository。
 * @stimulus 読取り、偽Root、拒否・例外認可を渡す。
 * @observation 結果と.crdd不存在。
 * @oracle 全操作後も設定領域は存在しない。
 * @cleanup 自己生成Rootだけ回収。
 * @boundary Root・認可・設定Store。
 */
test("読取りと未認可保存は作成せず、偽Rootも拒否する", (t) => {
  const f = fixture(t);
  assert.equal(readRepositoryAiSelection(f.capability).status, "missing");
  for (const authorize of [
    () => false,
    () => {
      throw Error("private");
    },
  ]) {
    assert.equal(
      saveRepositoryAiSelection(
        f.capability,
        { expectedIdentity: null, config: config() },
        authorize,
      ).status,
      "blocked",
    );
  }
  const fake = Object.freeze({}) as typeof f.capability;
  assert.equal(readRepositoryAiSelection(fake).status, "blocked");
  assert.equal(fs.existsSync(path.join(f.root, ".crdd")), false);
});

/**
 * 通常の保存・内容CAS・読戻しと短命File回収を実確認する。
 * @responsibility 改行や整形と意味上の設定Identityを区別する。
 * @trace RCM-IT-005
 * @precondition 空の合成Repository。
 * @stimulus 初回保存、整形変更、競合更新、正しい期待値の更新。
 * @observation 内容Hash、File bytes、残存名。
 * @oracle 競合では上書きせず成功時は正本一件だけ。
 * @cleanup 自己生成Rootだけ回収。
 * @boundary Store→既存排他・Git Ignore・Filesystem。
 */
test("初回保存・内容CAS・再保存は正本一件へ確定する", (t) => {
  const f = fixture(t);
  const first = saveRepositoryAiSelection(
    f.capability,
    { expectedIdentity: null, config: config() },
    () => true,
  );
  assert.equal(first.status, "saved", JSON.stringify(first));
  if (first.status !== "saved") assert.fail("saved required");
  fs.writeFileSync(f.file, JSON.stringify(first.snapshot.config));
  assert.equal(
    readRepositoryAiSelection(f.capability).snapshot?.identity,
    first.snapshot.identity,
  );
  const changed = config();
  changed.workTypes.coding.label = "更新";
  const before = fs.readFileSync(f.file);
  assert.equal(
    saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: changed },
      () => true,
    ).status,
    "conflict",
  );
  assert.deepEqual(fs.readFileSync(f.file), before);
  const next = saveRepositoryAiSelection(
    f.capability,
    { expectedIdentity: first.snapshot.identity, config: changed },
    () => true,
  );
  assert.equal(next.status, "saved", JSON.stringify(next));
  assert.notEqual(next.snapshot?.identity, first.snapshot.identity);
  assert.deepEqual(fs.readdirSync(f.directory), ["ai-selection.json"]);
});

/**
 * 厳密JSON・UTF-8・容量・hardlinkを拒否する。
 * @responsibility 読取り失敗を空設定へ丸めずbyte上限を一致させる。
 * @trace RCM-IT-005
 * @precondition 合成config領域。
 * @stimulus 不正bytes、重複key、旧形式、上限超過、hardlink。
 * @observation blockedと元File保全。
 * @oracle 読取りと保存が同じ1MiBを強制する。
 * @cleanup 自己生成Rootだけ回収。
 * @boundary File bytesと設定Schema。
 */
test("不正UTF-8・重複JSON・旧形式・容量超過・hardlinkを拒否する", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.directory, { recursive: true });
  for (const bytes of [
    Buffer.from([0xff]),
    Buffer.from('{"revision":1,"revision":1}'),
    Buffer.from('{"profiles":[]}'),
    Buffer.alloc(AI_SELECTION_MAXIMUM_BYTES + 1, 32),
  ]) {
    fs.writeFileSync(f.file, bytes);
    assert.equal(readRepositoryAiSelection(f.capability).status, "blocked");
  }
  const huge = config();
  huge.workTypes.coding.label = "あ".repeat(AI_SELECTION_MAXIMUM_BYTES / 2);
  assert.equal(
    saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: huge },
      () => true,
    ).reason,
    "ai_selection_file_too_large",
  );
  fs.writeFileSync(f.file, JSON.stringify(config()));
  fs.linkSync(f.file, path.join(f.directory, "other.json"));
  assert.equal(
    readRepositoryAiSelection(f.capability).reason,
    "ai_selection_file_invalid",
  );
});

/**
 * 容量境界と読取り中の置換・linkを反証する。
 * @responsibility 上限を文字数と混同せず、別実体を安定読取りと扱わない。
 * @trace RCM-IT-005
 * @precondition 合成Repositoryと現在の閉形式。
 * @stimulus 1MiB丁度、1byte超過、symlink、open前の正本置換。
 * @observation 保存・読取り結果と正本以外の保全。
 * @oracle 上限丁度は保存でき、超過・link・置換は拒否する。
 * @cleanup mock復元後に自己生成Rootだけ回収。
 * @boundary 安定bytes・File Identityと設定Store。
 */
test("1MiB丁度は受理し、超過・symlink・読取り中の置換を拒否する", (t) => {
  const f = fixture(t);
  const value = config();
  value.workTypes.coding.label = "あ";
  const normalized = validateAiSelectionConfig(value);
  assert.equal(normalized.status, "valid");
  assert.ok(normalized.value);
  const size = Buffer.byteLength(
    `${JSON.stringify(normalized.value.config, null, 2)}\n`,
  );
  value.workTypes.coding.label += "x".repeat(AI_SELECTION_MAXIMUM_BYTES - size);
  const saved = saveRepositoryAiSelection(
    f.capability,
    { expectedIdentity: null, config: value },
    () => true,
  );
  assert.equal(saved.status, "saved", JSON.stringify(saved));
  assert.equal(fs.statSync(f.file).size, AI_SELECTION_MAXIMUM_BYTES);
  value.workTypes.coding.label += "x";
  assert.equal(
    saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: saved.snapshot?.identity, config: value },
      () => true,
    ).reason,
    "ai_selection_file_too_large",
  );
  fs.renameSync(f.file, path.join(f.directory, "linked.json"));
  fs.symlinkSync(path.join(f.directory, "linked.json"), f.file, "file");
  assert.equal(readRepositoryAiSelection(f.capability).status, "blocked");
  fs.unlinkSync(f.file);
  fs.writeFileSync(f.file, JSON.stringify(config()));
  let swaps = 0;
  const mocked = t.mock.method(
    fs,
    "openSync",
    new Proxy(fs.openSync, {
      apply(target, receiver, args) {
        if (String(args[0]) === f.file && swaps === 0) {
          swaps++;
          fs.renameSync(f.file, path.join(f.directory, "replaced.json"));
          fs.writeFileSync(f.file, JSON.stringify(config()));
        }
        return Reflect.apply(target, receiver, args);
      },
    }),
  );
  assert.equal(readRepositoryAiSelection(f.capability).status, "blocked");
  mocked.mock.restore();
  assert.equal(swaps, 1);
  assert.equal(fs.existsSync(path.join(f.directory, "replaced.json")), true);
});

/**
 * 認可の失効を保存前と読戻し後で区別する。
 * @responsibility 保存後失効を未保存や本文公開へ変換しない。
 * @trace RCM-IT-005
 * @precondition 合成Repository。
 * @stimulus 各認可呼出しで失効させる。
 * @observation 正本有無とpublication。
 * @oracle 保存前は正本なし、保存後は本文なしunknown。
 * @cleanup 自己生成Rootだけ回収。
 * @boundary 認可callbackと設定公開。
 */
test("保存前失効と保存後失効を区別する", (t) => {
  for (const limit of [1, 2, 3, 4]) {
    const f = fixture(t);
    let calls = 0;
    const result = saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: config() },
      () => ++calls <= limit,
    );
    if (limit <= 2) {
      assert.equal(result.status, "blocked");
      assert.equal(fs.existsSync(f.file), false);
    } else {
      assert.equal(result.status, "unknown");
      if (result.status !== "unknown") assert.fail("unknown required");
      assert.equal(result.publication, "confirmed");
      assert.equal(result.snapshot, null);
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(readRepositoryAiSelection(f.capability).status, "available");
    }
    assert.deepEqual(
      fs.readdirSync(f.directory),
      limit <= 2 ? [] : ["ai-selection.json"],
    );
  }
});

/**
 * 失敗注入で公開と回収の結果を分離する。
 * @responsibility 元Error内容を漏らさず自動再送しない。
 * @trace RCM-IT-005
 * @precondition 自己生成設定領域。
 * @stimulus temp作成、rename、公開後読取り、temp回収、Lock回収を故障させる。
 * @observation publication・cleanup・同じ回復参照と実File。
 * @oracle 不明結果はsavedにならず、不明tempはexact非Authority参照を持つ。
 * @cleanup mock復元後に今回Rootだけ回収。
 * @boundary Node Filesystemと既存Filesystem Store排他。
 */
test("保存・公開・回収の故障を成功や不存在へ畳まない", (t) => {
  for (const mode of [
    "open",
    "rename",
    "readback",
    "temporary",
    "lock",
  ] as const) {
    const f = fixture(t);
    fs.mkdirSync(f.directory, { recursive: true });
    let faults = 0;
    let published = false;
    const rename = t.mock.method(
      fs,
      "renameSync",
      new Proxy(fs.renameSync, {
        apply(target, receiver, args) {
          if (String(args[1]) === f.file) {
            if (mode === "rename" || mode === "temporary") {
              faults++;
              throw Error("private-failure");
            }
            const value = Reflect.apply(target, receiver, args);
            published = true;
            return value;
          }
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    const method =
      mode === "open"
        ? "openSync"
        : mode === "readback"
          ? "lstatSync"
          : mode === "lock"
            ? "rmSync"
            : "unlinkSync";
    const fault = t.mock.method(
      fs,
      method,
      new Proxy(fs[method], {
        apply(target, receiver, args) {
          const name = String(args[0]);
          if (
            (mode === "open" &&
              name.startsWith(f.directory) &&
              name.endsWith(".tmp")) ||
            (mode === "readback" && name === f.file && published) ||
            (mode === "temporary" &&
              name.startsWith(f.directory) &&
              name.endsWith(".tmp")) ||
            (mode === "lock" &&
              name === path.join(f.directory, "ai-selection.lock"))
          ) {
            faults++;
            throw Error("private-failure");
          }
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    const result = saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: config() },
      () => true,
    );
    fault.mock.restore();
    rename.mock.restore();
    assert.ok(faults > 0, mode);
    assert.equal(
      result.status,
      "unknown",
      `${mode}: ${JSON.stringify(result)}`,
    );
    if (result.status !== "unknown") assert.fail("unknown required");
    assert.equal(JSON.stringify(result).includes("private-failure"), false);
    assert.equal(
      result.publication,
      mode === "open"
        ? "not_published"
        : mode === "lock"
          ? "confirmed"
          : "unconfirmed",
    );
    assert.equal(
      result.cleanupConfirmed,
      mode !== "temporary" && mode !== "lock",
    );
    if (mode === "temporary") {
      assert.match(
        result.temporary?.relativePath ?? "",
        /^\.crdd\/config\/ai-selection\.[a-f0-9-]+\.tmp$/u,
      );
      assert.ok(result.temporary?.identity);
    }
    if (mode === "lock")
      assert.match(result.recoveryId ?? "", /^filesystem-store-lock\./u);
    assert.equal(fs.existsSync(f.file), mode === "readback" || mode === "lock");
  }
});

/**
 * 後続のLock終了失敗でも先行するtemp参照を保持する。
 * @responsibility 複合故障で元の公開段階・exact対象を上書きしない。
 * @trace RCM-IT-005
 * @precondition 自己生成Repositoryだけを使用。
 * @stimulus rename・temp削除・Lock closeを失敗させ、Lock回収の成否を分ける。
 * @observation temp実体、同じ参照、Lock回復ID、publication。
 * @oracle 非成功でtemp参照を保持し、Lock回収不明時だけ元IDを併記する。
 * @cleanup descriptorは代役内で実closeしmock復元後exact Rootを回収。
 * @boundary Storeの局所観測と既存Lock終了。
 */
test("temp回収不明とLock終了失敗が重なっても先行参照を失わない", (t) => {
  for (const lockCleanupFails of [false, true]) {
    const f = fixture(t);
    fs.mkdirSync(f.directory, { recursive: true });
    let lockFd: number | null = null;
    let closeFailures = 0;
    const open = t.mock.method(
      fs,
      "openSync",
      new Proxy(fs.openSync, {
        apply(target, receiver, args) {
          const fd = Reflect.apply(target, receiver, args);
          if (String(args[0]) === path.join(f.directory, "ai-selection.lock"))
            lockFd = fd;
          return fd;
        },
      }),
    );
    const close = t.mock.method(
      fs,
      "closeSync",
      new Proxy(fs.closeSync, {
        apply(target, receiver, args) {
          const value = Reflect.apply(target, receiver, args);
          if (args[0] === lockFd && closeFailures === 0) {
            closeFailures++;
            throw Error("fixture-close");
          }
          return value;
        },
      }),
    );
    const rename = t.mock.method(
      fs,
      "renameSync",
      new Proxy(fs.renameSync, {
        apply(target, receiver, args) {
          if (String(args[1]) === f.file) throw Error("fixture-rename");
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    const unlink = t.mock.method(
      fs,
      "unlinkSync",
      new Proxy(fs.unlinkSync, {
        apply(target, receiver, args) {
          if (
            String(args[0]).startsWith(f.directory) &&
            String(args[0]).endsWith(".tmp")
          )
            throw Error("fixture-unlink");
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    const rm = t.mock.method(
      fs,
      "rmSync",
      new Proxy(fs.rmSync, {
        apply(target, receiver, args) {
          if (
            lockCleanupFails &&
            String(args[0]) === path.join(f.directory, "ai-selection.lock")
          )
            throw Error("fixture-lock-cleanup");
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    const result = saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: config() },
      () => true,
    );
    for (const item of [open, close, rename, unlink, rm]) item.mock.restore();
    assert.equal(closeFailures, 1);
    assert.equal(result.status, "unknown", JSON.stringify(result));
    if (result.status !== "unknown") assert.fail("unknown required");
    assert.equal(result.publication, "unconfirmed");
    assert.equal(result.cleanupConfirmed, false);
    assert.ok(result.temporary?.identity);
    const temporary = path.join(f.root, result.temporary.relativePath);
    assert.equal(
      fs.lstatSync(temporary, { bigint: true }).ino.toString(),
      result.temporary.identity.ino,
    );
    if (lockCleanupFails)
      assert.match(result.recoveryId ?? "", /^filesystem-store-lock\./u);
    else assert.equal(result.recoveryId, null);
    assert.equal(fs.existsSync(f.file), false);
  }
});

/**
 * 準備後に別実体・複数Linkになったtempを削除しない。
 * @responsibility 名前だけに基づく回収を拒否する。
 * @trace RCM-IT-005
 * @precondition 作成時Identityを観測済みの合成temp。
 * @stimulus rename境界で別Fileへ置換又はhardlinkを追加して失敗する。
 * @observation 別実体・兄弟Fileの保全とcleanup不明結果。
 * @oracle 元Identityと異なる対象は削除せずReaderはtempを利用しない。
 * @cleanup mock復元後exact合成Rootだけ回収。
 * @boundary 作成Identityと現在File実体。
 */
test("tempの置換・hardlink化では削除を拒否し正本へ代用しない", (t) => {
  for (const mode of ["replace", "hardlink"] as const) {
    const f = fixture(t);
    fs.mkdirSync(f.directory, { recursive: true });
    let targetPath = "";
    const mocked = t.mock.method(
      fs,
      "renameSync",
      new Proxy(fs.renameSync, {
        apply(target, receiver, args) {
          if (String(args[1]) === f.file) {
            targetPath = String(args[0]);
            if (mode === "replace") {
              Reflect.apply(target, receiver, [
                targetPath,
                path.join(f.directory, "original.json"),
              ]);
              fs.writeFileSync(targetPath, "unrelated synthetic file");
            } else
              fs.linkSync(targetPath, path.join(f.directory, "other.json"));
            throw Error("fixture-identity-changed");
          }
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    const result = saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: config() },
      () => true,
    );
    mocked.mock.restore();
    assert.equal(result.status, "unknown");
    if (result.status !== "unknown") assert.fail("unknown required");
    assert.equal(result.cleanupConfirmed, false);
    assert.ok(result.temporary?.identity);
    assert.equal(fs.existsSync(targetPath), true);
    assert.equal(readRepositoryAiSelection(f.capability).status, "missing");
    assert.equal(
      fs.existsSync(
        path.join(
          f.directory,
          mode === "replace" ? "original.json" : "other.json",
        ),
      ),
      true,
    );
    if (mode === "replace")
      assert.equal(
        fs.readFileSync(targetPath, "utf8"),
        "unrelated synthetic file",
      );
  }
});

/**
 * 領域確保の失敗意味と回復参照を元契約どおり搬送する。
 * @responsibility 下位の不明Effectを保存前拒否で上書きしない。
 * @trace RCM-IT-005
 * @precondition 有効な合成設定と認可。
 * @stimulus 既存領域APIだけを元契約の固定失敗へ差し替える。
 * @observation setupFailureの全fieldと設定作成0。
 * @oracle 同じ回復参照・Effect・retryを保持する。
 * @cleanup module mockを復元し自己生成Rootを回収。
 * @boundary Domain領域確保の有限代役→Store結果。実Ignore故障の証明ではない。
 */
test("領域確保の元失敗契約とexact回復参照を保持する", async (t) => {
  const f = fixture(t);
  const failure = Object.freeze({
    status: "blocked" as const,
    reason: "repository_runtime_data_ignore_registration_blocked" as const,
    effectIssued: true,
    effectStateUnknown: true,
    effectConfirmation: "unknown" as const,
    cleanupConfirmed: false,
    retryAllowed: false,
    recoveryReference: `repository-local-ignore.${"a".repeat(64)}`,
    repositoryPathReported: false as const,
  });
  const mocked = t.mock.module("../../../domain-model/src/index.ts", {
    namedExports: { ...domain, ensureRepositoryRuntimeDataArea: () => failure },
  });
  try {
    const url = new URL(
      "../../src/storage/ai-selection.ts?setup-failure",
      import.meta.url,
    ).href;
    const isolated: typeof import("../../src/storage/ai-selection.ts") =
      await import(url);
    const result = isolated.saveRepositoryAiSelection(
      f.capability,
      { expectedIdentity: null, config: config() },
      () => true,
    );
    assert.equal(result.status, "unknown");
    if (result.status !== "unknown") assert.fail("unknown required");
    assert.deepEqual(result.setupFailure, failure);
    assert.equal(result.publication, "not_published");
    assert.equal(fs.existsSync(path.join(f.root, ".crdd")), false);
  } finally {
    mocked.restore();
  }
});

/**
 * 保存受付の余剰・実行Property・不正期待HashをEffect前に拒否する。
 * @responsibility 正しいCAS要求以外を初回保存へ補完しない。
 * @trace RCM-IT-005
 * @precondition 空の合成Repository。
 * @stimulus 余剰key、Getter、Proxy、欠測・不正Hashを渡す。
 * @observation blocked、hook実行0、設定領域作成0。
 * @oracle 不正入力で認可callbackも呼ばない。
 * @cleanup 自己生成Rootだけ回収。
 * @boundary 未信頼入力→保存受付。
 */
test("不正な保存受付はhookも認可も実行しない", (t) => {
  const f = fixture(t);
  let hooks = 0;
  let authorizations = 0;
  for (const value of [
    { expectedIdentity: null, config: config(), extra: true },
    { expectedIdentity: "A".repeat(64), config: config() },
    { config: config() },
    {
      expectedIdentity: null,
      get config() {
        hooks++;
        return config();
      },
    },
    new Proxy(
      {},
      {
        ownKeys() {
          hooks++;
          return [];
        },
      },
    ),
  ])
    assert.equal(
      saveRepositoryAiSelection(f.capability, value, () => {
        authorizations++;
        return true;
      }).status,
      "blocked",
    );
  assert.equal(hooks, 0);
  assert.equal(authorizations, 0);
  assert.equal(fs.existsSync(path.join(f.root, ".crdd")), false);
});
