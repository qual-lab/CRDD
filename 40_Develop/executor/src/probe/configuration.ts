/**
 * 固定合成Probeのpayloadと期限を所有する。
 * @responsibility 診断の意味をExecutor内へ閉じ、DIへ技術構成だけを渡す。
 * @trace ARCH-000008
 */
import type { IsolationProbeProfile } from "./types.ts";

const PROBE_MARKER = "crdd-coordinator-isolation-v1";
const NORMAL_SOURCE = `
import json, os, pathlib, socket, sys
result={"marker":"${PROBE_MARKER}","allowed_writes":{},"runtime_paths_absent":True,"credential_names_absent":True,"network_blocked":False,"home_isolated":False,"tmp_isolated":False}
for name in ("workspace","provider-home","tmp"):
    target=pathlib.Path("/operation")/name/".coordinator-probe"
    try:
        target.write_text(name,encoding="utf-8"); result["allowed_writes"][name]=target.read_text(encoding="utf-8")==name; target.unlink()
    except Exception: result["allowed_writes"][name]=False
result["runtime_paths_absent"]=all(not pathlib.Path("/runtime",name).exists() for name in ("events","projection","management"))
credential_names={"ANTHROPIC_API_KEY","CLAUDE_CODE_OAUTH_TOKEN","CODEX_API_KEY","CODEX_ACCESS_TOKEN","GH_TOKEN","GITHUB_TOKEN","GIT_ASKPASS","OPENAI_API_KEY","SSH_AUTH_SOCK"}
result["credential_names_absent"]=credential_names.isdisjoint(os.environ)
result["home_isolated"]=os.environ.get("HOME")=="/operation/provider-home"
result["tmp_isolated"]=os.environ.get("TMPDIR")=="/operation/tmp"
sock=socket.socket(socket.AF_INET,socket.SOCK_STREAM); sock.settimeout(0.5)
try: sock.connect(("1.1.1.1",443))
except OSError: result["network_blocked"]=True
finally: sock.close()
print(json.dumps(result,separators=(",",":")))
sys.exit(0 if all(result["allowed_writes"].values()) and all([result["runtime_paths_absent"],result["credential_names_absent"],result["network_blocked"],result["home_isolated"],result["tmp_isolated"]]) else 3)
`;
const CANCELLATION_SOURCE = `
import json, signal, sys, time
marker="crdd-coordinator-cancellation-v1"
def cancelled(_signal,_frame):
    print(json.dumps({"marker":marker,"state":"cancelled"},separators=(",",":")),flush=True)
    sys.exit(42)
signal.signal(signal.SIGTERM,cancelled)
print(json.dumps({"marker":marker,"state":"ready"},separators=(",",":")),flush=True)
while True: time.sleep(0.05)
`;
const PROFILES = Object.freeze({
  normal: Object.freeze({ source: NORMAL_SOURCE, timeoutMs: 30_000 }),
  timeout: Object.freeze({
    source: "import time; time.sleep(2)",
    timeoutMs: 250,
  }),
  output_limit: Object.freeze({
    source: "print('x'*70000)",
    timeoutMs: 10_000,
  }),
  invalid_output: Object.freeze({
    source: "print('not-json')",
    timeoutMs: 10_000,
  }),
  nonzero_exit: Object.freeze({
    source: "import sys; sys.exit(7)",
    timeoutMs: 10_000,
  }),
  cancellation: Object.freeze({
    source: CANCELLATION_SOURCE,
    timeoutMs: 5_000,
  }),
} satisfies Record<
  IsolationProbeProfile,
  Readonly<{ source: string; timeoutMs: number }>
>);

/** 固定profileを選び、任意Scriptへのfallbackを行わない。 */
export function describeIsolationProbeProfile(
  profile: IsolationProbeProfile,
): Readonly<{ source: string; timeoutMs: number }> {
  if (typeof profile !== "string" || !Object.hasOwn(PROFILES, profile))
    throw Error("docker_probe_profile_invalid");
  return PROFILES[profile];
}
