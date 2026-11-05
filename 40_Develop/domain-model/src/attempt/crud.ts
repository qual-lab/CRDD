/**
 * 実行資源の観測イベントを同じSnapshot記録へ適用する。
 * @responsibility 資源の識別情報を複製せず、IntentとReceiptを一つの値更新にする。
 * @trace ARCH-000008
 * @boundary 純粋な記録更新だけ。実行・保存・実資源照合は行わない。
 */
import type { CoordinatorResourceBook } from "./types.ts";
import { createHash } from "node:crypto";
import {
  validateCoordinatorResourceBook,
  validateCoordinatorResourceBookTransition,
} from "./validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import { exactRecordKeys, isSha256Hex } from "../state/validation.ts";

/**
 * 初期Snapshotと最初のIntent、又は同じ資源の後続観測を適用する。
 * @responsibility 通知の保存断面だけを扱い、ID欠測や成功から未発行を推測しない。
 * @trace ARCH-000008
 * @input previous: 元資源記録。value: 発行前・Receipt・発見・正式未発行のイベント。
 * @returns 検査済み次値、又はnull。nullは更新拒否であり不存在ではない。
 * @effect N/A: 値変換だけ。
 */
export function applyCoordinatorResourceEvent(
  previous: CoordinatorResourceBook | null,
  value: unknown,
): CoordinatorResourceBook | null {
  try {
    const event = JSON.parse(encodeRuntimeStateValue(value));
    if (
      !validateCoordinatorResourceBook(previous) ||
      typeof event.key !== "string" ||
      !["submission", "receipt", "identified", "not_issued"].includes(
        event.event,
      ) ||
      !exactRecordKeys(
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
    let checkpoint: CoordinatorResourceBook["checkpoints"][number];
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
    return validateCoordinatorResourceBook(book) &&
      validateCoordinatorResourceBookTransition(previous, book)
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
export function applyCoordinatorResourceCleanup(
  previous: CoordinatorResourceBook,
  snapshotValue: unknown,
  observationsValue: unknown,
  evidence: Readonly<{ recoveryId: string; previousPayloadSha256: string }>,
): CoordinatorResourceBook | null {
  try {
    const snapshot = JSON.parse(
      encodeRuntimeStateValue(snapshotValue),
    ) as CoordinatorResourceBook["snapshot"];
    const observations = JSON.parse(encodeRuntimeStateValue(observationsValue));
    if (
      !validateCoordinatorResourceBook(previous) ||
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
        !exactRecordKeys(observed, ["key", "observation"]) ||
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
                    encodeRuntimeStateValue({
                      ...evidence,
                      observation: observed,
                    }),
                  )
                  .digest("hex")
            : null,
      };
    });
    const book = { ...previous, snapshot, checkpoints };
    return validateCoordinatorResourceBook(book) &&
      validateCoordinatorResourceBookTransition(previous, book)
      ? book
      : null;
  } catch {
    return null;
  }
}
