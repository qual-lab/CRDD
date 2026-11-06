/**
 * Executorの環境公開がDIの同じ関数へ直接接続することを確認する。
 * @responsibility 余計な実行Wrapperや別のmode判定を上位へ残さない。
 * @trace ERB-UT-023
 * @level UT
 * @scope 純粋なModule参照。実Docker・AI・Filesystem操作は行わない。
 * @boundary DIの実処理・外部資源成立は別契約で確認する。
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as isolation from "../../../docker-isolation/src/index.ts";
import * as executor from "../../src/index.ts";

/**
 * 環境二操作が同じ公開関数であることを確認する。
 * @responsibility 名前の統一だけで二重実装が残ることを防ぐ。
 * @trace ERB-UT-023
 * @precondition 両Rootを読取り可能である。
 * @stimulus 関数参照を比較する。操作自体は呼ばない。
 * @observation 参照同一性。
 * @oracle どちらも同じDI関数である。
 * @cleanup N/A: 外部資源を取得しない。
 * @boundary DIの実処理・外部資源成立は別契約で確認する。
 */
test("Executorの環境二操作はDI公開関数を直接再exportする", () => {
  assert.equal(
    executor.inspectDockerEnvironment,
    isolation.inspectDockerEnvironment,
  );
  assert.equal(
    executor.restartDockerEnvironment,
    isolation.restartDockerEnvironment,
  );
});
