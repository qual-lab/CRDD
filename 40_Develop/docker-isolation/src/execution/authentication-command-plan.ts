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
  proxyImageDigest: string;
  ownershipLabel: string;
  internalNetworkName: string;
  egressNetworkName: string;
  proxyContainerName: string;
  loginContainerName: string;
  probeContainerName: string;
  proxyToken: string;
  proxyPort: number;
  proxyProfile: "claude" | "codex";
  authenticationCli: Readonly<{
    loginArgv: readonly string[];
    statusArgv: readonly string[];
    environment: Readonly<Record<string, string>>;
  }>;
}>;

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
    authenticationCli,
  } = input;
  if (
    typeof providerHomeSourcePath !== "string" ||
    !path.isAbsolute(providerHomeSourcePath) ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
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
    ![`crdd-claude-${suffix}`, `crdd-codex-${suffix}`].includes(
      loginContainerName,
    )
  )
    throw Error("docker_authentication_resource_invalid");
  if (
    authenticationCli === null ||
    typeof authenticationCli !== "object" ||
    utilTypes.isProxy(authenticationCli) ||
    Object.getPrototypeOf(authenticationCli) !== Object.prototype ||
    Reflect.ownKeys(authenticationCli).some(
      (key) =>
        typeof key !== "string" ||
        !(
          "value" in
          (Object.getOwnPropertyDescriptor(authenticationCli, key) ?? {})
        ),
    )
  )
    throw Error("docker_authentication_cli_invalid");
  for (const argv of [
    authenticationCli.loginArgv,
    authenticationCli.statusArgv,
  ]) {
    if (
      !Array.isArray(argv) ||
      utilTypes.isProxy(argv) ||
      Object.getPrototypeOf(argv) !== Array.prototype ||
      Reflect.ownKeys(argv).some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" && !/^(0|[1-9][0-9]*)$/u.test(key)) ||
          !("value" in (Object.getOwnPropertyDescriptor(argv, key) ?? {})),
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
  }
  const environment = authenticationCli.environment;
  if (
    environment === null ||
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
        !(
          "value" in (Object.getOwnPropertyDescriptor(environment, key) ?? {})
        ) ||
        typeof Object.getOwnPropertyDescriptor(environment, key)?.value !==
          "string" ||
        /[\0\r\n]/u.test(
          Object.getOwnPropertyDescriptor(environment, key)?.value,
        ),
    )
  )
    throw Error("docker_authentication_environment_invalid");
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
  const command = (
    purpose: string,
    argv: readonly string[],
    isInteractive = false,
  ) =>
    Object.freeze({
      purpose,
      argv: Object.freeze([...argv]),
      interactive: isInteractive,
    });
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
      "--pids-limit=64",
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
      "--pids-limit=64",
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
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      "HOME=/provider-home",
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
