/**
 * visual-preview:integration:preview-serverの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility localhost限定の読取り配信、Path拒否およびListener清掃を直接境界で検証する。
 * @trace ERB-IT-018
 * @level IT
 * @scope visual-preview、localhost、read-only、path-boundary、cleanup
 * @boundary ERB-IT-018=Direct Boundary: Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { request as httpRequest } from "node:http";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import { startVisualPreview } from "../../src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * Visual Preview用のRepository内Fixtureを作成する。
 *
 * @responsibility 通常File、DirectoryおよびLink反例を同じRepository境界へ決定論的に用意する。
 * @trace ERB-IT-018
 * @precondition Repository Rootが検証済みである。
 * @stimulus `.crdd/tests`配下へ一意な実行単位のFixtureを作成する。
 * @observation 作成したRepository相対Rootと清掃操作を返す。
 * @oracle 呼出し側が配信・拒否・清掃条件を判定できる。
 * @cleanup 返却したcleanupがFixture全体を削除する。
 * @boundary ERB-IT-018=Direct Boundary: Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer
 */
function createFixture(): Readonly<{
  relativeRoot: string;
  absoluteRoot: string;
  cleanup: () => void;
}> {
  const relativeRoot = `.crdd/tests/visual-preview-${randomUUID()}`;
  const absoluteRoot = path.join(repositoryRoot, ...relativeRoot.split("/"));
  fs.mkdirSync(path.join(absoluteRoot, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(absoluteRoot, "index.html"),
    "<!doctype html><title>Visual Preview Fixture</title>",
  );
  fs.writeFileSync(path.join(absoluteRoot, "assets", "style.css"), "body{}\n");
  const linkedDirectory = path.join(absoluteRoot, "linked");
  fs.symlinkSync(
    path.join(absoluteRoot, "assets"),
    linkedDirectory,
    "junction",
  );
  return Object.freeze({
    relativeRoot,
    absoluteRoot,
    cleanup: () => fs.rmSync(absoluteRoot, { recursive: true, force: true }),
  });
}

/**
 * Raw HTTP Pathをlocalhost Previewへ送信する。
 *
 * @responsibility URL正規化を介さず、Traversalを含むRequest TargetとResponseを直接観測する。
 * @trace ERB-IT-018
 * @precondition baseUrlが起動済みVisual Previewを指す。
 * @stimulus methodとrequestPathをNode HTTP Clientから送信する。
 * @observation Status、Headerおよび本文を取得する。
 * @oracle 呼出し側が許可・拒否と情報非開示を判定できる。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-018=Direct Boundary: Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer
 */
async function requestRaw(
  baseUrl: string,
  requestPath: string,
  method = "GET",
): Promise<
  Readonly<{
    status: number;
    headers: NodeJS.Dict<string | string[]>;
    body: string;
  }>
> {
  const url = new URL(baseUrl);
  return await new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        method,
        path: requestPath,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("end", () =>
          resolve(
            Object.freeze({
              status: incoming.statusCode ?? 0,
              headers: incoming.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          ),
        );
      },
    );
    outgoing.once("error", reject);
    outgoing.end();
  });
}

/**
 * 通常FileだけをGET／HEADで配信し共通Security Headerを返すことを検証する。
 *
 * @responsibility Visual Previewの正常な読取り境界と公開Response契約の合否判定を所有する。
 * @trace ERB-IT-018
 * @precondition Repository内にLinkでないHTMLとCSSのFixtureが存在する。
 * @stimulus GET、HEADおよびHealth Requestを送信する。
 * @observation Status、Content、Content-Type、Security HeaderおよびHealth結果を観測する。
 * @oracle GETは内容を返し、HEADは本文0、HealthはPathを含まないready結果を返す。
 * @cleanup Handleを閉じ、Fixtureを削除する。
 * @boundary ERB-IT-018=Direct Boundary: Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer
 */
test("通常FileだけをGET／HEADで配信し共通Security Headerを返す", async () => {
  const fixture = createFixture();
  const handle = await startVisualPreview({
    workingDirectory: repositoryRoot,
    rootRelativePath: fixture.relativeRoot,
  });
  try {
    assert.match(handle.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/u);
    const html = await requestRaw(handle.baseUrl, "/index.html");
    assert.equal(html.status, 200);
    assert.match(html.body, /Visual Preview Fixture/u);
    assert.equal(html.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(html.headers["cache-control"], "no-store");
    assert.equal(html.headers["x-content-type-options"], "nosniff");
    assert.equal(html.headers["access-control-allow-origin"], undefined);

    const head = await requestRaw(handle.baseUrl, "/assets/style.css", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body, "");
    assert.equal(head.headers["content-type"], "text/css; charset=utf-8");

    const health = await requestRaw(
      handle.baseUrl,
      "/.well-known/crdd-visual-preview-health",
    );
    assert.deepEqual(JSON.parse(health.body), {
      contract: "crdd/visual-preview/v1",
      status: "ready",
      host: "127.0.0.1",
      readOnly: true,
    });
    assert.doesNotMatch(health.body, /CRDD|test-tmp|visual-preview-/u);
  } finally {
    await handle.close();
    fixture.cleanup();
  }
});

/**
 * 越境・Link・Directory・書込みMethodを拒否して終了後Listenerを残さないことを検証する。
 *
 * @responsibility Visual Previewの拒否境界とListener資源清掃の合否判定を所有する。
 * @trace ERB-IT-018
 * @precondition Repository内FixtureとLink反例が存在しPreviewが起動済みである。
 * @stimulus Traversal、Encode済みSeparator、Link、DirectoryおよびPOSTを要求してHandleを閉じる。
 * @observation Status、Allow Header、公開本文および終了後Connection失敗を観測する。
 * @oracle 禁止Pathは404、POSTは405、close後は新しいConnectionを受理しない。
 * @cleanup Handleを冪等に閉じ、Fixtureを削除する。
 * @boundary ERB-IT-018=Direct Boundary: Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer
 */
test("越境・Link・Directory・書込みMethodを拒否して終了後Listenerを残さない", async () => {
  const fixture = createFixture();
  const handle = await startVisualPreview({
    workingDirectory: repositoryRoot,
    rootRelativePath: fixture.relativeRoot,
  });
  const baseUrl = handle.baseUrl;
  try {
    for (const forbidden of [
      "/../package.json",
      "/..%2fpackage.json",
      "/%2e%2e/package.json",
      "/linked/style.css",
      "/assets/",
    ]) {
      const result = await requestRaw(baseUrl, forbidden);
      assert.equal(result.status, 404, forbidden);
      assert.doesNotMatch(result.body, /C:\\|CRDD|test-tmp/u);
    }
    const post = await requestRaw(baseUrl, "/index.html", "POST");
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
  } finally {
    await handle.close();
    await handle.close();
    fixture.cleanup();
  }
  await assert.rejects(requestRaw(baseUrl, "/index.html"));
});

/**
 * Repository外・Absolute・Link RootをListener開始前に拒否することを検証する。
 *
 * @responsibility 公開Rootの事前検証失敗をNetwork Effect 0で閉じる合否判定を所有する。
 * @trace ERB-IT-018
 * @precondition Repository内FixtureとそのJunctionが存在する。
 * @stimulus 越境相対Path、Absolute PathおよびLink Rootで開始を要求する。
 * @observation startVisualPreviewの拒否理由を観測する。
 * @oracle すべてListener Handleを返さずErrorになる。
 * @cleanup Fixtureを削除する。
 * @boundary ERB-IT-018=Direct Boundary: Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer
 */
test("Repository外・Absolute・Link RootをListener開始前に拒否する", async () => {
  const fixture = createFixture();
  try {
    await assert.rejects(
      startVisualPreview({
        workingDirectory: repositoryRoot,
        rootRelativePath: "../outside",
      }),
      /visual_preview_root_outside_repository/u,
    );
    await assert.rejects(
      startVisualPreview({
        workingDirectory: repositoryRoot,
        rootRelativePath: fixture.absoluteRoot,
      }),
      /visual_preview_root_invalid/u,
    );
    await assert.rejects(
      startVisualPreview({
        workingDirectory: repositoryRoot,
        rootRelativePath: `${fixture.relativeRoot}/linked`,
      }),
      /visual_preview_root_invalid|visual_preview_root_link_forbidden/u,
    );
  } finally {
    fixture.cleanup();
  }
});
