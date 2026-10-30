/**
 * Codexの非秘密実行観測を閉じた値として検査する。
 * @packageDocumentation
 * @responsibility Provider固有の観測field・数値・旧診断読取りを所有し、実行許可や清掃成立を判断しない。
 * @trace ARCH-000015
 * @boundary Provider観測と上位の診断・公開投影。本文・Path・Commandは受理しない。
 */
import { snapshotPlainRecord } from "../provider/input.ts";

/** error本文の語句観測。相互排他の原因分類ではない。 */
const ITEM_ERROR_MENTION_KEYS = [
  "itemErrorHostMentionCount",
  "itemErrorSpawnMentionCount",
  "itemErrorProtocolMentionCount",
  "itemErrorConnectionMentionCount",
  "itemErrorToolMentionCount",
  "itemErrorPermissionMentionCount",
  "itemErrorMissingPathMentionCount",
  "itemErrorTimeoutMentionCount",
  "itemErrorUnclassifiedCount",
] as const;

/** Provider実行観測の閉じた診断項目。実行許可・清掃判定には使用しない。 */
const OBSERVATION_KEYS = new Set([
  "transport",
  "turnCompleted",
  "itemErrorCount",
  "itemErrorCodeModeCount",
  "itemErrorKnownWarningTextCount",
  ...ITEM_ERROR_MENTION_KEYS,
  "commandExecutionStartedCount",
  "commandExecutionCompletedCount",
  "commandExecutionFailedCount",
  "commandExecutionDeclinedCount",
  "commandExecutionExitCode0Count",
  "commandExecutionExitCode1Count",
  "commandExecutionExitCode126Count",
  "commandExecutionExitCode127Count",
  "commandExecutionOtherNonzeroExitCodeCount",
  "commandExecutionMissingExitCodeCount",
  "commandFamilyPythonCount",
  "commandFamilyPosixTextCount",
  "commandFamilyGitCount",
  "commandFamilyApplyPatchCount",
  "commandFailurePermissionCount",
  "commandFailureReadOnlyFilesystemCount",
  "commandFailureMissingPathCount",
  "commandFailureCommandNotFoundCount",
  "commandFailureSyntaxCount",
  "commandFailureSandboxCount",
  "commandFailureUnclassifiedCount",
  "fileChangeStartedCount",
  "fileChangeCompletedCount",
  "fileChangeFailedCount",
  "fileChangeDeclinedCount",
  "rawEventReported",
  "commandReported",
  "pathReported",
  "providerTextReported",
]);

/** 既存の非秘密実行観測を閉じた値へ検査する。生Command・Path・本文は受理しない。
 * @responsibility 実行診断の固定field・数値境界を公開結果と受動診断で共用する。
 * @trace ERB-IT-021
 */
export function inspectCodexExecutionObservation(raw: unknown) {
  const withoutWarningText = new Set(
    [...OBSERVATION_KEYS].filter(
      (key) => key !== "itemErrorKnownWarningTextCount",
    ),
  );
  const withoutMentions = new Set(
    [...withoutWarningText].filter(
      (key) => !(ITEM_ERROR_MENTION_KEYS as readonly string[]).includes(key),
    ),
  );
  const observation =
    snapshotPlainRecord(raw, OBSERVATION_KEYS) ??
    snapshotPlainRecord(raw, withoutWarningText) ??
    snapshotPlainRecord(raw, withoutMentions) ??
    snapshotPlainRecord(
      raw,
      new Set(
        [...withoutMentions].filter(
          (key) => key !== "itemErrorCount" && key !== "itemErrorCodeModeCount",
        ),
      ),
    );
  if (!observation) return null;
  const hasErrorCounts =
    Object.hasOwn(observation, "itemErrorCount") ||
    Object.hasOwn(observation, "itemErrorCodeModeCount");
  if (
    (observation.transport === "fixed_cli_jsonl_v0_164_0" || hasErrorCounts) &&
    (!Number.isSafeInteger(observation.itemErrorCount) ||
      !Number.isSafeInteger(observation.itemErrorCodeModeCount) ||
      (observation.itemErrorCodeModeCount as number) < 0 ||
      (observation.itemErrorCount as number) > 4096 ||
      (observation.itemErrorCodeModeCount as number) >
        (observation.itemErrorCount as number))
  )
    return null;
  if (
    Object.hasOwn(observation, "itemErrorKnownWarningTextCount") &&
    (!Number.isSafeInteger(observation.itemErrorKnownWarningTextCount) ||
      (observation.itemErrorKnownWarningTextCount as number) < 0 ||
      (observation.itemErrorKnownWarningTextCount as number) >
        (observation.itemErrorCount as number))
  )
    return null;
  // 旧観測の欠測は補完しない。新fieldは全件・有限・総数以下だけを受理する。
  if (
    ITEM_ERROR_MENTION_KEYS.some((key) => Object.hasOwn(observation, key)) &&
    !ITEM_ERROR_MENTION_KEYS.every(
      (key) =>
        Number.isSafeInteger(observation[key]) &&
        (observation[key] as number) >= 0 &&
        (observation[key] as number) <= (observation.itemErrorCount as number),
    )
  )
    return null;
  if (Object.hasOwn(observation, "itemErrorUnclassifiedCount")) {
    const classified =
      (observation.itemErrorCount as number) -
      (observation.itemErrorUnclassifiedCount as number);
    const mentions = ITEM_ERROR_MENTION_KEYS.filter(
      (key) => key !== "itemErrorUnclassifiedCount",
    ).map((key) => observation[key] as number);
    if (
      mentions.some((count) => count > classified) ||
      mentions.reduce((sum, count) => sum + count, 0) < classified
    )
      return null;
  }
  const countKeys = [
    "commandExecutionStartedCount",
    "commandExecutionCompletedCount",
    "commandExecutionFailedCount",
    "commandExecutionDeclinedCount",
    "commandExecutionExitCode0Count",
    "commandExecutionExitCode1Count",
    "commandExecutionExitCode126Count",
    "commandExecutionExitCode127Count",
    "commandExecutionOtherNonzeroExitCodeCount",
    "commandExecutionMissingExitCodeCount",
    "commandFamilyPythonCount",
    "commandFamilyPosixTextCount",
    "commandFamilyGitCount",
    "commandFamilyApplyPatchCount",
    "commandFailurePermissionCount",
    "commandFailureReadOnlyFilesystemCount",
    "commandFailureMissingPathCount",
    "commandFailureCommandNotFoundCount",
    "commandFailureSyntaxCount",
    "commandFailureSandboxCount",
    "commandFailureUnclassifiedCount",
    "fileChangeStartedCount",
    "fileChangeCompletedCount",
    "fileChangeFailedCount",
    "fileChangeDeclinedCount",
  ] as const;
  if (
    !["fixed_cli_jsonl_v0_149_1", "fixed_cli_jsonl_v0_164_0"].includes(
      observation.transport as string,
    ) ||
    observation.turnCompleted !== true ||
    !countKeys.every(
      (key) =>
        Number.isSafeInteger(observation[key]) &&
        (observation[key] as number) >= 0,
    ) ||
    observation.rawEventReported !== false ||
    observation.commandReported !== false ||
    observation.pathReported !== false ||
    observation.providerTextReported !== false
  )
    return null;
  return Object.freeze({ ...observation });
}
