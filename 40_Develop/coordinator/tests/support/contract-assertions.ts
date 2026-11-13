/**
 * CandidateとRecordの固定契約をassertionとして提供する。
 *
 * @packageDocumentation
 * @responsibility 値の存在・構造・正規化・拒否理由を判定し、利用側試験の期待条件を共有する。
 * @trace AIT-IT-013
 * @trace AIT-UT-005
 * @trace AIT-UT-011
 * @trace CQS-UT-010
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace PPR-UT-006
 * @trace PRL-IT-012
 * @trace PRL-UT-006
 * @trace RFD-IT-001
 * @trace RFD-UT-006
 * @level IT
 * @level UT
 * @scope Candidate・Record・JSONの契約assertion
 * @boundary N/A: 渡された値を同期判定するだけで、外部資源・Authorityを発行しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export type MutableRecord = Record<PropertyKey, unknown>;

/**
 * 既知の試験入力から再起動要求IDの期待値を構築する。
 * @responsibility 固定Envelopeの期待値を生成し、製品の入力検査やReaderを代替しない。
 * @trace PRL-UT-006、ERB-IT-014
 * @precondition 呼出し側が有効な固定非秘密文字列を構成済み。
 * @stimulus 同じ四相関値から期待Hashを作る。
 * @observation 返る64hex文字列。
 * @oracle 固定Envelopeのfield・順序・値を保持する。
 * @cleanup N/A: 値だけ。
 * @boundary 試験データだけ。Authority・保存・外部Effectは生成しない。
 */
export function restartRequestIdFixture(
  repositoryBinding: string,
  identitySha256: string,
  recoveryId: string,
  scopeSha256: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: "crdd-coordinator/docker-restart-request/v1",
        purpose: "docker_restart",
        repositoryBinding,
        identitySha256,
        recoveryId,
        scopeSha256,
      }),
      "utf8",
    )
    .digest("hex");
}

export function assertPresent<T>(
  value: T,
  message = "expected a present value",
): asserts value is NonNullable<T> {
  assert.notEqual(value, null, message);
  assert.notEqual(value, undefined, message);
}

export function assertRecord(
  value: unknown,
  message = "expected a record",
): asserts value is MutableRecord {
  assert.equal(value !== null && typeof value === "object", true, message);
  assert.equal(Array.isArray(value), false, message);
}

export function assertCanonicalCandidate(
  value: unknown,
): asserts value is Readonly<{
  status: "candidate";
  reason: string;
  canonicalBytes: Buffer;
  canonicalHash: string;
}> {
  assertRecord(value);
  assert.equal(Reflect.get(value, "status"), "candidate");
  assert.equal(typeof Reflect.get(value, "reason"), "string");
  assert.equal(Buffer.isBuffer(Reflect.get(value, "canonicalBytes")), true);
  assert.match(String(Reflect.get(value, "canonicalHash")), /^[a-f0-9]{64}$/u);
}

export function assertDomainMessageCandidate(
  value: unknown,
): asserts value is Readonly<{
  status: "candidate";
  reason: string;
  message: Buffer;
}> {
  assertRecord(value);
  assert.equal(Reflect.get(value, "status"), "candidate");
  assert.equal(Buffer.isBuffer(Reflect.get(value, "message")), true);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(Reflect.get(value, key))}`,
      )
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("fixture value is not JSON serializable");
  }
  return encoded;
}

export function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
}
