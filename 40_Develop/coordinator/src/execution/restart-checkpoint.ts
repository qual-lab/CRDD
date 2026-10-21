/**
 * 単一再起動要求の保存値と遷移を検査する。
 * @packageDocumentation
 * @responsibility 要求相関、結果と回収の交差制約を純粋な値契約として所有する。
 * @trace ARCH-000008
 * @boundary 保存モデルだけ。Host操作・許可・実資源観測を所有しない。
 */
import { createHash } from "node:crypto";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";

/**
 * 一操作に一度だけ結合する再起動要求の現在値。
 * @responsibility 未発行・受付・完了、清掃不要と清掃結果を分ける。
 * @trace ARCH-000008
 * @shape 固定要求ID、Scope Hash、要求状態、回収状態、一次確定結果。
 * @invariant 結果・ID・Scopeを置換せず、過去unknownを成功へ推定しない。
 * @boundary Repository-local現在状態。
 * @security Hashと保存状態は操作Authorityを発行しない。
 * @compatibility 最新構造だけ。旧phaseと署名chainは受理しない。
 */
export type DockerRestartCheckpoint = Readonly<{
  requestId: string;
  scopeSha256: string;
  request: "not_issued" | "unknown" | "issued" | "confirmed";
  cleanup: "not_required" | "pending" | "confirmed" | "unknown";
  result: Readonly<{
    status: "completed" | "blocked";
    reason: string;
    request: "not_issued" | "unknown" | "issued" | "confirmed";
    effectOutcomeUnknown: boolean;
  }> | null;
}>;

/**
 * 元操作と採用Scopeから再起動要求の相関Hashを再計算する。
 * @responsibility 任意64hexを同じ要求の根拠として受理しない。
 * @trace ARCH-000008
 * @input repositoryBinding、identitySha256、recoveryId、scopeSha256: 固定非秘密相関。
 * @returns 固定envelopeのSHA-256、または不正結合のnull。
 * @precondition Scopeは現在Ownerが確認した対象と既存fenceに結合する。
 * @postcondition exact回復IDの元内容Hashと一致する場合だけ相関値を返す。
 * @effect N/A: Hash計算だけ。
 * @failure 不正Hash・別Identity・不正回復参照はnull。
 * @invariant Hashは現在許可・排他・実結果の証明ではない。
 * @boundary 保存相関値の生成。
 * @security 秘密値・Path・Promptをenvelopeへ追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function createDockerRestartRequestId(
  repositoryBinding: unknown,
  identitySha256: unknown,
  recoveryId: unknown,
  scopeSha256: unknown,
): string | null {
  const recovery = parseDockerTaskRecoveryId(recoveryId);
  if (
    !isSha256Hex(repositoryBinding) ||
    !isSha256Hex(identitySha256) ||
    !isSha256Hex(scopeSha256) ||
    !recovery ||
    recovery.baseHash !== identitySha256
  )
    return null;
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

/**
 * この保存モデルが受け取るSHA-256文字列を検査する。
 * @responsibility 一般Helperを公開せず、保存値の固定文法だけを検査する。
 * @trace ARCH-000008
 * @input value: 未信頼値。
 * @returns 小文字64桁hexの場合だけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態や外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 再起動要求相関の値検査だけ。
 * @security Hash文法の一致から処置許可や真正性を推定しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * 再起動checkpointの閉じた許容組合せを復号する。
 * @responsibility 未評価field・hostile値・偽の完了を拒否する。
 * @trace ARCH-000008
 * @input value: 未信頼の保存候補。
 * @returns 所有する固定Snapshot、またはnull。
 * @precondition N/A: 任意値を受け取り安全に拒否する。
 * @postcondition completedは要求と回収の両confirmedの場合だけ返す。
 * @effect N/A: 値の観測だけ。
 * @failure 欠落・余剰・accessor・Proxy・不正組合せはnull。
 * @invariant cleanup不要と確認を区別する。
 * @boundary 未信頼値と保存モデル。
 * @security getterやProxyの処理を実行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function decodeDockerRestartCheckpoint(
  value: unknown,
): DockerRestartCheckpoint | null {
  const record = snapshotPlainRecord(
    value,
    new Set(["requestId", "scopeSha256", "request", "cleanup", "result"]),
  );
  if (
    !record ||
    !isSha256Hex(record.requestId) ||
    !isSha256Hex(record.scopeSha256) ||
    !["not_issued", "unknown", "issued", "confirmed"].includes(
      record.request as string,
    ) ||
    !["not_required", "pending", "confirmed", "unknown"].includes(
      record.cleanup as string,
    )
  )
    return null;
  const result =
    record.result === null
      ? null
      : snapshotPlainRecord(
          record.result,
          new Set(["status", "reason", "request", "effectOutcomeUnknown"]),
        );
  if (
    record.result !== null &&
    (!result ||
      !["completed", "blocked"].includes(result.status as string) ||
      !["not_issued", "unknown", "issued", "confirmed"].includes(
        result.request as string,
      ) ||
      typeof result.effectOutcomeUnknown !== "boolean" ||
      typeof result.reason !== "string" ||
      !/^[a-z][a-z0-9_]{0,159}$/u.test(result.reason))
  )
    return null;
  if (
    (record.request === "not_issued") !== (record.cleanup === "not_required") ||
    (result?.status === "completed" &&
      (record.request !== "confirmed" ||
        record.cleanup !== "confirmed" ||
        result.request !== "confirmed" ||
        result.effectOutcomeUnknown !== false)) ||
    (result?.request === "not_issued" &&
      ["issued", "confirmed"].includes(record.request as string)) ||
    (record.request === "not_issued" &&
      result !== null &&
      (result.request !== "not_issued" ||
        result.effectOutcomeUnknown !== false)) ||
    (record.cleanup === "unknown" && result?.status !== "blocked")
  )
    return null;
  return Object.freeze({
    requestId: record.requestId,
    scopeSha256: record.scopeSha256,
    request: record.request,
    cleanup: record.cleanup,
    result: result ? Object.freeze({ ...result }) : null,
  }) as DockerRestartCheckpoint;
}

/**
 * 一度だけの要求と単調な結果・回収更新を検査する。
 * @responsibility 要求置換、terminal書換え、未知値の未発行化を拒否する。
 * @trace ARCH-000008
 * @input beforeValue、afterValue: 元版と次版の単一checkpoint。
 * @returns 許可された構造的な遷移だけtrue。
 * @precondition 同じOwnerの受付観測とfresh権限は保存利用側が別に確認する。
 * @postcondition blocked後は結果不変で回収だけ進行できる。
 * @effect N/A: 値の比較だけ。
 * @failure 不正構造・別要求・逆行・二度目の要求はfalse。
 * @invariant trueは再発行許可、回収実証やWriter成功ではない。
 * @boundary 元保存値と次版候補。
 * @security 保存から生Ownerを復元しない。
 * @concurrency N/A: 元版照合と排他はWriterが所有する。
 */
export function validateDockerRestartCheckpointTransition(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  if (beforeValue === null && afterValue === null) return true;
  const after = decodeDockerRestartCheckpoint(afterValue);
  if (!after) return false;
  if (beforeValue === null)
    return (
      after.request === "not_issued" &&
      after.cleanup === "not_required" &&
      after.result === null
    );
  const before = decodeDockerRestartCheckpoint(beforeValue);
  if (
    !before ||
    before.requestId !== after.requestId ||
    before.scopeSha256 !== after.scopeSha256 ||
    (before.result !== null &&
      (after.result?.status !== before.result.status ||
        after.result.reason !== before.result.reason ||
        after.result.request !== before.result.request ||
        after.result.effectOutcomeUnknown !==
          before.result.effectOutcomeUnknown ||
        after.request !== before.request))
  )
    return false;
  if (
    before.request !== after.request &&
    ![
      "not_issued:unknown",
      "unknown:issued",
      "unknown:confirmed",
      "issued:confirmed",
    ].includes(`${before.request}:${after.request}`)
  )
    return false;
  return (
    before.cleanup === after.cleanup ||
    ["not_required:pending", "pending:confirmed", "pending:unknown"].includes(
      `${before.cleanup}:${after.cleanup}`,
    )
  );
}

/**
 * 再起動の残存義務がTaskの終了を妨げるかを同じ条件で判定する。
 * @responsibility 履歴Readerと終端Writerの許容形を一つの純粋判定に固定する。
 * @trace ARCH-000008
 * @input value: 未信頼の再起動checkpointまたは記録なしのnull。
 * @returns 記録なし、未要求、確定再起動、確定未発行、発行済み既知失敗の終了形だけtrue。
 * @precondition 実Owner・資源・排他・Host不存在は利用側が別に確認する。
 * @postcondition blockedを再起動成功やTask成功へ変換しない。
 * @effect N/A: 値の復号と比較だけ。
 * @failure 欠測・旧形式・矛盾・Effect不明・回収不明はfalse。
 * @invariant 上位unknownをnot_issuedへ巻き戻さず、再要求を許可しない。
 * @boundary 保存モデルと終端利用側。
 * @security 保存値だけから処置Authorityを発行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function isDockerRestartCheckpointSettled(value: unknown): boolean {
  if (value === null) return true;
  const checkpoint = decodeDockerRestartCheckpoint(value);
  if (!checkpoint) return false;
  if (
    checkpoint.request === "not_issued" &&
    checkpoint.cleanup === "not_required" &&
    checkpoint.result === null
  )
    return true;
  if (
    checkpoint.cleanup !== "confirmed" ||
    checkpoint.result === null ||
    checkpoint.result.effectOutcomeUnknown !== false
  )
    return false;
  return (
    (checkpoint.request === "confirmed" &&
      checkpoint.result.request === "confirmed") ||
    (checkpoint.request === "unknown" &&
      checkpoint.result.status === "blocked" &&
      checkpoint.result.request === "not_issued") ||
    (checkpoint.request === "issued" &&
      checkpoint.result.status === "blocked" &&
      checkpoint.result.request === "issued")
  );
}
