/**
 * 一回の隔離実行のDocker引数を閉じた技術構成から生成する。
 *
 * @responsibility Network、権限制限、Mountと九purposeの構築を所有する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 */
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { describeDockerProviderAssets } from "../image/assets.ts";
import {
  parseDockerNetworkPolicy,
  type DockerNetworkPolicy,
} from "../network/policy.ts";

/**
 * 公式助言Imageと未解決の旧助言Imageにinitを要求する。
 *
 * @responsibility 起動計画、Effect直前検査と耐久Recoveryで同じinit適用条件を使う。
 * @trace ARCH-000004
 * @input operationMode: 実行方式、imageDigest: 固定Image Identity。
 * @returns 助言方式と現行または回復対象の旧Imageが一致する場合だけtrue。
 * @precondition 呼出し側がcreate_provider以外へ適用しない。
 * @postcondition 通常TaskとClaude助言へ波及させず、旧exact Recoveryの構成を保持する。
 * @effect N/A: 固定Identityを比較するだけである。
 * @failure N/A: 不一致はfalseとして返す。
 * @invariant 専用Imageであることを名前やtagから推測しない。
 * @boundary Provider作成とexactな終了後検査・Recoveryの共通境界。
 * @security 戻り値は削除Authorityではなく構成上の必要条件だけを示す。
 * @concurrency N/A: 同期の純粋比較である。
 */
export function codexAdviceProviderInitRequired(
  operationMode: string,
  imageDigest: string | null,
) {
  return (
    operationMode === "workbench_advice" &&
    (imageDigest ===
      describeDockerProviderAssets("codex").adviceIdentity.fixedImageDigest ||
      imageDigest ===
        "sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36")
  );
}

const executorSeccompProfilePath = fileURLToPath(
  new URL("./codex-executor-seccomp.json", import.meta.url),
);

/**
 * 固定ExecutorのSeccomp実物を同一性・容量・Hashで照合する。
 *
 * @responsibility Fixed Codex Executor Seccomp Profileの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input expectedSha256: string、expectedBytes: number
 * @returns resolveFixedCodexExecutorSeccompProfileの計算結果を返す。
 * @precondition 「expectedSha256: string、expectedBytes: number」がresolveFixedCodexExecutorSeccompProfileの入力契約を満たす。
 * @postcondition resolveFixedCodexExecutorSeccompProfileの責務を完了した結果だけを返す。
 * @effect resolveFixedCodexExecutorSeccompProfileは固定Artifactのmetadataと本文だけを読み取る。
 * @failure resolveFixedCodexExecutorSeccompProfileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveFixedCodexExecutorSeccompProfileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resolveFixedCodexExecutorSeccompProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveFixedCodexExecutorSeccompProfileは共有非同期状態を持たない同期処理である。
 */
function resolveFixedCodexExecutorSeccompProfile(
  expectedSha256: string,
  expectedBytes: number,
) {
  try {
    const before = fs.lstatSync(executorSeccompProfilePath, {
      bigint: true,
    });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size !== BigInt(expectedBytes) ||
      fs.realpathSync.native(executorSeccompProfilePath) !==
        executorSeccompProfilePath
    ) {
      return null;
    }
    const bytes = fs.readFileSync(executorSeccompProfilePath);
    const after = fs.lstatSync(executorSeccompProfilePath, {
      bigint: true,
    });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      createHash("sha256").update(bytes).digest("hex") !== expectedSha256
    ) {
      return null;
    }
    return executorSeccompProfilePath;
  } catch {
    return null;
  }
}

const DIAGNOSTIC_COMMAND_LIMIT = 9;
// 固定包装172引数（最大64環境変数と通信設定の大小文字環境を含む）＋既存payload上限256。
const DIAGNOSTIC_CREATE_ARGUMENT_LIMIT = 428;

/**
 * 固定Proxy Containerの包装を一箇所で構築する。
 * @responsibility 九操作の生成と保存済み包装の照合で同じ固定引数を使う。
 * @trace ARCH-000004
 * @input network、name、label、token、profile、image: 検証対象の固定構成値。
 * @returns 固定option、二envと任意の検査済み通信設定env、末尾imageだけの引数配列。
 * @precondition 呼出し元が各値の型・意味と利用許可を確認する。
 * @postcondition payloadや任意optionを追加しない。
 * @effect N/A: 配列構築だけ。
 * @failure N/A: 各値の拒否は呼出し元が所有する。
 * @invariant Proxy包装の技術定数を上位へ複製しない。
 * @boundary 上位構成と固定Docker包装。
 * @security tokenを診断・logへ出力しない。
 * @concurrency N/A: 純粋同期処理。
 */
function planProxyContainerArguments(
  network: string,
  name: string,
  label: string,
  token: string,
  profile: string,
  image: string,
  networkPolicy: DockerNetworkPolicy | null = null,
) {
  return [
    "create",
    "--pull=never",
    "--network",
    network,
    "--network-alias",
    "proxy",
    "--read-only",
    "--name",
    name,
    "--label",
    label,
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=64",
    "--user=65534:65534",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=16777216",
    "--env",
    `CRDD_PROXY_AUTH=${token}`,
    "--env",
    `CRDD_PROXY_PROFILE=${profile}`,
    ...(networkPolicy
      ? ["--env", `CRDD_PROXY_NETWORK_POLICY=${JSON.stringify(networkPolicy)}`]
      : []),
    image,
  ];
}

/**
 * 元create_proxy一件の固定包装からだけProxy構成を投影する。
 * @responsibility 他purpose・包装外・重複envを意味情報へ昇格しない。
 * @trace ARCH-000004
 * @input commands: 九操作以内の元計画、image: 同じProxyの固定digest。
 * @returns 凍結したprofile/token/networkPolicy、またはnull。
 * @precondition profileと上位Providerの一致は呼出し元が判定する。
 * @postcondition raw argvを返さず、実行許可も発行しない。
 * @effect N/A: own dataの有界snapshotと純粋照合だけ。
 * @failure 欠測・重複・型不正・包装差・payload追加はnull。
 * @invariant imageは最後の単一位置引数。env名・順序と22／24引数の包装を固定する。
 * @boundary 保存済みDocker包装と上位意味相関。
 * @security getter・Proxyを評価せずtokenをlogへ出力しない。
 * @concurrency N/A: 同期処理。
 */
export function projectDockerProxyConfiguration(
  commands: unknown,
  image: string,
) {
  try {
    if (typeof image !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(image))
      return null;
    const items = snapshotDockerBoundaryArray(
      commands,
      DIAGNOSTIC_COMMAND_LIMIT,
    );
    if (!items) return null;
    let candidate: unknown = null;
    let found = false;
    for (const item of items) {
      if (!item || typeof item !== "object" || utilTypes.isProxy(item))
        return null;
      const purpose = Object.getOwnPropertyDescriptor(item, "purpose");
      const args = Object.getOwnPropertyDescriptor(item, "argv");
      if (
        !purpose ||
        !Object.hasOwn(purpose, "value") ||
        typeof purpose.value !== "string" ||
        !args ||
        !Object.hasOwn(args, "value")
      )
        return null;
      if (purpose.value !== "create_proxy") continue;
      if (found) return null;
      found = true;
      candidate = args.value;
    }
    const values = snapshotDockerBoundaryArray(candidate, 24);
    if (
      (values?.length !== 22 && values?.length !== 24) ||
      values.some((value) => typeof value !== "string")
    )
      return null;
    const argv = values as string[];
    const token = argv[18]?.startsWith("CRDD_PROXY_AUTH=")
      ? argv[18].slice(16)
      : "";
    const profile = argv[20]?.startsWith("CRDD_PROXY_PROFILE=")
      ? argv[20].slice(19)
      : "";
    const networkPolicy =
      argv.length === 24 && argv[22]?.startsWith("CRDD_PROXY_NETWORK_POLICY=")
        ? parseDockerNetworkPolicy(
            JSON.parse(argv[22].slice("CRDD_PROXY_NETWORK_POLICY=".length)),
          )
        : null;
    if (
      argv.length === 24 &&
      (!networkPolicy || networkPolicy.provider !== profile)
    )
      return null;
    if (
      !/^[a-f0-9]{64}$/u.test(token) ||
      !/^[a-z][a-z0-9_-]{0,31}$/u.test(profile)
    )
      return null;
    const expected = planProxyContainerArguments(
      argv[3] as string,
      argv[8] as string,
      argv[10] as string,
      token,
      profile,
      image,
      networkPolicy,
    );
    if (expected.some((value, index) => value !== argv[index])) return null;
    return Object.freeze({ profile, token, networkPolicy });
  } catch {
    return null;
  }
}

/**
 * Provider metadataの環境名へContainer内の固定Homeを結合する。
 * @responsibility 上位にContainer内Pathを組み立てさせない。
 * @trace ARCH-000004
 * @input name: 認証CLI metadataの追加Home環境名、または不使用のnull。
 * @returns 一項目の追加環境、空環境、または不正名のnull。
 * @precondition Providerの選択とmetadata取得は上位が所有する。
 * @postcondition 任意値を受け取らず固定Homeだけを生成する。
 * @effect N/A: 値構築だけ。
 * @failure 不正・予約済み技術環境名はnull。
 * @invariant nullを未知のProviderや欠測へ補完しない。
 * @boundary Provider metadataとContainer技術構成。
 * @security Proxy・HOME・TMPDIRの既存固定値を上書きしない。
 * @concurrency N/A: 純粋同期処理。
 */
export function createDockerAuthenticationEnvironment(
  name: string | null,
): Readonly<Record<string, string>> | null {
  if (name === null) return {};
  if (
    typeof name !== "string" ||
    !/^[A-Z][A-Z0-9_]*$/u.test(name) ||
    [
      "HOME",
      "TMPDIR",
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "ALL_PROXY",
      "NO_PROXY",
    ].includes(name)
  )
    return null;
  return { [name]: "/provider-home" };
}

/**
 * 診断入力の配列をgetterやProxyを呼ばずに複製する。
 * @responsibility 診断が不正入力の処理や外部Effectへ発展しない値境界を所有する。
 * @trace ARCH-000008
 * @input value: 配列候補。maximumLength: 固定producerが作る配列の上限。
 * @returns plainな密配列のコピー、またはnull。
 * @precondition 診断用途だけで使用する。
 * @postcondition 入力参照を返さずaccessorを評価しない。
 * @effect N/A: 局所値だけを生成する。
 * @failure 不正shapeと反射失敗はnull。
 * @invariant 拒否を資源不存在や安全性成立へ変換しない。
 * @boundary 私有診断入力の値検査。
 * @security 実行許可・秘密値の公開を行わない。
 * @concurrency N/A: 同期処理。
 */
function snapshotDockerBoundaryArray(
  value: unknown,
  maximumLength: number,
): unknown[] | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    )
      return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value"))
      return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > maximumLength)
      return null;
    if (Reflect.ownKeys(value).length !== length + 1) return null;
    const items: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      items.push(descriptor.value);
    }
    return items;
  } catch {
    return null;
  }
}

/**
 * 固定Docker包装の設定と内側の実行引数を分離する。
 * @responsibility imageより前のDocker optionだけを診断し、payloadを解釈しない。
 * @trace ARCH-000008
 * @input commands: 私有計画のコマンド列。imageDigest: 同計画の固定image。
 * @returns 三つの構成値と凍結payload、または分離不能のnull。
 * @precondition 実行前に検査済みの計画を同じOwnerから渡す。
 * @postcondition payload中の同名flagやdigestをDocker設定へ数えない。
 * @effect N/A: 診断の値投影だけ。
 * @failure 欠測・重複・不正shape・未知包装はnull。実行結果は変更しない。
 * @invariant 設定値は実行時の隔離成立・Authority・資源不存在を証明しない。
 * @boundary Docker包装と不透明な内側payload。
 * @security payloadは私有呼出し間だけで使い、通知・ログへ公開しない。
 * @concurrency N/A: 同期で入力不変。
 */
export function projectDockerExecutionBoundary(
  commands: unknown,
  imageDigest: unknown,
) {
  try {
    if (
      typeof imageDigest !== "string" ||
      !/^sha256:[a-f0-9]{64}$/u.test(imageDigest)
    )
      return null;
    const items = snapshotDockerBoundaryArray(
      commands,
      DIAGNOSTIC_COMMAND_LIMIT,
    );
    if (!items) return null;
    let candidate: unknown = null;
    let hasCandidate = false;
    for (const item of items) {
      if (!item || typeof item !== "object" || utilTypes.isProxy(item))
        return null;
      const purpose = Object.getOwnPropertyDescriptor(item, "purpose");
      const args = Object.getOwnPropertyDescriptor(item, "argv");
      if (
        Reflect.ownKeys(item).length !== 2 ||
        !purpose ||
        !Object.hasOwn(purpose, "value") ||
        typeof purpose.value !== "string" ||
        !args ||
        !Object.hasOwn(args, "value")
      )
        return null;
      if (
        Object.getPrototypeOf(item) !== Object.prototype &&
        Object.getPrototypeOf(item) !== null
      )
        return null;
      if (purpose.value !== "create_provider") continue;
      if (hasCandidate) return null;
      hasCandidate = true;
      candidate = args.value;
    }
    const values = snapshotDockerBoundaryArray(
      candidate,
      DIAGNOSTIC_CREATE_ARGUMENT_LIMIT,
    );
    if (!values || values.some((value) => typeof value !== "string"))
      return null;
    const argv = values as string[];
    if (argv[0] !== "create") return null;
    const options = new Map<string, string | true>();
    const repeated = new Set(["--env", "--mount", "--security-opt"]);
    const bare = new Set(["--init", "--interactive", "--read-only"]);
    const paired = new Set([
      "--network",
      "--name",
      "--label",
      "--env",
      "--mount",
      "--user",
      "--workdir",
    ]);
    const equal = new Set([
      "--pull",
      "--network",
      "--cap-drop",
      "--security-opt",
      "--pids-limit",
      "--user",
      "--workdir",
    ]);
    for (let index = 1; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === undefined) return null;
      if (!token.startsWith("--")) {
        if (token !== imageDigest) return null;
        return Object.freeze({
          rootFilesystemReadOnlyConfigured: options.get("--read-only") === true,
          nonRootUserConfigured: options.get("--user") === "65534:65534",
          workdirConfigured: options.get("--workdir") === "/work",
          payloadArgv: Object.freeze(argv.slice(index + 1)),
        });
      }
      const separator = token.indexOf("=");
      const key = separator < 0 ? token : token.slice(0, separator);
      let value: string | true;
      if (separator >= 0 && equal.has(key)) value = token.slice(separator + 1);
      else if (bare.has(token)) value = true;
      else if (paired.has(token)) {
        const next = argv[++index];
        if (next === undefined || next.startsWith("--")) return null;
        value = next;
      } else return null;
      if (options.has(key) && !repeated.has(key)) return null;
      options.set(key, value);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Docker準備候補の固定資源名の型契約。
 *
 * @responsibility 認証・実行・Proxyと二Networkの名前対応を保持する。
 * @trace ARCH-000008
 * @shape 五資源名とownershipLabel。
 * @invariant 各値は準備名であり実資源の存在・所有を証明しない。
 * @boundary 計画生成とDocker実行Ownerの間。
 * @security 名前からcleanup Authorityを発行しない。
 * @compatibility 既存の有限実行namespaceとprefixと命名規則を維持する。
 */
export type DockerIsolationResourceNames = Readonly<{
  internalNetworkName: string;
  egressNetworkName: string;
  proxyContainerName: string;
  authContainerName: string;
  providerContainerName: string;
  ownershipLabel: string;
}>;

/**
 * 所定byte数のBufferから内部計画用のhex値を生成する。
 *
 * @responsibility 乱数取得結果の型と長さを確認する。
 * @trace ARCH-000008
 * @input state: 呼出し側の乱数Owner。bytes: 固定取得長。
 * @returns hex値、または型・長さ不一致に対するnull。
 * @precondition bytesは準備Ownerが8または32へ固定する。
 * @postcondition 取得結果を一回だけ検査し、受理時だけhexへ変換する。
 * @effect 呼出し側が所有する乱数生成を一回呼ぶ。Docker・Filesystem要求は発行しない。
 * @failure Buffer以外またはbyte長不一致をnullで拒否する。取得例外は呼出し側へ伝播する。
 * @invariant 不正な取得値を切詰め・補完しない。
 * @boundary 乱数OwnerとDocker準備値の間。
 * @security Proxy Tokenへ利用する値を公開結果やログへ渡さない。
 * @concurrency N/A: 同期取得だけでStoreを所有しない。
 */
export function createDockerIsolationRandomHex(
  state: Readonly<{ randomBytes: (size: number) => Buffer }>,
  bytes: number,
): string | null {
  const value = state.randomBytes(bytes);
  return Buffer.isBuffer(value) && value.byteLength === bytes
    ? value.toString("hex")
    : null;
}

/**
 * 照合済みIdentityと固定実行namespaceからDocker資源名を生成する。
 *
 * @responsibility 実行Identityの64桁hex検査、既存prefixと63文字上限を所有する。
 * @trace ARCH-000008
 * @input executionNamespace: 固定実行namespace。executionIdentityHash: 上位照合済みIdentity。suffix: 取得済み8byteのhex。
 * @returns 五資源名と所有label、または不正Identity・過大名に対するnull。
 * @precondition suffixは同じ準備Ownerの乱数検査に成功している。
 * @postcondition 実行名はIdentity Hash先頭16桁へ、他の資源とlabelはsuffixへ結合する。
 * @effect N/A: 局所文字列の生成だけを行う。
 * @failure 実行Identity形式不正または63文字を超える資源名をnullで拒否する。
 * @invariant 名前やlabelを実資源所有の証明として扱わない。
 * @boundary 準備IdentityとDocker資源名の間。
 * @security HashとsuffixからAuthorityを生成せず、削除許可にも利用しない。
 * @concurrency N/A: 同期計算であり資源の取得・排他を行わない。
 */
export function createDockerIsolationResourceNames(
  executionNamespace: string,
  executionIdentityHash: string,
  suffix: string,
): DockerIsolationResourceNames | null {
  if (executionNamespace !== "codex" && executionNamespace !== "claude")
    return null;
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const authContainerName = `crdd-auth-${suffix}`;
  if (!/^[a-f0-9]{64}$/u.test(executionIdentityHash)) return null;
  const providerContainerName = `crdd-${executionNamespace}-${executionIdentityHash.slice(0, 16)}`;
  if (
    [
      internalNetworkName,
      egressNetworkName,
      proxyContainerName,
      authContainerName,
      providerContainerName,
    ].some((value) => value.length > 63)
  )
    return null;
  return {
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    authContainerName,
    providerContainerName,
    ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
  };
}

/**
 * Docker資源名・所有Label・固定Imageの文法を確認する。
 *
 * @responsibility 五資源名の文法と重複、Labelと二digestの固定形式を一箇所で判定する。
 * @trace ARCH-000008
 * @input input: 五資源名、ownershipLabel、executionImageDigest、proxyImageDigest。
 * @returns 全項目が文字列・固定文法であり五資源名が相異なる場合だけtrue。
 * @precondition 呼出し側がTask・Provider・Authorityとの意味相関を別に確認する。
 * @postcondition 入力を変更せず、文法以外の成立を推定しない。
 * @effect N/A: 同期文字列検査だけ。Filesystem・Artifact・Processを観測しない。
 * @failure 不正型・欠測・不正文法・重複はfalse。
 * @invariant trueは所有権、実行許可、資源存在または清掃完了を証明しない。
 * @boundary 上位の非秘密Identity投影とDocker技術文法。
 * @security 本文・認証値・Authorityを入力に持たず、外部へ公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function dockerIsolationResourceIdentityIsValid(
  input: Readonly<{
    authenticationContainerName: string;
    executionContainerName: string;
    proxyContainerName: string;
    internalNetworkName: string;
    egressNetworkName: string;
    ownershipLabel: string;
    executionImageDigest: string;
    proxyImageDigest: string;
  }>,
): boolean {
  if (!input || typeof input !== "object") return false;
  const names = [
    input.authenticationContainerName,
    input.executionContainerName,
    input.proxyContainerName,
    input.internalNetworkName,
    input.egressNetworkName,
  ];
  return (
    names.every(
      (name) =>
        typeof name === "string" &&
        /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u.test(
          name,
        ),
    ) &&
    new Set(names).size === names.length &&
    typeof input.ownershipLabel === "string" &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(input.ownershipLabel) &&
    [input.executionImageDigest, input.proxyImageDigest].every(
      (digest) =>
        typeof digest === "string" && /^sha256:[a-f0-9]{64}$/u.test(digest),
    )
  );
}

/**
 * Container内起動payloadと隔離資源の構築入力。
 *
 * @responsibility Dockerの技術構成だけを保持し、Task・許可・モデルの意味を所有しない。
 * @trace ARCH-000004
 * @shape 三Container、二Network、固定Image、Mount、起動payload、Proxy接続構成。
 * @invariant Docker argv全体や任意Host環境は入力にしない。
 * @boundary 上位の検証済み起動記述から隔離計画への境界。
 * @security 認証値はContainer環境へ搬送するだけで診断へ公開しない。
 * @compatibility 既存九purposeと固定Docker flagの順序を維持する。
 */
export type DockerIsolationCommandInput = Readonly<{
  authenticationContainerName: string;
  executionContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  executionImageDigest: string;
  proxyImageDigest: string;
  homeSourcePath: string;
  temporarySourcePath: string;
  workspace: Readonly<{
    sourcePath: string;
    readOnly: boolean;
    protection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
  }> | null;
  authentication: Readonly<{
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
  }>;
  execution: Readonly<{
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
    interactive: boolean;
    initRequired: boolean;
    seccompProfile: Readonly<{ sha256: string; bytes: number }> | null;
  }>;
  proxy: Readonly<{
    profile: string;
    token: string;
    port: number;
    extendedProxyEnvironment: boolean;
    networkPolicy?: DockerNetworkPolicy | null;
  }>;
}>;

/**
 * 閉じたDocker操作purposeと構築済み引数。
 *
 * @responsibility 生成した操作と引数の対応を一つの値として所有する。
 * @trace ARCH-000004
 * @shape 九purposeのうち一つと不変argv配列。
 * @invariant Callerが任意Docker操作を追加する入力ではない。
 * @boundary 計画構築からEffect発行前の照合へ搬送する。
 * @security 実行許可や所有資源の証明をこの値だけから発行しない。
 * @compatibility 既存操作のpurpose文字列を維持する。
 */
export type DockerIsolationCommand = Readonly<{
  purpose:
    | "create_subscription_auth_probe"
    | "start_subscription_auth_probe_attached"
    | "create_internal_network"
    | "create_egress_network"
    | "create_proxy"
    | "connect_proxy_egress"
    | "create_provider"
    | "start_proxy"
    | "start_provider_attached";
  argv: readonly string[];
}>;

/**
 * 検証済み起動payloadから固定隔離コマンド集合を構築する。
 *
 * @responsibility 権限、Network、Mount、User、出力搬送のDocker構成を固定する。
 * @trace ARCH-000004
 * @input input: 資源名、digest、所在、Container内payloadとProxy構成。
 * @returns 九操作の不変計画。不正入力はnull。
 * @precondition 所在とHome・Workspaceの利用許可を上位Ownerが検証している。
 * @postcondition 任意Docker flagを受けず、全Containerの固定権限制限を付与する。
 * @effect 指定時は固定Seccomp実物だけを読み取る。Process・Docker要求は発行しない。
 * @failure 不正資源名、digest、所在、payload、Proxy値はnullで拒否する。
 * @invariant Provider payloadはImage以後の引数と明示環境にだけ搬送する。
 * @boundary 上位の起動記述と下位Docker構成の境界。
 * @security Secret payloadを返却値以外へ記録せず、shell、特権、Host Networkを追加しない。
 * @concurrency N/A: 入力からの同期構築で共有状態を持たない。
 */
export function planDockerIsolationCommands(
  input: DockerIsolationCommandInput,
): readonly DockerIsolationCommand[] | null {
  const networkPolicy =
    input.proxy.networkPolicy == null
      ? null
      : parseDockerNetworkPolicy(input.proxy.networkPolicy);
  if (
    input.proxy.networkPolicy != null &&
    (!networkPolicy || networkPolicy.provider !== input.proxy.profile)
  )
    return null;
  if ("seccompProfilePath" in input.execution) return null;
  const seccomp = input.execution.seccompProfile;
  if (
    seccomp !== null &&
    (!seccomp ||
      typeof seccomp !== "object" ||
      typeof seccomp.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(seccomp.sha256) ||
      !Number.isSafeInteger(seccomp.bytes) ||
      seccomp.bytes < 1)
  )
    return null;
  const seccompProfilePath =
    seccomp === null
      ? null
      : resolveFixedCodexExecutorSeccompProfile(seccomp.sha256, seccomp.bytes);
  if (seccomp !== null && seccompProfilePath === null) return null;
  const paths = [
    input.homeSourcePath,
    input.temporarySourcePath,
    ...(input.workspace ? [input.workspace.sourcePath] : []),
    ...(input.workspace?.protection
      ? [
          input.workspace.protection.gitSourcePath,
          input.workspace.protection.internalSourcePath,
        ]
      : []),
    ...(seccompProfilePath ? [seccompProfilePath] : []),
  ];
  if (
    !dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: input.authenticationContainerName,
      executionContainerName: input.executionContainerName,
      proxyContainerName: input.proxyContainerName,
      internalNetworkName: input.internalNetworkName,
      egressNetworkName: input.egressNetworkName,
      ownershipLabel: input.ownershipLabel,
      executionImageDigest: input.executionImageDigest,
      proxyImageDigest: input.proxyImageDigest,
    }) ||
    paths.some(
      (value) =>
        typeof value !== "string" ||
        !path.isAbsolute(value) ||
        /[\0\r\n,]/u.test(value),
    ) ||
    !/^[a-f0-9]{64}$/u.test(input.proxy.token) ||
    !/^[a-z][a-z0-9_-]{0,31}$/u.test(input.proxy.profile) ||
    !Number.isSafeInteger(input.proxy.port) ||
    input.proxy.port < 1 ||
    input.proxy.port > 65535 ||
    typeof input.execution.interactive !== "boolean" ||
    typeof input.execution.initRequired !== "boolean" ||
    typeof input.proxy.extendedProxyEnvironment !== "boolean" ||
    (input.workspace !== null &&
      typeof input.workspace.readOnly !== "boolean") ||
    [input.authentication, input.execution].some(
      (payload) =>
        !Array.isArray(payload.argv) ||
        payload.argv.length > 256 ||
        payload.argv.some(
          (value) => typeof value !== "string" || value.includes("\0"),
        ) ||
        Object.keys(payload.environment).length > 64 ||
        Object.entries(payload.environment).some(
          ([name, value]) =>
            !/^[A-Z][A-Z0-9_]*$/u.test(name) ||
            [
              "HOME",
              "TMPDIR",
              "HTTPS_PROXY",
              "HTTP_PROXY",
              "ALL_PROXY",
              "NO_PROXY",
            ].includes(name) ||
            typeof value !== "string" ||
            value.includes("\0"),
        ) ||
        Buffer.byteLength(JSON.stringify(payload), "utf8") > 128 * 1024,
    )
  )
    return null;

  const authenticationEnvironmentEntries = Object.entries(
    input.authentication.environment,
  ).flatMap(([name, value]) => ["--env", `${name}=${value}`]);
  const executionEnvironmentEntries = [
    "--env",
    "HOME=/provider-home",
    "--env",
    "TMPDIR=/tmp",
    "--env",
    `HTTPS_PROXY=http://crdd:${input.proxy.token}@proxy:${input.proxy.port}`,
    ...(networkPolicy
      ? [
          "HTTP_PROXY",
          "ALL_PROXY",
          "NO_PROXY",
          "https_proxy",
          "http_proxy",
          "all_proxy",
          "no_proxy",
        ].flatMap((name) => [
          "--env",
          `${name}=${name.toLowerCase() === "no_proxy" ? "" : `http://crdd:${input.proxy.token}@proxy:${input.proxy.port}`}`,
        ])
      : input.proxy.extendedProxyEnvironment
        ? [
            "--env",
            `HTTP_PROXY=http://crdd:${input.proxy.token}@proxy:${input.proxy.port}`,
            "--env",
            `ALL_PROXY=http://crdd:${input.proxy.token}@proxy:${input.proxy.port}`,
            "--env",
            "NO_PROXY=",
          ]
        : []),
    ...Object.entries(input.execution.environment).flatMap(([name, value]) => [
      "--env",
      `${name}=${value}`,
    ]),
  ];
  const providerHomeMount = `type=bind,src=${input.homeSourcePath},dst=/provider-home,bind-propagation=rprivate`;
  const tmpMount = `type=bind,src=${input.temporarySourcePath},dst=/tmp,bind-propagation=rprivate`;
  const workspaceMount = input.workspace
    ? `type=bind,src=${input.workspace.sourcePath},dst=/work,bind-propagation=rprivate${input.workspace.readOnly ? ",readonly" : ""}`
    : null;
  const commands = [
    [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      input.authenticationContainerName,
      "--label",
      input.ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      "HOME=/provider-home",
      ...authenticationEnvironmentEntries,
      "--mount",
      `${providerHomeMount},readonly`,
      input.executionImageDigest,
      ...input.authentication.argv,
    ],
    ["start", "--attach", input.authenticationContainerName],
    [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      input.ownershipLabel,
      input.internalNetworkName,
    ],
    [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      input.ownershipLabel,
      input.egressNetworkName,
    ],
    planProxyContainerArguments(
      input.internalNetworkName,
      input.proxyContainerName,
      input.ownershipLabel,
      input.proxy.token,
      input.proxy.profile,
      input.proxyImageDigest,
      networkPolicy,
    ),
    ["network", "connect", input.egressNetworkName, input.proxyContainerName],
    [
      "create",
      ...(input.execution.initRequired ? ["--init"] : []),
      ...(input.execution.interactive ? ["--interactive"] : []),
      "--pull=never",
      "--network",
      input.internalNetworkName,
      "--read-only",
      "--name",
      input.executionContainerName,
      "--label",
      input.ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      ...(seccompProfilePath
        ? [`--security-opt=seccomp=${seccompProfilePath}`]
        : []),
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...executionEnvironmentEntries,
      "--mount",
      providerHomeMount,
      "--mount",
      tmpMount,
      ...(workspaceMount ? ["--mount", workspaceMount] : []),
      ...(input.workspace?.protection
        ? [
            "--mount",
            `type=bind,src=${input.workspace.protection.gitSourcePath},dst=/work/.git,bind-propagation=rprivate,readonly`,
            "--mount",
            `type=bind,src=${input.workspace.protection.internalSourcePath},dst=/work/.crdd,bind-propagation=rprivate,readonly`,
          ]
        : []),
      input.executionImageDigest,
      ...input.execution.argv,
    ],
    ["start", input.proxyContainerName],
    [
      "start",
      "--attach",
      ...(input.execution.interactive ? ["--interactive"] : []),
      input.executionContainerName,
    ],
  ];
  const purposes = [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ] as const;
  const result: DockerIsolationCommand[] = [];
  for (let index = 0; index < commands.length; index += 1) {
    const argv = commands[index];
    const purpose = purposes[index];
    if (!argv || !purpose) return null;
    result.push(Object.freeze({ purpose, argv: Object.freeze(argv) }));
  }
  return Object.freeze(result);
}
