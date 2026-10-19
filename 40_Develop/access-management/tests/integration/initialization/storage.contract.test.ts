/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import { readCurrentAccessState as readCurrentAccess } from "../../../src/authorization/current.ts";
import { authenticateCredential } from "../../../src/credential/authentication.ts";
import {
  createCredentialMaterial,
  verifyCredentialToken,
} from "../../../src/credential/token.ts";
import {
  authenticateNormalConnection,
  confirmInitialConnection,
  initializeFromHost,
  issueCredential,
  readCredentialAdministrationState,
  readHostInitializationState,
  updateCredentialPresentationState,
  resolveConnectionAuthentication,
  revokeCredential,
} from "../../../src/index.ts";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
} from "../../../src/initialization/execution.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import { readAccessManagementState } from "../../../src/storage/store.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import { saveUserRegistration as registerUser } from "../../../src/user/crud.ts";
import {
  bytes,
  fixture,
  managementFixture,
  prepareInitialUser,
} from "../storage/fixture.ts";

/**
 * Host再入場は保存済み元試行と段階だけを再観測する。
 * @responsibility 不存在・相関・User・資格・提示・完了を追加生成せず搬送する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Root。旧Host入力不存在は本試験の保証外。
 * @stimulus 最新AM入力を空にして初回各保存APIを順に呼び、各段階を読む。
 * @observation 段階・exact ID・改訂・秘密field不存在・current byteと材料。
 * @oracle freshは非Authority。元試行と生成済みIDを保持し、User/資格追加0・Secret再取得0。
 * @cleanup Fixtureがexact Rootを回収する。
 * @boundary 既存保存API→Host専用Reader。TTY・本番Hostは対象外。
 */
test("Host初回Readerはfreshから保存段階を非Authorityで再観測する", (t) => {
  const f = fixture(t),
    current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  assert.deepEqual(readHostInitializationState(f.root), { status: "fresh" });
  assert.equal(fs.existsSync(current), false);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(f.root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.deepEqual(readHostInitializationState(f.root), {
    status: "in_progress",
    attemptId,
    revision: 1,
    stage: "correlated",
  });
  const user = createInitialAdministrator(f.root, attemptId, "管理者");
  assert.ok(user.status === "completed");
  assert.deepEqual(readHostInitializationState(f.root), {
    status: "in_progress",
    attemptId,
    revision: 2,
    stage: "user_stored",
    userId: user.value.userId,
  });
  const again = createInitialAdministrator(f.root, attemptId, "再入場の名前");
  assert.ok(again.status === "completed");
  assert.equal(again.value.userId, user.value.userId);
  const issued = createInitialCredential(f.root, attemptId);
  assert.ok(issued.status === "completed" && issued.value.token);
  const expected = {
    status: "in_progress",
    attemptId,
    revision: issued.value.revision,
    stage: "credential_stored",
    userId: user.value.userId,
    initialCredentialId: issued.value.credentialId,
    confirmationCredentialId: issued.value.credentialId,
    presentation: "not_attempted",
    unresolvedExchange: false,
  };
  assert.deepEqual(readHostInitializationState(f.root), expected);
  const reentered = createInitialCredential(f.root, attemptId);
  assert.ok(reentered.status === "completed");
  assert.equal(reentered.value.token, null);
  const start = updateCredentialPresentationState(f.root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attemptId,
    expectedRevision: issued.value.revision,
    target: "unconfirmed",
  });
  assert.ok(start.status === "completed");
  assert.deepEqual(readHostInitializationState(f.root), {
    ...expected,
    revision: start.value.revision,
    presentation: "unconfirmed",
  });
  const completed = updateCredentialPresentationState(f.root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attemptId,
    expectedRevision: start.value.revision,
    presentationOperationId: start.value.presentationOperationId,
    target: "confirmed",
  });
  assert.ok(completed.status === "completed");
  assert.deepEqual(readHostInitializationState(f.root), {
    ...expected,
    revision: completed.value.revision,
    presentation: "confirmed",
  });
  const binding = resolveConnectionAuthentication(f.root, issued.value.token);
  assert.ok(binding.status === "initial");
  assert.equal(
    confirmInitialConnection(
      f.root,
      issued.value.token,
      binding.binding,
      new AbortController().signal,
    ).status,
    "completed",
  );
  const before = fs.readFileSync(current);
  assert.deepEqual(readHostInitializationState(f.root), { status: "existing" });
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 部分材料や保存・Lock不明をfreshへ戻さない。
 * @responsibility Host初期化の再観測を固定unknownへ閉じ、残存材料を保持する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Rootと限定した保存故障。
 * @stimulus current欠測＋pending/replace、破損current、初回base材料、Lock解放故障を与える。
 * @observation 固定unknown、currentと材料byte、Root一覧。
 * @oracle 不明は追加生成0・初期化許可0、Secret/Root/回復参照なし。
 * @cleanup hook復元とfixture回収。
 * @boundary Readerの実Filesystem負観測と既存排他。
 */
test("Host初回Readerは材料・状態・Lock不明をfreshへ丸めない", (t) => {
  const unknown = {
    status: "unknown",
    reason: "host_initialization_state_unavailable",
  };
  for (const material of [
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    const f = fixture(t),
      current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    const target = path.join(f.directory, material);
    fs.writeFileSync(target, "{partial fixture");
    assert.deepEqual(readHostInitializationState(f.root), unknown);
    assert.equal(fs.readFileSync(target, "utf8"), "{partial fixture");
    assert.equal(fs.existsSync(current), false);
  }
  const f = fixture(t),
    current = path.join(f.directory, "access-management.json");
  const valid = fs.readFileSync(current);
  fs.writeFileSync(current, "{}");
  assert.deepEqual(readHostInitializationState(f.root), unknown);
  assert.equal(fs.readFileSync(current, "utf8"), "{}");
  fs.writeFileSync(current, valid);
  const remove = fs.rmSync;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("fixture unlock");
    return remove(target, options);
  };
  try {
    assert.deepEqual(readHostInitializationState(f.root), unknown);
  } finally {
    fs.rmSync = remove;
  }
  assert.deepEqual(readHostInitializationState(f.root), { status: "existing" });
  assert.deepEqual(fs.readFileSync(current), valid);
  const initial = fixture(t),
    initialPath = path.join(initial.directory, "access-management.json");
  fs.rmSync(initialPath);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(initial.root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const before = fs.readFileSync(initialPath),
    rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (String(to) === initialPath) throw new Error("fixture rename");
    rename(from, to);
  };
  try {
    assert.equal(
      createInitialAdministrator(initial.root, attemptId, "管理者").status,
      "unavailable",
    );
  } finally {
    fs.renameSync = rename;
  }
  const pending = path.join(
    initial.directory,
    "access-management.pending.json",
  );
  const pendingBytes = fs.readFileSync(pending);
  assert.deepEqual(readHostInitializationState(initial.root), unknown);
  assert.deepEqual(fs.readFileSync(initialPath), before);
  assert.deepEqual(fs.readFileSync(pending), pendingBytes);
});

/**
 * User出版後の実Process喪失からHostが元試行を取り直す。
 * @responsibility 出版済み材料とLockのexact処置後に同Userを再開する。
 * @trace RFD-IT-025
 * @precondition 自己生成の相関済みRootと子Process。
 * @stimulus Userのcurrent置換直後に子Processをexit(23)する。
 * @observation 子終了code・stdout空、Readerのattempt/User、同ID再入場と材料不存在。
 * @oracle 保存済みUserを保持し、追加UUID0・Secret0、次資格だけ同試行へ結合。
 * @cleanup 子join済み、FixtureがRootを回収する。
 * @boundary 実子Process→保存→Host内部Reader→同元試行の既存Writer。
 */
test("Host初回ReaderはProcess喪失後の元試行とUserを再開できる", (t) => {
  const f = fixture(t),
    current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(f.root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL(
    "../../../src/initialization/execution.ts",
    import.meta.url,
  ).href;
  const script = `
    import fs from "node:fs";
    import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)};
    import {createInitialAdministrator} from ${JSON.stringify(storeUrl)};
    const rename = fs.renameSync;
    fs.renameSync = (a,b) => { rename(a,b); if(String(b)===${JSON.stringify(current)})process.exit(23); };
    createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}), ${JSON.stringify(attemptId)}, "模擬管理者");
  `;
  const child = spawnSync(process.execPath, ["--eval", script], {
    timeout: 10_000,
    encoding: "utf8",
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 23, child.stderr);
  assert.equal(child.stdout, "");
  const observed = readHostInitializationState(f.root);
  assert.ok(
    observed.status === "in_progress" && observed.stage === "user_stored",
  );
  assert.equal(observed.attemptId, attemptId);
  const before = fs.readFileSync(current);
  const user = createInitialAdministrator(f.root, observed.attemptId, "別名");
  assert.ok(user.status === "completed");
  assert.equal(user.value.userId, observed.userId);
  assert.deepEqual(fs.readFileSync(current), before);
  const issued = createInitialCredential(f.root, observed.attemptId);
  assert.ok(issued.status === "completed");
  const state = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.equal(state.users.length, 1);
  assert.equal(state.credentials.length, 1);
  assert.equal(state.credentials[0]?.userId, observed.userId);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 初回途中の有効資格を通常接続へ昇格しない。
 * @responsibility 本人確認の成功と通常Surfaceの認証拒否を区別する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 自己生成Rootに初回資格を保存する。
 * @stimulus 有効資格で両認証入口を呼び、未完了時に不正pending／孤立replaceも置く。
 * @observation 結果全field、current・pending・replace byte、Directory一覧。
 * @oracle 本人確認だけ成功。通常接続は固定拒否で材料不変更、本人・対象情報なし。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary AM公開認証入口と実保存Lock。公開MCPは後続試験。
 */
test("通常接続は初回途中の有効資格を拒否して材料を保持する", (t) => {
  const f = fixture(t);
  const issued = createInitialCredential(f.root, prepareInitialUser(f));
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("fixture credential unavailable");
  assert.equal(
    authenticateCredential(f.root, issued.value.token).status,
    "completed",
  );
  const current = path.join(f.directory, "access-management.json");
  const pending = path.join(f.directory, "access-management.pending.json");
  const replace = path.join(f.directory, "access-management.replace.json");
  fs.writeFileSync(pending, "incomplete fixture");
  fs.writeFileSync(replace, "orphan fixture");
  const before = fs.readFileSync(current);
  const pendingBefore = fs.readFileSync(pending);
  const replaceBefore = fs.readFileSync(replace);
  const names = fs.readdirSync(f.directory).sort();
  assert.deepEqual(authenticateNormalConnection(f.root, issued.value.token), {
    status: "unavailable",
    reason: "credential_authentication_rejected",
  });
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readFileSync(pending), pendingBefore);
  assert.deepEqual(fs.readFileSync(replace), replaceBefore);
  assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
});

/**
 * 初回鍵の一生成・保存・再表示禁止を確認する。
 * @responsibility 短命鍵と保存照合値を別に観測する。
 * @trace RFD-IT-024
 * @precondition 保存済み初回User。
 * @stimulus 初回鍵保存と同元試行の再入場。
 * @observation 乱数件数、token照合、保存byte、材料不存在。
 * @oracle 再入場は生成0・token null、保存に生鍵なし。
 * @cleanup 差替え復元とFixture削除。
 * @boundary Node暗号・Filesystem。
 */
test("初回資格は一回生成し保存後の再入場で再表示しない", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const random = crypto.randomBytes;
  let calls = 0;
  crypto.randomBytes = ((size: number) => {
    calls++;
    return random(size);
  }) as typeof random;
  try {
    const first = createInitialCredential(f.root, attempt);
    assert.equal(first.status, "completed");
    if (first.status !== "completed") return;
    assert.equal(first.value.created, true);
    assert.equal(calls, 3);
    assert.ok(first.value.token);
    const saved = fs.readFileSync(
      path.join(f.directory, "access-management.json"),
    );
    assert.equal(saved.includes(first.value.token), false);
    const secret = first.value.token.split(".")[3];
    assert.ok(secret);
    assert.equal(saved.includes(secret), false);
    const state = JSON.parse(saved.toString()) as AccessManagementState;
    assert.equal(state.credentials.length, 1);
    const credential = state.credentials[0];
    assert.ok(credential);
    assert.equal(verifyCredentialToken(first.value.token, credential), true);
    assert.equal(credential.operationId, attempt);
    assert.equal(credential.presentation, "not_attempted");
    const again = createInitialCredential(f.root, attempt);
    assert.equal(again.status, "completed");
    if (again.status === "completed")
      assert.deepEqual(again.value, {
        revision: 3,
        credentialId: first.value.credentialId,
        created: false,
        token: null,
      });
    assert.equal(calls, 3);
    assert.deepEqual(
      fs.readFileSync(path.join(f.directory, "access-management.json")),
      saved,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    crypto.randomBytes = random;
  }
});

/**
 * 不正な初回状態を鍵生成前に拒否する。
 * @responsibility 別試行・状態改変から鍵を発行しない。
 * @trace RFD-IT-024
 * @precondition 初回Userの自己生成保存Root。
 * @stimulus 別試行と初期Role改変を渡す。
 * @observation 暗号乱数件数0と保存byte不変。
 * @oracle unavailable、未生成、既存User不変更。
 * @cleanup 暗号差替え復元とFixture削除。
 * @boundary 初回状態と乱数生成境界。
 */
test("初回資格の別試行と非canonical状態は生成前に拒否する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const current = path.join(f.directory, "access-management.json");
  const saved = fs.readFileSync(current);
  const random = crypto.randomBytes;
  let calls = 0;
  crypto.randomBytes = ((size: number) => {
    calls++;
    return random(size);
  }) as typeof random;
  try {
    assert.equal(
      createInitialCredential(f.root, "00000000-0000-4000-8000-000000000098")
        .status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(current), saved);
    const modified = JSON.parse(saved.toString()) as AccessManagementState;
    const developer = modified.roleContentAccess[0];
    assert.ok(developer);
    developer.workspaceIds = [];
    fs.writeFileSync(current, bytes(modified));
    const before = fs.readFileSync(current);
    const rejected = createInitialCredential(f.root, attempt);
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.cleanupConfirmed, true);
    assert.deepEqual(fs.readFileSync(current), before);
    assert.equal(calls, 0);
  } finally {
    crypto.randomBytes = random;
  }
});

/**
 * 保存途中のProcess喪失を資格生成の再試行へ畳まない。
 * @responsibility base保持と出版済み同資格再観測を区別する。
 * @trace RFD-IT-024
 * @precondition 初回Userと一回性子Process。
 * @stimulus pending・replace確定後またはrename後に子を終了する。
 * @observation 子終了・保存材料・再入場の乱数0・token非返却。
 * @oracle baseは停止保持、nextだけ同資格で清掃完了。
 * @cleanup 子Process終了とFixture削除。
 * @boundary 実ProcessとFilesystem。
 */
test("初回資格のProcess喪失は再生成せず保存段階を保持する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const attempt = prepareInitialUser(f);
    const current = path.join(f.directory, "access-management.json");
    const before = fs.readFileSync(current);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL(
      "../../../src/initialization/execution.ts",
      import.meta.url,
    ).href;
    const child = spawnSync(
      process.execPath,
      [
        "--eval",
        `
      import fs from 'node:fs';
      import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)};
      import {createInitialCredential} from ${JSON.stringify(storeUrl)};
      let n=0; const flush=fs.fsyncSync;
      fs.fsyncSync=fd=>{flush(fd); n++; if((${JSON.stringify(phase)}==='pending'&&n===2)||(${JSON.stringify(phase)}==='replace'&&n===3)) process.exit(23);};
      const rename=fs.renameSync;
      fs.renameSync=(a,b)=>{rename(a,b); if(${JSON.stringify(phase)}==='renamed') process.exit(23);};
      createInitialCredential(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)});
    `,
      ],
      { timeout: 10_000, encoding: "utf8" },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    assert.equal(child.stdout, "");
    const random = crypto.randomBytes;
    let calls = 0;
    crypto.randomBytes = ((size: number) => {
      calls++;
      return random(size);
    }) as typeof random;
    try {
      const result = createInitialCredential(f.root, attempt);
      assert.equal(calls, 0);
      if (phase === "renamed") {
        assert.equal(result.status, "completed");
        if (result.status === "completed") {
          assert.equal(result.value.created, false);
          assert.equal(result.value.token, null);
        }
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      } else {
        assert.equal(result.status, "unavailable");
        assert.equal(result.cleanupConfirmed, false);
        assert.deepEqual(fs.readFileSync(current), before);
        assert.ok(
          fs.existsSync(
            path.join(f.directory, "access-management.pending.json"),
          ),
        );
        assert.equal(
          fs.existsSync(
            path.join(f.directory, "access-management.replace.json"),
          ),
          phase === "replace",
        );
      }
    } finally {
      crypto.randomBytes = random;
    }
  }
});

/**
 * 出版後Lock解放不明では生鍵を返さない。
 * @responsibility 保存成功と配送可能な完了を分離する。
 * @trace RFD-IT-024
 * @precondition 初回User保存済みの自己生成Root。
 * @stimulus 資格出版後のLock削除を拒否する。
 * @observation confirmed出版・unavailable・value非存在と再入場token null。
 * @oracle 未確認清掃でSecret搬送なし、追加鍵生成なし。
 * @cleanup 差替え復元・既存Lock再入場・Fixture削除。
 * @boundary 保存結果と既存Lock終了。
 */
test("初回資格のLock解放不明は短命鍵を外へ返さない", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const remove = fs.rmSync;
  let failed: ReturnType<typeof createInitialCredential>;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  try {
    failed = createInitialCredential(f.root, attempt);
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "confirmed");
  assert.equal(failed.cleanupConfirmed, false);
  assert.equal("value" in failed, false);
  const again = createInitialCredential(f.root, attempt);
  assert.equal(again.status, "completed");
  if (again.status === "completed") {
    assert.equal(again.value.created, false);
    assert.equal(again.value.token, null);
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * Host初回compositionの保存順と一度提示を接続する。
 * @responsibility write falseでも一回だけ出力し、提示と通常認証を別観測する。
 * @trace RFD-IT-024
 * @precondition 自己生成RootとNode Writableの局所TTY代役。
 * @stimulus freshから実保存APIと一write、同鍵初回確認を順に実行する。
 * @observation 書込み前unconfirmed、提示confirmed、段階、Listenerと次認証。
 * @oracle 初回接続前は通常認証0、一提示・同鍵確認後だけ通常認証。
 * @cleanup Fixture回収と当該Listener不存在。共有streamを閉じない。
 * @boundary 注入TTY→Host composition→実保存。実Host TTYの証明ではない。
 */
test("Host初回compositionは保存確定後に一度提示して接続待ちになる", async (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.directory, "access-management.json"));
  let writes = 0;
  let key = "";
  let previousReads = 0;
  const terminal = Object.assign(
    new Writable({
      highWaterMark: 1,
      write(chunk, _encoding, callback) {
        writes++;
        const observed = readHostInitializationState(f.root);
        assert.equal(observed.status, "in_progress");
        assert.equal(
          observed.status === "in_progress" &&
            observed.stage === "credential_stored" &&
            observed.presentation,
          "unconfirmed",
        );
        key = chunk.toString("utf8").split("\n")[1];
        setImmediate(callback);
      },
    }),
    { isTTY: true },
  ) as unknown as NodeJS.WriteStream;
  const controller = new AbortController();
  const result = await initializeFromHost(
    f.root,
    "管理者",
    true,
    () => {
      previousReads++;
      return ["uninitialized", "absent"];
    },
    terminal,
    controller.signal,
  );
  assert.deepEqual(result, {
    status: "awaiting_connection",
    reason: "host_key_presented",
  });
  assert.equal(writes, 1);
  assert.equal(previousReads, 2);
  assert.equal(terminal.writable, true);
  assert.equal(terminal.destroyed, false);
  assert.equal(terminal.listenerCount("error"), 0);
  assert.equal(terminal.listenerCount("close"), 0);
  const observed = readHostInitializationState(f.root);
  assert.equal(
    observed.status === "in_progress" &&
      observed.stage === "credential_stored" &&
      observed.presentation,
    "confirmed",
  );
  assert.equal(authenticateNormalConnection(f.root, key).status, "unavailable");
  const binding = resolveConnectionAuthentication(f.root, key);
  assert.equal(binding.status, "initial");
  if (binding.status !== "initial") return;
  assert.equal(
    confirmInitialConnection(f.root, key, binding.binding, controller.signal)
      .status,
    "completed",
  );
  assert.equal(authenticateNormalConnection(f.root, key).status, "completed");
  const saved = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
    "utf8",
  );
  assert.equal(saved.includes(key), false);
  assert.equal(JSON.stringify(result).includes(key), false);
  key = "";
});

/**
 * 保存済み初回段階では追加試行や保存済み鍵の再表示を行わない。
 * @responsibility 段階別の再入場と次行動を元相関へ結ぶ。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition correlated／user_stored／credential_storedの自己生成前状態。
 * @stimulus 同Host入口へ再入場し保存済み段階を読む。
 * @observation 元attempt/User、資格件数、write件数と次行動。
 * @oracle 資格保存前だけ同試行を進め、保存後は再表示0。
 * @cleanup Fixtureが各Rootの不存在を確認する。
 * @boundary 初回composition→保存。TTYは局所代役。
 */
test("Host初回compositionは途中の元試行を使い保存済み鍵を再表示しない", async (t) => {
  for (const stage of [
    "correlated",
    "user_stored",
    "not_attempted",
    "unconfirmed",
    "confirmed",
  ] as const) {
    const f = fixture(t);
    fs.rmSync(path.join(f.directory, "access-management.json"));
    const attempt = crypto.randomUUID();
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, () => [
        "uninitialized",
        "absent",
      ]).status,
      "completed",
    );
    if (stage !== "correlated")
      assert.equal(
        createInitialAdministrator(f.root, attempt, "元の管理者").status,
        "completed",
      );
    if (stage !== "correlated" && stage !== "user_stored") {
      const issued = createInitialCredential(f.root, attempt);
      assert.equal(issued.status, "completed");
      if (issued.status !== "completed") return;
      if (stage !== "not_attempted") {
        const started = updateCredentialPresentationState(f.root, {
          credentialId: issued.value.credentialId,
          issuanceOperationId: attempt,
          expectedRevision: issued.value.revision,
          target: "unconfirmed",
        });
        assert.equal(started.status, "completed");
        if (stage === "confirmed" && started.status === "completed")
          assert.equal(
            updateCredentialPresentationState(f.root, {
              credentialId: started.value.credentialId,
              issuanceOperationId: attempt,
              expectedRevision: started.value.revision,
              presentationOperationId: started.value.presentationOperationId,
              target: "confirmed",
            }).status,
            "completed",
          );
      }
    }
    const before = readAccessManagementState(f.root);
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    const result = await initializeFromHost(
      f.root,
      "再入場名",
      true,
      () => {
        throw new Error("old_observer_must_not_run");
      },
      terminal,
      new AbortController().signal,
    );
    assert.equal(
      result.status,
      stage === "confirmed" || stage === "correlated" || stage === "user_stored"
        ? "awaiting_connection"
        : "key_exchange_required",
    );
    assert.equal(
      writes,
      stage === "correlated" || stage === "user_stored" ? 1 : 0,
    );
    const after = readAccessManagementState(f.root);
    assert.equal(after.status, "completed");
    if (after.status !== "completed" || before.status !== "completed") return;
    assert.equal(after.value.initialization.attemptId, attempt);
    assert.equal(after.value.users.length, 1);
    assert.equal(after.value.credentials.length, 1);
    if (before.value.users[0])
      assert.equal(after.value.users[0]?.userId, before.value.users[0].userId);
    if (stage !== "correlated" && stage !== "user_stored")
      assert.deepEqual(after.value, before.value);
  }
});

/**
 * 旧入力・対話条件・開始前取消が不成立なら新規Effectを開始しない。
 * @responsibility 不明をfreshや暗黙承認へ変換しない。
 * @trace RFD-IT-025
 * @precondition AM入力を持たない自己生成Rootと計数Writer。
 * @stimulus 旧観測不正／throw、非TTY、明示なし、取消済みを与える。
 * @observation current不存在とwrite件数、結果非秘密。
 * @oracle 新相関・User・資格・TTY出力0。
 * @cleanup Fixtureによるexact Root回収。
 * @boundary Host内部入力と保存開始境界。
 */
test("Host初回compositionは不成立前提で相関と出力を作らない", async (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  let writes = 0;
  const terminal = Object.assign(
    new Writable({
      write(_chunk, _encoding, callback) {
        writes++;
        callback();
      },
    }),
    { isTTY: true },
  ) as unknown as NodeJS.WriteStream;
  for (const previous of [
    ["existing", "absent"],
    ["uninitialized", "unknown"],
    ["unknown", "absent"],
  ] as const) {
    const result = await initializeFromHost(
      f.root,
      "管理者",
      true,
      () => previous,
      terminal,
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fs.existsSync(current), false);
  }
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => {
          throw new Error("observation_failure");
        },
        terminal,
        new AbortController().signal,
      )
    ).status,
    "blocked",
  );
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        false,
        () => ["uninitialized", "absent"],
        terminal,
        new AbortController().signal,
      )
    ).status,
    "blocked",
  );
  terminal.isTTY = false as unknown as true;
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => ["uninitialized", "absent"],
        terminal,
        new AbortController().signal,
      )
    ).status,
    "blocked",
  );
  terminal.isTTY = true;
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => ["uninitialized", "absent"],
        terminal,
        controller.signal,
      )
    ).status,
    "cancelled",
  );
  assert.equal(fs.existsSync(current), false);
  assert.equal(writes, 0);
});

/**
 * TTYの保留中取消と故障は遅延callbackで成功へ戻さない。
 * @responsibility callback joinとListener回収を保存confirmedとは別に観測する。
 * @trace RFD-IT-025
 * @precondition Node Writableの保留callback、取消Signal、実保存Root。
 * @stimulus abort／write errorをcallback前に与え、遅れて完了させる。
 * @observation Promise保留、一write、unconfirmed維持、既存Listener保持。
 * @oracle callback join前の完了0、遅延成功でconfirmed保存0。
 * @cleanup 当該Listenerだけ回収。FixtureがRootを削除する。
 * @boundary 局所TTY callbackとAM保存。実Host TTY未評価。
 */
test("Host初回TTYは取消と故障後のcallbackをjoinして再表示しない", async (t) => {
  for (const mode of ["abort", "error"] as const) {
    const f = fixture(t);
    fs.rmSync(path.join(f.directory, "access-management.json"));
    let complete: ((error?: Error | null) => void) | undefined;
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          complete = callback;
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    /**
     * 呼出し元の既存error購読を試験用に保持する。
     * @responsibility AMが他OwnerのListenerを除去しないことを照合する。
     * @trace RFD-IT-025
     * @precondition 自己生成Writableだけへ登録する。
     * @stimulus 提示処理をabortまたはwrite callback errorで終了する。
     * @observation 処理終了後のListener集合に同じ関数が残る。
     * @oracle 無処理の既存購読をAMの終了確認へ流用しない。
     * @cleanup AMが除去していないことをassertし、試験終了で自己生成Writable参照を破棄する。
     * @boundary 試験が所有するWritableのListener。
     */
    const existingErrorListener = () => {};
    terminal.on("error", existingErrorListener);
    const controller = new AbortController();
    let settled = false;
    const running = initializeFromHost(
      f.root,
      "管理者",
      true,
      () => ["uninitialized", "absent"],
      terminal,
      controller.signal,
    ).then((result) => {
      settled = true;
      return result;
    });
    assert.ok(complete);
    if (mode === "abort") controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    complete(mode === "error" ? new Error("synthetic_write_failure") : null);
    const result = await running;
    assert.equal(result.status, mode === "abort" ? "cancelled" : "blocked");
    assert.equal(writes, 1);
    assert.deepEqual(terminal.listeners("error"), [existingErrorListener]);
    assert.equal(terminal.listenerCount("close"), 0);
    const observed = readHostInitializationState(f.root);
    assert.equal(
      observed.status === "in_progress" &&
        observed.stage === "credential_stored" &&
        observed.presentation,
      "unconfirmed",
    );
    const replay = await initializeFromHost(
      f.root,
      "再入場",
      true,
      () => ["uninitialized", "absent"],
      Object.assign(
        new Writable({
          write() {
            assert.fail("replay_write");
          },
        }),
        { isTTY: true },
      ) as unknown as NodeJS.WriteStream,
      new AbortController().signal,
    );
    assert.equal(replay.status, "key_exchange_required");
  }
});

/**
 * TTYの通知順・重複・同期throwを一writeに閉じる。
 * @responsibility callbackをjoinし失敗固定と当該Listener回収を独立観測する。
 * @trace RFD-IT-025
 * @precondition 実Writableに限定した局所write通知注入と自己生成Root。
 * @stimulus close／error先行、同期throw、重複callbackとfalse返却を与える。
 * @observation 結果、提示状態、write件数、Listenerとstream非終了。
 * @oracle 先行失敗はunconfirmed、重複成功は一confirmed、再表示0。
 * @cleanup Fixture回収、当該Listener不存在。共有streamを閉じない。
 * @boundary 通知注入試験。実TTYの動作保証ではない。
 */
test("Host初回TTYは先行通知と重複callbackを一度だけ処置する", async (t) => {
  for (const mode of [
    "close",
    "error",
    "late-close",
    "late-error",
    "throw",
    "duplicate",
  ] as const) {
    const f = fixture(t);
    fs.rmSync(path.join(f.directory, "access-management.json"));
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    let writes = 0;
    terminal.write = ((
      _chunk: unknown,
      callback: (error?: Error | null) => void,
    ) => {
      writes++;
      if (mode === "throw") throw new Error("synthetic_throw");
      if (mode === "close" || mode === "error")
        terminal.emit(mode, new Error("synthetic_notification"));
      setImmediate(() => {
        callback();
        if (mode === "late-close") terminal.emit("close");
        if (mode === "late-error")
          terminal.emit("error", new Error("synthetic_late_notification"));
        if (mode === "duplicate") callback();
      });
      return false;
    }) as typeof terminal.write;
    const result = await initializeFromHost(
      f.root,
      "管理者",
      true,
      () => ["uninitialized", "absent"],
      terminal,
      new AbortController().signal,
    );
    assert.equal(
      result.status,
      mode === "duplicate" ? "awaiting_connection" : "blocked",
    );
    assert.equal(writes, 1);
    assert.equal(terminal.listenerCount("error"), 0);
    assert.equal(terminal.listenerCount("close"), 0);
    assert.equal(terminal.writable, true);
    assert.equal(terminal.destroyed, false);
    const observed = readHostInitializationState(f.root);
    assert.equal(
      observed.status === "in_progress" &&
        observed.stage === "credential_stored" &&
        observed.presentation,
      mode === "duplicate" ? "confirmed" : "unconfirmed",
    );
  }
});

/**
 * 提示前／提示後の保存故障を再表示や正常完了へ変換しない。
 * @responsibility unconfirmed確定前の出力0と確定後の故障保持を確認する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Rootとcurrent exact rename故障。
 * @stimulus unconfirmedまたはconfirmedの出版でrenameを失敗させる。
 * @observation TTY回数、保存presentation、元相関、非秘密結果と残存材料。
 * @oracle unconfirmed出版失敗なら出力0、confirmed失敗なら一度出力後も未完了。
 * @cleanup 注入をfinallyで戻しFixtureがexact Rootを回収する。
 * @boundary Host composition→実保存／局所TTY代役。
 */
test("Host初回提示の保存故障は出力順と未完了を保持する", async (t) => {
  for (const failedPublication of [3, 4]) {
    const f = fixture(t);
    const current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    let writes = 0;
    let publications = 0;
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (String(to) === current && ++publications === failedPublication)
        throw new Error("synthetic_publication_failure");
      return rename(from, to);
    };
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    try {
      const result = await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => ["uninitialized", "absent"],
        terminal,
        new AbortController().signal,
      );
      assert.equal(result.status, "blocked");
      assert.equal(writes, failedPublication === 3 ? 0 : 1);
      const state = parseAccessManagementState(fs.readFileSync(current));
      assert.equal(state.status, "parsed");
      if (state.status !== "parsed") return;
      assert.equal(
        state.state.credentials[0]?.presentation,
        failedPublication === 3 ? "not_attempted" : "unconfirmed",
      );
      assert.equal(state.state.users.length, 1);
      assert.equal(state.state.credentials.length, 1);
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
        true,
      );
      assert.equal(terminal.listenerCount("error"), 0);
      assert.equal(terminal.listenerCount("close"), 0);
    } finally {
      fs.renameSync = rename;
    }
  }
});

/**
 * 資格管理一覧の状態・排他・解放不明を非開示へ閉じる。
 * @responsibility 初回途中や観測故障を空の成功一覧へ丸めない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Store、現在有効administrator資格。
 * @stimulus 初回途中、current破損、読取り／Lock解放故障を注入する。
 * @observation 固定unavailableとSnapshot不存在、currentの保持。
 * @oracle 全条件で対象情報0。新Store・鍵生成・提示0。
 * @cleanup Hook復元とFixture回収。
 * @boundary AM内部Readerと実Filesystem。
 */
test("資格管理一覧は初回と観測解放不明で情報を返さない", (t) => {
  for (const mode of ["initial", "corrupt", "read", "release"] as const) {
    const f = managementFixture(t);
    const current = path.join(f.directory, "access-management.json");
    if (mode === "corrupt") fs.writeFileSync(current, "{}");
    if (mode === "initial") {
      const credential = f.state.credentials[0];
      assert.ok(credential);
      const user = f.state.users[0];
      assert.ok(user);
      f.state.users = [user];
      f.state.credentials = [credential];
      credential.operationId = f.state.initialization.attemptId;
      f.state.initialization = {
        stage: "credential_stored",
        attemptId: credential.operationId,
        userId: user.userId,
        initialCredentialId: credential.credentialId,
        confirmationCredentialId: credential.credentialId,
      };
      fs.writeFileSync(current, bytes(f.state));
    }
    const open = fs.openSync,
      remove = fs.rmSync;
    if (mode === "read")
      fs.openSync = (file, flags, permissions) => {
        if (String(file) === current) throw new Error("synthetic_read_failure");
        return open(file, flags, permissions);
      };
    if (mode === "release")
      fs.rmSync = (file, options) => {
        if (String(file).endsWith("access-management.lock"))
          throw new Error("synthetic_release_failure");
        return remove(file, options);
      };
    try {
      assert.deepEqual(
        readCredentialAdministrationState(f.root, f.tokens.administrator),
        {
          status: "unavailable",
          reason: "credential_administration_unavailable",
        },
      );
    } finally {
      fs.openSync = open;
      fs.rmSync = remove;
    }
  }
});

/**
 * 初回途中の本人表示を初回完成や管理操作へ昇格しない。
 * @responsibility 本人読取りの非更新と拒否・観測不能の非開示を確認する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 自己生成Rootで初回資格保存まで進める。
 * @stimulus 本人read、通常管理、未知／失効鍵、破損currentを順に試す。
 * @observation 初回段階・current bytes・公開結果field・通常操作結果。
 * @oracle 初回不変更、通常管理拒否、拒否と観測不能でSnapshotなし。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 初回資格・本人読取り・現在保存Owner。
 */
test("初回途中の本人readは非更新で不成立状態を開示しない", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token) return;
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  assert.equal(
    readCurrentAccess(f.root, issued.value.token).status,
    "completed",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  assert.equal(
    registerUser(
      f.root,
      issued.value.token,
      3,
      crypto.randomUUID(),
      "追加",
      "developer",
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  const unknown = createCredentialMaterial().token;
  assert.deepEqual(readCurrentAccess(f.root, unknown), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  const state = JSON.parse(before.toString()) as AccessManagementState;
  const credential = state.credentials[0];
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(current, bytes(state));
  assert.deepEqual(readCurrentAccess(f.root, issued.value.token), {
    status: "unavailable",
    reason: "current_access_observation_unknown",
  });
  const normal = managementFixture(t);
  const normalCredential = normal.state.credentials[1];
  assert.ok(normalCredential);
  normalCredential.revoked = true;
  assert.equal(
    parseAccessManagementState(bytes(normal.state)).status,
    "parsed",
  );
  fs.writeFileSync(
    path.join(normal.directory, "access-management.json"),
    bytes(normal.state),
  );
  assert.deepEqual(readCurrentAccess(normal.root, normal.tokens.manager), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  fs.writeFileSync(current, "{");
  assert.deepEqual(readCurrentAccess(f.root, issued.value.token), {
    status: "unavailable",
    reason: "current_access_observation_unknown",
  });
  assert.deepEqual(readCurrentAccess(f.root, "invalid"), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
});

/**
 * 初回Userを一度保存し再要求で増殖しないことを確認する。
 * @responsibility 保存済みUserの再観測と名前更新を分離する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootに初回相関だけを保存する。
 * @stimulus 初回User保存後、同じ名前と別名で再要求する。
 * @observation UUID件数・完全byte・User・空Credentialを確認する。
 * @oracle UUIDは初回の2個だけ。再要求では保存名とIDを返す。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary 初回User保存と実Filesystem。
 */
test("初回管理者を保存し同Userへ再入場する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attempt = "00000000-0000-4000-8000-000000000099";
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const random = crypto.randomUUID;
  let calls = 0;
  crypto.randomUUID = () => {
    calls++;
    return random();
  };
  t.after(() => {
    crypto.randomUUID = random;
  });
  const first = createInitialAdministrator(f.root, attempt, "管理者");
  assert.equal(first.status, "completed");
  if (first.status !== "completed") return;
  assert.equal(first.value.created, true);
  assert.equal(calls, 2);
  const saved = fs.readFileSync(current);
  for (const name of ["管理者", "別名"]) {
    const again = createInitialAdministrator(f.root, attempt, name);
    assert.equal(again.status, "completed");
    if (again.status !== "completed") continue;
    assert.deepEqual(again.value, { ...first.value, created: false });
    assert.deepEqual(fs.readFileSync(current), saved);
  }
  assert.equal(calls, 2);
  const state = JSON.parse(saved.toString());
  assert.equal(state.users.length, 1);
  assert.deepEqual(state.credentials, []);
  assert.equal(state.initialization.stage, "user_stored");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 初回Userの保存途中終了と出版後再入場を確認する。
 * @responsibility 過去の途中材料を再出版せず保存済みUserだけ再観測する。
 * @trace RFD-IT-024
 * @precondition 初回相関を持つ自己生成Rootと一回性子Process。
 * @stimulus pending確定・replace確定・rename直後で子Processを終了する。
 * @observation 子Process終了、current byte、再入場時UUID生成0と材料を確認する。
 * @oracle base材料は保持停止、next材料は清掃して同Userを返す。
 * @cleanup 子Process終了と自己生成Root削除を確認する。
 * @boundary Node Process・Filesystem・既存Lock。
 */
test("初回UserのProcess喪失はbase保持とnext再観測を区別する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    const attempt = "00000000-0000-4000-8000-000000000099";
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, () => [
        "uninitialized",
        "absent",
      ]).status,
      "completed",
    );
    const before = fs.readFileSync(current);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL(
      "../../../src/initialization/execution.ts",
      import.meta.url,
    ).href;
    const child = spawnSync(
      process.execPath,
      [
        "--eval",
        `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { createInitialAdministrator } from ${JSON.stringify(storeUrl)};
      let flushes=0; const flush=fs.fsyncSync;
      fs.fsyncSync=fd=>{flush(fd); flushes++; if((${JSON.stringify(phase)}==="pending" && flushes===2)||(${JSON.stringify(phase)}==="replace" && flushes===3)) process.exit(23);};
      const rename=fs.renameSync;
      fs.renameSync=(a,b)=>{rename(a,b); if(${JSON.stringify(phase)}==="renamed") process.exit(23);};
      createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},"管理者");
    `,
      ],
      { timeout: 10_000, encoding: "utf8" },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const saved = fs.readFileSync(current);
    const random = crypto.randomUUID;
    let calls = 0;
    crypto.randomUUID = () => {
      calls++;
      return random();
    };
    let result: ReturnType<typeof createInitialAdministrator>;
    try {
      result = createInitialAdministrator(f.root, attempt, "別名");
    } finally {
      crypto.randomUUID = random;
    }
    assert.deepEqual(fs.readFileSync(current), saved);
    assert.equal(calls, 0);
    if (phase === "renamed") {
      assert.equal(result.status, "completed");
      if (result.status === "completed") {
        assert.equal(result.value.created, false);
        assert.equal(result.value.username, "管理者");
      }
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    } else {
      assert.equal(result.status, "unavailable");
      assert.deepEqual(saved, before);
      assert.ok(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
      );
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.replace.json")),
        phase === "replace",
      );
      assert.equal(result.cleanupConfirmed, false);
    }
  }
});

/**
 * 初回入力とcanonical相関の拒否を確認する。
 * @responsibility Schema妥当だけの改変状態からUserを生成しない。
 * @trace RFD-IT-024
 * @precondition 初回相関を持つ自己生成Root。
 * @stimulus 不正primitive、別試行、Role・操作ID改変、途中材料を与える。
 * @observation UUID生成0とcurrent byte不変を確認する。
 * @oracle 不正・途中状態は未完了で保持し、getterを実行しない。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary 入力・相関・Filesystem。
 */
test("初回管理者の不正入力と非canonical状態を生成前に拒否する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attempt = "00000000-0000-4000-8000-000000000099";
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const saved = fs.readFileSync(current);
  const random = crypto.randomUUID;
  let calls = 0;
  crypto.randomUUID = () => {
    calls++;
    return random();
  };
  t.after(() => {
    crypto.randomUUID = random;
  });
  let getterCalls = 0;
  const bad = {
    get toJSON() {
      getterCalls++;
      throw new Error("getter");
    },
  };
  for (const name of ["", " name", "x\n", bad]) {
    assert.equal(
      createInitialAdministrator(f.root, attempt, name as string).status,
      "unavailable",
    );
    assert.equal(calls, 0);
  }
  assert.equal(getterCalls, 0);
  assert.equal(
    createInitialAdministrator(
      f.root,
      "00000000-0000-4000-8000-000000000098",
      "管理者",
    ).status,
    "unavailable",
  );
  assert.equal(calls, 0);
  for (const mutation of ["operation", "role", "revision"]) {
    const state = JSON.parse(saved.toString());
    if (mutation === "operation")
      state.operationId = "00000000-0000-4000-8000-000000000098";
    if (mutation === "role") state.roleContentAccess[0].workspaceIds = [];
    if (mutation === "revision") state.revision = 2;
    fs.writeFileSync(current, bytes(state));
    const before = fs.readFileSync(current);
    const rejected = createInitialAdministrator(f.root, attempt, "管理者");
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.publication, "not_attempted");
    assert.equal(rejected.revision, state.revision);
    assert.equal(rejected.cleanupConfirmed, true);
    assert.equal(calls, 0);
    assert.deepEqual(fs.readFileSync(current), before);
  }
  fs.writeFileSync(current, saved);
  for (const name of [
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    fs.writeFileSync(path.join(f.directory, name), "{");
    const rejected = createInitialAdministrator(f.root, attempt, "管理者");
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.cleanupConfirmed, false);
    assert.equal(calls, 0);
    assert.deepEqual(fs.readFileSync(current), saved);
    assert.equal(fs.readFileSync(path.join(f.directory, name), "utf8"), "{");
    fs.rmSync(path.join(f.directory, name));
  }
});

/**
 * 初回Userの二Process競合と出版後Lock故障を確認する。
 * @responsibility 単一Userと出版・解放の独立した事実を観測する。
 * @trace RFD-IT-024
 * @precondition canonical初回相関を持つ自己生成Root。
 * @stimulus 別名の二Processを開始し、別Rootでは出版後のLock削除を失敗させる。
 * @observation 全Processのjoin、created件数、保存User、回復参照と再入場UUID件数。
 * @oracle 新規生成は一件、再入場は同User。解放不明でも出版確定を保持する。
 * @cleanup 差替えを復元し全Process終了とRoot不存在を確認する。
 * @boundary Node Process・Filesystem・既存Lock。
 */
test("初回User競合は一生成だけ採用し出版後Lock不明を保持する", async (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  const attempt = "00000000-0000-4000-8000-000000000099";
  fs.rmSync(current);
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL(
    "../../../src/initialization/execution.ts",
    import.meta.url,
  ).href;
  const joined = await Promise.allSettled(
    ["管理者A", "管理者B"].map(
      (name) =>
        new Promise<{
          output: string;
          code: number | null;
          signal: string | null;
          stderrBytes: number;
        }>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--eval",
              `import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)}; import {createInitialAdministrator} from ${JSON.stringify(storeUrl)}; console.log(JSON.stringify(createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},${JSON.stringify(name)})));`,
            ],
            { timeout: 10000 },
          );
          let output = "";
          let stderrBytes = 0;
          child.stdout.on("data", (data) => {
            output += String(data);
          });
          child.stderr.on("data", (data: Buffer) => {
            stderrBytes += data.byteLength;
          });
          child.on("error", reject);
          child.on("close", (code, signal) => {
            resolve({ output, code, signal, stderrBytes });
          });
        }),
    ),
  );
  const results = joined.map((result) => {
    assert.equal(result.status, "fulfilled");
    if (result.status !== "fulfilled") throw new Error("child_failed");
    assert.equal(
      result.value.code,
      0,
      JSON.stringify({
        code: result.value.code,
        signal: result.value.signal,
        stderrBytes: result.value.stderrBytes,
      }),
    );
    return JSON.parse(result.value.output);
  });
  assert.equal(
    results.filter(
      (result) => result.status === "completed" && result.value.created,
    ).length,
    1,
    JSON.stringify(
      results.map((result, index) => {
        const child = joined[index];
        return {
          status: result.status,
          reason: result.reason,
          publication: result.publication,
          cleanupConfirmed: result.cleanupConfirmed,
          revision: result.revision,
          created: result.value?.created,
          child:
            child?.status === "fulfilled"
              ? {
                  code: child.value.code,
                  signal: child.value.signal,
                  stderrBytes: child.value.stderrBytes,
                }
              : { status: "unjoined" },
        };
      }),
    ),
  );
  const saved = JSON.parse(fs.readFileSync(current, "utf8"));
  assert.equal(saved.users.length, 1);
  for (const result of results) {
    if (result.status === "completed") {
      assert.equal(result.value.userId, saved.users[0].userId);
      assert.equal(result.value.username, saved.users[0].username);
    } else {
      assert.equal(result.publication, "not_attempted");
      const reentered = createInitialAdministrator(f.root, attempt, "再要求名");
      assert.equal(reentered.status, "completed");
      if (reentered.status === "completed") {
        assert.equal(reentered.value.created, false);
        assert.equal(reentered.value.userId, saved.users[0].userId);
        assert.equal(reentered.value.username, saved.users[0].username);
      }
    }
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  const g = fixture(t);
  fs.rmSync(path.join(g.directory, "access-management.json"));
  assert.equal(
    initializeAccessManagementState(g.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const remove = fs.rmSync;
  let failed: ReturnType<typeof createInitialAdministrator>;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  try {
    failed = createInitialAdministrator(g.root, attempt, "管理者");
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "confirmed");
  assert.equal(failed.revision, 2);
  assert.equal(failed.cleanupConfirmed, false);
  if (failed.status === "unavailable") assert.ok(failed.lockRecoveryId);
  const random = crypto.randomUUID;
  let calls = 0;
  crypto.randomUUID = () => {
    calls++;
    return random();
  };
  let again: ReturnType<typeof createInitialAdministrator>;
  try {
    again = createInitialAdministrator(g.root, attempt, "別名");
  } finally {
    crypto.randomUUID = random;
  }
  assert.equal(calls, 0);
  assert.equal(again.status, "completed");
  if (again.status === "completed") assert.equal(again.value.created, false);
  assert.deepEqual(fs.readdirSync(g.directory), ["access-management.json"]);
});

/**
 * 初回相関の新規保存と同元試行の再読取りを確認する。
 * @responsibility 相関保存をUser・鍵の生成完了と区別する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootにcurrentが存在しない。
 * @stimulus 明示開始で一度保存し同元試行・別元試行を再要求する。
 * @observation callback件数、結果、current完全内容とbyteを確認する。
 * @oracle revision1・固定Role・空集合。同元試行は再作成0、別試行は拒否。
 * @cleanup 自己生成Rootを削除し不存在確認。
 * @boundary Node FilesystemとAM初回相関保存。
 */
test("初回相関を排他作成しexact再入場する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  let called = 0;
  /**
   * 初回相関保存に旧入力不存在の模擬観測を返す。
   * @responsibility 初回保存前の観測回数を計測する。
   * @trace RFD-IT-024
   * @precondition 自己生成Rootのcurrentを削除済み。
   * @stimulus 初回保存Ownerからの旧入力照会。
   * @observation 呼出し数と固定の未初期化・不存在値。
   * @oracle 初回保存とexact再入場の追加観測を区別する。
   * @cleanup N/A: 値とカウンタだけを扱う。
   * @boundary 試験代役。実Host不存在を証明しない。
   */
  const observe = () => {
    called++;
    return ["uninitialized", "absent"] as const;
  };
  const attempt = "00000000-0000-4000-8000-000000000020";
  const result = initializeAccessManagementState(
    f.root,
    attempt,
    true,
    observe,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.value.created, true);
  assert.equal(called, 1);
  const before = fs.readFileSync(current);
  const state = readAccessManagementState(f.root);
  assert.equal(state.status, "completed");
  if (state.status !== "completed") return;
  assert.deepEqual(state.value.initialization, {
    stage: "correlated",
    attemptId: attempt,
  });
  assert.deepEqual(state.value.roleContentAccess, f.state.roleContentAccess);
  for (const field of [
    "users",
    "credentials",
    "registeredRepositories",
    "exposure",
    "unresolvedKeyExchanges",
  ] as const)
    assert.deepEqual(state.value[field], []);
  const reentry = initializeAccessManagementState(
    f.root,
    attempt,
    true,
    observe,
  );
  assert.equal(reentry.status, "completed");
  if (reentry.status === "completed")
    assert.equal(reentry.value.created, false);
  assert.equal(called, 1);
  assert.equal(
    initializeAccessManagementState(f.root, f.state.operationId, true, observe)
      .status,
    "unavailable",
  );
  assert.ok(fs.readFileSync(current).equals(before));
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 初回開始の拒否母集団を直接保存境界へ接続する。
 * @responsibility 明示開始・旧観測・残存材料を新作成へ丸めない。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootと非秘密の旧観測分類。
 * @stimulus false・不正ID・既存／途中／不明／不正／throw・残存Pathを与える。
 * @observation current不存在、callback件数、既存byteを確認する。
 * @oracle 新作成0、残存不変、callbackはLock内一回以下。
 * @cleanup 自己生成Rootを削除し不存在確認。
 * @boundary Node Filesystemと初回開始条件。
 */
test("初回拒否で新作成せず不明材料を保持する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attempt = f.state.operationId;
  let called = 0;
  /**
   * 開始拒否より先に旧入力観測が呼ばれないことを計測する。
   * @responsibility 明示同意・Identityの入力拒否と観測段階を分ける。
   * @trace RFD-IT-024
   * @precondition 自己生成Rootのcurrentが存在しない。
   * @stimulus 保存Ownerからの旧入力照会。
   * @observation 呼出し数と固定の未初期化・不存在値。
   * @oracle 不正開始入力では呼出し0、新作成0。
   * @cleanup N/A: カウンタと固定値だけを扱う。
   * @boundary 試験代役。実Host状態の保証ではない。
   */
  const observe = () => {
    called++;
    return ["uninitialized", "absent"] as const;
  };
  assert.equal(
    initializeAccessManagementState(f.root, attempt, false, observe).status,
    "unavailable",
  );
  assert.equal(
    initializeAccessManagementState(f.root, "invalid", true, observe).status,
    "unavailable",
  );
  assert.equal(called, 0);
  let inputExecuted = 0;
  const invalidInput = {
    get toJSON() {
      inputExecuted++;
      return () => {
        inputExecuted++;
        return attempt;
      };
    },
  };
  assert.equal(
    initializeAccessManagementState(
      f.root,
      invalidInput as unknown as string,
      true,
      observe,
    ).status,
    "unavailable",
  );
  assert.equal(
    initializeAccessManagementState(
      f.root,
      attempt,
      true,
      undefined as unknown as typeof observe,
    ).status,
    "unavailable",
  );
  assert.equal(inputExecuted, 0);
  assert.equal(called, 0);
  assert.deepEqual(fs.readdirSync(f.directory), []);
  for (const observation of [
    ["existing", "absent"],
    ["same_attempt", "confirmed"],
    ["unknown", "unknown"],
    [],
  ]) {
    let count = 0;
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, () => {
        count++;
        return observation as [unknown, unknown];
      }).status,
      "unavailable",
    );
    assert.equal(count, 1);
    assert.equal(fs.existsSync(current), false);
  }
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => {
      throw new Error("injected");
    }).status,
    "unavailable",
  );
  for (const name of [
    "access-management.json",
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    const target = path.join(f.directory, name);
    fs.writeFileSync(target, "{");
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, observe).status,
      "unavailable",
    );
    assert.equal(fs.readFileSync(target, "utf8"), "{");
    assert.equal(called, 0);
    fs.rmSync(target);
  }
  assert.deepEqual(fs.readdirSync(f.directory), []);
});

/**
 * 初回書込み途中・close後の実Process喪失を確認する。
 * @responsibility partial保持停止と完全相関再観測を分離する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootと一回性Node子Process。
 * @stimulus current一部write後とclose後readback前にProcess終了する。
 * @observation 終了join、残存current、同元試行再入場、callback件数。
 * @oracle partialは不変で拒否、完全baselineは作成なしで読戻し成功。
 * @cleanup 子Process終了と自己生成Root削除を確認する。
 * @boundary 実Node Process・Filesystem・既存Lock。
 */
test("初回Process喪失のpartialと完全相関を再観測する", (t) => {
  for (const phase of ["partial", "closed"]) {
    const f = fixture(t);
    const current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL(
      "../../../src/initialization/execution.ts",
      import.meta.url,
    ).href;
    const script = `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { initializeAccessManagementState } from ${JSON.stringify(storeUrl)};
      let target;
      const open = fs.openSync, write = fs.writeSync, close = fs.closeSync;
      fs.openSync = (p,...args) => { const fd = open(p,...args); if (String(p).endsWith("access-management.json")) target=fd; return fd; };
      fs.writeSync = (fd,...args) => { if(fd===target && ${JSON.stringify(phase)}==="partial") { write(fd, Buffer.from("{")); process.exit(23); } return write(fd,...args); };
      fs.closeSync = fd => { close(fd); if(fd===target && ${JSON.stringify(phase)}==="closed") process.exit(23); };
      initializeAccessManagementState(createFilesystemStoreRoot(${JSON.stringify(f.directory)}), ${JSON.stringify(f.state.operationId)}, true, () => ["uninitialized","absent"]);
    `;
    const child = spawnSync(process.execPath, ["--eval", script], {
      timeout: 10000,
      encoding: "utf8",
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const before = fs.readFileSync(current);
    let count = 0;
    const result = initializeAccessManagementState(
      f.root,
      f.state.operationId,
      true,
      () => {
        count++;
        return ["uninitialized", "absent"];
      },
    );
    assert.equal(
      result.status,
      phase === "partial" ? "unavailable" : "completed",
    );
    if (result.status === "completed")
      assert.equal(result.value.created, false);
    assert.equal(count, 0);
    assert.ok(fs.readFileSync(current).equals(before));
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 二Process初回競合と解放不明を確認する。
 * @responsibility 採用一件と既知出版・清掃未確認を別に観測する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootにcurrentがない。
 * @stimulus 別元試行の二子Processを開始し、別fixtureでLock削除失敗を注入する。
 * @observation 子Processjoin、採用件数、改訂、回復参照。
 * @oracle 採用一件、Lock清掃失敗時unavailableかつconfirmed出版を保持。
 * @cleanup 差替え復元・子Process終了・自己生成Root削除。
 * @boundary Node Process競合と既存Lock。
 */
test("初回競合は一件だけ採用し解放不明を保持する", async (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.directory, "access-management.json"));
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL(
    "../../../src/initialization/execution.ts",
    import.meta.url,
  ).href;
  const results = await Promise.all(
    [f.state.operationId, "00000000-0000-4000-8000-000000000025"].map(
      (attempt) =>
        new Promise<string>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--eval",
              `import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)}; import {initializeAccessManagementState} from ${JSON.stringify(storeUrl)}; const r=initializeAccessManagementState(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},true,()=>["uninitialized","absent"]); console.log(r.status);`,
            ],
            { timeout: 10000 },
          );
          let output = "";
          child.stdout.on("data", (data) => {
            output += String(data);
          });
          child.on("error", reject);
          child.on("close", (code) => {
            if (code !== 0) reject(new Error("child_failed"));
            else resolve(output.trim());
          });
        }),
    ),
  );
  assert.equal(results.filter((status) => status === "completed").length, 1);
  assert.equal(readAccessManagementState(f.root).status, "completed");
  const g = fixture(t);
  fs.rmSync(path.join(g.directory, "access-management.json"));
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  const failed = initializeAccessManagementState(
    g.root,
    g.state.operationId,
    true,
    () => ["uninitialized", "absent"],
  );
  fs.rmSync = remove;
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "confirmed");
  assert.equal(failed.cleanupConfirmed, false);
  if (failed.status === "unavailable") assert.ok(failed.lockRecoveryId);
  assert.equal(readAccessManagementState(g.root).status, "completed");
});

/**
 * 初回履歴Identityを通常鍵要求へ再利用しない。
 * @responsibility 歴史的資格record不在でも安定した元試行を保護する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 初回completed・歴史的初資格record不在・別管理資格あり。
 * @stimulus 初回attemptをissue／revokeの受付IDへ渡す。
 * @observation 生成乱数・認証／生成KDF件数、固定拒否、state byteと材料。
 * @oracle 両拒否、乱数／KDF0、current不変・新材料0。
 * @cleanup crypto差替え復元とFixture回収。
 * @boundary 安定した初期化Identityと通常受付Identity。
 */
test("通常鍵変更は歴史的初回attemptの再利用を認証前に拒否する", (t) => {
  const f = managementFixture(t);
  const initial = f.state.initialization;
  assert.equal(initial.stage, "completed");
  if (initial.stage !== "completed") return;
  assert.equal(
    f.state.credentials.some(
      (item) => item.credentialId === initial.initialCredentialId,
    ),
    false,
  );
  const userId = f.state.users[0]?.userId;
  const credentialId = f.state.credentials[0]?.credentialId;
  assert.ok(userId && credentialId);
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const random = crypto.randomBytes;
  const scrypt = crypto.scryptSync;
  let generated = 0;
  let kdf = 0;
  crypto.randomBytes = (() => {
    generated++;
    throw new Error("unexpected_random");
  }) as typeof crypto.randomBytes;
  crypto.scryptSync = (() => {
    kdf++;
    throw new Error("unexpected_kdf");
  }) as typeof crypto.scryptSync;
  try {
    assert.deepEqual(
      issueCredential(
        f.root,
        f.tokens.administrator,
        1,
        initial.attemptId,
        userId,
      ),
      { status: "unavailable", reason: "credential_management_rejected" },
    );
    assert.deepEqual(
      revokeCredential(
        f.root,
        f.tokens.administrator,
        1,
        initial.attemptId,
        userId,
        credentialId,
      ),
      { status: "unavailable", reason: "credential_management_rejected" },
    );
    assert.equal(generated, 0);
    assert.equal(kdf, 0);
  } finally {
    crypto.randomBytes = random;
    crypto.scryptSync = scrypt;
  }
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});
