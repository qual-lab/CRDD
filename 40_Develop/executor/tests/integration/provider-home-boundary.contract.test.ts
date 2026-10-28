/**
 * 単独試験のHome事前確認を実Homeへ触れずに反証する。
 * @responsibility 元Lock解放・未知結果保持・非秘密checkpointと既存排他名互換を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @level IT
 * @scope Platform観測・Lockは代役。新品Repository-local試験Fileだけを実I/Oする。
 * @boundary Provider Homeのmetadata／OS排他と試験記録。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import vm from "node:vm";
import test from "node:test";

/**
 * 元Lockは観測又は保存の例外でも一回だけ解放し、不明を保持する。
 * @responsibility 通常試験から実Home／Native／共有排他を呼ばないまま接続を検査する。
 * @trace ERB-IT-002
 * @precondition 新品子Processと合成Home観測・Lockを使う。
 * @stimulus 正常・差替え・観測／保存／取得／解放失敗を各一回与える。
 * @observation 元Lockの解放回数、公開結果、Root有無とcheckpoint本文。
 * @oracle 終了未知はRootを保持し、正常又は終了確認済みだけ通常清掃する。
 * @cleanup 全資源を代役にした保持負例のRootだけ内容確認後に試験自身が回収する。
 * @boundary 実認証・Native・Named Pipe・Docker・AIは未実施。
 */
test("Home事前確認は元Lockの終了と未知の保持を区別する", () => {
  const scriptUrl = new URL(
    "../../scripts/verify-provider-home.ts",
    import.meta.url,
  ).href;
  const platformUrl = new URL(
    "../../../platform-access/src/index.ts",
    import.meta.url,
  ).href;
  const domainUrl = new URL(
    "../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';import path from 'node:path';
    import {randomUUID,createHash} from 'node:crypto';
    import {mock} from 'node:test';import {registerHooks} from 'node:module';
    registerHooks({resolve(s,c,n){const r=n(s,c);if(r.url.includes('/coordinator/'))throw Error('coordinator_forbidden');return r;}});
    const platform=await import(${JSON.stringify(platformUrl)});
    const domain=await import(${JSON.stringify(domainUrl)});
    process.env.LOCALAPPDATA=${JSON.stringify("C:\\synthetic-home-not-read")};
    let mode='normal',observations=0,acquisitions=0,releases=0,held=false,pipe=null;
    mock.module(${JSON.stringify(platformUrl)},{namedExports:{...platform,
      observeWindowsProviderHome:(provider,home)=>{
        observations++;
        assert.equal(home,path.win32.join(process.env.LOCALAPPDATA,'Qual-Lab','CRDD','ProviderHomes',provider));
        if(observations===2)assert.equal(held,true);
        if(mode==='first_throw'||(observations===2&&mode==='second_throw'))throw Error('synthetic_observation_throw');
        if(mode==='first_native_unknown'||(observations===2&&mode==='second_native_unknown'))
          return {status:'blocked',processEffectIssued:true,helperExitConfirmed:false,filesystemEffectIssued:false};
        if(mode==='first_blocked'||(observations===2&&mode==='second_blocked'))
          return {status:'blocked',processEffectIssued:false,helperExitConfirmed:false,filesystemEffectIssued:false};
        return {status:'candidate',provider,processEffectIssued:mode!=='candidate_no_process',helperExitConfirmed:mode!=='helper_unknown',
          artifactVerifiedBeforeAndAfter:mode!=='artifact_missing',filesystemEffectIssued:mode==='filesystem_effect',
          providerHomeIdentityHash:'a'.repeat(64),providerHomeProtectionHash:'b'.repeat(64),
          localUserBindingHash:'c'.repeat(64),stableLogicalHomeBindingHash:
            observations===2&&mode==='changed'?'e'.repeat(64):'d'.repeat(64)};
      },
      acquireNamedPipeKernelLockOutcome:async name=>{
        acquisitions++;pipe=name;
        if(mode==='acquire_throw')throw Error('synthetic_acquire_throw');
        if(mode==='acquire_unknown')return {status:'cleanup_unknown',lock:null};
        if(mode==='unavailable')return {status:'unavailable',lock:null};
        held=true;
        return {status:'acquired',lock:{release:async()=>{
          releases++;held=false;
          if(mode==='release_throw')throw Error('synthetic_release_throw');
          return mode==='release_unknown'?'cleanup_unknown':'released';
        }}};
      }
    }});
    mock.module(${JSON.stringify(domainUrl)},{namedExports:{...domain,
      writeCommittedJson:(directory,name,key,value)=>{
        if(mode==='save_throw'&&name==='observed.json')throw Error('synthetic_save_throw');
        return domain.writeCommittedJson(directory,name,key,value);
      }
    }});
    const api=await import(${JSON.stringify(scriptUrl)});
    assert.equal(observations,0);assert.equal(acquisitions,0);
    for(mode of ['normal','changed','first_blocked','second_blocked','first_throw','second_throw',
      'save_throw','unavailable','acquire_unknown','acquire_throw','release_unknown','release_throw',
      'helper_unknown','artifact_missing','filesystem_effect','first_native_unknown','second_native_unknown','candidate_no_process']){
      observations=0;acquisitions=0;releases=0;held=false;pipe=null;
      const runId='fixture-'+randomUUID();
      const provider=mode==='normal'?'codex':'claude';
      const result=await api.verifyProviderHomeBoundary(provider,runId);
      assert.equal(result.provider,provider);assert.equal(result.runId,runId);
      assert.equal(result.authenticationChecked,false);assert.equal(result.aiIssued,false);assert.equal(result.dockerIssued,false);
      assert.equal(result.status,mode==='normal'?'observed':'blocked');
      assert.equal(result.observationMatched,['normal','release_unknown','release_throw','save_throw'].includes(mode));
      const preRejected=['first_blocked','first_throw','helper_unknown','artifact_missing','filesystem_effect','first_native_unknown','candidate_no_process'];
      const acquired=![...preRejected,'unavailable','acquire_unknown','acquire_throw'].includes(mode);
      assert.equal(releases,acquired?1:0,mode);
      assert.equal(acquisitions,preRejected.includes(mode)?0:1,mode);
      if(pipe)assert.equal(pipe,${JSON.stringify("\\\\.\\pipe\\CRDD.Coordinator.ProviderHome.")}+createHash('sha256').update('crdd-logical-provider-home-kernel-lock-v1\\0').update('d'.repeat(64)).digest('hex').slice(0,32));
      const unknown=['first_throw','second_throw','acquire_unknown','acquire_throw','release_unknown','release_throw','helper_unknown','filesystem_effect','first_native_unknown','second_native_unknown'].includes(mode);
      assert.equal(result.resourceCleanupConfirmed,!unknown,mode);
      const retained=unknown||mode==='save_throw';
      assert.equal(result.fixtureCleanupConfirmed,!retained,mode);
      if(retained){
        const root=result.fixtureRoot;
        assert.ok(root);assert.equal(fs.lstatSync(root).isSymbolicLink(),false);
        assert.equal(path.basename(root),'executor-home-'+provider+'-'+runId);
        for(const name of fs.readdirSync(root)){
          assert.match(name,/^(started|observed)\\.json(?:\\.crdd-commit\\.json)?$/);
          const file=path.join(root,name),stat=fs.lstatSync(file);
          assert.equal(stat.isFile(),true);assert.equal(stat.isSymbolicLink(),false);assert.equal(stat.nlink,1);
          if(!name.endsWith('.crdd-commit.json')){
            const data=JSON.parse(fs.readFileSync(file,'utf8'));
            assert.deepEqual(Object.keys(data).sort(),['contract','observationMatched','phase','provider','reviewAfter','runId']);
            assert.equal(data.runId,runId);assert.equal(data.provider,provider);
            assert.equal(data.contract,'crdd/executor/home-boundary-test/v1');
          }
        }
        // No real helper or OS lock was issued: these are this case's synthetic Files only.
        fs.rmSync(root,{recursive:true});assert.equal(fs.existsSync(root),false);
      }else assert.equal(result.fixtureRoot,null);
    }
    const count=observations;
    await assert.rejects(api.verifyProviderHomeBoundary('other','fixture-invalid'));
    await assert.rejects(api.verifyProviderHomeBoundary('codex','../invalid'));
    assert.equal(observations,count);
  `,
    ],
    { encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
});

/**
 * 試験用の排他名を既存製品の純粋導出と同じOracleで照合する。
 * @responsibility 同じ共有資源を別名のLockで代用しない。
 * @trace ERB-IT-004
 * @precondition Sourceだけを読み、Coordinator Moduleはロードしない。
 * @stimulus 代表Hashとdomain省略・prefix・slice変更を照合する。
 * @observation 固定のPipe名。
 * @oracle 正常式だけが製品式と全値一致する。
 * @cleanup N/A: 純粋VMだけ。
 * @boundary 名前の相互運用だけ。実Named Pipe取得は未実施。
 */
test("試験Home排他名は既存の導出と一致し式の変更を拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../scripts/verify-provider-home.ts", import.meta.url),
    "utf8",
  );
  const product = fs.readFileSync(
    new URL(
      "../../../coordinator/src/execution/kernel-lock.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const productStart = product.indexOf(
    "export function acquireRuntimeOwnedLogicalProviderHomeKernelLock(",
  );
  const productFunction = product
    .slice(productStart, product.indexOf("\n}", productStart) + 2)
    .replace("export function", "function")
    .replace(
      "stableLogicalHomeBindingHash: unknown",
      "stableLogicalHomeBindingHash",
    );
  const start = source.indexOf("function homePipeName(");
  const actual = source
    .slice(start, source.indexOf("\n}", start) + 2)
    .replace("hash: string", "hash");
  for (const hash of [
    "a".repeat(64),
    "b".repeat(64),
    "0123456789abcdef".repeat(4),
  ]) {
    const expected = vm.runInNewContext(
      `${productFunction}; acquireRuntimeOwnedLogicalProviderHomeKernelLock(input)`,
      {
        createHash,
        input: hash,
        process: { platform: "win32" },
        acquireNamedPipeKernelLock: (name: string) => name,
      },
    );
    const evaluate = (text: string) =>
      vm.runInNewContext(`${text}; homePipeName(input)`, {
        createHash,
        input: hash,
      });
    assert.equal(evaluate(actual), expected);
    for (const changed of [
      actual.replace(
        '.update("crdd-logical-provider-home-kernel-lock-v1\\0")',
        "",
      ),
      actual.replace(
        "CRDD.Coordinator.ProviderHome",
        "CRDD.Other.ProviderHome",
      ),
      actual.replace(".slice(0, 32)", ".slice(0, 16)"),
    ]) {
      assert.notEqual(changed, actual);
      assert.notEqual(evaluate(changed), expected);
    }
  }
});
