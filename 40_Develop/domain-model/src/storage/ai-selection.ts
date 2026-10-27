/**
 * Repository別AI選択設定の読取りと条件付き保存を所有する。
 * @responsibility 固定config File、既存Root・排他、容量境界、CASと通常の読戻しを接続する。
 * @trace ARCH-000004
 * @boundary 検証済みRepositoryと新形式AI設定。
 * @effect 明示保存だけが既存config領域を確保し、一時File・正本・短期Lockを更新する。
 * @security 旧Profile・Host設定へfallbackせず、実行Authority・AI・Dockerを開始しない。
 */
import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import {
  createFilesystemStoreRoot,
  ensureRepositoryRuntimeDataArea,
  observeRepositoryRuntimeDataArea,
  readStableBoundedFileSnapshot,
  resolveFilesystemStorePath,
  snapshotPlainRecord,
  withFilesystemStoreLock,
} from "../index.ts";
import { parseUnambiguousJsonDocument } from "../plain-data/json.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import { validateAiSelectionConfig } from "../ai-selection/validation.ts";
import type {
  AiSelectionSnapshot,
  AiSelectionCatalog,
} from "../ai-selection/types.ts";

export const AI_SELECTION_MAXIMUM_BYTES = 1024 * 1024;
const CONFIG_FILE = "ai-selection.json";

/**
 * 正本の検証済みSnapshot、真正不存在、拒否を区別する。
 * @responsibility 観測不能を空設定へ変換しない。
 * @trace ARCH-000004
 * @shape 状態で絞り込む閉じた結果。
 * @invariant availableだけが設定値を持つ。
 * @boundary 設定Readerと利用側。
 * @security Host Path・秘密値なし。
 * @compatibility 新形式専用。
 */
export type AiSelectionReadResult = Readonly<
  | { status: "available"; snapshot: AiSelectionSnapshot; reason: null }
  | { status: "missing"; snapshot: null; reason: "ai_selection_not_configured" }
  | {
      status: "blocked";
      snapshot: null;
      reason:
        | "ai_selection_boundary_unconfirmed"
        | "ai_selection_file_invalid"
        | "ai_selection_file_too_large"
        | "ai_selection_config_invalid"
        | "ai_selection_read_unconfirmed";
    }
>;

/**
 * 今回作成した非正本Fileの観測値を介入担当へ渡す。
 * @responsibility 自動削除のAuthorityでないexact参照を保持する。
 * @trace ARCH-000004
 * @shape Repository束縛、相対名、観測可能な場合だけ実Identity。
 * @invariant 不明なIdentityを補完せず正本の設定へ利用しない。
 * @boundary Store失敗と既存フロントAI／運用清掃。
 * @security 絶対Path・File内容・秘密値なし。
 * @compatibility 新しい回復Registryではない。
 */
export type AiSelectionTemporaryReference = Readonly<{
  repositoryBinding: string;
  boundaryIdentity: string;
  relativePath: string;
  identity: Readonly<{
    dev: string;
    ino: string;
    birthtimeNs: string;
    size: string;
    mtimeNs: string;
    ctimeNs: string;
  }> | null;
  status: "cleanup_unconfirmed";
}>;

/**
 * 保存の成功・競合・拒否と未確認のEffectを分離する。
 * @responsibility 設定公開と一時File／Lockの終了を成功条件へ結合する。
 * @trace ARCH-000004
 * @shape saved以外は設定本文を返さない。
 * @invariant 公開後の失敗を保存前拒否へ畳まない。
 * @boundary 設定Storeと管理操作。
 * @security 未確認の保存を自動再送させず、既存回復参照は同じまま保持する。
 * @compatibility 初回作成のexpectedIdentityはnull。
 */
export type AiSelectionSaveResult = Readonly<
  | { status: "saved"; reason: null; snapshot: AiSelectionSnapshot }
  | {
      status: "conflict";
      reason: "ai_selection_identity_conflict";
      snapshot: null;
    }
  | {
      status: "blocked";
      reason: string;
      snapshot: null;
      recoveryId?: string;
      setupFailure?: ConfigAreaFailure;
    }
  | {
      status: "unknown";
      reason: string;
      snapshot: null;
      publication: "not_published" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
      recoveryId: string | null;
      temporary: AiSelectionTemporaryReference | null;
      setupFailure?: ConfigAreaFailure;
    }
>;

/**
 * 既存config領域確保の失敗契約をそのまま保持する。
 * @responsibility Ignoreの未確認Effectと元回復参照を新Storeで失わない。
 * @trace ARCH-000004
 * @shape 既存Domain結果のblocked部分。
 * @invariant 元のreason・cleanup・回復Identityを再生成しない。
 * @boundary Domainの領域確保と設定保存。
 * @security 認可された管理Callerだけへ搬送する内部契約。
 * @compatibility 既存Domain契約を変更しない。
 */
type ConfigAreaFailure = Extract<
  NonNullable<ReturnType<typeof ensureRepositoryRuntimeDataArea>>,
  { status: "blocked" }
>;

/**
 * 公開結果に含めないFile bytesとともに固定正本だけを読む。
 * @responsibility config境界・通常File・単一Link・UTF-8・容量と新Schemaを照合する。
 * @trace ARCH-000004
 * @input capability: 発行済みRepository Root。
 * @returns Reader結果と、成功時だけ読取ったbytes。
 * @precondition 作成・初期設定の採用は行わない。
 * @postcondition 親境界とFile実体の前後一致を確認する。
 * @effect 既存metadataと一つの読取りdescriptorを利用し閉じる。
 * @failure 不在・不正・容量超過・不明を分離する。
 * @invariant 同名以外や一時Fileは読み込まない。
 * @boundary Repository Fileと設定値。
 * @security Link・hardlink・重複JSON・旧Schemaを拒否する。
 * @concurrency Snapshot内で同じbytesと境界を確認する。
 */
function inspectSelectionFile(
  capability: VerifiedRepositoryRoot,
  catalog: AiSelectionCatalog,
): Readonly<{ result: AiSelectionReadResult; bytes: Buffer | null }> {
  const blocked = (
    reason: Extract<AiSelectionReadResult, { status: "blocked" }>["reason"],
  ) =>
    Object.freeze({
      result: Object.freeze({
        status: "blocked" as const,
        snapshot: null,
        reason,
      }),
      bytes: null,
    });
  const missing = () =>
    Object.freeze({
      result: Object.freeze({
        status: "missing" as const,
        snapshot: null,
        reason: "ai_selection_not_configured" as const,
      }),
      bytes: null,
    });
  try {
    const area = observeRepositoryRuntimeDataArea(capability, "config");
    if (area.status === "not_observed") return missing();
    if (area.status !== "ready")
      return blocked("ai_selection_boundary_unconfirmed");
    const root = createFilesystemStoreRoot(area.directory);
    if (!root) return blocked("ai_selection_boundary_unconfirmed");
    const file = resolveFilesystemStorePath(root, CONFIG_FILE);
    let before: fs.BigIntStats;
    try {
      before = fs.lstatSync(file, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const after = observeRepositoryRuntimeDataArea(capability, "config");
      return after.status === "ready" &&
        after.boundaryIdentity === area.boundaryIdentity
        ? missing()
        : blocked("ai_selection_boundary_unconfirmed");
    }
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size <= 0n
    )
      return blocked("ai_selection_file_invalid");
    if (before.size > BigInt(AI_SELECTION_MAXIMUM_BYTES))
      return blocked("ai_selection_file_too_large");
    const snapshot = readStableBoundedFileSnapshot(
      file,
      AI_SELECTION_MAXIMUM_BYTES,
    );
    const after = fs.lstatSync(file, { bigint: true });
    const endArea = observeRepositoryRuntimeDataArea(capability, "config");
    if (
      endArea.status !== "ready" ||
      endArea.boundaryIdentity !== area.boundaryIdentity ||
      resolveFilesystemStorePath(root, CONFIG_FILE) !== file ||
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1n ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      before.mtimeNs !== after.mtimeNs ||
      before.size !== after.size
    )
      return blocked("ai_selection_boundary_unconfirmed");
    let raw: unknown;
    try {
      raw = parseUnambiguousJsonDocument(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          snapshot.bytes,
        ),
      );
    } catch {
      return blocked("ai_selection_config_invalid");
    }
    const checked = validateAiSelectionConfig(raw, catalog);
    return checked.status === "valid"
      ? Object.freeze({
          result: Object.freeze({
            status: "available" as const,
            reason: null,
            snapshot: checked.value,
          }),
          bytes: snapshot.bytes,
        })
      : blocked("ai_selection_config_invalid");
  } catch {
    return blocked("ai_selection_read_unconfirmed");
  }
}

/**
 * Repository設定を作成せず読取り専用で取得する。
 * @responsibility 正本だけの検証結果を公開する。
 * @trace ARCH-000004
 * @input capability: 発行済みRoot。
 * @returns 不変Snapshot、missing又はblocked。
 * @precondition 利用側が必要なRepository読取り認可を行う。
 * @postcondition bytes・内部Path・一時Fileを公開しない。
 * @effect File読取りのみ。作成・AI実行なし。
 * @failure 観測不能をmissingへ畳まない。
 * @invariant 旧設定やHost設定へのfallbackなし。
 * @boundary Repository設定と利用側。
 * @security Root capabilityを文字列で偽造できない。
 * @concurrency 安定Snapshotを一回取得する。
 */
export function readRepositoryAiSelection(
  capability: VerifiedRepositoryRoot,
  catalog: AiSelectionCatalog,
): AiSelectionReadResult {
  return inspectSelectionFile(capability, catalog).result;
}

/**
 * 明示した期待Identityと現在の正本を比較する。
 * @responsibility 初回の真正不存在と内容Hash一致を同一視せずCAS判定する。
 * @trace ARCH-000004
 * @input current: 検証済み読取り結果、expected: null又はHash。
 * @returns 一致時だけtrue。
 * @precondition blocked読取りを不在として渡さない。
 * @postcondition 観測不能を一致へ畳まない。
 * @effect N/A: 値比較だけ。
 * @failure N/A: 全入力をbooleanへ分類する。
 * @invariant Schema revisionを更新世代の代用にしない。
 * @boundary 読取りと条件付き保存。
 * @security 一致だけで認可を発行しない。
 * @concurrency 既存排他中で利用する。
 */
function matchesExpected(
  current: AiSelectionReadResult,
  expected: unknown,
): boolean {
  return current.status === "missing"
    ? expected === null
    : current.status === "available" && current.snapshot.identity === expected;
}

/**
 * 管理認可を観測不能も含めて確認する。
 * @responsibility 認可callbackの例外や非trueを許可へ変換しない。
 * @trace ARCH-000004
 * @input authorize: 呼出し元が所有する現在認可の観測。
 * @returns 明示trueだけ許可。
 * @precondition 認可ルール本体はAccess Management等が所有する。
 * @postcondition Roleや資格の判定を再実装しない。
 * @effect 認可callbackを一回呼ぶ。
 * @failure 例外は未確認としてfalse。
 * @invariant 保存結果を認可の根拠にしない。
 * @boundary Storeと既存管理認可。
 * @security 未確認では公開しない。
 * @concurrency 書込み・公開前後で再確認する。
 */
function authorized(authorize: () => boolean): boolean {
  try {
    return authorize() === true;
  } catch {
    return false;
  }
}

/**
 * 設定を既存排他の中でCAS保存し、通常の読戻しを確認する。
 * @responsibility 作成・公開・読戻し・一時File回収と既存Lock終了を一つの結果へ接続する。
 * @trace ARCH-000004
 * @input capability: Root、candidate: expectedIdentity/config、authorize: 現在管理認可。
 * @returns saved、conflict、blocked又は公開段階付きunknown。
 * @precondition 操作は同期的で、利用側は失敗を自動再送しない。
 * @postcondition 成功は正本・読戻し・cleanupの全確認時だけ。
 * @effect 認可後だけ既存config領域・Lock・一時File・正本を更新する。
 * @failure 生Errorを公開せず、元の排他回復参照と観測済み一時File Identityを保持する。
 * @invariant 正本を先に削除せず、異なる実体をcleanupしない。
 * @boundary 既存Filesystem排他とRepositoryの設定正本。
 * @security 保存前認可失効は公開0、保存後失効は本文なしの非成功。
 * @concurrency 同じ排他に参加するWriter間だけを直列化し、外部Editorの完全CASは主張しない。
 */
export function saveRepositoryAiSelection(
  capability: VerifiedRepositoryRoot,
  candidate: unknown,
  authorize: () => boolean,
  catalog: AiSelectionCatalog,
): AiSelectionSaveResult {
  const blocked = (reason: string): AiSelectionSaveResult =>
    Object.freeze({ status: "blocked", reason, snapshot: null });
  const request = snapshotPlainRecord(
    candidate,
    new Set(["expectedIdentity", "config"]),
  );
  if (
    !request ||
    (request.expectedIdentity !== null &&
      (typeof request.expectedIdentity !== "string" ||
        !/^[a-f0-9]{64}$/u.test(request.expectedIdentity)))
  )
    return blocked("ai_selection_save_request_invalid");
  const checked = validateAiSelectionConfig(request.config, catalog);
  if (checked.status !== "valid") return blocked(checked.reason);
  const payload = Buffer.from(
    `${JSON.stringify(checked.value.config, null, 2)}\n`,
    "utf8",
  );
  if (payload.byteLength > AI_SELECTION_MAXIMUM_BYTES)
    return blocked("ai_selection_file_too_large");
  if (!authorized(authorize)) return blocked("ai_selection_access_unconfirmed");
  let lastPublication: "not_published" | "unconfirmed" | "confirmed" =
    "not_published";
  let lastTemporary: AiSelectionTemporaryReference | null = null;
  try {
    const area = ensureRepositoryRuntimeDataArea(capability, "config");
    if (!area) return blocked("ai_selection_config_area_unconfirmed");
    if (area.status === "blocked") {
      const setupFailure: ConfigAreaFailure = Object.freeze({
        status: area.status,
        reason: area.reason,
        effectIssued: area.effectIssued,
        effectStateUnknown: area.effectStateUnknown,
        effectConfirmation: area.effectConfirmation,
        cleanupConfirmed: area.cleanupConfirmed,
        retryAllowed: area.retryAllowed,
        recoveryReference: area.recoveryReference,
        repositoryPathReported: area.repositoryPathReported,
      });
      return area.effectStateUnknown || !area.cleanupConfirmed
        ? Object.freeze({
            status: "unknown",
            reason: area.reason,
            snapshot: null,
            publication: "not_published",
            cleanupConfirmed: area.cleanupConfirmed,
            recoveryId: null,
            temporary: null,
            setupFailure,
          })
        : Object.freeze({
            status: "blocked",
            reason: area.reason,
            snapshot: null,
            setupFailure,
          });
    }
    const startArea = observeRepositoryRuntimeDataArea(capability, "config");
    if (startArea.status !== "ready" || startArea.directory !== area.directory)
      return blocked("ai_selection_boundary_unconfirmed");
    const boundaryLive = () => {
      const current = observeRepositoryRuntimeDataArea(capability, "config");
      return (
        current.status === "ready" &&
        current.boundaryIdentity === startArea.boundaryIdentity &&
        current.directory === startArea.directory
      );
    };
    const root = createFilesystemStoreRoot(area.directory);
    if (!root) return blocked("ai_selection_boundary_unconfirmed");
    const outcome = withFilesystemStoreLock(
      root,
      "ai-selection.lock",
      (): AiSelectionSaveResult => {
        const current = readRepositoryAiSelection(capability, catalog);
        if (current.status === "blocked") return blocked(current.reason);
        if (!matchesExpected(current, request.expectedIdentity))
          return Object.freeze({
            status: "conflict",
            reason: "ai_selection_identity_conflict",
            snapshot: null,
          });
        if (!authorized(authorize) || !boundaryLive())
          return blocked("ai_selection_access_unconfirmed");
        const name = `ai-selection.${randomUUID()}.tmp`;
        const pending = resolveFilesystemStorePath(root, name);
        let owned = false;
        let metadata: fs.BigIntStats | null = null;
        let publication: "not_published" | "unconfirmed" | "confirmed" =
          "not_published";
        let result: AiSelectionSaveResult;
        let cleanupConfirmed = true;
        let handleClosed = true;
        try {
          const fd = fs.openSync(pending, "wx", 0o600);
          owned = true;
          handleClosed = false;
          try {
            metadata = fs.fstatSync(fd, { bigint: true });
            fs.writeFileSync(fd, payload);
            fs.fsyncSync(fd);
          } finally {
            try {
              metadata = fs.fstatSync(fd, { bigint: true });
            } finally {
              fs.closeSync(fd);
              handleClosed = true;
            }
          }
          const prepared = readStableBoundedFileSnapshot(
            resolveFilesystemStorePath(root, name),
            AI_SELECTION_MAXIMUM_BYTES,
          );
          const stage = fs.lstatSync(pending, { bigint: true });
          if (
            !metadata ||
            stage.nlink !== 1n ||
            stage.dev !== metadata.dev ||
            stage.ino !== metadata.ino ||
            stage.birthtimeNs !== metadata.birthtimeNs ||
            stage.size !== metadata.size ||
            stage.ctimeNs !== metadata.ctimeNs ||
            stage.mtimeNs !== metadata.mtimeNs ||
            !boundaryLive() ||
            !prepared.bytes.equals(payload)
          )
            throw Error("stage");
          const beforePublication = readRepositoryAiSelection(
            capability,
            catalog,
          );
          if (beforePublication.status === "blocked")
            result = blocked(beforePublication.reason);
          else if (
            !matchesExpected(beforePublication, request.expectedIdentity)
          )
            result = Object.freeze({
              status: "conflict",
              reason: "ai_selection_identity_conflict",
              snapshot: null,
            });
          else if (!authorized(authorize) || !boundaryLive())
            result = blocked("ai_selection_access_unconfirmed");
          else {
            publication = "unconfirmed";
            lastPublication = publication;
            fs.renameSync(
              resolveFilesystemStorePath(root, name),
              resolveFilesystemStorePath(root, CONFIG_FILE),
            );
            owned = false;
            const readback = inspectSelectionFile(capability, catalog);
            if (
              readback.result.status !== "available" ||
              readback.result.snapshot.identity !== checked.value.identity ||
              !boundaryLive() ||
              !readback.bytes?.equals(payload)
            )
              throw Error("readback");
            publication = "confirmed";
            lastPublication = publication;
            result = authorized(authorize)
              ? Object.freeze({
                  status: "saved",
                  reason: null,
                  snapshot: readback.result.snapshot,
                })
              : Object.freeze({
                  status: "unknown",
                  reason: "ai_selection_access_changed_after_save",
                  snapshot: null,
                  publication,
                  cleanupConfirmed: true,
                  recoveryId: null,
                  temporary: null,
                });
          }
        } catch {
          result = Object.freeze({
            status: "unknown",
            reason: "ai_selection_save_unconfirmed",
            snapshot: null,
            publication,
            cleanupConfirmed: false,
            recoveryId: null,
            temporary: null,
          });
        } finally {
          if (owned) {
            try {
              const observed = fs.lstatSync(
                resolveFilesystemStorePath(root, name),
                { bigint: true },
              );
              if (
                !boundaryLive() ||
                !metadata ||
                !observed.isFile() ||
                observed.isSymbolicLink() ||
                observed.nlink !== 1n ||
                observed.dev !== metadata.dev ||
                observed.ino !== metadata.ino ||
                observed.birthtimeNs !== metadata.birthtimeNs ||
                observed.size !== metadata.size ||
                observed.mtimeNs !== metadata.mtimeNs ||
                observed.ctimeNs !== metadata.ctimeNs
              ) {
                cleanupConfirmed = false;
              } else {
                fs.unlinkSync(pending);
                cleanupConfirmed = false;
                try {
                  fs.lstatSync(pending);
                } catch (error) {
                  cleanupConfirmed =
                    (error as NodeJS.ErrnoException).code === "ENOENT";
                }
              }
            } catch {
              cleanupConfirmed = false;
            }
          }
        }
        if (!cleanupConfirmed || !handleClosed) {
          const temporary = Object.freeze({
            repositoryBinding: createHash("sha256")
              .update(area.repositoryRoot, "utf8")
              .digest("hex"),
            boundaryIdentity: startArea.boundaryIdentity,
            relativePath: `.crdd/config/${name}`,
            identity: metadata
              ? Object.freeze({
                  dev: metadata.dev.toString(),
                  ino: metadata.ino.toString(),
                  birthtimeNs: metadata.birthtimeNs.toString(),
                  size: metadata.size.toString(),
                  mtimeNs: metadata.mtimeNs.toString(),
                  ctimeNs: metadata.ctimeNs.toString(),
                })
              : null,
            status: "cleanup_unconfirmed" as const,
          });
          lastTemporary = temporary;
          return Object.freeze({
            status: "unknown",
            reason: !handleClosed
              ? "ai_selection_descriptor_close_unconfirmed"
              : "ai_selection_temporary_cleanup_unconfirmed",
            snapshot: null,
            publication,
            cleanupConfirmed: false,
            recoveryId: null,
            temporary,
          });
        }
        return result.status === "unknown"
          ? Object.freeze({ ...result, cleanupConfirmed: true })
          : result;
      },
    );
    if (!outcome.acquired)
      return Object.freeze({
        status: "blocked",
        reason: outcome.reason,
        snapshot: null,
        ...("recoveryId" in outcome ? { recoveryId: outcome.recoveryId } : {}),
      });
    if (!outcome.cleanupConfirmed)
      return Object.freeze({
        status: "unknown",
        reason: outcome.reason,
        snapshot: null,
        publication: outcome.operationCompleted
          ? outcome.value.status === "saved"
            ? "confirmed"
            : outcome.value.status === "unknown"
              ? outcome.value.publication
              : "not_published"
          : lastPublication,
        cleanupConfirmed: false,
        recoveryId: outcome.recoveryId,
        temporary:
          outcome.operationCompleted && outcome.value.status === "unknown"
            ? outcome.value.temporary
            : lastTemporary,
      });
    if (outcome.value.status === "saved" && !authorized(authorize))
      return Object.freeze({
        status: "unknown",
        reason: "ai_selection_access_changed_after_save",
        snapshot: null,
        publication: "confirmed",
        cleanupConfirmed: true,
        recoveryId: null,
        temporary: null,
      });
    return outcome.value;
  } catch {
    return Object.freeze({
      status: "unknown",
      reason: "ai_selection_store_unconfirmed",
      snapshot: null,
      publication: lastPublication,
      cleanupConfirmed: false,
      recoveryId: null,
      temporary: lastTemporary,
    });
  }
}
