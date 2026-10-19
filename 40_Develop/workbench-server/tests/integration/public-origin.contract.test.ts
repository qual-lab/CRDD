/**
 * Workbenchの共有公開OriginとTLS終端案内を実HTTPで検証する。
 * @packageDocumentation
 * @responsibility 配置拒否をAM観測より前に処置し、単体の暗黙公開を防ぐ。
 * @trace EST-IT-010
 * @trace RFD-IT-013
 * @level IT
 * @scope loopback Listenerと自己生成AM Rootだけ。実TLS終端は別検証。
 * @boundary 配置HeaderとWorkbench Server。MCP・Providerは使用しない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import path from "node:path";
import test from "node:test";
import { createCredentialMaterial } from "../../../access-management/src/credential/token.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  readWorkbenchServerConfiguration,
  startWorkbench,
} from "../../src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * Workbench専用設定を自己生成Repositoryだけから読む。
 * @responsibility 設定不存在、閉じた値、重複・余剰・容量・不正UTF8を区別する。
 * @trace EST-IT-010
 * @precondition 専用試験Directory内に新しいGit Rootを作る。実Host設定は使用しない。
 * @stimulus 不存在、空設定、正規Origin、不正JSON、重複fieldと禁止Origin。最終File metadata取得後にdescriptorを閉じ、実config Directoryを置換する。
 * @observation 非秘密構成または固定拒否、試験Root終了後不存在。
 * @oracle 不正設定からlocalhost fallbackや補完値を生成しない。
 * @cleanup 自己生成Git Rootと設定を検証済み親Directory内で削除する。
 * @boundary 設定Readerのみ。置換は終了境界への故障注入であり、実OS raceの再現ではない。CLI/TLS配置全体は別検証。
 */
test("Workbench設定Readerは当該Repositoryの閉設定だけを受理する", async (t) => {
  const parent = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(parent, "workbench-config-"));
  assert.equal(path.dirname(fixture), parent);
  try {
    assert.equal(
      spawnSync("git", ["init", "--quiet", fixture], { windowsHide: true })
        .status,
      0,
    );
    assert.deepEqual(await readWorkbenchServerConfiguration(fixture), {});
    const config = path.join(fixture, ".crdd", "config");
    fs.mkdirSync(config, { recursive: true });
    const file = path.join(config, "workbench-server.json");
    fs.writeFileSync(file, "{}");
    assert.deepEqual(await readWorkbenchServerConfiguration(fixture), {});
    fs.writeFileSync(file, '{"publicOrigin":"https://workbench.example:443/"}');
    assert.deepEqual(await readWorkbenchServerConfiguration(fixture), {
      publicOrigin: "https://workbench.example",
    });
    const probe = await open(file, "r");
    const prototype = Object.getPrototypeOf(probe);
    await probe.close();
    const originalStat = prototype.stat;
    const displaced = path.join(fixture, "displaced-config");
    let replacements = 0;
    let statistics = 0;
    const statMock = t.mock.method(
      prototype,
      "stat",
      async function (this: FileHandle, ...args: unknown[]) {
        const result = await Reflect.apply(originalStat, this, args);
        if (++statistics === 2) {
          // Windowsのopen中rename制約を避け、最終metadata取得後の置換を注入する。
          await this.close();
          fs.renameSync(config, displaced);
          fs.mkdirSync(config);
          fs.writeFileSync(path.join(config, "workbench-server.json"), "{}");
          replacements++;
        }
        return result;
      },
    );
    try {
      await assert.rejects(
        readWorkbenchServerConfiguration(fixture),
        /workbench_server_configuration_invalid/u,
      );
      assert.equal(replacements, 1);
      assert.equal(statistics, 2);
    } finally {
      statMock.mock.restore();
      if (fs.existsSync(displaced)) {
        fs.rmSync(config, { recursive: true });
        fs.renameSync(displaced, config);
      }
    }
    assert.deepEqual(await readWorkbenchServerConfiguration(fixture), {
      publicOrigin: "https://workbench.example",
    });
    for (const invalid of [
      "null",
      "[]",
      '{"publicOrigin":null}',
      '{"publicOrigin":"https://workbench.example","extra":true}',
      '{"publicOrigin":"https://workbench.example","publicOrigin":"https://other.example"}',
      '{"publicOrigin":"https://workbench.example/path/.."}',
      '{"publicOrigin":"https://workbench.example?"}',
      " ".repeat(16385),
    ]) {
      fs.writeFileSync(file, invalid);
      await assert.rejects(
        readWorkbenchServerConfiguration(fixture),
        /workbench_server_configuration_invalid/u,
      );
    }
    fs.writeFileSync(file, Buffer.from([0xff]));
    await assert.rejects(
      readWorkbenchServerConfiguration(fixture),
      /workbench_server_configuration_invalid/u,
    );
    fs.rmSync(config, { recursive: true, force: true });
    const linked = path.join(fixture, "linked-config");
    fs.mkdirSync(linked);
    fs.writeFileSync(
      path.join(linked, "workbench-server.json"),
      '{"publicOrigin":"https://linked.example"}',
    );
    fs.symlinkSync(
      linked,
      config,
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      readWorkbenchServerConfiguration(fixture),
      /workbench_server_configuration_invalid/u,
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  }
});

/**
 * 不正公開Originと単体の暗黙共有化を起動前に拒否する。
 * @responsibility 正規化で禁止入力を消さず、共有には現在認証Ownerを要求する。
 * @trace EST-IT-010
 * @precondition 実Hostを使用せず、共有AM Rootを構成しない。
 * @stimulus HTTP、userinfo、path、空query/hash、空白、backslash、共有AMなし。
 * @observation 固定構成拒否。
 * @oracle Listenerや単体情報公開を開始しない。
 * @cleanup N/A: 全CaseがListener開始前に終了し、File生成なし。
 * @boundary 構成入力のみ。共有全体の完成証明ではない。
 */
test("共有Workbenchは不正Originと認証Ownerなしを拒否する", async () => {
  for (const publicOrigin of [
    "",
    "http://workbench.example",
    "https://@workbench.example",
    "https://workbench.example/path/..",
    "https://workbench.example?",
    "https://workbench.example#",
    " https://workbench.example ",
    "https://workbench.example\\path",
  ]) {
    await assert.rejects(
      startWorkbench({ workingDirectory: repositoryRoot, publicOrigin }),
      /workbench_public_origin_invalid/u,
    );
  }
  await assert.rejects(
    startWorkbench({
      workingDirectory: repositoryRoot,
      publicOrigin: "https://workbench.example",
    }),
    /workbench_shared_access_required/u,
  );
});

/**
 * 同Host TLS終端案内の不一致をAM排他取得より前に拒否する。
 * @responsibility 生Header重複・欠測・別Originを受理せず、正常GETとPOST Origin必須を分ける。
 * @trace EST-IT-010
 * @trace RFD-IT-013
 * @precondition 空の自己生成AM Rootとloopback Listenerだけを所有する。
 * @stimulus 正常／異常配置Header、OriginなしGET／POST、未知Bearer。
 * @observation HTTP状態、AM Root内open回数、公開URLと内部URL、終了後接続拒否。
 * @oracle 配置拒否時はAM Root open0。正常配置でも無資格は内容非開示。
 * @cleanup 差替えを復元、所有Server close・接続拒否後に自己生成Rootだけを削除する。
 * @boundary Header契約のみ。実TLS通信やHost内攻撃防御の証明ではない。
 */
test("共有WorkbenchはTLS配置拒否を認証前に行う", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(testRoot, { recursive: true });
  const fixture = fs.mkdtempSync(
    path.join(testRoot, "workbench-public-origin-"),
  );
  assert.equal(path.dirname(fixture), testRoot);
  const root = createFilesystemStoreRoot(fixture);
  assert.ok(root);
  let handle: Awaited<ReturnType<typeof startWorkbench>> | undefined;
  const originalOpen = fs.openSync;
  let opens = 0;
  try {
    handle = await startWorkbench({
      workingDirectory: repositoryRoot,
      localAccessRoot: root,
      publicOrigin: "https://workbench.example",
    });
    assert.equal(handle.publicUrl, "https://workbench.example");
    assert.match(handle.baseUrl, /^http:\/\/127\.0\.0\.1:/u);
    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (
        typeof args[0] === "string" &&
        args[0].startsWith(`${fixture}${path.sep}`)
      )
        opens++;
      return originalOpen(...args);
    }) as typeof fs.openSync;
    const url = `${handle.baseUrl}/api/workbench-view`;
    const valid: Record<string, string | string[]> = {
      host: "workbench.example",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "workbench.example",
    };
    /**
     * 自己生成Serverへ一つの実HTTP要求を有限時間で送る。
     * @responsibility 重複Headerを保持し、HTTP状態と非秘密本文だけを取得する。
     * @trace EST-IT-010
     * @precondition 自己生成loopback URLだけを使用する。
     * @stimulus GETまたは空BodyのPOSTと固定Header。
     * @observation HTTP状態と本文。
     * @oracle 送信・受信故障を成功へ補完しない。
     * @cleanup Timeout／終了でTimerを解除し、Responseを最後まで読む。
     * @boundary 実HTTPのみ。外部Host送信なし。
     */
    const send = (headers: Record<string, string | string[]>, method = "GET") =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const request = httpRequest(url, { method, headers }, (response) => {
          let body = "";
          response.on("data", (chunk) => {
            body += String(chunk);
            if (body.length > 1024 * 1024)
              request.destroy(new Error("fixture_response_limit"));
          });
          response.on("error", reject);
          response.on("end", () =>
            resolve({ status: response.statusCode ?? 0, body }),
          );
        });
        const timer = setTimeout(
          () => request.destroy(new Error("fixture_http_timeout")),
          5000,
        );
        request.once("close", () => clearTimeout(timer));
        request.once("error", reject);
        request.end();
      });
    for (const change of [
      { host: "localhost" },
      { "x-forwarded-proto": "http" },
      { "x-forwarded-proto": ["https", "https"] },
      { "x-forwarded-host": ["workbench.example", "workbench.example"] },
      { "x-forwarded-host": "foreign.example" },
      { origin: "https://foreign.example" },
      { origin: ["https://workbench.example", "https://workbench.example"] },
    ]) {
      assert.equal((await send({ ...valid, ...change })).status, 421);
      assert.equal(opens, 0);
    }
    for (const missing of ["host", "x-forwarded-proto", "x-forwarded-host"]) {
      const headers = { ...valid };
      delete headers[missing];
      assert.equal((await send(headers)).status, 421);
      assert.equal(opens, 0);
    }
    assert.equal((await send(valid, "POST")).status, 421);
    assert.equal(opens, 0);
    const normal = await send(valid);
    assert.equal(normal.status, 200);
    assert.equal(JSON.parse(normal.body).authenticated, false);
    assert.equal(JSON.parse(normal.body).portfolio, null);
    const unknown = await send({
      ...valid,
      authorization: `Bearer ${createCredentialMaterial().token}`,
    });
    assert.equal(unknown.status, 200);
    assert.equal(JSON.parse(unknown.body).authenticated, false);
    assert.ok(opens > 0, "authentication_boundary_observation_active");
  } finally {
    fs.openSync = originalOpen;
    if (handle) {
      await handle.close();
      await assert.rejects(
        fetch(handle.baseUrl, { signal: AbortSignal.timeout(2000) }),
      );
    }
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  }
});
