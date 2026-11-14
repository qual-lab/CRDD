/**
 * EM公開契約の独立したModule読込みを新品Nodeで確認する。
 * @packageDocumentation
 * @responsibility AD／DIなしの保存契約ロードと公開理由集合の保持を確認する。
 * @trace RCM-IT-005
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Node Module解決。保存・技術実行・外部AI・Dockerは対象外。
 * @boundary EM公開Rootと実Node子Process。試験一時物は作成しない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dockerProcessControllerPublicCompletionReasons } from "../../src/index.ts";

/**
 * Domainの保存契約が技術Packageなしで開始できることを確認する。
 * @responsibility 旧AD試験の独立ロード検証を保存契約Ownerへ移す。
 * @trace RCM-IT-005
 * @precondition 現在のEM公開Rootを新品Nodeで評価する。
 * @stimulus AD／DIの解決を拒否して公開理由集合を取得する。
 * @observation 子のerror・signal・exitとJSON文字列配列。
 * @oracle 技術Packageをロードせず、親の同公開集合とexactに一致する。
 * @cleanup spawnSyncの正常終了を確認する。永続資源なし。
 * @boundary 保存・外部AI・Dockerは起動しない。
 */
test("Domain保存契約はAI Adapterを解決せず同じ拒否理由を保持する", () => {
  const entry = new URL("../../src/index.ts", import.meta.url).href;
  const source = `import { registerHooks } from 'node:module';
    registerHooks({resolve(s,c,next){const r=next(s,c);if(['/ai-adapter/','/docker-isolation/'].some(name=>r.url.includes(name)))throw Error('technical_package_forbidden');return r;}});
    const api=await import(${JSON.stringify(entry)});
    console.log(JSON.stringify(api.dockerProcessControllerPublicCompletionReasons));`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    dockerProcessControllerPublicCompletionReasons,
  );
});

/**
 * DIなしでEM自身をロードする旧相互独立試験のモデル側を保持する。
 * @responsibility 下位Packageの試験から上位Rootの起動を取り除く。
 * @trace ERB-IT-014
 * @precondition 新品NodeのModule解決だけを使用する。
 * @stimulus Docker Isolationの読込みを拒否しEM公開Rootを起動する。
 * @observation 子のerror・signal・exit・固定marker。
 * @oracle 元の四観測が成立し、保存やParserを呼ばない。
 * @cleanup 子Processの正常終了を確認する。試験一時物なし。
 * @boundary 純粋なModuleロードであり保存耐久性の証明ではない。
 */
test("EMはDocker Isolationなしで公開Rootを開始する", () => {
  const target = new URL("../../src/index.ts", import.meta.url).href;
  const code = `import {registerHooks} from "node:module";
 const blocked=["docker-isolation"];
 registerHooks({resolve(s,c,next){const r=next(s,c);if(blocked.some(name=>r.url.includes("/"+name+"/")))throw Error("owner_forbidden");return r;}});
 await import(${JSON.stringify(target)});
 console.log("OWNER_INDEPENDENT");`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "OWNER_INDEPENDENT");
});
