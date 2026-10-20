/**
 * 追加通信先を固定Imageと合成内容だけで実測する明示試験。
 * @packageDocumentation
 * @responsibility npm／pip取得、非許可Host・直接通信拒否、待機取消とexact ID回収を確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 明示承認後だけ。二つの直列場面、同時Container二件・Network二件まで。
 * @boundary 実Dockerと公開Package Registry。認証・Repository本文・外部AIなし。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { setTimeout as delay } from "node:timers/promises";
import { prepareDockerNetworkPolicy } from "../../src/index.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "../../src/docker-cli/trust.ts";
import { createDockerCliEnvironment } from "../../src/docker-cli/environment.ts";
import { createNetworkPolicyDirectory } from "../fixtures/network-policy-directory.ts";

const enabled = process.env.CRDD_NETWORK_POLICY_REAL_TEST === "1";
const imagePattern = /^sha256:[a-f0-9]{64}$/u;
const resourcePattern = /^[a-f0-9]{64}$/u;
const label = "crdd.network-policy-trial";
const endpoint = "npipe:////./pipe/dockerDesktopLinuxEngine";

/**
 * 通信試験のRoot準備と実体差替え拒否をFilesystemだけで確認する。
 * @responsibility 別Packageの私有helperへ依存せず元Rootだけを回収する。
 * @trace ERB-IT-002
 * @precondition 現在Repository内の自己生成二領域だけ。
 * @stimulus 通常回収と、元領域の一時改名・別実体への差替え。
 * @observation cleanup結果、差替え側marker、元Root復元後の不存在。
 * @oracle 差替えは削除0で拒否し、元Identityへ復元した場合だけ回収する。
 * @cleanup 自己生成の差替え領域を除き元実体を戻して正式cleanupする。
 * @boundary 実Filesystem。Docker・通信・AIなし。
 */
test("通信試験Directoryは自己生成Rootだけを回収し差替えを拒否する", () => {
  const normal = createNetworkPolicyDirectory();
  normal.cleanup();
  assert.equal(fs.existsSync(normal.path), false);
  const owned = createNetworkPolicyDirectory();
  const original = `${owned.path}-original`;
  let moved = false;
  try {
    fs.renameSync(owned.path, original);
    moved = true;
    fs.mkdirSync(owned.path);
    fs.writeFileSync(path.join(owned.path, "marker"), "synthetic");
    assert.throws(() => owned.cleanup(), /testing_directory_identity_changed/u);
    assert.equal(
      fs.readFileSync(path.join(owned.path, "marker"), "utf8"),
      "synthetic",
    );
  } finally {
    if (moved) {
      const target = path.resolve(owned.path);
      assert.equal(path.dirname(target), path.dirname(original));
      const replacement = fs.lstatSync(target);
      assert.ok(replacement.isDirectory() && !replacement.isSymbolicLink());
      fs.rmSync(target, { recursive: true });
      fs.renameSync(original, owned.path);
    }
    owned.cleanup();
  }
});

// 合成Clientは取得したPackageのコードを実行せず、版だけ読み取る。
const nodeClient = String.raw`
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'); const net=require('node:net');
/**
 * Registryへの直接通信拒否を検証する。
 * @responsibility Proxyを使わない接続が成立しないことを観測する。
 * @trace ERB-IT-002
 * @precondition internal-only Clientで実行する。
 * @stimulus Registryの443へ直接TCP接続する。
 * @observation connect/error/timeout。
 * @oracle connect成立なら失敗、4秒以内の拒否・到達不能だけ受理する。
 * @cleanup 全分岐でSocketを破棄する。
 * @boundary Clientの実Networkと外部Registry。
 */
async function directDenied(){
  await new Promise((resolve,reject)=>{
    const s=net.connect({host:'registry.npmjs.org',port:443});
    s.setTimeout(4000); s.once('connect',()=>{s.destroy();reject(Error('direct_open'));});
    s.once('timeout',()=>{s.destroy();resolve();}); s.once('error',()=>resolve());
  });
}
/**
 * 非許可HostへのCONNECT拒否を検証する。
 * @responsibility 許可済みProxy認証とHost拒否を区別する。
 * @trace ERB-IT-002
 * @precondition 同じProxyが許可通信を処理済み。
 * @stimulus example.comへ認証付きCONNECTを一回発行する。
 * @observation 応答statusと期限。
 * @oracle 403だけ受理し、接続不能やtimeoutは成功にしない。
 * @cleanup 応答・異常・期限の全経路でSocketを破棄する。
 * @boundary Clientと固定Proxy。認証情報を報告しない。
 */
async function hostDenied(){
  await new Promise((resolve,reject)=>{
    let text=''; const s=net.connect({host:'proxy',port:8080});
    s.setTimeout(6000); s.once('timeout',()=>{s.destroy();reject(Error('deny_timeout'));});
    s.once('error',()=>reject(Error('deny_io')));
    s.once('connect',()=>s.write('CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\nProxy-Authorization: Basic '+Buffer.from('crdd:'+process.env.CRDD_TRIAL_AUTH).toString('base64')+'\r\n\r\n'));
    s.on('data',b=>{text+=b.toString('ascii');if(text.includes('\r\n')){s.destroy();/^HTTP\/1\.1 403 /.test(text)?resolve():reject(Error('deny_status'));}});
  });
}
(async()=>{
 let stage='runtime';
 try{
  if(process.versions.node.split('.')[0]!=='24')throw Error('node_version');
  stage='install';
  execFileSync('/usr/local/bin/npm',['install','is-number@7.0.0','--prefix=/tmp/project','--registry=https://registry.npmjs.org','--cache=/tmp/npm-cache','--ignore-scripts','--no-audit','--no-fund','--package-lock=false','--fetch-retries=0'],{stdio:['ignore','ignore','pipe'],maxBuffer:16384,timeout:90000});
  stage='version';
  if(JSON.parse(fs.readFileSync('/tmp/project/node_modules/is-number/package.json','utf8')).version!=='7.0.0')throw Error('version');
  stage='host_deny'; await hostDenied(); stage='direct_deny'; await directDenied();
  console.log('CRDD_NETWORK_TRIAL_READY'); setInterval(()=>{},1000);
 }catch(error){
  const text=Buffer.isBuffer(error.stderr)?error.stderr.toString('utf8'):'';
  const codes=['EACCES','ENOENT','ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','E403','E407','E404','EINTEGRITY','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE'];
  const known=['node_version','version','direct_open','deny_timeout','deny_io','deny_status'];
  const reason=known.includes(error.message)?error.message:codes.find(code=>new RegExp('\\b'+code+'\\b').test(text))??(codes.includes(error.code)?error.code:'client_exception');
  console.log('CRDD_NETWORK_TRIAL_FAILED '+JSON.stringify({stage,reason,exitCode:Number.isInteger(error.status)?error.status:null}));process.exitCode=2;
 }
})();
`;
const pythonClient = String.raw`
import base64, importlib.metadata, os, socket, subprocess, sys, time
stage = 'install'
try:
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'six==1.17.0', '--quiet', '--index-url', 'https://pypi.org/simple', '--target', '/tmp/packages', '--no-cache-dir', '--disable-pip-version-check', '--no-input', '--only-binary=:all:', '--retries', '0', '--timeout', '20'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    stage = 'version'
    versions = [d.version for d in importlib.metadata.distributions(path=['/tmp/packages']) if d.metadata['Name'] == 'six']
    if versions != ['1.17.0']: raise ValueError('version')
    stage = 'host_deny'
    with socket.create_connection(('proxy', 8080), timeout=6) as connection:
        auth = base64.b64encode(('crdd:' + os.environ['CRDD_TRIAL_AUTH']).encode('ascii')).decode('ascii')
        connection.sendall(('CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\nProxy-Authorization: Basic ' + auth + '\r\n\r\n').encode('ascii'))
        reply = connection.recv(4096)
        if not reply.startswith(b'HTTP/1.1 403 '): raise ValueError('deny_status')
    stage = 'direct_deny'
    try:
        connection = socket.create_connection(('pypi.org', 443), timeout=4)
    except OSError:
        pass
    else:
        connection.close()
        raise ValueError('direct_open')
    print('CRDD_NETWORK_TRIAL_READY', flush=True)
    while True: time.sleep(1)
except Exception as error:
    import json
    known = ['version', 'direct_open', 'deny_status']
    reason = str(error) if str(error) in known else 'install_failed' if isinstance(error, subprocess.CalledProcessError) else 'install_timeout' if isinstance(error, subprocess.TimeoutExpired) else 'client_exception'
    code = getattr(error, 'returncode', None)
    print('CRDD_NETWORK_TRIAL_FAILED ' + json.dumps({'stage': stage, 'reason': reason, 'exitCode': code if type(code) is int else None}, separators=(',', ':')), flush=True)
    sys.exit(2)
`;

/**
 * npm失敗の診断を外部Process・通信なしで反証する。
 * @responsibility 実Client本文の段階・固定分類・終了値だけを公開することを確認する。
 * @trace ERB-IT-002
 * @precondition VM内のchild_process代役だけが固定例外を返す。
 * @stimulus 権限・DNS・未知例外・版不一致を与える。
 * @observation Clientの一行JSONと終了値。
 * @oracle 生stderr・秘密風文字列を出さずinstallとversionを区別する。
 * @cleanup VMと局所値だけ。Process・File・Network作成0。
 * @boundary 実Client本文と有限I/O代役、実通信の代替ではない。
 */
test("限定Clientの失敗診断は段階と固定理由だけを保持する", async () => {
  for (const reason of ["EACCES", "ENOTFOUND", "unknown", "version"]) {
    const output: string[] = [];
    const processFixture = { versions: { node: "24.0.0" }, exitCode: 0 };
    await vm.runInNewContext(nodeClient, {
      Buffer,
      process: processFixture,
      console: { log: (line: string) => output.push(line) },
      require: (name: string) =>
        name === "node:child_process"
          ? {
              execFileSync: () => {
                if (reason !== "version")
                  throw Object.assign(new Error("DO_NOT_REPORT_SECRET"), {
                    status: 7,
                    stderr: Buffer.from(
                      `npm error code ${reason}\nDO_NOT_REPORT_SECRET`,
                    ),
                  });
              },
            }
          : name === "node:fs"
            ? { readFileSync: () => '{"version":"0.0.0"}' }
            : {},
    });
    assert.equal(processFixture.exitCode, 2);
    assert.equal(output.length, 1);
    const line = output[0] ?? "";
    assert.equal(line.includes("DO_NOT_REPORT_SECRET"), false);
    assert.deepEqual(
      JSON.parse(line.replace("CRDD_NETWORK_TRIAL_FAILED ", "")),
      {
        stage: reason === "version" ? "version" : "install",
        reason: reason === "unknown" ? "client_exception" : reason,
        exitCode: reason === "version" ? null : 7,
      },
    );
  }
});

/**
 * Python Clientの失敗診断をProcess内代役で反証する。
 * @responsibility pipの自由なstderrを保持せず型だけから固定分類する。
 * @trace ERB-IT-002
 * @precondition 明示Pythonを使用する。未指定はskip。
 * @stimulus 実Clientのsubprocess.runだけを固定例外へ差替える。
 * @observation 固定一行JSONと終了値。
 * @oracle 生stderr非保持、install_failedと終了7が残る。
 * @cleanup 子ProcessをjoinしBytecode・File・Networkを作らない。
 * @boundary 実Python Client本文と局所代役。実pip成立とは区別する。
 */
test("Python Clientはstderrを保持せず固定失敗を返す", {
  skip: !process.env.CRDD_NETWORK_POLICY_PYTHON,
}, () => {
  const result = spawnSync(
    process.env.CRDD_NETWORK_POLICY_PYTHON ?? "",
    [
      "-I",
      "-B",
      "-c",
      String.raw`
import contextlib, io, json, subprocess, sys
source = sys.stdin.read()
def failed(*args, **kwargs):
    assert kwargs['stderr'] == subprocess.DEVNULL
    raise subprocess.CalledProcessError(7, 'synthetic', stderr=b'DO_NOT_REPORT_SECRET')
subprocess.run = failed
output = io.StringIO()
try:
    with contextlib.redirect_stdout(output): exec(source, {'__name__': '__main__'})
except SystemExit as error:
    assert error.code == 2
else:
    raise AssertionError('exit_missing')
assert output.getvalue() == 'CRDD_NETWORK_TRIAL_FAILED ' + json.dumps({'stage': 'install', 'reason': 'install_failed', 'exitCode': 7}, separators=(',', ':')) + '\n'
print('python_client_diagnostic_ok')
`,
    ],
    {
      input: pythonClient,
      env: { SystemRoot: process.env.SystemRoot },
      windowsHide: true,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 16384,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "python_client_diagnostic_ok");
});

/**
 * 一承認に対応する直列二場面を一度だけ実行する。
 * @responsibility 最初の失敗で後続を止め、作成要求不明を成功へ補完しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 明示flagと事前固定した二Imageの実IDが必要。
 * @stimulus npm、pip、非許可Host、直接通信、取得後待機の取消。
 * @observation 固定成功marker、Proxyの非秘密診断、inspect、一覧、子close。
 * @oracle 版一致、403、直接接続失敗、元ID不存在。実AI／取得中取消の成立とは扱わない。
 * @cleanup 作成済み実IDを再照合して回収。不明なら試験記録だけ保持して停止。
 * @boundary Network slice。通常の認証Containerを含む製品全体E2Eではない。
 */
test("Docker explicit: Repository追加通信先のnpm・pip・拒否・取消・回収", {
  skip: !enabled,
  timeout: 360000,
}, async (t) => {
  const proxyImage = process.env.CRDD_NETWORK_POLICY_PROXY_IMAGE ?? "";
  const nodeImage = process.env.CRDD_NETWORK_POLICY_NODE_IMAGE ?? "";
  assert.ok(
    imagePattern.test(proxyImage) && imagePattern.test(nodeImage),
    "fixed_image_ids_required",
  );
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.equal(
    fs.realpathSync.native(repository).toLowerCase(),
    repository.toLowerCase(),
  );
  const pins = JSON.parse(
    fs.readFileSync(
      new URL("../fixtures/network-policy-images.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    imagePattern.test(pins.proxyImage) && imagePattern.test(pins.nodeImage),
    "trial_images_not_prepared",
  );
  assert.ok(
    proxyImage === pins.proxyImage &&
      nodeImage === pins.nodeImage &&
      /^node@sha256:[a-f0-9]{64}$/u.test(pins.nodeDistributionDigest),
    "approved_image_identity_mismatch",
  );
  assert.equal(
    createHash("sha256")
      .update(
        fs.readFileSync(
          new URL(
            "../../src/network/provider-egress-proxy.py",
            import.meta.url,
          ),
        ),
      )
      .digest("hex"),
    pins.proxySourceSha256,
    "proxy_build_source_changed",
  );
  const trust = observeTrustedDockerCli();
  const trial = randomBytes(12).toString("hex");
  const resources: {
    kind: "container" | "network";
    id: string | null;
    name: string;
    image: string | null;
    internal: boolean;
  }[] = [];
  const owned = createNetworkPolicyDirectory();
  const root = owned.path;
  t.after(() => {
    if (
      resources.length === 0 &&
      fs.existsSync(root) &&
      !fs.existsSync(path.join(root, "result.json"))
    )
      owned.cleanup();
  });
  const home = path.join(root, "docker-home");
  fs.mkdirSync(home);
  const observedEnvironment = createDockerCliEnvironment({
    dockerConfig: home,
    dockerHome: home,
  });
  assert.ok(observedEnvironment, "docker_environment_unavailable");
  const environment = observedEnvironment;
  let stage = "preflight";
  let complete = false;
  let processUnjoined = false;
  let primaryFailure: unknown;
  let secondaryFailure = false;
  let clientFailure: {
    stage: string;
    reason: string;
    exitCode: number | null;
  } | null = null;
  let proxyOutcomes: Record<string, number> | null = null;
  /**
   * 固定Engineへ一回の有限要求を発行する。
   * @responsibility ambient環境・再試行・自由な失敗本文の公開を避ける。
   * @trace ERB-IT-001
   * @input args: 試験本文の固定操作と自己生成ID。
   * @returns 成功時の上限付きstdout。
   * @precondition 同じCLI Identityを毎要求前に再確認する。
   * @postcondition 非0・timeoutは固定失敗で停止する。
   * @effect 明示試験に限定したDocker要求。
   * @failure 非0を不存在へ変換しない。
   * @invariant Image取得・再起動・既存資源操作なし。
   * @boundary 試験器と固定Engine。
   * @security 引数・環境・stderrを報告しない。
   * @concurrency 同期要求は直列、一要求30秒上限。
   * @stimulus 固定Engineへ指定argsを一回発行する。
   * @observation Process終了・Signal・stdoutの容量上限。
   * @oracle 非0・timeoutを不存在や成功へ変換しない。
   * @cleanup 同期子をjoinし、下位実資源は親のcleanupへ渡す。
   */
  function docker(args: string[]): string {
    const result = spawnSync(
      verifyTrustedDockerCliSnapshot(trust),
      ["--host", endpoint, ...args],
      {
        env: environment,
        windowsHide: true,
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (result.error || result.signal || result.status !== 0)
      throw new Error(`network_trial_${stage}_docker_failed`);
    return result.stdout.trim();
  }
  /**
   * 作成要求前に候補を保持し、返却された実IDだけを回収対象にする。
   * @responsibility create結果不明時に名前削除や再作成へ進まない。
   * @trace ERB-IT-001
   * @input kind、name、args、image、internal: この試験だけの作成構成。
   * @returns 自己生成した実ID。
   * @precondition 既存の同label資源がない。
   * @postcondition 64桁ID以外は保持して停止する。
   * @effect network/container createのみ。
   * @failure 不明な対象は削除しない。
   * @invariant 同時Container二件、Network二件以内。
   * @boundary Docker受理と結果記録を区別する。
   * @security 秘密値を記録しない。
   * @concurrency 直列作成のみ。
   * @stimulus kind別二件上限を照合し一回createする。
   * @observation 実64桁IDと要求前候補記録。
   * @oracle 不明は再試行・名前削除へ進めない。
   * @cleanup 返却実IDは親がfresh照合して回収する。
   */
  function create(
    kind: "container" | "network",
    name: string,
    args: string[],
    image: string | null,
    internal = false,
  ): string {
    if (resources.filter((resource) => resource.kind === kind).length >= 2)
      throw new Error("network_trial_resource_limit");
    const resource = { kind, id: null as string | null, name, image, internal };
    resources.push(resource);
    const id = docker(args);
    if (!resourcePattern.test(id))
      throw new Error("network_trial_create_outcome_unknown");
    resource.id = id;
    return id;
  }
  /**
   * fresh inspectした自己生成対象だけを元IDで回収する。
   * @responsibility 不明・別label・別Image・外部接続を削除しない。
   * @trace ERB-IT-002
   * @input N/A: 現在場面の自己生成Resource集合。
   * @returns 全対象の元IDとlabel一覧が明示空ならtrue。
   * @precondition Docker要求が観測可能。
   * @postcondition 一件の失敗でも他の独立した回収は試みる。
   * @effect 自己生成Container stop/rm、Network rmのみ。
   * @failure 未知・不一致を保ち記録Rootを残す。
   * @invariant 名前による削除なし、既存資源操作なし。
   * @boundary 現在構成と削除Effect。
   * @security inspect本文・Tokenは出力しない。
   * @concurrency client→proxy→Networkの逆作成順。
   * @stimulus 保持した実IDをfresh照合して逆順回収する。
   * @observation inspectと実ID／label一覧の明示空。
   * @oracle 不明・構成差・使用中は削除せずfalseを返す。
   * @cleanup 不確定対象は記録を保持する。
   */
  function cleanup(): boolean {
    let clean = true;
    for (const resource of [...resources].reverse()) {
      try {
        if (!resource.id) throw new Error("unknown_id");
        const listed = docker(
          resource.kind === "container"
            ? [
                "container",
                "ls",
                "--all",
                "--no-trunc",
                "--filter",
                `id=${resource.id}`,
                "--format",
                "{{.ID}}",
              ]
            : [
                "network",
                "ls",
                "--no-trunc",
                "--filter",
                `id=${resource.id}`,
                "--format",
                "{{.ID}}",
              ],
        );
        if (listed === "") continue;
        if (listed !== resource.id) throw new Error("identity_mismatch");
        const info = JSON.parse(
          docker([resource.kind, "inspect", resource.id]),
        )[0];
        const labels =
          resource.kind === "container" ? info.Config?.Labels : info.Labels;
        if (
          labels?.[label] !== trial ||
          String(info.Name).replace(/^\//u, "") !== resource.name
        )
          throw new Error("ownership_mismatch");
        if (resource.kind === "container") {
          if (
            info.Image !== resource.image ||
            info.HostConfig?.Privileged !== false ||
            info.Mounts?.length !== 0
          )
            throw new Error("configuration_mismatch");
          if (info.State?.Running)
            docker(["container", "stop", "--time", "2", resource.id]);
          docker(["container", "rm", resource.id]);
        } else {
          if (
            info.Driver !== "bridge" ||
            info.Internal !== resource.internal ||
            Object.keys(info.Containers ?? {}).length !== 0
          )
            throw new Error("network_in_use");
          docker(["network", "rm", resource.id]);
        }
        const absent = docker(
          resource.kind === "container"
            ? [
                "container",
                "ls",
                "--all",
                "--no-trunc",
                "--filter",
                `id=${resource.id}`,
                "--format",
                "{{.ID}}",
              ]
            : [
                "network",
                "ls",
                "--no-trunc",
                "--filter",
                `id=${resource.id}`,
                "--format",
                "{{.ID}}",
              ],
        );
        if (absent !== "") throw new Error("resource_remaining");
      } catch {
        clean = false;
      }
    }
    for (const kind of ["container", "network"] as const) {
      try {
        const args =
          kind === "container"
            ? ["container", "ls", "--all"]
            : ["network", "ls"];
        if (
          docker([
            ...args,
            "--filter",
            `label=${label}=${trial}`,
            "--format",
            "{{.ID}}",
          ]) !== ""
        )
          clean = false;
      } catch {
        clean = false;
      }
    }
    return clean;
  }
  try {
    assert.equal(docker(["info", "--format", "{{.OSType}}"]), "linux");
    for (const image of [proxyImage, nodeImage])
      assert.equal(
        docker(["image", "inspect", "--format", "{{.Id}}", image]),
        image,
      );
    assert.ok(
      JSON.parse(
        docker([
          "image",
          "inspect",
          "--format",
          "{{json .RepoDigests}}",
          nodeImage,
        ]),
      ).includes(pins.nodeDistributionDigest),
      "node_distribution_identity_mismatch",
    );
    for (const scenario of ["npm", "pip"] as const) {
      resources.length = 0;
      stage = `${scenario}_create`;
      const token = randomBytes(32).toString("hex");
      const policy = prepareDockerNetworkPolicy("codex", [
        "registry.npmjs.org",
        "pypi.org",
        "files.pythonhosted.org",
      ]);
      assert.equal(policy.status, "ready");
      if (policy.status !== "ready")
        throw new Error("network_trial_policy_invalid");
      const prefix = `crdd-network-${trial}-${scenario}`;
      const internal = create(
        "network",
        `${prefix}-internal`,
        [
          "network",
          "create",
          "--driver",
          "bridge",
          "--internal",
          "--label",
          `${label}=${trial}`,
          `${prefix}-internal`,
        ],
        null,
        true,
      );
      const egress = create(
        "network",
        `${prefix}-egress`,
        [
          "network",
          "create",
          "--driver",
          "bridge",
          "--label",
          `${label}=${trial}`,
          `${prefix}-egress`,
        ],
        null,
      );
      const common = [
        "--pull=never",
        "--read-only",
        "--user",
        "65534:65534",
        "--cap-drop=ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "64",
        "--label",
        `${label}=${trial}`,
      ];
      const proxy = create(
        "container",
        `${prefix}-proxy`,
        [
          "container",
          "create",
          ...common,
          "--name",
          `${prefix}-proxy`,
          "--network",
          internal,
          "--network-alias",
          "proxy",
          "--env",
          "CRDD_PROXY_PROFILE=codex",
          "--env",
          `CRDD_PROXY_AUTH=${token}`,
          "--env",
          `CRDD_PROXY_NETWORK_POLICY=${JSON.stringify(policy.policy)}`,
          proxyImage,
        ],
        proxyImage,
      );
      docker(["network", "connect", egress, proxy]);
      docker(["container", "start", proxy]);
      stage = `${scenario}_proxy_ready`;
      let ready = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const records = docker(["container", "logs", proxy])
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        ready = records.some(
          (record) =>
            record.outcome === "ready" &&
            record.networkPolicyHash === policy.policy.policyHash,
        );
        if (ready) break;
        await delay(100);
      }
      assert.ok(ready, "network_trial_proxy_not_ready");
      const proxyUrl = `http://crdd:${token}@proxy:8080`;
      const variables = [
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "ALL_PROXY",
        "https_proxy",
        "http_proxy",
        "all_proxy",
      ].flatMap((key) => ["--env", `${key}=${proxyUrl}`]);
      const image = scenario === "npm" ? nodeImage : proxyImage;
      const command =
        scenario === "npm"
          ? ["--entrypoint", "/usr/local/bin/node", image, "-e", nodeClient]
          : [
              "--entrypoint",
              "/usr/local/bin/python",
              image,
              "-I",
              "-B",
              "-c",
              pythonClient,
            ];
      const client = create(
        "container",
        `${prefix}-client`,
        [
          "container",
          "create",
          ...common,
          "--name",
          `${prefix}-client`,
          "--network",
          internal,
          "--tmpfs",
          "/tmp:rw,nosuid,nodev,size=134217728,mode=1777",
          "--workdir",
          "/tmp",
          "--env",
          "HOME=/tmp",
          "--env",
          "NO_PROXY=",
          "--env",
          "no_proxy=",
          "--env",
          `CRDD_TRIAL_AUTH=${token}`,
          ...variables,
          ...command,
        ],
        image,
      );
      stage = `${scenario}_acquisition`;
      let output = "";
      let overflow = false;
      let child: ChildProcess | null = null;
      let joined = false;
      try {
        const attached = spawn(
          verifyTrustedDockerCliSnapshot(trust),
          ["--host", endpoint, "container", "start", "--attach", client],
          {
            env: environment,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        child = attached;
        const closed = new Promise<void>((resolve) => {
          attached.once("error", () => {
            overflow = true;
          });
          attached.once("close", () => {
            joined = true;
            resolve();
          });
        });
        for (const stream of [child.stdout, child.stderr])
          stream?.on("data", (chunk: Buffer) => {
            if (output.length + chunk.length > 65536) overflow = true;
            else output += chunk.toString("utf8");
          });
        const deadline = Date.now() + 110000;
        while (
          !joined &&
          !overflow &&
          !output.includes("CRDD_NETWORK_TRIAL_READY") &&
          !output.includes("CRDD_NETWORK_TRIAL_FAILED") &&
          Date.now() < deadline
        )
          await delay(100);
        if (output.startsWith("CRDD_NETWORK_TRIAL_FAILED ")) {
          try {
            const report = JSON.parse(
              output.slice("CRDD_NETWORK_TRIAL_FAILED ".length),
            );
            const reasons = [
              "node_version",
              "version",
              "direct_open",
              "deny_timeout",
              "deny_io",
              "deny_status",
              "client_exception",
              "install_failed",
              "install_timeout",
              "EACCES",
              "ENOENT",
              "ENOTFOUND",
              "ECONNREFUSED",
              "ECONNRESET",
              "ETIMEDOUT",
              "EAI_AGAIN",
              "ENETUNREACH",
              "EHOSTUNREACH",
              "E403",
              "E407",
              "E404",
              "EINTEGRITY",
              "SELF_SIGNED_CERT_IN_CHAIN",
              "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
            ];
            if (
              [
                "runtime",
                "install",
                "version",
                "host_deny",
                "direct_deny",
              ].includes(report.stage) &&
              reasons.includes(report.reason) &&
              (report.exitCode === null || Number.isInteger(report.exitCode))
            )
              clientFailure = {
                stage: report.stage,
                reason: report.reason,
                exitCode: report.exitCode,
              };
          } catch {
            /* 不正な自由本文を診断へ昇格しない。 */
          }
        }
        assert.ok(
          !overflow && output.trim() === "CRDD_NETWORK_TRIAL_READY" && !joined,
          "network_trial_client_failed",
        );
        assert.ok(
          !output.includes(token) &&
            !output.includes(Buffer.from(`crdd:${token}`).toString("base64")),
          "network_trial_secret_output",
        );
        const outcomes = docker(["container", "logs", proxy])
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        assert.ok(
          outcomes.some(
            (record) =>
              record.outcome === "hostname_denied" &&
              record.hostname === undefined &&
              record.networkPolicyHash === policy.policy.policyHash,
          ),
          "network_trial_deny_unobserved",
        );
        stage = `${scenario}_waiting_cancel`;
        docker(["container", "stop", "--time", "2", client]);
        await Promise.race([closed, delay(10000)]);
        assert.ok(joined, "network_trial_attach_unjoined");
        t.diagnostic(
          `${scenario}: version/allow/deny/direct-deny/wait-cancel observed; policy=${policy.policy.policyHash}`,
        );
      } catch (error) {
        try {
          const allowed = [
            "ready",
            "authentication_denied",
            "hostname_denied",
            "tunnel_established",
            "tunnel_closed",
            "request_denied",
            "tunnel_failed",
          ];
          const counts: Record<string, number> = {};
          for (const line of docker(["container", "logs", proxy])
            .split("\n")
            .filter(Boolean)) {
            const record = JSON.parse(line);
            if (
              record.event !== "crdd_provider_proxy" ||
              record.networkPolicyHash !== policy.policy.policyHash ||
              !allowed.includes(record.outcome)
            )
              throw new Error("proxy_diagnostic_invalid");
            const reasons = [
              "dns_answer_count_invalid",
              "dns_address_not_public",
              "dns_resolution_failed",
              "request_or_connection_failed",
            ];
            const key =
              record.reason === undefined
                ? record.outcome
                : reasons.includes(record.reason)
                  ? `${record.outcome}:${record.reason}`
                  : null;
            if (key === null) throw new Error("proxy_diagnostic_invalid");
            counts[key] = (counts[key] ?? 0) + 1;
          }
          proxyOutcomes = counts;
        } catch {
          proxyOutcomes = null;
        }
        t.diagnostic(JSON.stringify({ stage, clientFailure, proxyOutcomes }));
        throw error;
      } finally {
        if (!joined && child) {
          try {
            docker(["container", "stop", "--time", "2", client]);
          } catch {
            /* 正式なfinally回収で再観測する。 */
          }
          const deadline = Date.now() + 10000;
          while (!joined && Date.now() < deadline) await delay(100);
          if (!joined) {
            child.kill();
            const closeDeadline = Date.now() + 5000;
            while (!joined && Date.now() < closeDeadline) await delay(100);
            processUnjoined = !joined;
          }
        }
      }
      stage = `${scenario}_cleanup`;
      assert.ok(cleanup(), "network_trial_cleanup_unconfirmed");
    }
    complete = true;
  } catch (error) {
    primaryFailure = error;
  } finally {
    const clean = cleanup() && !processUnjoined;
    secondaryFailure = !clean;
    try {
      if (complete && clean) {
        owned.cleanup();
        assert.equal(fs.existsSync(root), false);
      } else {
        fs.writeFileSync(
          path.join(root, "result.json"),
          JSON.stringify(
            {
              contract: "crdd/network-policy-trial",
              at: new Date().toISOString(),
              stage,
              cleanupConfirmed: clean,
              primaryFailureObserved: primaryFailure !== undefined,
              processUnjoined,
              clientFailure,
              proxyOutcomes,
              resources,
            },
            null,
            2,
          ),
        );
        t.diagnostic(
          `network trial stopped; stage=${stage}; cleanupConfirmed=${clean}; record=${path.basename(root)}/result.json`,
        );
      }
    } catch {
      secondaryFailure = true;
      t.diagnostic(
        "network trial secondary cleanup/record failure; primary retained",
      );
    }
  }
  if (primaryFailure !== undefined) throw primaryFailure;
  assert.equal(secondaryFailure, false, "network_trial_cleanup_unconfirmed");
});
