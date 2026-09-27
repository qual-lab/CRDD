/**
 * workbench:integration:production-shellの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Workbench Production Shellのloopback配信、公式ロゴ、固定RouteおよびListener清掃を直接境界で検証する。
 * @trace ERB-IT-021
 * @trace PPR-IT-002
 * @trace RFD-IT-005
 * @level IT
 * @scope workbench、localhost、official-logo、route-allowlist、cleanup
 * @boundary ERB-IT-021=Direct Boundary: Repository→Workbench Server→Browser相当Consumer
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { request as httpRequest } from "node:http";
import path from "node:path";
import test from "node:test";

import {
  createMemoryConnectionCredentialRegistry,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  readWorkbenchProjectSurface,
  startWorkbench,
} from "../../src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * WorkbenchへRaw HTTP Requestを送信する。
 *
 * @responsibility 固定Routeと拒否RouteのResponseをURL正規化前のRequest Targetで観測する。
 * @trace ERB-IT-021
 * @precondition baseUrlが起動済みWorkbenchを指す。
 * @stimulus methodとrequestPathをNode HTTP Clientから送信する。
 * @observation Status、Headerおよび本文bytesを取得する。
 * @oracle 呼出し側が配信・拒否・Security Headerを判定できる。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: Repository→Workbench Server→Browser相当Consumer
 */
async function requestRaw(
  baseUrl: string,
  requestPath: string,
  method = "GET",
  body?: string,
): Promise<
  Readonly<{
    status: number;
    headers: NodeJS.Dict<string | string[]>;
    body: Buffer;
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
        headers:
          body === undefined
            ? undefined
            : {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
              },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("end", () =>
          resolve(
            Object.freeze({
              status: incoming.statusCode ?? 0,
              headers: incoming.headers,
              body: Buffer.concat(chunks),
            }),
          ),
        );
      },
    );
    outgoing.once("error", reject);
    outgoing.end(body);
  });
}

/**
 * Workbench試験Fixture内でGit Commandを実行する。
 *
 * @responsibility Production HTTP境界試験に必要なRepository初期状態だけを構築する。
 * @trace RFD-IT-014
 * @input cwdと固定Git引数を受け取る。
 * @returns UTF-8 stdoutを返す。
 * @precondition cwdはRepository-local試験領域内である。
 * @postcondition Command完了後に子Processを残さない。
 * @effect 試験Fixture Repositoryだけを変更する。
 * @failure 非0終了を試験失敗として送出する。
 * @invariant 実CRDD RepositoryへGit Effectを発行しない。
 * @boundary Test Harnessと実Git CLIの境界。
 * @security shellとCredentialを使わない。
 * @concurrency 同一Fixture内で直列実行する。
 */
function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd,
    windowsHide: true,
    encoding: "utf8",
  }).trim();
}

/**
 * Direction A Shellと承認済み公式ロゴを固定Routeで配信することを検証する。
 *
 * @responsibility Production入口のBrand、主要Navigation、未接続状態およびSecurity Headerの合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 公式Logo AssetがRepository内に存在する。
 * @stimulus Shell、CSS、Logo、Health、HEADおよび不許可Methodを要求する。
 * @observation Response内容、Content-Type、Security HeaderおよびHealth結果を観測する。
 * @oracle 公式Logo RouteとDirection A Shellだけをloopbackから取得でき、書込みMethodを拒否する。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: Repository→Workbench Server→Browser相当Consumer
 */
test("Direction A Shellと公式ロゴをloopback限定で配信する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    assert.match(handle.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/u);
    const shell = await requestRaw(handle.baseUrl, "/");
    assert.equal(shell.status, 200);
    assert.match(shell.body.toString("utf8"), /CROS Workbench/u);
    assert.match(
      shell.body.toString("utf8"),
      /\/assets\/crdd-brand-icon\.jpg/u,
    );
    assert.match(shell.body.toString("utf8"), /Project Workspace/u);
    assert.match(shell.body.toString("utf8"), /qual-lab\.crdd-standard/u);
    assert.match(shell.body.toString("utf8"), /今どうなっているか/u);
    assert.match(
      shell.body.toString("utf8"),
      /何が危ない、または止まっているか/u,
    );
    assert.match(shell.body.toString("utf8"), /Not configured/u);
    assert.match(shell.body.toString("utf8"), /Staged/u);
    assert.match(shell.body.toString("utf8"), /Working/u);
    assert.match(shell.body.toString("utf8"), /Untracked/u);
    assert.equal(shell.headers["content-type"], "text/html; charset=utf-8");
    assert.match(
      String(shell.headers["content-security-policy"]),
      /default-src 'self'/u,
    );

    const css = await requestRaw(handle.baseUrl, "/workbench.css");
    assert.equal(css.status, 200);
    assert.match(css.body.toString("utf8"), /Noto Sans CJK JP/u);

    const logo = await requestRaw(
      handle.baseUrl,
      "/assets/crdd-brand-icon.jpg",
    );
    assert.equal(logo.status, 200);
    assert.equal(logo.headers["content-type"], "image/jpeg");
    assert.ok(logo.body.byteLength > 0);

    const health = await requestRaw(
      handle.baseUrl,
      "/.well-known/crdd-workbench-health",
    );
    assert.deepEqual(JSON.parse(health.body.toString("utf8")), {
      contract: "crdd/workbench/v1",
      status: "ready",
      host: "127.0.0.1",
      mode: "repository",
      readOnly: false,
    });

    const head = await requestRaw(handle.baseUrl, "/index.html", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body.byteLength, 0);

    const post = await requestRaw(handle.baseUrl, "/", "POST");
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
  } finally {
    await handle.close();
  }
});

/**
 * Allowlist外Routeを拒否し終了後Listenerを残さないことを検証する。
 *
 * @responsibility Workbenchの公開Path境界とListener cleanupの合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition Workbenchが一時Portで起動済みである。
 * @stimulus 任意Repository PathとTraversalを要求し、Handleを二回閉じる。
 * @observation 拒否Statusとclose後Connection失敗を観測する。
 * @oracle Allowlist外は404で内部Pathを返さず、close後はConnectionを受理しない。
 * @cleanup 冪等closeにより所有ListenerとConnectionを終了する。
 * @boundary ERB-IT-021=Direct Boundary: Repository→Workbench Server→Browser相当Consumer
 */
test("Allowlist外Routeを拒否し終了後Listenerを残さない", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  const baseUrl = handle.baseUrl;
  for (const forbidden of [
    "/package.json",
    "/../package.json",
    "/04_UI/assets/brand/crdd-brand-icon-512x512.jpg",
  ]) {
    const result = await requestRaw(baseUrl, forbidden);
    assert.equal(result.status, 404, forbidden);
    assert.doesNotMatch(
      result.body.toString("utf8"),
      /C:\\|CRDD|package\.json/u,
    );
  }
  await handle.close();
  await handle.close();
  await assert.rejects(requestRaw(baseUrl, "/"));
});

/**
 * CROS Portfolio ProjectionをRepository単体表示と区別して描画することを検証する。
 *
 * @responsibility 許可済みProject、Source Coverageおよび部分状態をWorkbenchへ意味を変えずに搬送する。
 * @trace PPR-IT-002
 * @precondition 現在Repository Contextを含む許可済みPortfolio Projectionを用意する。
 * @stimulus Portfolio付きでWorkbenchを開始しShellを要求する。
 * @observation Project Identity、Source、状態およびFederation表示を観測する。
 * @oracle Projection内の値が表示され、単一Scoreや非開示Projectが追加されない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary PPR-IT-002=Direct Boundary: CROS Portfolio Projection→Workbench Browser Surface
 */
test("許可済みPortfolioをSource Coverage付きで表示する", async () => {
  const surface = await readWorkbenchProjectSurface(repositoryRoot);
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    portfolio: {
      projects: [
        {
          projectId: surface.context.projectId,
          state: "partial",
          sources: [
            {
              repositoryId: surface.context.repositoryId,
              revision: "test-revision",
              state: "complete",
              repositoryRole: surface.context.repositoryRole,
              context: surface.context,
            },
            {
              repositoryId: "visible-missing-source",
              revision: "test-missing",
              state: "missing",
              repositoryRole: null,
              context: null,
            },
          ],
        },
      ],
      retainedAsSourceOfTruth: false,
    },
  });
  try {
    const shell = await requestRaw(handle.baseUrl, "/");
    const body = shell.body.toString("utf8");
    assert.match(body, /CROS federation/u);
    assert.match(body, /visible-missing-source: missing/u);
    assert.match(body, /partial \/ 2 visible sources/u);
  } finally {
    await handle.close();
  }
});

/**
 * 管理Contextがある場合だけCredential管理を公開し、生Tokenを一度だけ表示することを検証する。
 *
 * @responsibility Workbench管理FormからCROS Credential Applicationへの直接搬送と秘密値非保持を検証する。
 * @trace RFD-IT-013
 * @precondition systemAdmin=trueの検証済みAccess ContextとMemory Registryを用意する。
 * @stimulus Developer Credentialを発行し、結果画面を二回要求してから対象を失効する。
 * @observation HTTP結果、一覧Metadata、Registry Recordおよび一度表示Tokenを観測する。
 * @oracle Repository単体では未構成、管理接続時は操作可能で、生Tokenは一回だけ表示されRegistryへ保存されない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: Workbench Browser Form→CROS Credential Application→Registry
 */
test("管理接続時だけCredentialを管理し生Tokenを一度だけ表示する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const access: RequestAccessContext = Object.freeze({
    credentialId: "bootstrap-administrator",
    profile: "administrator",
    workspaceIds: Object.freeze([]),
    systemAdmin: true,
    registryRevision: 0,
  });
  const repositoryOnly = await startWorkbench({
    workingDirectory: repositoryRoot,
  });
  try {
    const shell = await requestRaw(repositoryOnly.baseUrl, "/");
    assert.match(shell.body.toString("utf8"), /接続資格/u);
    assert.match(shell.body.toString("utf8"), /Credentialは不要/u);
    const unavailable = await requestRaw(
      repositoryOnly.baseUrl,
      "/connection-credentials/action",
      "POST",
      "operation=issue&profile=developer",
    );
    assert.equal(unavailable.status, 400);
    assert.equal(registry.inspect().revision, 0);
  } finally {
    await repositoryOnly.close();
  }

  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    credentialAdministration: { registry, access },
  });
  try {
    const initial = await requestRaw(handle.baseUrl, "/");
    const token = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(token);
    assert.match(initial.body.toString("utf8"), /CROS administration/u);

    const issued = await requestRaw(
      handle.baseUrl,
      "/connection-credentials/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "issue",
        profile: "developer",
      }).toString(),
    );
    assert.equal(issued.status, 303);
    const firstDisplay = await requestRaw(handle.baseUrl, "/");
    const firstBody = firstDisplay.body.toString("utf8");
    const bearer = /cros\.v1\.[a-f0-9]{24}\.[A-Za-z0-9_-]+/u.exec(
      firstBody,
    )?.[0];
    assert.ok(bearer);
    assert.match(firstBody, /connection_credential_issued/u);
    assert.match(firstBody, /development/u);
    const snapshot = registry.inspect();
    assert.equal(snapshot.records.length, 1);
    assert.doesNotMatch(JSON.stringify(snapshot), new RegExp(bearer, "u"));

    const secondDisplay = await requestRaw(handle.baseUrl, "/");
    assert.doesNotMatch(secondDisplay.body.toString("utf8"), /cros\.v1\./u);
    const credentialId = snapshot.records[0]?.credentialId;
    assert.ok(credentialId);
    const revoked = await requestRaw(
      handle.baseUrl,
      "/connection-credentials/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "revoke",
        credentialId,
      }).toString(),
    );
    assert.equal(revoked.status, 303);
    const afterRevoke = await requestRaw(handle.baseUrl, "/");
    assert.match(afterRevoke.body.toString("utf8"), /Revoked/u);
    assert.match(
      afterRevoke.body.toString("utf8"),
      /connection_credential_revoked/u,
    );
  } finally {
    await handle.close();
  }
});

/**
 * Workbench操作Tokenを通じて選択PathだけをStage・Commitできることを検証する。
 *
 * @responsibility Browser Form→Workbench Application→Version Control Portの直接搬送と再観測を検証する。
 * @trace RFD-IT-014
 * @precondition Repository-local試験領域にProject Context、公式Logoおよび未反映変更を持つ実Git Repositoryを構築する。
 * @stimulus 不正Token、正しいTokenでStage、続けてCommitをHTTP Formから要求する。
 * @observation HTTP結果、再描画したStaged状態および操作結果を観測する。
 * @oracle 不正TokenはEffect 0で拒否され、正しいTokenでは選択Pathだけが処置される。
 * @cleanup Workbenchを閉じ、Fixtureを再帰削除する。
 * @boundary RFD-IT-014=Related 2 Blocks: Browser Form→Workbench→Version Control Port→Git Adapter
 */
test("Token付きRepository操作で選択PathだけをStage・Commit・通常公開する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-repository-"));
  const remote = await mkdtemp(path.join(testRoot, "workbench-remote-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    await writeFile(path.join(fixture, "work.txt"), "base\n", "utf8");
    git(fixture, "init", "--initial-branch=main");
    git(fixture, "config", "user.name", "CRDD Test");
    git(fixture, "config", "user.email", "crdd-test@example.invalid");
    git(fixture, "add", ".");
    git(fixture, "commit", "--quiet", "--message", "base");
    git(remote, "init", "--bare");
    git(fixture, "remote", "add", "origin", remote);
    git(fixture, "push", "--quiet", "--set-upstream", "origin", "main");
    await writeFile(path.join(fixture, "work.txt"), "changed\n", "utf8");

    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestRaw(handle.baseUrl, "/");
    const token = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(token);
    const rejected = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      "actionToken=wrong&operation=prepare&path=work.txt",
    );
    assert.equal(rejected.status, 400);

    const staged = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "prepare",
        path: "work.txt",
      }).toString(),
    );
    assert.equal(staged.status, 303);
    const afterStage = await requestRaw(handle.baseUrl, "/");
    assert.match(afterStage.body.toString("utf8"), /Staged <span>1<\/span>/u);

    const committed = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "create_revision",
        message: "workbench commit",
      }).toString(),
    );
    assert.equal(committed.status, 303);
    const afterCommit = await requestRaw(handle.baseUrl, "/");
    assert.match(afterCommit.body.toString("utf8"), /revision_created/u);
    const revisionIdentity = git(fixture, "rev-parse", "HEAD");
    const published = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "publish_revision",
        destination: "origin",
        branch: "main",
        revisionIdentity,
        humanConfirmed: "true",
      }).toString(),
    );
    assert.equal(published.status, 303);
    const afterPublication = await requestRaw(handle.baseUrl, "/");
    assert.match(
      afterPublication.body.toString("utf8"),
      /publication_confirmed/u,
    );
    assert.equal(git(remote, "rev-parse", "refs/heads/main"), revisionIdentity);

    await writeFile(
      path.join(fixture, "after-publication.txt"),
      "new\n",
      "utf8",
    );
    await unlink(path.join(fixture, "PROJECT_CONTEXT.md"));
    const completedWithRefreshFailure = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "prepare",
        path: "after-publication.txt",
      }).toString(),
    );
    assert.equal(completedWithRefreshFailure.status, 303);
    assert.equal(
      git(fixture, "diff", "--cached", "--name-only"),
      "after-publication.txt",
    );
    const afterRefreshFailure = await requestRaw(handle.baseUrl, "/");
    assert.match(
      afterRefreshFailure.body.toString("utf8"),
      /prepare_completed/u,
    );
    assert.match(
      afterRefreshFailure.body.toString("utf8"),
      /Gitの現在状態を完全に観測できません/u,
    );
  } finally {
    if (handle !== null) await handle.close();
    await rm(fixture, { recursive: true, force: true });
    await rm(remote, { recursive: true, force: true });
  }
});
