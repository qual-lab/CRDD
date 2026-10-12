/**
 * 鍵交換四経路の現在認証・対象・確認と準備候補を検証する。
 * @responsibility 準備の意味判断を保存・失効・新資格生成・提示の成立と分離する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @level IT
 * @scope credential/key-exchange、現在資格照合、完全状態Parser。
 * @boundary 模擬資格とメモリ状態だけ。実Host・保存・公開入口なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareKeyExchange,
  prepareKeyExchangeRevocation,
  prepareExchangedCredential,
  selectKeyExchangeContinuation,
  prepareKeyExchangeCompletion,
} from "../../../src/credential/key-exchange.ts";
import { createCredentialMaterial } from "../../../src/credential/token-material.ts";
import {
  type AccessManagementState,
  parseAccessManagementState,
} from "../../../src/state/parse.ts";

const EXCHANGE = "00000000-0000-4000-8000-000000000090";

/**
 * 保存済み交換の意味断面をメモリに作る。
 * @responsibility 未確認の前交換と現在認証を追加保存なしで準備する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 模擬三Roleだけを使用する。
 * @stimulus Host指定交換の純粋三段階を組み立てる。
 * @observation 完全Parserと現在資格相関。
 * @oracle 実Host・Filesystem・公開入口を使用しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 純粋交換候補とSchema。
 */
function createStoredExchangeFixture() {
  const f = createExchangeFixture();
  const recipient = f.state.users[1];
  assert.ok(recipient);
  const ids = f.state.credentials
    .filter((c) => c.userId === recipient.userId)
    .map((c) => c.credentialId);
  const prepared = prepareKeyExchange(
    f.state,
    "host",
    null,
    1,
    EXCHANGE,
    "targeted",
    recipient.userId,
    ids,
    true,
  );
  assert.ok(prepared);
  const recoveryId = `access-management.key-exchange.${EXCHANGE}`;
  const revoked = prepareKeyExchangeRevocation(prepared, recoveryId);
  assert.ok(revoked);
  const material = createCredentialMaterial();
  const stored = prepareExchangedCredential(revoked, recoveryId, material);
  assert.ok(stored);
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(stored))).status,
    "parsed",
  );
  return { ...f, stored, material, recipient, recoveryId };
}

/**
 * 三Roleと複数旧資格を持つ模擬状態を構築する。
 * @responsibility 既存ユーザーへのexact交換を実資格なしで反証する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition N/A: 本番状態・秘密を使用しない。
 * @stimulus 三ユーザーとadministrator／managerの各二資格を生成する。
 * @observation 完全状態・模擬Bearerをメモリだけに返す。
 * @oracle completed初回の歴史IDは現資格と独立し、完全Parserが受理する。
 * @cleanup N/A: ファイル・Process資源を作らない。
 * @boundary 模擬資格生成と状態の純粋照合。
 */
function createExchangeFixture() {
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      {
        userId: "00000000-0000-4000-8000-000000000003",
        username: "管理",
        role: "administrator",
      },
      {
        userId: "00000000-0000-4000-8000-000000000004",
        username: "運営",
        role: "manager",
      },
      {
        userId: "00000000-0000-4000-8000-000000000005",
        username: "開発",
        role: "developer",
      },
    ],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    credentials: [],
    registeredRepositories: [],
    exposure: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000002",
      initialUserId: "00000000-0000-4000-8000-000000000003",
      initialCredentialId: "0".repeat(24),
      confirmationCredentialId: "0".repeat(24),
      connection: "confirmed",
    },
    unresolvedKeyExchanges: [],
  };
  const tokens: string[] = [];
  for (const [index, userIndex] of [0, 1, 2, 0, 1].entries()) {
    const user = state.users[userIndex];
    assert.ok(user);
    const material = createCredentialMaterial();
    tokens.push(material.token);
    state.credentials.push({
      credentialId: material.credentialId,
      userId: user.userId,
      tokenVersion: 1,
      tokenSalt: material.tokenSalt,
      tokenVerifier: material.tokenVerifier,
      revoked: false,
      operationId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      presentation: "confirmed",
    });
  }
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
    "parsed",
  );
  return { state, tokens };
}

/**
 * 四経路の同改訂・exact集合と既存発行先を検証する。
 * @responsibility preparedを失効や生成の完了へ昇格しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 完全な模擬状態と現在administrator資格。
 * @stimulus Workbench／Host×指定／全員を表示集合と必要な確認で渡す。
 * @observation 次改訂・Recovery・旧ID集合、完全Parser、入力不変。
 * @oracle 全四経路がpreparedだけを追加し、資格・初回・他情報を保持する。
 * @cleanup N/A: メモリ状態だけ。
 * @boundary 現在認証→交換候補→完全Schema。
 */
test("鍵交換準備は四経路をexact集合と既存発行先へ結ぶ", () => {
  const f = createExchangeFixture();
  const before = structuredClone(f.state);
  for (const entry of ["workbench", "host"] as const)
    for (const scope of ["targeted", "all"] as const) {
      const recipient = f.state.users[scope === "all" ? 0 : 1];
      assert.ok(recipient);
      const ids = f.state.credentials
        .filter((c) => scope === "all" || c.userId === recipient.userId)
        .map((c) => c.credentialId);
      const next = prepareKeyExchange(
        f.state,
        entry,
        entry === "host" ? null : (f.tokens[0] ?? ""),
        1,
        EXCHANGE,
        scope,
        recipient.userId,
        ids.toReversed(),
        entry === "host" || scope === "all",
      );
      assert.ok(next);
      assert.deepEqual(next.unresolvedKeyExchanges, [
        {
          stage: "prepared",
          recoveryId: `access-management.key-exchange.${EXCHANGE}`,
          operationId: EXCHANGE,
          entry,
          scope,
          recipientUserId: recipient.userId,
          oldCredentialIds: ids,
        },
      ]);
      assert.equal(next.revision, 2);
      assert.equal(next.operationId, EXCHANGE);
      assert.deepEqual(next.credentials, before.credentials);
      assert.deepEqual(next.initialization, before.initialization);
      assert.deepEqual(next.users, before.users);
      assert.deepEqual(next.roleContentAccess, before.roleContentAccess);
      assert.deepEqual(
        next.registeredRepositories,
        before.registeredRepositories,
      );
      assert.deepEqual(next.exposure, before.exposure);
      assert.equal(
        parseAccessManagementState(Buffer.from(JSON.stringify(next))).status,
        "parsed",
      );
      assert.deepEqual(f.state, before);
    }
});

/**
 * 現在Role・改訂・対象・確認差を準備前に拒否する。
 * @responsibility 表示済みIDや確認値だけで管理Authorityを作らない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 三Roleと複数資格の模擬状態。
 * @stimulus manager／developer／不正鍵、確認欠落、別集合、未知対象、全員非管理者、旧改訂を渡す。
 * @observation nullと入力状態不変。
 * @oracle 拒否時の交換record・失効・新資格追加0。
 * @cleanup N/A: メモリだけ。
 * @boundary 現在認証と操作固有条件。
 */
test("鍵交換準備は非管理者と対象・表示・確認・改訂差を拒否する", () => {
  const f = createExchangeFixture();
  const recipient = f.state.users[0];
  assert.ok(recipient);
  const ids = f.state.credentials.map((c) => c.credentialId);
  const before = structuredClone(f.state);
  for (const token of [f.tokens[1] ?? "", f.tokens[2] ?? "", "invalid"])
    assert.equal(
      prepareKeyExchange(
        f.state,
        "workbench",
        token,
        1,
        EXCHANGE,
        "all",
        recipient.userId,
        ids,
        true,
      ),
      null,
    );
  for (const entry of ["workbench", "host"] as const)
    assert.equal(
      prepareKeyExchange(
        f.state,
        entry,
        entry === "host" ? null : (f.tokens[0] ?? ""),
        1,
        EXCHANGE,
        "all",
        recipient.userId,
        ids,
        false,
      ),
      null,
    );
  for (const shown of [
    [],
    ids.slice(1),
    [...ids, ids[0]],
    [...ids.slice(1), "f".repeat(24)],
  ])
    assert.equal(
      prepareKeyExchange(
        f.state,
        "host",
        null,
        1,
        EXCHANGE,
        "all",
        recipient.userId,
        shown,
        true,
      ),
      null,
    );
  assert.equal(
    prepareKeyExchange(
      f.state,
      "host",
      null,
      2,
      EXCHANGE,
      "all",
      recipient.userId,
      ids,
      true,
    ),
    null,
  );
  assert.equal(
    prepareKeyExchange(
      f.state,
      "host",
      null,
      1,
      EXCHANGE,
      "all",
      f.state.users[1]?.userId ?? "",
      ids,
      true,
    ),
    null,
  );
  assert.equal(
    prepareKeyExchange(
      f.state,
      "host",
      null,
      1,
      EXCHANGE,
      "targeted",
      EXCHANGE,
      [],
      true,
    ),
    null,
  );
  assert.deepEqual(f.state, before);
});

/**
 * 古い受付IDと未解決交換の重複を拒否する。
 * @responsibility 初回相関・資格発行・交換のIdentityを再利用しない。
 * @trace RFD-IT-017
 * @precondition 完全な模擬状態と表示済み全員集合。
 * @stimulus 現在出版ID・初回ID・元発行ID・既存preparedを渡す。
 * @observation nullと元の資格不変。
 * @oracle 新Recovery・重複交換・失効0。
 * @cleanup N/A: メモリだけ。
 * @boundary 交換開始と既存相関。
 */
test("鍵交換準備は歴史的ID再利用と未解決交換を拒否する", () => {
  const f = createExchangeFixture();
  const recipient = f.state.users[0];
  assert.ok(recipient);
  const ids = f.state.credentials.map((c) => c.credentialId);
  for (const id of [
    f.state.operationId,
    f.state.initialization.attemptId,
    ...f.state.credentials.map((c) => c.operationId),
  ])
    assert.equal(
      prepareKeyExchange(
        f.state,
        "host",
        null,
        1,
        id,
        "all",
        recipient.userId,
        ids,
        true,
      ),
      null,
    );
  const next = prepareKeyExchange(
    f.state,
    "host",
    null,
    1,
    EXCHANGE,
    "all",
    recipient.userId,
    ids,
    true,
  );
  assert.ok(next);
  assert.equal(
    prepareKeyExchange(
      next,
      "host",
      null,
      2,
      "00000000-0000-4000-8000-000000000091",
      "all",
      recipient.userId,
      ids,
      true,
    ),
    null,
  );
});

/**
 * 初回途中のHost指定と資格0件のHost交換を区別する。
 * @responsibility 初回Bindingを全員・Workbenchへ流用せず、鍵喪失後のHostを塞がない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 完了状態または完全な一管理者初回資格段階。
 * @stimulus 全旧失効、初回Host指定と他三経路、未生成初回を渡す。
 * @observation preparedのParser成立と拒否範囲。
 * @oracle Host旧集合0件可。初回は同User指定だけ、元確認IDは準備では不変。
 * @cleanup N/A: メモリだけ。
 * @boundary Host信頼入口と初回・通常の意味境界。
 */
test("鍵交換準備はHostの旧資格0件と初回同User指定だけを許す", () => {
  const f = createExchangeFixture();
  const admin = f.state.users[0];
  const credential = f.state.credentials[0];
  assert.ok(admin && credential);
  const noActive = structuredClone(f.state);
  for (const item of noActive.credentials) item.revoked = true;
  const empty = prepareKeyExchange(
    noActive,
    "host",
    null,
    1,
    EXCHANGE,
    "all",
    admin.userId,
    [],
    true,
  );
  assert.ok(empty);
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(empty))).status,
    "parsed",
  );
  const emptyTargeted = prepareKeyExchange(
    noActive,
    "host",
    null,
    1,
    EXCHANGE,
    "targeted",
    admin.userId,
    [],
    true,
  );
  assert.ok(emptyTargeted);
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(emptyTargeted)))
      .status,
    "parsed",
  );
  const initial = structuredClone(f.state);
  initial.users = [admin];
  initial.credentials = [
    {
      ...credential,
      operationId: initial.initialization.attemptId,
      presentation: "unconfirmed",
    },
  ];
  initial.initialization = {
    stage: "credential_stored",
    attemptId: initial.initialization.attemptId,
    userId: admin.userId,
    initialCredentialId: credential.credentialId,
    confirmationCredentialId: credential.credentialId,
  };
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(initial))).status,
    "parsed",
  );
  const prepared = prepareKeyExchange(
    initial,
    "host",
    null,
    1,
    EXCHANGE,
    "targeted",
    admin.userId,
    [credential.credentialId],
    true,
  );
  assert.ok(prepared);
  assert.deepEqual(prepared.initialization, initial.initialization);
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(prepared))).status,
    "parsed",
  );
  assert.equal(
    prepareKeyExchange(
      initial,
      "host",
      null,
      1,
      EXCHANGE,
      "all",
      admin.userId,
      [credential.credentialId],
      true,
    ),
    null,
  );
  assert.equal(
    prepareKeyExchange(
      initial,
      "workbench",
      f.tokens[0] ?? "",
      1,
      EXCHANGE,
      "targeted",
      admin.userId,
      [credential.credentialId],
      false,
    ),
    null,
  );
  assert.equal(
    prepareKeyExchange(
      initial,
      "host",
      null,
      1,
      EXCHANGE,
      "targeted",
      f.state.users[1]?.userId ?? "",
      [],
      true,
    ),
    null,
  );
  for (const stage of ["correlated", "user_stored"] as const) {
    const earlier = structuredClone(initial);
    earlier.credentials = [];
    earlier.initialization =
      stage === "correlated"
        ? { stage, attemptId: initial.initialization.attemptId }
        : {
            stage,
            attemptId: initial.initialization.attemptId,
            userId: admin.userId,
          };
    if (stage === "correlated") earlier.users = [];
    assert.equal(
      parseAccessManagementState(Buffer.from(JSON.stringify(earlier))).status,
      "parsed",
    );
    assert.equal(
      prepareKeyExchange(
        earlier,
        "host",
        null,
        1,
        EXCHANGE,
        "targeted",
        admin.userId,
        [],
        true,
      ),
      null,
    );
  }
  for (const offset of [7, 6]) {
    const bounded = structuredClone(initial);
    bounded.revision = Number.MAX_SAFE_INTEGER - offset;
    const result = prepareKeyExchange(
      bounded,
      "host",
      null,
      bounded.revision,
      EXCHANGE,
      "targeted",
      admin.userId,
      [credential.credentialId],
      true,
    );
    if (offset === 7) {
      assert.ok(result);
      assert.equal(
        parseAccessManagementState(Buffer.from(JSON.stringify(result))).status,
        "parsed",
      );
    } else assert.equal(result, null);
  }
});

/**
 * 通常交換の全出版分を開始前に予約する。
 * @responsibility core三段階の後に提示・整理が必ず停止する開始を拒否する。
 * @trace RFD-IT-017
 * @precondition 完了状態と既存Host発行先。
 * @stimulus MAX-6とMAX-5の改訂境界。
 * @observation 受理候補の完全Parser成立と拒否。
 * @oracle 通常6出版を残す場合だけprepared候補を作る。
 * @cleanup N/A: メモリだけ。
 * @boundary 改訂容量と交換開始。
 */
test("鍵交換準備は提示と整理までの六改訂を予約する", () => {
  const f = createExchangeFixture();
  const admin = f.state.users[0];
  assert.ok(admin);
  const ids = f.state.credentials.map((c) => c.credentialId);
  for (const offset of [6, 5]) {
    const bounded = structuredClone(f.state);
    bounded.revision = Number.MAX_SAFE_INTEGER - offset;
    const result = prepareKeyExchange(
      bounded,
      "host",
      null,
      bounded.revision,
      EXCHANGE,
      "all",
      admin.userId,
      ids,
      true,
    );
    if (offset === 6) {
      assert.ok(result);
      assert.equal(
        parseAccessManagementState(Buffer.from(JSON.stringify(result))).status,
        "parsed",
      );
    } else assert.equal(result, null);
  }
});

/**
 * 表示集合の実行可能Propertyを評価しない。
 * @responsibility 不正な集合を事前確認として採用しない。
 * @trace RFD-IT-013
 * @precondition 模擬完全状態。
 * @stimulus accessor・Proxy・疎配列・追加Propertyを渡す。
 * @observation null、getter／Proxy実行0。
 * @oracle 状態を変更せず準備相関0。
 * @cleanup N/A: メモリだけ。
 * @boundary 信頼しない表示入力。
 */
test("鍵交換準備は表示集合のaccessorとProxyを実行しない", () => {
  const f = createExchangeFixture();
  const recipient = f.state.users[0];
  assert.ok(recipient);
  let accessed = 0;
  const accessor: unknown[] = [];
  Object.defineProperty(accessor, "0", {
    get: () => {
      accessed++;
      return "a".repeat(24);
    },
  });
  const proxy = new Proxy([], {
    ownKeys: () => {
      accessed++;
      return [];
    },
  });
  const extra = Object.assign([], { extra: true });
  for (const shown of [accessor, proxy, new Array(1), extra])
    assert.equal(
      prepareKeyExchange(
        f.state,
        "host",
        null,
        1,
        EXCHANGE,
        "all",
        recipient.userId,
        shown,
        true,
      ),
      null,
    );
  assert.equal(accessed, 0);
});

/**
 * 引継ぎの対象・確認・現在認証を反証する。
 * @responsibility previous参照だけから新交換Authorityを作らせない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 完全stored前交換と現在administrator資格。
 * @stimulus 前参照、表示集合、発行先、確認、提示、段階、改訂余裕を変える。
 * @observation null拒否、候補一記録、入力不変。
 * @oracle 未確認・同発行先・完全集合・現在認可だけ新preparedを作れる。
 * @cleanup N/A: メモリだけ。
 * @boundary 交換開始の意味と完全Parser。
 */
test("鍵交換引継ぎ候補は現在条件と旧新資格の必須包含を守る", () => {
  const f = createStoredExchangeFixture();
  const newId = "00000000-0000-4000-8000-000000000091";
  const before = structuredClone(f.stored);
  for (const mode of [
    "normal",
    "omitted",
    "wrong",
    "same_op",
    "recipient",
    "missing",
    "extra",
    "confirmed",
    "non_admin",
    "confirmation",
    "capacity",
  ] as const) {
    const state = structuredClone(f.stored);
    let ids = [f.material.credentialId];
    let previous: string | undefined = f.recoveryId;
    if (mode === "omitted") previous = undefined;
    if (mode === "wrong")
      previous =
        "access-management.key-exchange.00000000-0000-4000-8000-000000000099";
    if (mode === "missing") ids = [];
    if (mode === "extra") ids.push("0".repeat(24));
    if (mode === "confirmed") {
      const credential = state.credentials.find(
        (c) => c.credentialId === f.material.credentialId,
      );
      assert.ok(credential);
      credential.presentation = "confirmed";
    }
    if (mode === "capacity") state.revision = Number.MAX_SAFE_INTEGER - 5;
    const next = prepareKeyExchange(
      state,
      mode === "non_admin" ? "workbench" : "host",
      mode === "non_admin" ? (f.tokens[2] ?? "") : null,
      state.revision,
      mode === "same_op" ? EXCHANGE : newId,
      "targeted",
      mode === "recipient"
        ? (state.users[0]?.userId ?? "")
        : f.recipient.userId,
      ids,
      mode !== "confirmation",
      previous,
    );
    if (mode === "normal") {
      assert.ok(next);
      assert.equal(next.unresolvedKeyExchanges.length, 1);
      assert.equal(next.unresolvedKeyExchanges[0]?.operationId, newId);
      assert.deepEqual(next.credentials, state.credentials);
      assert.equal(
        parseAccessManagementState(Buffer.from(JSON.stringify(next))).status,
        "parsed",
      );
    } else assert.equal(next, null, mode);
  }
  assert.deepEqual(f.stored, before);
  const boundary = structuredClone(f.stored);
  boundary.revision = Number.MAX_SAFE_INTEGER - 6;
  assert.ok(
    prepareKeyExchange(
      boundary,
      "host",
      null,
      boundary.revision,
      newId,
      "targeted",
      f.recipient.userId,
      [f.material.credentialId],
      true,
      f.recoveryId,
    ),
  );
});

/**
 * 新交換へ置換後の前参照相関を再評価する。
 * @responsibility 同new操作の継続と別previous混入を分ける。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 前交換由来資格を旧集合に含む新prepared／revoked／stored。
 * @stimulus 正しい前参照、省略、別参照、提示confirmed、集合外を渡す。
 * @observation 継続recordまたはnull。
 * @oracle 元資格operationとのexact相関を現在認可と独立に維持する。
 * @cleanup N/A: メモリだけ。
 * @boundary 再送の由来と新exact段階。
 */
test("鍵交換引継ぎ再送は三段階で前交換の由来を保持する", () => {
  const f = createStoredExchangeFixture();
  const operationId = "00000000-0000-4000-8000-000000000091";
  const prepared = prepareKeyExchange(
    f.stored,
    "host",
    null,
    4,
    operationId,
    "targeted",
    f.recipient.userId,
    [f.material.credentialId],
    true,
    f.recoveryId,
  );
  assert.ok(prepared);
  const recoveryId = `access-management.key-exchange.${operationId}`;
  const revoked = prepareKeyExchangeRevocation(prepared, recoveryId);
  assert.ok(revoked);
  const stored = prepareExchangedCredential(
    revoked,
    recoveryId,
    createCredentialMaterial(),
  );
  assert.ok(stored);
  for (const current of [prepared, revoked, stored]) {
    for (const mode of [
      "normal",
      "omitted",
      "wrong",
      "confirmed",
      "outside",
    ] as const) {
      const state = structuredClone(current);
      if (mode === "confirmed") {
        const credential = state.credentials.find(
          (c) => c.credentialId === f.material.credentialId,
        );
        assert.ok(credential);
        credential.presentation = "confirmed";
      }
      if (mode === "outside") {
        const credential = state.credentials.find(
          (c) => c.credentialId === f.material.credentialId,
        );
        assert.ok(credential);
        credential.operationId = "00000000-0000-4000-8000-000000000099";
      }
      const record = selectKeyExchangeContinuation(
        state,
        "host",
        null,
        state.revision,
        operationId,
        "targeted",
        f.recipient.userId,
        [f.material.credentialId],
        true,
        mode === "omitted"
          ? undefined
          : mode === "wrong"
            ? "access-management.key-exchange.00000000-0000-4000-8000-000000000099"
            : f.recoveryId,
      );
      if (mode === "normal" || mode === "omitted") assert.ok(record);
      else assert.equal(record, null, mode);
    }
  }
});

/**
 * 終了候補の提示・改訂・操作衝突を反証する。
 * @responsibility 記録除去を秘密消去や受領保証へ変換しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 完全stored状態と現在administrator。
 * @stimulus 提示三状態、現在Role、参照、改訂、終了操作を変える。
 * @observation nullまたは一改訂でrecordだけ除去。
 * @oracle confirmedだけ許可し、初回を含む他fieldを保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary 終了意味とSchema。
 */
test("鍵交換終了候補は確認事実と操作相関を必須にする", () => {
  const f = createStoredExchangeFixture();
  const operationId = "00000000-0000-4000-8000-000000000091";
  for (const presentation of [
    "not_attempted",
    "unconfirmed",
    "confirmed",
  ] as const) {
    const state = structuredClone(f.stored);
    const credential = state.credentials.find(
      (c) => c.credentialId === f.material.credentialId,
    );
    assert.ok(credential);
    credential.presentation = presentation;
    const before = structuredClone(state);
    const next = prepareKeyExchangeCompletion(
      state,
      "workbench",
      f.tokens[0] ?? "",
      4,
      operationId,
      f.recoveryId,
    );
    if (presentation !== "confirmed") assert.equal(next, null);
    else {
      assert.deepEqual(next, {
        ...state,
        revision: 5,
        operationId,
        unresolvedKeyExchanges: [],
      });
      assert.equal(
        prepareKeyExchangeCompletion(
          state,
          "workbench",
          f.tokens[2] ?? "",
          4,
          operationId,
          f.recoveryId,
        ),
        null,
      );
      assert.equal(
        prepareKeyExchangeCompletion(
          state,
          "host",
          null,
          3,
          operationId,
          f.recoveryId,
        ),
        null,
      );
      assert.equal(
        prepareKeyExchangeCompletion(
          state,
          "host",
          null,
          4,
          EXCHANGE,
          f.recoveryId,
        ),
        null,
      );
      state.revision = Number.MAX_SAFE_INTEGER;
      assert.equal(
        prepareKeyExchangeCompletion(
          state,
          "host",
          null,
          state.revision,
          operationId,
          f.recoveryId,
        ),
        null,
      );
    }
    assert.deepEqual(
      presentation === "confirmed" ? { ...state, revision: 4 } : state,
      before,
    );
  }
});

/**
 * 初回と通常の引継ぎ・終了の改訂余裕を確認する。
 * @responsibility 上限付近で提示・整理・初回確認が必ず詰まる開始を拒否する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 完全stored状態、初回だけ単一administratorへ拘束する。
 * @stimulus 通常6／初回7の予約境界と終了後確認1改訂の境界を渡す。
 * @observation 境界で候補あり、一改訂不足でnull。
 * @oracle 初回は同User Hostだけ、資格や歴史IDは候補で不変。
 * @cleanup N/A: メモリだけ。
 * @boundary 改訂容量と交換終了。
 */
test("鍵交換終了と引継ぎは通常と初回の改訂余裕を分ける", () => {
  for (const initial of [false, true]) {
    const f = createStoredExchangeFixture();
    const state = structuredClone(f.stored);
    if (initial) {
      const user = state.users.find(
        (item) => item.userId === f.recipient.userId,
      );
      assert.ok(user);
      user.role = "administrator";
      state.users = [user];
      state.credentials = state.credentials.filter(
        (item) => item.userId === user.userId,
      );
      const original = state.credentials[0];
      assert.ok(original);
      original.operationId = state.initialization.attemptId;
      state.initialization = {
        stage: "credential_stored",
        attemptId: original.operationId,
        userId: user.userId,
        initialCredentialId: original.credentialId,
        confirmationCredentialId: f.material.credentialId,
      };
    }
    assert.equal(
      parseAccessManagementState(Buffer.from(JSON.stringify(state))).status,
      "parsed",
    );
    const operationId = "00000000-0000-4000-8000-000000000091";
    const reserve = initial ? 7 : 6;
    for (const remaining of [reserve, reserve - 1]) {
      state.revision = Number.MAX_SAFE_INTEGER - remaining;
      const next = prepareKeyExchange(
        state,
        "host",
        null,
        state.revision,
        operationId,
        "targeted",
        f.recipient.userId,
        [f.material.credentialId],
        true,
        f.recoveryId,
      );
      assert.equal(next !== null, remaining === reserve);
    }
    const credential = state.credentials.find(
      (item) => item.credentialId === f.material.credentialId,
    );
    assert.ok(credential);
    credential.presentation = "confirmed";
    const closeReserve = initial ? 2 : 1;
    for (const remaining of [closeReserve, closeReserve - 1]) {
      state.revision = Number.MAX_SAFE_INTEGER - remaining;
      const next = prepareKeyExchangeCompletion(
        state,
        "host",
        null,
        state.revision,
        operationId,
        f.recoveryId,
      );
      assert.equal(next !== null, remaining === closeReserve);
    }
  }
});
