/**
 * 実Proxy Sourceの設定拒否・DNS前拒否を通信なしで検証する。
 * @packageDocumentation
 * @responsibility TypeScriptとPythonの正規形・Hash・閉入力を照合する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 明示指定されたPythonでSourceを読み込む局所反証。
 * @boundary 外部通信・Docker・認証なし。Python未指定では明示skipする。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { prepareDockerNetworkPolicy } from "../../../src/index.ts";

/**
 * npm Registry相当の24 DNS応答を通信なしで検証する。
 * @responsibility 応答件数と全IPの公開性検査を別条件として反証する。
 * @trace ERB-UT-023
 * @precondition 明示Pythonと実Proxy Sourceを使いDNSだけ有限代役へ差替える。
 * @stimulus 観測した12 IPv4＋12 IPv6、32件境界、33件、末尾private IP。
 * @observation 実resolve関数の返却数と固定拒否理由。
 * @oracle 正常24／32件を受理し、上限超過と一件でも非公開IPなら拒否。
 * @cleanup 子Processをjoin。外部通信・Bytecode生成なし。
 * @boundary DNS応答代役と本番Proxy判定。実DockerのDNS観測とは区別する。
 */
test("Proxyは公開DNS24件を受理し件数超過とprivate混入を拒否する", {
  skip: !process.env.CRDD_NETWORK_POLICY_PYTHON,
}, () => {
  const source = path.resolve(
    import.meta.dirname,
    "../../../src/network/provider-egress-proxy.py",
  );
  const program = String.raw`
import runpy, socket, sys
module = runpy.run_path(sys.argv[1])
addresses = [f'104.16.{i}.34' for i in range(12)] + [f'2606:4700::6810:{i:x}22' if i else '2606:4700::6810:22' for i in range(12)]
calls = []
def lookup(host, port, **kwargs):
    calls.append((host, port))
    return [(socket.AF_INET6 if ':' in address else socket.AF_INET, socket.SOCK_STREAM, 6, '', (address, port)) for address in addresses]
module['socket'].getaddrinfo = lookup
assert len(module['resolve_public_addresses']('registry.npmjs.org')) == 24
addresses = [f'104.16.{i}.34' for i in range(32)]
assert len(module['resolve_public_addresses']('registry.npmjs.org')) == 32
addresses.append('104.16.32.34')
try: module['resolve_public_addresses']('registry.npmjs.org')
except ValueError as error: assert str(error) == 'dns_answer_count_invalid'
else: raise AssertionError('over_limit_accepted')
addresses = addresses[:23] + ['127.0.0.1']
try: module['resolve_public_addresses']('registry.npmjs.org')
except ValueError as error: assert str(error) == 'dns_address_not_public'
else: raise AssertionError('private_accepted')
assert calls == [('registry.npmjs.org', 443)] * 4
clock = [0.0]
created = []
succeed = [False]
module['time'].monotonic = lambda: clock[0]
class FakeSocket:
    def __init__(self, *args):
        self.timeouts = []
        self.closed = False
        created.append(self)
    def settimeout(self, value): self.timeouts.append(value)
    def connect(self, target):
        assert target[1] == 443
        self.target = target
        if succeed[0] and len(created) == 2:
            clock[0] += 1
            return
        clock[0] += 5 if succeed[0] else self.timeouts[-1]
        raise OSError('synthetic_timeout')
    def close(self): self.closed = True
module['socket'].socket = FakeSocket
try: module['connect_exact_address']([f'104.16.{i}.34' for i in range(32)])
except OSError: pass
else: raise AssertionError('timeout_accepted')
assert clock[0] == 15 and len(created) == 1 and all(value.closed for value in created)
clock[0] = 0
created.clear()
succeed[0] = True
connected = module['connect_exact_address'](['104.16.0.34', '104.16.1.34'])
assert connected is created[1] and connected.target == ('104.16.1.34', 443)
assert created[0].closed and not connected.closed
assert created[0].timeouts == [15] and connected.timeouts == [10, None] and clock[0] == 6
connected.close()
print('proxy_dns_boundaries_ok')
`;
  const result = spawnSync(
    process.env.CRDD_NETWORK_POLICY_PYTHON ?? "",
    ["-I", "-B", "-c", program, source],
    {
      env: { SystemRoot: process.env.SystemRoot, CRDD_PROXY_PROFILE: "codex" },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 16384,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "proxy_dns_boundaries_ok");
});

/**
 * 同じ意味Hashを持つ正規形だけをPython側でも受理する。
 * @responsibility 配置Sourceの実関数を呼び、模倣した判定で代替しない。
 * @trace ERB-UT-023
 * @precondition CRDD_NETWORK_POLICY_PYTHONに利用可能なPythonを明示する。
 * @stimulus 両Provider・Hash差・Host差・重複Key・構造差を渡す。
 * @observation 固定結果の真偽値とProcess終了を取得する。
 * @oracle 正規形だけ受理し、設定不正は固定Hostへfallbackしない。
 * @cleanup Processを同期joinしBytecodeを生成しない。
 * @boundary 自己生成値と既存Source、外部通信0。
 */
test("Python Proxyは同じ正規形とHashを受理し不正設定を起動前に拒否する", {
  skip: process.env.CRDD_NETWORK_POLICY_PYTHON
    ? false
    : "明示Pythonを用いる限定確認で実施",
}, () => {
  const policies = ["codex", "claude"].map((provider) => {
    const ready = prepareDockerNetworkPolicy(provider, [
      "registry.npmjs.org",
      "pypi.org",
      "files.pythonhosted.org",
    ]);
    if (ready.status !== "ready") assert.fail();
    return ready.policy;
  });
  const source = path.resolve(
    import.meta.dirname,
    "../../../src/network/provider-egress-proxy.py",
  );
  const program = `import json,runpy,sys,os,hashlib
module=runpy.run_path(sys.argv[1])
assert module['NETWORK_POLICY_VALID'] is True and module['NETWORK_POLICY_HASH'] is None
assert module['ALLOWED_HOSTNAMES']==module['PROFILE_ALLOWED_HOSTNAMES']['codex']
policies=json.load(sys.stdin)
accepted=[]
for policy in policies:
 hosts,checksum=module['read_network_policy'](json.dumps(policy,separators=(',',':')),policy['provider'])
 assert sorted(hosts)==policy['allowedHosts'] and checksum==policy['policyHash']
 accepted.append(True)
 for host in ('127.1','2130706433','0x7f000001','0x08080808','0177.0.0.1','1.2.3','123.example','1password.example'):
  changed=dict(policy,allowedHosts=sorted(set(policy['allowedHosts']+[host])))
  payload=json.dumps([1,'repository_ai_execution',policy['provider'],changed['allowedHosts'],443,'CONNECT'],separators=(',',':'))
  changed['policyHash']=hashlib.sha256(b'crdd-docker-network-policy-v1\\0'+payload.encode('ascii')).hexdigest()
  try:
   module['read_network_policy'](json.dumps(changed),policy['provider'])
   assert host in ('123.example','1password.example')
  except ValueError as error:
   assert host not in ('123.example','1password.example') and str(error)=='numeric_address'
 for change in ({'provider':'other'},{'policyHash':'0'*64},{'allowedPort':80},{'allowedPort':True},{'allowedMethod':'GET'},{'extra':True},{'allowedHosts':['127.1']},{'allowedHosts':['0x7f.1']},{'allowedHosts':policy['allowedHosts'][::-1]}):
  try: module['read_network_policy'](json.dumps(dict(policy,**change)),policy['provider'])
  except (ValueError,TypeError): pass
  else: raise AssertionError('invalid_accepted')
 for raw in ('{}','[]','null','{"provider":"codex","provider":"claude"}'):
  try: module['read_network_policy'](raw,policy['provider'])
  except (ValueError,TypeError): pass
  else: raise AssertionError('invalid_accepted')
os.environ['CRDD_PROXY_PROFILE']='codex'
os.environ['CRDD_PROXY_NETWORK_POLICY']=json.dumps(policies[0])
explicit=runpy.run_path(sys.argv[1])
assert explicit['NETWORK_POLICY_VALID'] is True and explicit['NETWORK_POLICY_HASH']==policies[0]['policyHash']
assert explicit['ALLOWED_HOSTNAMES']==frozenset(policies[0]['allowedHosts'])
os.environ['CRDD_PROXY_NETWORK_POLICY']='{}'
invalid=runpy.run_path(sys.argv[1])
assert invalid['NETWORK_POLICY_VALID'] is False and not invalid['ALLOWED_HOSTNAMES']
assert invalid['main']()==2
print(json.dumps({'accepted':accepted,'invalidRejected':True}))
`;
  const result = spawnSync(
    process.env.CRDD_NETWORK_POLICY_PYTHON as string,
    ["-I", "-B", "-c", program, source],
    {
      input: JSON.stringify(policies),
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 16_384,
      windowsHide: true,
      env: {
        SystemRoot: process.env.SystemRoot,
        CRDD_PROXY_PROFILE: "codex",
        CRDD_PROXY_NETWORK_POLICY: undefined,
      },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split(/\r?\n/u);
  assert.deepEqual(JSON.parse(lines.at(-1) ?? ""), {
    accepted: [true, true],
    invalidRejected: true,
  });
});
