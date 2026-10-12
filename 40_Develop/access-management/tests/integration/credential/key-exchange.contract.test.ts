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
import { prepareKeyExchange } from "../../../src/credential/key-exchange.ts";
import { createCredentialMaterial } from "../../../src/credential/token-material.ts";
import {
  type AccessManagementState,
  parseAccessManagementState,
} from "../../../src/state/parse.ts";

const EXCHANGE = "00000000-0000-4000-8000-000000000090";

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
