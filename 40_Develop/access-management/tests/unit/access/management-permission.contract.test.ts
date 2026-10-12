/**
 * Role別分担9行と11認可要求種別の対象を検証する。
 *
 * @packageDocumentation
 * @responsibility 許可・拒否・入力不正を公開Root経由で確認し、純粋判定以外の成立を主張しない。
 * @trace RFD-UT-020
 * @level UT
 * @scope access-management、固定管理分担、操作別Role対象
 * @boundary N/A: I/Oを持たない純粋判定を確認する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../../../src/index.ts";
import {
  type AccessRole,
  evaluateManagementPermission,
  type ManagementRequest,
} from "../../../src/index.ts";

const ROLES: readonly AccessRole[] = ["developer", "manager", "administrator"];

/**
 * 三Roleと11認可要求種別の基本分担を全数確認する。
 * @responsibility developer全拒否、通常管理manager許可、鍵administrator専用を固定Oracleへ照合する。
 * @trace RFD-UT-020
 * @precondition 採用済み操作と対象Roleを値として用意する。
 * @stimulus 三Roleを全11認可要求種別へ適用する。
 * @observation 33判定結果とRuntime公開Symbol集合を取得する。
 * @oracle 明示した担当Role集合だけallowed、他の有効Roleはdenied。Runtime公開Symbolは宣言したPackage Root集合と完全一致し、保存関数を本試験では実行しない。
 * @cleanup N/A: 状態・handle・一時Fileを生成しない。
 * @boundary N/A: 純粋関数の公開入口だけを呼ぶ。
 */
test("三Roleと全11認可要求種別の固定分担", () => {
  assert.deepEqual(Object.keys(publicApi).sort(), [
    "authenticateCredential",
    "authenticateNormalConnection",
    "changeUserRole",
    "createCredentialMaterial",
    "createInitialAdministrator",
    "createInitialCredential",
    "evaluateHostInitializationState",
    "evaluateManagementPermission",
    "initializeAccessManagementState",
    "parseAccessManagementState",
    "readAccessManagementState",
    "readCredentialId",
    "readCurrentAccess",
    "readManagementState",
    "recordCredentialPresentation",
    "registerRepository",
    "registerUser",
    "resolveAiProfileManagementAccess",
    "resolveRepositoryAccess",
    "resolveRepositoryAccessCollection",
    "unregisterRepository",
    "updateAccessManagementState",
    "updateExposure",
    "updateRoleContentAccess",
    "updateUserName",
    "verifyCredentialToken",
  ]);
  const rows: readonly Readonly<{
    request: ManagementRequest;
    permittedRoles: readonly AccessRole[];
  }>[] = [
    {
      request: { operation: "registerUser", plannedRole: "developer" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "updateUserName", targetRole: "administrator" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: {
        operation: "changeUserRole",
        currentRole: "developer",
        nextRole: "manager",
      },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "updateRoleContentAccess", targetRole: "manager" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "registerRepository" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "unregisterRepository" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "updateExposure" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "manageAiProfiles" },
      permittedRoles: ["manager", "administrator"],
    },
    {
      request: { operation: "issueCredential" },
      permittedRoles: ["administrator"],
    },
    {
      request: { operation: "revokeCredential" },
      permittedRoles: ["administrator"],
    },
    {
      request: { operation: "exchangeCredentials" },
      permittedRoles: ["administrator"],
    },
  ];
  for (const row of rows) {
    for (const role of ROLES) {
      assert.equal(
        evaluateManagementPermission(role, row.request),
        row.permittedRoles.includes(role) ? "allowed" : "denied",
        `${role}:${row.request.operation}`,
      );
    }
  }
});

/**
 * 登録予定、変更前後、内容設定、表示名のRole対象を全数確認する。
 * @responsibility managerのadministrator表示名許可とadministrator資格境界の拒否を区別する。
 * @trace RFD-UT-020
 * @precondition 三Roleをactorと対象へ別々に用意する。
 * @stimulus 登録・名前・内容設定の9組ずつ、Role変更の27組を評価する。
 * @observation 対象別の54結果を取得する。
 * @oracle administratorは全有効対象、managerは名前全対象と通常Role対象だけ許可、developerは拒否。
 * @cleanup N/A: 入力値だけを使用する。
 * @boundary N/A: 保存や実対象存在の観測には接続しない。
 */
test("操作固有のRole対象と全変更前後組合せ", () => {
  for (const actor of ROLES) {
    for (const target of ROLES) {
      const ordinary =
        actor === "administrator" ||
        (actor === "manager" && target !== "administrator");
      assert.equal(
        evaluateManagementPermission(actor, {
          operation: "registerUser",
          plannedRole: target,
        }),
        ordinary ? "allowed" : "denied",
      );
      assert.equal(
        evaluateManagementPermission(actor, {
          operation: "updateRoleContentAccess",
          targetRole: target,
        }),
        ordinary ? "allowed" : "denied",
      );
      assert.equal(
        evaluateManagementPermission(actor, {
          operation: "updateUserName",
          targetRole: target,
        }),
        actor === "developer" ? "denied" : "allowed",
      );
      for (const next of ROLES) {
        const expected =
          actor === "administrator" ||
          (actor === "manager" &&
            target !== "administrator" &&
            next !== "administrator");
        assert.equal(
          evaluateManagementPermission(actor, {
            operation: "changeUserRole",
            currentRole: target,
            nextRole: next,
          }),
          expected ? "allowed" : "denied",
        );
      }
    }
  }
});

/**
 * 入力閉包と未知値を許可・権限不足へ丸めないことを確認する。
 * @responsibility 欠落・余分field・旧Role・未知操作をinvalidとして検査する。
 * @trace RFD-UT-020
 * @precondition 不正値と、形式的に正しい不許可要求を分けて用意する。
 * @stimulus 不正actor、代表操作の対象欠測、Role対象の未知・型不正、余分・symbol・旧形式を評価する。
 * @observation invalidとdeniedの区別を取得する。
 * @oracle 不正はactorの許可状態によらずinvalid、有効なdeveloper管理要求はdenied。
 * @cleanup N/A: 外部資源を使わない。
 * @boundary N/A: Runtime値の形式検査のみ。
 */
test("未知値と操作別必須・禁止fieldを拒否", () => {
  const invalidRequests: readonly unknown[] = [
    null,
    undefined,
    1,
    [],
    {},
    { operation: "registerUser" },
    { operation: "registerUser", plannedRole: "management" },
    { operation: "updateUserName" },
    { operation: "updateRoleContentAccess", targetRole: 3 },
    { operation: "changeUserRole", currentRole: "developer" },
    { operation: "changeUserRole", currentRole: "other", nextRole: "manager" },
    { operation: "fromHost" },
    { operation: "manageAiProfiles", systemAdmin: true },
    { operation: "issueCredential", systemAdmin: true },
    { operation: "registerRepository", targetRole: "developer" },
    { operation: "unregisterRepository", [Symbol("extra")]: true },
    Object.create({ operation: "updateExposure" }),
  ];
  for (const actor of ROLES) {
    for (const request of invalidRequests) {
      assert.equal(evaluateManagementPermission(actor, request), "invalid");
    }
  }
  for (const actor of [null, undefined, "management", "root", {}, 1]) {
    assert.equal(
      evaluateManagementPermission(actor, { operation: "issueCredential" }),
      "invalid",
    );
  }
  assert.equal(
    evaluateManagementPermission("developer", {
      operation: "registerRepository",
    }),
    "denied",
  );
});

/**
 * getterとProxyを実行せず、正しい入力値を変更しないことを確認する。
 * @responsibility 値判定から任意callbackや状態変更を起こさない。
 * @trace RFD-UT-020
 * @precondition getterとProxyの呼出し計数、凍結済み有効要求を用意する。
 * @stimulus 各入力を評価し、有効要求は二回評価する。
 * @observation getter／Proxy trap件数、判定と入力の保持を確認する。
 * @oracle getter／trapは0、不正入力はinvalid、有効要求は同じallowedで不変。
 * @cleanup N/A: 計数はTest内の局所値だけである。
 * @boundary N/A: Process／Filesystem／資格操作を呼ばない。
 */
test("accessorとProxy非実行・入力不変", () => {
  let calls = 0;
  const accessor = Object.defineProperty({}, "operation", {
    get() {
      calls++;
      return "issueCredential";
    },
    enumerable: true,
  });
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        calls++;
        return null;
      },
      ownKeys() {
        calls++;
        return [];
      },
    },
  );
  assert.equal(
    evaluateManagementPermission("administrator", accessor),
    "invalid",
  );
  assert.equal(evaluateManagementPermission("administrator", proxy), "invalid");
  assert.equal(calls, 0);
  const request = Object.freeze({
    operation: "updateUserName",
    targetRole: "administrator",
  });
  assert.equal(evaluateManagementPermission("manager", request), "allowed");
  assert.equal(evaluateManagementPermission("manager", request), "allowed");
  assert.deepEqual(request, {
    operation: "updateUserName",
    targetRole: "administrator",
  });
});
