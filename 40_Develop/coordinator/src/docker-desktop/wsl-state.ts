/**
 * docker-wsl-stateに属する責務をまとめる。
 *
 * @responsibility WslListCompletionを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
/**
 * docker-wsl-stateで使用するWsl List Completionの値契約を定義する。
 *
 * @responsibility Wsl List CompletionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape WslListCompletionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WslListCompletionで宣言した値と責務の対応を維持する。
 * @boundary N/A: WslListCompletionの宣言は外部境界を開かない。
 * @security WslListCompletionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility WslListCompletionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type WslListCompletion = Readonly<{
  status: number | null;
  signal: string | null;
  error?: unknown;
  stdout: Uint8Array;
  stderr: Uint8Array;
}>;

/**
 * docker-wsl-stateで使用するDocker Wsl 状態の値契約を定義する。
 *
 * @responsibility Docker Wsl 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerWslStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerWslStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerWslStateの宣言は外部境界を開かない。
 * @security DockerWslStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerWslStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerWslState = "stopped" | "running" | "unknown";

/**
 * Distribution Listを構造化値へ解析する。
 *
 * @responsibility Distribution Listの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input result: WslListCompletion
 * @returns readonly string[] | nullを返す。
 * @precondition 「result: WslListCompletion」がparseDistributionListの入力契約を満たす。
 * @postcondition parseDistributionListの責務を完了した結果だけを返す。
 * @effect N/A: parseDistributionListは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseDistributionListは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseDistributionListは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDistributionListはProcess内の同一Subsystemで完結する。
 * @security parseDistributionListはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDistributionListは共有非同期状態を持たない同期処理である。
 */
function parseDistributionList(
  result: WslListCompletion,
): readonly string[] | null {
  if (
    result.status !== 0 ||
    result.signal !== null ||
    result.error != null ||
    !(result.stdout instanceof Uint8Array) ||
    !(result.stderr instanceof Uint8Array) ||
    result.stderr.byteLength !== 0 ||
    result.stdout.byteLength > 65_536
  )
    return null;
  const bytes = result.stdout;
  if (bytes.byteLength === 0) return [];
  const isUtf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || bytes.includes(0);
  if (isUtf16 && bytes.byteLength % 2 !== 0) return null;
  try {
    const text = new TextDecoder(isUtf16 ? "utf-16le" : "utf-8", {
      fatal: true,
    }).decode(bytes);
    const lines = text.replace(/\r\n/gu, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (
      lines.length === 0 ||
      lines.some((line) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(line))
    )
      return null;
    const foldedNames = lines.map((line) => line.toLowerCase());
    return new Set(foldedNames).size === foldedNames.length
      ? foldedNames
      : null;
  } catch {
    return null;
  }
}

/**
 * This is a point-in-time list observation, not a restart completion proof.
 *
 * @responsibility Docker Wsl 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input registeredResult: WslListCompletion、runningResult: WslListCompletion
 * @returns DockerWslStateを返す。
 * @precondition 「registeredResult: WslListCompletion、runningResult: WslListCompletion」がobserveDockerWslStateの入力契約を満たす。
 * @postcondition observeDockerWslStateの責務を完了した結果だけを返す。
 * @effect N/A: observeDockerWslStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeDockerWslStateは独自の失敗分岐を所有しない。
 * @invariant observeDockerWslStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerWslStateはProcess内の同一Subsystemで完結する。
 * @security observeDockerWslStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerWslStateは共有非同期状態を持たない同期処理である。
 */
export function observeDockerWslState(
  registeredResult: WslListCompletion,
  runningResult: WslListCompletion,
): DockerWslState {
  const registeredNames = parseDistributionList(registeredResult);
  const runningNames = parseDistributionList(runningResult);
  if (
    !registeredNames ||
    !runningNames ||
    !registeredNames.includes("docker-desktop") ||
    runningNames.some((name) => !registeredNames.includes(name))
  )
    return "unknown";
  return runningNames.includes("docker-desktop") ? "running" : "stopped";
}
