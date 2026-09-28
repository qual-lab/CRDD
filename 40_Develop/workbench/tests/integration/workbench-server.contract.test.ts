/**
 * workbench:integration:production-shellの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Workbench Production Shellのloopback配信、公式ロゴ、固定RouteおよびListener清掃を直接境界で検証する。
 * @trace CPR-IT-006
 * @trace CPR-IT-008
 * @trace ERB-IT-021
 * @trace ERP-IT-001
 * @trace PPR-IT-002
 * @trace RCM-IT-005
 * @trace RFD-IT-005
 * @trace RFD-IT-013
 * @trace RFD-IT-014
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
import { createServer, request as httpRequest } from "node:http";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  createAiProfileCatalogAdministration,
  createAiProfileCatalogRegistry,
  createRepositoryAiProfileCatalogStore,
} from "../../../ai-runtime/src/index.ts";
import {
  createTaskAttemptSettledEvent,
  usageNotObserved,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
} from "../../../execution-intelligence/src/index.ts";
import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  revokeConnectionCredential,
  startCrosRemoteTransport,
  type CrosRuntimeActivityReader,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import {
  createTopicMeetingApplication,
  createTopicMeetingRepository,
} from "../../../project-operation/src/index.ts";
import {
  createCrosProjectContextMcpResolver,
  startMcpAuthenticatedStreamableHttp,
} from "../../../mcp/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  readWorkbenchProjectSurface,
  createRepositoryWorkbenchRuntimeActivityApplication,
  startWorkbench,
  type WorkbenchAiRequestApplication,
  type WorkbenchAiRequestCommand,
  type WorkbenchCandidateApplication,
  type WorkbenchRuntimeActivityApplication,
} from "../../src/index.ts";
import {
  executeRemoteTopicMeetingAction,
  type RemoteTopicMeetingAction,
} from "../../src/remote-topic-meeting.ts";

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
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
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
 * @stimulus gitの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-IT-014=Direct Boundary: workbench Test Source→対象契約
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
 * @responsibility Production入口のBrand、主要Navigation、Runtime Query接続およびSecurity Headerの合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 公式Logo AssetがRepository内に存在する。
 * @stimulus Shell、CSS、Logo、Health、HEADおよび不許可Methodを要求する。
 * @observation Response内容、Content-Type、Security HeaderおよびHealth結果を観測する。
 * @oracle 公式Logo RouteとDirection A Shellだけをloopbackから取得でき、書込みMethodを拒否する。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("Direction A Shellと公式ロゴをloopback限定で配信する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    assert.match(handle.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/u);
    const shell = await requestRaw(handle.baseUrl, "/");
    assert.equal(shell.status, 200);
    assert.match(shell.body.toString("utf8"), /CROS Workbench/u);
    assert.match(shell.body.toString("utf8"), /AI Profiles/u);
    assert.match(shell.body.toString("utf8"), /PROFILE-100003/u);
    assert.match(
      shell.body.toString("utf8"),
      /Configuredは実行可能を意味しません/u,
    );
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
    assert.doesNotMatch(
      shell.body.toString("utf8"),
      /Project Runtime状態Queryが未接続/u,
    );
    assert.match(shell.body.toString("utf8"), /id="runtime-activity"/u);
    assert.match(shell.body.toString("utf8"), /Project Plan/u);
    assert.match(shell.body.toString("utf8"), /v0\.22\.0/u);
    assert.match(shell.body.toString("utf8"), /2026-10-03/u);
    assert.match(shell.body.toString("utf8"), /Group B/u);
    assert.match(shell.body.toString("utf8"), /日程リスク/u);
    assert.match(shell.body.toString("utf8"), /Quality and Evidence/u);
    assert.match(shell.body.toString("utf8"), /28 \/ 39/u);
    assert.match(shell.body.toString("utf8"), /Blocking Finding 0/u);
    assert.match(shell.body.toString("utf8"), /Documentation and Relations/u);
    assert.match(shell.body.toString("utf8"), /TitleまたはPathで検索/u);
    assert.match(shell.body.toString("utf8"), /Project Context:/u);
    assert.match(shell.body.toString("utf8"), /data-workbench-react-root/u);
    assert.match(
      shell.body.toString("utf8"),
      /<script type="module" src="\/assets\/workbench-client\.js"><\/script>/u,
    );
    assert.equal(shell.headers["content-type"], "text/html; charset=utf-8");
    assert.match(
      String(shell.headers["content-security-policy"]),
      /default-src 'self'/u,
    );
    assert.match(
      String(shell.headers["content-security-policy"]),
      /script-src 'self'/u,
    );

    const client = await requestRaw(
      handle.baseUrl,
      "/assets/workbench-client.js",
    );
    assert.equal(client.status, 200);
    assert.equal(
      client.headers["content-type"],
      "text/javascript; charset=utf-8",
    );
    assert.match(client.body.toString("utf8"), /hydrateRoot/u);

    const unlistedClientAsset = await requestRaw(
      handle.baseUrl,
      "/assets/other-client.js",
    );
    assert.equal(unlistedClientAsset.status, 404);

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

    const roadmap = await requestRaw(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F01_Roadmap.md",
    );
    assert.equal(roadmap.status, 200);
    assert.equal(
      roadmap.headers["content-type"],
      "text/markdown; charset=utf-8",
    );
    assert.match(roadmap.body.toString("utf8"), /^# CRDD Roadmap/mu);

    const filteredDocuments = await requestRaw(
      handle.baseUrl,
      "/?documentQuery=Roadmap",
    );
    assert.equal(filteredDocuments.status, 200);
    assert.match(filteredDocuments.body.toString("utf8"), /01_Roadmap\.md/u);
    assert.doesNotMatch(
      filteredDocuments.body.toString("utf8"),
      /owner-artifact\?path=01_Principles\.md/u,
    );

    const releaseProjection = await requestRaw(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F03_Releases.md",
    );
    assert.equal(releaseProjection.status, 200);
    assert.match(releaseProjection.body.toString("utf8"), /^# CRDD Releases/mu);

    const arbitraryDocument = await requestRaw(
      handle.baseUrl,
      "/owner-artifact?path=package.json",
    );
    assert.equal(arbitraryDocument.status, 404);

    const traversal = await requestRaw(
      handle.baseUrl,
      "/owner-artifact?path=..%2Foutside.md",
    );
    assert.equal(traversal.status, 404);

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
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
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
 * @boundary PPR-IT-002=Direct Boundary: workbench Test Source→対象契約
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
        ...Array.from({ length: 21 }, (_, index) => ({
          projectId: `PRJ-${String(100000 + index)}`,
          state: "complete" as const,
          sources: [
            {
              repositoryId: `visible-source-${String(index + 1).padStart(2, "0")}`,
              revision: `test-page-${index + 1}`,
              state: "missing" as const,
              repositoryRole: null,
              context: null,
            },
          ],
        })),
      ],
      retainedAsSourceOfTruth: false,
    },
  });
  try {
    const shell = await requestRaw(handle.baseUrl, "/");
    const body = shell.body.toString("utf8");
    assert.match(body, /CROS federation/u);
    assert.match(body, /次のProject/u);
    const filtered = await requestRaw(
      handle.baseUrl,
      `/?portfolioQuery=${encodeURIComponent(surface.context.projectId)}&portfolioState=partial`,
    );
    const filteredBody = filtered.body.toString("utf8");
    assert.match(filteredBody, /value="partial" selected/u);
    assert.match(filteredBody, /visible-missing-source: missing/u);
    assert.match(filteredBody, /partial \/ 2 visible sources/u);
    assert.match(
      filteredBody,
      new RegExp(
        `href="/project\\?id=${surface.context.projectId.replaceAll("-", "-")}"`,
        "u",
      ),
    );
    const mismatchedCursor = Buffer.from(
      JSON.stringify(["different-query", "partial", surface.context.projectId]),
      "utf8",
    ).toString("base64url");
    const rejectedCursor = await requestRaw(
      handle.baseUrl,
      `/?portfolioQuery=${encodeURIComponent(surface.context.projectId)}&portfolioState=partial&portfolioCursor=${encodeURIComponent(mismatchedCursor)}`,
    );
    assert.match(
      rejectedCursor.body.toString("utf8"),
      /検索条件と継続位置が一致しません/u,
    );
    const detail = await requestRaw(
      handle.baseUrl,
      `/project?id=${encodeURIComponent(surface.context.projectId)}`,
    );
    assert.equal(detail.status, 200);
    assert.match(detail.body.toString("utf8"), /Federated project/u);
    assert.match(detail.body.toString("utf8"), /Repository source/u);
    assert.match(detail.body.toString("utf8"), /今どうなっているか/u);
    assert.match(
      detail.body.toString("utf8"),
      /Project Contextは利用できません/u,
    );
    const undisclosed = await requestRaw(
      handle.baseUrl,
      "/project?id=PRJ-UNDISCLOSED",
    );
    assert.equal(undisclosed.status, 404);
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
 * @boundary RFD-IT-013=Direct Boundary: workbench Test Source→対象契約
 */
test("管理接続時だけCredentialを管理し生Tokenを一度だけ表示する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const access: RequestAccessContext = Object.freeze({
    credentialId: "bootstrap-administrator",
    profile: "administrator",
    workspaceIds: Object.freeze([]),
    systemAdmin: true,
    credentialRegistryRevision: 0,
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
 * WorkbenchがCredentialを保存せずRemote CROSへ接続し失効後にCurrent表示を停止することを検証する。
 *
 * @responsibility Browser一回入力、Workbench Process内だけの接続Credential、明示Refresh／DisconnectおよびRemote失敗表示を検証する。
 * @trace RFD-IT-013
 * @precondition loopback CROS Transportと有効Developer Credentialを用意する。
 * @stimulus Repository modeでWorkbenchを開始し、Browser Formで接続してCredential失効後にRefreshし、最後にDisconnectする。
 * @observation 接続表示、Portfolio、Token非表示、Refresh／Disconnect結果およびHealthを観測する。
 * @oracle 有効時だけRemote Projectionを表示し、失効後は直前値をCurrent扱いせずUnavailableへ遷移し、Disconnect後はRepository modeへ戻る。
 * @cleanup WorkbenchとCROS Transportを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: workbench Test Source→対象契約
 */
test("BrowserからRemote CROSへ接続し失効後は直前Projectionを表示しない", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const administrator: RequestAccessContext = Object.freeze({
    credentialId: "admin",
    profile: "administrator",
    workspaceIds: Object.freeze([]),
    systemAdmin: true,
    credentialRegistryRevision: 0,
  });
  const issued = issueConnectionCredential(registry, administrator, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const surface = await readWorkbenchProjectSurface(repositoryRoot);
  const remoteRuntimeActivity: CrosRuntimeActivityReader = Object.freeze({
    read: async ({ projectId }) =>
      Object.freeze({
        state: "observed" as const,
        reason: "remote_runtime_activity_observed",
        projection: Object.freeze({
          projectId,
          milestoneId: "REMOTE-MILESTONE",
          generation: 8,
          milestoneState: "executing" as const,
          objectiveCounts: Object.freeze({
            planned: 0,
            executing: 1,
            integration_pending: 0,
            accepted: 0,
            returned: 0,
            blocked: 0,
            cancelled: 0,
          }),
          taskCounts: Object.freeze({
            planned: 0,
            waiting_dependency: 0,
            ready: 0,
            starting: 0,
            running: 1,
            cleanup_pending: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            recovery_required: 0,
            superseded: 0,
          }),
          objectiveTaskSummaries: Object.freeze([
            Object.freeze({
              objectiveId: "objective-remote",
              objectiveState: "executing" as const,
              taskCounts: Object.freeze({
                planned: 0,
                waiting_dependency: 0,
                ready: 0,
                starting: 0,
                running: 1,
                cleanup_pending: 0,
                completed: 0,
                failed: 0,
                cancelled: 0,
                recovery_required: 0,
                superseded: 0,
              }),
            }),
          ]),
          workProgress: "in_progress" as const,
          qualityState: "not_evaluated" as const,
          humanDecisionRequired: false,
          recoveryRequired: false,
          nextAction: "wait_for_task" as const,
        }),
        eventState: "observed" as const,
        eventReason: "execution_events_observed",
        events: Object.freeze([
          Object.freeze({
            eventId: `execution-${"c".repeat(64)}`,
            occurredAt: "2026-09-28T00:30:00.000Z",
            objectiveId: "objective-remote",
            taskId: "task-from-remote-cros",
            attemptId: "attempt-remote",
            status: "completed" as const,
            reason: "remote_task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
          }),
        ]),
        eventContinuation: null,
      }),
  });
  const remote = await startCrosRemoteTransport({
    registry,
    readExposureSnapshot: () => ({
      revision: "workbench-exposure-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: surface.context.repositoryId,
          repositoryRevision: "remote-revision-1",
          registryRevision: "workbench-exposure-1",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: surface.context.projectId,
          repositoryId: surface.context.repositoryId,
          bindingId: "workbench-binding",
          revision: "remote-revision-1",
          content: { projectContext: surface.context },
        },
      ],
    }),
    runtimeActivityReader: remoteRuntimeActivity,
  });
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
  });
  try {
    const initial = await requestRaw(handle.baseUrl, "/");
    const initialBody = initial.body.toString("utf8");
    assert.match(initialBody, /Repository mode/u);
    assert.match(initialBody, /type="password" name="token"/u);
    const actionToken = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initialBody,
    )?.[1];
    assert.ok(actionToken);

    const connection = await requestRaw(
      handle.baseUrl,
      "/connection/action",
      "POST",
      new URLSearchParams({
        actionToken,
        operation: "connect",
        baseUrl: remote.baseUrl,
        token: issued.token,
      }).toString(),
    );
    assert.equal(connection.status, 303);
    const connected = await requestRaw(handle.baseUrl, "/");
    const body = connected.body.toString("utf8");
    assert.match(body, /Remote CROS connected/u);
    assert.match(body, /CROS federation/u);
    assert.match(body, /Process memory only/u);
    assert.match(body, /REMOTE-MILESTONE/u);
    assert.match(body, /task-from-remote-cros/u);
    assert.match(body, /remote_task_completed/u);
    assert.doesNotMatch(body, /cros\.v1\./u);

    const revoked = revokeConnectionCredential(
      registry,
      { ...administrator, credentialRegistryRevision: 1 },
      issued.record.credentialId,
    );
    assert.equal(revoked.status, "completed");
    const refreshed = await requestRaw(
      handle.baseUrl,
      "/connection/action",
      "POST",
      new URLSearchParams({
        actionToken,
        operation: "refresh",
      }).toString(),
    );
    assert.equal(refreshed.status, 303);
    const unavailable = await requestRaw(handle.baseUrl, "/");
    assert.match(unavailable.body.toString("utf8"), /Remote CROS unavailable/u);
    assert.match(
      unavailable.body.toString("utf8"),
      /直前のPortfolioをCurrentとして表示せず/u,
    );
    assert.doesNotMatch(unavailable.body.toString("utf8"), /CROS federation/u);
    assert.doesNotMatch(
      unavailable.body.toString("utf8"),
      /task-from-remote-cros/u,
    );

    const health = await requestRaw(
      handle.baseUrl,
      "/.well-known/crdd-workbench-health",
    );
    assert.deepEqual(JSON.parse(health.body.toString("utf8")), {
      contract: "crdd/workbench/v1",
      status: "ready",
      host: "127.0.0.1",
      mode: "remote-cros",
      connectionState: "cros_unavailable",
      readOnly: false,
    });

    const disconnected = await requestRaw(
      handle.baseUrl,
      "/connection/action",
      "POST",
      new URLSearchParams({
        actionToken,
        operation: "disconnect",
      }).toString(),
    );
    assert.equal(disconnected.status, 303);
    const repositoryMode = await requestRaw(handle.baseUrl, "/");
    assert.match(repositoryMode.body.toString("utf8"), /Repository mode/u);
    assert.doesNotMatch(
      repositoryMode.body.toString("utf8"),
      /Process memory only/u,
    );
  } finally {
    await handle.close();
    await remote.close();
  }
});

/**
 * Remote Workbenchが明示選択RepositoryのTopicだけをMCP経由で表示・更新することを検証する。
 *
 * @responsibility Portfolio Source選択、Remote MCP読取り、Repository間Relation Navigationおよび書込みTarget固定を検証する。
 * @trace PPR-IT-002
 * @precondition 同一ProjectのDEV／MGMT Repository、許可Credential、CROS PortfolioおよびMCP Serverを用意する。
 * @stimulus Repository未選択、DEV選択、Relation先詳細、DEV Topic更新および非開示Repository選択を要求する。
 * @observation Workbench HTML、Remote Canonical Markdownおよび非開示結果を観測する。
 * @oracle 未選択ではLocalへfallbackせず、選択Repositoryだけを表示・更新し、RelationはownerRepositoryIdを保持して遷移する。
 * @cleanup Workbench、CROS、MCPを閉じ、Fixtureを削除する。
 * @boundary PPR-IT-002=Direct Boundary: workbench Test Source→対象契約
 */
test("Remote Workbenchは明示RepositoryのTopicをMCP経由で表示・更新する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const devRoot = await mkdtemp(path.join(testRoot, "workbench-remote-dev-"));
  const mgmtRoot = await mkdtemp(path.join(testRoot, "workbench-remote-mgmt-"));
  const registry = createMemoryConnectionCredentialRegistry();
  const administrator: RequestAccessContext = Object.freeze({
    credentialId: "admin",
    profile: "administrator",
    workspaceIds: Object.freeze([]),
    systemAdmin: true,
    credentialRegistryRevision: 0,
  });
  const issued = issueConnectionCredential(registry, administrator, {
    profile: "management",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  /**
   * topic用の試験入力または観測処理を提供する。
   *
   * @responsibility topic用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace CPR-IT-008
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus topicの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary CPR-IT-008=Direct Boundary: workbench Test Source→対象契約
   */
  const topic = (id: string, title: string, relation = "") =>
    `# ${title}\n\n成果物種別: Topic\nTopic ID: \`${id}\`\nProject ID: \`PRJ-REMOTE\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\n${title}を扱う。\n${relation}`;
  await mkdir(path.join(devRoot, "22_Topics", "TOPIC-000101"), {
    recursive: true,
  });
  await mkdir(path.join(mgmtRoot, "22_Topics", "TOPIC-000201"), {
    recursive: true,
  });
  await writeFile(
    path.join(devRoot, "22_Topics", "TOPIC-000101", "topic.md"),
    topic(
      "TOPIC-000101",
      "Remote DEV Topic",
      "\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | `TOPIC-000201` | Management判断 |\n",
    ),
    "utf8",
  );
  await writeFile(
    path.join(mgmtRoot, "22_Topics", "TOPIC-000201", "topic.md"),
    topic("TOPIC-000201", "Remote MGMT Topic"),
    "utf8",
  );
  const surface = await readWorkbenchProjectSurface(repositoryRoot);
  /**
   * snapshot用の試験入力または観測処理を提供する。
   *
   * @responsibility snapshot用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace CPR-IT-006
   * @trace CPR-IT-008
   * @trace ERB-IT-021
   * @trace ERP-IT-001
   * @trace PPR-IT-002
   * @trace RCM-IT-005
   * @trace RFD-IT-005
   * @trace RFD-IT-013
   * @trace RFD-IT-014
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus snapshotの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary CPR-IT-006／CPR-IT-008／ERB-IT-021／ERP-IT-001／PPR-IT-002／RCM-IT-005／RFD-IT-005／RFD-IT-013／RFD-IT-014=Direct Boundary: workbench Test Source→対象契約
   */
  const snapshot = () => ({
    revision: "workbench-remote-topic-1",
    exposures: [
      {
        workspaceId: "development",
        repositoryId: "REMOTE-DEV",
        repositoryRevision: "remote-dev-1",
        registryRevision: "workbench-remote-topic-1",
        active: true,
      },
      {
        workspaceId: "management",
        repositoryId: "REMOTE-MGMT",
        repositoryRevision: "remote-mgmt-1",
        registryRevision: "workbench-remote-topic-1",
        active: true,
      },
    ],
    repositories: [
      {
        projectId: "PRJ-REMOTE",
        repositoryId: "REMOTE-DEV",
        bindingId: "remote-dev-binding",
        revision: "remote-dev-1",
        content: { projectContext: surface.context },
      },
      {
        projectId: "PRJ-REMOTE",
        repositoryId: "REMOTE-MGMT",
        bindingId: "remote-mgmt-binding",
        revision: "remote-mgmt-1",
        content: { projectContext: surface.context },
      },
    ],
  });
  const applications = new Map([
    [
      "REMOTE-DEV",
      createTopicMeetingApplication(createTopicMeetingRepository(devRoot)),
    ],
    [
      "REMOTE-MGMT",
      createTopicMeetingApplication(createTopicMeetingRepository(mgmtRoot)),
    ],
  ]);
  const remote = await startCrosRemoteTransport({
    registry,
    readExposureSnapshot: snapshot,
  });
  const mcp = await startMcpAuthenticatedStreamableHttp(
    createCrosProjectContextMcpResolver({
      registry,
      readExposureSnapshot: snapshot,
      resolveTopicMeetingApplication: (repository) =>
        applications.get(repository.repositoryId) ?? null,
    }),
    { port: 0 },
  );
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    remoteConnection: {
      baseUrl: remote.baseUrl,
      mcpBaseUrl: `http://${mcp.host}:${mcp.port}`,
      token: issued.token,
    },
  });
  try {
    const unselected = await requestRaw(handle.baseUrl, "/");
    assert.doesNotMatch(unselected.body.toString("utf8"), /Remote DEV Topic/u);
    assert.match(
      unselected.body.toString("utf8"),
      /Topic正本を完全に観測できません/u,
    );
    const selected = await requestRaw(
      handle.baseUrl,
      "/?repositoryId=REMOTE-DEV#topics",
    );
    const selectedBody = selected.body.toString("utf8");
    assert.match(selectedBody, /Remote DEV Topic/u);
    assert.doesNotMatch(selectedBody, /Remote MGMT Topic/u);
    assert.match(selectedBody, /name="repositoryId" value="REMOTE-DEV"/u);
    const actionToken = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      selectedBody,
    )?.[1];
    assert.ok(actionToken);
    const detail = await requestRaw(
      handle.baseUrl,
      "/topic?id=TOPIC-000101&repositoryId=REMOTE-DEV",
    );
    assert.match(
      detail.body.toString("utf8"),
      /topic\?id=TOPIC-000201&repositoryId=REMOTE-MGMT/u,
    );
    const updatedMarkdown = topic("TOPIC-000101", "Remote DEV Updated").replace(
      "改訂: `1`",
      "改訂: `2`",
    );
    const updated = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken,
        repositoryId: "REMOTE-DEV",
        operation: "update",
        kind: "topic",
        id: "TOPIC-000101",
        expectedRevision: "1",
        markdown: updatedMarkdown,
      }).toString(),
    );
    assert.equal(updated.status, 303);
    assert.match(
      await readFile(
        path.join(devRoot, "22_Topics", "TOPIC-000101", "topic.md"),
        "utf8",
      ),
      /Remote DEV Updated/u,
    );
    const hidden = await requestRaw(
      handle.baseUrl,
      "/?repositoryId=REMOTE-HIDDEN#topics",
    );
    assert.doesNotMatch(hidden.body.toString("utf8"), /REMOTE-HIDDEN/u);
    assert.doesNotMatch(hidden.body.toString("utf8"), /Remote DEV Updated/u);
  } finally {
    await handle.close();
    await mcp.close();
    await remote.close();
    await rm(devRoot, { recursive: true, force: true });
    await rm(mgmtRoot, { recursive: true, force: true });
  }
});

/**
 * Remote Topic／Meeting Action全種を対応するMCP Toolへ一意に写像することを検証する。
 *
 * @responsibility 登録、編集、削除、Topic昇格およびMeeting Outcome処置が明示Repository付きの一Tool Callへ閉じることを検証する。
 * @trace ERB-IT-021
 * @precondition 未信頼MCP境界を模したlocalhost Serverを用意する。
 * @stimulus Topic／Meetingの全Remote Action Variantを一回ずつ実行する。
 * @observation MCP Tool名、引数、Authorization HeaderおよびCall件数を観測する。
 * @oracle 各Actionが対応Toolへexactに写像され、同じRepository IDを保持し、自動RetryまたはLocal fallbackを発生させない。
 * @cleanup localhost Serverを閉じ、Listener不存在を確認する。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("Remote Topic／Meeting全Actionを明示Repository付きMCP Toolへ写像する", async () => {
  const received: Array<{
    authorization: string | undefined;
    name: unknown;
    args: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.once("end", () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        params?: { name?: unknown; arguments?: unknown };
      };
      received.push({
        authorization: request.headers.authorization,
        name: payload.params?.name,
        args: payload.params?.arguments,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            structuredContent: {
              status: "completed",
              reason: "fixture_completed",
              record: {},
              filesystemEffectCount: 1,
            },
            isError: false,
          },
        }),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const common = {
    id: "TOPIC-000001",
    expectedRevision: 3,
  } as const;
  const actions: readonly RemoteTopicMeetingAction[] = Object.freeze([
    { operation: "create", kind: "topic", markdown: "topic-create" },
    { operation: "create", kind: "meeting", markdown: "meeting-create" },
    { operation: "update", kind: "topic", ...common, markdown: "topic-update" },
    {
      operation: "update",
      kind: "meeting",
      id: "MTG-000001",
      expectedRevision: 4,
      markdown: "meeting-update",
    },
    { operation: "delete", kind: "topic", ...common, confirmed: true },
    {
      operation: "delete",
      kind: "meeting",
      id: "MTG-000001",
      expectedRevision: 4,
      confirmed: true,
    },
    {
      operation: "promote-topic",
      kind: "topic",
      ...common,
      changeId: "CHG-000001",
      reason: "fixture",
      remainingResponsibility: "N/A: 移管完了",
    },
    {
      operation: "treat-outcome",
      kind: "meeting",
      id: "MTG-000001",
      expectedRevision: 4,
      outcomeId: "OUT-001",
      disposition: "transferred",
      owner: "Project Operator",
      reviewTrigger: "Topic更新時",
      targetKind: "topic",
      targetReference: "TOPIC-000001",
      treatment: "Topicへ移管",
      completionCondition: "Topic Relation成立",
      result: "移管済み",
      closeMeeting: true,
    },
  ]);
  try {
    for (const action of actions)
      await executeRemoteTopicMeetingAction(
        baseUrl,
        "fixture-token",
        "REMOTE-DEV",
        action,
      );
    assert.deepEqual(
      received.map((entry) => entry.name),
      [
        "crdd.create_topic",
        "crdd.create_meeting",
        "crdd.update_topic",
        "crdd.update_meeting",
        "crdd.delete_topic",
        "crdd.delete_meeting",
        "crdd.promote_topic",
        "crdd.treat_meeting_outcome",
      ],
    );
    assert.equal(received.length, actions.length);
    for (const entry of received) {
      assert.equal(entry.authorization, "Bearer fixture-token");
      assert.equal(
        (entry.args as { repositoryId?: unknown }).repositoryId,
        "REMOTE-DEV",
      );
    }
    assert.deepEqual(received[4]?.args, {
      repositoryId: "REMOTE-DEV",
      id: "TOPIC-000001",
      expectedRevision: 3,
      confirmed: true,
      reason: "mistaken_registration",
    });
    assert.ok(received[7]);
    assert.equal(
      (received[7].args as { closeMeeting?: unknown }).closeMeeting,
      true,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  }
});

/**
 * WorkbenchがsystemAdmin接続時だけCROS OwnerのAI Profileを管理することを検証する。
 *
 * @responsibility Repository OwnerとCROS Ownerを表示・更新経路で分離する。
 * @trace RFD-IT-013
 * @precondition AI Profile管理を持つCROS TransportとAdministrator Credentialを用意する。
 * @stimulus WorkbenchからRemote接続し、新しいCROS Profileを作成する。
 * @observation Owner表示、管理結果およびCROS Catalog revisionを観測する。
 * @oracle CROS configurationとして表示され、Remote Catalogだけが更新される。
 * @cleanup WorkbenchとCROS Transportを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはsystemAdmin接続時だけCROS OwnerのAI Profileを管理する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const administrator: RequestAccessContext = Object.freeze({
    credentialId: "admin",
    profile: "administrator",
    workspaceIds: Object.freeze([]),
    systemAdmin: true,
    credentialRegistryRevision: 0,
  });
  const issued = issueConnectionCredential(registry, administrator, {
    profile: "administrator",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const profileRegistry = createAiProfileCatalogRegistry(
    DEFAULT_AI_PROFILE_CATALOG,
  );
  const remote = await startCrosRemoteTransport({
    registry,
    readExposureSnapshot: () => ({
      revision: "workbench-profile-admin",
      exposures: [],
      repositories: [],
    }),
    aiProfileAdministration:
      createAiProfileCatalogAdministration(profileRegistry),
  });
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    const initial = await requestRaw(handle.baseUrl, "/");
    const actionToken = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(actionToken);
    const connected = await requestRaw(
      handle.baseUrl,
      "/connection/action",
      "POST",
      new URLSearchParams({
        actionToken,
        operation: "connect",
        baseUrl: remote.baseUrl,
        token: issued.token,
      }).toString(),
    );
    assert.equal(connected.status, 303);
    const shell = await requestRaw(handle.baseUrl, "/");
    assert.match(shell.body.toString("utf8"), /CROS configuration/u);

    const form = new URLSearchParams({
      actionToken,
      operation: "create",
      expectedRevision: "1",
      profileId: "PROFILE-300002",
      adapterModel: "codex-cli|gpt-6-astra",
      family: "astra",
      defaultReasoningEffort: "high",
      compatibilityReason: "",
    });
    form.append("selectionRole", "independent_reviewer");
    form.append("modelTier", "upper_allowed");
    const created = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      form.toString(),
    );
    assert.equal(created.status, 303);
    const after = await requestRaw(handle.baseUrl, "/");
    assert.match(after.body.toString("utf8"), /profile_created/u);
    assert.match(after.body.toString("utf8"), /PROFILE-300002/u);
    assert.equal(profileRegistry.snapshot().revision, 2);
  } finally {
    await handle.close();
    await remote.close();
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
 * @boundary RFD-IT-014=Direct Boundary: workbench Test Source→対象契約
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
    assert.match(initial.body.toString("utf8"), /Repository Tree／Diff/u);
    assert.match(initial.body.toString("utf8"), /work\.txt/u);
    const diff = await requestRaw(handle.baseUrl, "/?diffPath=work.txt");
    assert.equal(diff.status, 200);
    assert.match(diff.body.toString("utf8"), /\+changed/u);
    assert.match(diff.body.toString("utf8"), /Working/u);
    const invalidTree = await requestRaw(
      handle.baseUrl,
      "/?treeDirectory=..%2Foutside",
    );
    assert.equal(invalidTree.status, 200);
    assert.match(
      invalidTree.body.toString("utf8"),
      /TreeまたはDiffを完全に観測できません/u,
    );
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

/**
 * WorkbenchからTopicを登録・表示・編集・削除するを検証する。
 *
 * @responsibility WorkbenchからTopicを登録・表示・編集・削除するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus WorkbenchからTopicを登録・表示・編集・削除するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchからTopicを登録・表示・編集・削除する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-topic-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  /**
   * topic用の試験入力または観測処理を提供する。
   *
   * @responsibility topic用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace CPR-IT-008
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus topicの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary CPR-IT-008=Direct Boundary: workbench Test Source→対象契約
   */
  const topic = (revision: number, state = "open") =>
    `# Workbench Topic\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`PRJ-001\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nWorkbench CRUDを確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| candidate | \`CHG-000010\` | 採用候補 |\n| related | \`TOPIC-999999\` | 欠落Relationの明示 |\n\n## 4. 次の行動\n\n| 行動 | Owner | 期限／再評価契機 | 完了条件 | 状態 |\n|---|---|---|---|---|\n| 確認する | PM | 次回 | 判断する | \`open\` |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: open／waitingでは未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
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
    await mkdir(path.join(fixture, "99_Roadmap", "Changes", "CHG-000010"), {
      recursive: true,
    });
    await writeFile(
      path.join(fixture, "99_Roadmap", "Changes", "CHG-000010", "change.md"),
      "# Workbench Relation Change\n",
      "utf8",
    );
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestRaw(handle.baseUrl, "/");
    const token = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(token);
    const create = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "create",
        markdown: topic(1),
      }).toString(),
    );
    assert.equal(create.status, 303);
    const created = await requestRaw(handle.baseUrl, "/");
    assert.match(created.body.toString("utf8"), /TOPIC-000042/u);
    assert.match(created.body.toString("utf8"), /Workbench CRUDを確認/u);
    assert.match(
      created.body.toString("utf8"),
      /href="\/topic\?id=TOPIC-000042"/u,
    );
    const filtered = await requestRaw(
      handle.baseUrl,
      "/?topicQuery=Workbench&topicState=open&topicOwner=Project%20Operator&topicSort=title_asc",
    );
    assert.equal(filtered.status, 200);
    assert.match(filtered.body.toString("utf8"), /value="Workbench"/u);
    assert.match(filtered.body.toString("utf8"), /TOPIC-000042/u);
    const detail = await requestRaw(handle.baseUrl, "/topic?id=TOPIC-000042");
    assert.equal(detail.status, 200);
    assert.match(detail.body.toString("utf8"), /Topic detail/u);
    assert.match(detail.body.toString("utf8"), /Canonical Markdown/u);
    assert.match(
      detail.body.toString("utf8"),
      /href="\/change\?id=CHG-000010"/u,
    );
    assert.match(detail.body.toString("utf8"), /参照先なし/u);
    assert.match(detail.body.toString("utf8"), /expectedRevision/u);
    const change = await requestRaw(handle.baseUrl, "/change?id=CHG-000010");
    assert.equal(change.status, 200);
    assert.match(change.body.toString("utf8"), /Workbench Relation Change/u);
    const missingChange = await requestRaw(
      handle.baseUrl,
      "/change?id=CHG-999999",
    );
    assert.equal(missingChange.status, 404);
    const missingDetail = await requestRaw(
      handle.baseUrl,
      "/topic?id=TOPIC-999999",
    );
    assert.equal(missingDetail.status, 404);
    const update = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "update",
        id: "TOPIC-000042",
        expectedRevision: "1",
        markdown: topic(2, "waiting"),
      }).toString(),
    );
    assert.equal(update.status, 303);
    const updated = await requestRaw(handle.baseUrl, "/");
    assert.match(updated.body.toString("utf8"), /waiting/u);
    const promote = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "promote-topic",
        id: "TOPIC-000042",
        expectedRevision: "2",
        changeId: "CHG-000010",
        reason: "具体的な変更を採用した",
        remainingResponsibility: "CHG完了後にCloseを判断する",
      }).toString(),
    );
    assert.equal(promote.status, 303);
    const promoted = await requestRaw(handle.baseUrl, "/topic?id=TOPIC-000042");
    assert.match(promoted.body.toString("utf8"), /promoted/u);
    assert.match(promoted.body.toString("utf8"), /CHG-000010/u);
    const remove = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "delete",
        id: "TOPIC-000042",
        expectedRevision: "3",
        confirmed: "true",
      }).toString(),
    );
    assert.equal(remove.status, 303);
    const deleted = await requestRaw(handle.baseUrl, "/");
    assert.doesNotMatch(deleted.body.toString("utf8"), /TOPIC-000042/u);
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * WorkbenchからMeeting Outcomeを処置してCloseするを検証する。
 *
 * @responsibility WorkbenchからMeeting Outcomeを処置してCloseするを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus WorkbenchからMeeting Outcomeを処置してCloseするの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchからMeeting Outcomeを処置してCloseする", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-meeting-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  const meeting = `# Workbench Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`PRJ-001\`\n状態: \`recorded\`\n開催日時: \`2026-09-27 10:00 JST\`\n改訂: \`1\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nWorkbench Outcome処置を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: Outcome処置後に評価する\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正ではない\` |\n| 残る影響 | |\n`;
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
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestRaw(handle.baseUrl, "/");
    const token = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(token);
    const create = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "meeting",
        operation: "create",
        markdown: meeting,
      }).toString(),
    );
    assert.equal(create.status, 303);
    const treat = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "meeting",
        operation: "treat-outcome",
        id: "MTG-000042",
        expectedRevision: "1",
        outcomeId: "OUT-001",
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "処置済み",
        targetKind: "none",
        targetReference: "N/A: 完了",
        treatment: "完了",
        completionCondition: "確認済み",
        result: "完了",
        closeMeeting: "true",
      }).toString(),
    );
    assert.equal(treat.status, 303);
    const completed = await requestRaw(handle.baseUrl, "/");
    assert.match(completed.body.toString("utf8"), /meeting_outcome_treated/u);
    assert.match(completed.body.toString("utf8"), /closed/u);
    assert.match(completed.body.toString("utf8"), /pending 0/u);
    const filtered = await requestRaw(
      handle.baseUrl,
      "/?meetingFrom=2026-09-27&meetingTo=2026-09-27&meetingState=closed&meetingSort=occurred_desc",
    );
    assert.equal(filtered.status, 200);
    assert.match(filtered.body.toString("utf8"), /MTG-000042/u);
    assert.match(filtered.body.toString("utf8"), /value="2026-09-27"/u);
    const detail = await requestRaw(handle.baseUrl, "/meeting?id=MTG-000042");
    assert.equal(detail.status, 200);
    assert.match(detail.body.toString("utf8"), /Meeting detail/u);
    assert.match(detail.body.toString("utf8"), /未処置Outcome/u);
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * Workbenchの現在Session AI依頼をApplication Portへ搬送することを検証する。
 *
 * @responsibility Profile選択、Project Context参照、状態観測および意味区分表示の合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 決定論的なFake AI Request Applicationを注入する。
 * @stimulus Profileと依頼を送信し、完了Snapshotを再取得する。
 * @observation Application入力とBrowserへ返る四区分の結果を観測する。
 * @oracle 固定ProfileとProject Contextだけが搬送され、外部Textはescapeされ、事実と推論を混同しない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchのAI依頼を現在Sessionだけで開始し意味区分を表示する", async () => {
  let received: WorkbenchAiRequestCommand | null = null;
  const candidateId = `candidate.${"6".repeat(64)}.${"7".repeat(64)}`;
  const candidateActions: Array<
    Readonly<{ operation: string; confirmed: boolean }>
  > = [];
  const application: WorkbenchAiRequestApplication = Object.freeze({
    start: async (request) => {
      received = request;
      return Object.freeze({
        status: "accepted" as const,
        requestId: "AIREQ-000001",
        reason: null,
      });
    },
    observe: async (requestId) =>
      Object.freeze({
        requestId,
        mode: received?.mode ?? ("read_only_advice" as const),
        profileId: received?.profileId ?? "PROFILE-100001",
        status: "completed" as const,
        reason: null,
        facts: Object.freeze([
          Object.freeze({
            text: "<fact>",
            references: Object.freeze(["PROJECT_CONTEXT.md#1"]),
          }),
        ]),
        sharedAnalysis: Object.freeze([
          Object.freeze({
            text: "共有済み",
            references: Object.freeze(["PROJECT_CONTEXT.md#2"]),
          }),
        ]),
        additionalInferences: Object.freeze([
          Object.freeze({
            text: "追加推論",
            references: Object.freeze(["PROJECT_CONTEXT.md#3"]),
          }),
        ]),
        nextOptions: Object.freeze([
          Object.freeze({
            text: "次の一手",
            references: Object.freeze(["PROJECT_CONTEXT.md#4"]),
          }),
        ]),
        candidate:
          received?.mode === "change_candidate"
            ? Object.freeze({
                candidateId,
                disposition: "untrusted_not_adopted" as const,
              })
            : null,
      }),
    cancel: async (requestId) =>
      Object.freeze({
        requestId,
        mode: "read_only_advice" as const,
        profileId: "PROFILE-100001",
        status: "cancelled" as const,
        reason: "cancelled_by_user",
        facts: Object.freeze([]),
        sharedAnalysis: Object.freeze([]),
        additionalInferences: Object.freeze([]),
        nextOptions: Object.freeze([]),
        candidate: null,
      }),
  });
  const candidateApplication: WorkbenchCandidateApplication = Object.freeze({
    review: async (requestedCandidateId) =>
      Object.freeze({
        status: requestedCandidateId === candidateId ? "available" : "blocked",
        reason:
          requestedCandidateId === candidateId
            ? "workbench_candidate_review_available"
            : "workbench_candidate_review_unavailable",
        candidate:
          requestedCandidateId === candidateId
            ? Object.freeze({
                candidateId,
                informationClassification: "internal" as const,
                expiresAtMs: Date.now() + 60_000,
                baseRevision: "a".repeat(40),
                candidateHash: "b".repeat(64),
                patchHash: "c".repeat(64),
                changedPaths: Object.freeze([
                  "40_Develop/workbench/src/ai-request.ts",
                ]),
              })
            : null,
      }),
    adopt: async (requestedCandidateId, confirmed) => {
      candidateActions.push(Object.freeze({ operation: "adopt", confirmed }));
      return Object.freeze({
        operation: "adopt" as const,
        status: confirmed ? ("completed" as const) : ("blocked" as const),
        reason: confirmed
          ? "workbench_candidate_adopted"
          : "workbench_candidate_adoption_confirmation_required",
        candidateId: requestedCandidateId,
        receiptId: confirmed ? "receipt-000001" : null,
        effectIssued: confirmed,
        effectStateUnknown: false,
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        recoveryIds: Object.freeze([]),
      });
    },
    discard: async (requestedCandidateId, confirmed) => {
      candidateActions.push(Object.freeze({ operation: "discard", confirmed }));
      return Object.freeze({
        operation: "discard" as const,
        status: confirmed ? ("completed" as const) : ("blocked" as const),
        reason: confirmed
          ? "workbench_candidate_discarded"
          : "workbench_candidate_discard_confirmation_required",
        candidateId: requestedCandidateId,
        receiptId: null,
        effectIssued: confirmed,
        effectStateUnknown: false,
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        recoveryIds: Object.freeze([]),
      });
    },
  });
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    aiRequestApplication: application,
    candidateApplication,
  });
  try {
    const initial = await requestRaw(handle.baseUrl, "/");
    const token = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(token);
    assert.match(initial.body.toString("utf8"), /Current session only/u);

    const rejectedWithoutConfirmation = await requestRaw(
      handle.baseUrl,
      "/ai-request/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "start",
        mode: "read_only_advice",
        profileId: "PROFILE-100001",
        prompt: "確認なしでは送信しない",
      }).toString(),
    );
    assert.equal(rejectedWithoutConfirmation.status, 400);
    assert.equal(received, null);

    const started = await requestRaw(
      handle.baseUrl,
      "/ai-request/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "start",
        mode: "read_only_advice",
        profileId: "PROFILE-100001",
        prompt: "今の状況と次の一手を整理して",
        externalSendConfirmed: "yes",
      }).toString(),
    );
    assert.equal(started.status, 303);
    assert.deepEqual(received, {
      mode: "read_only_advice",
      profileId: "PROFILE-100001",
      prompt: "今の状況と次の一手を整理して",
      contextReferences: ["PROJECT_CONTEXT.md"],
      allowedPaths: [],
      externalSendConfirmed: true,
    });

    const completed = await requestRaw(handle.baseUrl, "/");
    const html = completed.body.toString("utf8");
    assert.match(html, /completed/u);
    assert.match(html, /確認できた事実/u);
    assert.match(html, /共有済み分析/u);
    assert.match(html, /追加推論/u);
    assert.match(html, /次の選択肢/u);
    assert.match(html, /&lt;fact&gt;/u);
    assert.match(html, /根拠:/u);
    assert.match(html, /PROJECT_CONTEXT\.md#1/u);
    assert.doesNotMatch(html, /<fact>/u);

    const candidateStarted = await requestRaw(
      handle.baseUrl,
      "/ai-request/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "start",
        mode: "change_candidate",
        profileId: "PROFILE-100003",
        prompt: "Workbenchの表示を改善する",
        allowedPaths: "40_Develop/workbench/src\n04_UI/Details",
        externalSendConfirmed: "yes",
      }).toString(),
    );
    assert.equal(candidateStarted.status, 303);
    assert.deepEqual(received, {
      mode: "change_candidate",
      profileId: "PROFILE-100003",
      prompt: "Workbenchの表示を改善する",
      contextReferences: ["PROJECT_CONTEXT.md"],
      allowedPaths: ["40_Develop/workbench/src", "04_UI/Details"],
      externalSendConfirmed: true,
    });
    const candidateCompleted = await requestRaw(handle.baseUrl, "/");
    const candidateHtml = candidateCompleted.body.toString("utf8");
    assert.match(candidateHtml, /未信頼・未採用/u);
    assert.match(candidateHtml, /candidate\.[0-9a-f]{64}\.[0-9a-f]{64}/u);
    assert.match(candidateHtml, /40_Develop\/workbench\/src\/ai-request\.ts/u);
    assert.match(candidateHtml, /候補を採用/u);
    assert.match(candidateHtml, /候補を破棄/u);

    const adoptWithoutConfirmation = await requestRaw(
      handle.baseUrl,
      "/candidate/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "adopt",
        candidateId,
      }).toString(),
    );
    assert.equal(adoptWithoutConfirmation.status, 303);
    assert.deepEqual(candidateActions.at(-1), {
      operation: "adopt",
      confirmed: false,
    });

    const adoptDifferentCandidate = await requestRaw(
      handle.baseUrl,
      "/candidate/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "adopt",
        candidateId: `candidate.${"8".repeat(64)}.${"9".repeat(64)}`,
        confirmed: "true",
      }).toString(),
    );
    assert.equal(adoptDifferentCandidate.status, 400);
    assert.equal(candidateActions.length, 1);

    const adopted = await requestRaw(
      handle.baseUrl,
      "/candidate/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "adopt",
        candidateId,
        confirmed: "true",
      }).toString(),
    );
    assert.equal(adopted.status, 303);
    assert.deepEqual(candidateActions.at(-1), {
      operation: "adopt",
      confirmed: true,
    });
    const adoptedHtml = (await requestRaw(handle.baseUrl, "/")).body.toString(
      "utf8",
    );
    assert.match(adoptedHtml, /workbench_candidate_adopted/u);
    assert.match(adoptedHtml, /receipt-000001/u);

    const discarded = await requestRaw(
      handle.baseUrl,
      "/candidate/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "discard",
        candidateId,
        confirmed: "true",
      }).toString(),
    );
    assert.equal(discarded.status, 303);
    assert.deepEqual(candidateActions.at(-1), {
      operation: "discard",
      confirmed: true,
    });
  } finally {
    await handle.close();
  }
});

/**
 * WorkbenchがProject Runtimeの現在投影を独立した実行状況面へ表示することを検証する。
 *
 * @responsibility Objective／Task、判断待ち、Recoveryおよび次処置を未接続や空状態へ畳まない合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 決定論的なRuntime Activity Applicationを注入する。
 * @stimulus Workbench Shellを取得する。
 * @observation Runtime Activity Panelの状態、件数、判断および次処置を観測する。
 * @oracle 注入した現在投影だけが表示され、Project ContextからRuntime状態を推測しない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはProject Runtimeの現在投影を実行状況として表示する", async () => {
  const application: WorkbenchRuntimeActivityApplication = Object.freeze({
    observe: async (projectId) =>
      Object.freeze({
        state: "observed" as const,
        reason: "project_runtime_state_observed",
        projection: Object.freeze({
          projectId,
          milestoneId: "MILESTONE-000001",
          generation: 3,
          milestoneState: "in_progress",
          objectiveCounts: Object.freeze({ running: 1, completed: 2 }),
          taskCounts: Object.freeze({ queued: 2, running: 1 }),
          objectiveTaskSummaries: Object.freeze([
            Object.freeze({
              objectiveId: "OBJ-000003",
              objectiveState: "running",
              taskCounts: Object.freeze({ queued: 2, running: 1 }),
            }),
          ]),
          workProgress: "in_progress",
          qualityState: "integration_pending",
          humanDecisionRequired: true,
          recoveryRequired: false,
          nextAction: "human_decision",
        }),
        eventState: "observed" as const,
        eventReason: "execution_events_observed",
        events: Object.freeze([
          Object.freeze({
            eventId: `execution-${"a".repeat(64)}`,
            occurredAt: "2026-09-27T23:50:00.000Z",
            objectiveId: "OBJ-000003",
            taskId: "TASK-000004",
            attemptId: "ATTEMPT-000001",
            status: "completed" as const,
            reason: "task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
          }),
        ]),
        eventContinuation: null,
      }),
  });
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    runtimeActivityApplication: application,
  });
  try {
    const shell = await requestRaw(handle.baseUrl, "/");
    const html = shell.body.toString("utf8");
    assert.match(html, /Runtime activity/u);
    assert.match(html, /MILESTONE-000001/u);
    assert.match(html, /OBJ-000003/u);
    assert.match(html, /human_decision/u);
    assert.match(html, /TASK-000004/u);
    assert.match(html, /task_completed/u);
    assert.match(html, /人間判断<\/dt><dd>必要/u);
    assert.doesNotMatch(html, /Project Runtime状態Queryが未接続/u);
  } finally {
    await handle.close();
  }
});

/**
 * Repository Event StoreをProject限定かつ継続読込で表示できることを検証する。
 *
 * @responsibility Canonical Event Store、Project絞込み、新しい順、Cursorおよび重複なしの境界検証を所有する。
 * @trace ERP-IT-001
 * @precondition 隔離Repositoryへ対象Project 2件と別Project 1件のEventを保存する。
 * @stimulus limit 1で最初と次のPageを観測する。
 * @observation Event順序、Continuation、Project Identityおよび二Page間重複を観測する。
 * @oracle 対象Projectだけを新しい順で返し、Cursor後に同じEventを再掲しない。
 * @cleanup 隔離Repositoryを削除する。
 * @boundary ERP-IT-001=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはRepository EventをProject限定で継続読込する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(
    path.join(testRoot, "workbench-runtime-events-"),
  );
  try {
    execFileSync("git", ["init", "--quiet", fixture], { windowsHide: true });
    const verified = verifyExecutionIntelligenceRepositoryRoot(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    /**
     * event用の試験入力または観測処理を提供する。
     *
     * @responsibility event用の試験入力または観測処理を提供するの検証責務を所有する。
     * @trace ERP-IT-001
     * @precondition 対象契約を再現できる固定入力と依存を用意する。
     * @stimulus eventの対象操作を実行する。
     * @observation 返却値、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionがSummaryの期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
     * @boundary ERP-IT-001=Direct Boundary: workbench Test Source→対象契約
     */
    const event = (projectId: string, taskId: string, occurredAt: string) =>
      createTaskAttemptSettledEvent({
        occurredAt,
        identity: {
          projectId,
          milestoneId: "milestone-a",
          objectiveId: "objective-a",
          taskId,
          attemptId: `attempt-${taskId}`,
          operationId: "operation-a",
        },
        execution: {
          role: "executor",
          provider: { state: "not_observed", reason: "provider_not_reported" },
          model: { state: "not_observed", reason: "model_not_reported" },
          inputStrategyRef: {
            state: "observed",
            value: "test/input/v1",
            source: "integration_fixture",
          },
          durationMs: {
            state: "observed",
            value: 10,
            source: "integration_clock",
          },
          usage: usageNotObserved("usage_not_reported"),
          humanActiveMs: {
            state: "not_observed",
            reason: "human_time_not_reported",
          },
        },
        outcome: {
          status: "completed",
          reason: "task_completed",
          effectState: "settled",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
        },
        quality: {
          state: "not_applicable",
          reason: "attempt_settlement_is_not_acceptance",
        },
      });
    assert.equal(
      writeExecutionIntelligenceEvent(
        verified.root,
        event("project-a", "task-old", "2026-09-28T00:00:00.000Z"),
      ).status,
      "completed",
    );
    assert.equal(
      writeExecutionIntelligenceEvent(
        verified.root,
        event("project-a", "task-new", "2026-09-28T00:01:00.000Z"),
      ).status,
      "completed",
    );
    assert.equal(
      writeExecutionIntelligenceEvent(
        verified.root,
        event("project-b", "task-hidden", "2026-09-28T00:02:00.000Z"),
      ).status,
      "completed",
    );
    const application =
      createRepositoryWorkbenchRuntimeActivityApplication(fixture);
    const first = await application.observe("project-a", { limit: 1 });
    assert.equal(first.eventState, "observed");
    assert.equal(first.events[0]?.taskId, "task-new");
    assert.ok(first.eventContinuation);
    if (first.eventContinuation === null)
      throw new Error("runtime_event_continuation_missing");
    const second = await application.observe("project-a", {
      cursor: first.eventContinuation,
      limit: 1,
    });
    assert.equal(second.events[0]?.taskId, "task-old");
    assert.equal(second.eventContinuation, null);
    assert.notEqual(second.events[0]?.eventId, first.events[0]?.eventId);
    assert.doesNotMatch(JSON.stringify([first, second]), /task-hidden/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * Repository Ownerが採用したAI Profile CatalogをWorkbenchが表示することを検証する。
 *
 * @responsibility 既定Catalog固定ではなく、同じRepository設定Ownerの現在Snapshotを利用することを反証する。
 * @trace RCM-IT-005
 * @precondition 隔離Repositoryへ追加ProfileをRevision 1として採用する。
 * @stimulus 同じRepositoryからWorkbenchを開始しShellを取得する。
 * @observation 追加Profile IDとModelをBrowser表示で観測する。
 * @oracle 採用済みPROFILE-300001を表示し、設定だけから実行可能と表示しない。
 * @cleanup Workbench Handleと隔離Repositoryを削除する。
 * @boundary RCM-IT-005=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはRepository Ownerの採用済みAI Profile Catalogを表示する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-ai-profile-"));
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
    git(fixture, "init", "--initial-branch=main");
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(adapter.status, "ready");
    assert.ok(adapter.store);
    const adoption = adapter.store.adopt({
      expectedRevision: 0,
      candidate: {
        ...DEFAULT_AI_PROFILE_CATALOG,
        profiles: [
          ...DEFAULT_AI_PROFILE_CATALOG.profiles,
          {
            profileId: "PROFILE-300001",
            adapterId: "codex-cli",
            family: "astra",
            exactModelId: "gpt-6-astra",
            selectionRoles: ["executor"],
            modelTiers: ["preferred"],
            speedMode: "normal",
            billingMode: "subscription_oauth",
            defaultReasoningEffort: "high",
            compatibilityReason: null,
          },
        ],
      },
    });
    assert.equal(adoption.status, "adopted");

    handle = await startWorkbench({ workingDirectory: fixture });
    const shell = await requestRaw(handle.baseUrl, "/");
    const html = shell.body.toString("utf8");
    assert.match(html, /PROFILE-300001/u);
    assert.match(html, /gpt-6-astra/u);
    assert.match(html, /unknown/u);
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * WorkbenchからRepository OwnerのAI Profileを限定管理する。
 *
 * @responsibility 登録Adapter／Modelだけの作成と確認付き削除をBrowser直接境界で検証する。
 * @trace RCM-IT-005
 * @precondition AI Profile Catalog未作成の隔離RepositoryからWorkbenchを開始する。
 * @stimulus Profileを作成し、未確認削除と確認済み削除を順に送信する。
 * @observation Browser表示、結果理由、Revisionおよび耐久Snapshotを観測する。
 * @oracle 作成と確認済み削除だけが反映され、未確認削除はEffect 0になる。
 * @cleanup Workbench Handleと隔離Repositoryを削除する。
 * @boundary RCM-IT-005=Direct Boundary: workbench Test Source→対象契約
 */
test("Workbenchは登録済みAdapterだけでAI Profileを作成し確認付きで削除する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-ai-admin-"));
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
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestRaw(handle.baseUrl, "/");
    const token = /name="actionToken" value="([A-Za-z0-9_-]+)"/u.exec(
      initial.body.toString("utf8"),
    )?.[1];
    assert.ok(token);
    assert.match(initial.body.toString("utf8"), /AI Profile管理/u);

    const createForm = new URLSearchParams({
      actionToken: token,
      operation: "create",
      expectedRevision: "0",
      profileId: "PROFILE-300001",
      adapterModel: "codex-cli|gpt-6-astra",
      family: "astra",
      defaultReasoningEffort: "high",
      compatibilityReason: "",
    });
    createForm.append("selectionRole", "executor");
    createForm.append("modelTier", "preferred");
    const created = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      createForm.toString(),
    );
    assert.equal(created.status, 303);
    const afterCreate = await requestRaw(handle.baseUrl, "/");
    assert.match(afterCreate.body.toString("utf8"), /profile_created/u);
    assert.match(afterCreate.body.toString("utf8"), /PROFILE-300001/u);
    assert.match(afterCreate.body.toString("utf8"), /revision 1/u);

    const unconfirmed = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "delete",
        expectedRevision: "1",
        profileId: "PROFILE-300001",
      }).toString(),
    );
    assert.equal(unconfirmed.status, 303);
    const afterUnconfirmed = await requestRaw(handle.baseUrl, "/");
    assert.match(
      afterUnconfirmed.body.toString("utf8"),
      /profile_delete_confirmation_required/u,
    );
    assert.match(afterUnconfirmed.body.toString("utf8"), /PROFILE-300001/u);

    const confirmed = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "delete",
        expectedRevision: "1",
        profileId: "PROFILE-300001",
        confirmed: "true",
      }).toString(),
    );
    assert.equal(confirmed.status, 303);
    const afterDelete = await requestRaw(handle.baseUrl, "/");
    assert.match(afterDelete.body.toString("utf8"), /profile_deleted/u);
    assert.match(afterDelete.body.toString("utf8"), /revision 2/u);
    const reopened = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(reopened.status, "ready");
    assert.ok(reopened.store);
    assert.equal(
      reopened.store
        .snapshot()
        .catalog.profiles.some(
          (profile) => profile.profileId === "PROFILE-300001",
        ),
      false,
    );
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});
