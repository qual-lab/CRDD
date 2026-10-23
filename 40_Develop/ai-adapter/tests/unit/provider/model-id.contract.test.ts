/**
 * Provider Model識別子の構文を検証する。
 *
 * @packageDocumentation
 * @responsibility 既存Caseを実責務のSourceへ接続し、受理・拒否条件を維持する。
 * @trace RCM-UT-001
 * @level UT
 * @scope provider/validationの純粋契約。
 * @boundary N/A: Process内の値だけを扱い外部資源を作らない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { validateProviderModelId } from "../../../src/provider/validation.ts";

/**
 * Model IDの無変換検査と型付き拒否を確認する。
 * @responsibility Modelの構文確認を提供・登録確認へ昇格しない。
 * @trace RCM-UT-001
 * @precondition Process内の文字列だけを使う。
 * @stimulus 128文字境界、空白、大文字、区切り文字を与える。
 * @observation 状態、入力文字列の一致、固定理由を確認する。
 * @oracle 構文適合時だけ入力自身を返し、補正・fallbackをしない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary Provider構文検査の公開結果
 */
test("Model IDは補正せずvalid値又は固定理由付きblockedを返す", () => {
  for (const model of ["gpt-5.5", "opus", "a".repeat(128)])
    assert.deepEqual(validateProviderModelId(model), {
      status: "valid",
      value: model,
      error: null,
    });
  for (const model of [
    "",
    "a".repeat(129),
    "GPT-5.5",
    " gpt-5.5",
    "gpt 5.5",
    "gpt\0",
    "-gpt",
    "gpt/5.5",
  ])
    assert.deepEqual(validateProviderModelId(model), {
      status: "blocked",
      value: null,
      error: "provider_model_id_invalid",
    });
});
