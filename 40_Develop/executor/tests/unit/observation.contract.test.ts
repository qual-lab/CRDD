/**
 * 私有の通知・終端Mapの交差利用を反証する。
 * @packageDocumentation
 * @responsibility 元objectとOwner相関、同期通知の失効を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level UT
 * @scope Process内の模擬Ownerのみ。
 * @boundary Executor観測Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createProviderObservationOwner } from "../../src/attempt/observation.ts";
const unrelated = createProviderObservationOwner();
const verifyRuntimeOwnedDockerProviderSubmissionNotice = (
  notice: unknown,
  recovery: unknown,
  owner: unknown,
  operationId: unknown,
  recoveryId: unknown,
) =>
  unrelated.verifyUnissuedNotice(
    notice,
    recovery,
    owner,
    "start_provider_attached",
    operationId,
    recoveryId,
    "provider_submission",
  );
const borrowRuntimeOwnedDockerTerminalObservations =
  unrelated.borrowTerminalObservations;
/**
 * 観測Ownerの交差と元object・通知寿命を反証する。
 * @responsibility Ownerと元objectの相関を検査する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @precondition 別Ownerとは別の候補Owner二つを生成する。
 * @stimulus 元通知の登録・照合・失効と終端結果の借用を行う。
 * @observation 元object、コピー、別Ownerと別OwnerReaderの返値。
 * @oracle 同じOwnerの元objectだけを受理し、失効後は拒否する。
 * @cleanup N/A: 外部資源なし。局所Ownerは試験後に到達不能となる。
 * @boundary ERB-IT-002=Adjacent 1 Block: 候補Controller→観測Owner→別OwnerReader
 */
test("観測Ownerは候補間・別Owner間の流用と失効後の通知を拒否する", () => {
  const first = createProviderObservationOwner();
  const second = createProviderObservationOwner();
  const owner = Object.freeze({});
  const recovery = Object.freeze({});
  const notice = Object.freeze({});
  const result = Object.freeze({});
  const args = [
    notice,
    recovery,
    owner,
    "start_provider_attached",
    "op",
    "recovery",
    "provider_submission",
  ] as const;
  first.registerSubmission(
    notice,
    Object.freeze({
      recoveryCapability: recovery,
      managementCapability: owner,
      purpose: "start_provider_attached",
      operationId: "op",
      recoveryId: "recovery",
      kind: "provider_submission",
    }),
  );
  assert.equal(first.verifyUnissuedNotice(...args), true);
  assert.equal(second.verifyUnissuedNotice(...args), false);
  assert.equal(
    first.verifyUnissuedNotice(
      { ...notice },
      recovery,
      owner,
      "start_provider_attached",
      "op",
      "recovery",
      "provider_submission",
    ),
    false,
  );
  assert.equal(
    verifyRuntimeOwnedDockerProviderSubmissionNotice(
      notice,
      recovery,
      owner,
      "op",
      "recovery",
    ),
    false,
  );
  first.revokeSubmission(notice);
  assert.equal(first.verifyUnissuedNotice(...args), false);
  first.registerTerminal(
    result,
    Object.freeze({
      managementCapability: owner,
      operationId: "op",
      recoveryId: "recovery",
      resources: [],
      primaryFailure: null,
      mountLeaseReleased: true,
      recoveryCompleted: true,
      homeLeaseReleased: true,
    }),
  );
  assert.ok(first.borrowTerminalObservations(result, owner, "op", "recovery"));
  assert.equal(
    second.borrowTerminalObservations(result, owner, "op", "recovery"),
    null,
  );
  assert.equal(
    first.borrowTerminalObservations({ ...result }, owner, "op", "recovery"),
    null,
  );
  assert.equal(
    borrowRuntimeOwnedDockerTerminalObservations(
      result,
      owner,
      "op",
      "recovery",
    ),
    null,
  );
});
