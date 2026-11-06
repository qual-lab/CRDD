/**
 * Repository単体のGit Formを既存の公開要求へ適合する。
 * @packageDocumentation
 * @responsibility HTTP受付が確認したFormを構造化し、認可後の操作をVCの完成操作へ対応付ける。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary 単体HTTP受付とVersion Controlの要求。
 */
import {
  stagePaths,
  unstagePaths,
  commitChanges,
  pushRepositoryRevision,
  type Repository,
  type ChangesResult,
} from "../../../../version-control/src/index.ts";
import type { RepositoryActionRequest } from "../../shared/repository/types.ts";
/**
 * Browser FormをCanonical Change Publication要求へ変換する。
 *
 * @responsibility 許可操作と必須fieldだけを選び、Human確認をboolean契約へ変換する。
 * @trace ARCH-000012
 * @input formに上限確認済みURLSearchParamsを受け取る。
 * @returns RepositoryActionRequestを返す。
 * @precondition CSRF相当Tokenは呼出し側で照合済みである。
 * @postcondition prepare、unprepare、create_revision、publish_revisionのいずれかだけを返す。
 * @effect N/A: Form値を構造化するだけである。
 * @failure 未知操作または確認なしpublishをErrorで拒否する。
 * @invariant FormからForce option、任意Commandまたは複数Pathを生成しない。
 * @boundary Workbench Browser FormとVersion Control Portの境界。
 * @security 未定義fieldを無視し、Credentialを扱わない。
 * @concurrency N/A: Request局所値だけを処理する。
 */
export function createStandaloneRepositoryActionRequest(
  form: URLSearchParams,
): RepositoryActionRequest {
  const operation = form.get("operation");
  if (operation === "prepare" || operation === "unprepare")
    return Object.freeze({
      operation,
      paths: Object.freeze([form.get("path") ?? ""]),
    });
  if (operation === "create_revision")
    return Object.freeze({
      operation,
      message: form.get("message") ?? "",
    });
  if (operation === "publish_revision" && form.get("humanConfirmed") === "true")
    return Object.freeze({
      operation,
      destination: form.get("destination") ?? "",
      branch: form.get("branch") ?? "",
      revisionIdentity: form.get("revisionIdentity") ?? "",
      humanConfirmed: true,
    });
  throw new Error("workbench_repository_operation_invalid");
}

/**
 * Workbenchの確定済み操作をGitの完成操作へ対応付ける。
 * @responsibility UI操作名を技術要求へ変換し、認可・搬送・保存は呼出し側に残す。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 現在認可を確認済みのRepositoryと閉形式のUI操作要求。
 * @returns VCの元の技術結果をそのまま返す。
 * @precondition HTTPの対象・資格・現在許可は呼出し側で確認済み。
 * @postcondition 一要求を一つのVC完成操作へ配送する。
 * @effect 操作に応じIndex・Commit・確認済みRemoteへEffectを発行し得る。
 * @failure VCのunknown・発行済み・未確認を成功や未実施へ畳まない。
 * @invariant 自動再送・Force操作・新しい保存状態を追加しない。
 * @boundary WorkbenchのUI要求とGit技術操作。
 * @security 任意Commandや未定義fieldを下位へ渡さない。
 * @concurrency 呼出し側の既存認可・実行調停の範囲で同期実行する。
 */
export function executeRepositoryAction(
  repository: Repository,
  request: RepositoryActionRequest,
): ChangesResult {
  if (request.operation === "prepare")
    return stagePaths(repository, { paths: request.paths });
  if (request.operation === "unprepare")
    return unstagePaths(repository, { paths: request.paths });
  if (request.operation === "create_revision")
    return commitChanges(repository, { message: request.message });
  return pushRepositoryRevision(repository, {
    destination: request.destination,
    branch: request.branch,
    revisionIdentity: request.revisionIdentity,
    humanConfirmed: request.humanConfirmed,
  });
}
