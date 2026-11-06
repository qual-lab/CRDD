/**
 * 旧九操作のargv Oracleを有限試験だけに保持する。
 * @packageDocumentation
 * @responsibility 過去のCommand差反証と旧Session代役を維持し製品のCompilerにしない。
 * @trace ARCH-000008
 * @boundary tests/scripts専用。共通技術Requestの実行保証は製品Lifecycle試験が所有する。
 */
import path from "node:path";
import { types } from "node:util";
import type { DockerIsolationCommandInput } from "../../../executor/src/lifecycle/types.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "../../src/execution/plan.ts";
import {
  type DockerNetworkPolicy,
  parseDockerNetworkPolicy,
  prepareDockerNetworkPolicy,
} from "../../src/network/policy.ts";

/** 旧Command計画の固定Identity文法を保持する有限Oracle。製品の検査には使用しない。 */
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
 * 固定構成と保存済みcommand集合の完全一致を照合する。
 * @responsibility 用途・順序・全argvを同じ技術計画Ownerで比較する。
 * @trace ARCH-000004 ARCH-000008
 * @input input: 解決済み技術構成。commands: 上位が相関した元command集合。
 * @returns 再生成でき全要素が一致する場合だけtrue。
 * @precondition 上位がTask・許可・元Operationの相関を照合する。
 * @postcondition 一致から実行許可・Process開始・回収完了を推定しない。
 * @effect 固定Seccompの同一性確認に必要な読取りだけを行う。
 * @failure 構成拒否・用途・順序・argv差はfalse。読取り失敗は既存計画の拒否へ従う。
 * @invariant command生成と検査の技術定数を上位へ複製しない。
 * @boundary 上位の元計画とDocker技術構成。
 * @security Provider本文・秘密値を診断へ返さない。
 * @concurrency 同期照合で新しい状態やLockを持たない。
 */
export function dockerIsolationCommandsMatch(
  input: DockerIsolationCommandInput,
  commands: readonly Readonly<{ purpose: string; argv: readonly string[] }>[],
) {
  const expected = planDockerIsolationCommands(input);
  return (
    expected !== null &&
    commands.length === expected.length &&
    commands.every(
      (command, index) =>
        command.purpose === expected[index]?.purpose &&
        command.argv.length === expected[index]?.argv.length &&
        command.argv.every(
          (value, position) => value === expected[index]?.argv[position],
        ),
    )
  );
}

const DIAGNOSTIC_COMMAND_LIMIT = 9;
// 固定包装171引数（最大64環境変数と通信設定の大小文字環境を含む）＋既存payload上限256。

const DIAGNOSTIC_CREATE_ARGUMENT_LIMIT = 427;

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
 * @invariant imageは最後の単一位置引数。env名・順序と21／23引数の包装を固定する。
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
      if (!item || typeof item !== "object" || types.isProxy(item)) return null;
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
    const values = snapshotDockerBoundaryArray(candidate, 23);
    if (
      (values?.length !== 21 && values?.length !== 23) ||
      values.some((value) => typeof value !== "string")
    )
      return null;
    const argv = values as string[];
    const token = argv[17]?.startsWith("CRDD_PROXY_AUTH=")
      ? argv[17].slice(16)
      : "";
    const profile = argv[19]?.startsWith("CRDD_PROXY_PROFILE=")
      ? argv[19].slice(19)
      : "";
    const networkPolicy =
      argv.length === 23 && argv[21]?.startsWith("CRDD_PROXY_NETWORK_POLICY=")
        ? parseDockerNetworkPolicy(
            JSON.parse(argv[21].slice("CRDD_PROXY_NETWORK_POLICY=".length)),
          )
        : null;
    if (
      argv.length === 23 &&
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
      types.isProxy(value) ||
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
      if (!item || typeof item !== "object" || types.isProxy(item)) return null;
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
  const preparedPolicy =
    input.proxy.additionalHosts == null
      ? null
      : prepareDockerNetworkPolicy(
          input.proxy.profile,
          input.proxy.additionalHosts,
        );
  if (preparedPolicy?.status === "blocked") return null;
  const networkPolicy =
    preparedPolicy?.status === "ready" ? preparedPolicy.policy : null;
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
