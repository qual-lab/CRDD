/**
 * 固定回復実行のFilesystemとProcess構成を局所検証する。
 *
 * @packageDocumentation
 * @responsibility 環境・CLI・configのfresh照合と元終了結果の分離を反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実Filesystem＋spawnSync差替え。実Docker成功の根拠ではない。
 * @boundary 空configと固定Docker Process要求。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test, { mock, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  createDockerOperationRecoveryExecutor,
  createDockerResourceRecoveryExecutor,
  observeDockerRecoveryConfigIdentity,
} from "../../src/index.ts";

/**
 * 固定Task factoryがCLI・環境を下位へ閉じ、旧cache寿命を維持する。
 * @responsibility 二生成・遅延観測・失敗後の非fallbackと元close返却を実本文で反証する。
 * @trace ERB-IT-004
 * @precondition 実factory本文とCLI検証本文を同じVMへ読み、低位factoryだけを観測用代役にする。
 * @stimulus 余剰getter、初回observe失敗、後続verify失敗、環境欠測とclose後の再生成。
 * @observation lower入力、呼出し順、snapshot参照、回数、元返値とcloseの参照同一性。
 * @oracle 構築時CLI／環境0、要求ごと環境→CLI、初回成功だけ保持し再検証失敗から再観測しない。
 * @cleanup N/A: VM内の模擬操作だけでFilesystem・Dockerは処置しない。
 * @boundary 実固定組立本文と低位Executor代役。実Docker成立の根拠ではない。
 */
test("Task回復factoryは要求時だけCLIと環境を取得しclose後も同じsnapshotを検証する", () => {
  const source = fs.readFileSync(
    new URL("../../src/cleanup/execute.ts", import.meta.url),
    "utf8",
  );
  const cacheStart = source.indexOf("let recoveryDockerCliSnapshot:");
  assert.ok(cacheStart > 0);
  const parts = [source.slice(cacheStart, source.indexOf(";", cacheStart) + 1)];
  for (const name of [
    "verifyRecoveryDockerCli",
    "createDockerTaskRecoveryExecutor",
  ]) {
    const declaration = `function ${name}(`;
    assert.equal(source.split(declaration).length, 2);
    const begin = source.indexOf(declaration);
    const end = source.indexOf("\n/**", begin);
    assert.ok(end > begin);
    parts.push(source.slice(begin, end));
  }
  const events: string[] = [];
  const snapshot = Object.freeze({ identity: "fixed-cli" });
  let observeFails = true;
  let verifyFails = false;
  let environmentAvailable = true;
  let getterReads = 0;
  const lower: Array<{
    binding: {
      managementDirectory: string;
      assertOwner: () => boolean;
      verifyCli: () => void;
      environment: () => unknown;
    };
    close: () => boolean;
  }> = [];
  const create = runInNewContext(
    `${stripTypeScriptTypes(parts.join("\n"))}\ncreateDockerTaskRecoveryExecutor`,
    {
      observeTrustedDockerCli: () => {
        events.push("observe");
        if (observeFails) throw new Error("private-observe-error");
        return snapshot;
      },
      verifyTrustedDockerCliSnapshot: (value: unknown) => {
        events.push("verify");
        assert.equal(value, snapshot);
        if (verifyFails) throw new Error("private-verify-error");
      },
      createDockerCliEnvironment: (input: unknown) => {
        events.push("environment");
        assert.deepEqual(JSON.parse(JSON.stringify(input)), {
          dockerConfig: null,
          dockerHome: null,
        });
        return environmentAvailable ? { SystemRoot: "fixed-test" } : null;
      },
      createDockerOperationRecoveryExecutor: (
        binding: (typeof lower)[number]["binding"],
      ) => {
        const result = { binding, close: () => true };
        lower.push(result);
        return result;
      },
    },
  ) as (input: object) => (typeof lower)[number];
  /**
   * 設定getter拒否の試験へ有効なOwner確認を供給する。
   * @responsibility 設定getter拒否の試験へ有効なOwner確認を供給する。
   * @trace ERB-IT-004
   * @precondition Owner以外の不正構成を反証する入力。
   * @stimulus 同期trueだけを返す。
   * @observation 構成拒否とgetter読取り数。
   * @oracle Owner拒否を混ぜず不正設定が処置前に止まる。
   * @cleanup N/A: Authorityや資源を発行しない。
   * @boundary Owner確認の代役であり生存保証の実測ではない。
   */
  const owner = () => true;
  const input = Object.defineProperties(
    { managementDirectory: "fixed-management", assertOwner: owner },
    {
      verifyCli: {
        enumerable: true,
        get: () => {
          getterReads++;
          throw new Error("unexpected");
        },
      },
      environment: {
        enumerable: true,
        get: () => {
          getterReads++;
          throw new Error("unexpected");
        },
      },
    },
  );
  const first = create(input),
    second = create(input);
  assert.equal(first, lower[0]);
  assert.equal(second, lower[1]);
  assert.deepEqual(events, []);
  assert.equal(getterReads, 0);
  for (const result of lower) {
    assert.equal(result.binding.assertOwner, owner);
    assert.equal(result.binding.managementDirectory, "fixed-management");
    assert.deepEqual(Object.keys(result.binding).sort(), [
      "assertOwner",
      "environment",
      "managementDirectory",
      "verifyCli",
    ]);
  }
  first.binding.environment();
  assert.throws(
    () => first.binding.verifyCli(),
    /docker_task_recovery_cli_untrusted/u,
  );
  observeFails = false;
  second.binding.environment();
  second.binding.verifyCli();
  first.binding.environment();
  first.binding.verifyCli();
  verifyFails = true;
  assert.throws(
    () => second.binding.verifyCli(),
    /docker_task_recovery_cli_untrusted/u,
  );
  assert.throws(
    () => first.binding.verifyCli(),
    /docker_task_recovery_cli_untrusted/u,
  );
  environmentAvailable = false;
  assert.throws(
    () => second.binding.environment(),
    /docker_recovery_environment_unavailable/u,
  );
  assert.deepEqual(events, [
    "environment",
    "observe",
    "environment",
    "observe",
    "environment",
    "verify",
    "verify",
    "verify",
    "environment",
  ]);
  assert.equal(first.close, lower[0]?.close);
  assert.equal(first.close(), true);
  verifyFails = false;
  environmentAvailable = true;
  const third = create(input);
  third.binding.environment();
  third.binding.verifyCli();
  assert.deepEqual(events.slice(-2), ["environment", "verify"]);
  assert.equal(events.filter((value) => value === "observe").length, 2);
  assert.equal(getterReads, 0);
  const needle = "return createDockerOperationRecoveryExecutor({";
  const body = stripTypeScriptTypes(parts.join("\n"));
  assert.equal(body.split(needle).length, 2);
  const spread = runInNewContext(
    `${body.replace(needle, `${needle}\n...input,`)}\ncreateDockerTaskRecoveryExecutor`,
    {
      createDockerOperationRecoveryExecutor: () => {
        assert.fail("余剰getter拒否前に低位factoryへ到達した");
      },
    },
  ) as (value: object) => unknown;
  assert.throws(() => spread(input), /unexpected/u);
  assert.equal(getterReads, 1);
});

/**
 * Repository内の自己生成空configとProcess差替えを用意する。
 *
 * @responsibility 試験物の所在・所有・終端を固定する。
 * @trace ERB-IT-004
 * @precondition Rootの.gitが存在する。
 * @stimulus 短命Directoryとspawn要求記録を構築する。
 * @observation config実体、要求と元結果設定を返す。
 * @oracle 外部Processを開始せず固定構成を検査できる。
 * @cleanup 試験終了時に自己生成Directoryとmockを回収する。
 * @boundary Repository内試験Filesystemと固定Process要求。
 */
function fixture(t: TestContext) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  assert.ok(fs.statSync(path.join(root, ".git")).isDirectory());
  const tests = path.join(root, ".crdd", "tests");
  fs.mkdirSync(tests, { recursive: true });
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(tests, "docker-isolation-recovery-")),
  );
  const configDirectory = path.join(directory, "config");
  fs.mkdirSync(configDirectory);
  const configIdentity = observeDockerRecoveryConfigIdentity(configDirectory);
  const calls: {
    executable: string;
    argv: readonly string[];
    options: childProcess.SpawnSyncOptions;
  }[] = [];
  let result: childProcess.SpawnSyncReturns<string> = {
    pid: 0,
    output: [null, "", ""],
    status: 0,
    signal: null,
    stdout: "",
    stderr: "",
  };
  const replacement = mock.method(
    childProcess,
    "spawnSync",
    (
      executable: string,
      argv: readonly string[],
      options: childProcess.SpawnSyncOptions,
    ) => {
      calls.push({ executable, argv, options });
      return result;
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    replacement.mock.restore();
    syncBuiltinESMExports();
    assert.equal(path.dirname(directory), fs.realpathSync(tests));
    fs.rmSync(directory, { recursive: true });
  });
  return {
    calls,
    directory,
    configDirectory,
    configIdentity,
    setResult: (value: childProcess.SpawnSyncReturns<string>) => {
      result = value;
    },
  };
}

/**
 * 環境snapshot後のfresh照合と固定spawn構成を確認する。
 *
 * @responsibility 最終照合後の環境変更をProcessへ搬送しない。
 * @trace ERB-IT-004
 * @precondition 空configと正常模擬Processを用意する。
 * @stimulus 二経路の不存在観測を要求する。
 * @observation 各spawnの環境・CLI照合順・引数を取得する。
 * @oracle 各要求で環境→CLI→configを照合しshellなし有界実行する。
 * @cleanup FixtureがProcess差替えとDirectoryを回収する。
 * @boundary Host観測→固定Docker要求。
 */
test("各spawnで環境を固定してCLIとconfigをfresh照合する", (t) => {
  const f = fixture(t);
  const events: string[] = [];
  const environment = { SystemRoot: "before" };
  const executor = createDockerResourceRecoveryExecutor({
    ...f,
    environment: () => {
      events.push("environment");
      environment.SystemRoot = "before";
      return environment;
    },
    verifyCli: () => {
      events.push("cli");
      environment.SystemRoot = "after";
    },
  });
  assert.equal(
    executor.observeAbsent(
      "network",
      `crdd-internal-${"1".repeat(16)}`,
      `crdd.coordinator.runtime=${"2".repeat(16)}`,
    ),
    true,
  );
  assert.deepEqual(events, ["environment", "cli", "environment", "cli"]);
  assert.equal(f.calls.length, 2);
  for (const call of f.calls) {
    assert.equal(
      call.executable,
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    );
    assert.deepEqual(call.argv.slice(0, 4), [
      "--host",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "--config",
      f.configDirectory,
    ]);
    assert.equal(call.options.env?.SystemRoot, "before");
    assert.equal(call.options.shell, false);
    assert.equal(call.options.timeout, 10_000);
    assert.equal(call.options.maxBuffer, 1_048_576);
  }
});

/**
 * 操作Ownerの借用領域に一意configを作り最終確認で固定要求を実行する。
 * @responsibility 環境・Owner・CLI・実体・最終Ownerの順と自作終了を反証する。
 * @trace ERB-IT-004
 * @precondition 自己生成Repository領域とspawnSync差替えを使用する。
 * @stimulus 空configを生成し二軸不存在を照会してcloseを反復する。
 * @observation 固定要求、Owner順、configと隣接旧子の現在状態。
 * @oracle 最終Owner直後にspawn、自作だけ不存在、二回目closeの削除0。
 * @cleanup fixtureがmockと自己生成Directoryを回収する。
 * @boundary ITの実Filesystem→固定Process要求。
 */
test("操作configは一意生成しfresh照合後の固定要求だけを発行する", (t) => {
  const f = fixture(t);
  const old = path.join(f.directory, "docker-recovery-config-old");
  fs.mkdirSync(old);
  const marker = path.join(f.directory, "docker-recovery-config-old-file");
  fs.writeFileSync(marker, "preserved");
  const events: string[] = [];
  const input = {
    managementDirectory: f.directory,
    assertOwner: () => {
      events.push("owner");
      return true;
    },
    verifyCli: () => {
      events.push("cli");
    },
    environment: () => {
      events.push("environment");
      return { SystemRoot: "fixed" };
    },
  };
  const first = createDockerOperationRecoveryExecutor(input);
  const second = createDockerOperationRecoveryExecutor(input);
  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  assert.ok(first.executor && second.executor);
  events.length = 0;
  assert.equal(
    first.executor.observeAbsent(
      "network",
      `crdd-internal-${"1".repeat(16)}`,
      `crdd.coordinator.runtime=${"2".repeat(16)}`,
    ),
    true,
  );
  assert.deepEqual(events, [
    "environment",
    "owner",
    "cli",
    "owner",
    "environment",
    "owner",
    "cli",
    "owner",
  ]);
  const config = f.calls[0]?.argv[3];
  assert.ok(config && config !== old);
  assert.equal(path.dirname(config), f.directory);
  assert.ok(path.basename(config).startsWith("docker-recovery-config-"));
  assert.deepEqual(fs.readdirSync(config), []);
  assert.equal(first.executor.close(), true);
  assert.equal(first.executor.close(), true);
  assert.equal(fs.existsSync(config), false);
  assert.throws(() =>
    first.executor?.observeAbsent(
      "network",
      `crdd-internal-${"1".repeat(16)}`,
      `crdd.coordinator.runtime=${"2".repeat(16)}`,
    ),
  );
  assert.equal(f.calls.length, 2);
  assert.equal(second.executor.close(), true);
  assert.equal(fs.readFileSync(marker, "utf8"), "preserved");
  assert.equal(fs.existsSync(old), true);
});

/**
 * 不明Ownerと保持上限では新Directoryを作らない。
 * @responsibility 非boolean確認と残存名の再利用を拒否する。
 * @trace ERB-IT-004
 * @precondition 空の借用管理領域を使用する。
 * @stimulus false・throw・thenableと96個の旧prefix fileを与える。
 * @observation entries、Process件数、then非実行。
 * @oracle 作成0、旧file不変、fixed blocked、旧子削除0。
 * @cleanup fixtureが自作fileとmockを回収する。
 * @boundary Owner／容量確認→短命config作成。
 */
test("Owner不明と96残存はconfig作成前に拒否する", (t) => {
  const f = fixture(t);
  const before = fs.readdirSync(f.directory);
  let thenCalls = 0;
  for (const mode of ["false", "throw", "thenable"]) {
    const stopped = createDockerOperationRecoveryExecutor({
      managementDirectory: f.directory,
      assertOwner: () => {
        if (mode === "throw") throw new Error("private owner detail");
        if (mode === "thenable")
          return {
            // biome-ignore lint/suspicious/noThenProperty: 非同期Ownerを拒否する反証入力。
            then: () => {
              thenCalls += 1;
            },
          } as unknown as boolean;
        return false;
      },
      verifyCli: () => {
        throw new Error("must not verify");
      },
      environment: () => ({}),
    });
    assert.equal(stopped.status, "blocked");
    assert.equal(stopped.cleanupConfirmed, true);
    assert.deepEqual(fs.readdirSync(f.directory), before);
  }
  assert.equal(thenCalls, 0);
  for (let index = 0; index < 96; index += 1)
    fs.writeFileSync(
      path.join(f.directory, `docker-recovery-config-old-${index}`),
      "old",
    );
  const retained = fs.readdirSync(f.directory);
  const stopped = createDockerOperationRecoveryExecutor({
    managementDirectory: f.directory,
    assertOwner: () => true,
    verifyCli: () => {},
    environment: () => ({}),
  });
  assert.equal(stopped.status, "blocked");
  assert.deepEqual(fs.readdirSync(f.directory), retained);
  assert.equal(f.calls.length, 0);
});

/**
 * 作成後Owner失効では自作configを回収しProcessを開始しない。
 * @responsibility 作成成功を実行許可へ読み替えない。
 * @trace ERB-IT-004
 * @precondition 管理領域実体と初回Ownerは成立。
 * @stimulus 作成後の二回目Ownerだけfalseにする。
 * @observation ready非返却、新子不存在、Process件数。
 * @oracle blocked・cleanup確認、spawn0、隣接不変。
 * @cleanup fixtureがmockと領域を回収する。
 * @boundary 短命config作成→最終Owner確認。
 */
test("作成直後Owner失効は自作closeだけを行う", (t) => {
  const f = fixture(t);
  let checks = 0;
  const before = fs.readdirSync(f.directory);
  const stopped = createDockerOperationRecoveryExecutor({
    managementDirectory: f.directory,
    assertOwner: () => ++checks === 1,
    verifyCli: () => {},
    environment: () => ({}),
  });
  assert.equal(stopped.status, "blocked");
  assert.equal(stopped.cleanupConfirmed, true);
  assert.deepEqual(fs.readdirSync(f.directory), before);
  assert.equal(f.calls.length, 0);
});

/**
 * capture前のIdentity不明は残存を勝手に削除しない。
 * @responsibility 名前だけの短命config回収を拒否する。
 * @trace ERB-IT-004
 * @precondition mkdtempは自己生成管理領域へ作成する。
 * @stimulus 新子のmetadata読取りだけを例外にする。
 * @observation blocked、cleanup未確認、残存prefix、spawn件数。
 * @oracle 未capture残存保持、Process0、隣接file不変。
 * @cleanup metadata mockを復元後、fixtureが自作領域を回収する。
 * @boundary 作成→Identity capture失敗。
 */
test("capture前Identity不明は新子を保持する", (t) => {
  const f = fixture(t);
  const original = fs.lstatSync;
  const fault = mock.method(fs, "lstatSync", ((
    ...args: Parameters<typeof fs.lstatSync>
  ) => {
    if (path.basename(String(args[0])).startsWith("docker-recovery-config-"))
      throw new Error("unknown identity");
    return original(...args);
  }) as typeof fs.lstatSync);
  try {
    const stopped = createDockerOperationRecoveryExecutor({
      managementDirectory: f.directory,
      assertOwner: () => true,
      verifyCli: () => {},
      environment: () => ({}),
    });
    assert.equal(stopped.status, "blocked");
    assert.equal(stopped.cleanupConfirmed, false);
    assert.equal(
      fs
        .readdirSync(f.directory)
        .filter((name) => name.startsWith("docker-recovery-config-")).length,
      1,
    );
    assert.equal(f.calls.length, 0);
  } finally {
    fault.mock.restore();
  }
});

/**
 * Parent／子実体差と非空はspawn・closeを拒否する。
 * @responsibility 再入場で別実体や保存内容を自作空configとして扱わない。
 * @trace ERB-IT-004
 * @precondition 操作configを生成済み。
 * @stimulus 子の同名置換または非空化を行う。
 * @observation 固定要求0、close false、二回目追加削除0。
 * @oracle 置換実体と旧自作子・内容を保持する。
 * @cleanup fixtureが自己生成領域を回収する。
 * @boundary 自作Identityの再照合。
 */
test("子置換・非空は処置とcloseを拒否し再試行しない", (t) => {
  const f = fixture(t);
  for (const mode of ["replacement", "nonempty"]) {
    const ready = createDockerOperationRecoveryExecutor({
      managementDirectory: f.directory,
      assertOwner: () => true,
      verifyCli: () => {},
      environment: () => ({}),
    });
    assert.ok(ready.executor);
    const child = fs
      .readdirSync(f.directory)
      .filter((name) => name.startsWith("docker-recovery-config-"))
      .map((name) => path.join(f.directory, name))
      .find(
        (name) => fs.readdirSync(name).length === 0 && !name.endsWith(".old"),
      );
    assert.ok(child);
    if (mode === "replacement") {
      fs.renameSync(child, `${child}.old`);
      fs.mkdirSync(child);
    } else fs.writeFileSync(path.join(child, "retained"), "not empty");
    assert.throws(() =>
      ready.executor?.observeAbsent(
        "network",
        `crdd-internal-${"1".repeat(16)}`,
        `crdd.coordinator.runtime=${"2".repeat(16)}`,
      ),
    );
    assert.equal(ready.executor.close(), false);
    assert.equal(ready.executor.close(), false);
    assert.equal(fs.existsSync(child), true);
    // 次の自己生成fixtureと混同しないため、試験だけの明示片付け。
    fs.rmSync(child, { recursive: true });
    if (mode === "replacement") fs.rmSync(`${child}.old`, { recursive: true });
  }
  assert.equal(f.calls.length, 0);
});

/**
 * close削除の失敗も反復closeで再試行しない。
 * @responsibility 初回不明を後着成功で消さない。
 * @trace ERB-IT-004
 * @precondition configの実体と空性は成立。
 * @stimulus rmdirを例外にし、二回目closeを呼ぶ。
 * @observation 削除試行件数と残存。
 * @oracle false保持・削除試行一回・自作子保持。
 * @cleanup mock復元後fixtureが自己生成領域を回収する。
 * @boundary 空configの削除結果不明。
 */
test("close失敗はfalseを保持し二度削除しない", (t) => {
  const f = fixture(t);
  const ready = createDockerOperationRecoveryExecutor({
    managementDirectory: f.directory,
    assertOwner: () => true,
    verifyCli: () => {},
    environment: () => ({}),
  });
  assert.ok(ready.executor);
  const fault = mock.method(fs, "rmdirSync", () => {
    throw new Error("unknown close");
  });
  try {
    assert.equal(ready.executor.close(), false);
    assert.equal(ready.executor.close(), false);
    assert.equal(fault.mock.callCount(), 1);
    assert.equal(
      fs
        .readdirSync(f.directory)
        .filter((name) => name.startsWith("docker-recovery-config-")).length,
      1,
    );
  } finally {
    fault.mock.restore();
  }
});

/**
 * Parent差替えとCLI確認中Owner失効を最終spawn前に拒否する。
 * @responsibility 子configだけの一致から現在境界を成立させない。
 * @trace ERB-IT-004
 * @precondition 操作config作成と初回Ownerは成立。
 * @stimulus Parentを同名別実体へ置換、またはCLI照合中にOwnerを失効する。
 * @observation spawn0、closeの実体差拒否または元子不存在。
 * @oracle 別Parent削除0、Owner喪失後も同実体の自作子だけclose可能。
 * @cleanup Parentを試験で元へ戻してからfixtureが自作領域を回収する。
 * @boundary config照合→Parent／Ownerの最終確認。
 */
test("Parent差と最終Owner失効はspawn前に止まる", (t) => {
  const f = fixture(t);
  let ownerLive = true;
  let loseDuringCli = false;
  const input = {
    managementDirectory: f.directory,
    assertOwner: () => ownerLive,
    verifyCli: () => {
      if (loseDuringCli) ownerLive = false;
    },
    environment: () => ({}),
  };
  const ready = createDockerOperationRecoveryExecutor(input);
  assert.ok(ready.executor);
  const originalParent = `${f.directory}.original`;
  fs.renameSync(f.directory, originalParent);
  fs.mkdirSync(f.directory);
  try {
    assert.throws(() =>
      ready.executor?.observeAbsent(
        "network",
        `crdd-internal-${"1".repeat(16)}`,
        `crdd.coordinator.runtime=${"2".repeat(16)}`,
      ),
    );
    assert.equal(ready.executor.close(), false);
    assert.equal(ready.executor.close(), false);
    assert.deepEqual(fs.readdirSync(f.directory), []);
    assert.equal(f.calls.length, 0);
  } finally {
    fs.rmdirSync(f.directory);
    fs.renameSync(originalParent, f.directory);
  }
  const next = createDockerOperationRecoveryExecutor(input);
  assert.ok(next.executor);
  const before = fs.readdirSync(f.directory);
  loseDuringCli = true;
  assert.throws(() =>
    next.executor?.observeAbsent(
      "network",
      `crdd-internal-${"1".repeat(16)}`,
      `crdd.coordinator.runtime=${"2".repeat(16)}`,
    ),
  );
  assert.equal(f.calls.length, 0);
  assert.equal(next.executor.close(), true);
  assert.equal(fs.readdirSync(f.directory).length, before.length - 1);
});

/**
 * 削除後不存在の観測不明もclose成功にしない。
 * @responsibility rmdir返却と不存在観測を区別する。
 * @trace ERB-IT-004
 * @precondition 自作子は空でIdentityが一致。
 * @stimulus rmdir後のlstatだけEACCESへ差し替える。
 * @observation close false、削除一回、二回目追加処置0。
 * @oracle 元子は削除済みでも観測不明をtrueへ補完しない。
 * @cleanup mock復元後fixtureが自己生成領域を回収する。
 * @boundary 削除完了→現在不存在の確認。
 */
test("close後観測不能もfalseを保持する", (t) => {
  const f = fixture(t);
  const ready = createDockerOperationRecoveryExecutor({
    managementDirectory: f.directory,
    assertOwner: () => true,
    verifyCli: () => {},
    environment: () => ({}),
  });
  assert.ok(ready.executor);
  const originalRemove = fs.rmdirSync;
  const originalStat = fs.lstatSync;
  let removed: string | null = null;
  const remove = mock.method(fs, "rmdirSync", ((
    ...args: Parameters<typeof fs.rmdirSync>
  ) => {
    originalRemove(...args);
    removed = String(args[0]);
  }) as typeof fs.rmdirSync);
  const observe = mock.method(fs, "lstatSync", ((
    ...args: Parameters<typeof fs.lstatSync>
  ) => {
    if (String(args[0]) === removed)
      throw Object.assign(new Error("observation unknown"), { code: "EACCES" });
    return originalStat(...args);
  }) as typeof fs.lstatSync);
  try {
    assert.equal(ready.executor.close(), false);
    assert.equal(ready.executor.close(), false);
    assert.equal(remove.mock.callCount(), 1);
  } finally {
    observe.mock.restore();
    remove.mock.restore();
  }
  assert.equal(
    fs
      .readdirSync(f.directory)
      .filter((name) => name.startsWith("docker-recovery-config-")).length,
    0,
  );
});

/**
 * 環境・CLI・config不明ではspawnを発行しない。
 *
 * @responsibility getter・Proxy・差替え・非空configを最終境界で拒否する。
 * @trace ERB-IT-004
 * @precondition 実空configと模擬spawnを用意する。
 * @stimulus 不正環境と照合例外、config差を与える。
 * @observation 例外とspawn要求0を取得する。
 * @oracle 照合失敗にambient環境や別configでfallbackしない。
 * @cleanup FixtureがDirectoryとmockを回収する。
 * @boundary Host構成→Effect前Gate。
 */
test("環境・CLI・config不明はspawn前に停止する", (t) => {
  const f = fixture(t);
  const observe = (
    environment: () => Readonly<Record<string, string>>,
    verifyCli = () => {},
  ) =>
    createDockerResourceRecoveryExecutor({
      ...f,
      environment,
      verifyCli,
    }).observeAbsent(
      "network",
      `crdd-internal-${"1".repeat(16)}`,
      `crdd.coordinator.runtime=${"2".repeat(16)}`,
    );
  const getter = Object.defineProperty({}, "SystemRoot", {
    get: () => {
      throw new Error("getter evaluated");
    },
  });
  for (const value of [
    getter,
    new Proxy({}, {}),
    new Date(),
    { SystemRoot: "bad\0value" },
  ])
    assert.throws(
      () => observe(() => value as Readonly<Record<string, string>>),
      /environment_unavailable/u,
    );
  assert.throws(
    () =>
      observe(() => {
        throw new Error("environment failed");
      }),
    /environment failed/u,
  );
  assert.throws(
    () =>
      observe(
        () => ({}),
        () => {
          throw new Error("cli rejected");
        },
      ),
    /cli rejected/u,
  );
  fs.writeFileSync(path.join(f.configDirectory, "unexpected"), "fixed");
  assert.throws(() => observe(() => ({})), /config_untrusted/u);
  assert.equal(f.calls.length, 0);
});

/**
 * 元Process失敗を明示不存在へ変換しない。
 *
 * @responsibility exit・Signal・error・出力異常の各失敗を保持する。
 * @trace ERB-IT-004
 * @precondition 空configと差替えProcessを用意する。
 * @stimulus 各終了fieldに異常を設定する。
 * @observation 不存在結果がfalseになることを確認する。
 * @oracle 空stdoutでも失敗・Signal・stderrを成功へ畳まない。
 * @cleanup FixtureがmockとDirectoryを回収する。
 * @boundary 固定Process結果→不存在観測。
 */
test("元Process失敗と残存出力を不存在に変換しない", (t) => {
  const f = fixture(t);
  const executor = createDockerResourceRecoveryExecutor({
    ...f,
    environment: () => ({}),
    verifyCli: () => {},
  });
  const base: childProcess.SpawnSyncReturns<string> = {
    pid: 0,
    output: [null, "", ""],
    status: 0,
    signal: null,
    stdout: "",
    stderr: "",
  };
  for (const change of [
    { status: 1 },
    { status: null, signal: "SIGTERM" as const },
    {
      status: null,
      error: Object.assign(new Error("fixed"), { code: "ETIMEDOUT" }),
    },
    {
      status: null,
      error: Object.assign(new Error("fixed"), { code: "ENOBUFS" }),
    },
    { stderr: "fixed failure" },
    { stdout: "a".repeat(64) },
  ]) {
    f.setResult({ ...base, ...change });
    assert.equal(
      executor.observeAbsent(
        "network",
        `crdd-internal-${"1".repeat(16)}`,
        `crdd.coordinator.runtime=${"2".repeat(16)}`,
      ),
      false,
    );
  }
});
