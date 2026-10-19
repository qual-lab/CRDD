/**
 * Profileの利用条件と観測値の担当断面を検証する。
 *
 * @packageDocumentation
 * @responsibility 既存Caseを実責務のSourceへ接続し、受理・拒否条件を維持する。
 * @trace RCM-UT-001
 * @level UT
 * @scope profile/resolveの純粋契約。
 * @boundary N/A: Process内の値だけを扱い外部資源を作らない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAiProfileAvailability,
  validateProviderModelId,
} from "../../../src/profile/validation.ts";

/**
 * Model IDの無変換検査と型付き拒否を確認する。
 * @responsibility Modelの構文確認を提供・登録確認へ昇格しない。
 * @trace RCM-UT-001
 * @precondition Process内の文字列だけを使う。
 * @stimulus 128文字境界、空白、大文字、区切り文字を与える。
 * @observation 状態、入力文字列の一致、固定理由を確認する。
 * @oracle 構文適合時だけ入力自身を返し、補正・fallbackをしない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary Profile検証の公開結果
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

/**
 * Profile利用可能性の未観測と利用不可を分ける。
 *
 * @responsibility Host、認証、Authorityの四軸を一つの真偽値へ畳まないことを検証する。
 * @trace RCM-UT-001
 * @precondition 未観測をnull、利用不可をfalseで与える。
 * @stimulus 利用可能性Projectionを生成する。
 * @observation statusとreason軸を観測する。
 * @oracle nullはunknown、falseが一つでもあればunavailableになる。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-001=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("利用可能性は未観測と利用不可を区別する", () => {
  assert.deepEqual(
    evaluateAiProfileAvailability({
      adapterRegistered: true,
      hostAvailable: null,
      authenticated: true,
      executionAuthorized: true,
    }),
    {
      adapterRegistered: true,
      hostAvailable: null,
      authenticated: true,
      executionAuthorized: true,
      status: "unknown",
      reasons: ["hostAvailable"],
    },
  );
  assert.equal(
    evaluateAiProfileAvailability({
      adapterRegistered: true,
      hostAvailable: true,
      authenticated: false,
      executionAuthorized: null,
    }).status,
    "unavailable",
  );
});
