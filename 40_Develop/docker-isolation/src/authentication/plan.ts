/**
 * 認証用の使い捨てDocker資源と固定操作を構築する。
 * @responsibility Home利用Authorityや認証結果を持たず、隔離・stdioの技術計画を所有する。
 * @trace ARCH-000008
 */
import path from "node:path";
import { types as utilTypes } from "node:util";

/**
 * 検査済み認証起動記述と借用Homeの技術入力。
 * @responsibility Providerの意味と固定Docker構成を分離する。
 * @trace ARCH-000008
 * @shape 固定資源名、Image digest、Proxy構成、Home所在とContainer内CLI payload。
 * @invariant WorkspaceやRepository mountを受け取らない。
 * @boundary 上位認証許可と下位隔離構成。
 * @security 秘密認証値を入力にせず短命Proxy tokenだけを搬送する。
 * @compatibility 既存五資源・操作順序を保持する。
 */
export type DockerAuthenticationInput = Readonly<{
  providerHomeSourcePath: string;
  providerImageDigest: string;
  ownershipLabel: string;
  probeContainerName: string;
}> &
  (
    | Readonly<{
        action: "status";
        authenticationCli: Readonly<{
          statusArgv: readonly string[];
          environment: Readonly<Record<string, string>>;
        }>;
      }>
    | Readonly<{
        action: "login";
        proxyImageDigest: string;
        internalNetworkName: string;
        egressNetworkName: string;
        proxyContainerName: string;
        loginContainerName: string;
        proxyToken: string;
        proxyPort: number;
        proxyProfile: "claude" | "codex";
        authenticationCli: Readonly<{
          loginArgv: readonly string[];
          statusArgv: readonly string[];
          environment: Readonly<Record<string, string>>;
        }>;
      }>
  );

/**
 * 生成済み認証Commandの固定技術契約。
 * @responsibility Command本体のcopyを実行許可へ昇格させない。
 * @trace ARCH-000008
 * @shape 固定purpose、argvと対話方式。
 * @invariant 本番実行は元計画が生成したCommandだけを受理する。
 * @boundary 下位計画と下位実行。
 * @security Provider結果やHost認証値を保持しない。
 * @compatibility 上位の既存Command投影を維持する。
 */
export type DockerAuthenticationCommand = Readonly<{
  purpose: string;
  argv: readonly string[];
  interactive: boolean;
}>;
const plannedCommands = new WeakSet<object>();
const plannedPlans = new WeakSet<object>();
const recoveryCommands = new WeakMap<
  object,
  Readonly<{
    plan: DockerAuthenticationPlan;
    role: "observe" | "remove" | "absence";
    create: DockerAuthenticationCommand;
    dockerId: string;
    removal: DockerAuthenticationCommand;
  }>
>();

/**
 * 一回生成した認証技術計画の操作集合。
 * @responsibility Plan単位の操作相関を型で固定する。
 * @trace ARCH-000008
 * @shape 開始、所有観測、清掃、不存在の凍結操作列。
 * @invariant 同形の別Planを同じ実行計画と扱わない。
 * @boundary Plan生成と実行。
 * @security Plan相関は上位Authorityを発行しない。
 * @compatibility 既存操作列を維持する。
 */
export type DockerAuthenticationPlan = Readonly<{
  commands: readonly DockerAuthenticationCommand[];
  creationObservationCommands: readonly DockerAuthenticationCommand[];
  creationImageCommands: readonly DockerAuthenticationCommand[];
  ownershipCommands: readonly DockerAuthenticationCommand[];
  cleanupCommands: readonly DockerAuthenticationCommand[];
  absenceCommands: readonly DockerAuthenticationCommand[];
}>;

/**
 * 同Processの元Planを照合する。
 * @responsibility Planコピーを実行所属へ昇格させない。
 * @trace ARCH-000008
 * @input plan: 元計画候補。
 * @returns 元Planだけtrue。
 * @precondition 生成済みPlanは凍結されている。
 * @postcondition 外部Effectを発行しない。
 * @effect N/A: 局所object相関のみ。
 * @failure 不正値はfalse。
 * @invariant 公開IDや永続Registryを作らない。
 * @boundary 下位計画と実行。
 * @security 名前・形状をAuthorityにしない。
 * @concurrency 同Processの元objectだけを照合する。
 */
export function dockerAuthenticationPlanIsPlanned(
  plan: unknown,
): plan is DockerAuthenticationPlan {
  return typeof plan === "object" && plan !== null && plannedPlans.has(plan);
}

/**
 * Commandが指定した元Planへ所属するか照合する。
 * @responsibility 別Planの元Commandも拒否する。
 * @trace ARCH-000008
 * @input command、plan: 元操作と元計画。
 * @returns 同じ元Planの操作だけtrue。
 * @precondition 配列はPlan生成時に凍結される。
 * @postcondition 入力を変更しない。
 * @effect N/A: 局所相関のみ。
 * @failure 未生成・別Plan・copyはfalse。
 * @invariant Package全体の生成済み判定だけで実行しない。
 * @boundary 元計画と固定操作。
 * @security 新Authorityを発行しない。
 * @concurrency 固定Plan内で同期照合する。
 */
export function dockerAuthenticationCommandBelongsToPlan(
  command: unknown,
  plan: unknown,
): command is DockerAuthenticationCommand {
  return (
    dockerAuthenticationPlanIsPlanned(plan) &&
    dockerAuthenticationCommandIsPlanned(command) &&
    (recoveryCommands.get(command)?.plan === plan ||
      [
        plan.commands,
        plan.creationObservationCommands,
        plan.creationImageCommands,
        plan.ownershipCommands,
        plan.cleanupCommands,
        plan.absenceCommands,
      ].some((commands) => commands.includes(command)))
  );
}

/**
 * 元計画の一資源を保存済み実IDへ結合する。
 * @responsibility 名前指定削除を公開せず実ID指定の観測・回収・不存在を生成する。
 * @trace ARCH-000008
 * @input plan: 元計画。name: 元資源名。dockerId: 上位保存OwnerのReceipt。
 * @returns 同じ元計画へ結合した技術操作列。
 * @precondition 保存相関と処置許可は上位が確認する。
 * @postcondition 別名・不正ID・Plan copyは部分操作を返さない。
 * @effect N/A: 同Processの固定操作生成のみ。
 * @failure 不正入力は例外で開始前拒否する。
 * @invariant 新Registry・保存State・回復Identityを作らない。
 * @boundary 上位Receiptと固定Docker実ID操作。
 * @security 名前とLabelだけでは削除を生成しない。
 * @concurrency 凍結Planと実IDだけを技術操作へ結合する。
 */
export function planDockerAuthenticationResourceRecovery(
  plan: DockerAuthenticationPlan,
  name: string,
  dockerId: string,
) {
  if (
    !dockerAuthenticationPlanIsPlanned(plan) ||
    !/^[a-f0-9]{64}$/u.test(dockerId)
  )
    throw Error("docker_authentication_recovery_input_invalid");
  const index = plan.absenceCommands.findIndex(
    (item) => item.argv.at(-1) === name,
  );
  const originalObservation = plan.ownershipCommands[index];
  const originalRemoval = plan.cleanupCommands[index];
  const namedAbsence = plan.absenceCommands[index];
  const create = plan.commands.find(
    (item) =>
      item.purpose === originalRemoval?.purpose.replace("remove_", "create_"),
  );
  if (!originalObservation || !originalRemoval || !namedAbsence || !create)
    throw Error("docker_authentication_recovery_resource_invalid");
  const kind = create.purpose.endsWith("_network") ? "network" : "container";
  const observation = Object.freeze({
    purpose: originalObservation.purpose,
    argv: Object.freeze([kind, "inspect", dockerId]),
    interactive: false,
  });
  const removal = Object.freeze({
    purpose: originalRemoval.purpose,
    argv: Object.freeze(
      kind === "network"
        ? ["network", "rm", dockerId]
        : ["rm", "--force", dockerId],
    ),
    interactive: false,
  });
  const identityAbsence = Object.freeze({
    purpose: namedAbsence.purpose.replace("_absent", "_id_absent"),
    argv: Object.freeze([kind, "inspect", dockerId]),
    interactive: false,
  });
  for (const [item, role] of [
    [observation, "observe"],
    [removal, "remove"],
    [identityAbsence, "absence"],
  ] as const) {
    plannedCommands.add(item);
    recoveryCommands.set(
      item,
      Object.freeze({ plan, role, create, dockerId, removal }),
    );
  }
  return Object.freeze({
    ownershipCommand: observation,
    cleanupCommand: removal,
    identityAbsenceCommand: identityAbsence,
    absenceCommand: namedAbsence,
  });
}

/**
 * 下位実行が元回収操作の非Authority相関を読む。
 * @responsibility 実ID操作を元createと同計画へ照合する。
 * @trace ARCH-000008
 * @input command: 元生成操作。
 * @returns 元相関またはundefined。
 * @precondition 実行側が元Plan所属を別途確認する。
 * @postcondition 保存・許可・Effectを追加しない。
 * @effect N/A: 局所WeakMap読取り。
 * @failure 未生成操作はundefined。
 * @invariant 相関を永続化しない。
 * @boundary 固定回収計画と固定実行。
 * @security 生秘密値を返さない。
 * @concurrency 元objectだけを照合する。
 */
export function dockerAuthenticationRecoveryCommandMetadata(
  command: DockerAuthenticationCommand,
) {
  return recoveryCommands.get(command);
}

/**
 * 元計画が生成したCommandを照合する。
 * @responsibility コピー・未生成Commandによる任意argv実行を拒否する。
 * @trace ARCH-000008
 * @input command: 下位計画の元Command。
 * @returns 元Commandだけtrue。
 * @precondition 生成されたCommandは凍結済み。
 * @postcondition AuthorityやStateを変更しない。
 * @effect N/A: Process内の元object照合のみ。
 * @failure 不正値はfalse。
 * @invariant 名前や形状だけで元Commandと認定しない。
 * @boundary 計画と実行の同Process相関。
 * @security 回復・認証Authorityを発行しない。
 * @concurrency WeakSetは同Processの生成結果だけを保持する。
 */
export function dockerAuthenticationCommandIsPlanned(
  command: unknown,
): command is DockerAuthenticationCommand {
  return (
    typeof command === "object" &&
    command !== null &&
    plannedCommands.has(command)
  );
}

/**
 * 閉じた認証資源から固定Docker操作を構築する。
 * @responsibility read-only、Network、User、Mount、出力非捕捉の固定構成を生成する。
 * @trace ARCH-000008
 * @input input: 検査済み技術起動記述。
 * @returns 固定操作列。各Commandは同Processで実行照合される。
 * @precondition Home利用許可とProvider CLIの意味は上位が確認する。
 * @postcondition 不正入力では部分計画を公開しない。
 * @effect N/A: 局所計画生成だけ。
 * @failure ID・所在・Image・payload・Proxy不正は例外。
 * @invariant 任意Docker argv・追加Mount・特権を受け取らない。
 * @boundary 認証許可済み技術入力とDocker操作。
 * @security 秘密値を読取らずWorkspace／Repositoryをmountしない。
 * @concurrency 入力payloadを同じ生成時にsnapshotする。
 */
export function planDockerAuthenticationCommands(
  input: DockerAuthenticationInput,
) {
  if (
    input === null ||
    typeof input !== "object" ||
    utilTypes.isProxy(input) ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Reflect.ownKeys(input).some(
      (key) =>
        typeof key !== "string" ||
        !("value" in (Object.getOwnPropertyDescriptor(input, key) ?? {})),
    )
  )
    throw Error("docker_authentication_input_invalid");
  if (input.action === "status") return planDockerAuthenticationStatus(input);
  if (input.action !== "login")
    throw Error("docker_authentication_action_invalid");
  const keys = [
    "action",
    "providerHomeSourcePath",
    "providerImageDigest",
    "proxyImageDigest",
    "ownershipLabel",
    "internalNetworkName",
    "egressNetworkName",
    "proxyContainerName",
    "loginContainerName",
    "probeContainerName",
    "proxyToken",
    "proxyPort",
    "proxyProfile",
    "authenticationCli",
  ];
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some(
      (key) => typeof key !== "string" || !keys.includes(key),
    )
  )
    throw Error("docker_authentication_input_invalid");
  const {
    providerHomeSourcePath,
    providerImageDigest,
    proxyImageDigest,
    ownershipLabel,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    probeContainerName,
    proxyToken,
    proxyPort,
    proxyProfile,
  } = input;
  const authenticationCli = snapshotAuthenticationCli(
    input.authenticationCli,
    true,
  );
  if (
    typeof providerHomeSourcePath !== "string" ||
    !path.isAbsolute(providerHomeSourcePath) ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
    typeof providerImageDigest !== "string" ||
    typeof proxyImageDigest !== "string" ||
    typeof ownershipLabel !== "string" ||
    typeof proxyToken !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(providerImageDigest) ||
    !/^sha256:[a-f0-9]{64}$/u.test(proxyImageDigest) ||
    !/^crdd\.coordinator\.authentication=[a-f0-9]{16}$/u.test(ownershipLabel) ||
    !/^[a-f0-9]{64}$/u.test(proxyToken) ||
    !Number.isSafeInteger(proxyPort) ||
    proxyPort < 1 ||
    proxyPort > 65535 ||
    !["claude", "codex"].includes(proxyProfile)
  )
    throw Error("docker_authentication_input_invalid");
  const suffix = ownershipLabel.slice(ownershipLabel.indexOf("=") + 1);
  if (
    internalNetworkName !== `crdd-internal-${suffix}` ||
    egressNetworkName !== `crdd-egress-${suffix}` ||
    proxyContainerName !== `crdd-proxy-${suffix}` ||
    probeContainerName !== `crdd-auth-${suffix}` ||
    loginContainerName !== `crdd-${proxyProfile}-${suffix}`
  )
    throw Error("docker_authentication_resource_invalid");
  const proxyUrl = `http://crdd:${proxyToken}@proxy:${proxyPort}`;
  const homeMount = `type=bind,src=${providerHomeSourcePath},dst=/provider-home,bind-propagation=rprivate`;
  const fixedEnvironmentArguments = [
    "--env",
    "HOME=/provider-home",
    "--env",
    "TMPDIR=/tmp",
    "--env",
    `HTTPS_PROXY=${proxyUrl}`,
    ...Object.entries(authenticationCli.environment).flatMap(
      ([name, value]) => ["--env", `${name}=${value}`],
    ),
  ];
  /**
   * 固定操作の元Commandを凍結する。
   * @responsibility 同じ計画のpurpose・引数・対話方式を生成時に固定する。
   * @trace ARCH-000008
   * @input purpose、argv、isInteractive: 下位が構築した固定操作。
   * @returns 元Command。
   * @precondition この内部生成器へCaller supplied Docker argvを渡さない。
   * @postcondition 元配列の後発変更を搬送しない。
   * @effect N/A: 局所値生成だけ。
   * @failure N/A: 検査は外側の計画入力で実施する。
   * @invariant Commandを凍結し実行照合へ登録する。
   * @boundary 同一計画内の操作生成。
   * @security Authorityや認証結果を生成しない。
   * @concurrency 生成は同期で完了する。
   */
  const command = authenticationCommand;
  const commands = Object.freeze([
    command("create_internal_network", [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      ownershipLabel,
      internalNetworkName,
    ]),
    command("create_egress_network", [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      ownershipLabel,
      egressNetworkName,
    ]),
    command("create_proxy", [
      "create",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--network-alias",
      "proxy",
      "--read-only",
      "--name",
      proxyContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      `CRDD_PROXY_AUTH=${proxyToken}`,
      "--env",
      `CRDD_PROXY_PROFILE=${proxyProfile}`,
      proxyImageDigest,
    ]),
    command("connect_proxy_egress", [
      "network",
      "connect",
      egressNetworkName,
      proxyContainerName,
    ]),
    command("start_proxy", ["start", proxyContainerName]),
    command("create_login", [
      "create",
      "--interactive",
      "--tty",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--read-only",
      "--name",
      loginContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--user=65534:65534",
      "--workdir=/work",
      ...fixedEnvironmentArguments,
      "--mount",
      homeMount,
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=33554432",
      providerImageDigest,
      ...authenticationCli.loginArgv,
    ]),
    command(
      "start_login_attached",
      ["start", "--attach", "--interactive", loginContainerName],
      true,
    ),
    command("create_probe", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      probeContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--user=65534:65534",
      "--env",
      "HOME=/provider-home",
      ...Object.entries(authenticationCli.environment).flatMap(
        ([name, value]) => ["--env", `${name}=${value}`],
      ),
      "--mount",
      `${homeMount},readonly`,
      providerImageDigest,
      ...authenticationCli.statusArgv,
    ]),
    command("start_probe_attached", ["start", "--attach", probeContainerName]),
  ]);
  const cleanupCommands = Object.freeze([
    command("remove_probe", ["rm", "--force", probeContainerName]),
    command("remove_login", ["rm", "--force", loginContainerName]),
    command("remove_proxy", ["rm", "--force", proxyContainerName]),
    command("remove_internal_network", ["network", "rm", internalNetworkName]),
    command("remove_egress_network", ["network", "rm", egressNetworkName]),
  ]);
  const ownershipCommands = Object.freeze([
    command("observe_probe_owner", [
      "container",
      "inspect",
      "--format",
      '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
      probeContainerName,
    ]),
    command("observe_login_owner", [
      "container",
      "inspect",
      "--format",
      '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
      loginContainerName,
    ]),
    command("observe_proxy_owner", [
      "container",
      "inspect",
      "--format",
      '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
      proxyContainerName,
    ]),
    command("observe_internal_network_owner", [
      "network",
      "inspect",
      "--format",
      '{{ index .Labels "crdd.coordinator.authentication" }}',
      internalNetworkName,
    ]),
    command("observe_egress_network_owner", [
      "network",
      "inspect",
      "--format",
      '{{ index .Labels "crdd.coordinator.authentication" }}',
      egressNetworkName,
    ]),
  ]);
  const absenceCommands = Object.freeze([
    command("confirm_probe_absent", [
      "container",
      "inspect",
      probeContainerName,
    ]),
    command("confirm_login_absent", [
      "container",
      "inspect",
      loginContainerName,
    ]),
    command("confirm_proxy_absent", [
      "container",
      "inspect",
      proxyContainerName,
    ]),
    command("confirm_internal_network_absent", [
      "network",
      "inspect",
      internalNetworkName,
    ]),
    command("confirm_egress_network_absent", [
      "network",
      "inspect",
      egressNetworkName,
    ]),
  ]);
  return completeAuthenticationPlan(
    commands,
    ownershipCommands,
    cleanupCommands,
    absenceCommands,
  );
}

/**
 * 認証CLI payloadを実行Propertyなしに固定する。
 * @responsibility loginとstatusで共通の引数・環境の検査を所有する。
 * @trace ARCH-000008
 * @input candidate: CLI記述、login: login引数を必要とするか。
 * @returns 元入力から独立した固定引数と環境。
 * @precondition 認証の意味と許可は上位Ownerが確認する。
 * @postcondition Getter・Proxy・未知fieldを受理しない。
 * @effect N/A: 局所検査とコピーだけ。
 * @failure 不正値は開始前の固定例外。
 * @invariant Host環境とProxy変数をCLI記述から継承しない。
 * @boundary 上位のProvider記述と隔離計画。
 * @security 秘密値を表示・保存しない。
 * @concurrency 同期Snapshot。
 */
function snapshotAuthenticationCli(candidate: unknown, login: boolean) {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    utilTypes.isProxy(candidate) ||
    Object.getPrototypeOf(candidate) !== Object.prototype
  )
    throw Error("docker_authentication_cli_invalid");
  const keys = login
    ? ["loginArgv", "statusArgv", "environment"]
    : ["statusArgv", "environment"];
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  const actual = Reflect.ownKeys(descriptors);
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== "string" || !keys.includes(key)) ||
    keys.some(
      (key) =>
        !descriptors[key] ||
        !Object.hasOwn(descriptors[key], "value") ||
        descriptors[key]?.enumerable !== true,
    )
  )
    throw Error("docker_authentication_cli_invalid");
  const record = candidate as Record<string, unknown>;
  const copied: string[][] = [];
  for (const name of login ? ["loginArgv", "statusArgv"] : ["statusArgv"]) {
    const argv = record[name];
    if (
      !Array.isArray(argv) ||
      utilTypes.isProxy(argv) ||
      Object.getPrototypeOf(argv) !== Array.prototype ||
      Reflect.ownKeys(argv).some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" && !/^(0|[1-9][0-9]*)$/u.test(key)) ||
          !Object.hasOwn(
            Object.getOwnPropertyDescriptor(argv, key) ?? {},
            "value",
          ),
      ) ||
      Object.keys(argv).length !== argv.length ||
      argv.length === 0 ||
      argv.length > 64 ||
      argv.some(
        (value) =>
          typeof value !== "string" ||
          value.length > 16384 ||
          /[\0\r\n]/u.test(value),
      )
    )
      throw Error("docker_authentication_cli_invalid");
    copied.push([...argv]);
  }
  const environment = record.environment;
  if (
    !environment ||
    typeof environment !== "object" ||
    utilTypes.isProxy(environment) ||
    Object.getPrototypeOf(environment) !== Object.prototype ||
    Reflect.ownKeys(environment).length > 64 ||
    Reflect.ownKeys(environment).some(
      (key) =>
        typeof key !== "string" ||
        !/^[A-Z][A-Z0-9_]*$/u.test(key) ||
        [
          "HOME",
          "TMPDIR",
          "HTTPS_PROXY",
          "HTTP_PROXY",
          "ALL_PROXY",
          "NO_PROXY",
        ].includes(key) ||
        !Object.hasOwn(
          Object.getOwnPropertyDescriptor(environment, key) ?? {},
          "value",
        ) ||
        typeof Object.getOwnPropertyDescriptor(environment, key)?.value !==
          "string" ||
        /[\0\r\n]/u.test(
          Object.getOwnPropertyDescriptor(environment, key)?.value,
        ),
    )
  )
    throw Error("docker_authentication_environment_invalid");
  return Object.freeze({
    loginArgv: Object.freeze(login ? (copied[0] ?? []) : []),
    statusArgv: Object.freeze(copied[login ? 1 : 0] ?? []),
    environment: Object.freeze({ ...environment }) as Readonly<
      Record<string, string>
    >,
  });
}

/**
 * 固定用途の認証Commandを不変値にする。
 * @responsibility 同じ計画内の引数を独立して保持する。
 * @trace ARCH-000008
 * @input purpose、argv、interactive: 内部で構築した固定操作。
 * @returns 凍結Command。
 * @precondition 任意の外部Docker引数を直接渡さない。
 * @postcondition 元配列変更を搬送しない。
 * @effect N/A: 局所値だけ。
 * @failure N/A: 検査は計画入口が所有する。
 * @invariant 生成を実行許可へ昇格しない。
 * @boundary 同じ認証計画内。
 * @security Authority・秘密値を生成しない。
 * @concurrency 同期構築。
 */
function authenticationCommand(
  purpose: string,
  argv: readonly string[],
  interactive = false,
): DockerAuthenticationCommand {
  return Object.freeze({
    purpose,
    argv: Object.freeze([...argv]),
    interactive,
  });
}

/**
 * 通信なし・読取り専用Homeで状態確認を計画する。
 * @responsibility statusだけを一Containerの元計画へ閉じる。
 * @trace ARCH-000008
 * @input input: statusの閉じた技術入力。
 * @returns 一資源の固定計画。
 * @precondition Home許可・Provider意味判定は上位が所有する。
 * @postcondition Proxy・Network・login・tokenを要求も生成もしない。
 * @effect N/A: 計画値だけ。
 * @failure 不正形・Path・Identity・CLIは固定例外。
 * @invariant Repository・Workspaceをmountしない。
 * @boundary 上位status操作と下位隔離。
 * @security HomeはRO、network-none、非root、非対話。
 * @concurrency 新しいLock・Stateを持たない。
 */
function planDockerAuthenticationStatus(
  input: Extract<DockerAuthenticationInput, { action: "status" }>,
) {
  const keys = [
    "action",
    "providerHomeSourcePath",
    "providerImageDigest",
    "ownershipLabel",
    "probeContainerName",
    "authenticationCli",
  ];
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some(
      (key) => typeof key !== "string" || !keys.includes(key),
    )
  )
    throw Error("docker_authentication_input_invalid");
  const {
    providerHomeSourcePath,
    providerImageDigest,
    ownershipLabel,
    probeContainerName,
  } = input;
  if (
    typeof providerHomeSourcePath !== "string" ||
    !path.isAbsolute(providerHomeSourcePath) ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
    typeof providerImageDigest !== "string" ||
    typeof ownershipLabel !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(providerImageDigest) ||
    !/^crdd\.coordinator\.authentication=[a-f0-9]{16}$/u.test(ownershipLabel) ||
    probeContainerName !==
      `crdd-auth-${ownershipLabel.slice(ownershipLabel.indexOf("=") + 1)}`
  )
    throw Error("docker_authentication_input_invalid");
  const cli = snapshotAuthenticationCli(input.authenticationCli, false);
  const command = authenticationCommand;
  return completeAuthenticationPlan(
    Object.freeze([
      command("create_probe", [
        "create",
        "--pull=never",
        "--network=none",
        "--read-only",
        "--name",
        probeContainerName,
        "--label",
        ownershipLabel,
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--user=65534:65534",
        "--env",
        "HOME=/provider-home",
        ...Object.entries(cli.environment).flatMap(([key, value]) => [
          "--env",
          `${key}=${value}`,
        ]),
        "--mount",
        "type=bind,src=" +
          providerHomeSourcePath +
          ",dst=/provider-home,bind-propagation=rprivate,readonly",
        providerImageDigest,
        ...cli.statusArgv,
      ]),
      command("start_probe_attached", [
        "start",
        "--attach",
        probeContainerName,
      ]),
    ]),
    Object.freeze([
      command("observe_probe_owner", [
        "container",
        "inspect",
        "--format",
        '{{ index .Config.Labels "crdd.coordinator.authentication" }}',
        probeContainerName,
      ]),
    ]),
    Object.freeze([
      command("remove_probe", ["rm", "--force", probeContainerName]),
    ]),
    Object.freeze([
      command("confirm_probe_absent", [
        "container",
        "inspect",
        probeContainerName,
      ]),
    ]),
  );
}

/**
 * 認証計画の生成・観測・回収を同じ元Objectへ登録する。
 * @responsibility loginとstatusで一つの既存所属検査を使う。
 * @trace ARCH-000008
 * @input commands、ownershipCommands、cleanupCommands、absenceCommands: 固定操作列。
 * @returns 観測を含む凍結済み元計画。
 * @precondition 呼出し側の固定生成器が全列を構築する。
 * @postcondition 作成する資源だけにReceiptとImage観測を結合する。
 * @effect 同Process内の既存WeakSetへの登録のみ。
 * @failure 作成名・Image欠測は固定例外。
 * @invariant Registry・保存・実行許可を追加しない。
 * @boundary 計画構築と既存実行Owner。
 * @security 未生成のObjectを受理しない。
 * @concurrency 同期登録。
 */
function completeAuthenticationPlan(
  commands: readonly DockerAuthenticationCommand[],
  ownershipCommands: readonly DockerAuthenticationCommand[],
  cleanupCommands: readonly DockerAuthenticationCommand[],
  absenceCommands: readonly DockerAuthenticationCommand[],
) {
  const command = authenticationCommand;
  const creationObservationCommands = Object.freeze(
    commands
      .filter((item) => item.purpose.startsWith("create_"))
      .map((item) => {
        const network = item.purpose.endsWith("_network");
        const name = network
          ? item.argv.at(-1)
          : item.argv[item.argv.indexOf("--name") + 1];
        if (!name) throw Error("docker_authentication_resource_name_invalid");
        return command(item.purpose.replace("create_", "inspect_created_"), [
          network ? "network" : "container",
          "inspect",
          name,
        ]);
      }),
  );
  const creationImageCommands = Object.freeze(
    commands
      .filter((item) =>
        ["create_probe", "create_login", "create_proxy"].includes(item.purpose),
      )
      .map((item) => {
        const image = item.argv.find((value) =>
          /^sha256:[a-f0-9]{64}$/u.test(value),
        );
        if (!image) throw Error("docker_authentication_image_invalid");
        return command(item.purpose.replace("create_", "inspect_image_"), [
          "image",
          "inspect",
          image,
        ]);
      }),
  );
  for (const item of [
    ...commands,
    ...creationObservationCommands,
    ...creationImageCommands,
    ...ownershipCommands,
    ...cleanupCommands,
    ...absenceCommands,
  ])
    plannedCommands.add(item);
  const plan = Object.freeze({
    commands,
    creationObservationCommands,
    creationImageCommands,
    ownershipCommands,
    cleanupCommands,
    absenceCommands,
  });
  plannedPlans.add(plan);
  return plan;
}
