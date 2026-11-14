/**
 * 資源記録のイベント適用と遷移検査を純粋な値操作として所有する。
 * @responsibility Intent・Receipt・観測の相関を検証し、保存や実資源操作を行わない。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
  snapshotStateRecord,
} from "../state/operations.ts";
import type { OperationResources } from "./types.ts";

/**
 * 初期Snapshotと最初のIntent、又は同じ資源の後続観測を適用する。
 * @responsibility 通知の保存断面だけを扱い、ID欠測や成功から未発行を推測しない。
 * @trace ARCH-000008
 * @input previous: 元資源記録。value: 発行前・Receipt・発見・正式未発行のイベント。
 * @returns 検査済み次値、又はnull。nullは更新拒否であり不存在ではない。
 * @effect N/A: 値変換だけ。
 */
export function applyResourceEvent(
  previous: OperationResources | null,
  value: unknown,
): OperationResources | null {
  try {
    const event = JSON.parse(encodeStateValue(value));
    if (
      !validateResourceBook(previous) ||
      typeof event.key !== "string" ||
      !["submission", "receipt", "identified", "not_issued"].includes(
        event.event,
      ) ||
      !hasExecutionStateRecordKeys(
        event,
        event.event === "not_issued"
          ? ["event", "key"]
          : ["event", "key", "snapshot", "cleanup"],
      )
    )
      return null;
    if (!previous && event.event !== "submission") return null;
    const snapshot =
      event.event === "not_issued" ? previous?.snapshot : event.snapshot;
    const cleanup =
      event.event === "not_issued" ? previous?.cleanup : event.cleanup;
    if (!snapshot || !Array.isArray(snapshot.resources)) return null;
    const checkpoints =
      previous?.checkpoints ??
      snapshot.resources.map((item: { key: string }) => ({
        key: item.key,
        submission: "none",
        receiptSource: null,
        observation: "unobserved",
        absenceEvidenceSha256: null,
      }));
    const prior = checkpoints.find(
      (item: { key: string }) => item.key === event.key,
    );
    const resource = snapshot.resources.find(
      (item: { key: string }) => item.key === event.key,
    );
    if (!prior || !resource) return null;
    let checkpoint: OperationResources["checkpoints"][number];
    if (event.event === "submission") {
      if (prior.submission !== "none" || resource.identity.dockerId !== null)
        return null;
      checkpoint = { ...prior, submission: "intent_saved" };
    } else if (event.event === "not_issued") {
      if (
        prior.submission !== "intent_saved" ||
        resource.identity.dockerId !== null ||
        resource.request !== "not_issued"
      )
        return null;
      checkpoint = { ...prior, submission: "not_issued" };
    } else {
      if (
        prior.submission !== "intent_saved" ||
        !isSha256Hex(resource.identity.dockerId)
      )
        return null;
      checkpoint = {
        ...prior,
        receiptSource:
          event.event === "receipt"
            ? "docker_create_result"
            : "runtime_reconciliation",
        observation:
          event.event === "identified" ? "present" : prior.observation,
        absenceEvidenceSha256: null,
      };
    }
    const book = {
      snapshot,
      cleanup,
      checkpoints: checkpoints.map((item: { key: string }) =>
        item.key === event.key ? checkpoint : item,
      ),
    };
    return validateResourceBook(book) &&
      validateResourceBookTransition(previous, book)
      ? book
      : null;
  } catch {
    return null;
  }
}

/**
 * 元Snapshotとkey別の終了観測を同じ記録へ結合する。
 * @responsibility 観測の相関だけを保存値にし、物理的不存在の観測を実行しない。
 * @trace ARCH-000008
 * @input previous: 元記録。snapshotValue・observationsValue: 同じ技術Ownerの元結果。evidence: 元版と回復参照。
 * @returns 次の資源記録、又は相関不成立のnull。
 * @effect N/A: 値と相関Hashの構築だけ。
 * @invariant IDの差替えを拒否するが現在構成の更新は許可する。
 */
export function applyResourceCleanup(
  previous: OperationResources,
  snapshotValue: unknown,
  observationsValue: unknown,
  evidence: Readonly<{ recoveryId: string; previousPayloadSha256: string }>,
): OperationResources | null {
  try {
    const snapshot = JSON.parse(
      encodeStateValue(snapshotValue),
    ) as OperationResources["snapshot"];
    const observations = JSON.parse(encodeStateValue(observationsValue));
    if (
      !validateResourceBook(previous) ||
      !snapshot ||
      !Array.isArray(snapshot.resources) ||
      !Array.isArray(observations) ||
      observations.length !== previous.checkpoints.length ||
      new Set(observations.map((item: { key: unknown }) => item.key)).size !==
        previous.checkpoints.length
    )
      return null;
    const checkpoints = previous.checkpoints.map((checkpoint) => {
      const observed = observations.find(
        (item: { key: unknown }) => item.key === checkpoint.key,
      );
      const resource = snapshot.resources.find(
        (item) => item.key === checkpoint.key,
      );
      if (
        !hasExecutionStateRecordKeys(observed, ["key", "observation"]) ||
        !resource ||
        !["not_requested", "absent", "unknown"].includes(observed.observation)
      )
        throw Error("resource_observation_invalid");
      const original = previous.snapshot.resources.find(
        (item) => item.key === checkpoint.key,
      );
      if (
        !original ||
        original.identity.dockerId !== resource.identity.dockerId
      )
        throw Error("resource_receipt_required");
      if (observed.observation === "not_requested") {
        if (
          resource.identity.dockerId !== null ||
          resource.request !== "not_issued" ||
          checkpoint.submission === "intent_saved"
        )
          throw Error("resource_observation_invalid");
        return checkpoint;
      }
      if (checkpoint.submission !== "intent_saved")
        throw Error("resource_observation_invalid");
      return {
        ...checkpoint,
        receiptSource: checkpoint.receiptSource,
        observation: observed.observation,
        absenceEvidenceSha256:
          observed.observation === "absent"
            ? checkpoint.observation === "absent" &&
              checkpoint.absenceEvidenceSha256 !== null
              ? checkpoint.absenceEvidenceSha256
              : createHash("sha256")
                  .update(
                    encodeStateValue({
                      ...evidence,
                      observation: observed,
                    }),
                  )
                  .digest("hex")
            : null,
      };
    });
    const book = { ...previous, snapshot, checkpoints };
    return validateResourceBook(book) &&
      validateResourceBookTransition(previous, book)
      ? book
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存された資源集合の形と相関を確認する。実在や削除許可は判定しない。
 * @responsibility Identityの重複を作らず、非秘密Snapshotとkey別checkpointを結合する。
 * @trace ARCH-000008
 * @effect N/A: JSON値の純粋検査だけ。
 * @failure 旧配列形式、欠測・重複key、秘密値を含み得る未正規化fieldは拒否する。
 */
export function validateResourceBook(
  value: unknown,
  comparison?: Readonly<{ before: unknown }>,
): value is OperationResources | null {
  if (comparison !== undefined) {
    const captured = snapshotStateRecord(comparison, new Set(["before"]));
    return (
      captured !== null &&
      Object.hasOwn(captured, "before") &&
      validateResourceBook(captured.before) &&
      validateResourceBookTransition(
        captured.before,
        value as OperationResources | null,
      )
    );
  }
  if (value === null) return true;
  if (
    !hasExecutionStateRecordKeys(value, ["snapshot", "checkpoints", "cleanup"])
  )
    return false;
  const book = value as OperationResources;
  if (
    !hasExecutionStateRecordKeys(book.snapshot, ["resources"]) ||
    !Array.isArray(book.snapshot.resources) ||
    !Array.isArray(book.checkpoints) ||
    book.snapshot.resources.length === 0 ||
    book.snapshot.resources.length !== book.checkpoints.length ||
    !hasExecutionStateRecordKeys(book.cleanup, [
      "cleanupOrder",
      "setupTimeoutMs",
      "unreceiptedAbsence",
      "verifyLabelAbsence",
    ]) ||
    !Array.isArray(book.cleanup.cleanupOrder) ||
    !Number.isSafeInteger(book.cleanup.setupTimeoutMs) ||
    book.cleanup.setupTimeoutMs <= 0 ||
    !["retain", "observe"].includes(book.cleanup.unreceiptedAbsence) ||
    typeof book.cleanup.verifyLabelAbsence !== "boolean"
  )
    return false;
  const keys = new Set<string>();
  const resourceNames = new Set<string>();
  for (const resource of book.snapshot.resources) {
    if (
      !hasExecutionStateRecordKeys(resource, [
        "key",
        "identity",
        "request",
        "configuration",
      ]) ||
      typeof resource.key !== "string" ||
      resource.key.length === 0 ||
      keys.has(resource.key) ||
      !hasExecutionStateRecordKeys(resource.identity, [
        "kind",
        "dockerId",
        "name",
        "ownershipLabel",
      ]) ||
      !["container", "network"].includes(resource.identity.kind) ||
      (resource.identity.dockerId !== null &&
        !isSha256Hex(resource.identity.dockerId)) ||
      typeof resource.identity.name !== "string" ||
      !resource.identity.name ||
      typeof resource.identity.ownershipLabel !== "string" ||
      !resource.identity.ownershipLabel ||
      !["not_issued", "issued", "unknown"].includes(resource.request) ||
      (resource.request === "issued" && resource.identity.dockerId === null) ||
      (resource.request === "not_issued" &&
        resource.identity.dockerId !== null) ||
      !hasExecutionStateRecordKeys(resource.configuration, [
        "image",
        "command",
        "environmentNames",
        "mounts",
        "networks",
        "internal",
      ])
    )
      return false;
    const resourceName = `${resource.identity.kind}\0${resource.identity.name}`;
    if (resourceNames.has(resourceName)) return false;
    resourceNames.add(resourceName);
    keys.add(resource.key);
    const c = resource.configuration;
    if (
      (c.image !== null && typeof c.image !== "string") ||
      (c.command !== null &&
        (!Array.isArray(c.command) ||
          c.command.some((v: unknown) => v !== "<redacted>"))) ||
      (c.environmentNames !== null &&
        (!Array.isArray(c.environmentNames) ||
          c.environmentNames.some(
            (v: unknown) =>
              typeof v !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(v),
          ))) ||
      (c.networks !== null &&
        (!Array.isArray(c.networks) ||
          c.networks.some((v: unknown) => typeof v !== "string"))) ||
      (c.internal !== null && typeof c.internal !== "boolean") ||
      (c.mounts !== null &&
        (!Array.isArray(c.mounts) ||
          c.mounts.some(
            (v: unknown) =>
              !hasExecutionStateRecordKeys(v, [
                "source",
                "target",
                "readOnly",
              ]) ||
              typeof (v as { source: unknown }).source !== "string" ||
              typeof (v as { target: unknown }).target !== "string" ||
              typeof (v as { readOnly: unknown }).readOnly !== "boolean",
          )))
    )
      return false;
  }
  const checkpointKeys = new Set<string>();
  for (const checkpoint of book.checkpoints) {
    if (
      !hasExecutionStateRecordKeys(checkpoint, [
        "key",
        "submission",
        "receiptSource",
        "observation",
        "absenceEvidenceSha256",
      ]) ||
      !keys.has(checkpoint.key) ||
      checkpointKeys.has(checkpoint.key) ||
      !["none", "intent_saved", "not_issued"].includes(checkpoint.submission) ||
      (checkpoint.receiptSource !== null &&
        !["docker_create_result", "runtime_reconciliation"].includes(
          checkpoint.receiptSource,
        )) ||
      !["unobserved", "present", "absent", "unknown"].includes(
        checkpoint.observation,
      ) ||
      (checkpoint.absenceEvidenceSha256 !== null &&
        !isSha256Hex(checkpoint.absenceEvidenceSha256))
    )
      return false;
    checkpointKeys.add(checkpoint.key);
    const resource = book.snapshot.resources.find(
      (r) => r.key === checkpoint.key,
    );
    if (
      !resource ||
      (checkpoint.receiptSource !== null &&
        resource.identity.dockerId === null) ||
      (resource.identity.dockerId !== null &&
        checkpoint.receiptSource === null) ||
      (checkpoint.submission !== "intent_saved" &&
        (resource.request !== "not_issued" ||
          resource.identity.dockerId !== null ||
          checkpoint.observation !== "unobserved" ||
          checkpoint.absenceEvidenceSha256 !== null)) ||
      (checkpoint.observation === "absent") !==
        (checkpoint.absenceEvidenceSha256 !== null)
    )
      return false;
  }
  return (
    book.cleanup.cleanupOrder.length === keys.size &&
    new Set(book.cleanup.cleanupOrder).size === keys.size &&
    book.cleanup.cleanupOrder.every((key) => keys.has(key))
  );
}

/**
 * 元資源の識別情報と既知IDを保持したまま観測を更新する。
 * @responsibility 初回Intentの原子確定と既知事実の巻戻し拒否を所有する。
 * @trace ARCH-000008
 * @effect N/A: 値の比較だけ。構成差を回収拒否へ転化しない。
 */
export function validateResourceBookTransition(
  before: OperationResources | null,
  after: OperationResources | null,
): boolean {
  if (!validateResourceBook(after)) return false;
  if (before === null)
    return (
      after === null ||
      (after.checkpoints.filter((c) => c.submission === "intent_saved")
        .length === 1 &&
        after.checkpoints.every(
          (c) =>
            c.submission !== "not_issued" &&
            c.receiptSource === null &&
            c.observation === "unobserved",
        ) &&
        after.snapshot.resources.every((r) => r.identity.dockerId === null))
    );
  if (
    after === null ||
    encodeStateValue(before.cleanup) !== encodeStateValue(after.cleanup) ||
    before.snapshot.resources.length !== after.snapshot.resources.length
  )
    return false;
  for (const resource of after.snapshot.resources) {
    const previous = before.snapshot.resources.find(
      (r) => r.key === resource.key,
    );
    const checkpoint = after.checkpoints.find((c) => c.key === resource.key);
    const prior = before.checkpoints.find((c) => c.key === resource.key);
    if (
      !previous ||
      !checkpoint ||
      !prior ||
      resource.identity.kind !== previous.identity.kind ||
      resource.identity.name !== previous.identity.name ||
      resource.identity.ownershipLabel !== previous.identity.ownershipLabel ||
      (previous.identity.dockerId !== null &&
        resource.identity.dockerId !== previous.identity.dockerId) ||
      (prior.receiptSource !== null &&
        checkpoint.receiptSource !== prior.receiptSource) ||
      (prior.submission !== checkpoint.submission &&
        !["none:intent_saved", "intent_saved:not_issued"].includes(
          `${prior.submission}:${checkpoint.submission}`,
        ))
    )
      return false;
  }
  return true;
}
