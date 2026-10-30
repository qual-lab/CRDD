/**
 * fresh再入場の検査済み実IDに対するDocker資源処置を所有する。
 *
 * @responsibility 現在観測・構成照合・限定削除・不存在再観測を一つの技術処理にする。
 * @trace ARCH-000008
 */
import {
  dockerResourceConfigurationMatches,
  dockerResourceExpectationIsValid,
  dockerResourceLocatorIsValid,
  type DockerResourceExpectation,
} from "./plan.ts";

/**
 * 固定Docker観測・清掃要求の同期結果。
 *
 * @responsibility 失敗・Signal・例外と出力を別fieldで搬送する。
 * @trace ARCH-000008
 * @shape status、signal、stdout、stderr、error。
 * @invariant exitだけで不存在や清掃成功を宣言しない。
 * @boundary 固定Docker実行primitiveから資源観測への境界。
 * @security 生Provider出力や処置許可は含めない。診断は上位が必要最小量へ限定する。
 * @compatibility 既存回復Runnerの結果fieldと同じ意味を保持する。
 */
export type DockerRecoveryCommandResult = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  error: Error | null;
}>;

/**
 * 検査済み実Docker IDの現在観測と限定回収を行う。
 *
 * @responsibility 実ID、構成、削除とID／名前不存在の相関を保持する。
 * @trace ARCH-000008
 * @input runDocker: 固定実行primitive。expectation: 上位検査済み技術条件。options: 不存在受理・観測のみ・削除直前の同期生存確認。
 * @returns 全条件成立時true。不明・差・失敗はfalse。
 * @precondition 上位が現在Owner、exact回復Identityと期待構成の由来を検査している。
 * @postcondition 実ID不明や他Ownerの資源を名前だけで削除しない。
 * @effect 固定Docker ls／inspect、構成確認後の実ID rmと再観測を行う。
 * @failure 失敗・不正応答・構成差・残存はfalse。削除直前の確認は厳密なtrue以外・例外を拒否する。
 * @invariant 過去の作成結果unknownを成功へ書き換えず、永続記録を読書きしない。
 * @boundary fresh回復の上位判断から下位の現在資源処置。
 * @security 期待値・照合trueだけで新しい削除Authorityを発行しない。
 * @concurrency 構成検査後・rm直前に借用Ownerを同期再確認し、完了後のIDと同名資源を再観測する。
 */
export function recoverObservedDockerResource(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  expectation: DockerResourceExpectation,
  options: Readonly<{
    allowAlreadyAbsent?: boolean;
    removeAfterVerification?: boolean;
    assertBeforeRemoval?: () => boolean;
  }> = Object.freeze({}),
) {
  if (!dockerResourceExpectationIsValid(expectation)) return false;
  const { kind, dockerId, expectedName } = expectation;

  const exactNameAbsent = () => {
    const named = runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            "--filter",
            `name=^/${expectedName}$`,
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            "--filter",
            `name=^${expectedName}$`,
            "--format",
            "{{.ID}}",
          ],
    );
    return (
      named.status === 0 &&
      !named.signal &&
      !named.error &&
      named.stderr.length === 0 &&
      named.stdout.trim() === ""
    );
  };
  const listArgs =
    kind === "container"
      ? [
          "container",
          "ls",
          "--all",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ]
      : [
          "network",
          "ls",
          "--no-trunc",
          "--filter",
          `id=${dockerId}`,
          "--format",
          "{{.ID}}",
        ];
  const listed = runDocker(listArgs);
  if (
    listed.status !== 0 ||
    listed.signal ||
    listed.error ||
    listed.stderr.length
  )
    return false;
  const ids = listed.stdout.trim() ? listed.stdout.trim().split(/\r?\n/u) : [];
  if (ids.length === 0)
    return options.allowAlreadyAbsent !== false && exactNameAbsent();
  if (ids.length !== 1 || ids[0] !== dockerId) return false;
  const inspected = runDocker(
    kind === "container"
      ? ["container", "inspect", dockerId]
      : ["network", "inspect", dockerId],
  );
  if (
    inspected.status !== 0 ||
    inspected.signal ||
    inspected.error ||
    inspected.stderr.length
  )
    return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(inspected.stdout);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) return false;
  if (!dockerResourceConfigurationMatches(parsed[0], expectation)) return false;
  if (options.removeAfterVerification === false) return true;
  if (options.assertBeforeRemoval !== undefined) {
    try {
      if (options.assertBeforeRemoval() !== true) return false;
    } catch {
      return false;
    }
  }
  const removed = runDocker(
    kind === "container"
      ? ["container", "rm", "--force", dockerId]
      : ["network", "rm", dockerId],
  );
  if (removed.status !== 0 || removed.signal || removed.error) return false;
  const absent = runDocker(listArgs);
  return (
    absent.status === 0 &&
    !absent.signal &&
    !absent.error &&
    absent.stderr.length === 0 &&
    absent.stdout.trim() === "" &&
    exactNameAbsent()
  );
}

const DOCKER_TASK_RECOVERY_ID =
  /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u;

/**
 * Docker Taskの元回復参照を技術境界で解析する。
 * @responsibility 三成分の固定文法を検査し、値から操作Authorityを発行しない。
 * @trace ARCH-000008
 * @input token: 未信頼値。
 * @returns 三Hash成分と元token、又はnull。
 * @effect N/A: 文字列だけを同期検査する。
 * @failure 文字列以外・長さ・大文字・余剰成分はnull。
 * @boundary Domainの保存受理parserとは独立したDI技術入力。
 */
export function parseDockerTaskRecoveryId(token: unknown) {
  if (typeof token !== "string") return null;
  const match = DOCKER_TASK_RECOVERY_ID.exec(token);
  return match?.[1] && match[2] && match[3]
    ? Object.freeze({
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      })
    : null;
}

/**
 * 作成結果不明の予定資源を現在観測から識別する。
 *
 * @responsibility exact名とLabelの単一IDが一致し、隔離構成も成立する場合だけ実IDを返す。
 * @trace ARCH-000008
 * @input runDocker: 固定観測primitive。expectation: 上位検査済み予定資源の技術条件。
 * @returns 構成確認済み実ID、またはnull。
 * @precondition 上位が同じ回復参照と限定した未解決作成要求を検査している。
 * @postcondition 名前だけで採用せず、作成成功や清掃完了を宣言しない。
 * @effect 固定Docker ls／inspectで現在資源を観測する。削除しない。
 * @failure 観測不能・複数・名とLabelの差・構成差・資源未発見はnull。
 * @invariant 未発見を不存在・過去要求の未発行へ読み替えない。
 * @boundary 限定未解決作成Classから技術的な現在実IDの観測。
 * @security 実IDから新しい処置許可や汎用Recoveryを発行しない。
 * @concurrency 各観測を同じ予定資源へ結合し、不一致では停止する。
 */
export function discoverSubmittedDockerResource(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  expectation: Omit<DockerResourceExpectation, "dockerId">,
) {
  if (!dockerResourceExpectationIsValid(expectation)) return null;
  const { kind, expectedName, ownershipLabel } = expectation;

  const list = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  const ids = (result: DockerRecoveryCommandResult) => {
    if (
      result.status !== 0 ||
      result.signal ||
      result.error ||
      result.stderr.length !== 0
    )
      return null;
    const values = result.stdout.trim()
      ? result.stdout.trim().split(/\r?\n/u)
      : [];
    return values.length <= 1 &&
      values.every((value) => /^[a-f0-9]{64}$/u.test(value))
      ? values
      : null;
  };
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const labelFilter = `label=${ownershipLabel}`;
  const byNameItems = ids(list(nameFilter));
  const byOwnershipItems = ids(list(nameFilter, labelFilter));
  if (!byNameItems || !byOwnershipItems) return null;
  if (byNameItems.length === 0 && byOwnershipItems.length === 0) return null;
  if (
    byNameItems.length !== 1 ||
    byOwnershipItems.length !== 1 ||
    byNameItems[0] !== byOwnershipItems[0]
  )
    return null;
  return recoverObservedDockerResource(
    runDocker,
    { ...expectation, dockerId: byNameItems[0] as string },
    Object.freeze({
      allowAlreadyAbsent: false,
      removeAfterVerification: false,
    }),
  )
    ? (byNameItems[0] as string)
    : null;
}

/**
 * 予定名とLabelで現在資源の明示不存在を観測する。
 *
 * @responsibility 二つの成功観測を要求し、失敗・Signal・例外を空集合へ変換しない。
 * @trace ARCH-000008
 * @input runDocker、kind、expectedName、ownershipLabel: 固定観測と検査済み予定資源。
 * @returns 両方の明示不存在が成立する場合だけtrue。
 * @precondition 上位が遅延作成の扱いと回復Classを別に検査している。
 * @postcondition この値だけで過去作成結果unknownを消さない。
 * @effect 固定Docker lsを予定名と名／Labelで二回実行する。
 * @failure 観測不能・不正終了・残存はfalse。
 * @invariant falseは不存在ではなく、再試行や閉鎖の許可も含めない。
 * @boundary 現在資源の観測から上位の限定回復判断。
 * @security 名前だけの削除とRoot／State操作を追加しない。
 * @concurrency 現在観測を二経路で照合し、遅延作成の無害化は上位に残す。
 */
export function observeSubmittedDockerResourceAbsent(
  runDocker: (argv: readonly string[]) => DockerRecoveryCommandResult,
  kind: "container" | "network",
  expectedName: string,
  ownershipLabel: string,
) {
  if (!dockerResourceLocatorIsValid(kind, expectedName, ownershipLabel))
    return false;
  const nameFilter =
    kind === "container" ? `name=^/${expectedName}$` : `name=^${expectedName}$`;
  const executeRecoveryOperation = (...filters: readonly string[]) =>
    runDocker(
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            ...filters.flatMap((filter) => ["--filter", filter]),
            "--format",
            "{{.ID}}",
          ],
    );
  return [
    executeRecoveryOperation(nameFilter),
    executeRecoveryOperation(nameFilter, `label=${ownershipLabel}`),
  ].every(
    (result) =>
      result.status === 0 &&
      !result.signal &&
      !result.error &&
      result.stderr.length === 0 &&
      result.stdout.trim() === "",
  );
}
