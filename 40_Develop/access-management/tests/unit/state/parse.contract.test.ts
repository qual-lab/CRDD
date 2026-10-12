/**
 * 状態Schemaの容量・閉集合・段階と参照を検証する。
 * @packageDocumentation
 * @responsibility 純粋parseの成立を保存・認可・鍵処理の成立と分ける。
 * @trace RFD-UT-028
 * @level UT
 * @scope access-management/state、正常・境界・異常・歴史的参照
 * @boundary N/A: 外部I/Oなし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type AccessManagementState,
  parseAccessManagementState,
} from "../../../src/index.ts";

/**
 * 相関だけを記録した完全baselineを構築する。
 * @responsibility 必須包絡・3Role・空集合を独立したfixtureとして用意する。
 * @trace RFD-UT-028
 * @precondition N/A: 実Host・秘密を使用しない。
 * @stimulus 固定した非秘密IDと初期値を構築する。
 * @observation 毎回新しいSnapshotを返す。
 * @oracle revision 1と3Role初期範囲・空集合が存在する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary N/A: 実管理状態を生成しない。
 */
function createBaseline(): AccessManagementState {
  return {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    credentials: [],
    registeredRepositories: [],
    exposure: [],
    initialization: {
      stage: "correlated",
      attemptId: "00000000-0000-4000-8000-000000000002",
    },
    unresolvedKeyExchanges: [],
  };
}

/**
 * 元初資格と確認対象が同じ初回途中状態を構築する。
 * @responsibility Host交換の前後を比較する独立したSchema fixtureを用意する。
 * @trace RFD-UT-028
 * @precondition 実資格・Host状態を使用しない。
 * @stimulus 一administratorと固定模擬照合値を同じ初回試行へ結合する。
 * @observation 元初資格と確認対象IDを持つ所有Snapshot。
 * @oracle presentation未確認でも完全な途中形状としてparsedになる。
 * @cleanup N/A: メモリ内のfixtureのみ。
 * @boundary N/A: 保存・認証・初回確認の成立を主張しない。
 */
function createInitialCredentialFixture(): AccessManagementState {
  const state = createBaseline();
  const userId = "00000000-0000-4000-8000-000000000003";
  const credentialId = "0123456789abcdef01234567";
  state.users = [{ userId, username: "管理者", role: "administrator" }];
  state.credentials = [
    {
      credentialId,
      userId,
      tokenVersion: 1,
      tokenSalt: "a".repeat(32),
      tokenVerifier: "b".repeat(64),
      revoked: false,
      operationId: state.initialization.attemptId,
      presentation: "unconfirmed",
    },
  ];
  state.initialization = {
    stage: "credential_stored",
    attemptId: state.initialization.attemptId,
    userId,
    initialCredentialId: credentialId,
    confirmationCredentialId: credentialId,
  };
  return state;
}

/**
 * v2だけを受理し、旧版と旧受領fieldを拒否する。
 * @responsibility 互換補完や旧confirmedの自動転用がないことを確認する。
 * @trace RFD-UT-028
 * @precondition 完全なv2初回資格fixture。
 * @stimulus v1版、旧delivery、旧receipt・normalConnection、欠損・未知fieldを与える。
 * @observation parsed／固定invalid理由と返却Snapshot不存在。
 * @oracle 完全v2だけparsed、旧形状や補完を要する入力はすべてinvalid。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 実状態移行は行わない。
 */
test("v2の閉集合は旧版・旧受領fieldを補完しない", () => {
  const state = createInitialCredentialFixture();
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  for (const mutate of [
    (value: Record<string, unknown>) => {
      value.schemaRevision = 1;
    },
    (value: Record<string, unknown>) => {
      const credentials = value.credentials as Record<string, unknown>[];
      const credential = credentials[0];
      assert.ok(credential);
      credential.delivery = credential.presentation;
      delete credential.presentation;
    },
    (value: Record<string, unknown>) => {
      (value.initialization as Record<string, unknown>).receipt = "confirmed";
    },
    (value: Record<string, unknown>) => {
      (value.initialization as Record<string, unknown>).normalConnection =
        "confirmed";
    },
    (value: Record<string, unknown>) => {
      delete (value.initialization as Record<string, unknown>)
        .confirmationCredentialId;
    },
    (value: Record<string, unknown>) => {
      (
        value.initialization as Record<string, unknown>
      ).confirmationCredentialId = "abcdef0123456789abcdef01";
    },
  ]) {
    const changed = structuredClone(state) as unknown as Record<
      string,
      unknown
    >;
    mutate(changed);
    assert.deepEqual(
      parseAccessManagementState(Buffer.from(JSON.stringify(changed))),
      {
        status: "invalid",
        reason: "state_schema_invalid",
      },
    );
  }
});

/**
 * 初回中のHost交換と同改訂の確認対象結替えを検証する。
 * @responsibility 旧失効資格の途中参照と新資格への結合を分ける。
 * @trace RFD-UT-028
 * @precondition 初回資格保存状態、別元操作のHost指定交換。
 * @stimulus prepared・revoked・新資格保存を構築し、境界を破る変種を与える。
 * @observation 各完全Snapshotのparsed／invalidと保持された元初資格。
 * @oracle Hostの単一交換だけ受理。失効中はactive0、新保存は確認IDとnewID同値。Workbench・複数交換・古い確認ID・新資格欠測を拒否。
 * @cleanup N/A: メモリのみ。
 * @boundary N/A: parse成功を認証・確認・通常Authorityとしない。
 */
test("初回Host交換の段階と確認対象を同Snapshotで結合する", () => {
  const state = createInitialCredentialFixture();
  const initial = state.initialization;
  const old = state.credentials[0];
  assert.ok(initial.stage === "credential_stored" && old);
  const operationId = "00000000-0000-4000-8000-000000000004";
  const exchange = {
    stage: "prepared" as const,
    recoveryId: `access-management.key-exchange.${operationId}`,
    operationId,
    entry: "host" as const,
    scope: "targeted" as const,
    recipientUserId: initial.userId,
    oldCredentialIds: [old.credentialId],
  };
  state.unresolvedKeyExchanges = [exchange];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const workbench = structuredClone(state);
  workbench.unresolvedKeyExchanges = [{ ...exchange, entry: "workbench" }];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(workbench))).status,
    "invalid",
  );
  const multiple = structuredClone(state);
  multiple.unresolvedKeyExchanges.push({
    ...exchange,
    operationId: "00000000-0000-4000-8000-000000000005",
    recoveryId:
      "access-management.key-exchange.00000000-0000-4000-8000-000000000005",
  });
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(multiple))).status,
    "invalid",
  );
  state.unresolvedKeyExchanges = [{ ...exchange, stage: "revoked" }];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "invalid",
  );
  old.revoked = true;
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const newId = "abcdef0123456789abcdef01";
  state.credentials.push({
    ...old,
    credentialId: newId,
    operationId,
    revoked: false,
    presentation: "not_attempted",
  });
  state.unresolvedKeyExchanges = [
    { ...exchange, stage: "credential_stored", newCredentialId: newId },
  ];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "invalid",
  );
  initial.confirmationCredentialId = newId;
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  assert.equal(initial.initialCredentialId, old.credentialId);
  const absent = structuredClone(state);
  absent.credentials.pop();
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(absent))).status,
    "invalid",
  );
  const wrongOrigin = structuredClone(state);
  const original = wrongOrigin.credentials[0];
  assert.ok(original);
  original.operationId = "00000000-0000-4000-8000-000000000006";
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(wrongOrigin))).status,
    "invalid",
  );
});

/**
 * 初回完了の歴史的資格と後続交換を分離する。
 * @responsibility 新資格の成功で元初資格の提示不明を書き換えない。
 * @trace RFD-UT-028
 * @precondition 元初資格は失効・提示未確認、新確認資格は提示confirmed。
 * @stimulus completed、確認提示の矛盾、両歴史資格の整理、後続Host交換を入力する。
 * @observation 状態受理と歴史的IDの保持。
 * @oracle completedは新確認資格confirmedだけを要求し、元初資格の未確認を保持。後続交換は許可し、過去の確認IDを結替えない。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 完了出版・後続交換Effectの実測ではない。
 */
test("completedの歴史参照は元資格未確認と後続交換を保持する", () => {
  const state = createInitialCredentialFixture();
  const initial = state.initialization;
  const old = state.credentials[0];
  assert.ok(initial.stage === "credential_stored" && old);
  old.revoked = true;
  const newId = "abcdef0123456789abcdef01";
  const newCredential = {
    ...old,
    credentialId: newId,
    operationId: "00000000-0000-4000-8000-000000000004",
    revoked: false,
    presentation: "confirmed" as const,
  };
  state.credentials.push(newCredential);
  state.initialization = {
    stage: "completed",
    attemptId: initial.attemptId,
    initialUserId: initial.userId,
    initialCredentialId: initial.initialCredentialId,
    confirmationCredentialId: newId,
    connection: "confirmed",
  };
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const wrong = structuredClone(state);
  const confirmation = wrong.credentials[1];
  assert.ok(confirmation);
  confirmation.presentation = "unconfirmed";
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(wrong))).status,
    "invalid",
  );
  const operationId = "00000000-0000-4000-8000-000000000005";
  state.unresolvedKeyExchanges = [
    {
      stage: "prepared",
      recoveryId: `access-management.key-exchange.${operationId}`,
      operationId,
      entry: "host",
      scope: "targeted",
      recipientUserId: initial.userId,
      oldCredentialIds: [newId],
    },
  ];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  state.unresolvedKeyExchanges = [];
  state.credentials = [];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
});

/**
 * 初回4変種と完了後の履歴参照を検証する。
 * @responsibility 途中の現在参照と完了後のRole変更・資格整理を区別する。
 * @trace RFD-UT-028
 * @precondition 完全baselineと模擬資格照合値を用意する。
 * @stimulus correlated→user_stored→credential_stored→completedの各JSONを公開parserへ渡す。
 * @observation statusと返却Snapshotを確認する。
 * @oracle 各完全変種はparsed、初回途中の別Roleと保持資格の配送矛盾はinvalid、完了後のRole変更・資格整理はparsed。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 保存・発行・受領の実測ではない。
 */
test("初回4変種と現在・歴史参照", () => {
  const state = createBaseline();
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const userId = "00000000-0000-4000-8000-000000000003";
  const attemptId = state.initialization.attemptId;
  state.users.push({ userId, username: "管理用表示名", role: "administrator" });
  state.initialization = { stage: "user_stored", attemptId, userId };
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const credentialId = "0123456789abcdef01234567";
  state.credentials.push({
    credentialId,
    userId,
    tokenVersion: 1,
    tokenSalt: "a".repeat(32),
    tokenVerifier: "b".repeat(64),
    revoked: false,
    operationId: attemptId,
    presentation: "confirmed",
  });
  state.initialization = {
    stage: "credential_stored",
    attemptId,
    userId,
    initialCredentialId: credentialId,
    confirmationCredentialId: credentialId,
  };
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const initialUser = state.users[0];
  assert.ok(initialUser);
  initialUser.role = "manager";
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "invalid",
  );
  state.initialization = {
    stage: "completed",
    attemptId,
    initialUserId: userId,
    initialCredentialId: credentialId,
    confirmationCredentialId: credentialId,
    connection: "confirmed",
  };
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  for (const presentation of ["unconfirmed", "not_attempted"] as const) {
    const credential = state.credentials[0];
    assert.ok(credential);
    credential.presentation = presentation;
    assert.equal(
      parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
      "invalid",
    );
  }
  state.credentials = [];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
});

/**
 * 不正field・欠損・参照・段階相関を拒否する。
 * @responsibility Schema不適合を補完や空成功へ変換しない。
 * @trace RFD-UT-028
 * @precondition 正常baselineから独立した負例を構築する。
 * @stimulus 余分Secret、欠損、未知Role、重複Role、孤立Exposure、unsafe revision、初回矛盾を入力する。
 * @observation 固定invalid理由とSnapshot不存在を確認する。
 * @oracle 全負例はstate_schema_invalid、入力本文は返らない。
 * @cleanup N/A: メモリだけ。
 * @boundary N/A: I/O・修復なし。
 */
test("閉集合と参照・相関の負例", () => {
  const mutations = [
    (state: Record<string, unknown>) => {
      state.secret = "forbidden";
    },
    (state: Record<string, unknown>) => {
      delete state.credentials;
    },
    (state: Record<string, unknown>) => {
      state.roleContentAccess = [
        { role: "administrator", workspaceIds: ["issueCredential"] },
      ];
    },
    (state: Record<string, unknown>) => {
      state.roleContentAccess = [
        { role: "developer", workspaceIds: [] },
        { role: "developer", workspaceIds: [] },
        { role: "administrator", workspaceIds: [] },
      ];
    },
    (state: Record<string, unknown>) => {
      state.exposure = [{ repositoryId: "absent", workspaceIds: [] }];
    },
    (state: Record<string, unknown>) => {
      state.revision = Number.MAX_SAFE_INTEGER + 1;
    },
    (state: Record<string, unknown>) => {
      state.initialization = {
        stage: "completed",
        attemptId: "00000000-0000-4000-8000-000000000002",
        initialUserId: "00000000-0000-4000-8000-000000000003",
        initialCredentialId: "0123456789abcdef01234567",
        presentation: "confirmed",
        receipt: "unconfirmed",
        normalConnection: "confirmed",
      };
    },
  ];
  for (const mutate of mutations) {
    const state = createBaseline() as unknown as Record<string, unknown>;
    mutate(state);
    assert.deepEqual(
      parseAccessManagementState(Buffer.from(JSON.stringify(state))),
      { status: "invalid", reason: "state_schema_invalid" },
    );
  }
});

/**
 * raw byteの上限とUTF-8異常を検証する。
 * @responsibility 再serializeで空白を落として容量検査を迂回しない。
 * @trace RFD-UT-028
 * @precondition 16 MiB境界にJSONの末尾空白を足す。
 * @stimulus 上限ちょうど・上限+1、壊れたUTF-8、非byte、ProxyとbyteLength accessorを与える。
 * @observation statusと固定reasonを確認する。
 * @oracle 境界はparsed、超過はtoo_large、壊れた符号化はencoding_invalid、非byteはinput_invalid。Proxy／accessorを実行しない。
 * @cleanup N/A: 所有メモリだけ。
 * @boundary N/A: bounded File Readerとは別の純粋検査。
 */
test("容量の正確なbyte境界とUTF-8", () => {
  const json = Buffer.from(JSON.stringify(createBaseline()));
  const boundary = Buffer.alloc(16_777_216, 32);
  json.copy(boundary);
  assert.equal(parseAccessManagementState(boundary).status, "parsed");
  assert.deepEqual(
    parseAccessManagementState(Buffer.concat([boundary, Buffer.from(" ")])),
    { status: "invalid", reason: "state_too_large" },
  );
  assert.deepEqual(parseAccessManagementState(new Uint8Array([0xc3, 0x28])), {
    status: "invalid",
    reason: "state_encoding_invalid",
  });
  assert.deepEqual(parseAccessManagementState("{}" as unknown as Uint8Array), {
    status: "invalid",
    reason: "state_input_invalid",
  });
  let calls = 0;
  const proxy = new Proxy(json, {
    get() {
      calls++;
      throw new Error("must not execute");
    },
  });
  assert.equal(parseAccessManagementState(proxy).status, "invalid");
  const accessor = new Uint8Array(json);
  Object.defineProperty(accessor, "byteLength", {
    get() {
      calls++;
      throw new Error("must not execute");
    },
  });
  assert.equal(parseAccessManagementState(accessor).status, "parsed");
  assert.equal(calls, 0);
});

/**
 * 交換の段階別旧資格・新資格結合を検証する。
 * @responsibility 未解決参照の削除と失効段階のactive資格を拒否する。
 * @trace RFD-UT-028
 * @precondition 完了初回と既存User／資格を用意する。
 * @stimulus 3段階と指定／全員×Host／Workbenchを構築し、完全な空集合、部分集合、旧資格削除、全員発行先Role不一致、後段有効資格残存を与える。
 * @observation 各段階のparsed／invalidを確認する。
 * @oracle 正常3段階・4組・双方空集合はparsed、部分集合・失効不一致・参照削除・all非administrator・後段の余剰有効資格はinvalid。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 実交換や失効Effectを発行しない。
 */
test("交換3段階と未解決参照", () => {
  const state = createBaseline();
  const userId = "00000000-0000-4000-8000-000000000003";
  const attemptId = state.initialization.attemptId;
  const oldId = "0123456789abcdef01234567";
  const operationId = "00000000-0000-4000-8000-000000000004";
  state.users = [{ userId, username: "管理者", role: "administrator" }];
  state.initialization = {
    stage: "completed",
    attemptId,
    initialUserId: userId,
    initialCredentialId: oldId,
    confirmationCredentialId: oldId,
    connection: "confirmed",
  };
  state.credentials = [
    {
      credentialId: oldId,
      userId,
      tokenVersion: 1,
      tokenSalt: "a".repeat(32),
      tokenVerifier: "b".repeat(64),
      revoked: false,
      operationId: attemptId,
      presentation: "confirmed",
    },
  ];
  const exchange = {
    stage: "prepared" as const,
    recoveryId: `access-management.key-exchange.${operationId}`,
    operationId,
    entry: "host" as const,
    scope: "targeted" as const,
    recipientUserId: userId,
    oldCredentialIds: [oldId],
  };
  state.unresolvedKeyExchanges = [exchange];
  const prepared = structuredClone(state);
  for (const entry of ["host", "workbench"] as const) {
    for (const scope of ["targeted", "all"] as const) {
      const normal = structuredClone(prepared);
      normal.unresolvedKeyExchanges = [{ ...exchange, entry, scope }];
      assert.equal(
        parseAccessManagementState(Buffer.from(JSON.stringify(normal))).status,
        "parsed",
      );
    }
  }
  const empty = structuredClone(prepared);
  const emptyCredential = empty.credentials[0];
  assert.ok(emptyCredential);
  emptyCredential.revoked = true;
  for (const scope of ["targeted", "all"] as const) {
    empty.unresolvedKeyExchanges = [
      { ...exchange, scope, oldCredentialIds: [] },
    ];
    assert.equal(
      parseAccessManagementState(Buffer.from(JSON.stringify(empty))).status,
      "parsed",
    );
  }
  const partial = structuredClone(prepared);
  const original = partial.credentials[0];
  assert.ok(original);
  partial.credentials.push({
    ...original,
    credentialId: "fedcba9876543210fedcba98",
    operationId: "00000000-0000-4000-8000-000000000005",
  });
  for (const scope of ["targeted", "all"] as const) {
    partial.unresolvedKeyExchanges = [{ ...exchange, scope }];
    assert.equal(
      parseAccessManagementState(Buffer.from(JSON.stringify(partial))).status,
      "invalid",
    );
  }
  partial.unresolvedKeyExchanges = [{ ...exchange, oldCredentialIds: [] }];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(partial))).status,
    "invalid",
  );
  const wrongRecipient = structuredClone(prepared);
  const recipient = wrongRecipient.users[0];
  assert.ok(recipient);
  recipient.role = "manager";
  wrongRecipient.unresolvedKeyExchanges = [{ ...exchange, scope: "all" }];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(wrongRecipient)))
      .status,
    "invalid",
  );
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  state.unresolvedKeyExchanges = [{ ...exchange, stage: "revoked" }];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "invalid",
  );
  const oldCredential = state.credentials[0];
  assert.ok(oldCredential);
  oldCredential.revoked = true;
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const newId = "abcdef0123456789abcdef01";
  state.credentials.push({
    ...oldCredential,
    credentialId: newId,
    revoked: false,
    operationId,
    presentation: "unconfirmed",
  });
  state.unresolvedKeyExchanges = [
    { ...exchange, stage: "credential_stored", newCredentialId: newId },
  ];
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  const residual = structuredClone(state);
  residual.credentials.push({
    ...oldCredential,
    credentialId: "fedcba9876543210fedcba98",
    revoked: false,
    operationId: "00000000-0000-4000-8000-000000000005",
  });
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(residual))).status,
    "invalid",
  );
  state.credentials.shift();
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "invalid",
  );
});
