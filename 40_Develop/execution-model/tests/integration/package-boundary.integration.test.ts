/**
 * EM公開契約の独立したModule読込みを新品Nodeで確認する。
 * @packageDocumentation
 * @responsibility AD／DIなしの保存契約ロードと、保存層なしの純粋資源操作を確認する。
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
 * 主体の値とDecision入力検査が全体State検査なしで動くことを確認する。
 * @responsibility 値Ownerの移管を名前だけの変更にしない。
 * @trace RCM-IT-005
 * @precondition 新品Nodeと合成主体だけを使用する。
 * @stimulus State検査・保存層の解決を拒否して主体とDecisionを検査する。
 * @observation 子のerror・signal・exitと固定完了文字列。
 * @oracle メールの大小文字を保持し、予約prefix不正と不正Decisionを拒否する。
 * @cleanup 子の終了を確認する。一時物なし。
 * @boundary 値検査とModule解決のみ。認証や保存成功の証明ではない。
 */
test("主体値とDecision検査は全体State検査と保存層を解決しない", () => {
  const value = new URL("../../src/state/operations.ts", import.meta.url).href;
  const decision = new URL("../../src/decision/validation.ts", import.meta.url)
    .href;
  const code = `import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({resolve(s,c,next){const r=next(s,c);
 if(["/src/state/validation.ts","/src/state/crud.ts","/src/storage/"].some(p=>r.url.includes(p))) throw Error("whole_state_forbidden");
 return r;
}});
const api=await import(${JSON.stringify(value)});
const decision=await import(${JSON.stringify(decision)});
assert.equal(api.createLocalPrincipalId("Alice+dev@Example.invalid"),"local.email.Alice+dev@Example.invalid");
assert.equal(api.isPrincipalId("local.email.Alice+dev@Example.invalid"),true);
assert.equal(api.isPrincipalId("operator-a"),true);
assert.equal(api.isPrincipalId("local.email.invalid"),false);
assert.equal(api.isPrincipalId("a@b"),false);
assert.equal(api.createLocalPrincipalId(null),null);
assert.equal(decision.inspectDecision(null),null);
console.log("PURE_PRINCIPAL");`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "PURE_PRINCIPAL");
});

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

/**
 * 資源記録の値更新はState候補・CRUD・Storageのロードなしで成立する。
 * @responsibility 名前だけの移動で保存依存が残る反証を新品Processで検出する。
 * @trace RCM-IT-005
 * @precondition 新品Nodeと非秘密の合成資源情報だけを使う。
 * @stimulus 保存／全体候補のModule解決を拒否しIntentと清掃不明を適用する。
 * @observation 子のerror・signal・exit、更新した有限checkpoint。
 * @oracle Intentが保存候補となり、清掃不明を不存在へ変換しない。
 * @cleanup 子Processの正常終了を確認する。一時File・実資源は作らない。
 * @boundary Module解決と純粋な値操作。保存・Docker・外部AIは対象外。
 */
test("資源の純粋操作はState候補と保存層を解決しない", () => {
  const entry = new URL("../../src/attempt/operations.ts", import.meta.url)
    .href;
  const code = `import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({resolve(s,c,next){
  const result=next(s,c);
  if(["/src/storage/","/src/state/crud.ts","/src/state/validation.ts","/src/attempt/crud.ts","/src/attempt/validation.ts"].some(target=>result.url.includes(target)))
    throw Error("persistence_dependency_forbidden");
  return result;
}});
const api=await import(${JSON.stringify(entry)});
const snapshot={resources:[{key:"one",identity:{kind:"container",dockerId:null,name:"fixed",ownershipLabel:"fixed=owner"},request:"not_issued",configuration:{image:null,command:null,environmentNames:null,mounts:null,networks:null,internal:null}}]};
const cleanup={cleanupOrder:["one"],setupTimeoutMs:1000,unreceiptedAbsence:"observe",verifyLabelAbsence:true};
const book=api.applyResourceEvent(null,{event:"submission",key:"one",snapshot,cleanup});
assert.ok(book);
assert.equal(api.validateResourceBook(book),true);
assert.equal(api.validateResourceBookTransition(null,book),true);
assert.equal(book.checkpoints[0].submission,"intent_saved");
const changed=api.applyResourceCleanup(book,snapshot,[{key:"one",observation:"unknown"}],{recoveryId:"same",previousPayloadSha256:"b".repeat(64)});
assert.ok(changed);
assert.equal(changed.checkpoints[0].observation,"unknown");
assert.equal(changed.checkpoints[0].absenceEvidenceSha256,null);
console.log("PURE_RESOURCES");`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "PURE_RESOURCES");
});

/**
 * Historyの値生成と保持・出版規則を保存や全体復号なしで実行する。
 * @responsibility 型と値のOwner分離が実際のModule解決でも成立することを確認する。
 * @trace RCM-IT-005
 * @precondition 新品Nodeと非秘密の合成終了情報を使う。
 * @stimulus State候補・CRUD・Storage・履歴Decoderの解決を拒否する。
 * @observation 子のerror・signal・exit、六符号化の結果とLF、保持・出版結果。
 * @oracle 各純粋操作は動作し、元のunknownと確定時刻を変更しない。
 * @cleanup 子の正常終了を確認する。一時File・実資源は作らない。
 * @boundary 実Node Module解決とメモリ値だけ。保存成功の証明ではない。
 */
test("履歴の純粋操作はState復号と保存層を解決しない", () => {
  const entry = new URL("../../src/history/operations.ts", import.meta.url)
    .href;
  const code = `import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({resolve(s,c,next){
 const result=next(s,c);
 if(["/src/storage/","/src/state/validation.ts","/src/state/crud.ts","/src/attempt/validation.ts","/src/history/validation.ts"].some(target=>result.url.includes(target))) throw Error("history_dependency_forbidden");
 return result;
}});
const api=await import(${JSON.stringify(entry)});
const at="2026-11-14T00:00:00.000Z";
const operation={identityJson:JSON.stringify({operationId:"OP-123456",operationNonce:"nonce",recoveryCorrelationId:"operation"}),recoveryId:"recovery",identitySha256:"hash",primaryFailure:null,execution:{externalSend:"unknown"},outcome:null,host:{cleanup:"unknown"},lease:"held",dockerRestart:null};
const summary=JSON.parse(api.operationSummaryBytes(operation));
assert.equal(summary.execution.externalSend,"unknown");
assert.equal(summary.recoveryCorrelationId,"operation");
assert.deepEqual(JSON.parse(api.historyLineBytes(operation,at)).summary,summary);
const repair={...operation,checkpoint:{actions:{},engine:"unknown",stale:"unknown",hostSafety:"unknown",cleanup:"unknown",cleanupFailure:null},disposition:"not_applicable"};
const repairSummary=JSON.parse(api.repairSummaryBytes(repair));
assert.equal(repairSummary.technical.cleanup,"unknown");
assert.deepEqual(JSON.parse(api.repairHistoryLineBytes(repair,at)).summary,repairSummary);
const row={id:"ONE",occurredAt:at,outcome:"completed",primaryFailure:null,cleanup:"confirmed"};
assert.deepEqual(JSON.parse(api.taskHistoryLine(row)).summary.record,row);
const event={occurredAt:at,eventId:"EVENT"};
assert.deepEqual(JSON.parse(api.decisionHistoryLine(event)).summary.record,event);
for(const bytes of [api.operationSummaryBytes(operation),api.historyLineBytes(operation,at),api.repairSummaryBytes(repair),api.repairHistoryLineBytes(repair,at),api.taskHistoryLine(row),api.decisionHistoryLine(event)]) assert.equal(bytes.at(-1),10);
const line={line:api.taskHistoryLine(row).toString(),occurredAt:at,recoveryId:"task-history.ONE",lineSha256:"line",summarySha256:"summary"};
const references={protectedRecoveries:new Set([line.recoveryId]),requiredRows:[line]};
assert.equal(api.retainHistoryRows([line],references,at,30).toString(),line.line);
assert.equal(api.prepareHistoryPublication({canonical:Buffer.alloc(0),pending:null,rows:[],line,recoveryId:line.recoveryId,references,occurredAt:at,retentionDays:30}).historyBytes.toString(),line.line);
console.log("PURE_HISTORY");`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "PURE_HISTORY");
});
