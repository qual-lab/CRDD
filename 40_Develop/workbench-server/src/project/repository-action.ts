/**
 * Repository操作のHTTP入力と公開結果を既存Version Controlへ対応付ける。
 * @packageDocumentation
 * @responsibility 閉じたFormと操作別結果を検査し、Root解決・認可・Git実行を所有しない。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary Browser FormとVersion Control操作の境界。
 */
import type {
  ChangePublicationRequest,
  ChangePublicationResult,
} from "../../../version-control/src/index.ts";

/**
 * Repository操作Formを配送前に閉検査する。
 * @responsibility 操作・対象・Token・scalar入力を一件ずつ確定する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 上限確認済みForm、期待Token、共有接続かどうか。
 * @returns 選択Repository IDと既存Version Control要求。
 * @precondition Form搬送を終了し、HTTP Originを確認済みである。
 * @postcondition 任意field・重複・未確認公開を要求へ含めない。
 * @effect N/A: 入力だけを検査する。
 * @failure 不正入力を固定理由で拒否する。
 * @invariant 単体Rootを共有対象の代替にしない。
 * @boundary HTTP Formと現在認可前の要求境界。
 * @security Force・任意command・秘密・絶対Pathを受理しない。
 * @concurrency 要求局所値だけを返す。
 */
export function validateRepositoryActionForm(
  form: URLSearchParams,
  expectedToken: string,
  shared: boolean,
): Readonly<{
  repositoryId: string | null;
  request: ChangePublicationRequest;
}> {
  const operation = form.get("operation");
  const fields =
    operation === "prepare" || operation === "unprepare"
      ? ["path"]
      : operation === "create_revision"
        ? ["message"]
        : operation === "publish_revision"
          ? ["destination", "branch", "revisionIdentity", "humanConfirmed"]
          : null;
  if (fields === null) throw new Error("repository_action_input_invalid");
  const required = [
    "operation",
    "actionToken",
    ...fields,
    ...(shared ? ["repositoryId"] : []),
  ];
  if (
    [...form.keys()].some((key) => !required.includes(key)) ||
    required.some((key) => form.getAll(key).length !== 1) ||
    form.get("actionToken") !== expectedToken
  )
    throw new Error("repository_action_input_invalid");
  const repositoryId = shared ? form.get("repositoryId") : null;
  if (
    shared &&
    (repositoryId === null ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId))
  )
    throw new Error("repository_action_input_invalid");
  let request: ChangePublicationRequest;
  if (operation === "prepare" || operation === "unprepare") {
    const selectedPath = form.get("path") ?? "";
    if (
      selectedPath.length === 0 ||
      selectedPath.length > 4096 ||
      selectedPath.startsWith("-") ||
      selectedPath.startsWith("/") ||
      selectedPath.includes("\\") ||
      /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(selectedPath) ||
      /[\u0000-\u001f\u007f]/u.test(selectedPath) ||
      selectedPath
        .split("/")
        .some((part) => part === "" || part === "." || part === "..")
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({
      operation,
      paths: Object.freeze([selectedPath]),
    });
  } else if (operation === "create_revision") {
    const message = form.get("message") ?? "";
    if (
      message.trim().length === 0 ||
      message.length > 4096 ||
      /[\u0000\u007f]/u.test(message)
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({ operation, message });
  } else {
    const destination = form.get("destination") ?? "";
    const branch = form.get("branch") ?? "";
    const revisionIdentity = form.get("revisionIdentity") ?? "";
    if (
      form.get("humanConfirmed") !== "true" ||
      [destination, branch, revisionIdentity].some(
        (value) =>
          value.length === 0 ||
          value.length > 4096 ||
          value.startsWith("-") ||
          /[\u0000-\u0020\u007f]/u.test(value),
      )
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({
      operation: "publish_revision",
      destination,
      branch,
      revisionIdentity,
      humanConfirmed: true,
    });
  }
  return Object.freeze({ repositoryId, request });
}

/**
 * 操作に相関したVersion Control結果だけを公開可能にする。
 * @responsibility 状態・理由・Effect・Revisionの組合せを閉検査する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 今回の操作要求と未知のOwner結果。
 * @returns 相関を確認した既存結果。
 * @precondition Ownerへ同じ要求を最大一回配送済みである。
 * @postcondition blockedでも発行済みEffectを消さない。
 * @effect N/A: 結果だけを検査する。
 * @failure 未知field・理由・相関を固定理由で拒否する。
 * @invariant 結果不明を成功または未処置へ補完しない。
 * @boundary Version Control OwnerとWorkbench表示の境界。
 * @security 生出力・Remote URL・秘密を結果へ追加しない。
 * @concurrency 他要求の結果を相関に使用しない。
 */
export function inspectRepositoryActionResult(
  request: ChangePublicationRequest,
  value: unknown,
): ChangePublicationResult {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("repository_action_result_invalid");
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).sort().join(",") !==
      "automaticRetryIssued,effectConfirmed,effectIssued,forcePublicationIssued,reason,revisionIdentity,status" ||
    result.automaticRetryIssued !== false ||
    result.forcePublicationIssued !== false ||
    typeof result.effectIssued !== "boolean" ||
    typeof result.effectConfirmed !== "boolean" ||
    typeof result.reason !== "string" ||
    (result.revisionIdentity !== null &&
      (typeof result.revisionIdentity !== "string" ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(result.revisionIdentity)))
  )
    throw new Error("repository_action_result_invalid");
  let expected: readonly [string, boolean, boolean, boolean] | undefined;
  if (request.operation === "prepare" || request.operation === "unprepare") {
    if (result.reason === `${request.operation}_completed`)
      expected = ["completed", true, true, false];
    else if (result.reason === `${request.operation}_rejected`)
      expected = ["blocked", true, false, false];
    else if (result.reason === "repository_effect_unknown")
      expected = ["unknown", true, false, false];
  } else if (request.operation === "create_revision") {
    if (result.reason === "revision_created")
      expected = ["completed", true, true, true];
    else if (result.reason === "revision_creation_rejected")
      expected = ["blocked", true, false, false];
    else if (
      result.reason === "revision_creation_unknown" ||
      result.reason === "revision_identity_unknown"
    )
      expected = ["unknown", true, false, false];
  } else {
    if (result.reason === "publication_revision_changed")
      expected = ["blocked", false, false, false];
    else if (result.reason === "publication_rejected")
      expected = ["blocked", true, false, true];
    else if (
      result.reason === "publication_result_unknown" ||
      result.reason === "publication_observation_unknown"
    )
      expected = ["unknown", true, false, true];
    else if (result.reason === "publication_confirmed")
      expected = ["completed", true, true, true];
    if (expected?.[3] && result.revisionIdentity !== request.revisionIdentity)
      throw new Error("repository_action_result_invalid");
  }
  if (
    expected === undefined ||
    result.status !== expected[0] ||
    result.effectIssued !== expected[1] ||
    result.effectConfirmed !== expected[2] ||
    (result.revisionIdentity !== null) !== expected[3]
  )
    throw new Error("repository_action_result_invalid");
  return Object.freeze({
    status: expected[0] as ChangePublicationResult["status"],
    reason: result.reason,
    effectIssued: expected[1],
    effectConfirmed: expected[2],
    revisionIdentity: result.revisionIdentity as string | null,
    automaticRetryIssued: false,
    forcePublicationIssued: false,
  });
}
