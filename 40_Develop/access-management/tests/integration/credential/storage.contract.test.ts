/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-024
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { FilesystemStoreRoot } from "../../../../domain-model/src/index.ts";
import {
  createCredentialMaterial,
  verifyCredentialToken,
} from "../../../src/credential/token.ts";
import {
  authenticateNormalConnection,
  issueCredential,
  readCredentialAdministrationState,
  readCredentialIssuance,
  updateCredentialPresentationState,
  revokeCredential,
} from "../../../src/index.ts";
import { createInitialCredential } from "../../../src/initialization/execution.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import {
  bytes,
  fixture,
  managementFixture,
  prepare,
  prepareInitialUser,
} from "../storage/fixture.ts";

/**
 * 提示の先行記録と観測後記録を別改訂へ保存する。
 * @responsibility 一度提示の非秘密Bindingと対象外不変を実保存で確認する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 自己生成Rootに未提示の初回資格を一回保存する。
 * @stimulus not_attempted→unconfirmed→confirmed、同状態再入場を要求する。
 * @observation 保存改訂、提示Operation ID、全結果field、対象外状態と材料不存在。
 * @oracle 各遷移は一出版。same-stateは拒否・byte不変、結果にSecret・Verifier・Snapshotなし。
 * @cleanup FixtureがRootを回収して不存在を確認する。
 * @boundary AM内部提示保存→実Filesystem。実TTY／HTTP出力は未接続。
 */
test("提示の先行記録と確認は別改訂・exact Bindingで一回だけ保存する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed")
    throw new Error("fixture issuance unavailable");
  const current = path.join(f.directory, "access-management.json");
  const before = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  const start = {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: issued.value.revision,
    target: "unconfirmed" as const,
  };
  const prepared = updateCredentialPresentationState(f.root, start);
  assert.equal(prepared.status, "completed");
  if (prepared.status !== "completed")
    throw new Error("presentation preparation unavailable");
  assert.equal(prepared.value.revision, start.expectedRevision + 1);
  assert.equal(
    prepared.value.presentationOperationId,
    prepared.value.operationId,
  );
  assert.deepEqual(Object.keys(prepared.value).sort(), [
    "credentialId",
    "issuanceOperationId",
    "operationId",
    "presentation",
    "presentationOperationId",
    "revision",
  ]);
  const first = fs.readFileSync(current);
  assert.equal(
    updateCredentialPresentationState(f.root, start).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), first);
  const finish = {
    credentialId: start.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: prepared.value.revision,
    presentationOperationId: prepared.value.presentationOperationId,
    target: "confirmed" as const,
  };
  const confirmed = updateCredentialPresentationState(f.root, finish);
  assert.equal(confirmed.status, "completed");
  if (confirmed.status !== "completed")
    throw new Error("presentation confirmation unavailable");
  assert.equal(confirmed.value.revision, prepared.value.revision + 1);
  assert.notEqual(confirmed.value.operationId, prepared.value.operationId);
  assert.equal(
    confirmed.value.presentationOperationId,
    prepared.value.presentationOperationId,
  );
  const saved = fs.readFileSync(current);
  assert.equal(
    updateCredentialPresentationState(f.root, finish).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), saved);
  const after = JSON.parse(saved.toString("utf8")) as AccessManagementState;
  after.revision = before.revision;
  after.operationId = before.operationId;
  const credential = after.credentials[0];
  assert.ok(credential);
  credential.presentation = "not_attempted";
  assert.deepEqual(after, before);
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.pending.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.replace.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.lock")),
    false,
  );
});

/**
 * 不正提示入力をRoot観測前に拒否する。
 * @responsibility accessor・Proxy・余分field・未知targetを実行しない。
 * @trace RFD-IT-017
 * @precondition 副作用を計測する入力getterとRoot Proxy。
 * @stimulus 閉入力の欠損・余分・型不正・未知target・accessor／Proxyを渡す。
 * @observation Root／getter呼出し0、固定拒否、publication not_attempted。
 * @oracle 全不正入力はLock・保存・出力許可を作らない。
 * @cleanup N/A: Rootを生成せず副作用0を測定する。
 * @boundary 提示入力→保存入口、入力不正時はFilesystem未到達。
 */
test("不正な提示入力はgetter・Proxy・Rootを観測せず拒否する", () => {
  let calls = 0;
  const root = new Proxy(
    {},
    {
      get: () => {
        calls++;
        throw new Error("root accessed");
      },
    },
  ) as FilesystemStoreRoot;
  const valid = {
    credentialId: "0123456789abcdef01234567",
    issuanceOperationId: "00000000-0000-4000-8000-000000000002",
    expectedRevision: 3,
    target: "unconfirmed",
  };
  const accessor = Object.defineProperty({ ...valid }, "target", {
    get: () => {
      calls++;
      return "unconfirmed";
    },
  });
  const proxy = new Proxy(valid, {
    ownKeys: () => {
      calls++;
      throw new Error("input accessed");
    },
  });
  for (const input of [
    null,
    proxy,
    accessor,
    { ...valid, extra: true },
    { ...valid, target: "not_attempted" },
    { ...valid, expectedRevision: Number.MAX_SAFE_INTEGER },
    { ...valid, target: "confirmed" },
    { ...valid, presentationOperationId: valid.issuanceOperationId },
  ]) {
    assert.deepEqual(updateCredentialPresentationState(root, input), {
      status: "unavailable",
      reason: "state_store_presentation_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    });
  }
  assert.equal(calls, 0);
});

/**
 * 遅延提示通知を現在の相関・失効と再照合する。
 * @responsibility ID・発行・提示Operation・改訂の不一致と失効後更新を拒否する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-024
 * @precondition 保存済みunconfirmedと非秘密Binding。
 * @stimulus Binding各軸を一つずつ変更し、失効後に元通知を渡す。
 * @observation 固定拒否とcurrent byte・Directory一覧の不変。
 * @oracle 全不一致・失効は出版0、confirmedへ戻さない。
 * @cleanup Fixtureが所有Rootを回収する。
 * @boundary 非秘密の遅延入力→同Lock fresh保存検査。
 */
test("遅延提示確認は各Binding不一致と失効を拒否する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.ok(issued.status === "completed");
  const prepared = updateCredentialPresentationState(f.root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: issued.value.revision,
    target: "unconfirmed",
  });
  assert.ok(prepared.status === "completed");
  const valid = {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: prepared.value.revision,
    presentationOperationId: prepared.value.presentationOperationId,
    target: "confirmed" as const,
  };
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const names = fs.readdirSync(f.directory).sort();
  for (const update of [
    { ...valid, credentialId: "abcdef0123456789abcdef01" },
    { ...valid, issuanceOperationId: "00000000-0000-4000-8000-000000000011" },
    { ...valid, expectedRevision: valid.expectedRevision - 1 },
    {
      ...valid,
      presentationOperationId: "00000000-0000-4000-8000-000000000012",
    },
  ]) {
    assert.equal(
      updateCredentialPresentationState(f.root, update).status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
  }
  const state = JSON.parse(before.toString("utf8")) as AccessManagementState;
  const credential = state.credentials[0];
  assert.ok(credential);
  credential.revoked = true;
  state.unresolvedKeyExchanges = [
    {
      stage: "revoked",
      entry: "host",
      scope: "targeted",
      recipientUserId: credential.userId,
      operationId: "00000000-0000-4000-8000-000000000013",
      recoveryId:
        "access-management.key-exchange.00000000-0000-4000-8000-000000000013",
      oldCredentialIds: [credential.credentialId],
    },
  ];
  fs.writeFileSync(current, bytes(state));
  const revoked = fs.readFileSync(current);
  assert.equal(
    updateCredentialPresentationState(f.root, valid).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), revoked);
});

/**
 * 提示三状態と二更新先の全組合せを実保存で判定する。
 * @responsibility same-stateや逆向き更新を単調保存から除く。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 同じ自己生成初回資格の独立したSnapshot変種。
 * @stimulus not_attempted／unconfirmed／confirmed×二targetを渡す。
 * @observation completedの有無、改訂、拒否時byte不変。
 * @oracle 先行未確認と観測後確認の二遷移だけ成功する。
 * @cleanup Fixtureが各Rootを回収する。
 * @boundary 提示状態判断→実Filesystem。
 */
test("提示三状態と二targetは二つの単調遷移だけ保存する", (t) => {
  for (const presentation of [
    "not_attempted",
    "unconfirmed",
    "confirmed",
  ] as const) {
    for (const target of ["unconfirmed", "confirmed"] as const) {
      const f = fixture(t);
      const attempt = prepareInitialUser(f);
      const issued = createInitialCredential(f.root, attempt);
      assert.ok(issued.status === "completed");
      const current = path.join(f.directory, "access-management.json");
      const state = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      const credential = state.credentials[0];
      assert.ok(credential);
      credential.presentation = presentation;
      fs.writeFileSync(current, bytes(state));
      const before = fs.readFileSync(current);
      const result = updateCredentialPresentationState(f.root, {
        credentialId: credential.credentialId,
        issuanceOperationId: attempt,
        expectedRevision: state.revision,
        target,
        ...(target === "confirmed"
          ? { presentationOperationId: state.operationId }
          : {}),
      });
      const allowed =
        (presentation === "not_attempted" && target === "unconfirmed") ||
        (presentation === "unconfirmed" && target === "confirmed");
      assert.equal(result.status === "completed", allowed);
      if (!allowed) assert.deepEqual(fs.readFileSync(current), before);
    }
  }
});

/**
 * 提示前出版の故障で一度出力の許可を返さない。
 * @responsibility 既知出版と清掃／解放不明を分離し、再入場を再表示にしない。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 未提示資格、自己生成Root、限定した保存故障注入。
 * @stimulus rename・読戻し・pending清掃・Lock解放の各故障と再入場。
 * @observation status、publication、value不存在、保存presentation、再入場結果。
 * @oracle 全故障はcompleted/提示Bindingなし。出版済みはunconfirmedを保持し、再開始も許可しない。
 * @cleanup 注入をfinallyで解除し、FixtureがRootを回収する。
 * @boundary 実Filesystem出版・読戻し・清掃・Lock終了。
 */
test("提示前保存の故障は出力Bindingを返さず再表示も許可しない", (t) => {
  for (const failure of ["rename", "readback", "pending", "lock"] as const) {
    const f = fixture(t);
    const attempt = prepareInitialUser(f);
    const issued = createInitialCredential(f.root, attempt);
    assert.ok(issued.status === "completed");
    const input = {
      credentialId: issued.value.credentialId,
      issuanceOperationId: attempt,
      expectedRevision: issued.value.revision,
      target: "unconfirmed",
    };
    const rename = fs.renameSync,
      open = fs.openSync,
      remove = fs.rmSync;
    let published = false;
    fs.renameSync = (from, to) => {
      if (failure === "rename") throw new Error("injected rename");
      rename(from, to);
      published = true;
    };
    fs.openSync = (target, flags, mode) => {
      if (
        failure === "readback" &&
        published &&
        String(target).endsWith("access-management.json")
      )
        throw new Error("injected readback");
      return open(target, flags, mode);
    };
    fs.rmSync = (target, options) => {
      if (
        failure === "pending" &&
        String(target).endsWith("access-management.pending.json")
      )
        throw new Error("injected pending cleanup");
      if (
        failure === "lock" &&
        String(target).endsWith("access-management.lock")
      )
        throw new Error("injected lock release");
      return remove(target, options);
    };
    try {
      const result = updateCredentialPresentationState(f.root, input);
      assert.equal(result.status, "unavailable");
      assert.equal("value" in result, false);
      if (failure === "pending" || failure === "lock")
        assert.equal(result.publication, "confirmed");
    } finally {
      fs.renameSync = rename;
      fs.openSync = open;
      fs.rmSync = remove;
    }
    const state = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(
      state.credentials[0]?.presentation,
      failure === "rename" ? "not_attempted" : "unconfirmed",
    );
    const currentPath = path.join(f.directory, "access-management.json");
    const pendingPath = path.join(
      f.directory,
      "access-management.pending.json",
    );
    const replacePath = path.join(
      f.directory,
      "access-management.replace.json",
    );
    const lockPath = path.join(f.directory, "access-management.lock");
    const before = fs.readFileSync(currentPath);
    const pendingBefore = fs.existsSync(pendingPath)
      ? fs.readFileSync(pendingPath)
      : null;
    const replaceBefore = fs.existsSync(replacePath)
      ? fs.readFileSync(replacePath)
      : null;
    const retry = updateCredentialPresentationState(f.root, input);
    assert.equal(retry.status, "unavailable");
    assert.equal("value" in retry, false);
    assert.deepEqual(fs.readFileSync(currentPath), before);
    if (failure === "readback" || failure === "pending") {
      assert.equal(retry.cleanupConfirmed, true);
      assert.equal(retry.reason, "state_store_previous_pending_settled");
      assert.equal(fs.existsSync(pendingPath), false);
      assert.equal(fs.existsSync(replacePath), false);
      assert.equal(fs.existsSync(lockPath), false);
      const repeated = updateCredentialPresentationState(f.root, input);
      assert.equal(repeated.status, "unavailable");
      assert.equal("value" in repeated, false);
      assert.equal(repeated.cleanupConfirmed, true);
      assert.deepEqual(fs.readFileSync(currentPath), before);
    } else {
      if (failure === "rename") {
        assert.equal(retry.cleanupConfirmed, false);
        assert.ok(pendingBefore);
        assert.ok(replaceBefore);
        assert.deepEqual(fs.readFileSync(pendingPath), pendingBefore);
        assert.deepEqual(fs.readFileSync(replacePath), replaceBefore);
      } else {
        assert.equal(retry.cleanupConfirmed, true);
        assert.equal(fs.existsSync(lockPath), false);
        assert.equal(fs.existsSync(pendingPath), false);
        assert.equal(fs.existsSync(replacePath), false);
      }
    }
  }
});

/**
 * 資格管理一覧は先行材料の処置要求とfresh観測を分ける。
 * @responsibility 非管理者の清掃Effectと処置前の古いSnapshot公開を防ぐ。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Storeと通常更新のbase／next材料。
 * @stimulus 拒否Role、許可Roleの処置、次要求の一覧を順に呼ぶ。
 * @observation 材料保持／回収、current改訂、Snapshot0と次fresh結果。
 * @oracle 非管理者は材料保持、処置要求はSnapshot0、次要求だけ現在改訂を返す。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 現在認可→既存pending処置→Lock解放。
 */
test("資格管理一覧は材料処置の要求でSnapshotを返さない", (t) => {
  for (const published of [false, true]) {
    const f = managementFixture(t);
    const next = structuredClone(f.state);
    next.revision++;
    next.operationId = "00000000-0000-4000-8000-000000000091";
    prepare(f, next);
    const current = path.join(f.directory, "access-management.json");
    if (published) fs.writeFileSync(current, bytes(next));
    const before = fs
      .readdirSync(f.directory)
      .map((name) => [name, fs.readFileSync(path.join(f.directory, name))]);
    const unavailable = {
      status: "unavailable",
      reason: "credential_administration_unavailable",
    };
    assert.deepEqual(
      readCredentialAdministrationState(f.root, f.tokens.manager),
      unavailable,
    );
    assert.deepEqual(
      fs
        .readdirSync(f.directory)
        .map((name) => [name, fs.readFileSync(path.join(f.directory, name))]),
      before,
    );
    assert.deepEqual(
      readCredentialAdministrationState(f.root, f.tokens.administrator),
      unavailable,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    const fresh = readCredentialAdministrationState(
      f.root,
      f.tokens.administrator,
    );
    assert.equal(fresh.status, "completed");
    if (fresh.status === "completed")
      assert.equal(fresh.snapshot.revision, published ? 2 : 1);
  }
});

/**
 * 通常発行と独立失効を実保存へ接続する。
 * @responsibility 一資格追加とexact一資格失効、元発行保持を別に観測する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成Rootと試験専用の管理者資格。
 * @stimulus 発行、同発行再要求、失効、同失効再要求と次要求認証。
 * @observation 保存改訂・対象／他資格・提示状態・短命Secret有無。
 * @oracle 旧資格保持、新規だけ発行。既失効再出版0・元要求completed推定0。
 * @cleanup Fixtureが自己生成Rootを回収し不存在確認。
 * @boundary Package公開APIと実Filesystem。Workbench出力ではない。
 */
test("通常鍵発行と独立失効はexact対象と再要求の限界を保持する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  const actor = createCredentialMaterial();
  const userId = f.state.users[0]?.userId;
  assert.ok(userId);
  f.state.credentials.push({
    credentialId: actor.credentialId,
    userId,
    tokenVersion: 1,
    tokenSalt: actor.tokenSalt,
    tokenVerifier: actor.tokenVerifier,
    revoked: false,
    operationId: "00000000-0000-4000-8000-000000000007",
    presentation: "confirmed",
  });
  fs.writeFileSync(current, bytes(f.state));
  const issued = issueCredential(
    f.root,
    actor.token,
    1,
    "00000000-0000-4000-8000-000000000008",
    userId,
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  assert.equal(typeof issued.token, "string");
  assert.equal(issued.operation, "issueCredential");
  if (issued.operation !== "issueCredential") return;
  const saved = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.equal(saved.revision, 2);
  assert.equal(saved.credentials.length, 2);
  assert.deepEqual(saved.credentials[0], f.state.credentials[0]);
  const added = saved.credentials[1];
  assert.ok(added);
  assert.equal(added.operationId, issued.operationId);
  assert.equal(added.presentation, "not_attempted");
  assert.equal(added.revoked, false);
  assert.equal(Object.hasOwn(added, "token"), false);
  assert.equal(verifyCredentialToken(issued.token, added), true);
  assert.deepEqual(
    issueCredential(f.root, actor.token, 2, issued.operationId, userId),
    {
      status: "unavailable",
      reason: "credential_management_rejected",
    },
  );
  const revoked = revokeCredential(
    f.root,
    actor.token,
    2,
    "00000000-0000-4000-8000-000000000009",
    userId,
    issued.credentialId,
  );
  assert.equal(revoked.status, "completed");
  assert.equal(Object.hasOwn(revoked, "token"), false);
  const after = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.equal(after.revision, 3);
  assert.deepEqual(after.credentials[0], f.state.credentials[0]);
  assert.deepEqual(after.credentials[1], { ...added, revoked: true });
  assert.equal(
    authenticateNormalConnection(f.root, issued.token).status,
    "unavailable",
  );
  const unchanged = fs.readFileSync(current);
  for (const operationId of [
    "00000000-0000-4000-8000-000000000009",
    "00000000-0000-4000-8000-000000000010",
  ])
    assert.deepEqual(
      revokeCredential(
        f.root,
        actor.token,
        3,
        operationId,
        userId,
        issued.credentialId,
      ),
      {
        status: "unavailable",
        reason: "credential_management_rejected",
      },
    );
  assert.deepEqual(fs.readFileSync(current), unchanged);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 発行の保存故障で短命鍵を返さない。
 * @responsibility 保存済み事実と未確認出版・清掃不明を分離する。
 * @trace RFD-IT-017
 * @precondition 実Hostと分離した管理前状態。
 * @stimulus current rename・読戻し・pending削除・Lock削除を故障させる。
 * @observation 結果Secret不存在・出版観測・実current・再要求生成件数。
 * @oracle 故障結果token0、nextが保存済みなら保持、同元発行再生成0。
 * @cleanup 差替えをfinally復元してFixtureがRootを回収する。
 * @boundary Node Filesystemの実保存と故障後の公開内部結果。
 */
test("通常鍵発行の保存・読戻し・清掃故障はSecretを返さない", (t) => {
  for (const mode of ["rename", "read_back", "cleanup", "lock"] as const) {
    const f = managementFixture(t);
    const current = path.join(f.directory, "access-management.json");
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const rename = fs.renameSync;
    const open = fs.openSync;
    const remove = fs.rmSync;
    let published = false;
    fs.renameSync = (source, destination) => {
      if (String(destination) === current && mode === "rename")
        throw new Error("injected_rename");
      rename(source, destination);
      if (String(destination) === current) published = true;
    };
    fs.openSync = (file, flags, permissions) => {
      if (mode === "read_back" && published && String(file) === current)
        throw Object.assign(new Error("injected_read_back"), {
          code: "EACCES",
        });
      return open(file, flags, permissions);
    };
    fs.rmSync = (target, options) => {
      if (
        (mode === "cleanup" &&
          String(target) ===
            path.join(f.directory, "access-management.pending.json")) ||
        (mode === "lock" &&
          String(target) === path.join(f.directory, "access-management.lock"))
      )
        throw new Error("injected_cleanup");
      return remove(target, options);
    };
    let result: ReturnType<typeof issueCredential>;
    try {
      result = issueCredential(
        f.root,
        f.tokens.administrator,
        1,
        operationId,
        userId,
      );
    } finally {
      fs.renameSync = rename;
      fs.openSync = open;
      fs.rmSync = remove;
    }
    assert.equal(result.status, "unavailable");
    assert.equal(Object.hasOwn(result, "token"), false);
    if (
      result.status === "unavailable" &&
      result.reason === "credential_management_unavailable"
    ) {
      assert.equal(
        result.publication,
        mode === "rename" || mode === "read_back" ? "unconfirmed" : "confirmed",
      );
      assert.equal(result.cleanupConfirmed, false);
    } else assert.fail("故障の保存観測が欠落した");
    const observed = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    assert.equal(observed.revision, mode === "rename" ? 1 : 2);
    assert.deepEqual(observed.credentials.slice(0, 3), f.state.credentials);
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    let generated = 0;
    crypto.randomBytes = (() => {
      generated++;
      throw new Error("unexpected_regeneration");
    }) as typeof crypto.randomBytes;
    try {
      const retried = issueCredential(
        f.root,
        f.tokens.administrator,
        observed.revision,
        operationId,
        userId,
      );
      assert.equal(retried.status, "unavailable");
      assert.equal(Object.hasOwn(retried, "token"), false);
      assert.equal(generated, 0);
    } finally {
      crypto.randomBytes = random;
    }
    assert.deepEqual(fs.readFileSync(current), before);
  }
});

/**
 * 管理者自身の最後の資格も指定どおり失効する。
 * @responsibility 未採用の最後の管理資格保持guardを追加しない。
 * @trace RFD-IT-018
 * @precondition 管理者の有効資格が一つだけの模擬状態。
 * @stimulus 自身の資格失効と同鍵の次要求認証、遅延提示通知。
 * @observation 失効出版、生成0、次認証拒否、提示更新0。
 * @oracle 指定失効を完了し、再有効化・新発行・追加改訂0。
 * @cleanup Fixture回収と差替え復元。
 * @boundary 独立失効と次要求・提示通知のfresh照合。
 */
test("通常鍵失効は最後の管理資格も失効し遅延提示で復活しない", (t) => {
  const f = managementFixture(t);
  const target = f.state.credentials[0];
  assert.ok(target);
  target.presentation = "unconfirmed";
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, bytes(f.state));
  const result = revokeCredential(
    f.root,
    f.tokens.administrator,
    1,
    "00000000-0000-4000-8000-000000000090",
    target.userId,
    target.credentialId,
  );
  assert.equal(result.status, "completed");
  assert.equal(Object.hasOwn(result, "token"), false);
  assert.equal(
    authenticateNormalConnection(f.root, f.tokens.administrator).status,
    "unavailable",
  );
  const before = fs.readFileSync(current);
  const delayed = updateCredentialPresentationState(f.root, {
    credentialId: target.credentialId,
    issuanceOperationId: target.operationId,
    expectedRevision: 2,
    target: "confirmed",
    presentationOperationId: "00000000-0000-4000-8000-000000000001",
  });
  assert.equal(delayed.status, "unavailable");
  assert.deepEqual(fs.readFileSync(current), before);
});

/**
 * 発行の容量予約と生成故障を実保存前に反証する。
 * @responsibility 予約前生成0と生成失敗後の保存0を分ける。
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと管理資格。容量例は有効な最大近傍Snapshot。
 * @stimulus 容量超過、乱数例外、生成KDF例外、資格ID衝突。
 * @observation randomBytes回数、固定失敗、current byteと材料不存在。
 * @oracle 容量時生成0、その他は再試行0・Secret返却0・current不変。
 * @cleanup crypto差替えをfinally復元しFixture回収。
 * @boundary Node crypto生成と既存保存容量Gate。
 */
test("通常鍵発行は容量前生成0と生成故障後保存0を保持する", (t) => {
  for (const mode of ["capacity", "random", "kdf", "collision"] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    if (mode === "capacity") {
      const repository = {
        repositoryId: "capacity-fixture",
        repositoryRoot: `${path.parse(f.directory).root.replaceAll("\\", "/")}x`,
        bindingId: `binding-${"0".repeat(32)}`,
      };
      f.state.registeredRepositories.push(repository);
      repository.repositoryRoot += "x".repeat(
        16_777_216 - 64 - bytes(f.state).byteLength,
      );
      const normalized = path
        .resolve(repository.repositoryRoot)
        .replace(/[\\/]+$/u, "");
      repository.bindingId = `binding-${createHash("sha256")
        .update(
          `${repository.repositoryId}\n${process.platform === "win32" ? normalized.toLowerCase() : normalized}`,
          "utf8",
        )
        .digest("hex")
        .slice(0, 32)}`;
      assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
    }
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    const scrypt = crypto.scryptSync;
    let generated = 0;
    let kdfCalls = 0;
    crypto.randomBytes = ((size: number) => {
      generated++;
      if (mode === "random" || mode === "capacity")
        throw new Error("injected_random");
      if (mode === "collision" && size === 12)
        return Buffer.from(f.state.credentials[0]?.credentialId ?? "", "hex");
      return random(size);
    }) as typeof crypto.randomBytes;
    crypto.scryptSync = ((password, salt, length, options) => {
      kdfCalls++;
      if (mode === "kdf" && kdfCalls > 1)
        throw new Error("injected_generation_kdf");
      return scrypt(password, salt, length, options);
    }) as typeof crypto.scryptSync;
    try {
      const result = issueCredential(
        f.root,
        f.tokens.administrator,
        1,
        "00000000-0000-4000-8000-000000000090",
        userId,
      );
      assert.equal(result.status, "unavailable");
      assert.equal(Object.hasOwn(result, "token"), false);
      if (mode === "capacity") assert.equal(generated, 0);
      else assert.ok(generated > 0 && generated <= 3);
    } finally {
      crypto.randomBytes = random;
      crypto.scryptSync = scrypt;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 元発行IDから提示三状態と現在失効だけを観測する。
 * @responsibility 非秘密の現在事実をSecret再取得や成功Receiptにしない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成管理Rootと通常発行済み資格。
 * @stimulus 発行、提示前記録、提示確認、失効を順に保存し同元発行IDを読む。
 * @observation 六fieldの閉じた投影、凍結、Role拒否・別User・未知ID。
 * @oracle 現在提示／失効だけを返し、Secret・salt・Verifier・元失効Receiptなし。
 * @cleanup FixtureがRootを回収して不存在を確認する。
 * @boundary 専用Readerと実保存。Workbench／MCP本番接続ではない。
 */
test("資格発行事実Readerは提示三状態と失効を非秘密で観測する", (t) => {
  const f = managementFixture(t);
  const userId = f.state.users[1]?.userId;
  assert.ok(userId);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const issued = issueCredential(
    f.root,
    f.tokens.administrator,
    1,
    operationId,
    userId,
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const first = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(first.status, "observed");
  if (first.status !== "observed") return;
  assert.deepEqual(first.snapshot, {
    revision: 2,
    credentialId: issued.credentialId,
    userId,
    issuanceOperationId: operationId,
    presentation: "not_attempted",
    revoked: false,
  });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.snapshot), true);
  const pending = updateCredentialPresentationState(f.root, {
    credentialId: issued.credentialId,
    issuanceOperationId: operationId,
    expectedRevision: 2,
    target: "unconfirmed",
  });
  assert.equal(pending.status, "completed");
  if (pending.status !== "completed") return;
  const unconfirmed = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(
    unconfirmed.status === "observed" && unconfirmed.snapshot.presentation,
    "unconfirmed",
  );
  assert.equal(
    updateCredentialPresentationState(f.root, {
      credentialId: issued.credentialId,
      issuanceOperationId: operationId,
      expectedRevision: 3,
      target: "confirmed",
      presentationOperationId: pending.value.presentationOperationId,
    }).status,
    "completed",
  );
  const confirmed = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(
    confirmed.status === "observed" && confirmed.snapshot.presentation,
    "confirmed",
  );
  assert.equal(
    revokeCredential(
      f.root,
      f.tokens.administrator,
      4,
      "00000000-0000-4000-8000-000000000091",
      userId,
      issued.credentialId,
    ).status,
    "completed",
  );
  const revoked = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(revoked.status, "observed");
  if (revoked.status === "observed")
    assert.deepEqual(revoked.snapshot, {
      ...first.snapshot,
      revision: 5,
      presentation: "confirmed",
      revoked: true,
    });
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  for (const token of [f.tokens.manager, f.tokens.developer, "invalid"])
    assert.deepEqual(
      readCredentialIssuance(f.root, token, operationId, userId),
      { status: "unavailable", reason: "credential_issuance_unavailable" },
    );
  assert.equal(
    readCredentialIssuance(
      f.root,
      f.tokens.administrator,
      operationId,
      f.state.users[0]?.userId ?? "",
    ).status,
    "unavailable",
  );
  assert.equal(
    readCredentialIssuance(
      f.root,
      f.tokens.administrator,
      "00000000-0000-4000-8000-000000000999",
      userId,
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * Readerは材料処置・破損・Lock解放不明で事実を返さない。
 * @responsibility 先行候補の処置とfreshな次要求の観測を分ける。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成の完全管理状態と実pending／Lock。
 * @stimulus base／出版済み一致pending、破損pending、Lock削除故障を与える。
 * @observation fact有無、current byte、材料保持／清掃と次要求。
 * @oracle 材料処置要求はfact0、次要求だけfresh事実。破損／解放不明はfact0。
 * @cleanup Hook復元とFixture回収。
 * @boundary 同Lockの現在認可・材料処置・解放後結果。
 */
test("資格発行事実Readerは材料処置と解放不明で事実を返さない", (t) => {
  for (const mode of ["pending", "published", "corrupt", "lock"] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const current = path.join(f.directory, "access-management.json");
    if (mode === "pending" || mode === "published") {
      const next = structuredClone(f.state);
      next.revision = 2;
      next.operationId = "00000000-0000-4000-8000-000000000090";
      const actor = next.users[0];
      assert.ok(actor);
      if (mode === "pending") actor.role = "manager";
      prepare(f, next);
      if (mode === "published") fs.writeFileSync(current, bytes(next));
    } else if (mode === "corrupt")
      fs.writeFileSync(
        path.join(f.directory, "access-management.pending.json"),
        "{",
      );
    const before = fs.readFileSync(current);
    const remove = fs.rmSync;
    if (mode === "lock")
      fs.rmSync = (targetPath, options) => {
        if (
          String(targetPath) ===
          path.join(f.directory, "access-management.lock")
        )
          throw new Error("injected_lock_cleanup");
        return remove(targetPath, options);
      };
    try {
      assert.deepEqual(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ),
        { status: "unavailable", reason: "credential_issuance_unavailable" },
      );
    } finally {
      fs.rmSync = remove;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "published")
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    if (mode !== "corrupt") {
      assert.equal(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ).status,
        "observed",
      );
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    } else
      assert.equal(
        fs.readFileSync(
          path.join(f.directory, "access-management.pending.json"),
          "utf8",
        ),
        "{",
      );
  }
});

/**
 * Readerの形式不正・初回途中・現在失効・record不在を反証する。
 * @responsibility 未取得を未発行や古い本人Authorityへ変換しない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成管理状態と初回途中の模擬状態。
 * @stimulus 不正相関、認証資格失効、既存record整理、初回未完了を渡す。
 * @observation 固定未取得、形式不正時のopen0、current byteと材料。
 * @oracle 事実field0、状態不変、Secret復元0。
 * @cleanup open差替え復元とFixture回収。
 * @boundary 専用読取りの入力・現在認証・現在record。
 */
test("資格発行事実Readerは不正・未完了・失効・整理済みを未取得に閉じる", (t) => {
  const f = managementFixture(t);
  const target = f.state.credentials[1];
  assert.ok(target);
  const unavailable = {
    status: "unavailable",
    reason: "credential_issuance_unavailable",
  };
  const open = fs.openSync;
  let opened = 0;
  fs.openSync = ((...args) => {
    opened++;
    return open(...args);
  }) as typeof fs.openSync;
  try {
    assert.deepEqual(
      readCredentialIssuance(
        f.root,
        f.tokens.administrator,
        "invalid",
        target.userId,
      ),
      unavailable,
    );
    assert.deepEqual(
      readCredentialIssuance(
        f.root,
        f.tokens.administrator,
        target.operationId,
        "invalid",
      ),
      unavailable,
    );
    assert.equal(opened, 0);
  } finally {
    fs.openSync = open;
  }
  const current = path.join(f.directory, "access-management.json");
  for (const mode of ["actor_revoked", "record_removed"] as const) {
    const state = structuredClone(f.state);
    if (mode === "actor_revoked") {
      const actor = state.credentials[0];
      assert.ok(actor);
      actor.revoked = true;
    } else
      state.credentials = state.credentials.filter(
        (item) => item.credentialId !== target.credentialId,
      );
    fs.writeFileSync(current, bytes(state));
    const before = fs.readFileSync(current);
    assert.deepEqual(
      readCredentialIssuance(
        f.root,
        f.tokens.administrator,
        target.operationId,
        target.userId,
      ),
      unavailable,
    );
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
  const initial = fixture(t);
  const attempt = prepareInitialUser(initial);
  const credential = createInitialCredential(initial.root, attempt);
  assert.equal(credential.status, "completed");
  if (credential.status !== "completed" || !credential.value.token) return;
  const initialCurrent = path.join(initial.directory, "access-management.json");
  const state = JSON.parse(
    fs.readFileSync(initialCurrent, "utf8"),
  ) as AccessManagementState;
  const userId = state.users[0]?.userId;
  assert.ok(userId);
  const before = fs.readFileSync(initialCurrent);
  assert.deepEqual(
    readCredentialIssuance(
      initial.root,
      credential.value.token,
      attempt,
      userId,
    ),
    unavailable,
  );
  assert.deepEqual(fs.readFileSync(initialCurrent), before);
});

/**
 * 先行出版と読取り・清掃故障で古い資格事実を返さない。
 * @responsibility 現在Roleと材料の処置結果を旧投影に混ぜない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成Rootと保存済み元発行相関。
 * @stimulus Actor降格済みnext、base／出版済みpending削除故障、current open故障、孤立replace。
 * @observation fixed未取得、current保持、材料保持、故障解除後のfresh観測。
 * @oracle 旧Authorityや未確認清掃によるfact0。自動出版0。
 * @cleanup Hook復元とFixture回収。
 * @boundary current読取り・認可・先行材料・結果搬送の相関。
 */
test("資格発行事実Readerは先行出版と読取り・清掃故障で古い事実を返さない", (t) => {
  for (const mode of [
    "published_role",
    "published_cleanup",
    "cleanup",
    "read",
    "replace",
  ] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const current = path.join(f.directory, "access-management.json");
    const next = structuredClone(f.state);
    next.revision = 2;
    next.operationId = "00000000-0000-4000-8000-000000000090";
    const actor = next.users[0];
    assert.ok(actor);
    if (mode !== "published_cleanup") actor.role = "manager";
    if (
      mode === "published_role" ||
      mode === "published_cleanup" ||
      mode === "cleanup"
    ) {
      prepare(f, next);
      if (mode === "published_role" || mode === "published_cleanup")
        fs.writeFileSync(current, bytes(next));
    } else if (mode === "replace")
      fs.writeFileSync(
        path.join(f.directory, "access-management.replace.json"),
        "{",
      );
    const before = fs.readFileSync(current);
    const open = fs.openSync;
    const remove = fs.rmSync;
    if (mode === "read")
      fs.openSync = (file, flags, permissions) => {
        if (String(file) === current)
          throw Object.assign(new Error("injected_read"), { code: "EACCES" });
        return open(file, flags, permissions);
      };
    if (mode === "cleanup" || mode === "published_cleanup")
      fs.rmSync = (file, options) => {
        if (
          String(file) ===
          path.join(f.directory, "access-management.pending.json")
        )
          throw new Error("injected_cleanup");
        return remove(file, options);
      };
    try {
      assert.deepEqual(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ),
        { status: "unavailable", reason: "credential_issuance_unavailable" },
      );
    } finally {
      fs.openSync = open;
      fs.rmSync = remove;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "published_role") {
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
        true,
      );
      assert.equal(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ).status,
        "unavailable",
      );
    } else if (
      mode === "read" ||
      mode === "cleanup" ||
      mode === "published_cleanup"
    ) {
      if (mode === "published_cleanup")
        assert.deepEqual(fs.readdirSync(f.directory).sort(), [
          "access-management.json",
          "access-management.pending.json",
        ]);
      if (mode === "cleanup" || mode === "published_cleanup") {
        assert.equal(
          readCredentialIssuance(
            f.root,
            f.tokens.administrator,
            target.operationId,
            target.userId,
          ).status,
          "unavailable",
        );
        assert.deepEqual(fs.readFileSync(current), before);
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      }
      assert.equal(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ).status,
        "observed",
      );
    } else
      assert.equal(
        fs.readFileSync(
          path.join(f.directory, "access-management.replace.json"),
          "utf8",
        ),
        "{",
      );
  }
});
