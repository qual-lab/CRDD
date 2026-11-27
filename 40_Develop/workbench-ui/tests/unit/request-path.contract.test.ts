/**
 * Workbenchの公開経路からパスとメソッドを構築する規則を検証する。
 * @trace EST-UT-017 ARCH-000012
 * @level UT
 * @boundary 文字列と要求オブジェクトのみ。HTTPやブラウザーを起動しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  workbenchPath,
  workbenchPostForm,
  workbenchRequest,
} from "../../src/api/path.ts";

test("一覧とID付き要求で公開メソッドとパスを保持する", () => {
  assert.equal(workbenchPath(["GET", "/api/users"]), "/api/users");
  assert.deepEqual(
    workbenchRequest(["PUT", "/api/users/:userId/role"], { userId: "QA Team" }),
    { method: "PUT", path: "/api/users/QA%20Team/role" },
  );
  assert.deepEqual(
    workbenchPostForm(["POST", "/api/session/login/:provider"], {
      provider: "fixture",
    }),
    { method: "post", action: "/api/session/login/fixture" },
  );
});

test("空と相対移動のパス引数は要求を作らず拒否する", () => {
  for (const userId of ["", ".", ".."]) {
    assert.throws(
      () => workbenchPath(["PUT", "/api/users/:userId/role"], { userId }),
      {
        message: "workbench_route_input_invalid",
      },
    );
  }
});
