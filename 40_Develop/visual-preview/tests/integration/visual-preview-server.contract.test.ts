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
import { once } from "node:events";
import { createConnection } from "node:net";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import { observeLocalListener, startVisualPreview } from "../../src/index.ts";

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
 * @observation 作成したRepository相対Root、内容の再照合および清掃操作を返す。
 * @oracle 呼出し側が配信・拒否・清掃条件を判定できる。
 * @cleanup 返却したcleanupが検証済みRepository内のFixture全体を削除し、ENOENTを直接確認する。
 * @boundary ERB-IT-018=Direct Boundary: visual-preview Test Source→対象契約
 */
function createFixture(): Readonly<{
  relativeRoot: string;
  absoluteRoot: string;
  assertUnchanged: () => void;
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
    /**
     * 固定Fixtureの内容と構造が変わっていないことを確認する。
     *
     * @responsibility HTTP操作前後のFile内容、Directory集合とJunction解決先を照合する。
     * @trace ERB-IT-018
     * @precondition 当該Fixtureが作成済みで清掃前である。
     * @stimulus File、DirectoryとLinkを再読取りする。
     * @observation 固定内容、entry集合、Link種別と解決先。
     * @oracle 作成時の期待値と全項目が一致する。
     * @cleanup N/A: 読取りだけであり、Fixture削除はcleanupが所有する。
     * @boundary Repository内FixtureのFilesystem直接観測。
     */
    assertUnchanged: () => {
      assert.deepEqual(fs.readdirSync(absoluteRoot).sort(), [
        "assets",
        "index.html",
        "linked",
      ]);
      assert.deepEqual(fs.readdirSync(path.join(absoluteRoot, "assets")), [
        "style.css",
      ]);
      assert.equal(
        fs.readFileSync(path.join(absoluteRoot, "index.html"), "utf8"),
        "<!doctype html><title>Visual Preview Fixture</title>",
      );
      assert.equal(
        fs.readFileSync(path.join(absoluteRoot, "assets", "style.css"), "utf8"),
        "body{}\n",
      );
      assert.equal(fs.lstatSync(linkedDirectory).isSymbolicLink(), true);
      assert.equal(
        fs.realpathSync.native(linkedDirectory),
        fs.realpathSync.native(path.join(absoluteRoot, "assets")),
      );
    },
    /**
     * 所有Fixtureを削除し不存在を直接確認する。
     *
     * @responsibility 当該Fixtureの包含・非Link確認、明示削除と終了後観測を所有する。
     * @trace ERB-IT-018
     * @precondition 当該Fixtureが存在し、試験のListener終了後である。
     * @stimulus 包含とRootのLink種別を確認し、Fixtureを削除する。
     * @observation 削除結果と削除後lstatのError code。
     * @oracle 包含確認が成功し、削除後のlstatがexact ENOENTになる。
     * @cleanup 当該Fixture全体の不存在を確認する。
     * @boundary Repository内の試験所有Fixture清掃。
     */
    cleanup: () => {
      const relative = path.relative(repositoryRoot, absoluteRoot);
      assert.equal(relative.startsWith(`..${path.sep}`), false);
      assert.equal(path.isAbsolute(relative), false);
      assert.equal(relative.split(path.sep)[0], ".crdd");
      assert.equal(fs.lstatSync(absoluteRoot).isSymbolicLink(), false);
      fs.rmSync(absoluteRoot, { recursive: true, force: false });
      assert.throws(
        () => fs.lstatSync(absoluteRoot),
        (error: unknown) =>
          error instanceof Error && "code" in error && error.code === "ENOENT",
      );
    },
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
 * @boundary ERB-IT-018=Direct Boundary: visual-preview Test Source→対象契約
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
 * @boundary ERB-IT-018=Direct Boundary: visual-preview Test Source→対象契約
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
    fixture.assertUnchanged();
    fixture.cleanup();
  }
});

/**
 * 越境・Link・Directory・書込みMethodを拒否して終了後Listenerを残さないことを検証する。
 *
 * @responsibility Visual Previewの拒否境界とListener資源清掃の合否判定を所有する。
 * @trace ERB-IT-018
 * @precondition Repository内FixtureとLink反例が存在しPreviewが起動済みである。
 * @stimulus Traversal、Encode済みSeparator、Link、DirectoryおよびPOSTを要求し、未完了HTTP Connectionを保持してHandleを閉じる。
 * @observation Status、Allow Header、公開本文、保持Connectionのcloseおよび終了後の直接接続拒否を観測する。
 * @oracle 禁止Pathは404、POSTは405、内容は不変、保持Connectionは終了し、close後Listenerはabsentである。timeoutや未知Errorは合格にしない。
 * @cleanup Handleを冪等に閉じ、Fixtureを削除する。
 * @boundary ERB-IT-018=Direct Boundary: visual-preview Test Source→対象契約
 */
test("越境・Link・Directory・書込みMethodを拒否して終了後Listenerを残さない", async () => {
  const fixture = createFixture();
  const handle = await startVisualPreview({
    workingDirectory: repositoryRoot,
    rootRelativePath: fixture.relativeRoot,
  });
  const baseUrl = handle.baseUrl;
  const url = new URL(baseUrl);
  const heldConnection = createConnection({
    host: url.hostname,
    port: Number(url.port),
  });
  try {
    await once(heldConnection, "connect", {
      signal: AbortSignal.timeout(5_000),
    });
    heldConnection.write("GET /index.html HTTP/1.1\r\nHost: localhost\r\n");
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
    fixture.assertUnchanged();
    assert.equal(heldConnection.destroyed, false);
    const connectionClosed = once(heldConnection, "close", {
      signal: AbortSignal.timeout(5_000),
    });
    await handle.close();
    await connectionClosed;
    assert.equal(heldConnection.destroyed, true);
    assert.equal(await observeLocalListener(Number(url.port)), "absent");
  } finally {
    await handle.close();
    await handle.close();
    heldConnection.destroy();
    fixture.assertUnchanged();
    fixture.cleanup();
  }
  await assert.rejects(
    requestRaw(baseUrl, "/index.html"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "ECONNREFUSED",
  );
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
 * @boundary ERB-IT-018=Direct Boundary: visual-preview Test Source→対象契約
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
    fixture.assertUnchanged();
    fixture.cleanup();
  }
});
