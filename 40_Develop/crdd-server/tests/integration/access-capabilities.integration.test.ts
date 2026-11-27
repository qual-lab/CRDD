/**
 * AMの現在認可から内容操作を実HTTPで搬送する。
 * @packageDocumentation
 * @responsibility 初回未完了・失効・空認可・本文不明と取消を非開示結果へ照合する。
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @trace RCM-IT-010
 * @trace EST-IT-002
 * @trace EST-IT-014
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @level IT
 * @scope MCP専用Resolver、AM、Domain固定本文、HTTP。
 * @boundary 自己生成Store／Repositoryから既存HTTP Transportまで。公開Launcherの完成ではない。
 */
import assert from "node:assert/strict";
import {
  observeRegistrationDirectory,
  openHostedExecutionAccess,
  registerHostedRepository,
  resolveHostedDevelopmentAccess,
  resolveHostedRepositories,
} from "../../src/service/access.ts";
import {
  bindGitHost,
  configuredGitHosts,
  type GitHostProvider,
} from "../../src/service/git-host.ts";
import type { AiRequestSnapshot } from "../../src/service/execution.ts";
import { createHostedAiSessions } from "../../src/service/execution.ts";

import childProcess, { spawnSync } from "node:child_process";
import crypto, {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
} from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  createServer,
  type IncomingMessage,
  request as httpRequest,
  Server,
  ServerResponse,
} from "node:http";
import { registerHooks } from "node:module";
import path from "node:path";
import * as oidc from "openid-client";
import test, { type TestContext } from "node:test";
import {
  readAccount,
  readCurrentAccess,
  registerRepository,
  linkAccountFromHost,
  unregisterRepository,
} from "@qual-lab/crdd-access-management";
import { createRetiredCredentialFixture } from "../../../access-management/tests/support/retired-credential.ts";
import { createFilesystemStoreRoot } from "../../../access-management/src/initialization/root.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import { createRepositoryScope } from "../../src/service/repository-scope.ts";
import {
  selectionConfig,
  taskExecutionSelections,
} from "../../../coordinator/tests/fixtures/ai-selection.ts";
import {
  activityId,
  storeFixtureExecution,
} from "../../../coordinator/tests/fixtures/execution-intelligence.ts";
import {
  git as fixtureGit,
  prepareWorkspaceSurface,
} from "../../../coordinator/tests/fixtures/workspace-surface.ts";
import {
  createMeetingOperations,
  createTopicOperations,
} from "@qual-lab/crdd-document-model";
import {
  createQueue,
  initializeExecutionStore,
} from "@qual-lab/crdd-execution-model";
import { deriveCoordinatorRepositoryBindingId } from "@qual-lab/crdd-coordinator";
import { persistAcceptancePendingState } from "../../../coordinator/tests/fixtures/decision-state.ts";
import {
  initialExecutionInput,
  projectExecutionFixture,
  withCallerPlan,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  getRepository,
  readRepositorySnapshot,
} from "@qual-lab/crdd-version-control";
import { startCrddServer, startWorkbench } from "../../src/app.ts";
import {
  createOAuthMcpResolver,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  MCP_CURRENT_ACCESS_TOOL,
  MCP_ACCESS_MANAGEMENT_READ_TOOLS,
  EXECUTION_ACTIVITY_TOOL,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
  MCP_WORKSPACE_TOOLS,
  MCP_TOPIC_MEETING_TOOLS,
  type McpResponse,
} from "../../src/transport/mcp-server.ts";
import { startMcpAuthenticatedStreamableHttp } from "../support/mcp-http-listener.ts";
import { startManagementHttpFixture } from "../support/management-http.ts";
import { invokeMcpSource } from "../fixtures/sdk-request.ts";
import { requestTransport } from "../support/workbench-http.ts";
import { workspaceResources } from "../../src/transport/api-server.ts";
import { mcpScope } from "../../src/transport/mcp-oauth.ts";
import { executionDefinitionResources } from "../../src/service/execution.ts";

const [fixtureGitHost] = configuredGitHosts([
  {
    host: "github.com",
    provider: "github",
    providerData: { clientId: "fixture", clientSecret: "fixture" },
  },
]).map(bindGitHost);
const readFixtureGitHost = (host: string) =>
  host === fixtureGitHost?.host ? fixtureGitHost : undefined;

const definitionTools = Object.values(executionDefinitionResources).map(
  ({ tool }) => tool,
);

const sharedExecutionToolNames = [
  "crdd.answer_decision",
  "crdd.apply_decision",
  "crdd.close_decision",
  "crdd.get_execution_state",
  "crdd.request_decision",
  "crdd.resume_objective",
  "crdd.start_objective",
];

test("共有登録と登録済み内容は運用者の許可ルートから出ない", async (t) => {
  const f = hostedFixture(t);
  const target = f.targets[0];
  assert.ok(target);
  const before = fs.readFileSync(f.current);
  const state = JSON.parse(before.toString("utf8")) as AccessManagementState;
  const actor = state.users[0];
  assert.ok(actor);
  actor.role = "administrator";
  fs.writeFileSync(f.current, JSON.stringify(state));
  const expectedBytes = fs.readFileSync(f.current);
  const approved = path.join(f.directory, "approved");
  const sibling = path.join(f.directory, "approved-other");
  fs.mkdirSync(approved);
  fs.mkdirSync(sibling);
  fixtureGit(sibling, ["init", "--quiet"]);
  fixtureGit(sibling, [
    "config",
    "--local",
    "remote.origin.url",
    "https://git.example.test/fixture/repository.out-of-scope.git",
  ]);
  const inside = path.join(approved, "checkout");
  fs.mkdirSync(inside);
  const alias = path.join(approved, "outside-link");
  fs.symlinkSync(
    sibling,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  const repositoryScope = createRepositoryScope([approved]);
  assert.throws(
    () => createRepositoryScope([]),
    /shared_repository_roots_invalid/u,
  );
  assert.throws(
    () => createRepositoryScope([path.parse(approved).root]),
    /shared_repository_roots_invalid/u,
  );
  assert.equal(repositoryScope(inside), true);
  if (process.platform === "win32") {
    const withoutDrive = (directory: string) =>
      path.sep + path.relative(path.parse(directory).root, directory);
    assert.throws(() => createRepositoryScope([withoutDrive(approved)]), {
      message: "shared_repository_roots_invalid",
    });
    assert.equal(repositoryScope(withoutDrive(inside)), false);
  }
  assert.equal(repositoryScope(approved), false);
  assert.equal(repositoryScope(sibling), false);
  assert.equal(repositoryScope(alias), false);
  const principal = {
    kind: "account" as const,
    userId: f.userId,
    bindingId: f.bindingId,
    expiresAt: Date.now() + 60_000,
  };
  const signal = new AbortController().signal;
  const readHostToken = (host: string) =>
    f.hostAccess.read(host, "fixture-reference", principal);
  const readSession = {
    principal,
    repositoryScope: f.repositoryScope,
    readGitHost: f.hostAccess.readGitHost,
    readHostToken,
  };
  const allowed = await resolveHostedRepositories(
    f.root,
    readSession,
    signal,
    target.id,
  );
  assert.deepEqual(
    allowed?.repositories.map((entry) => entry.repositoryId),
    [target.id],
  );
  assert.equal(
    await resolveHostedRepositories(
      f.root,
      { ...readSession, repositoryScope },
      signal,
      target.id,
    ),
    null,
  );
  const denied = await registerHostedRepository(
    f.root,
    principal,
    {
      repositoryId: "repository.out-of-scope",
      directory: sibling,
      expectedRevision: state.revision,
      operationId: randomUUID(),
    },
    () => assert.fail("許可外のGitホストを照会しない"),
    () => assert.fail("許可外の資格を読まない"),
    () => true,
    signal,
    repositoryScope,
  );
  assert.equal(denied.status, "rejected");
  assert.deepEqual(fs.readFileSync(f.current), expectedBytes);
  fs.renameSync(approved, `${approved}-retired`);
  fs.mkdirSync(approved);
  fs.mkdirSync(inside);
  assert.equal(repositoryScope(inside), false);
});

test("Projectは旧Bearerを拒否し、単体HTTPと共有MCPで対象を限定する", async (t) => {
  const f = fixture(t);
  const hosted = hostedFixture(t);
  const mcpBase = await openFixtureMcp(hosted);
  const [first, second] = f.targets;
  assert.ok(first && second);
  const shared = await startWorkbench({
    workingDirectory: first.target,
    localAccessRoot: f.root,
  });
  const local = await startWorkbench({ workingDirectory: first.target }).catch(
    async (error: unknown) => {
      await shared.close();
      throw error;
    },
  );
  const projectId = "project.fixture";
  const detailPath = (repositoryId: string, project = projectId) =>
    `/api/repositories/${repositoryId}/projects/${project}/context`;
  const headers = { authorization: `Bearer ${f.token}` };
  const payload = async (base: string, target: string) => {
    const response = await fetch(`${base}${target}`);
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    assert.equal((await fetch(`${shared.baseUrl}/api/projects`)).status, 401);
    const before = fs.readFileSync(f.current);
    for (const route of ["/api/projects", detailPath(first.id)]) {
      const response = await fetch(`${shared.baseUrl}${route}`, { headers });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "login_required" });
    }
    assert.deepEqual(fs.readFileSync(f.current), before);
    const activityPath = `/api/repositories/${first.id}/activity`;
    const activity = await payload(local.baseUrl, `${activityPath}?limit=1`);
    assert.deepEqual(
      activity.sources.map(
        (source: { repositoryId: string }) => source.repositoryId,
      ),
      [first.id],
    );
    const activityTool = await (
      await call(mcpBase, hosted.mcpToken, EXECUTION_ACTIVITY_TOOL, {
        repositoryId: first.id,
        projectId,
        limit: 1,
      })
    ).json();
    assert.deepEqual(activity, activityTool.result.structuredContent);
    assert.equal((await fetch(`${shared.baseUrl}${activityPath}`)).status, 403);
    assert.equal(
      (await fetch(`${shared.baseUrl}${activityPath}`, { headers })).status,
      403,
    );
    assert.equal(
      (await fetch(`${local.baseUrl}${activityPath}?limit=1&limit=2`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${local.baseUrl}/api/repositories/${second.id}/activity`))
        .status,
      404,
    );
    const mcpList = await (
      await call(mcpBase, hosted.mcpToken, MCP_PROJECT_CONTEXT_LIST_TOOL)
    ).json();
    const list = mcpList.result.structuredContent;
    assert.equal(list.projects[0].sourceCount, 2);
    assert.deepEqual(
      [...list.projects[0].repositoryIds].sort(),
      [first.id, second.id].sort(),
    );
    for (const id of list.projects[0].repositoryIds as string[]) {
      const mcpDetail = await (
        await call(mcpBase, hosted.mcpToken, MCP_PROJECT_CONTEXT_GET_TOOL, {
          projectId,
          repositoryId: id,
        })
      ).json();
      const detail = mcpDetail.result.structuredContent.project;
      assert.deepEqual(
        detail.sources.map(
          ({ repositoryId }: { repositoryId: string }) => repositoryId,
        ),
        [id],
      );
    }
    const denied = await (
      await call(mcpBase, hosted.mcpToken, MCP_PROJECT_CONTEXT_GET_TOOL, {
        projectId,
        repositoryId: "repository.unknown",
      })
    ).json();
    assert.equal(
      denied.result.structuredContent.reason,
      "project_context_not_available",
    );
    const missingId = await (
      await call(mcpBase, hosted.mcpToken, MCP_PROJECT_CONTEXT_GET_TOOL, {
        projectId,
      })
    ).json();
    assert.equal(missingId.error.code, -32602);
    assert.equal(
      (await payload(local.baseUrl, "/api/projects")).projects[0].sourceCount,
      1,
    );
    assert.equal(
      (await payload(local.baseUrl, detailPath(first.id))).sources[0]
        .repositoryId,
      first.id,
    );
    assert.equal(
      (await fetch(`${local.baseUrl}${detailPath(second.id)}`)).status,
      404,
    );
    assert.equal(
      (await fetch(`${local.baseUrl}${detailPath(first.id, "project.other")}`))
        .status,
      404,
    );
    hosted.permissions.delete(second.id);
    const listedAgain = await (
      await call(mcpBase, hosted.mcpToken, MCP_PROJECT_CONTEXT_LIST_TOOL)
    ).json();
    assert.deepEqual(
      listedAgain.result.structuredContent.projects[0].repositoryIds,
      [first.id],
    );

    const owned = fs.readFileSync(first.body, "utf8");
    fs.writeFileSync(
      first.body,
      owned.replace(
        `Repository ID: ${first.id}`,
        `Repository ID: ${second.id}`,
      ),
    );
    assert.equal(
      (await fetch(`${local.baseUrl}${detailPath(first.id)}`)).status,
      503,
    );
    assert.equal(
      (await fetch(`${local.baseUrl}${detailPath(second.id)}`)).status,
      404,
    );
    const foreign = path.join(second.target, "external-project-context.md");
    fs.writeFileSync(foreign, owned);
    fs.rmSync(first.body);
    fs.symlinkSync(foreign, first.body, "file");
    const linked = await fetch(`${local.baseUrl}${detailPath(first.id)}`);
    assert.equal(linked.status, 503);
    assert.deepEqual(await linked.json(), {
      error: "project_context_unavailable",
    });
  } finally {
    await Promise.all([local.close(), shared.close()]);
  }
});

test("Gitホストでの実行監視は無関係な管理改訂・対象差・失効・観測不能を区別する", async (t) => {
  const f = hostedFixture(t);
  const [target, other] = f.targets;
  assert.ok(target && other);
  const signal = new AbortController().signal;
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const kdf = t.mock.method(crypto, "scryptSync");
  let browserSessionCurrent = true;
  let openedMonitors = 0;
  let credentialsRead = 0;
  const session: Parameters<typeof openHostedExecutionAccess>[1] = {
    principal: {
      kind: "account",
      userId: f.userId,
      bindingId: f.bindingId,
      expiresAt: Date.now() + 60_000,
    },
    readGitHost: f.hostAccess.readGitHost,
    repositoryScope: f.repositoryScope,
    isCurrent: () => browserSessionCurrent,
    readHostToken: (host) => {
      credentialsRead++;
      return f.hostAccess.read(host, "fixture-reference", {
        userId: f.userId,
        bindingId: f.bindingId,
      });
    },
    openExecution: () => {
      openedMonitors++;
      return {
        accountId: "fixture-account",
        observePermission: async ({ reference, accountId }) => {
          assert.equal(accountId, "fixture-account");
          const permission = f.permissions.get(reference.repositoryId);
          return permission === "unavailable"
            ? "unavailable"
            : {
                permission: permission ?? "none",
                repositoryName: `fixture/${reference.repositoryId}`,
              };
        },
      };
    },
  };
  assert.equal(
    await Reflect.apply(openHostedExecutionAccess, undefined, [
      f.root,
      session,
      target.id,
      { projectId: "project.fixture" },
      signal,
    ]),
    null,
  );
  assert.equal(credentialsRead, 0);
  assert.equal(openedMonitors, 0);
  const access = await openHostedExecutionAccess(
    f.root,
    session,
    target.id,
    { projectId: "project.fixture", permission: "write" },
    signal,
  );
  assert.ok(access);
  assert.equal(access.principalId, f.userId);
  assert.equal(openedMonitors, 1);
  f.permissions.set(target.id, "read");
  assert.equal(await access.refresh(signal), "revoked");
  assert.equal(
    await openHostedExecutionAccess(
      f.root,
      session,
      target.id,
      { projectId: "project.fixture", permission: "write" },
      signal,
    ),
    null,
  );
  assert.equal(openedMonitors, 1);
  const readable = await openHostedExecutionAccess(
    f.root,
    session,
    target.id,
    { projectId: null, permission: "read" },
    signal,
  );
  assert.ok(readable);
  assert.equal(readable.projectId, "project.fixture");
  assert.equal(await readable.refresh(signal), "current");
  assert.equal(readable.authorizeRequest(), true);
  browserSessionCurrent = false;
  assert.equal(readable.authorizedAtAdmission(), false);
  assert.equal(readable.authorizeRequest(), false);
  assert.equal(await readable.refresh(signal), "current");
  f.permissions.delete(target.id);
  assert.equal(await readable.refresh(signal), "revoked");
  readable.close?.();
  browserSessionCurrent = true;
  f.permissions.set(target.id, "write");
  await t.test(
    "共有の単発実行はログアウトだけでは取り消さず、連携解除で止まる",
    async () => {
      const revocation = new AbortController();
      let active: AbortSignal | undefined;
      let release: (() => void) | undefined;
      const joined = new Promise<void>((resolve) => {
        release = resolve;
      });
      let closed = 0;
      const broker = createHostedAiSessions(
        (_repo, _project, _principal, authorize) => ({
          async start(command, runSignal, admit) {
            assert.equal(admit?.(), true);
            assert.equal(authorize(), true);
            active = runSignal;
            runSignal?.addEventListener("abort", () => release?.(), {
              once: true,
            });
            return {
              status: "accepted",
              requestId: command.requestId,
              reason: null,
            };
          },
          async observe() {
            throw Error("unexpected_observe");
          },
          async cancel() {
            throw Error("unexpected_cancel");
          },
          async join() {
            await joined;
          },
          async close() {
            release?.();
          },
        }),
      );
      const browser = {
        ...session,
        browserSessionKey: {},
        openExecution: (host: string) => {
          const original = session.openExecution?.(host);
          return original
            ? {
                ...original,
                revocationSignal: revocation.signal,
                close() {
                  closed++;
                },
              }
            : null;
        },
      };
      try {
        const scoped = await broker.open(
          f.root,
          browser,
          target.id,
          "read_only_advice",
          signal,
        );
        assert.ok(scoped);
        assert.equal(
          (
            await scoped.owner.start(
              {
                requestId: "synthetic-monitor",
                mode: "read_only_advice",
                workType: null,
                prompt: "synthetic",
                contextReferences: [],
                allowedPaths: [],
                workspaceId: null,
              },
              signal,
            )
          ).status,
          "accepted",
        );
        scoped.currentId = "synthetic-monitor";
        assert.equal(
          (await broker.open(f.root, browser, target.id, "view", signal))
            ?.currentId,
          "synthetic-monitor",
        );
        const anotherBrowser = { ...browser, browserSessionKey: {} };
        assert.equal(
          await broker.open(f.root, anotherBrowser, target.id, "view", signal),
          null,
        );
        assert.ok(active);
        browserSessionCurrent = false;
        assert.equal(scoped.authorize(), false);
        assert.equal(active.aborted, false);
        assert.equal(
          await broker.open(f.root, browser, target.id, "read", signal),
          null,
        );
        revocation.abort();
        assert.equal(active.aborted, true);
      } finally {
        browserSessionCurrent = true;
        revocation.abort();
        await broker.close();
      }
      assert.equal(closed, 1);
    },
  );
  const write = () => {
    state.operationId = randomUUID();
    state.revision++;
    fs.writeFileSync(f.current, JSON.stringify(state));
  };
  state.registeredRepositories = state.registeredRepositories.filter(
    ({ repositoryId }) => repositoryId !== other.id,
  );
  write();
  assert.equal(access.observe(), "current");
  assert.equal(await access.refresh(signal), "current");

  fs.writeFileSync(f.current, "{");
  assert.equal(access.observe(), "unavailable");
  write();
  const manifestPath = path.join(
    target.target,
    ".crdd",
    "config",
    "repository-manifest.json",
  );
  const manifest = fs.readFileSync(manifestPath, "utf8");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ...JSON.parse(manifest),
      displayName: "変更された対象設定",
    }),
  );
  assert.equal(await access.refresh(signal), "target_changed");
  assert.equal(access.authorizeRequest(), false);
  fs.writeFileSync(manifestPath, manifest);
  f.permissions.set(target.id, "unavailable");
  assert.equal(await access.refresh(signal), "unavailable");
  f.permissions.set(target.id, "read");
  assert.equal(await access.refresh(signal), "revoked");
  state.registeredRepositories = [];
  write();
  assert.equal(access.observe(), "revoked");
  assert.equal(kdf.mock.callCount(), 0);
});

test("共有OAuthの同じListenerで管理者が利用者を招待し、本人が一度だけ紐付ける", async (t) => {
  const f = fixture(t);
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  assert.ok(address && typeof address !== "string");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const googleKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const store = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const administrator = store.users[0];
  assert.ok(administrator);
  administrator.role = "administrator";
  fs.writeFileSync(f.current, JSON.stringify(store));
  const candidate = f.targets[1];
  assert.ok(candidate);
  assert.equal(
    unregisterRepository(
      f.root,
      {
        kind: "account",
        userId: f.userId,
        bindingId: f.bindingId,
        expiresAt: Date.now() + 60_000,
      },
      store.revision,
      randomUUID(),
      candidate.id,
    ).status,
    "completed",
  );
  const correctRemote = "https://github.com/team/project.git";
  const setRemote = (url: string) => {
    const command = spawnSync(
      "git",
      ["-C", candidate.target, "config", "--local", "remote.origin.url", url],
      { encoding: "utf8" },
    );
    assert.equal(command.status, 0, command.stderr);
  };
  setRemote(correctRemote);
  const googleIssuer = "https://accounts.google.com";
  assert.equal(
    linkAccountFromHost(
      f.root,
      administrator.userId,
      { issuer: googleIssuer, subject: "google-admin" },
      store.revision + 1,
    ).status,
    "completed",
  );
  let nonce = "";
  let googleSubject = "google-admin";
  let googleEmail: string | undefined;
  let alterRemote = false;
  let hostedRepositoryName = "Team/Project";
  let hostReads = 0;
  let afterInstallationRead: (() => void) | undefined;
  let canReadHosted = true;
  let canWriteHosted = false;
  let appCanWriteHosted = false;
  let hostedResponseStatus: number | undefined;
  const fetch = globalThis.fetch;
  let googleDiscoveries = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      if (
        url.href ===
        "https://accounts.google.com/.well-known/openid-configuration"
      ) {
        googleDiscoveries++;
        return Response.json({
          issuer: "https://accounts.google.com",
          authorization_endpoint: "https://accounts.google.com/auth",
          token_endpoint: "https://accounts.google.com/token",
          jwks_uri: "https://accounts.google.com/jwks",
          code_challenge_methods_supported: ["S256"],
          id_token_signing_alg_values_supported: ["RS256"],
        });
      }
      if (url.href === `${googleIssuer}/jwks`)
        return Response.json({
          keys: [
            {
              ...googleKeys.publicKey.export({ format: "jwk" }),
              kid: "fixture",
              alg: "RS256",
            },
          ],
        });
      if (url.href === `${googleIssuer}/token`) {
        const encode = (value: object) =>
          Buffer.from(JSON.stringify(value)).toString("base64url");
        const iat = Math.floor(Date.now() / 1_000);
        const payload = `${encode({ alg: "RS256", kid: "fixture" })}.${encode({
          iss: googleIssuer,
          sub: googleSubject,
          aud: "synthetic-google",
          iat,
          exp: iat + 120,
          nonce,
          ...(googleEmail ? { email: googleEmail, email_verified: true } : {}),
        })}`;
        return Response.json({
          access_token: "synthetic-google",
          token_type: "Bearer",
          id_token: `${payload}.${sign("sha256", Buffer.from(payload), googleKeys.privateKey).toString("base64url")}`,
        });
      }
      if (url.href === "https://github.com/login/oauth/access_token")
        return Response.json({
          access_token: "ghu_fixture",
          token_type: "bearer",
          expires_in: 3600,
        });
      if (url.origin === "https://api.github.com") {
        if (url.pathname === "/app/installations/24/access_tokens") {
          assert.deepEqual(JSON.parse(String(init?.body)), {
            repository_ids: [92],
            permissions: { metadata: "read" },
          });
          return Response.json(
            {
              token: "ghs_fixture",
              permissions: { metadata: "read" },
              expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
            },
            { status: 201 },
          );
        }
        if (
          new Headers(init?.headers).get("Authorization") ===
          "Bearer ghs_fixture"
        ) {
          if (url.pathname === "/installation/repositories") {
            afterInstallationRead?.();
            return Response.json({
              total_count: 1,
              repositories: [{ id: 92, full_name: hostedRepositoryName }],
            });
          }
          if (url.pathname === "/user/73")
            return Response.json({ id: 73, login: "fixture-user" });
          assert.equal(
            url.pathname,
            `/repos/${hostedRepositoryName.toLowerCase()}/collaborators/fixture-user/permission`,
          );
          if (hostedResponseStatus === 503)
            return new Response(null, { status: 503 });
          return Response.json({
            permission:
              hostedResponseStatus === 401 || !canReadHosted
                ? "none"
                : canWriteHosted
                  ? "write"
                  : "read",
            user: { id: 73 },
          });
        }
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer ghu_fixture",
        );
        if (url.pathname === "/user") return Response.json({ id: 73 });
        hostReads++;
        if (url.pathname === "/user/installations") {
          afterInstallationRead?.();
          if (hostedResponseStatus !== undefined)
            return new Response(null, { status: hostedResponseStatus });
          return Response.json({
            total_count: 1,
            installations: [
              {
                id: 24,
                account: { login: "Team" },
                permissions: { contents: appCanWriteHosted ? "write" : "read" },
              },
            ],
          });
        }
        assert.equal(url.pathname, "/user/installations/24/repositories");
        if (alterRemote) setRemote("https://github.com/team/other.git");
        return Response.json({
          total_count: 1,
          repositories: [
            {
              id: 92,
              full_name: "Team/Project",
              permissions: { pull: canReadHosted, push: canWriteHosted },
            },
          ],
        });
      }
      assert.equal(
        url.hostname,
        "127.0.0.1",
        "合成応答以外の外部通信を許さない",
      );
      return fetch(input, init);
    },
  );
  const options = {
    port: address.port,
    workingDirectory: path.resolve(import.meta.dirname, "../../../.."),
    localAccessRoot: f.root,
    mcpOAuth: {
      clients: [
        {
          id: "startup-fixture",
          redirects: ["http://127.0.0.1:17888/callback"],
        },
      ],
      verifier: {
        id: "fixture-verifier",
        secret: "synthetic-secret".repeat(3),
      },
      jwks: {
        keys: [
          {
            ...privateKey.export({ format: "jwk" }),
            alg: "RS256" as const,
            use: "sig" as const,
          },
        ],
      },
      cookieKeys: ["synthetic-cookie-key".repeat(3)],
    },
  };
  await assert.rejects(
    startCrddServer(options),
    /mcp_oauth_configuration_invalid/u,
  );
  await assert.rejects(
    startCrddServer({
      ...options,
      loginProviders: null,
    } as unknown as Parameters<typeof startCrddServer>[0]),
    /mcp_oauth_configuration_invalid/u,
  );
  const { mcpOAuth: _mcpOAuth, ...workbenchOnly } = options;
  await assert.rejects(
    startCrddServer({
      ...workbenchOnly,
      loginProviders: {
        google: {
          clientId: "synthetic-google",
          clientSecret: "synthetic-google-secret",
        },
      },
    }),
    /mcp_oauth_configuration_required/u,
  );
  await assert.rejects(
    startCrddServer(workbenchOnly),
    /mcp_oauth_configuration_required/u,
  );
  const sharedIdentity = {
    loginProviders: {
      google: {
        clientId: "synthetic-google",
        clientSecret: "synthetic-google-secret",
      },
    },
    sharedRepositoryRoots: [f.directory],
    gitHosts: [
      {
        host: "github.com",
        provider: "github",
        providerData: {
          clientId: "synthetic-app",
          clientSecret: "synthetic-app-secret",
          privateKey: privateKey
            .export({ format: "pem", type: "pkcs1" })
            .toString(),
        },
      },
    ],
  };
  await assert.rejects(
    startCrddServer({
      ...options,
      ...sharedIdentity,
      sharedRepositoryRoots: [],
    }),
    /shared_repository_roots_invalid/u,
  );
  await assert.rejects(
    startCrddServer({
      ...workbenchOnly,
      ...sharedIdentity,
      mcpOAuth: null,
    } as unknown as Parameters<typeof startCrddServer>[0]),
    /mcp_oauth_configuration_invalid/u,
  );
  await assert.rejects(
    startCrddServer({
      ...options,
      ...sharedIdentity,
      localAccessRoot: null,
    } as unknown as Parameters<typeof startCrddServer>[0]),
    /workbench_shared_access_required/u,
  );
  for (const gitHosts of [undefined, []]) {
    await assert.rejects(
      startCrddServer({
        ...options,
        loginProviders: {
          google: {
            clientId: "synthetic-google",
            clientSecret: "synthetic-google-secret",
          },
        },
        ...(gitHosts === undefined ? {} : { gitHosts }),
      }),
      /git_hosts_configuration_required/u,
    );
  }
  assert.equal(googleDiscoveries, 0);
  const { createObjectiveRuns } = await import(
    "../../src/service/execution.ts"
  );
  const objectiveRuns = createObjectiveRuns();
  let aiStarts = 0;
  let aiCancels = 0;
  const server = await startCrddServer(
    {
      ...options,
      ...sharedIdentity,
      sharedAiRequestsFactory: (
        _repository,
        _projectId,
        _principalId,
        authorize,
      ) => {
        let requestId: string | null = null;
        let settle: (() => void) | undefined;
        const completion = new Promise<void>((resolve) => {
          settle = resolve;
        });
        let cancelled = false;
        const read = (id: string): AiRequestSnapshot => ({
          requestId: id,
          mode: id === requestId ? "read_only_advice" : null,
          executionSelection: null,
          status:
            id !== requestId ? "unknown" : cancelled ? "cancelled" : "running",
          reason: id === requestId ? null : "coordinator_task_not_available",
          facts: [],
          resultAvailable: false,
          sharedAnalysis: [],
          additionalInferences: [],
          nextOptions: [],
          candidate: null,
        });
        return {
          async start(command, signal, admissionCurrent) {
            assert.ok(authorize());
            assert.equal(admissionCurrent?.(), true);
            assert.equal(command.mode, "read_only_advice");
            requestId = command.requestId;
            aiStarts++;
            signal?.addEventListener("abort", () => settle?.(), {
              once: true,
            });
            return { status: "accepted", requestId, reason: null };
          },
          async observe(id) {
            assert.ok(authorize());
            return read(id);
          },
          async cancel(id) {
            assert.ok(authorize());
            aiCancels++;
            cancelled = true;
            settle?.();
            return read(id);
          },
          async join() {
            await completion;
          },
          async close() {
            settle?.();
          },
        };
      },
    },
    objectiveRuns,
  );
  try {
    assert.equal(googleDiscoveries, 1);
    const discovery = await fetch(
      `${server.baseUrl}/.well-known/oauth-protected-resource/mcp`,
    );
    assert.equal(discovery.status, 200);
    assert.deepEqual((await discovery.json()).authorization_servers, [
      `${server.baseUrl}/`,
    ]);
    const issuer = await fetch(
      `${server.baseUrl}/.well-known/oauth-authorization-server`,
    );
    assert.equal(issuer.status, 200);
    assert.equal(
      (await issuer.json()).introspection_endpoint,
      `${server.baseUrl}/oauth/introspect`,
    );
    const denied = await call(server.baseUrl, f.token);
    assert.equal(denied.status, 401);
    assert.equal(
      denied.headers.get("www-authenticate"),
      `Bearer resource_metadata="${server.baseUrl}/.well-known/oauth-protected-resource/mcp", error="invalid_token"`,
    );
    assert.equal((await fetch(`${server.baseUrl}/api/session`)).status, 401);
    const web = (route: string, init: RequestInit = {}) =>
      fetch(new URL(route, server.baseUrl), { ...init, redirect: "manual" });
    const login = async (token?: string) => {
      const started = await web(
        token
          ? "/api/session/login/google/invitation"
          : "/api/session/login/google",
        {
          method: "POST",
          headers: { origin: server.baseUrl },
          ...(token
            ? { body: new URLSearchParams({ invitation: token }) }
            : {}),
        },
      );
      assert.equal(started.status, 303);
      const location = new URL(started.headers.get("location") ?? "");
      nonce = location.searchParams.get("nonce") ?? "";
      const state = location.searchParams.get("state");
      assert.ok(nonce && state);
      const proofCookie = started.headers.getSetCookie()[0]?.split(";")[0];
      assert.ok(proofCookie);
      return web(
        `/api/session/login/google/callback?${new URLSearchParams({ state, code: "synthetic" })}`,
        {
          headers: { cookie: proofCookie },
        },
      );
    };
    const sessionCookie = (response: Response) => {
      assert.equal(response.status, 303);
      const cookie = response.headers
        .getSetCookie()
        .find((header) => header.startsWith("crdd-client-session="))
        ?.split(";")[0];
      assert.ok(cookie);
      return cookie;
    };
    const adminCookie = sessionCookie(await login());
    assert.equal(
      (await web("/api/users", { headers: { cookie: adminCookie } })).status,
      401,
    );
    const management = async () => {
      const started = await web("/api/session/management", {
        method: "POST",
        headers: {
          origin: server.baseUrl,
          cookie: adminCookie,
        },
      });
      assert.equal(started.status, 204);
      const grant = started.headers.getSetCookie()[0]?.split(";")[0];
      assert.ok(grant);
      return `${adminCookie}; ${grant}`;
    };
    const oldCookie = await management();
    const oldForm = (await (
      await web("/api/users", { headers: { cookie: oldCookie } })
    ).json()) as { formToken: string };
    const adminSession = await management();
    const list = await web("/api/users", { headers: { cookie: adminSession } });
    assert.equal(list.status, 200);
    const { revision, formToken } = (await list.json()) as {
      revision: number;
      formToken: string;
    };
    const body = {
      username: "招待利用者",
      role: "developer",
      email: "invite@example.test",
      expectedRevision: revision,
      operationId: randomUUID(),
    };
    const inviteUser = (headers: Record<string, string>, token = formToken) =>
      web("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ ...body, formToken: token }),
      });
    assert.equal(
      (
        await inviteUser({
          origin: server.baseUrl,
          authorization: `Bearer ${f.token}`,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await inviteUser({
          origin: "https://other.example",
          cookie: adminSession,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await inviteUser(
          { origin: server.baseUrl, cookie: adminSession },
          oldForm.formToken,
        )
      ).status,
      401,
    );
    for (const invalidType of ["text/plain", "application/json, text/plain"]) {
      const rejected = await inviteUser({
        origin: server.baseUrl,
        cookie: adminSession,
        "content-type": invalidType,
      });
      assert.equal(rejected.status, 415);
    }
    const duplicateTypeStatus = await new Promise<number | undefined>(
      (resolve, reject) => {
        const incoming = httpRequest(
          new URL("/api/users", server.baseUrl),
          {
            method: "POST",
            headers: [
              "Host",
              new URL(server.baseUrl).host,
              "Origin",
              server.baseUrl,
              "Cookie",
              adminSession,
              "Content-Type",
              "application/json",
              "Content-Type",
              "application/json",
            ],
          },
          (reply) => {
            reply.resume();
            resolve(reply.statusCode);
          },
        );
        incoming.on("error", reject);
        incoming.end(JSON.stringify({ ...body, formToken }));
      },
    );
    assert.equal(duplicateTypeStatus, 415);
    const created = await inviteUser({
      origin: server.baseUrl,
      cookie: adminSession,
      "content-type": "application/json ; charset=utf-8",
    });
    assert.equal(created.status, 201);
    assert.match(created.headers.get("cache-control") ?? "", /no-store/u);
    const record = (await created.json()) as {
      result: { userId: string; revision: number };
      invitation: { url: string };
    };
    const inviteUrl = new URL(record.invitation.url);
    assert.equal(inviteUrl.origin, server.baseUrl);
    const invite = /^#invite=([A-Za-z0-9_-]{43})$/u.exec(inviteUrl.hash)?.[1];
    assert.ok(invite);
    assert.equal(fs.readFileSync(f.current, "utf8").includes(invite), false);
    const duplicate = await inviteUser({
      origin: server.baseUrl,
      cookie: adminSession,
    });
    assert.equal(duplicate.status, 403);
    assert.equal((await duplicate.text()).includes(invite), false);
    const conflict = {
      status: "rejected",
      reason: "management_revision_conflict",
    };
    const beforeStaleInvitation = fs.readFileSync(f.current);
    const staleInvite = await web("/api/users", {
      method: "POST",
      headers: {
        cookie: adminSession,
        origin: server.baseUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, operationId: randomUUID(), formToken }),
    });
    assert.equal(staleInvite.status, 409);
    assert.deepEqual(await staleInvite.json(), conflict);
    const renew = (expectedRevision: number) =>
      web(`/api/users/${record.result.userId}/invitations`, {
        method: "POST",
        headers: {
          origin: server.baseUrl,
          cookie: adminSession,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "invite@example.test",
          expectedRevision,
          operationId: randomUUID(),
          formToken,
        }),
      });
    const staleRenewal = await renew(revision);
    assert.equal(staleRenewal.status, 409);
    assert.deepEqual(await staleRenewal.json(), conflict);
    assert.deepEqual(fs.readFileSync(f.current), beforeStaleInvitation);
    const renewed = await renew(record.result.revision);
    assert.equal(renewed.status, 201);
    const renewedRecord = (await renewed.json()) as typeof record;
    assert.equal(renewedRecord.result.userId, record.result.userId);
    const newInvite = /^#invite=([A-Za-z0-9_-]{43})$/u.exec(
      new URL(renewedRecord.invitation.url).hash,
    )?.[1];
    assert.ok(newInvite && newInvite !== invite);

    googleSubject = "google-invitee";
    googleEmail = "wrong@example.test";
    assert.equal((await login(newInvite)).status, 403);
    googleEmail = "invite@example.test";
    assert.equal((await login(invite)).status, 403);
    const invitedCookie = sessionCookie(await login(newInvite));
    assert.equal((await login(newInvite)).status, 403);
    const me = await web("/api/session", {
      headers: { cookie: invitedCookie },
    });
    assert.deepEqual(await me.json(), {
      username: "招待利用者",
      role: "developer",
    });
    const currentUsers = await web("/api/users", {
      headers: { cookie: adminSession },
    });
    const { revision: afterLogin } = (await currentUsers.json()) as {
      revision: number;
    };
    assert.equal((await renew(afterLogin)).status, 403);
    const registration = (
      expectedRevision = afterLogin,
      operationId: string = randomUUID(),
    ) =>
      web("/api/repositories", {
        method: "POST",
        headers: {
          origin: server.baseUrl,
          cookie: adminSession,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          repositoryId: candidate.id,
          directory: candidate.target,
          expectedRevision,
          operationId,
          formToken,
        }),
      });
    const oldHeaders = { authorization: `Bearer ${f.token}` };
    const oldView = await web("/api/workbench/view", { headers: oldHeaders });
    assert.equal(oldView.status, 403);
    assert.deepEqual(await oldView.json(), { error: "request_rejected" });
    const publicView = await web("/api/workbench/view");
    assert.equal(publicView.status, 200);
    const { actionToken, authenticated, loginProviders } =
      (await publicView.json()) as {
        actionToken: string;
        authenticated: boolean;
        loginProviders?: unknown;
      };
    assert.match(actionToken, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(authenticated, false);
    assert.deepEqual(loginProviders, [{ id: "google", displayName: "Google" }]);
    const beforeLegacyRegistration = fs.readFileSync(f.current);
    assert.equal(
      (
        await web("/api/access/connection", {
          method: "POST",
          headers: { origin: server.baseUrl },
          body: new URLSearchParams({
            actionToken,
            operation: "connect",
            token: f.token,
          }),
        })
      ).status,
      404,
    );
    assert.equal(
      (await web("/api/projects", { headers: oldHeaders })).status,
      403,
    );
    const legacyRegistration = await web("/api/access", {
      method: "POST",
      headers: { ...oldHeaders, origin: server.baseUrl },
      body: new URLSearchParams({
        operation: "registerRepository",
        actionToken,
        expectedRevision: String(afterLogin),
        operationId: randomUUID(),
        repositoryId: candidate.id,
        repositoryRoot: candidate.target,
      }),
    });
    assert.equal(legacyRegistration.status, 403);
    assert.deepEqual(await legacyRegistration.json(), {
      error: "request_rejected",
    });
    for (const [method, path] of [
      ["GET", "/api/access?view=users"],
      ["POST", "/api/access"],
      ["POST", "/api/access/credentials"],
    ] as const) {
      const retired = await web(path, {
        method,
        headers: { cookie: adminSession, origin: server.baseUrl },
      });
      assert.equal(retired.status, 404, path);
      assert.equal(await retired.text(), "", path);
    }
    assert.deepEqual(fs.readFileSync(f.current), beforeLegacyRegistration);
    assert.equal((await registration()).status, 403);
    assert.equal(hostReads, 0);
    const connect = await web("/api/session/git/github", {
      method: "POST",
      headers: {
        origin: server.baseUrl,
        cookie: adminSession,
      },
    });
    assert.equal(connect.status, 303);
    const hostState = new URL(
      connect.headers.get("location") ?? "",
    ).searchParams.get("state");
    assert.ok(hostState);
    const linked = await web(
      `/api/session/git/github/callback?${new URLSearchParams({ state: hostState, code: "synthetic" })}`,
      { headers: { cookie: adminSession } },
    );
    assert.equal(linked.status, 303);
    const beforeRegistration = fs.readFileSync(f.current);
    const readsBeforeUnconfigured = hostReads;
    const staleRegistration = await registration(afterLogin - 1);
    assert.equal(staleRegistration.status, 409);
    assert.deepEqual(await staleRegistration.json(), conflict);
    const sameOperation = (
      JSON.parse(beforeRegistration.toString("utf8")) as AccessManagementState
    ).operationId;
    for (const rejectedRegistration of [
      await registration(afterLogin - 1, sameOperation),
      await registration(afterLogin + 1),
    ]) {
      assert.equal(rejectedRegistration.status, 403);
      assert.deepEqual(await rejectedRegistration.json(), {
        status: "rejected",
        reason: "management_request_rejected",
      });
    }
    assert.equal(hostReads, readsBeforeUnconfigured);
    assert.deepEqual(fs.readFileSync(f.current), beforeRegistration);
    setRemote("https://unconfigured.example.test/team/project.git");
    assert.equal((await registration()).status, 403);
    assert.equal(hostReads, readsBeforeUnconfigured);
    assert.deepEqual(fs.readFileSync(f.current), beforeRegistration);
    setRemote(correctRemote);
    alterRemote = true;
    assert.notEqual((await registration()).status, 201);
    assert.deepEqual(fs.readFileSync(f.current), beforeRegistration);
    alterRemote = false;
    setRemote(correctRemote);
    const attached = await registration();
    assert.equal(attached.status, 201);
    assert.equal((await attached.text()).includes("ghu_fixture"), false);
    const stateAfter = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    assert.deepEqual(
      stateAfter.registeredRepositories.find(
        (entry) => entry.repositoryId === candidate.id,
      )?.hostedRepository,
      {
        provider: "github",
        host: "github.com",
        repositoryId: "92",
        providerData: { installationId: "24" },
      },
    );
    assert.equal(Object.hasOwn(stateAfter, "exposure"), false);
    assert.equal(hostReads, 4);
    const detail = `/api/repositories/${candidate.id}/projects/project.fixture/context`;
    assert.equal((await web(detail)).status, 401);
    assert.equal(
      (await web(detail, { headers: { cookie: invitedCookie } })).status,
      404,
    );
    const projects = async () =>
      (
        await web("/api/projects", { headers: { cookie: adminSession } })
      ).json();
    assert.deepEqual((await projects()).projects, [
      {
        projectId: "project.fixture",
        state: "complete",
        sourceCount: 1,
        repositoryIds: [candidate.id],
      },
    ]);
    const context = await web(detail, { headers: { cookie: adminSession } });
    assert.equal(context.status, 200);
    const project = await context.json();
    const activityPath = `/api/repositories/${candidate.id}/activity?limit=1`;
    const httpActivity = await web(activityPath, {
      headers: { cookie: adminSession },
    });
    assert.equal(httpActivity.status, 200);
    const beforeMixedProject = hostReads;
    for (const route of ["/api/projects", detail, activityPath]) {
      assert.equal(
        (await web(route, { headers: { ...oldHeaders, cookie: adminSession } }))
          .status,
        403,
      );
    }
    assert.equal(hostReads, beforeMixedProject);
    assert.equal(project.sources[0]?.repositoryId, candidate.id);
    const workbenchView = (
      id: string | null,
      cookie: string = adminSession,
      init: RequestInit = {},
    ) =>
      web(
        `/api/workbench/view?route=%2F${id === null ? "" : `&repositoryId=${encodeURIComponent(id)}`}`,
        {
          ...init,
          headers: { ...init.headers, cookie },
        },
      );
    await t.test(
      "共有AI依頼は本人の読取りで助言を開始し、別の本人を拒否する",
      async () => {
        const resource = `/api/repositories/${candidate.id}/ai-requests`;
        const id = "oauth-advice";
        const writeRequest = (
          route: string,
          body: object,
          cookie: string = adminSession,
        ) =>
          web(route, {
            method: "POST",
            headers: {
              cookie,
              origin: server.baseUrl,
              "content-type": "application/json",
              "x-crdd-action-token": actionToken,
            },
            body: JSON.stringify(body),
          });
        const readable = await workbenchView(candidate.id);
        assert.equal(readable.status, 200);
        assert.equal((await readable.json()).aiRequest.configured, true);
        const command = {
          requestId: id,
          mode: "read_only_advice",
          prompt: "合成入力",
        };
        assert.equal(
          (await writeRequest(resource, command, invitedCookie)).status,
          403,
        );
        assert.equal(
          (
            await writeRequest(resource, {
              ...command,
              mode: "workspace_edit",
              workType: "feature",
              workspaceId: "unrelated",
              allowedPaths: "README.md",
            })
          ).status,
          403,
        );
        assert.equal(aiStarts, 0);
        assert.equal((await writeRequest(resource, command)).status, 201);
        assert.equal(aiStarts, 1);
        const observed = await web(`${resource}/${id}`, {
          headers: { cookie: adminSession },
        });
        assert.equal(observed.status, 200);
        assert.equal((await observed.json()).requestId, id);
        const current = await web(resource.slice(0, -1), {
          headers: { cookie: adminSession },
        });
        assert.equal(current.status, 200);
        assert.equal((await current.json()).requestId, id);
        assert.notEqual(
          (
            await web(`${resource}/${id}`, {
              headers: { cookie: invitedCookie },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await writeRequest(
              `${resource}/${id}/cancellation`,
              {},
              invitedCookie,
            )
          ).status,
          403,
        );
        assert.equal(aiCancels, 0);
        assert.equal(
          (await writeRequest(`${resource}/${id}/cancellation`, {})).status,
          200,
        );
        assert.equal(aiCancels, 1);
      },
    );
    await t.test(
      "WorkbenchのGoogle画面は、選択した現在認可の作業領域を投影する",
      async () => {
        const portfolioView = await workbenchView(null);
        assert.equal(portfolioView.status, 200);
        const portfolio = await portfolioView.json();
        assert.equal(portfolio.authenticated, true);
        assert.deepEqual(portfolio.loginProviders, [
          { id: "google", displayName: "Google" },
        ]);
        assert.equal(Object.hasOwn(portfolio, "credentials"), false);
        assert.ok(
          portfolio.portfolio.projects.some(
            (project: { sources: { repositoryId: string }[] }) =>
              project.sources.some(
                ({ repositoryId }) => repositoryId === candidate.id,
              ),
          ),
        );
        const initialHostReads = hostReads;
        const previousUserWrite = canWriteHosted;
        const previousAppWrite = appCanWriteHosted;
        try {
          canWriteHosted = true;
          appCanWriteHosted = true;
          const selected = await workbenchView(candidate.id);
          assert.equal(selected.status, 200);
          const value = await selected.json();
          assert.equal(value.selectedRepositoryId, candidate.id);
          assert.equal(Object.hasOwn(value, "credentials"), false);
          assert.equal(value.workspaceAccess, "write");
          assert.equal(value.recordActionsConfigured, true);
          assert.deepEqual(value.repositoryActions, ["prepare", "unprepare"]);
          assert.equal(value.aiRequest.configured, true);
          assert.equal(hostReads - initialHostReads, 2);
          appCanWriteHosted = false;
          const readOnly = await workbenchView(candidate.id);
          assert.equal(readOnly.status, 200);
          const view = await readOnly.json();
          assert.equal(view.workspaceAccess, "read");
          assert.equal(view.recordActionsConfigured, false);
          assert.deepEqual(view.repositoryActions, []);
        } finally {
          canWriteHosted = previousUserWrite;
          appCanWriteHosted = previousAppWrite;
        }
        const beforeRefusals = hostReads;
        assert.equal(
          (await workbenchView(candidate.id, invitedCookie)).status,
          403,
        );
        assert.equal(
          (
            await workbenchView(candidate.id, adminSession, {
              headers: oldHeaders,
            })
          ).status,
          403,
        );
        assert.equal((await workbenchView("repository.unknown")).status, 403);
        const noLink = await workbenchView(null, invitedCookie);
        assert.equal(noLink.status, 200);
        const noLinkView = await noLink.json();
        assert.equal(noLinkView.view, "access");
        assert.equal(noLinkView.portfolio, null);
        assert.equal(hostReads, beforeRefusals);

        const previousRead = canReadHosted;
        try {
          canReadHosted = false;
          const denied = await workbenchView(null);
          assert.equal(denied.status, 200);
          const closed = await denied.json();
          assert.equal(closed.view, "access");
          assert.equal(closed.portfolio, null);
          assert.equal(
            (await web("/api/session", { headers: { cookie: adminCookie } }))
              .status,
            200,
          );
        } finally {
          canReadHosted = previousRead;
        }
        const beforeLocalRefusals = hostReads;
        const local = f.targets[0];
        assert.ok(local);
        const localView = await workbenchView(local.id, invitedCookie);
        assert.equal(localView.status, 403);
        const localSelection = `/api/repositories/${local.id}/ai-selection`;
        assert.equal(
          (await web(localSelection, { headers: { cookie: invitedCookie } }))
            .status,
          403,
        );
        assert.equal(
          (await web(localSelection, { headers: { cookie: adminCookie } }))
            .status,
          403,
        );
        assert.equal(hostReads, beforeLocalRefusals);
        const now = Date.now;
        let expired = false;
        const clock = t.mock.method(
          Date,
          "now",
          () => now() + (expired ? 24 * 60 * 60_000 : 0),
        );
        const openFile = fs.openSync;
        let manifestReads = 0;
        const boundary = t.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof openFile>) => {
            const fd = openFile(...args);
            if (
              args[0] ===
                path.join(
                  candidate.target,
                  ".crdd/config/repository-manifest.json",
                ) &&
              ++manifestReads === 2
            )
              expired = true;
            return fd;
          },
        );
        try {
          const outdated = await workbenchView(candidate.id, adminCookie);
          assert.equal(manifestReads, 2);
          assert.equal(outdated.status, 403);
          assert.equal(
            await outdated.text(),
            "local_repository_access_unavailable\n",
          );
        } finally {
          boundary.mock.restore();
          clock.mock.restore();
        }
      },
    );
    setRemote("https://github.com/team/other.git");
    assert.equal(
      (await web(detail, { headers: { cookie: adminSession } })).status,
      503,
    );
    setRemote(correctRemote);

    // 同じディレクトリでも、本文読取り中にローカルの接続先が変われば応答しない。
    const openSync = fs.openSync;
    let changedWhileReading = false;
    let contextReads = 0;
    const replaceOrigin = t.mock.method(
      fs,
      "openSync",
      (
        file: Parameters<typeof openSync>[0],
        flags?: Parameters<typeof openSync>[1],
        mode?: Parameters<typeof openSync>[2],
      ) => {
        const fd = openSync(file, flags ?? "r", mode);
        if (
          typeof file === "string" &&
          file === path.join(candidate.target, "PROJECT_CONTEXT.md")
        ) {
          contextReads++;
          if (!changedWhileReading) {
            changedWhileReading = true;
            setRemote("https://github.com/team/other.git");
          }
        }
        return fd;
      },
    );
    try {
      assert.equal(
        (await web(detail, { headers: { cookie: adminSession } })).status,
        503,
      );
      assert.equal(changedWhileReading, true);
      setRemote(correctRemote);
      changedWhileReading = false;
      contextReads = 0;
      const rejectedView = await workbenchView(candidate.id);
      assert.equal(rejectedView.status, 403);
      assert.equal(
        await rejectedView.text(),
        "local_repository_access_unavailable\n",
      );
      assert.equal(changedWhileReading, true);
      assert.equal(contextReads, 1);
    } finally {
      replaceOrigin.mock.restore();
      setRemote(correctRemote);
    }

    const hostedRegistration = stateAfter.registeredRepositories.find(
      ({ repositoryId }) => repositoryId === candidate.id,
    );
    assert.ok(hostedRegistration);
    const readFixtureAccess = (): AccessManagementState =>
      JSON.parse(fs.readFileSync(f.current, "utf8"));
    const removeHostedRegistration = () => {
      const login = readAccount(f.root, {
        issuer: googleIssuer,
        subject: "google-admin",
      });
      if (login.status !== "completed") assert.fail("fixture admin not linked");
      return unregisterRepository(
        f.root,
        {
          kind: "account",
          userId: login.account.userId,
          bindingId: login.account.bindingId,
          expiresAt: Date.now() + 60_000,
        },
        readFixtureAccess().revision,
        randomUUID(),
        candidate.id,
      );
    };
    const restoreHostedRegistration = () => {
      const state = readFixtureAccess();
      assert.equal(
        state.registeredRepositories.some(
          ({ repositoryId }) => repositoryId === candidate.id,
        ),
        false,
      );
      state.registeredRepositories.push(hostedRegistration);
      state.revision++;
      state.operationId = randomUUID();
      fs.writeFileSync(f.current, JSON.stringify(state));
    };
    afterInstallationRead = () => {
      afterInstallationRead = undefined;
      assert.equal(removeHostedRegistration().status, "completed");
    };
    const beforeInterruptedRead = hostReads;
    assert.equal(
      (await web(detail, { headers: { cookie: adminSession } })).status,
      503,
    );
    assert.equal(hostReads - beforeInterruptedRead, 1);
    restoreHostedRegistration();

    let readsBeforeRevocation = 0;
    const revokeWhileProjectReads = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof openSync>) => {
        const fd = openSync(...args);
        if (
          args[0] === path.join(candidate.target, "PROJECT_CONTEXT.md") &&
          ++readsBeforeRevocation === 1
        )
          assert.equal(removeHostedRegistration().status, "completed");
        return fd;
      },
    );
    try {
      const noLongerAllowed = await workbenchView(candidate.id);
      assert.equal(noLongerAllowed.status, 403);
      assert.equal(
        await noLongerAllowed.text(),
        "local_repository_access_unavailable\n",
      );
      assert.equal(readsBeforeRevocation, 1);
    } finally {
      revokeWhileProjectReads.mock.restore();
      restoreHostedRegistration();
    }

    // 非同期のProject本文が開いた後、次のOwner文書バッチへ進む前に登録を解除する。
    const readFileAsync = fs.promises.readFile;
    const lstatAsync = fs.promises.lstat;
    const ownerDocument = path.join(
      candidate.target,
      "99_Roadmap",
      "01_Roadmap.md",
    );
    let revokedAfterAsyncRead = false;
    let ownerObservations = 0;
    const revokeAfterRead = t.mock.method(
      fs.promises,
      "readFile",
      async (...args: Parameters<typeof readFileAsync>) => {
        const value = await readFileAsync(...args);
        if (
          args[0] === path.join(candidate.target, "PROJECT_CONTEXT.md") &&
          !revokedAfterAsyncRead
        ) {
          revokedAfterAsyncRead = true;
          assert.equal(removeHostedRegistration().status, "completed");
        }
        return value;
      },
    );
    const observeOwner = t.mock.method(
      fs.promises,
      "lstat",
      (...args: Parameters<typeof lstatAsync>) => {
        if (args[0] === ownerDocument) ownerObservations++;
        return lstatAsync(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      const denied = await workbenchView(candidate.id);
      assert.equal(denied.status, 403);
      assert.equal(
        await denied.text(),
        "local_repository_access_unavailable\n",
      );
      assert.equal(revokedAfterAsyncRead, true);
      assert.equal(ownerObservations, 0);
    } finally {
      revokeAfterRead.mock.restore();
      observeOwner.mock.restore();
      syncBuiltinESMExports();
      restoreHostedRegistration();
    }

    const origin = new URL(server.baseUrl);
    const mcpConfig = await oidc.discovery(
      origin,
      "startup-fixture",
      undefined,
      oidc.None(),
      { execute: [oidc.allowInsecureRequests] },
    );
    const consentMcp = async (cookie: string) => {
      const verifier = oidc.randomPKCECodeVerifier();
      const state = oidc.randomState();
      const resource = new URL("/mcp", origin).href;
      let next = oidc.buildAuthorizationUrl(mcpConfig, {
        redirect_uri: "http://127.0.0.1:17888/callback",
        scope: mcpScope,
        resource,
        state,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      });
      const cookies = new Map([["crdd-client-session", cookie]]);
      let consented = false;
      for (let hop = 0; next.origin === origin.origin && hop < 12; hop++) {
        const headers = { cookie: [...cookies.values()].join("; ") };
        let response = await web(next.href, { headers });
        if (response.status === 200) {
          const page = await response.text();
          assert.match(page, /閲覧・変更にGitホスト側の権限も必要/u);
          const confirmation =
            /name="confirmation" value="([A-Za-z0-9_-]{43})"/u.exec(page)?.[1];
          assert.ok(confirmation);
          response = await web(next.href, {
            method: "POST",
            headers: { ...headers, origin: origin.origin },
            body: new URLSearchParams({ action: "allow", confirmation }),
          });
          consented = true;
        }
        for (const header of response.headers.getSetCookie()) {
          const pair = header.split(";")[0];
          if (pair) cookies.set(pair.split("=")[0] ?? "", pair);
        }
        const location = response.headers.get("location");
        assert.ok(location, String(response.status));
        next = new URL(location, origin);
      }
      assert.ok(consented);
      assert.equal(next.origin, "http://127.0.0.1:17888");
      const { access_token } = await oidc.authorizationCodeGrant(
        mcpConfig,
        next,
        { expectedState: state, pkceCodeVerifier: verifier },
        { resource },
      );
      return access_token;
    };
    const mcpToken = await consentMcp(adminCookie);
    const mcpActivity = await call(
      server.baseUrl,
      mcpToken,
      EXECUTION_ACTIVITY_TOOL,
      {
        repositoryId: candidate.id,
        projectId: "project.fixture",
        limit: 1,
      },
    );
    assert.equal(mcpActivity.status, 200);
    assert.deepEqual(
      await httpActivity.json(),
      (await mcpActivity.json()).result.structuredContent,
    );
    // 管理Cookie専用の操作トークンを除き、同じ現在認可の読取り結果を返す。
    for (const [route, tool] of [
      ["/api/access/me", MCP_CURRENT_ACCESS_TOOL],
      ["/api/users", MCP_ACCESS_MANAGEMENT_READ_TOOLS.listUsers],
      ["/api/repositories", MCP_ACCESS_MANAGEMENT_READ_TOOLS.listRepositories],
    ] as const) {
      const http = await web(route, { headers: { cookie: adminSession } });
      assert.equal(http.status, 200, route);
      const { formToken, ...expected } = await http.json();
      assert.match(formToken, /^[A-Za-z0-9_-]{43}$/u);
      if (route === "/api/access/me")
        assert.deepEqual(Object.keys(expected).sort(), [
          "revision",
          "status",
          "user",
        ]);
      const mcp = await call(server.baseUrl, mcpToken, tool, {});
      assert.equal(mcp.status, 200, tool);
      assert.deepEqual(
        (await mcp.json()).result.structuredContent,
        expected,
        tool,
      );
    }
    const beforeRetiredReads = fs.readFileSync(f.current);
    for (const [route, tool] of [
      ["/api/roles/content-access", "crdd.list_role_content_access"],
      ["/api/repositories/exposure", "crdd.list_repository_exposure"],
    ] as const) {
      const retired = await web(route, { headers: { cookie: adminSession } });
      assert.ok([403, 404, 405].includes(retired.status), route);
      const response = await (
        await call(server.baseUrl, mcpToken, tool, {})
      ).json();
      assert.equal(response.error.code, -32601);
    }
    assert.deepEqual(fs.readFileSync(f.current), beforeRetiredReads);
    const mcpProjects = async () =>
      (
        await (
          await call(
            server.baseUrl,
            mcpToken,
            MCP_PROJECT_CONTEXT_LIST_TOOL,
            {},
          )
        ).json()
      ).result.structuredContent.projects;
    assert.deepEqual(await mcpProjects(), (await projects()).projects);
    const mcpDetail = async (args: Record<string, unknown>) =>
      (
        await call(server.baseUrl, mcpToken, MCP_PROJECT_CONTEXT_GET_TOOL, args)
      ).json();
    const beforeInvalidDetail = hostReads;
    assert.equal(
      (await mcpDetail({ projectId: "project.fixture" })).error.code,
      -32602,
    );
    assert.equal(
      (
        await mcpDetail({
          repositoryId: "repository.unknown",
          projectId: "project.fixture",
        })
      ).result.structuredContent.reason,
      "project_context_not_available",
    );
    assert.equal(hostReads, beforeInvalidDetail);
    assert.deepEqual(
      (
        await mcpDetail({
          repositoryId: candidate.id,
          projectId: "project.fixture",
        })
      ).result.structuredContent.project,
      project,
    );
    assert.equal(
      (
        await web(detail.replace("project.fixture", "project.other"), {
          headers: { cookie: adminSession },
        })
      ).status,
      404,
    );
    assert.equal(
      createTopicOperations(candidate.target, "project.fixture").create(
        topicMarkdown(),
      ).status,
      "completed",
    );
    assert.equal(
      createMeetingOperations(candidate.target, "project.fixture").create(
        meetingMarkdown(),
      ).status,
      "completed",
    );
    const listRecords = (resource: string, suffix = "") =>
      web(`/api/repositories/${candidate.id}/${resource}${suffix}`, {
        headers: { cookie: adminSession },
      });
    const mcpRecord = async (name: string, args: Record<string, unknown>) =>
      (
        await call(server.baseUrl, mcpToken, `crdd.${name}`, {
          repositoryId: candidate.id,
          ...args,
        })
      ).json();
    for (const [resource, kind, id] of [
      ["topics", "topic", "TOPIC-000042"],
      ["meetings", "meeting", "MTG-000042"],
    ] as const) {
      const recordBase: string = `/api/repositories/${candidate.id}/${resource}`;
      const beforeMixedRecords: number = hostReads;
      const recordRoutes: readonly string[] = [
        recordBase,
        `${recordBase}/${id}`,
      ];
      for (const route of recordRoutes) {
        assert.equal(
          (
            await web(route, {
              headers: { ...oldHeaders, cookie: adminSession },
            })
          ).status,
          403,
        );
      }
      assert.equal(hostReads, beforeMixedRecords);
      const page = await listRecords(resource, "?limit=10");
      assert.equal(page.status, 200);
      assert.deepEqual(
        await page.json(),
        (await mcpRecord(`list_${resource}`, { limit: 10 })).result
          .structuredContent,
      );
      const detail = await listRecords(resource, `/${id}`);
      assert.equal(detail.status, 200);
      const record = await detail.json();
      assert.equal(record.relationScope, "repository");
      assert.deepEqual(
        record,
        (await mcpRecord(`get_${kind}`, { id })).result.structuredContent,
      );
    }
    const local = f.targets[0];
    assert.ok(local);
    assert.equal(
      createTopicOperations(local.target, "project.fixture").create(
        topicMarkdown(),
      ).status,
      "completed",
    );
    const beforeLocalRead = hostReads;
    const localRead = await mcpRecord("get_topic", {
      repositoryId: local.id,
      id: "TOPIC-000042",
    });
    assert.equal(localRead.error.code, -32602);
    assert.equal(localRead.result, undefined);
    assert.equal(hostReads, beforeLocalRead);
    {
      let nonHostedReads = 0;
      const open = fs.openSync;
      const observe = t.mock.method(
        fs,
        "openSync",
        (...args: Parameters<typeof open>) => {
          if (
            args[0] ===
            path.join(local.target, ".crdd/config/repository-manifest.json")
          )
            nonHostedReads++;
          return open(...args);
        },
      );
      try {
        const activityWithoutTarget = await (
          await call(server.baseUrl, mcpToken, "crdd.get_execution_activity", {
            projectId: "project.fixture",
          })
        ).json();
        assert.equal(activityWithoutTarget.result.isError, true);
        assert.deepEqual(activityWithoutTarget.result.structuredContent, {
          status: "unavailable",
          reason: "cros_runtime_activity_unavailable",
        });
        assert.equal(nonHostedReads, 0);
      } finally {
        observe.mock.restore();
      }
    }
    assert.equal(hostReads, beforeLocalRead);

    const accountBinding = (
      JSON.parse(fs.readFileSync(f.current, "utf8")) as AccessManagementState
    ).users.find(({ userId }) => userId === administrator.userId)
      ?.accountLinks?.[0]?.bindingId;
    assert.ok(accountBinding);
    const outer = new AbortController();
    const sdkTool = new AbortController();
    const resolveTestOAuthSource = createOAuthMcpResolver(
      f.root,
      async () => ({
        status: "completed",
        subject: `${administrator.userId}:${accountBinding}`,
        expiresAt: Date.now() + 10_000,
      }),
      {
        hasCurrentToken: () => true,
        readGitHost: readFixtureGitHost,
        repositoryScope: f.repositoryScope,
        readGrantHostReference: (_token, _subject, host) =>
          host === "github.com" ? "fixture-reference" : null,
        read: (host) => (host === "github.com" ? "ghu_fixture" : null),
      },
    );
    const oauthSource = await resolveTestOAuthSource(mcpToken, outer.signal);
    assert.ok(oauthSource);
    const beforeSdkCancel = hostReads;
    afterInstallationRead = () => {
      afterInstallationRead = undefined;
      sdkTool.abort();
    };
    const cancelled = await invokeMcpSource(
      oauthSource,
      packet("crdd.list_topics", { repositoryId: candidate.id }),
      outer.signal,
      sdkTool.signal,
    );
    assert.equal(outer.signal.aborted, false);
    assert.equal(sdkTool.signal.aborted, true);
    assert.equal(hostReads - beforeSdkCancel, 1);
    assert.equal(cancelled, null);

    const beforeInvalidRecord = hostReads;
    assert.equal(
      (await listRecords("meetings", "?occurredFrom=invalid")).status,
      400,
    );
    assert.equal(
      (await mcpRecord("list_meetings", { occurredFrom: "invalid" })).error
        .code,
      -32602,
    );
    assert.equal((await listRecords("topics", "/MTG-000042")).status, 400);
    assert.equal(
      (await mcpRecord("get_topic", { id: "MTG-000042" })).error.code,
      -32602,
    );
    assert.equal(hostReads, beforeInvalidRecord);
    assert.equal(
      (await mcpRecord("create_topic", { markdown: topicMarkdown() })).error
        .code,
      -32602,
    );
    const writeRecord = (
      method: string,
      resource: string,
      body: Record<string, unknown>,
      requestOrigin = origin.origin,
    ) =>
      web(`/api/repositories/${candidate.id}/${resource}`, {
        method,
        headers: {
          cookie: adminSession,
          origin: requestOrigin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const newTopic = topicMarkdown().replaceAll("TOPIC-000042", "TOPIC-000043");
    const storedTopic = createTopicOperations(
      candidate.target,
      "project.fixture",
    );
    assert.equal(
      (await writeRecord("POST", "topics", { markdown: newTopic })).status,
      404,
    );
    appCanWriteHosted = true;
    assert.equal(
      (await writeRecord("POST", "topics", { markdown: newTopic })).status,
      404,
    );
    canWriteHosted = true;
    canWriteHosted = false;
    const beforeReadOnlyWrite = hostReads;
    assert.equal(
      (await writeRecord("POST", "topics", { markdown: newTopic })).status,
      404,
    );
    assert.equal(
      (await mcpRecord("create_topic", { markdown: newTopic })).error.code,
      -32602,
    );
    assert.equal(hostReads - beforeReadOnlyWrite, 4);
    assert.equal(storedTopic.get("TOPIC-000043"), null);
    canWriteHosted = true;
    const beforeWrongOrigin = hostReads;
    assert.equal(
      (
        await writeRecord(
          "POST",
          "topics",
          { markdown: newTopic },
          "https://unrelated.example",
        )
      ).status,
      403,
    );
    assert.equal(hostReads, beforeWrongOrigin);
    assert.equal(
      (await writeRecord("POST", "topics", { markdown: newTopic })).status,
      201,
    );
    const update = {
      expectedRevision: 1,
      markdown: topicMarkdown(2, "project.fixture", "waiting").replaceAll(
        "TOPIC-000042",
        "TOPIC-000043",
      ),
    };
    const [httpUpdate, mcpUpdate] = await Promise.all([
      writeRecord("PATCH", "topics/TOPIC-000043", update),
      mcpRecord("update_topic", { id: "TOPIC-000043", ...update }),
    ]);
    assert.ok([200, 409].includes(httpUpdate.status));
    assert.equal(
      Number(httpUpdate.status === 200) +
        Number(mcpUpdate.result.structuredContent.status === "completed"),
      1,
    );
    assert.equal(storedTopic.get("TOPIC-000043")?.revision, 2);
    const change = path.join(
      candidate.target,
      "99_Roadmap",
      "Changes",
      "CHG-000042",
    );
    fs.mkdirSync(change, { recursive: true });
    fs.writeFileSync(path.join(change, "change.md"), "# 試験用変更\n");
    const promoted = await writeRecord(
      "POST",
      "topics/TOPIC-000043/promotion",
      {
        expectedRevision: 2,
        changeId: "CHG-000042",
        reason: "確認済み",
        remainingResponsibility: "なし",
      },
    );
    assert.equal(promoted.status, 200);
    assert.equal((await promoted.json()).reason, "topic_promoted");
    const newMeeting = meetingMarkdown().replaceAll("MTG-000042", "MTG-000043");
    assert.equal(
      (await mcpRecord("create_meeting", { markdown: newMeeting })).result
        .structuredContent.reason,
      "record_created",
    );
    const treated = await writeRecord(
      "PUT",
      "meetings/MTG-000043/outcomes/OUT-001/treatment",
      {
        expectedRevision: 1,
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "確認済み",
        targetKind: "none",
        targetReference: "N/A: 移管なし",
        treatment: "対応済み",
        completionCondition: "完了",
        result: "確認済み",
        closeMeeting: true,
      },
    );
    assert.equal(treated.status, 200);
    const deleting = {
      expectedRevision: 2,
      confirmed: false,
      reason: "mistaken_registration",
    };
    assert.equal(
      (await writeRecord("DELETE", "meetings/MTG-000043", deleting)).status,
      409,
    );
    assert.equal(
      (
        await writeRecord("DELETE", "meetings/MTG-000043", {
          ...deleting,
          confirmed: true,
        })
      ).status,
      200,
    );

    // ローカル確定の前後で権限を外し、無保存と公開不能を分ける。
    const beforeFile = topicMarkdown().replaceAll(
      "TOPIC-000042",
      "TOPIC-000044",
    );
    const stagedFile = topicMarkdown().replaceAll(
      "TOPIC-000042",
      "TOPIC-000046",
    );
    const afterFile = topicMarkdown().replaceAll(
      "TOPIC-000042",
      "TOPIC-000045",
    );
    const originalRename = fs.renameSync;
    const recordManifest = path.join(
      candidate.target,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    const originalRecordManifest = fs.readFileSync(recordManifest, "utf8");
    for (const [id, markdown, stage, changed] of [
      ["TOPIC-000044", beforeFile, "before", "registration"],
      ["TOPIC-000046", stagedFile, "staged", "registration"],
      ["TOPIC-000045", afterFile, "after", "registration"],
      [
        "TOPIC-000047",
        topicMarkdown().replaceAll("TOPIC-000042", "TOPIC-000047"),
        "staged",
        "manifest",
      ],
      [
        "TOPIC-000048",
        topicMarkdown().replaceAll("TOPIC-000042", "TOPIC-000048"),
        "after",
        "manifest",
      ],
      [
        "TOPIC-000049",
        topicMarkdown().replaceAll("TOPIC-000042", "TOPIC-000049"),
        "after",
        "binding",
      ],
    ] as const) {
      const destination = path.join(
        candidate.target,
        "22_Topics",
        id,
        "topic.md",
      );
      // 確定前は一時ファイルのopen、確定後は正式ファイルのrenameを観測する。
      const originalOpen = fs.openSync;
      const originalWrite = fs.writeFileSync;
      const beforeBinding =
        changed === "binding" ? fs.readFileSync(f.current) : null;
      const changeTarget = () => {
        if (changed === "registration")
          assert.equal(removeHostedRegistration().status, "completed");
        else if (beforeBinding) {
          const state = JSON.parse(
            beforeBinding.toString("utf8"),
          ) as AccessManagementState;
          const user = state.users.find(
            ({ userId }) => userId === administrator.userId,
          );
          assert.ok(user?.accountLinks?.length);
          delete user.accountLinks;
          state.revision++;
          state.operationId = randomUUID();
          originalWrite(f.current, JSON.stringify(state));
        } else
          originalWrite(
            recordManifest,
            JSON.stringify({
              ...JSON.parse(originalRecordManifest),
              projectId: "project.changed",
            }),
          );
      };
      let temporaryDescriptor: number | undefined;
      let bodyWrites = 0;
      const openMock = t.mock.method(
        fs,
        "openSync",
        (...args: Parameters<typeof originalOpen>) => {
          const [file] = args;
          const fd = originalOpen(...args);
          if (
            typeof file === "string" &&
            path.dirname(file) === path.dirname(destination) &&
            file.endsWith(".tmp")
          ) {
            temporaryDescriptor = fd;
            if (stage === "before") changeTarget();
          }
          return fd;
        },
      );
      const writeMock = t.mock.method(
        fs,
        "writeFileSync",
        (...args: Parameters<typeof originalWrite>) => {
          originalWrite(...args);
          if (args[0] === temporaryDescriptor && args[1] === markdown) {
            bodyWrites++;
            if (stage === "staged") changeTarget();
          }
        },
      );
      const renameMock = t.mock.method(
        fs,
        "renameSync",
        (...args: Parameters<typeof originalRename>) => {
          const [, target] = args;
          originalRename(...args);
          if (stage === "after" && target === destination) changeTarget();
        },
      );
      syncBuiltinESMExports();
      try {
        const response = await writeRecord("POST", "topics", { markdown });
        assert.equal(response.status, 503);
        assert.equal(fs.existsSync(destination), stage === "after");
        assert.equal(bodyWrites, stage === "before" ? 0 : 1);
        assert.equal(
          fs
            .readdirSync(path.dirname(destination))
            .some((entry) => entry.endsWith(".tmp")),
          false,
        );
        assert.deepEqual(
          await response.json(),
          stage !== "after"
            ? { error: "record_unavailable" }
            : {
                status: "unavailable",
                reason: "record_publication_unconfirmed",
                effectState: "unknown",
              },
        );
        if (changed === "binding") {
          assert.equal(fs.readFileSync(destination, "utf8"), markdown);
          const beforeRevokedRead: number = hostReads;
          const rejected = await listRecords("topics", `/${id}`);
          assert.equal(rejected.status, 404);
          assert.deepEqual(await rejected.json(), {
            error: "record_unavailable",
          });
          assert.equal(hostReads, beforeRevokedRead);
        }
      } finally {
        openMock.mock.restore();
        renameMock.mock.restore();
        writeMock.mock.restore();
        syncBuiltinESMExports();
        if (changed === "manifest")
          originalWrite(recordManifest, originalRecordManifest);
        if (beforeBinding) originalWrite(f.current, beforeBinding);
      }
      if (changed === "registration") restoreHostedRegistration();
    }
    canReadHosted = false;
    assert.deepEqual((await projects()).projects, []);
    assert.deepEqual(await mcpProjects(), []);
    assert.equal((await listRecords("topics")).status, 404);
    assert.equal((await mcpRecord("list_topics", {})).error.code, -32602);
    canReadHosted = true;
    fixtureGit(candidate.target, ["symbolic-ref", "HEAD", "refs/heads/main"]);
    fixtureGit(candidate.target, [
      "config",
      "--local",
      "user.name",
      "Workspace Fixture",
    ]);
    fixtureGit(candidate.target, [
      "config",
      "--local",
      "user.email",
      "fixture@example.invalid",
    ]);
    fs.mkdirSync(path.join(candidate.target, ".git", "info"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(candidate.target, ".git", "info", "exclude"),
      "",
    );
    fs.writeFileSync(path.join(candidate.target, ".gitignore"), ".crdd/\n");
    fs.writeFileSync(path.join(candidate.target, "source.txt"), "seed\n");
    fixtureGit(candidate.target, ["add", "."]);
    fixtureGit(candidate.target, ["commit", "-m", "fixture"]);
    const workspaceBase = fixtureGit(candidate.target, ["rev-parse", "HEAD"]);
    await t.test(
      "共有Googleセッションのステージは本人とAppの書込み権限を要求する",
      async (stagingTest) => {
        fixtureGit(candidate.target, [
          "config",
          "--local",
          "protocol.https.allow",
          "never",
        ]);
        const staging = `/api/repositories/${candidate.id}/staging`;
        const draft = path.join(candidate.target, "oauth-stage.txt");
        const readIndex = () =>
          fixtureGit(candidate.target, ["diff", "--cached", "--name-only"]);
        const original = readIndex();
        const change = (method: "POST" | "DELETE", cookie?: string) =>
          web(staging, {
            method,
            headers: {
              origin: origin.origin,
              "content-type": "application/json",
              "x-crdd-action-token": actionToken,
              ...(cookie ? { cookie } : {}),
            },
            body: JSON.stringify({ path: "oauth-stage.txt" }),
          });
        fs.writeFileSync(draft, "合成ステージ入力\n");
        try {
          canWriteHosted = true;
          appCanWriteHosted = true;
          assert.equal((await change("POST")).status, 400);
          assert.equal(readIndex(), original);
          canWriteHosted = false;
          assert.equal((await change("POST", adminSession)).status, 400);
          assert.equal(readIndex(), original);
          canWriteHosted = true;
          appCanWriteHosted = false;
          assert.equal((await change("POST", adminSession)).status, 400);
          assert.equal(readIndex(), original);
          appCanWriteHosted = true;
          assert.equal((await change("POST", adminSession)).status, 200);
          assert.equal(readIndex(), "oauth-stage.txt");
          assert.equal((await change("DELETE", adminSession)).status, 200);
          assert.equal(readIndex(), original);
          // Gitの実処置に成功しても、対象Git実体や主体を失った後には成功を公開しない。
          for (const loss of ["git", "account"] as const) {
            const git = path.join(candidate.target, ".git");
            const heldGit = path.join(candidate.target, ".git-fixture-held");
            let restore: (() => void) | undefined;
            let invocations = 0;
            const spawn = childProcess.spawnSync;
            const witness = stagingTest.mock.method(
              childProcess,
              "spawnSync",
              (
                command: string,
                args: readonly string[],
                options: childProcess.SpawnSyncOptions,
              ) => {
                const result = spawn(command, args, options);
                if (
                  command !== "git" ||
                  options.cwd !== candidate.target ||
                  !args.includes("add") ||
                  !args.includes("oauth-stage.txt")
                )
                  return result;
                invocations++;
                assert.equal(result.status, 0);
                if (loss === "git") {
                  fs.renameSync(git, heldGit);
                  restore = () => fs.renameSync(heldGit, git);
                } else {
                  const state = JSON.parse(
                    fs.readFileSync(f.current, "utf8"),
                  ) as AccessManagementState;
                  const actor = state.users.find(
                    ({ userId }) => userId === administrator.userId,
                  );
                  assert.ok(actor?.accountLinks?.length);
                  const links = actor.accountLinks;
                  actor.accountLinks = [];
                  state.revision++;
                  state.operationId = randomUUID();
                  fs.writeFileSync(f.current, JSON.stringify(state));
                  restore = () => {
                    actor.accountLinks = links;
                    state.revision++;
                    state.operationId = randomUUID();
                    fs.writeFileSync(f.current, JSON.stringify(state));
                  };
                }
                return result;
              },
            );
            syncBuiltinESMExports();
            try {
              const response = await change("POST", adminSession);
              assert.equal(response.status, 503, loss);
              assert.equal(
                await response.text(),
                "repository_action_outcome_unconfirmed\n",
              );
              assert.equal(invocations, 1, loss);
            } finally {
              witness.mock.restore();
              syncBuiltinESMExports();
              restore?.();
            }
            assert.equal(readIndex(), "oauth-stage.txt");
            assert.equal((await change("DELETE", adminSession)).status, 200);
            assert.equal(readIndex(), original);
          }
          assert.equal(
            fixtureGit(candidate.target, ["rev-parse", "HEAD"]),
            workspaceBase,
          );
        } finally {
          if (readIndex() === "oauth-stage.txt")
            fixtureGit(candidate.target, ["reset", "--", "oauth-stage.txt"]);
          fs.unlinkSync(draft);
        }
      },
    );
    await t.test(
      "Gitホスト連携のHTTPとMCPは同じ照会と判断保存を本人権限へ結び付ける",
      async (executionTest) => {
        const projectId = "project.fixture";
        const initial = persistAcceptancePendingState(
          candidate.target,
          deriveCoordinatorRepositoryBindingId(candidate.target),
          projectId,
          workspaceBase,
          "failed",
        );
        const area = path.join(candidate.target, ".crdd", "execution-model");
        const snapshot = path.join(area, "state.json");
        const readSnapshot = () => fs.readFileSync(snapshot);
        const before = readSnapshot();
        const requestId = "observed.fixture";
        const queueId = `queue-${projectId}`;
        const decisionId = "decision.hosted";
        const generation = initial.generation;
        const milestoneId = initial.milestoneId;
        const query = { projectId, queueId, repositoryRevision: workspaceBase };
        const queryPath = `/api/repositories/${candidate.id}/runs/${requestId}?${new URLSearchParams(query)}`;
        const decisionPath = `/api/repositories/${candidate.id}/projects/${projectId}/milestones/${milestoneId}/decisions`;
        const token = (
          await (
            await web("/api/workbench/view", {
              headers: { cookie: adminSession },
            })
          ).json()
        ).actionToken;
        assert.match(token, /^[A-Za-z0-9_-]{43}$/u);
        const decisionVersion = {
          generation,
          repositoryRevision: workspaceBase,
        };
        const decisionTarget = {
          ...decisionVersion,
          projectId,
          milestoneId,
          decisionId,
        };
        const question = {
          blockerId: "blocker.hosted",
          queueId,
          question: "続けますか",
          allowedOptions: ["cancel"],
        };
        const browser = (
          path: string,
          body?: object,
          extra?: Record<string, string>,
        ) =>
          web(path, {
            ...(body && { method: "POST", body: JSON.stringify(body) }),
            headers: {
              cookie: adminSession,
              ...(body && {
                origin: origin.origin,
                "content-type": "application/json",
                "x-crdd-action-token": token,
              }),
              ...extra,
            },
          });
        const tool = async (name: string, input: object) =>
          (
            await call(server.baseUrl, mcpToken, name, {
              repositoryId: candidate.id,
              ...input,
            })
          ).json();
        const requestDecision = () =>
          browser(decisionPath, {
            ...decisionVersion,
            decisionId,
            ...question,
          });
        const beforeLegacyExecution: number = hostReads;
        const runPath = `/api/repositories/${candidate.id}/runs/${requestId}`;
        const oldExecutionRoutes: ReadonlyArray<readonly [string, object?]> = [
          [queryPath],
          [decisionPath, { ...decisionVersion, decisionId, ...question }],
          [
            `/api/repositories/${candidate.id}/projects/${projectId}/milestones/${milestoneId}/runs`,
            {},
          ],
          [`${runPath}/resumption`, {}],
          [`${runPath}/cancellation`, {}],
        ];
        for (const [route, input] of oldExecutionRoutes) {
          const rejected = await browser(route, input, oldHeaders);
          assert.equal(rejected.status, 403, route);
          const bare = await web(route, {
            ...(input && { method: "POST", body: JSON.stringify(input) }),
            headers: {
              ...oldHeaders,
              origin: origin.origin,
              "content-type": "application/json",
              "x-crdd-action-token": token,
            },
          });
          assert.equal(bare.status, 403, route);
        }
        assert.equal(hostReads, beforeLegacyExecution);
        assert.deepEqual(readSnapshot(), before);
        const expireAtManifest = async (afterWrite: boolean) => {
          const manifest = path.join(
            candidate.target,
            ".crdd",
            "config",
            "repository-manifest.json",
          );
          let elapsed = 0;
          let manifestReads = 0;
          let wrote = false;
          const now = performance.now.bind(performance);
          const open = fs.openSync;
          const rename = fs.renameSync;
          const clock = executionTest.mock.method(
            performance,
            "now",
            () => now() + elapsed,
          );
          const manifestOpen = executionTest.mock.method(
            fs,
            "openSync",
            (...args: Parameters<typeof open>) => {
              const fd = open(...args);
              if (
                args[0] === manifest &&
                (afterWrite ? wrote : ++manifestReads === 2)
              )
                elapsed = 10_001;
              return fd;
            },
          );
          const save = executionTest.mock.method(
            fs,
            "renameSync",
            (...args: Parameters<typeof rename>) => {
              rename(...args);
              if (args[1] === snapshot) wrote = true;
            },
          );
          syncBuiltinESMExports();
          try {
            const result = await requestDecision();
            assert.equal(elapsed, 10_001);
            assert.equal(wrote, afterWrite);
            return result;
          } finally {
            manifestOpen.mock.restore();
            save.mock.restore();
            clock.mock.restore();
            syncBuiltinESMExports();
          }
        };
        try {
          canWriteHosted = false;
          const state = await browser(queryPath);
          assert.equal(state.status, 200);
          const projected = await state.json();
          assert.equal(projected.projectId, projectId);
          assert.equal(projected.queueId, queueId);
          assert.deepEqual(
            projected,
            (await tool("crdd.get_execution_state", { ...query, requestId }))
              .result.structuredContent,
          );
          const readLaunch = objectiveRuns.read;
          const active: NonNullable<ReturnType<typeof objectiveRuns.attach>>[] =
            [];
          let elapsed = 0;
          let expireAtLaunch = false;
          const now = performance.now.bind(performance);
          const clock = executionTest.mock.method(
            performance,
            "now",
            () => now() + elapsed,
          );
          const launch = executionTest.mock.method(
            objectiveRuns,
            "read",
            (target: Parameters<typeof readLaunch>[0]) => {
              if (!active.length) {
                const entry = objectiveRuns.attach(target);
                assert.ok(entry);
                active.push(entry);
              }
              const launchId = readLaunch(target);
              if (expireAtLaunch) elapsed = 10_001;
              return launchId;
            },
          );
          try {
            const running = await (await browser(queryPath)).json();
            assert.match(running.launchId, /^[0-9a-f-]{36}$/u);
            assert.deepEqual(
              running,
              (await tool("crdd.get_execution_state", { ...query, requestId }))
                .result.structuredContent,
            );
            expireAtLaunch = true;
            const unpublished = await browser(queryPath);
            assert.equal(unpublished.status, 503);
            assert.deepEqual(await unpublished.json(), {
              status: "blocked",
              reason: "execution_result_unconfirmed",
            });
          } finally {
            active[0]?.close();
            launch.mock.restore();
            clock.mock.restore();
          }
          assert.equal(
            (
              await browser(queryPath, undefined, {
                authorization: `Bearer ${f.token}`,
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await browser(decisionPath, {
                ...decisionVersion,
                decisionId,
                ...question,
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await tool("crdd.request_decision", {
                ...decisionTarget,
                ...question,
              })
            ).result.structuredContent.effectState,
            "no_effect",
          );
          assert.deepEqual(readSnapshot(), before);
          canWriteHosted = true;
          appCanWriteHosted = false;
          assert.equal(
            (
              await browser(decisionPath, {
                ...decisionVersion,
                decisionId,
                ...question,
              })
            ).status,
            403,
          );
          assert.deepEqual(readSnapshot(), before);
          appCanWriteHosted = true;
          const expired = await expireAtManifest(false);
          assert.equal(expired.status, 403);
          assert.deepEqual(readSnapshot(), before);
          const unpublished = await expireAtManifest(true);
          assert.equal(unpublished.status, 503);
          assert.deepEqual(await unpublished.json(), {
            status: "blocked",
            reason: "execution_result_unconfirmed",
          });
          const saved = readSnapshot();
          assert.notDeepEqual(saved, before);
          const requested = await requestDecision();
          assert.equal(requested.status, 200);
          const pending = await requested.json();
          assert.equal(pending.status, "completed", JSON.stringify(pending));
          assert.equal(pending.decision.status, "pending");
          assert.deepEqual(readSnapshot(), saved);
          const answered = (
            await tool("crdd.answer_decision", {
              ...decisionTarget,
              selectedOption: "cancel",
            })
          ).result.structuredContent;
          assert.equal(answered.status, "completed", JSON.stringify(answered));
          assert.equal(answered.decision.status, "applied");
          const afterAnswer = readSnapshot();
          const applied = await browser(
            `${decisionPath}/${decisionId}/application`,
            decisionVersion,
          );
          assert.equal(applied.status, 200);
          const final = await applied.json();
          assert.equal(final.status, "completed", JSON.stringify(final));
          assert.equal(final.decision.status, "applied");
          assert.deepEqual(final.decision, answered.decision);
          assert.deepEqual(readSnapshot(), afterAnswer);
          canReadHosted = false;
          assert.equal((await browser(queryPath)).status, 403);
          assert.equal(
            (await tool("crdd.get_execution_state", { ...query, requestId }))
              .result.structuredContent.reason,
            "mcp_execution_access_unavailable",
          );
        } finally {
          canReadHosted = true;
          canWriteHosted = true;
          appCanWriteHosted = true;
          fs.renameSync(
            area,
            path.join(
              candidate.target,
              ".crdd",
              "hosted-decision-fixture-storage",
            ),
          );
        }
      },
    );
    await t.test(
      "共有AI選定は現在の管理セッションとGitホスト権限でだけ保存する",
      async (selectionTest) => {
        const route = `/api/repositories/${candidate.id}/ai-selection`;
        const configPath = path.join(
          candidate.target,
          ".crdd",
          "config",
          "ai-selection.json",
        );
        assert.equal(fs.existsSync(configPath), false);
        const view = async (cookie: string) => {
          const response = await web(
            `/api/workbench/view?repositoryId=${candidate.id}`,
            { headers: { cookie } },
          );
          assert.equal(response.status, 200);
          return response.json();
        };
        const { actionToken, aiSelectionManagement } = await view(adminCookie);
        assert.equal(aiSelectionManagement.allowed, false);
        const read = (cookie: string) => web(route, { headers: { cookie } });
        const update = (
          cookie: string,
          expectedIdentity: string | null = null,
          label?: string,
        ) => {
          const config = selectionConfig();
          if (label !== undefined) config.workTypes.coding.label = label;
          return web(route, {
            method: "PUT",
            headers: {
              cookie,
              origin: server.baseUrl,
              "content-type": "application/json",
              "x-crdd-action-token": actionToken,
            },
            body: JSON.stringify({
              expectedIdentity,
              config,
            }),
          });
        };
        const previous = [canWriteHosted, appCanWriteHosted] as const;
        try {
          assert.equal((await read(invitedCookie)).status, 403);
          const before = await read(adminCookie);
          assert.equal(before.status, 200);
          assert.equal((await before.json()).status, "missing");
          canWriteHosted = appCanWriteHosted = true;
          assert.equal(
            (await view(adminCookie)).aiSelection.selection.status,
            "missing",
          );
          assert.equal(
            (await view(adminCookie)).aiSelectionManagement.allowed,
            false,
          );
          assert.equal(
            (await view(adminSession)).aiSelectionManagement.allowed,
            true,
          );
          assert.equal((await update(adminCookie)).status, 400);
          appCanWriteHosted = false;
          assert.equal(
            (await view(adminSession)).aiSelectionManagement.allowed,
            false,
          );
          assert.equal((await update(adminSession)).status, 400);
          appCanWriteHosted = true;
          canWriteHosted = false;
          assert.equal((await update(adminSession)).status, 400);
          assert.equal(fs.existsSync(configPath), false);
          canWriteHosted = true;
          const published = await update(adminSession);
          assert.equal(published.status, 200);
          const result = await published.json();
          assert.equal(result.status, "saved", JSON.stringify(result));
          assert.deepEqual(
            (await (await read(adminCookie)).json()).snapshot,
            result.snapshot,
          );
          assert.deepEqual(
            (await view(adminSession)).aiSelectionManagement.snapshot,
            result.snapshot,
          );
          const content = fs.readFileSync(configPath);
          assert.equal(
            (await (await update(adminSession)).json()).status,
            "conflict",
          );
          assert.deepEqual(fs.readFileSync(configPath), content);
          const mixedCredentials = await web(route, {
            headers: { cookie: adminCookie, authorization: "Bearer fixture" },
          });
          assert.equal(mixedCredentials.status, 403);

          for (const cause of ["role", "account"] as const) {
            let restore: (() => void) | undefined;
            const loseAccess = () => {
              assert.equal(restore, undefined);
              const state = JSON.parse(
                fs.readFileSync(f.current, "utf8"),
              ) as AccessManagementState;
              const owner = state.users.find(
                (user) => user.userId === administrator.userId,
              );
              assert.ok(owner?.accountLinks?.length);
              const { role, accountLinks } = owner;
              const save = () => {
                state.revision++;
                state.operationId = randomUUID();
                fs.writeFileSync(f.current, JSON.stringify(state));
              };
              if (cause === "role") owner.role = "developer";
              else owner.accountLinks = [];
              save();
              restore = () => {
                owner.role = role;
                owner.accountLinks = accountLinks;
                save();
              };
            };
            const restoreAccess = () => {
              restore?.();
              restore = undefined;
            };
            const open = fs.openSync;
            const close = fs.closeSync;
            let descriptor: number | null = null;
            let reads = 0;
            const opened = selectionTest.mock.method(
              fs,
              "openSync",
              (...args: Parameters<typeof open>) => {
                const fd = open(...args);
                if (String(args[0]) === configPath) descriptor = fd;
                return fd;
              },
            );
            const closed = selectionTest.mock.method(
              fs,
              "closeSync",
              (fd: number) => {
                close(fd);
                if (fd !== descriptor) return;
                descriptor = null;
                reads++;
                loseAccess();
              },
            );
            syncBuiltinESMExports();
            try {
              assert.equal((await read(adminCookie)).status, 403, cause);
              assert.equal(reads, 1, cause);
            } finally {
              opened.mock.restore();
              closed.mock.restore();
              syncBuiltinESMExports();
              restoreAccess();
            }

            const currentSelection = await (await read(adminCookie)).json();
            const label = `保存後に認可喪失-${cause}`;
            const rename = fs.renameSync;
            let publications = 0;
            const renamed = selectionTest.mock.method(
              fs,
              "renameSync",
              (...args: Parameters<typeof rename>) => {
                rename(...args);
                if (String(args[1]) !== configPath) return;
                publications++;
                loseAccess();
              },
            );
            syncBuiltinESMExports();
            try {
              const response = await update(
                adminSession,
                currentSelection.snapshot.identity,
                label,
              );
              assert.equal(response.status, 503, cause);
              assert.equal(
                await response.text(),
                "ai_selection_outcome_unconfirmed\n",
              );
              assert.equal(publications, 1, cause);
            } finally {
              renamed.mock.restore();
              syncBuiltinESMExports();
              restoreAccess();
            }
            const saved = await (await read(adminCookie)).json();
            assert.equal(saved.snapshot.config.workTypes.coding.label, label);
          }
          const stable = await (await read(adminCookie)).json();
          const validBody = JSON.stringify({
            expectedIdentity: stable.snapshot.identity,
            config: selectionConfig(),
          });
          const writeHeaders = {
            cookie: adminSession,
            origin: server.baseUrl,
            "content-type": "application/json",
            "x-crdd-action-token": actionToken,
          };
          const duplicate = await web(route, {
            method: "PUT",
            headers: writeHeaders,
            body: `${validBody.slice(0, -1)},"expectedIdentity":null}`,
          });
          assert.equal(duplicate.status, 400);
          assert.deepEqual(
            (await (await read(adminCookie)).json()).snapshot,
            stable.snapshot,
          );
          const open = fs.openSync;
          const unreadable = selectionTest.mock.method(
            fs,
            "openSync",
            (...args: Parameters<typeof open>) => {
              if (String(args[0]) === configPath)
                throw Object.assign(Error("fixture_read_unavailable"), {
                  code: "EACCES",
                });
              return open(...args);
            },
          );
          syncBuiltinESMExports();
          try {
            const result = await read(adminCookie);
            assert.equal(result.status, 200);
            assert.equal((await result.json()).status, "blocked");
          } finally {
            unreadable.mock.restore();
            syncBuiltinESMExports();
          }
          let client: ReturnType<typeof httpRequest> | undefined;
          let cutPublications = 0;
          const rename = fs.renameSync;
          let faultPublications = 0;
          const fault = selectionTest.mock.method(
            fs,
            "renameSync",
            (...args: Parameters<typeof rename>) => {
              rename(...args);
              if (String(args[1]) !== configPath) return;
              faultPublications++;
              throw Error("fixture_after_selection_publication");
            },
          );
          syncBuiltinESMExports();
          try {
            const unknown = await update(
              adminSession,
              stable.snapshot.identity,
              "出版後に例外",
            );
            assert.equal(unknown.status, 200);
            assert.equal((await unknown.json()).status, "unknown");
            assert.equal(faultPublications, 1);
          } finally {
            fault.mock.restore();
            syncBuiltinESMExports();
          }
          const recovered = await (await read(adminCookie)).json();
          assert.equal(
            recovered.snapshot.config.workTypes.coding.label,
            "出版後に例外",
          );
          const cutBody = JSON.stringify({
            expectedIdentity: recovered.snapshot.identity,
            config: selectionConfig(),
          });
          const cut = selectionTest.mock.method(
            fs,
            "renameSync",
            (...args: Parameters<typeof rename>) => {
              rename(...args);
              if (String(args[1]) !== configPath) return;
              cutPublications++;
              client?.destroy();
            },
          );
          let successfulResponses = 0;
          const end = ServerResponse.prototype.end;
          const sent = selectionTest.mock.method(
            ServerResponse.prototype,
            "end",
            function (this: ServerResponse, ...args: Parameters<typeof end>) {
              if (
                new URL(this.req.url ?? "/", server.baseUrl).pathname ===
                  route &&
                this.req.method === "PUT" &&
                this.statusCode === 200 &&
                args[0] !== undefined
              )
                successfulResponses++;
              return end.apply(this, args);
            },
          );
          syncBuiltinESMExports();
          try {
            const control = await update(adminSession);
            assert.equal(control.status, 200);
            assert.equal((await control.json()).status, "conflict");
            assert.equal(successfulResponses, 1);
            assert.equal(cutPublications, 0);
            successfulResponses = 0;
            let responseObserved = false;
            await new Promise<void>((resolve, reject) => {
              client = httpRequest(new URL(route, server.baseUrl), {
                method: "PUT",
                agent: false,
                headers: {
                  ...writeHeaders,
                  "content-length": String(Buffer.byteLength(cutBody)),
                },
              });
              client.on("error", () => {});
              client.once("response", (response) => {
                responseObserved = true;
                response.resume();
              });
              client.once("close", resolve);
              client.setTimeout(15_000, () => {
                client?.destroy();
                reject(Error("fixture_selection_cut_timeout"));
              });
              client.end(cutBody);
            });
            assert.equal(responseObserved, false);
            assert.deepEqual(
              (await (await read(adminCookie)).json()).snapshot.config,
              selectionConfig(),
            );
            assert.equal(cutPublications, 1);
            assert.equal(successfulResponses, 0);
          } finally {
            client?.destroy();
            cut.mock.restore();
            sent.mock.restore();
            syncBuiltinESMExports();
          }
        } finally {
          [canWriteHosted, appCanWriteHosted] = previous;
          fs.rmSync(configPath, { force: true });
        }
      },
    );
    await t.test(
      "Gitホスト連携で開始・再開し、権限の喪失または本人の明示取消を子へ伝える",
      { timeout: 75_000 },
      async (runTest) => {
        const target = {
          projectId: "project.fixture",
          milestoneId: "milestone-hosted",
        };
        const objective = withCallerPlan({
          requestId: "hosted-objective.fixture",
          ...target,
          repositoryRevision: workspaceBase,
          objective: "合成の実行要求",
          acceptanceCriteria: ["確認"],
          allowedPaths: ["source.txt"],
          readPaths: ["source.txt"],
          maximumConcurrency: 1,
          maximumReplans: 0,
          originLane: "interactive",
          adoptResult: false,
        });
        const { projectId, milestoneId, ...body } = objective;
        const token = (
          await (
            await web("/api/workbench/view", {
              headers: { cookie: adminSession },
            })
          ).json()
        ).actionToken;
        assert.match(token, /^[A-Za-z0-9_-]{43}$/u);
        const barrier = () => {
          let resolve: () => void = () => {};
          const promise = new Promise<void>((finish) => {
            resolve = finish;
          });
          return { promise, resolve };
        };
        let clientState:
          | "unavailable"
          | { permission: "write"; repositoryName: string } = {
          permission: "write",
          repositoryName: "team/project",
        };
        const bindingProbe = await openHostedExecutionAccess(
          f.root,
          {
            principal: {
              kind: "account",
              userId: administrator.userId,
              bindingId: accountBinding,
              expiresAt: Date.now() + 30_000,
            },
            readGitHost: readFixtureGitHost,
            repositoryScope: f.repositoryScope,
            readHostToken: (host) =>
              host === "github.com" ? "ghu_fixture" : null,
            openExecution: () => ({
              accountId: "73",
              observePermission: async () => clientState,
            }),
          },
          candidate.id,
          { projectId, permission: "write" },
          runTest.signal,
        );
        assert.ok(bindingProbe);
        clientState = "unavailable";
        assert.equal(await bindingProbe.refresh(runTest.signal), "unavailable");
        assert.equal(removeHostedRegistration().status, "completed");
        try {
          assert.equal(bindingProbe.observe(), "revoked");
        } finally {
          restoreHostedRegistration();
          bindingProbe.close?.();
        }
        for (const mode of [
          "host-revoke",
          "am-revoke",
          "target-changed",
          "target-renamed",
          "unknown",
          "mcp-cancellation",
          "http-cancellation",
          "mcp-expiry",
          "browser-expiry",
          "mcp-admission-expiry",
          "git-disconnect",
          "mcp-logout",
        ] as const) {
          const startThroughHttp =
            mode === "host-revoke" ||
            mode === "mcp-cancellation" ||
            mode === "browser-expiry" ||
            mode === "git-disconnect";
          let runCookie = adminSession;
          let runToken = token;
          let runMcpToken = mcpToken;
          if (mode === "git-disconnect" || mode === "mcp-logout") {
            const previousSubject = googleSubject;
            try {
              googleSubject = "google-invitee";
              runCookie = sessionCookie(await login());
            } finally {
              googleSubject = previousSubject;
            }
            const connected = await web("/api/session/git/github", {
              method: "POST",
              headers: { cookie: runCookie, origin: origin.origin },
            });
            assert.equal(connected.status, 303);
            const linkState = new URL(
              connected.headers.get("location") ?? "",
            ).searchParams.get("state");
            assert.ok(linkState);
            const linked = await web(
              `/api/session/git/github/callback?${new URLSearchParams({ state: linkState, code: "synthetic" })}`,
              { headers: { cookie: runCookie } },
            );
            assert.equal(linked.status, 303);
            if (mode === "mcp-logout")
              runMcpToken = await consentMcp(runCookie);
            runToken = (
              await (
                await web("/api/workbench/view", {
                  headers: { cookie: runCookie },
                })
              ).json()
            ).actionToken;
            assert.match(runToken, /^[A-Za-z0-9_-]{43}$/u);
          }
          const ordinaryExpiry =
            mode === "mcp-expiry" || mode === "browser-expiry";
          const continues = ordinaryExpiry || mode === "mcp-logout";
          let clock: { restore: () => void } | undefined;
          let launchId: string | null = null;
          const attach = objectiveRuns.attach;
          const observingLaunch = runTest.mock.method(
            objectiveRuns,
            "attach",
            (identity: Parameters<typeof attach>[0]) => {
              const active = attach(identity);
              launchId = objectiveRuns.read(identity);
              return active;
            },
          );
          const readAccessState = () =>
            JSON.parse(
              fs.readFileSync(f.current, "utf8"),
            ) as AccessManagementState;
          let unrelatedChanged = false;
          const initialActor = readAccessState().users[0];
          assert.ok(initialActor);
          const changeUnrelated = (username: string) => {
            const current = readAccessState();
            const entry = current.users.find(
              ({ userId }) => userId === initialActor.userId,
            );
            assert.ok(entry);
            entry.username = username;
            current.revision++;
            current.operationId = randomUUID();
            fs.writeFileSync(f.current, JSON.stringify(current));
          };
          const entered = barrier();
          const cancelled = barrier();
          const close = barrier();
          runTest.signal.addEventListener("abort", close.resolve, {
            once: true,
          });
          let tick: (() => void) | undefined;
          let timer: ReturnType<typeof setInterval> | undefined;
          let cleared = false;
          const interval = globalThis.setInterval;
          const clear = globalThis.clearInterval;
          const watch = runTest.mock.method(
            globalThis,
            "setInterval",
            (...args: Parameters<typeof interval>) => {
              const handle =
                mode === "git-disconnect" && args[1] === 15_000
                  ? interval(() => {}, args[1])
                  : interval(...args);
              if (args[1] === 15_000) {
                tick = args[0] as () => void;
                timer = handle;
              }
              return handle;
            },
          );
          const stop = runTest.mock.method(
            globalThis,
            "clearInterval",
            (...args: Parameters<typeof clear>) => {
              if (timer === args[0]) cleared = true;
              clear(...args);
            },
          );
          const key = `hosted-objective-fixture-${randomUUID()}`;
          const fixtureUrl = `data:text/javascript,${encodeURIComponent(`export const runObjectiveInChild = globalThis[${JSON.stringify(key)}];`)}`;
          const fixture: typeof import("../../src/service/execution-child.ts").runObjectiveInChild =
            async (input, childSignal, authorize, confirm) => {
              assert.deepEqual(input, {
                ...objective,
                operation: startThroughHttp ? "start" : "resume",
              });
              assert.deepEqual(authorize({ projectId }), {
                directory: candidate.target,
                principalId:
                  mode === "mcp-logout" || mode === "git-disconnect"
                    ? record.result.userId
                    : administrator.userId,
                confirmBeforeTask: true,
              });
              if (mode === "mcp-admission-expiry") {
                const now = Date.now();
                const admissionClock = runTest.mock.method(
                  Date,
                  "now",
                  () => now + 301_000,
                );
                try {
                  assert.equal(await confirm(), false);
                  assert.equal(tick, undefined);
                } finally {
                  admissionClock.mock.restore();
                }
                entered.resolve();
                return null;
              }
              if (mode === "host-revoke")
                afterInstallationRead = () => {
                  afterInstallationRead = undefined;
                  changeUnrelated("表示名変更");
                  unrelatedChanged = true;
                };
              assert.equal(await confirm(), true);
              if (mode === "host-revoke") assert.equal(unrelatedChanged, true);
              childSignal.addEventListener("abort", () => cancelled.resolve(), {
                once: true,
              });
              entered.resolve();
              await close.promise;
              assert.equal(
                childSignal.aborted,
                mode !== "unknown" && !continues,
              );
              assert.equal(await confirm(), continues);
              return null;
            };
          Reflect.set(globalThis, key, fixture);
          const hook = registerHooks({
            resolve(specifier, context, next) {
              return specifier === "./execution-child.ts" &&
                context.parentURL?.endsWith("/src/service/execution.ts")
                ? { url: fixtureUrl, shortCircuit: true }
                : next(specifier, context);
            },
          });
          let completed = false;
          const outcome = (async (): Promise<number | undefined> =>
            startThroughHttp
              ? (
                  await web(
                    `/api/repositories/${candidate.id}/projects/${projectId}/milestones/${milestoneId}/runs`,
                    {
                      method: "POST",
                      headers: {
                        cookie: runCookie,
                        origin: origin.origin,
                        "content-type": "application/json",
                        "x-crdd-action-token": runToken,
                      },
                      body: JSON.stringify(body),
                    },
                  )
                ).status
              : (
                  await (
                    await call(
                      server.baseUrl,
                      runMcpToken,
                      "crdd.resume_objective",
                      { ...objective, repositoryId: candidate.id },
                    )
                  ).json()
                ).error?.code)().finally(() => {
            completed = true;
          });
          try {
            await Promise.race([
              entered.promise,
              outcome.then(() =>
                assert.fail("認可された子が実行前確認へ到達しなかった"),
              ),
            ]);
            if (mode === "mcp-admission-expiry") {
              assert.equal(await outcome, undefined);
              continue;
            }
            assert.ok(tick);
            if (ordinaryExpiry) {
              const now = Date.now();
              const delta = mode === "mcp-expiry" ? 301_000 : 31 * 60_000;
              clock = runTest.mock.method(Date, "now", () => now + delta).mock;
              tick();
            } else if (
              mode === "mcp-cancellation" ||
              mode === "http-cancellation"
            ) {
              assert.ok(launchId);
              const input: { projectId: string; launchId: string } = {
                projectId,
                launchId,
              };
              const cancellation: Record<string, string> = {
                ...input,
                requestId: objective.requestId,
                repositoryId: candidate.id,
              };
              const invoke = async (args: Record<string, string>) =>
                (
                  await call(
                    server.baseUrl,
                    mcpToken,
                    "crdd.cancel_objective",
                    args,
                  )
                ).json();
              for (const invalid of [
                { ...cancellation, launchId: randomUUID() },
                { ...cancellation, requestId: "other.objective" },
                { ...cancellation, projectId: "other.project" },
              ]) {
                assert.equal(
                  (await invoke(invalid)).result.structuredContent.reason,
                  "mcp_execution_access_unavailable",
                );
              }
              if (mode === "mcp-cancellation") {
                canWriteHosted = false;
                try {
                  assert.equal(
                    (await invoke(cancellation)).result.structuredContent
                      .reason,
                    "mcp_execution_access_unavailable",
                  );
                } finally {
                  canWriteHosted = true;
                }
                assert.deepEqual(
                  (await invoke(cancellation)).result.structuredContent,
                  { status: "cancellation_requested" },
                );
              } else {
                const response = await web(
                  `/api/repositories/${candidate.id}/runs/${objective.requestId}/cancellation`,
                  {
                    method: "POST",
                    headers: {
                      cookie: adminSession,
                      origin: origin.origin,
                      "content-type": "application/json",
                      "x-crdd-action-token": token,
                    },
                    body: JSON.stringify(input),
                  },
                );
                assert.equal(response.status, 202);
                assert.deepEqual(await response.json(), {
                  status: "cancellation_requested",
                });
              }
            } else if (mode === "mcp-logout") {
              const beforeMonitor = hostReads;
              assert.equal(
                (
                  await web("/api/session", {
                    method: "DELETE",
                    headers: { cookie: runCookie, origin: origin.origin },
                  })
                ).status,
                204,
              );
              assert.equal(
                (
                  await call(
                    server.baseUrl,
                    runMcpToken,
                    MCP_CURRENT_ACCESS_TOOL,
                    {},
                  )
                ).status,
                401,
              );
              tick();
              assert.equal(
                hostReads,
                beforeMonitor,
                "利用者資格を監視に使わない",
              );
            } else if (mode === "git-disconnect") {
              assert.equal(
                (
                  await web("/api/session/git/github", {
                    method: "DELETE",
                    headers: { cookie: runCookie, origin: origin.origin },
                  })
                ).status,
                204,
              );
            } else if (mode === "am-revoke")
              assert.equal(removeHostedRegistration().status, "completed");
            else {
              if (mode === "target-changed")
                setRemote("https://github.com/team/other.git");
              else if (mode === "target-renamed")
                hostedRepositoryName = "Team/Renamed";
              else hostedResponseStatus = mode === "host-revoke" ? 401 : 503;
              tick();
            }
            if (mode !== "unknown" && !continues)
              await Promise.race([
                cancelled.promise,
                outcome.then(() => assert.fail("取消前に応答した")),
              ]);
            assert.equal(completed, false);
            close.resolve();
            assert.equal(
              await outcome,
              startThroughHttp
                ? 503
                : mode === "http-cancellation" || continues
                  ? undefined
                  : -32603,
            );
            assert.equal(cleared, true);
          } finally {
            close.resolve();
            await outcome.catch(() => {});
            clock?.restore();
            runTest.signal.removeEventListener("abort", close.resolve);
            if (mode === "am-revoke") restoreHostedRegistration();
            hostedResponseStatus = undefined;
            if (mode === "target-changed") setRemote(correctRemote);
            if (mode === "target-renamed")
              hostedRepositoryName = "Team/Project";
            if (unrelatedChanged) changeUnrelated(initialActor.username);
            afterInstallationRead = undefined;
            hook.deregister();
            Reflect.deleteProperty(globalThis, key);
            watch.mock.restore();
            stop.mock.restore();
            observingLaunch.mock.restore();
          }
        }
      },
    );
    prepareWorkspaceSurface(candidate.target, "project.fixture", workspaceBase);
    const workspaces = `/api/repositories/${candidate.id}/workspaces`;
    const workspaceQueries = "?projectId=project.fixture&limit=20";
    const wsCall = async (name: string, args: Record<string, unknown>) =>
      (
        await call(server.baseUrl, mcpToken, name, {
          repositoryId: candidate.id,
          ...args,
        })
      ).json();
    const wsWrite = (
      method: string,
      suffix: string,
      args: Record<string, unknown>,
    ) =>
      web(workspaces + suffix, {
        method,
        headers: {
          cookie: adminSession,
          origin: origin.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(args),
      });
    const workspaceId = randomUUID();
    const commonWorkspace = {
      projectId: "project.fixture",
      queueId: "queue-a",
    };
    const createWorkspace = {
      ...commonWorkspace,
      workspaceId,
      expectedGeneration: 0,
      baseBranch: "main",
      baseCommit: workspaceBase,
      name: "初期名",
    };
    const listWorkspace = {
      projectId: "project.fixture",
      cursor: null,
      limit: 20,
    };
    assert.equal(removeHostedRegistration().status, "completed");
    const beforeWorkspaceRejection = hostReads;
    assert.equal(
      (
        await web(workspaces + workspaceQueries, {
          headers: { cookie: adminSession },
        })
      ).status,
      404,
    );
    assert.equal(
      (await wsCall("crdd.list_workspaces", listWorkspace)).error.code,
      -32603,
    );
    assert.equal(hostReads, beforeWorkspaceRejection);
    restoreHostedRegistration();
    const beforeMixedCredentials = hostReads;
    const mixedCredentials = await web(workspaces + workspaceQueries, {
      headers: { cookie: adminSession, authorization: `Bearer ${f.token}` },
    });
    assert.equal(mixedCredentials.status, 403);
    assert.deepEqual(await mixedCredentials.json(), {
      error: "request_rejected",
    });
    assert.equal(hostReads, beforeMixedCredentials);
    canWriteHosted = false;
    const listResponse = await web(workspaces + workspaceQueries, {
      headers: { cookie: adminSession },
    });
    assert.equal(listResponse.status, 200);
    assert.deepEqual(
      await listResponse.json(),
      (await wsCall("crdd.list_workspaces", listWorkspace)).result
        .structuredContent,
    );
    const beforeWorkspaceInvalid = hostReads;
    assert.equal(
      (await wsWrite("POST", "", { ...createWorkspace, operation: "rename" }))
        .status,
      400,
    );
    assert.equal(
      (
        await wsCall("crdd.create_workspace", {
          ...createWorkspace,
          operation: "rename",
        })
      ).error.code,
      -32602,
    );
    assert.equal(hostReads, beforeWorkspaceInvalid);
    assert.equal((await wsWrite("POST", "", createWorkspace)).status, 404);
    assert.equal(
      (await wsCall("crdd.create_workspace", createWorkspace)).error.code,
      -32603,
    );
    assert.equal(
      fixtureGit(candidate.target, [
        "worktree",
        "list",
        "--porcelain",
      ]).includes(workspaceId),
      false,
    );
    canWriteHosted = true;
    const createdWorkspace = await wsWrite("POST", "", createWorkspace);
    assert.equal(createdWorkspace.status, 201);
    const createdWorkspaceBody = await createdWorkspace.json();
    assert.equal(createdWorkspaceBody.data.status, "completed");
    assert.equal(createdWorkspaceBody.data.workspace.workspaceId, workspaceId);
    const duplicateWorkspace = await wsWrite("POST", "", createWorkspace);
    assert.equal(duplicateWorkspace.status, 200);
    const duplicateWorkspaceBody = await duplicateWorkspace.json();
    assert.equal(duplicateWorkspaceBody.data.status, "blocked");
    assert.equal(duplicateWorkspaceBody.data.gitEffectIssued, false);
    const renamedWorkspace = (
      await wsCall("crdd.rename_workspace", {
        ...commonWorkspace,
        workspaceId,
        expectedGeneration: createdWorkspaceBody.data.workspace.generation,
        name: "別名",
      })
    ).result.structuredContent;
    assert.equal(renamedWorkspace.data.status, "completed");
    const workspaceResponse = await web(
      `${workspaces}/${workspaceId}?projectId=project.fixture&queueId=queue-a`,
      { headers: { cookie: adminSession } },
    );
    assert.equal(workspaceResponse.status, 200);
    assert.deepEqual(
      await workspaceResponse.json(),
      (await wsCall("crdd.get_workspace", { ...commonWorkspace, workspaceId }))
        .result.structuredContent,
    );
    assert.equal(renamedWorkspace.data.workspace.name, "別名");
    const definitionTarget = {
      projectId: "project.fixture",
      milestoneId: "milestone",
    };
    const definitionRoot = `/api/repositories/${candidate.id}/projects/project.fixture/milestones/milestone`;
    const beforeRetiredScopeReads: number = hostReads;
    const currentScopeRoutes: readonly string[] = [
      `${workspaces}${workspaceQueries}`,
      `${definitionRoot}/plan`,
    ];
    for (const route of currentScopeRoutes) {
      for (const headers of [
        oldHeaders,
        { ...oldHeaders, cookie: adminSession },
      ]) {
        assert.equal((await web(route, { headers })).status, 403, route);
      }
    }
    assert.equal(hostReads, beforeRetiredScopeReads);
    const readPlan = () =>
      web(`${definitionRoot}/plan`, { headers: { cookie: adminSession } });
    const writePlan = (input: unknown) =>
      web(`${definitionRoot}/plan`, {
        method: "PUT",
        headers: {
          cookie: adminSession,
          origin: origin.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
    const initializeDefinition = () =>
      web(`${definitionRoot}/definition`, {
        method: "POST",
        headers: {
          cookie: adminSession,
          origin: origin.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedAbsence: true }),
      });
    const existingDefinitionState = path.join(
      candidate.target,
      ".crdd",
      "execution-model",
      "state.json",
    );
    // Workspaceの稼働中Graphと、編集可能な定義の反証は別の保存状態で検証する。
    // どちらもこの試験が作ったリポジトリ内に閉じる。
    const definitionDirectory = path.dirname(existingDefinitionState);
    const workspaceStorage = path.join(
      candidate.target,
      ".crdd",
      "workspace-fixture-storage",
    );
    fs.renameSync(definitionDirectory, workspaceStorage);
    canWriteHosted = false;
    const planResponse = await readPlan();
    assert.equal(planResponse.status, 200, await planResponse.clone().text());
    const beforePlan = await planResponse.json();
    assert.deepEqual(
      beforePlan,
      (await wsCall("crdd.get_execution_plan", definitionTarget)).result
        .structuredContent,
    );
    assert.equal((await initializeDefinition()).status, 403);
    assert.equal(
      (
        await wsCall("crdd.initialize_execution_definition", {
          ...definitionTarget,
          expectedAbsence: true,
        })
      ).error.code,
      -32603,
    );
    assert.equal(fs.existsSync(existingDefinitionState), false);
    canWriteHosted = true;
    const initialized = await initializeDefinition();
    assert.equal(initialized.status, 200, await initialized.clone().text());
    const initialDefinition = await initialized.json();
    assert.equal(
      initialDefinition.status,
      "saved",
      JSON.stringify(initialDefinition),
    );
    const beforeDefinition = fs.readFileSync(existingDefinitionState);
    assert.equal(
      (
        await wsCall("crdd.initialize_execution_definition", {
          ...definitionTarget,
          expectedAbsence: true,
        })
      ).result.structuredContent.reason,
      "target_exists",
    );
    assert.deepEqual(
      fs.readFileSync(existingDefinitionState),
      beforeDefinition,
    );
    assert.equal(beforePlan.status, "absent");
    assert.equal(beforePlan.version, null);
    const definition = {
      milestoneAcceptanceCriteria: ["確認"],
      objectives: [{ id: "objective", acceptanceCriteria: ["確認"] }],
      tasks: [
        {
          id: "task",
          objectiveId: "objective",
          dependencies: [],
          allowedPaths: ["source.txt"],
          conflictKeys: [],
        },
      ],
    };
    const savedPlan = await writePlan({
      expected: initialDefinition.version,
      expectedDefinitionHash: null,
      definition,
    });
    assert.equal(savedPlan.status, 200);
    const savedDefinition = await savedPlan.json();
    assert.equal(
      savedDefinition.status,
      "saved",
      JSON.stringify(savedDefinition),
    );
    assert.notDeepEqual(
      fs.readFileSync(existingDefinitionState),
      beforeDefinition,
    );
    const plan = (await wsCall("crdd.get_execution_plan", definitionTarget))
      .result.structuredContent;
    assert.equal(plan.status, "available");
    assert.deepEqual(plan.value.definition, definition);
    const planPatch = {
      expected: plan.version,
      expectedDefinitionHash: plan.value.definitionHash,
      definition: { ...definition, milestoneAcceptanceCriteria: ["更新"] },
    };
    const cancelledSave = new AbortController();
    const saveSource = await resolveTestOAuthSource(mcpToken, outer.signal);
    assert.ok(saveSource);
    const beforeDefinitionCancel = hostReads;
    const afterInitialSave = fs.readFileSync(existingDefinitionState);
    afterInstallationRead = () => {
      afterInstallationRead = undefined;
      cancelledSave.abort();
    };
    assert.equal(
      await invokeMcpSource(
        saveSource,
        packet("crdd.save_execution_plan", {
          repositoryId: candidate.id,
          ...definitionTarget,
          ...planPatch,
        }),
        outer.signal,
        cancelledSave.signal,
      ),
      null,
    );
    assert.equal(cancelledSave.signal.aborted, true);
    assert.equal(hostReads - beforeDefinitionCancel, 1);
    assert.deepEqual(
      fs.readFileSync(existingDefinitionState),
      afterInitialSave,
    );
    const interruptedWorkspaceId = randomUUID();
    const beforeGitState = path.join(
      candidate.target,
      ".crdd",
      "execution-model",
      "state.json",
    );
    let durableIntentObserved = false;
    const readInterrupted = () =>
      (
        JSON.parse(fs.readFileSync(beforeGitState, "utf8")) as {
          workspaces: {
            workspaceId: string;
            phase: string;
            pending?: { kind?: string };
          }[];
        }
      ).workspaces.find(
        (entry) => entry.workspaceId === interruptedWorkspaceId,
      );
    const manifestFile = path.join(
      candidate.target,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    const originalManifest = fs.readFileSync(manifestFile, "utf8");
    const changeDefinitionManifest = () =>
      fs.writeFileSync(
        manifestFile,
        JSON.stringify({
          ...JSON.parse(originalManifest),
          displayName: "変更された照合対象",
        }),
      );
    let definitionBeforePublication = false;
    const definitionOpen = fs.openSync;
    const blockDefinition = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof definitionOpen>) => {
        const fd = definitionOpen(...args);
        if (
          !definitionBeforePublication &&
          args[0] === existingDefinitionState
        ) {
          definitionBeforePublication = true;
          changeDefinitionManifest();
        }
        return fd;
      },
    );
    syncBuiltinESMExports();
    try {
      const refused = await writePlan(planPatch);
      assert.equal(refused.status, 503);
      assert.equal(definitionBeforePublication, true);
      assert.deepEqual(
        fs.readFileSync(existingDefinitionState),
        afterInitialSave,
      );
    } finally {
      blockDefinition.mock.restore();
      syncBuiltinESMExports();
      fs.writeFileSync(manifestFile, originalManifest);
    }
    let definitionAfterPublication = false;
    const definitionRename = fs.renameSync;
    const withholdDefinition = t.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof definitionRename>) => {
        definitionRename(...args);
        if (args[1] === existingDefinitionState) {
          definitionAfterPublication = true;
          changeDefinitionManifest();
        }
      },
    );
    syncBuiltinESMExports();
    try {
      const refused = await wsCall("crdd.save_execution_plan", {
        ...definitionTarget,
        ...planPatch,
      });
      assert.equal(refused.error.code, -32603);
      assert.equal(definitionAfterPublication, true);
      assert.notDeepEqual(
        fs.readFileSync(existingDefinitionState),
        afterInitialSave,
      );
    } finally {
      withholdDefinition.mock.restore();
      syncBuiltinESMExports();
      fs.writeFileSync(manifestFile, originalManifest);
    }
    assert.deepEqual(
      (await (await readPlan()).json()).value.definition,
      planPatch.definition,
    );
    fs.renameSync(
      definitionDirectory,
      path.join(candidate.target, ".crdd", "definition-fixture-storage"),
    );
    fs.renameSync(workspaceStorage, definitionDirectory);
    let manifestChanged = false;
    const openOwnerState = fs.openSync;
    const replaceManifest = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof openOwnerState>) => {
        const fd = openOwnerState(...args);
        if (!manifestChanged && args[0] === beforeGitState) {
          manifestChanged = true;
          fs.writeFileSync(
            manifestFile,
            originalManifest.replace("project.fixture", "project.other"),
          );
        }
        return fd;
      },
    );
    syncBuiltinESMExports();
    try {
      const rejectedRename = await wsWrite("PATCH", `/${workspaceId}`, {
        ...commonWorkspace,
        expectedGeneration: renamedWorkspace.data.workspace.generation,
        name: "反映してはいけない",
      });
      assert.equal(rejectedRename.status, 503);
      assert.equal(manifestChanged, true);
    } finally {
      replaceManifest.mock.restore();
      syncBuiltinESMExports();
      fs.writeFileSync(manifestFile, originalManifest);
    }
    const afterManifestChange = (
      await wsCall("crdd.get_workspace", {
        ...commonWorkspace,
        workspaceId,
      })
    ).result.structuredContent;
    assert.equal(afterManifestChange.data.workspace.name, "別名");
    assert.equal(
      afterManifestChange.data.workspace.generation,
      renamedWorkspace.data.workspace.generation,
    );

    const replaceState = fs.renameSync;
    const revokeAfterIntent = t.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof replaceState>) => {
        replaceState(...args);
        if (args[1] !== beforeGitState || durableIntentObserved) return;
        if (readInterrupted()?.pending?.kind === "create") {
          durableIntentObserved = true;
          assert.equal(removeHostedRegistration().status, "completed");
        }
      },
    );
    syncBuiltinESMExports();
    try {
      const interrupted = await wsWrite("POST", "", {
        ...createWorkspace,
        queueId: "queue-b",
        workspaceId: interruptedWorkspaceId,
      });
      assert.equal(interrupted.status, 503);
      assert.deepEqual(await interrupted.json(), {
        error: "workspace_outcome_unconfirmed",
      });
      assert.equal(durableIntentObserved, true);
      assert.equal(readInterrupted()?.phase, "creating");
      assert.equal(readInterrupted()?.pending?.kind, "create");
      assert.equal(
        fixtureGit(candidate.target, [
          "worktree",
          "list",
          "--porcelain",
        ]).includes(interruptedWorkspaceId),
        false,
      );
    } finally {
      revokeAfterIntent.mock.restore();
      syncBuiltinESMExports();
    }
    restoreHostedRegistration();
    assert.equal(
      (
        await web("/api/session/git/github", {
          method: "DELETE",
          headers: { origin: origin.origin, cookie: adminSession },
        })
      ).status,
      204,
    );
    assert.deepEqual(await mcpProjects(), []);
    const readManagementView = async (url: string) => {
      const reply = await web(url, { headers: { cookie: adminSession } });
      assert.equal(reply.status, 200, url);
      const value = await reply.json();
      assert.equal(value.formToken, formToken);
      return value;
    };
    const modifyManagement = (
      method: "POST" | "PATCH" | "PUT" | "DELETE",
      url: string,
      expectedRevision: number,
      input: Record<string, unknown>,
      options?: { cookie?: string; origin?: string },
    ) =>
      web(url, {
        method,
        headers: {
          cookie: options?.cookie ?? adminSession,
          origin: options?.origin ?? origin.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          formToken,
          operationId: randomUUID(),
          expectedRevision,
          ...input,
        }),
      });
    const currentAccess = await readManagementView("/api/access/me");
    assert.equal(currentAccess.user.userId, administrator.userId);
    assert.equal(
      (
        await web("/api/session/management", {
          method: "POST",
          headers: { origin: server.baseUrl, cookie: invitedCookie },
        })
      ).status,
      403,
    );
    const userUrl = `/api/users/${record.result.userId}`;
    const beforeCredential = fs.readFileSync(f.current);
    for (const [method, path] of [
      ["GET", "/api/credentials"],
      ["POST", `${userUrl}/credentials`],
      ["DELETE", "/api/credentials/000000000000000000000001"],
      ["POST", `${userUrl}/credential-exchange`],
      ["POST", "/api/credential-exchange"],
    ] as const) {
      const headers = { cookie: adminSession, origin: origin.origin };
      const response = await web(path, { method, headers });
      const unknown = await web("/api/unknown-retired-resource", {
        method,
        headers,
      });
      assert.equal(response.status, unknown.status);
      assert.equal(await response.text(), await unknown.text());
    }
    assert.deepEqual(fs.readFileSync(f.current), beforeCredential);
    const beforeUpdate = fs.readFileSync(f.current);
    const { revision: beforeName } = await readManagementView("/api/users");
    const normalSessionAccess = await web("/api/access/me", {
      headers: { cookie: adminCookie },
    });
    assert.equal(normalSessionAccess.status, 200);
    assert.equal(
      Object.hasOwn(await normalSessionAccess.json(), "formToken"),
      false,
    );
    const clock = Date.now;
    const expired = t.mock.method(Date, "now", () => clock() + 301_000);
    try {
      assert.equal(
        (
          await modifyManagement("PATCH", userUrl, beforeName, {
            username: "期限切れ",
          })
        ).status,
        401,
      );
    } finally {
      expired.mock.restore();
    }
    for (const [options, code] of [
      [{ cookie: adminCookie }, 401],
      [{ cookie: invitedCookie }, 401],
      [{ origin: "https://other.invalid" }, 403],
    ] as const)
      assert.equal(
        (
          await modifyManagement(
            "PATCH",
            userUrl,
            beforeName,
            { username: "書込み不可" },
            options,
          )
        ).status,
        code,
      );
    assert.equal(
      (
        await modifyManagement("PATCH", userUrl, beforeName, {
          username: "書込み不可",
          formToken: "old",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await modifyManagement("PATCH", userUrl, beforeName, {
          username: "書込み不可",
          userId: administrator.userId,
        })
      ).status,
      400,
    );
    assert.deepEqual(fs.readFileSync(f.current), beforeUpdate);
    const names = await Promise.all(
      ["表示名A", "表示名B"].map((username) =>
        modifyManagement("PATCH", userUrl, beforeName, { username }),
      ),
    );
    assert.deepEqual(names.map(({ status }) => status).sort(), [200, 409]);
    assert.deepEqual(
      await names.find(({ status }) => status === 409)?.json(),
      conflict,
    );
    const updatedUsers = await readManagementView("/api/users");
    assert.equal(updatedUsers.revision, beforeName + 1);
    assert.ok(
      ["表示名A", "表示名B"].includes(
        updatedUsers.users.find(
          ({ userId }: { userId: string }) => userId === record.result.userId,
        )?.username,
      ),
    );
    const requestedRole = { currentRole: "developer", nextRole: "manager" };
    const beforeStaleRole = fs.readFileSync(f.current);
    const staleRole = await modifyManagement(
      "PUT",
      `${userUrl}/role`,
      beforeName,
      requestedRole,
    );
    assert.equal(staleRole.status, 409);
    assert.deepEqual(await staleRole.json(), conflict);
    assert.deepEqual(fs.readFileSync(f.current), beforeStaleRole);
    assert.equal(
      (
        await modifyManagement(
          "PUT",
          `${userUrl}/role`,
          updatedUsers.revision,
          requestedRole,
        )
      ).status,
      200,
    );
    const repositoryUrl = `/api/repositories/${candidate.id}`;
    const beforeManagementHostReads = hostReads;
    const beforeRetiredWrites = fs.readFileSync(f.current);
    for (const route of [
      "/api/roles/developer/content-access",
      `${repositoryUrl}/exposure`,
    ]) {
      const retired = await modifyManagement(
        "PUT",
        route,
        updatedUsers.revision + 1,
        { workspaceIds: [] },
      );
      assert.ok([403, 404, 405].includes(retired.status), route);
    }
    assert.deepEqual(fs.readFileSync(f.current), beforeRetiredWrites);
    const registrations = await readManagementView("/api/repositories");
    const staleRemoval = await modifyManagement(
      "DELETE",
      repositoryUrl,
      registrations.revision - 1,
      {},
    );
    assert.equal(staleRemoval.status, 409);
    assert.deepEqual(await staleRemoval.json(), conflict);
    assert.deepEqual(fs.readFileSync(f.current), beforeRetiredWrites);
    assert.equal(
      (
        await modifyManagement(
          "DELETE",
          repositoryUrl,
          registrations.revision,
          {},
        )
      ).status,
      200,
    );
    assert.equal(hostReads, beforeManagementHostReads);
    const afterRemoval = await readManagementView("/api/repositories");
    assert.equal(
      afterRemoval.repositories.some(
        ({ repositoryId }: { repositoryId: string }) =>
          repositoryId === candidate.id,
      ),
      false,
    );
    assert.ok(fs.existsSync(candidate.body));
    const boundaryOperation = randomUUID();
    const managementLock = path.join(
      path.dirname(f.current),
      "access-management.state.lock",
    );
    const removeManagementLock = fs.rmSync;
    let removedBinding: AccessManagementState["users"][number]["accountLinks"];
    const replaceBinding = t.mock.method(
      fs,
      "rmSync",
      (...args: Parameters<typeof removeManagementLock>) => {
        removeManagementLock(...args);
        if (removedBinding || String(args[0]) !== managementLock) return;
        const state = JSON.parse(
          fs.readFileSync(f.current, "utf8"),
        ) as AccessManagementState;
        if (state.operationId !== boundaryOperation) return;
        const actor = state.users.find(
          ({ userId }) => userId === administrator.userId,
        );
        const link = actor?.accountLinks?.[0];
        assert.ok(actor && link);
        removedBinding = actor.accountLinks;
        actor.accountLinks = [{ ...link, bindingId: randomUUID() }];
        state.revision++;
        state.operationId = randomUUID();
        fs.writeFileSync(f.current, JSON.stringify(state));
      },
    );
    syncBuiltinESMExports();
    let afterBindingChange: AccessManagementState;
    try {
      const hidden = await modifyManagement(
        "PATCH",
        userUrl,
        afterRemoval.revision,
        {
          username: "保存済み・旧主体へ非公開",
          operationId: boundaryOperation,
        },
      );
      assert.equal(hidden.status, 401);
      assert.deepEqual(await hidden.json(), {
        error: "management_result_unavailable",
      });
      assert.ok(removedBinding);
      afterBindingChange = JSON.parse(
        fs.readFileSync(f.current, "utf8"),
      ) as AccessManagementState;
      assert.equal(
        afterBindingChange.users.find(
          ({ userId }) => userId === record.result.userId,
        )?.username,
        "保存済み・旧主体へ非公開",
      );
      const actor = afterBindingChange.users.find(
        ({ userId }) => userId === administrator.userId,
      );
      assert.ok(actor);
      actor.accountLinks = removedBinding;
      afterBindingChange.revision++;
      afterBindingChange.operationId = randomUUID();
      fs.writeFileSync(f.current, JSON.stringify(afterBindingChange));
    } finally {
      replaceBinding.mock.restore();
      syncBuiltinESMExports();
    }
    assert.equal(
      (
        await modifyManagement(
          "PUT",
          `/api/users/${administrator.userId}/role`,
          afterBindingChange.revision,
          {
            currentRole: "administrator",
            nextRole: "developer",
          },
        )
      ).status,
      200,
    );
    assert.equal(
      (await web("/api/users", { headers: { cookie: adminSession } })).status,
      403,
    );
    assert.equal(
      (await call(server.baseUrl, mcpToken, MCP_CURRENT_ACCESS_TOOL, {}))
        .status,
      200,
    );
    assert.equal(
      (
        await web("/api/session", {
          method: "DELETE",
          headers: { origin: server.baseUrl, cookie: adminSession },
        })
      ).status,
      204,
    );
    assert.equal(
      (await web("/api/users", { headers: { cookie: adminSession } })).status,
      401,
    );
    assert.equal(
      (await call(server.baseUrl, mcpToken, MCP_CURRENT_ACCESS_TOOL, {}))
        .status,
      401,
    );
  } finally {
    await server.close();
  }
});

test("OAuth MCPは旧公開範囲で内容を許可せず、現在の主体で管理を読む", async (t) => {
  const f = fixture(t);
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const user = state.users[0];
  const retainedRepository = f.targets[0];
  assert.ok(user && retainedRepository);
  const bindingId = randomUUID();
  user.role = "manager";
  user.accountLinks = [
    {
      issuer: "https://accounts.google.com",
      subject: "synthetic-google",
      bindingId,
    },
  ];
  const writeState = () => fs.writeFileSync(f.current, JSON.stringify(state));
  writeState();
  const before = fs.readFileSync(f.current);
  const token = "s".repeat(43);
  let expiresAt = Date.now() + 30_000;
  const server = await startMcpAuthenticatedStreamableHttp(
    createOAuthMcpResolver(f.root, async (candidate) => {
      if (candidate !== token) return { status: "rejected" };
      return {
        status: "completed",
        subject: `${user.userId}:${bindingId}`,
        expiresAt,
      };
    }),
    { port: 0 },
  );
  try {
    const base = `http://${server.host}:${server.port}`;
    const allResponse = await call(base, token, MCP_PROJECT_CONTEXT_LIST_TOOL);
    assert.equal(allResponse.status, 200);
    const all = await allResponse.json();
    assert.equal(all.error, undefined);
    assert.ok(state.registeredRepositories.length > 0);
    assert.deepEqual(all.result.structuredContent.projects, []);
    const management = await (
      await call(base, token, "crdd.list_access_users", {})
    ).json();
    assert.equal(management.result.structuredContent.status, "completed");
    for (const name of [
      "crdd.register_user",
      "crdd.update_user_name",
      "crdd.update_user_role",
      "crdd.update_role_content_access",
      "crdd.unregister_repository",
      "crdd.update_repository_exposure",
    ]) {
      const removed = await (await call(base, token, name, {})).json();
      assert.equal(removed.error.code, -32601, name);
    }
    assert.deepEqual(fs.readFileSync(f.current), before);
    assert.equal((await call(base, f.token)).status, 401);

    await t.test(
      "Gitホスト連携なしでは共有の開発対象を確定せず、Objectiveの開始・再開を拒否する",
      async () => {
        const session = {
          principal: {
            kind: "account" as const,
            userId: user.userId,
            bindingId,
            expiresAt,
          },
          readGitHost: readFixtureGitHost,
          repositoryScope: f.repositoryScope,
          readHostToken: () => null,
          isCurrent: () => true,
        };
        assert.equal(
          readCurrentAccess(f.root, session.principal).status,
          "completed",
        );
        assert.equal(
          await resolveHostedDevelopmentAccess(
            f.root,
            session,
            retainedRepository.id,
            true,
            new AbortController().signal,
          ),
          null,
        );

        let starts = 0;
        const key = `host-required-objective-${randomUUID()}`;
        const child = `export const runObjectiveInChild = globalThis[${JSON.stringify(key)}];`;
        const hook = registerHooks({
          resolve(specifier, context, next) {
            if (
              specifier === "./execution-child.ts" &&
              context.parentURL?.endsWith("/src/service/execution.ts")
            )
              return {
                url: `data:text/javascript,${encodeURIComponent(child)}`,
                shortCircuit: true,
              };
            return next(specifier, context);
          },
        });
        Reflect.set(globalThis, key, async () => {
          starts++;
          return null;
        });
        try {
          const request = {
            repositoryId: retainedRepository.id,
            ...withCallerPlan({
              requestId: "host-required.fixture",
              projectId: "project.fixture",
              milestoneId: "milestone.fixture",
              repositoryRevision: "a".repeat(40),
              objective: "試験用の実行要求",
              acceptanceCriteria: ["確認"],
              allowedPaths: ["PROJECT_CONTEXT.md"],
              readPaths: ["."],
              maximumConcurrency: 1,
              maximumReplans: 0,
              originLane: "interactive",
              adoptResult: false,
            }),
          };
          for (const tool of [
            "crdd.start_objective",
            "crdd.resume_objective",
          ]) {
            const response = await call(base, token, tool, request);
            assert.equal(response.status, 200, tool);
            const reply = await response.json();
            assert.equal(reply.result.isError, true, tool);
            assert.deepEqual(
              reply.result.structuredContent,
              {
                status: "blocked",
                reason: "mcp_execution_access_unavailable",
                cleanupConfirmed: true,
                manualRecoveryRequired: false,
                effectState: "no_effect",
              },
              tool,
            );
          }
          assert.equal(starts, 0);
          assert.deepEqual(fs.readFileSync(f.current), before);
        } finally {
          hook.deregister();
          Reflect.deleteProperty(globalThis, key);
        }
      },
    );

    await t.test("内容取得は登録参照のホストの資格だけを要求する", async () => {
      // 未設定のホストは資格を探さず、設定済みなら登録参照のホストだけを引く。
      const synthetic = structuredClone(state);
      const target = synthetic.registeredRepositories.find(
        (entry) => entry.repositoryId === retainedRepository.id,
      );
      assert.ok(target);
      const observed: string[] = [];
      try {
        for (const host of ["git.example.test", "github.com"]) {
          target.hostedRepository = {
            provider: "github",
            host,
            repositoryId: "92",
            providerData: { installationId: "7" },
          };
          synthetic.revision++;
          synthetic.operationId = randomUUID();
          fs.writeFileSync(f.current, JSON.stringify(synthetic));
          const access = await resolveHostedDevelopmentAccess(
            f.root,
            {
              principal: {
                kind: "account",
                userId: user.userId,
                bindingId,
                expiresAt,
              },
              readGitHost: readFixtureGitHost,
              repositoryScope: f.repositoryScope,
              readHostToken(host) {
                observed.push(host);
                return null;
              },
            },
            retainedRepository.id,
            true,
            new AbortController().signal,
          );
          assert.equal(access, null);
          assert.deepEqual(observed, host === "github.com" ? [host] : []);
        }
      } finally {
        fs.writeFileSync(f.current, before);
      }
    });

    state.registeredRepositories = state.registeredRepositories.filter(
      (item) => item.repositoryId === retainedRepository.id,
    );
    state.revision++;
    state.operationId = randomUUID();
    writeState();
    const reduced = await (
      await call(base, token, MCP_PROJECT_CONTEXT_LIST_TOOL)
    ).json();
    assert.deepEqual(reduced.result.structuredContent.projects, []);

    user.role = "developer";
    state.revision++;
    state.operationId = randomUUID();
    writeState();
    const downgraded = await (
      await call(base, token, "crdd.list_access_users", {})
    ).json();
    assert.deepEqual(downgraded.result.structuredContent, {
      status: "unavailable",
      reason: "management_read_rejected",
    });
    expiresAt = Date.now() - 1;
    assert.equal((await call(base, token)).status, 401);
    expiresAt = Date.now() + 30_000;
    user.accountLinks = [
      {
        issuer: "https://accounts.google.com",
        subject: "synthetic-google",
        bindingId: randomUUID(),
      },
    ];
    state.revision++;
    state.operationId = randomUUID();
    writeState();
    assert.equal((await call(base, token)).status, 401);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 共有の実行系Toolを現在の開発Repositoryと認証済みの本人へ結び付ける。
 * @trace EST-IT-010
 * @level IT
 * @boundary 実HTTPから一時AM・二つのGit Repository・Coordinatorの既存受付まで。
 * @oracle 選んだRepositoryだけを読み、開発権限なし・Project相違・暗黙対象を拒否する。
 */
test("OAuth MCPの実行系Toolは指定Repositoryの開発権限へ結び付く", async (t) => {
  const f = fixture(t);
  const hosted = hostedFixture(t, f.targets);
  const mcpBase = await openFixtureMcp(hosted, f.listeners);
  const [a, b] = f.targets;
  assert.ok(a && b);
  for (const target of f.targets) {
    const commit = spawnSync(
      "git",
      [
        "-C",
        target.target,
        "-c",
        "core.hooksPath=NUL",
        "-c",
        "commit.gpgSign=false",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        target.id,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10000 },
    );
    assert.equal(commit.status, 0, commit.stderr);
  }
  const repository = getRepository(a.target);
  assert.equal(repository.status, "completed");
  if (repository.status !== "completed") return;
  const revision = readRepositorySnapshot(repository.capability);
  assert.equal(revision?.status, "observed");
  if (revision?.status !== "observed") return;
  const query = {
    requestId: "state.fixture",
    projectId: "project.fixture",
    repositoryRevision: revision.revisionIdentity,
  };
  const queryTool = "crdd.get_execution_state";
  const { requestId, ...stateQuery } = query;
  const statePath = (repositoryId: string) =>
    `/api/repositories/${repositoryId}/runs/${requestId}`;
  await t.test("単体HTTPは起動RepositoryとそのGit主体を使う", async () => {
    const localEmail = spawnSync(
      "git",
      [
        "-C",
        a.target,
        "config",
        "--local",
        "user.email",
        "local@example.invalid",
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10000 },
    );
    assert.equal(localEmail.status, 0, localEmail.stderr);
    const logo = "04_UI/assets/brand/crdd-brand-icon-512x512.jpg";
    fs.mkdirSync(path.dirname(path.join(a.target, logo)), { recursive: true });
    fs.copyFileSync(
      path.resolve(import.meta.dirname, "../../../..", logo),
      path.join(a.target, logo),
    );
    const local = await startWorkbench({ workingDirectory: a.target });
    try {
      const url = `${local.baseUrl}${statePath(a.id)}`;
      const state = await fetch(`${url}?${new URLSearchParams(stateQuery)}`);
      assert.equal(state.status, 200);
      assert.equal(
        (await state.json()).reason,
        "coordinator_snapshot_not_initialized",
      );
      const requested = new URLSearchParams({
        ...stateQuery,
        repositoryId: b.id,
      });
      assert.equal((await fetch(`${url}?${requested}`)).status, 400);
      assert.equal(
        (
          await fetch(
            `${local.baseUrl}${statePath(b.id)}?${new URLSearchParams(stateQuery)}`,
          )
        ).status,
        403,
      );
      const scoped = new URLSearchParams({ ...stateQuery, queueId: "queue-a" });
      const scopedResponse = await fetch(`${url}?${scoped}`);
      assert.equal(scopedResponse.status, 200);
      assert.equal((await scopedResponse.json()).queueId, "queue-a");
      scoped.append("queueId", "queue-b");
      assert.equal((await fetch(`${url}?${scoped}`)).status, 400);
    } finally {
      await local.close();
    }
  });
  const server = await startWorkbench({
    workingDirectory: a.target,
  });
  try {
    const base = server.baseUrl;
    const invoke = async (name: string, args: Record<string, unknown>) => {
      const response = await call(mcpBase, hosted.mcpToken, name, args);
      const payload = await response.text();
      for (const target of f.targets)
        assert.equal(payload.includes(target.target), false);
      assert.equal(payload.includes(f.token), false);
      assert.equal(payload.includes(hosted.mcpToken), false);
      return JSON.parse(payload);
    };
    for (const path of ["/candidate/action", "/unknown"]) {
      const denied = await fetch(`${base}${path}`, {
        method: "POST",
      });
      assert.equal(denied.status, 405);
    }
    const selectedState = { ...query, repositoryId: a.id };
    const stateUrl = `${base}${statePath(a.id)}?${new URLSearchParams(stateQuery)}`;
    const read = await fetch(stateUrl);
    assert.equal(read.status, 200);
    assert.deepEqual(
      await read.json(),
      (await invoke(queryTool, selectedState)).result.structuredContent,
    );
    assert.equal((await invoke(queryTool, query)).error?.code, -32602);
    assert.equal(
      (await invoke(queryTool, { ...query, repositoryId: a.id })).result
        .structuredContent.reason,
      "coordinator_snapshot_not_initialized",
    );
    assert.equal(
      (await invoke(queryTool, { ...query, repositoryId: b.id })).result
        .structuredContent.reason,
      "coordinator_state_revision_mismatch",
    );
    for (const args of [
      { ...query, repositoryId: "repository.unknown" },
      { ...query, repositoryId: a.id, projectId: "project.other" },
    ]) {
      const denied = (await invoke(queryTool, args)).result.structuredContent;
      assert.equal(denied.reason, "mcp_execution_access_unavailable");
      assert.equal(denied.effectState, "no_effect");
    }
    const decision = {
      repositoryId: a.id,
      projectId: query.projectId,
      repositoryRevision: query.repositoryRevision,
      decisionId: "decision.absent",
      milestoneId: "milestone.fixture",
      generation: 1,
      selectedOption: "cancel",
    };
    assert.equal(
      (await invoke("crdd.answer_decision", decision)).result.structuredContent
        .reason,
      "coordinator_snapshot_absent",
    );
    const objective = {
      repositoryId: a.id,
      ...withCallerPlan({
        requestId: "objective.fixture",
        projectId: query.projectId,
        milestoneId: "milestone.fixture",
        repositoryRevision: query.repositoryRevision,
        objective: "Fixture; no AI start",
        acceptanceCriteria: ["confirmed"],
        allowedPaths: ["fixture.txt"],
        readPaths: ["README.md"],
        maximumConcurrency: 1,
        maximumReplans: 0,
        originLane: "interactive",
        adoptResult: true,
      }),
    };
    for (const tool of [
      "crdd.start_objective",
      "crdd.resume_objective",
    ] as const) {
      const result = (await invoke(tool, objective)).result.structuredContent;
      assert.equal(result.reason, "mcp_execution_access_unavailable");
      assert.equal(result.effectState, "no_effect");
    }
    const view = await fetch(`${base}/api/workbench/view`);
    const { actionToken } = await view.json();
    const {
      repositoryId: objectiveRepository,
      projectId,
      milestoneId,
      ...startBody
    } = objective;
    const startPath = `/api/repositories/${objectiveRepository}/projects/${projectId}/milestones/${milestoneId}/runs`;
    const resumePath = `/api/repositories/${objectiveRepository}/runs/${objective.requestId}/resumption`;
    const { requestId: _requestId, ...resumeBody } = startBody;
    const httpWrite = (
      path: string,
      input: object,
      token: string = actionToken,
    ) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          origin: base,
          "content-type": "application/json",
          "x-crdd-action-token": token,
        },
        body: JSON.stringify(input),
      });
    const decisionsPath = `/api/repositories/${decision.repositoryId}/projects/${decision.projectId}/milestones/${decision.milestoneId}/decisions`;
    const answerPath = `${decisionsPath}/${decision.decisionId}/answers`;
    const { selectedOption, ...decisionTarget } = decision;
    const decisionVersion = {
      repositoryRevision: decision.repositoryRevision,
      generation: decision.generation,
    };
    const requestFields = {
      blockerId: "blocker.fixture",
      queueId: "queue.fixture",
      question: "判断を確認してください",
      allowedOptions: ["cancel"],
    };
    const closeFields = { status: "invalidated", reason: "検証用の閉鎖" };
    assert.equal(
      (await httpWrite(startPath, startBody, "not-the-action-token")).status,
      403,
    );
    assert.equal(
      (await httpWrite(startPath, { ...startBody, operation: "resume" }))
        .status,
      400,
    );
    assert.equal(
      (
        await httpWrite(resumePath, {
          ...resumeBody,
          projectId,
          milestoneId,
          requestId: "other",
        })
      ).status,
      400,
    );
    assert.equal(
      (await invoke("crdd.run_objective", objective)).error?.code,
      -32601,
    );
    assert.equal(
      (
        await invoke("crdd.start_objective", {
          ...objective,
          operation: "resume",
        })
      ).error?.code,
      -32602,
    );
    for (const [http, tool, input] of [
      [
        await httpWrite(decisionsPath, {
          ...decisionVersion,
          decisionId: decision.decisionId,
          ...requestFields,
        }),
        "crdd.request_decision",
        { ...decisionTarget, ...requestFields },
      ],
      [
        await httpWrite(answerPath, { ...decisionVersion, selectedOption }),
        "crdd.answer_decision",
        decision,
      ],
      [
        await httpWrite(
          `${decisionsPath}/${decision.decisionId}/application`,
          decisionVersion,
        ),
        "crdd.apply_decision",
        decisionTarget,
      ],
      [
        await httpWrite(`${decisionsPath}/${decision.decisionId}/closure`, {
          ...decisionVersion,
          ...closeFields,
        }),
        "crdd.close_decision",
        { ...decisionTarget, ...closeFields },
      ],
    ] as const) {
      assert.equal(http.status, 200);
      assert.deepEqual(
        await http.json(),
        (await invoke(tool, input)).result.structuredContent,
      );
    }
    assert.equal(
      (
        await httpWrite(answerPath, {
          ...decisionVersion,
          selectedOption,
          operation: "apply",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await httpWrite(answerPath, {
          ...decisionVersion,
          selectedOption,
          decisionId: decision.decisionId,
        })
      ).status,
      400,
    );
    assert.equal(
      (await invoke("crdd.submit_decision", decision)).error?.code,
      -32601,
    );
    assert.equal(
      (
        await invoke("crdd.answer_decision", {
          ...decision,
          operation: "apply",
        })
      ).error?.code,
      -32602,
    );
    hosted.permissions.delete(a.id);
    for (const [name, args] of [
      [queryTool, { ...query, repositoryId: a.id }],
      ["crdd.answer_decision", decision],
      ["crdd.start_objective", objective],
    ] as const) {
      const denied = (await invoke(name, args)).result.structuredContent;
      assert.equal(denied.reason, "mcp_execution_access_unavailable");
      assert.equal(denied.effectState, "no_effect");
    }
    assert.equal(
      fs.existsSync(
        path.join(a.target, ".crdd", "execution-model", "state.json"),
      ),
      false,
    );
  } finally {
    await server.close();
  }
});

/**
 * 通常三Roleの本人を他Userから推定せず実HTTPで取得する。
 * @responsibility 本人readの最小閉結果と要求毎の現在性を検証する。
 * @trace RFD-IT-013
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @precondition 完了した自己生成AM、本人と非公開別User、実HTTP。
 * @stimulus 三Role、時間だけの経過、入力不正、事前取消、初回未完了、資格失効を要求する。
 * @observation Tool一覧・閉結果・直接Owner結果・現在File保持を照合する。
 * @oracle 内部管理候補と他User、資格、Rootは0。拒否と不明を空本人にしない。
 * @cleanup HTTP close確認後fixtureが所有Rootを回収する。
 * @boundary AM本人Owner→通常MCP Resolver→実HTTP。公開Launcher完成ではない。
 */
test("MCP本人readは三Roleの現在本人だけを実HTTPへ返す", async (t) => {
  const f = fixture(t);
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const actor = state.users[0];
  assert.ok(actor);
  const otherId = randomUUID();
  state.users.push({
    userId: otherId,
    username: "非公開別ユーザー",
    role: "developer",
  });
  const resolver = fixtureOAuthResolver(f);
  assert.equal(await resolver(f.token), null);
  const handler = await resolver(f.mcpToken);
  assert.ok(handler);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  try {
    for (const role of ["developer", "manager", "administrator"] as const) {
      actor.role = role;
      state.revision += 1;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const listed: McpResponse = await invokeMcpSource(
        handler,
        {
          ...packet(),
          method: "tools/list",
          params: { _meta: packet().params._meta },
        },
        new AbortController().signal,
      );
      const tools = (
        listed.result as { tools: { name: string; inputSchema: unknown }[] }
      ).tools;
      const definition = tools.find(
        (tool) => tool.name === MCP_CURRENT_ACCESS_TOOL,
      );
      assert.ok(definition);
      assert.deepEqual(definition.inputSchema, {
        type: "object",
        additionalProperties: false,
        required: [],
        properties: {},
      });
      assert.equal(tools.length, role === "developer" ? 46 : 48);
      for (const name of definitionTools)
        assert.ok(
          tools.some((tool) => tool.name === name),
          name,
        );
      assert.equal(
        tools.some((tool) => tool.name === "crdd.register_repository"),
        false,
      );
      const response = await (
        await call(base, f.mcpToken, MCP_CURRENT_ACCESS_TOOL, {})
      ).json();
      const result = response.result.structuredContent;
      assert.equal(result.status, "completed");
      assert.deepEqual(Object.keys(result).sort(), [
        "revision",
        "status",
        "user",
      ]);
      assert.deepEqual(result.user, {
        userId: actor.userId,
        username: actor.username,
        role,
      });
      assert.equal(result.revision, state.revision);
      assert.deepEqual(
        result,
        readCurrentAccess(f.root, {
          kind: "account",
          userId: f.userId,
          bindingId: f.bindingId,
          expiresAt: Date.now() + 60_000,
        }),
      );
      const unchangedState = fs.readFileSync(f.current);
      const later = Date.now() + 365 * 24 * 60 * 60 * 1000;
      const clock = t.mock.method(Date, "now", () => later);
      try {
        const laterResponse = await (
          await call(base, f.mcpToken, MCP_CURRENT_ACCESS_TOOL, {})
        ).json();
        assert.deepEqual(laterResponse.result.structuredContent, result);
        assert.deepEqual(fs.readFileSync(f.current), unchangedState);
      } finally {
        clock.mock.restore();
      }
      const wire = JSON.stringify(response);
      for (const hidden of [
        otherId,
        "非公開別ユーザー",
        f.mcpToken,
        f.root.root,
        "managementOperations",
        "bindingId",
        "credentialId",
        "verifier",
        "salt",
      ])
        assert.equal(wire.includes(hidden), false);
    }
    const before = fs.readFileSync(f.current);
    assert.equal(
      (
        await invokeMcpSource(
          handler,
          packet(MCP_CURRENT_ACCESS_TOOL, { userId: otherId }),
          new AbortController().signal,
        )
      ).error?.code,
      -32602,
    );
    const cancelled = new AbortController();
    cancelled.abort();
    assert.equal(
      (
        await invokeMcpSource(
          handler,
          packet(MCP_CURRENT_ACCESS_TOOL, {}),
          cancelled.signal,
        )
      ).error?.code,
      -32800,
    );
    assert.deepEqual(fs.readFileSync(f.current), before);
    revokeFixtureBinding(state);
    fs.writeFileSync(f.current, JSON.stringify(state));
    const denied = await invokeMcpSource(
      handler,
      packet(MCP_CURRENT_ACCESS_TOOL, {}),
      new AbortController().signal,
    );
    assert.deepEqual(
      (denied.result as { structuredContent: unknown }).structuredContent,
      {
        status: "unavailable",
        reason: "current_access_authentication_rejected",
      },
    );
    assert.equal(await resolver(f.mcpToken), null);
    const initial = fixture(t, false);
    assert.equal(await fixtureOAuthResolver(initial)(initial.mcpToken), null);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
  }
});

/**
 * 非鍵管理十操作を現在Roleから実HTTP保存へ接続する。
 * @responsibility 四読取り・六保存の結果、非開示、次要求の現在性を照合する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @precondition 自己生成の完了AM Storeと登録済みRepositoryを用意する。
 * @stimulus 全ロールで四つの読取りの一覧と旧六書込みの直接呼出しを試す。
 * @observation 実HTTP構造結果、降格後の拒否、変更されない管理ファイル。
 * @oracle 未登録の書込みを実行せず、現在の管理認可でだけ読む。
 * @cleanup Server終了待ち後、fixtureが所有Rootの不存在を確認する。
 * @boundary AM保存Owner→MCP→実HTTP。公開Launcher成立ではない。
 */
test("MCP管理は現在権限の読取りだけを公開し旧六書込みは全ロールで拒否する", async (t) => {
  const f = fixture(t);
  const [firstTarget, secondTarget] = f.targets;
  assert.ok(firstTarget && secondTarget);
  const resolver = fixtureOAuthResolver(f);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  try {
    const listRequest = {
      ...packet(),
      method: "tools/list",
      params: { _meta: packet().params._meta },
    };
    const handler = await resolver(f.mcpToken);
    assert.ok(handler);
    const deniedList = await invokeMcpSource(
      handler,
      listRequest,
      new AbortController().signal,
    );
    assert.equal((deniedList.result as { tools: unknown[] }).tools.length, 46);
    const before = fs.readFileSync(f.current);
    const deniedRead = await (
      await call(base, f.mcpToken, "crdd.list_access_users", {})
    ).json();
    assert.deepEqual(deniedRead.result.structuredContent, {
      status: "unavailable",
      reason: "management_read_rejected",
    });
    assert.deepEqual(fs.readFileSync(f.current), before);

    const state = JSON.parse(before.toString("utf8")) as AccessManagementState;
    const actor = state.users[0];
    assert.ok(actor);
    actor.role = "manager";
    fs.writeFileSync(f.current, JSON.stringify(state));
    const listed = await invokeMcpSource(
      handler,
      listRequest,
      new AbortController().signal,
    );
    const tools = (
      listed.result as {
        tools: {
          name: string;
          inputSchema: unknown;
        }[];
      }
    ).tools;
    assert.equal(tools.length, 48);
    assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length);
    assert.equal(
      tools.some((tool) => tool.name === "crdd.update_user_role"),
      false,
    );
    assert.equal(
      tools.some((tool) => tool.name === "crdd.change_user_role"),
      false,
    );
    assert.equal(
      tools.some((tool) => tool.name === "crdd.register_repository"),
      false,
    );
    for (const tool of tools.filter((tool) =>
      /access_users|role_content_access|registered_repositories|repository_exposure|register_user|update_user_name|update_user_role|unregister_repository/.test(
        tool.name,
      ),
    )) {
      const serialized = JSON.stringify(tool.inputSchema);
      for (const field of [
        "repositoryRoot",
        "bindingId",
        "token",
        "credentialId",
      ])
        assert.equal(serialized.includes(field), false);
    }
    for (const [name, field] of [
      ["crdd.list_access_users", "users"],
      ["crdd.list_registered_repositories", "repositories"],
    ]) {
      const response = await (await call(base, f.mcpToken, name, {})).json();
      const result = response.result.structuredContent;
      assert.equal(result.status, "completed");
      assert.equal(result.revision, state.revision);
      assert.deepEqual(
        Object.keys(result).sort(),
        [field, "revision", "status"].sort(),
      );
      for (const value of [
        f.mcpToken,
        "bindingId",
        "repositoryRoot",
        f.current,
      ])
        assert.equal(JSON.stringify(response).includes(value), false);
    }
    const invalid = await (
      await call(base, f.mcpToken, "crdd.list_access_users", {
        token: f.mcpToken,
      })
    ).json();
    assert.equal(invalid.error.code, -32602);
    const retiredWrites = [
      ["crdd.register_user", { username: "登録", plannedRole: "developer" }],
      ["crdd.update_user_name", { userId: actor.userId, username: "変更" }],
      [
        "crdd.update_user_role",
        { userId: actor.userId, currentRole: "manager", nextRole: "developer" },
      ],
      [
        "crdd.update_role_content_access",
        { targetRole: "developer", workspaceIds: [] },
      ],
      [
        "crdd.update_repository_exposure",
        { repositoryId: firstTarget.id, workspaceIds: [] },
      ],
      ["crdd.unregister_repository", { repositoryId: secondTarget.id }],
    ] as const;
    for (const role of ["administrator", "manager", "developer"] as const) {
      actor.role = role;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const snapshot = fs.readFileSync(f.current);
      const refreshed: McpResponse = await invokeMcpSource(
        handler,
        listRequest,
        new AbortController().signal,
      );
      const names: string[] = (
        refreshed.result as { tools: { name: string }[] }
      ).tools.map(({ name }) => name);
      assert.ok(names.includes("crdd.get_current_access"));
      for (const name of Object.values(MCP_ACCESS_MANAGEMENT_READ_TOOLS))
        assert.equal(names.includes(name), role !== "developer");
      for (const name of [
        "crdd.list_role_content_access",
        "crdd.list_repository_exposure",
      ])
        assert.ok(!names.includes(name), name);
      for (const [name, input] of retiredWrites) {
        assert.ok(!names.includes(name), name);
        const response = await (
          await call(base, f.mcpToken, name, {
            ...input,
            expectedRevision: state.revision,
            operationId: randomUUID(),
          })
        ).json();
        assert.equal(response.error.code, -32601, name);
      }
      assert.deepEqual(fs.readFileSync(f.current), snapshot);
    }
    assert.ok(fs.existsSync(secondTarget.body));
    const downgraded = await (
      await call(base, f.mcpToken, "crdd.list_access_users", {})
    ).json();
    assert.deepEqual(downgraded.result.structuredContent, {
      status: "unavailable",
      reason: "management_read_rejected",
    });
    const cancelled = new AbortController();
    cancelled.abort();
    const cancellation = await invokeMcpSource(
      handler,
      packet("crdd.list_access_users", {}),
      cancelled.signal,
    );
    assert.equal(cancellation.error?.code, -32800);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/** 本物のアクセス管理と確認済みの試験セッションを現行RESTへ結び付ける。 */
async function managementFixture(
  f: ReturnType<typeof fixture>,
  userId: string,
) {
  const binding = { userId, bindingId: f.bindingId };
  const server = await startManagementHttpFixture(
    f.root,
    { kind: "account", ...binding, expiresAt: Date.now() + 60_000 },
    () =>
      readAccount(
        f.root,
        { issuer: "https://accounts.google.com", subject: userId },
        binding,
      ),
  );
  f.listeners.push(server.close);
  return server;
}

test("改訂が古くても権限のない管理操作や不明な対象に競合を返さない", async (t) => {
  const f = fixture(t);
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const actor = state.users[0];
  assert.ok(actor && state.revision > 1);
  const administratorId = randomUUID();
  state.users.push({
    userId: administratorId,
    username: "別の管理者",
    role: "administrator",
  });
  const server = await managementFixture(f, actor.userId);
  try {
    for (const { role, method, route, fields, status } of [
      {
        role: "developer",
        method: "PATCH",
        route: actor.userId,
        fields: { username: "拒否" },
        status: 403,
      },
      {
        role: "manager",
        method: "PUT",
        route: `${actor.userId}/role`,
        fields: { currentRole: "manager", nextRole: "administrator" },
        status: 403,
      },
      {
        role: "manager",
        method: "PATCH",
        route: administratorId,
        fields: { username: "管理者名は変更不可" },
        status: 403,
      },
      {
        role: "manager",
        method: "PATCH",
        route: randomUUID(),
        fields: { username: "不存在" },
        status: 403,
      },
      {
        role: "manager",
        method: "PATCH",
        route: actor.userId,
        fields: { username: "競合" },
        status: 409,
      },
    ] as const) {
      actor.role = role;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const before = fs.readFileSync(f.current);
      const response = await fetch(`${server.baseUrl}/api/users/${route}`, {
        method,
        headers: {
          cookie: server.cookie,
          origin: server.baseUrl,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...fields,
          expectedRevision: state.revision - 1,
          operationId: randomUUID(),
          formToken: server.formToken,
        }),
      });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), {
        status: "rejected",
        reason:
          status === 409
            ? "management_revision_conflict"
            : "management_request_rejected",
      });
      assert.deepEqual(fs.readFileSync(f.current), before);
    }
    const beforeReleaseFailure = fs.readFileSync(f.current);
    const release = fs.rmSync;
    const lockFile = path.join(
      path.dirname(f.current),
      "access-management.state.lock",
    );
    let releaseFailures = 0;
    try {
      fs.rmSync = (target, options) => {
        if (String(target) === lockFile) {
          releaseFailures++;
          throw Error("fixture_conflict_release_failure");
        }
        return release(target, options);
      };
      const failedRelease = await fetch(
        `${server.baseUrl}/api/users/${actor.userId}`,
        {
          method: "PATCH",
          headers: {
            cookie: server.cookie,
            origin: server.baseUrl,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            username: "解放不明",
            expectedRevision: state.revision - 1,
            operationId: randomUUID(),
            formToken: server.formToken,
          }),
        },
      );
      assert.equal(failedRelease.status, 503);
      assert.deepEqual(await failedRelease.json(), {
        error: "management_result_unavailable",
      });
    } finally {
      fs.rmSync = release;
    }
    assert.equal(releaseFailures, 1);
    assert.deepEqual(fs.readFileSync(f.current), beforeReleaseFailure);
  } finally {
    await server.close();
  }
});

/**
 * 通常管理RESTの出版・清掃・解放故障と実保存を照合する。
 * @responsibility 状態が観測不能なときの非公開と自動再送0を確認する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @precondition 自己生成のmanager Storeと通常HTTP接続。
 * @stimulus 対象Rootのrename、pending清掃、保存後Lock清掃へ個別故障を注入する。
 * @observation 呼出し回数、HTTP閉結果、実現在Fileの改訂と名前。
 * @oracle 503の固定応答、三故障の実現と実保存の成否を別々に確認する。
 * @cleanup 全差替えを復元しServerをjoinしてfixture所有Rootを回収する。
 * @boundary 実Filesystem→AM結果→Workbench HTTP。
 */
test("管理RESTは保存故障を再送せず、確かめられない結果を公開しない", async (t) => {
  for (const stage of ["publication", "cleanup", "release"] as const) {
    await t.test(stage, async (child) => {
      const f = fixture(child);
      const state = JSON.parse(
        fs.readFileSync(f.current, "utf8"),
      ) as AccessManagementState;
      const actor = state.users[0];
      assert.ok(actor);
      actor.role = "manager";
      fs.writeFileSync(f.current, JSON.stringify(state));
      const server = await managementFixture(f, actor.userId);
      const rename = fs.renameSync,
        remove = fs.rmSync;
      const parent = path.dirname(f.current);
      let injected = 0,
        publications = 0;
      try {
        fs.renameSync = ((from, to) => {
          if (String(to) === f.current) {
            publications++;
            if (stage === "publication") {
              injected++;
              throw new Error("fixture_publication_failure");
            }
          }
          return rename(from, to);
        }) as typeof fs.renameSync;
        fs.rmSync = ((target, options) => {
          const file = String(target);
          if (
            stage === "cleanup" &&
            file === path.join(parent, "access-management.pending.json")
          ) {
            injected++;
            throw new Error("fixture_cleanup_failure");
          }
          if (
            stage === "release" &&
            file === path.join(parent, "access-management.state.lock") &&
            (
              JSON.parse(
                fs.readFileSync(f.current, "utf8"),
              ) as AccessManagementState
            ).revision ===
              state.revision + 1
          ) {
            injected++;
            throw new Error("fixture_release_failure");
          }
          return remove(target, options);
        }) as typeof fs.rmSync;
        const operationId = randomUUID();
        const response = await fetch(
          `${server.baseUrl}/api/users/${actor.userId}`,
          {
            method: "PATCH",
            headers: {
              cookie: server.cookie,
              origin: server.baseUrl,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              formToken: server.formToken,
              expectedRevision: state.revision,
              operationId,
              username: "故障確認後の名前",
            }),
          },
        );
        assert.equal(response.status, 503);
        const result = await response.json();
        assert.deepEqual(result, { error: "management_result_unavailable" });
        assert.equal(publications, 1);
        assert.equal(injected, 1);
        const observed = JSON.parse(
          fs.readFileSync(f.current, "utf8"),
        ) as AccessManagementState;
        assert.equal(
          observed.revision,
          state.revision + (stage === "publication" ? 0 : 1),
        );
        assert.equal(
          observed.users[0]?.username,
          stage === "publication" ? actor.username : "故障確認後の名前",
        );
        for (const forbidden of [
          f.token,
          f.current,
          "lockRecoveryId",
          "state_store_",
          "fixture_",
        ])
          assert.equal(JSON.stringify(result).includes(forbidden), false);
      } finally {
        fs.renameSync = rename;
        fs.rmSync = remove;
        await server.close();
      }
    });
  }
});

/**
 * 実Client切断を保存後のTransport取消へ接続する。
 * @responsibility 同期保存の既知出版と成功応答の抑止を別に観測する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @precondition 自己生成manager、実HTTP、対象出版だけのrename hook。
 * @stimulus 出版直後にClientを切断する場合と、Serverが切断を観測済みの場合を分ける。
 * @observation Client本文、観測済みの成功応答発行、保存改訂、次要求の現在投影。
 * @oracle Client本文0、観測済みなら成功応答発行0。保存を戻さず自動再送しない。
 * @cleanup 各ClientとServerを閉じ、試験の所有領域を回収する。
 * @boundary 実Client／Socket→Transport signal→同期AM保存後の公開。
 */
test("Workbench HTTPは管理保存直後の切断でも保存済み結果を失わない", {
  timeout: 15000,
}, async (t) => {
  for (const mode of ["client", "observed"] as const) {
    await t.test(mode, async (child) => {
      const f = fixture(child);
      const state = JSON.parse(
        fs.readFileSync(f.current, "utf8"),
      ) as AccessManagementState;
      const actor = state.users[0];
      assert.ok(actor);
      actor.role = "manager";
      fs.writeFileSync(f.current, JSON.stringify(state));
      const server = await managementFixture(f, actor.userId);
      try {
        const operationId = randomUUID();
        const requestPath = `/api/users/${actor.userId}`;
        const body = JSON.stringify({
          formToken: server.formToken,
          expectedRevision: state.revision,
          operationId,
          username: "取消後の保存済み名前",
        });
        let receivedBytes = 0;
        const client = httpRequest(
          new URL(requestPath, server.baseUrl),
          {
            method: "PATCH",
            headers: {
              cookie: server.cookie,
              origin: server.baseUrl,
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
          },
          (response) => {
            response.on("data", (chunk: Buffer) => {
              receivedBytes += chunk.length;
            });
          },
        );
        client.on("error", () => {});
        const closed = new Promise<void>((resolve) =>
          client.once("close", resolve),
        );
        const rename = fs.renameSync;
        let publications = 0;
        let ownerResponse: ServerResponse | undefined;
        let successBodies = 0;
        let observed = false;
        const originalEmit = Server.prototype.emit;
        const originalEnd = ServerResponse.prototype.end;
        const capture = child.mock.method(
          Server.prototype,
          "emit",
          function (this: Server, event: string | symbol, ...args: unknown[]) {
            if (event === "request") {
              const [request, response] = args as [
                IncomingMessage,
                ServerResponse,
              ];
              if (
                request.url === requestPath &&
                request.method === "PATCH" &&
                request.headers.host === new URL(server.baseUrl).host
              )
                ownerResponse = response;
            }
            return Reflect.apply(originalEmit, this, [event, ...args]);
          },
        );
        const emitted = child.mock.method(
          ServerResponse.prototype,
          "end",
          function (
            this: ServerResponse,
            ...args: Parameters<ServerResponse["end"]>
          ) {
            if (
              this === ownerResponse &&
              this.statusCode === 200 &&
              args[0] !== undefined
            )
              successBodies++;
            return originalEnd.apply(this, args);
          },
        );
        try {
          fs.renameSync = (from, to) => {
            rename(from, to);
            if (String(to) === f.current) {
              publications++;
              if (mode === "observed") {
                assert.ok(ownerResponse);
                ownerResponse.destroy();
                observed = ownerResponse.destroyed;
              } else {
                client.destroy();
              }
            }
          };
          client.end(body);
          await closed;
          assert.equal(publications, 1);
          if (mode === "observed") {
            assert.ok(ownerResponse, "管理PATCHの応答を観測");
            assert.equal(observed, true);
            assert.equal(successBodies, 0);
          }
          assert.equal(receivedBytes, 0);
        } finally {
          capture.mock.restore();
          emitted.mock.restore();
          fs.renameSync = rename;
          client.destroy();
          await closed;
        }
        const current = JSON.parse(
          fs.readFileSync(f.current, "utf8"),
        ) as AccessManagementState;
        assert.equal(current.revision, state.revision + 1);
        assert.equal(current.operationId, operationId);
        assert.equal(current.users[0]?.username, "取消後の保存済み名前");
        const response = await fetch(`${server.baseUrl}/api/users`, {
          headers: { cookie: server.cookie },
        });
        const projected = await response.json();
        assert.equal(projected.revision, current.revision);
        assert.equal(projected.users[0].username, "取消後の保存済み名前");
      } finally {
        await server.close();
      }
    });
  }
});

/**
 * 全ロールで旧AI設定管理の公開を撤去する。
 * @responsibility Role管理とRepository内容認可を維持したまま旧四操作を非公開にする。
 * @trace RFD-IT-013
 * @trace RCM-IT-010
 * @precondition 自己生成AM領域と既存HTTP Transportを使う。
 * @stimulus developer／manager／administratorで一覧と旧四操作を要求する。
 * @observation 公開一覧、未知Tool拒否、管理状態改訂。
 * @oracle 全ロールで四操作不在、call拒否、操作後のAM改訂不変。
 * @cleanup Server closeと所有fixtureの清掃・不存在を確認する。
 * @boundary 現在AM認証→実HTTP→SDKの固定登録。
 */
test("全ロールで旧Profile四操作は一覧に存在せず呼出しを拒否する", async (t) => {
  const f = fixture(t);
  const resolver = fixtureOAuthResolver(f);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const user = state.users[0];
  assert.ok(user);
  const retired = [
    "crdd.list_ai_profiles",
    "crdd.create_ai_profile",
    "crdd.update_ai_profile",
    "crdd.delete_ai_profile",
  ];
  try {
    for (const role of ["developer", "manager", "administrator"] as const) {
      user.role = role;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const before = fs.readFileSync(f.current);
      const handler = await resolver(f.mcpToken);
      assert.ok(handler);
      const list = await invokeMcpSource(
        handler,
        {
          ...packet(),
          method: "tools/list",
          params: { _meta: packet().params._meta },
        },
        new AbortController().signal,
      );
      assert.ok("result" in list);
      for (const name of retired) {
        assert.equal(JSON.stringify(list).includes(name), false);
        const response = await call(
          base,
          f.mcpToken,
          name,
          name.endsWith("list_ai_profiles")
            ? {}
            : {
                expectedRevision: 1,
                profileId: "PROFILE-900042",
                profile: { profileId: "PROFILE-900042" },
                confirmed: true,
              },
        );
        assert.equal((await response.json()).error.code, -32601);
      }
      assert.deepEqual(fs.readFileSync(f.current), before);
    }
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 活動Ownerへの現在認可接続を実HTTPと自己生成保存領域で確認する。
 * @responsibility 別Projectと空公開範囲を非開示にし、毎Callの許可変更を反映する。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 初回完了済み資格と同Projectの二Repository。
 * @stimulus 不存在取得、対象ごとの状態／履歴保存、異Project、登録結合の切断、Gitホスト権限喪失、紐付け失効を送る。
 * @observation 実HTTP応答、全Sourceと実Git改訂、現在Owner、状態・履歴の値と非秘密結果。
 * @oracle 明示Repositoryの状態または履歴だけを搬送し、対象結合喪失時は公開せず、紐付け失効は新規要求を401とする。
 * @cleanup Listener終了後にFixture所有Rootを回収する。
 * @boundary 実HTTP→現在AM認可→実Coordinator保存Reader。
 */
test("共有MCPの実行活動は明示Repositoryと現在のGitホスト権限に従う", async (t) => {
  const f = hostedFixture(t);
  const repositoryHeads = f.targets.map(({ id, target }) => {
    const committed = spawnSync(
      "git",
      [
        "-C",
        target,
        "-c",
        "user.name=Activity Fixture",
        "-c",
        "user.email=activity@example.invalid",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(committed.status, 0, committed.stderr);
    const revision = spawnSync("git", ["-C", target, "rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(revision.status, 0, revision.stderr);
    return { repositoryId: id, revision: revision.stdout.trim() };
  });
  const sourcesWithoutState = repositoryHeads.map(({ repositoryId }) => ({
    repositoryId,
    revision: null,
  }));
  const server = await startMcpAuthenticatedStreamableHttp(
    fixtureOAuthResolver(f),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  try {
    const a = f.targets[0],
      b = f.targets[1],
      sourceA = repositoryHeads[0];
    assert.ok(a && b && sourceA);
    const response = await call(base, f.mcpToken, EXECUTION_ACTIVITY_TOOL, {
      projectId: "project.fixture",
      repositoryId: a.id,
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    const observed = JSON.parse(text).result.structuredContent;
    assert.equal(observed.projectId, "project.fixture");
    assert.equal(observed.state, "absent");
    assert.equal(observed.reason, "runtime_activity_state_absent");
    assert.deepEqual(observed.sources, [sourcesWithoutState[0]]);
    assert.equal(observed.eventState, "observed");
    assert.deepEqual(observed.events, []);
    assert.equal(observed.eventContinuation, null);
    assert.equal(text.includes(f.mcpToken), false);
    for (const target of f.targets)
      assert.equal(text.includes(target.target), false);
    const foreign = await call(base, f.mcpToken, EXECUTION_ACTIVITY_TOOL, {
      projectId: "project.other",
      repositoryId: a.id,
    });
    assert.equal((await foreign.json()).result.isError, true);
    const binding = `binding-${createHash("sha256").update(a.target).digest("hex").slice(0, 40)}`;
    const repository = getRepository(a.target);
    assert.equal(repository.status, "completed");
    if (repository.status !== "completed")
      throw Error("fixture_repository_invalid");
    assert.equal(
      initializeExecutionStore({ directory: a.target }, binding).status,
      "completed",
    );
    const saved = projectExecutionFixture({
      taskExecutionSelections: taskExecutionSelections(),
      projectId: "project.fixture",
      milestoneId: "milestone.fixture",
      repositoryRevision: sourceA.revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["accepted"],
      objectives: [
        { id: "objective.fixture", acceptanceCriteria: ["accepted"] },
      ],
      tasks: [
        {
          id: "task.fixture",
          objectiveId: "objective.fixture",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: [],
        },
      ],
      ownerGeneration: "owner.fixture",
    });
    assert.ok(saved.state);
    assert.equal(
      createQueue({ directory: a.target }, binding, {
        kind: "scheduled",
        input: [
          {
            queueId: "queue.fixture",
            projectId: "project.fixture",
            milestoneId: "milestone.fixture",
            requestHash: createHash("sha256")
              .update("activity-request")
              .digest("hex"),
            originLane: "interactive",
            repositoryRevision: sourceA.revision,
            scopeHash: createHash("sha256")
              .update("activity-scope")
              .digest("hex"),
          },
          initialExecutionInput(saved.state),
        ],
      }).status,
      "completed",
    );
    const history = {
      executionId: `execution-${
        {
          projectId: "project.fixture",
          milestoneId: "milestone.fixture",
          objectiveId: "objective.fixture",
          taskId: "task.history",
          attemptId: "attempt.history",
          operationId: "operation.history",
        }.operationId
      }`,
      application: "CRDD",
      operation: "task_attempt",
      startedAt: "2026-10-12T00:00:00.000Z",
      metadata: {
        projectId: "project.fixture",
        milestoneId: "milestone.fixture",
        objectiveId: "objective.fixture",
        taskId: "task.history",
        attemptId: "attempt.history",
        operationId: "operation.history",
      },
      state: "closed",
      completion: {
        endedAt: "2026-10-12T00:00:00.000Z",
        elapsedMs: {
          state: "not_observed",
          reason: "fixture_duration_not_observed",
        },
        outcome: {
          status: "completed",
          reason: "task_completed",
        },
        diagnostic: {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
        },
        retention: "standard",
      },
    } satisfies Parameters<typeof storeFixtureExecution>[1];
    const ei = getRepository(b.target);
    assert.equal(ei.status, "completed");
    if (ei.status !== "completed") throw new Error("fixture_ei_root_invalid");
    assert.equal(
      storeFixtureExecution(ei.capability, history).status,
      "completed",
    );
    const presentResponse = await call(
      base,
      f.mcpToken,
      EXECUTION_ACTIVITY_TOOL,
      {
        projectId: "project.fixture",
        repositoryId: a.id,
      },
    );
    const presentText = await presentResponse.text();
    const present = JSON.parse(presentText).result.structuredContent;
    assert.equal(present.state, "observed");
    assert.equal(present.currentSourceRepositoryId, a.id);
    assert.equal(present.projection.projectId, "project.fixture");
    assert.equal(present.projection.milestoneId, "milestone.fixture");
    assert.equal(present.projection.taskCounts.ready, 1);
    assert.deepEqual(present.sources, [sourceA]);
    assert.deepEqual(present.events, []);
    const historyResult = await call(
      base,
      f.mcpToken,
      EXECUTION_ACTIVITY_TOOL,
      {
        projectId: "project.fixture",
        repositoryId: b.id,
      },
    );
    const historyEvents = (await historyResult.json()).result.structuredContent
      .events;
    assert.deepEqual(historyEvents, [
      {
        repositoryId: b.id,
        eventId: activityId(history.executionId),
        occurredAt: history.completion?.endedAt,
        objectiveId: "objective.fixture",
        taskId: "task.history",
        attemptId: "attempt.history",
        status: "completed",
        reason: "task_completed",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
      },
    ]);
    assert.equal(presentText.includes(f.mcpToken), false);
    for (const target of f.targets)
      assert.equal(presentText.includes(target.target), false);
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    const registration = state.registeredRepositories.find(
      ({ repositoryId }) => repositoryId === a.id,
    );
    assert.ok(registration);
    delete registration.hostedRepository;
    state.revision++;
    state.operationId = randomUUID();
    const snapshotFile = path.join(
      a.target,
      ".crdd",
      "execution-model",
      "state.json",
    );
    const open = fs.openSync;
    let revokedDuringObservation = false;
    const revoke = t.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof open>) => {
        const descriptor = open(...args);
        if (
          args[0] === snapshotFile &&
          args[1] === fs.constants.O_RDONLY &&
          !revokedDuringObservation
        ) {
          fs.writeFileSync(f.current, JSON.stringify(state));
          revokedDuringObservation = true;
        }
        return descriptor;
      },
    );
    let withheldText: string;
    try {
      const withheld = await call(base, f.mcpToken, EXECUTION_ACTIVITY_TOOL, {
        projectId: "project.fixture",
        repositoryId: a.id,
      });
      assert.equal(withheld.status, 200);
      withheldText = await withheld.text();
    } finally {
      revoke.mock.restore();
    }
    assert.ok(revokedDuringObservation);
    const withheld = JSON.parse(withheldText);
    assert.equal(withheld.error?.code, -32603);
    assert.equal(withheld.result, undefined);
    for (const nonPublic of [
      a.id,
      b.id,
      "queue.fixture",
      "milestone.fixture",
      activityId(history.executionId),
    ])
      assert.equal(withheldText.includes(nonPublic), false);
    const partial = await call(base, f.mcpToken, EXECUTION_ACTIVITY_TOOL, {
      projectId: "project.fixture",
      repositoryId: b.id,
    });
    const partialText = await partial.text();
    const remaining = JSON.parse(partialText).result.structuredContent;
    assert.deepEqual(remaining.sources, [sourcesWithoutState[1]]);
    assert.equal(remaining.state, "absent");
    assert.equal(remaining.currentSourceRepositoryId, null);
    assert.equal(remaining.projection, null);
    assert.deepEqual(remaining.events, historyEvents);
    assert.equal(partialText.includes(a.id), false);
    assert.equal(partialText.includes("milestone.fixture"), false);
    f.permissions.clear();
    const denied = await call(base, f.mcpToken, EXECUTION_ACTIVITY_TOOL, {
      projectId: "project.fixture",
      repositoryId: b.id,
    });
    const deniedBody = await denied.text();
    assert.equal(JSON.parse(deniedBody).result.isError, true);
    for (const target of f.targets)
      assert.equal(deniedBody.includes(target.id), false);
    revokeFixtureBinding(state);
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.equal(
      (
        await call(base, f.mcpToken, EXECUTION_ACTIVITY_TOOL, {
          projectId: "project.fixture",
        })
      ).status,
      401,
    );
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 自己生成の管理Storeと二Repositoryを準備する。
 * @responsibility 実Hostや秘密値を使わず現在認証・登録・公開の前提を構成する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition Repository-localの試験Rootだけに書き込む。
 * @stimulus 初回公開保存APIと登録／Exposure APIを使用し、完了状態は試験fixtureで準備する。
 * @observation 保存状態・Git初期化・各公開管理結果。
 * @oracle 実配送成立は主張せず、二つの認可対象を同じProjectへ用意する。
 * @cleanup 呼出側のListener終了後に所有Directoryだけを削除し不存在を確認する。
 * @boundary 自己生成Filesystem、Git、AM公開保存入口。
 */
/**
 * 両公開入口を同じ実Git／Writer／現在認可へ接続する。
 * @responsibility Transportの違いで業務処理と認可を複製しないことを反証する。
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @trace EST-IT-002
 * @precondition 自己生成AM、二Repositoryと二受付。
 * @stimulus 三Role、management限定、余分なfield、固定・Merge・終了。
 * @observation 実HTTP、実Git二親、固定差分、認可拒否と他Root無変更。
 * @oracle development許可時だけ同一Ownerへ一回処置し自動採用しない。
 * @cleanup 両Listener終了後fixtureのexact Rootを回収する。
 * @boundary loopback HTTP、実Git、Snapshot。外部AI／Dockerなし。
 */
test("WorkspaceはWorkbenchとMCPから同じ現在認可・実Gitへ接続する", async (t) => {
  const f = fixture(t);
  const hosted = hostedFixture(t, f.targets);
  const [target, other] = f.targets;
  assert.ok(target && other);
  const assertOtherStorageUntouched = () => {
    for (const name of ["execution-model", "workspaces"])
      assert.equal(
        fs.existsSync(path.join(other.target, ".crdd", name)),
        false,
        name,
      );
  };
  assertOtherStorageUntouched();
  /**
   * 公開Workspace試験の対象Repositoryへ固定Git要求を出す。
   * @responsibility 公開Workspace試験の対象Repositoryへ固定Git要求を出す。
   * @trace CPR-IT-001
   * @trace CPR-IT-004
   * @trace CPR-IT-006
   * @precondition 自己生成targetと固定argv。
   * @stimulus hooksと署名を無効化してGitを同期実行する。
   * @observation 終了statusとtrim済みstdout。
   * @oracle status0だけを正常な候補・Merge観測として返す。
   * @cleanup Server終了後にfixtureが所有Rootを回収する。
   * @boundary 合成Repositoryのlocal Git。外部AIなし。
   */
  const run = (args: string[]) => {
    const result = spawnSync(
      "git",
      [
        "-C",
        target.target,
        "-c",
        "core.hooksPath=NUL",
        "-c",
        "commit.gpgSign=false",
        ...args,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10000 },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  run(["symbolic-ref", "HEAD", "refs/heads/main"]);
  run(["config", "user.name", "Surface Test"]);
  run(["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(target.target, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(target.target, ".git", "info", "exclude"), "");
  fs.writeFileSync(path.join(target.target, ".gitignore"), ".crdd/\n");
  fs.writeFileSync(path.join(target.target, "source.txt"), "base\n");
  const namedSecret = "API_KEY=synthetic_value_123456789";
  fs.writeFileSync(
    path.join(target.target, "secret.txt"),
    `heading\n${namedSecret}\n`,
  );
  run(["add", "."]);
  run(["commit", "-m", "base"]);
  const base = run(["rev-parse", "HEAD"]);
  prepareWorkspaceSurface(target.target, "project.fixture", base);
  const mcpBase = await openFixtureMcp(hosted, f.listeners);
  const wb = await startWorkbench({ workingDirectory: target.target });
  let closing: Promise<void> | undefined;
  const closeWorkbench = () => (closing ??= wb.close());
  f.listeners.push(closeWorkbench);
  try {
    const state = JSON.parse(
      fs.readFileSync(hosted.current, "utf8"),
    ) as AccessManagementState;
    const actor = state.users[0];
    assert.ok(actor);
    const workspaceId = randomUUID();
    const common = {
      projectId: "project.fixture",
      queueId: "queue-a",
      workspaceId,
    };
    /**
     * 現在資格とRepository IDでWorkspace MCP要求を送る。
     * @responsibility 現在資格とRepository IDでWorkspace MCP要求を送る。
     * @trace CPR-IT-001
     * @trace CPR-IT-004
     * @trace CPR-IT-006
     * @trace EST-IT-002
     * @precondition 起動済み認証HTTPと固定token・target ID。
     * @stimulus 読取り操作と管理操作に対応するToolへcommandを渡す。
     * @observation HTTPとMCPの公開JSON結果。
     * @oracle 選択Repositoryだけに配送し不正・失効結果を補完しない。
     * @cleanup 呼出し元がServerをcloseし所有fixtureを回収する。
     * @boundary 実HTTP→認可→Workspace Owner。Providerは呼ばない。
     */
    const sendMcp = async ({ operation, ...args }: Record<string, unknown>) =>
      (
        await call(
          mcpBase,
          hosted.mcpToken,
          MCP_WORKSPACE_TOOLS[operation as keyof typeof MCP_WORKSPACE_TOOLS] ??
            MCP_WORKSPACE_TOOLS.get,
          { repositoryId: target.id, ...args },
        )
      ).json();
    const sendWb = async (
      { operation, ...args }: Record<string, unknown>,
      extra: Record<string, string> = {},
    ) => {
      const route = workspaceResources.find(
        (item) => item.operation === operation,
      );
      assert.ok(route);
      let resource = route.path.replace(":repositoryId", target.id);
      if (resource.includes(":workspaceId")) {
        assert.equal(typeof args.workspaceId, "string");
        resource = resource.replace(":workspaceId", String(args.workspaceId));
        delete args.workspaceId;
      }
      const input = { ...args, ...extra };
      if (route.method === "get") {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(input))
          if (value !== null) query.set(key, String(value));
        return fetch(`${wb.baseUrl}${resource}?${query}`);
      }
      return fetch(`${wb.baseUrl}${resource}`, {
        method: route.method.toUpperCase(),
        headers: {
          origin: wb.baseUrl,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
    };
    for (const role of ["developer", "manager", "administrator"] as const) {
      actor.role = role;
      state.revision++;
      state.operationId = randomUUID();
      fs.writeFileSync(hosted.current, JSON.stringify(state));
      const command = {
        operation: "list",
        projectId: "project.fixture",
        cursor: null,
        limit: 1,
      };
      const a = await sendMcp(command);
      assert.ok(a.result?.structuredContent, JSON.stringify(a));
      const b = await sendWb(command);
      assert.equal(b.status, 200);
      assert.deepEqual(await b.json(), a.result.structuredContent);
    }
    hosted.permissions.delete(target.id);
    assert.ok(
      (
        await sendMcp({
          operation: "list",
          projectId: "project.fixture",
          cursor: null,
          limit: 20,
        })
      ).error,
    );
    hosted.permissions.set(target.id, "write");
    assert.ok(
      (await sendMcp({ ...common, operation: "get", ownerRoot: target.target }))
        .error,
    );
    assert.equal(
      (
        await sendWb(
          { ...common, operation: "get" },
          { referencesReleased: "true" },
        )
      ).status,
      400,
    );
    const moved = run([
      "commit-tree",
      "HEAD^{tree}",
      "-p",
      base,
      "-m",
      "selected branch",
    ]);
    run(["update-ref", "refs/heads/selected", base]);
    fs.writeFileSync(path.join(target.target, "untracked.txt"), "untracked\n");
    const index = fs.readFileSync(path.join(target.target, ".git", "index"));
    const creation = {
      ...common,
      operation: "create",
      expectedGeneration: 0,
      baseBranch: "selected",
      baseCommit: base,
      name: "共有作業",
    };
    const warning = (await sendMcp(creation)).result?.structuredContent;
    assert.equal(
      warning?.data.reason,
      "workspace_creation_confirmation_required",
    );
    assert.equal(warning.data.workspace, null);
    assert.equal(warning.data.gitEffectIssued, false);
    assert.deepEqual(await (await sendWb(creation)).json(), warning);
    const accepted = { ...creation, acceptUncommittedChangesExcluded: true };
    run(["update-ref", "refs/heads/selected", moved]);
    const stale = (await sendMcp(accepted)).result?.structuredContent;
    assert.equal(stale?.data.reason, "workspace_creation_branch_head_changed");
    assert.equal(stale.data.workspace, null);
    assert.equal(stale.data.gitEffectIssued, false);
    run(["update-ref", "refs/heads/selected", base]);
    let response = await sendMcp(accepted);
    let view = response.result?.structuredContent.data.workspace;
    assert.ok(view, JSON.stringify(response));
    const tree = path.join(
      target.target,
      ".crdd",
      "workspaces",
      workspaceId,
      "worktree",
    );
    assert.equal(run(["-C", tree, "rev-parse", "HEAD"]), base);
    assert.equal(run(["rev-parse", "HEAD"]), base);
    assert.deepEqual(
      fs.readFileSync(path.join(target.target, ".git", "index")),
      index,
    );
    assert.equal(
      fs.readFileSync(path.join(tree, "source.txt"), "utf8").trim(),
      "base",
    );
    assert.equal(fs.existsSync(path.join(tree, "untracked.txt")), false);
    fs.unlinkSync(path.join(target.target, "untracked.txt"));
    const syntheticSecret = ["sk", "-", "a".repeat(24)].join("");
    for (const content of [
      syntheticSecret,
      namedSecret,
      `heading\n${namedSecret}\n`,
    ]) {
      fs.writeFileSync(path.join(tree, "source.txt"), content);
      const deniedSecret = await sendMcp({
        ...common,
        operation: "inspect",
        path: "source.txt",
      });
      assert.ok(deniedSecret.error);
      assert.equal(JSON.stringify(deniedSecret).includes(content), false);
      const deniedWb = await sendWb({
        ...common,
        operation: "inspect",
        path: "source.txt",
      });
      assert.equal(deniedWb.status, 503);
      assert.equal((await deniedWb.text()).includes(content), false);
    }
    fs.writeFileSync(path.join(tree, "secret.txt"), "safe\n");
    for (const operation of ["inspect", "candidate-diff"]) {
      if (operation === "candidate-diff") {
        const fixedSecret = await sendMcp({
          ...common,
          operation: "freeze",
          expectedGeneration: view.generation,
          operationId: randomUUID(),
          baseCommit: base,
          expectedHead: view.head,
          selection: [
            {
              path: "secret.txt",
              mode: "100644",
              blobId: run([
                "-C",
                tree,
                "hash-object",
                "--no-filters",
                "secret.txt",
              ]),
            },
          ],
          candidateName: null,
          relatedChangeIds: [],
        });
        assert.equal(
          fixedSecret.result.structuredContent.data.status,
          "completed",
        );
        view = fixedSecret.result.structuredContent.data.workspace;
      }
      const denied = await sendMcp({
        ...common,
        operation,
        path: "secret.txt",
      });
      assert.ok(denied.error);
      assert.equal(JSON.stringify(denied).includes(namedSecret), false);
      const deniedWb = await sendWb({
        ...common,
        operation,
        path: "secret.txt",
      });
      assert.equal(deniedWb.status, 503);
      assert.equal((await deniedWb.text()).includes(namedSecret), false);
    }
    response = await sendMcp({
      ...common,
      operation: "close-candidate",
      expectedGeneration: view.generation,
      expectedCommit: view.candidate.candidateCommit,
      disposition: "rejected",
    });
    assert.equal(response.result.structuredContent.data.status, "completed");
    view = response.result.structuredContent.data.workspace;
    fs.writeFileSync(path.join(tree, "source.txt"), "selected\n");
    const previewResponse = await sendWb({
      ...common,
      operation: "inspect",
      path: "source.txt",
    });
    assert.equal(previewResponse.status, 200);
    const preview = (await previewResponse.json()) as {
      data: { selection: unknown };
    };
    const fixedResponse = await sendWb({
      ...common,
      operation: "freeze",
      expectedGeneration: view.generation,
      operationId: randomUUID(),
      baseCommit: base,
      expectedHead: view.head,
      selection: [preview.data.selection],
      candidateName: "共有候補",
      relatedChangeIds: [],
    });
    assert.equal(fixedResponse.status, 200);
    const fixed = (await fixedResponse.json()) as {
      data: { status: string; workspace: typeof view };
    };
    assert.equal(fixed.data.status, "completed", JSON.stringify(fixed));
    view = fixed.data.workspace;
    assert.equal(run(["rev-parse", "HEAD"]), base);
    fs.writeFileSync(path.join(tree, "source.txt"), "not-fixed\n");
    response = await sendMcp({
      ...common,
      operation: "candidate-diff",
      path: "source.txt",
    });
    assert.match(response.result.structuredContent.data.patch, /selected/u);
    assert.doesNotMatch(
      response.result.structuredContent.data.patch,
      /not-fixed/u,
    );
    const originalEnd = ServerResponse.prototype.end;
    let dropped = false;
    let adoptionResult: unknown;
    const drop = t.mock.method(
      ServerResponse.prototype,
      "end",
      function (this: ServerResponse, ...args: Parameters<typeof originalEnd>) {
        const body = args[0];
        if (
          !dropped &&
          typeof body === "string" &&
          body.includes('"operation":"adopt"') &&
          body.includes('"contract":"crdd-server/workspace-surface/v1"')
        ) {
          dropped = true;
          adoptionResult = JSON.parse(body).data?.reason;
          this.destroy();
          return this;
        }
        return Reflect.apply(originalEnd, this, args);
      },
    );
    try {
      await assert.rejects(
        sendWb({
          ...common,
          operation: "adopt",
          expectedGeneration: view.generation,
          candidateCommit: view.candidate.candidateCommit,
          targetBranch: "main",
          expectedTargetHead: base,
        }),
      );
    } finally {
      drop.mock.restore();
    }
    assert.equal(dropped, true);
    const mergedHead = run(["rev-parse", "HEAD"]);
    response = await sendMcp({ ...common, operation: "get" });
    view = response.result.structuredContent.data.workspace;
    assert.equal(
      view.candidate.phase,
      "merged",
      JSON.stringify(adoptionResult),
    );
    assert.equal(view.candidate.mergeCommit, mergedHead);
    assert.equal(run(["rev-parse", "HEAD"]), mergedHead);
    assert.equal(
      run(["rev-list", "--parents", "-n", "1", "HEAD"]).split(" ").length,
      3,
    );
    const closed = await sendWb({
      ...common,
      operation: "close-candidate",
      expectedGeneration: view.generation,
      expectedCommit: view.candidate.candidateCommit,
      disposition: "adopted",
    });
    assert.equal(closed.status, 200);
    view = ((await closed.json()) as { data: { workspace: typeof view } }).data
      .workspace;
    assert.equal(view.candidate, null);
    response = await sendMcp({
      ...common,
      operation: "discard",
      expectedGeneration: view.generation,
      expectedHead: view.head,
      discardChanges: true,
    });
    assert.equal(
      response.result.structuredContent.data.status,
      "completed",
      JSON.stringify(response),
    );
    assert.equal(fs.existsSync(tree), false);
    const entry = path.resolve(
      import.meta.dirname,
      "../../../../template/tools/crdd-server.ts",
    );
    const localCommand = {
      operation: "list",
      projectId: "project.fixture",
      cursor: null,
      limit: 20,
    };
    const localMcp = spawnSync(process.execPath, [entry, "--mcp-stdio"], {
      cwd: target.target,
      input: `${JSON.stringify(packet("crdd.list_workspaces", { repositoryId: target.id, projectId: localCommand.projectId, cursor: localCommand.cursor, limit: localCommand.limit }))}\n`,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    });
    assert.equal(localMcp.status, 0, localMcp.stderr);
    const localResult = JSON.parse(localMcp.stdout);
    assert.ok(
      localResult.result?.structuredContent,
      JSON.stringify(localResult),
    );
    const logo = "04_UI/assets/brand/crdd-brand-icon-512x512.jpg";
    fs.mkdirSync(path.dirname(path.join(target.target, logo)), {
      recursive: true,
    });
    fs.copyFileSync(
      path.resolve(import.meta.dirname, "../../../..", logo),
      path.join(target.target, logo),
    );
    {
      const workspacePath = `/api/repositories/${target.id}/workspaces?projectId=project.fixture&limit=20`;
      const localRead = await requestTransport(wb.baseUrl, workspacePath);
      assert.equal(localRead.status, 200);
      assert.deepEqual(
        JSON.parse(localRead.body.toString()),
        localResult.result.structuredContent,
      );
      const rejectedHost = await requestTransport(
        wb.baseUrl,
        workspacePath,
        "GET",
        undefined,
        {
          Host: "not-the-startup-host.example",
        },
      );
      assert.equal(rejectedHost.status, 403);
      const rejectedOrigin = await requestTransport(
        wb.baseUrl,
        workspacePath,
        "GET",
        undefined,
        {
          Origin: "https://unrelated.example",
        },
      );
      assert.equal(rejectedOrigin.status, 403);
    }
    assert.doesNotMatch(
      JSON.stringify(response),
      /candidate-index|repositoryBindingId|ownerRepositoryRoot/u,
    );
    assertOtherStorageUntouched();
    const hostedState = JSON.parse(
      fs.readFileSync(hosted.current, "utf8"),
    ) as AccessManagementState;
    revokeFixtureBinding(hostedState);
    hostedState.revision++;
    hostedState.operationId = randomUUID();
    fs.writeFileSync(hosted.current, JSON.stringify(hostedState));
    assert.ok(
      (
        await sendMcp({
          operation: "list",
          projectId: "project.fixture",
          cursor: null,
          limit: 20,
        })
      ).error,
    );
  } finally {
    await closeWorkbench();
  }
});

/**
 * 認証済み二Repositoryの実保存fixtureを用意する。
 * @responsibility 認証済み二Repositoryの実保存fixtureを用意する。
 * @trace EST-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @precondition Repository直下tests領域が非linkの通常Directory。
 * @stimulus AM初期化、固定資格、合成Git RootとProject Contextを作る。
 * @observation 検証済みStore Root、tokenと二つの対象。
 * @oracle 指定した初期化段階・Role・公開範囲を実Readerが読める。
 * @cleanup t.afterでexact所有Directoryだけを削除し不存在を確認する。
 * @boundary 実AM・Filesystem・local Git。tokenを公開本文やログへ出さない。
 */
type AccessTarget = {
  id: string;
  target: string;
  body: string;
  context: string;
};

function fixture(
  t: TestContext,
  completed = true,
  sharedTargets?: readonly AccessTarget[],
) {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(path.join(parent, "mcp-access-context-"));
  const listeners: Array<() => Promise<void>> = [];
  t.after(async () => {
    const closed = await Promise.allSettled(
      listeners.map(async (close) => close()),
    );
    const errors = closed.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (errors.length)
      throw new AggregateError(errors, "access_fixture_close_unconfirmed");
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const store = path.join(directory, "store");
  fs.mkdirSync(store);
  const root = createFilesystemStoreRoot(store);
  assert.ok(root);
  const attempt = randomUUID();
  const userId = randomUUID();
  const { token, ...legacyKey } = createRetiredCredentialFixture();
  const bindingId = randomUUID();
  const current = path.join(store, "access-management.json");
  const initial: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 4,
    revision: 3,
    operationId: randomUUID(),
    users: [
      {
        userId,
        username: "試験管理者",
        role: "administrator",
        accountLinks: [
          { issuer: "https://accounts.google.com", subject: userId, bindingId },
        ],
      },
    ],
    registeredRepositories: [],
    initialization: {
      stage: "completed",
      attemptId: attempt,
      initialUserId: userId,
      connection: "account_confirmed",
    },
  };
  fs.writeFileSync(
    current,
    JSON.stringify(
      completed
        ? initial
        : {
            ...initial,
            schemaRevision: 3,
            credentials: [{ ...legacyKey, userId }],
            unresolvedKeyExchanges: [],
            initialization: {
              stage: "credential_stored",
              attemptId: attempt,
              userId,
            },
          },
    ),
  );
  const targets =
    sharedTargets ??
    ["repository.a", "repository.b"].map((id) => {
      const target = path.join(directory, id);
      fs.mkdirSync(target);
      const git = spawnSync("git", ["init", "--quiet", target], {
        encoding: "utf8",
      });
      assert.equal(git.status, 0, git.stderr);
      fs.mkdirSync(path.join(target, ".crdd", "config"), { recursive: true });
      fs.writeFileSync(
        path.join(target, ".crdd", "config", "repository-manifest.json"),
        JSON.stringify({
          schema: "crdd/repository-manifest/v2",
          projectId: "project.fixture",
          repositoryId: id,
          displayName: "試験",
          repositoryRole: "development",
          capabilities: [],
          contextSurfaces: [],
          externalSendPolicy: null,
        }),
      );
      const context =
        `# Project Context\n\nProject ID: project.fixture\nRepository ID: ${id}\nRepository Role: development\n` +
        [
          "今どうなっているか",
          "何が危ない、または止まっているか",
          "今、人間が決めることは何か",
          "なぜこの状態・判断になったか",
          "次に何をすべきか",
        ]
          .map(
            (heading, i) =>
              `\n## ${i + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
          )
          .join("");
      const body = path.join(target, "PROJECT_CONTEXT.md");
      fs.writeFileSync(body, context);
      return { id, target, body, context };
    });
  if (completed) {
    const state = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const user = state.users[0];
    assert.ok(user);
    let revision = state.revision;
    for (const target of targets) {
      assert.equal(
        registerRepository(
          root,
          {
            kind: "account",
            userId: user.userId,
            bindingId,
            expiresAt: Date.now() + 60_000,
          },
          revision++,
          randomUUID(),
          target.id,
          target.target,
          (directory) => {
            const observed = observeRegistrationDirectory(directory);
            return (
              observed && {
                ...observed,
                hostedRepository: {
                  provider: "github",
                  host: "github.com",
                  repositoryId: String(revision),
                  providerData: { installationId: "24" },
                },
              }
            );
          },
        ).status,
        "completed",
      );
    }
    const ready = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const actor = ready.users[0];
    assert.ok(actor);
    actor.role = "developer";
    // この基底fixtureは連携なしの拒否にも使う。連携済みケースは別途参照を付ける。
    ready.registeredRepositories = ready.registeredRepositories.map(
      ({ repositoryId, repositoryRoot, bindingId }) => ({
        repositoryId,
        repositoryRoot,
        bindingId,
      }),
    );
    fs.writeFileSync(current, JSON.stringify(ready));
  }
  return {
    root,
    token,
    mcpToken: randomUUID(),
    directory,
    repositoryScope: createRepositoryScope([
      ...new Set(targets.map(({ target }) => path.dirname(target))),
    ]),
    userId,
    bindingId,
    current,
    targets,
    listeners,
  };
}

/** 実通信をせず、旧公開範囲とは独立した本人の実効権限を返す。 */
function hostedFixture(
  t: TestContext,
  sharedTargets?: readonly AccessTarget[],
) {
  const input = fixture(t, true, sharedTargets);
  const host = "git.example.test";
  const hostToken = randomUUID();
  const permissions = new Map<string, "read" | "write" | "unavailable">();
  const state = JSON.parse(
    fs.readFileSync(input.current, "utf8"),
  ) as AccessManagementState;
  for (const entry of state.registeredRepositories) {
    const id = entry.repositoryId;
    const remote = `https://${host}/fixture/${id}.git`;
    const git = spawnSync(
      "git",
      [
        "-C",
        entry.repositoryRoot,
        "config",
        "--local",
        "remote.origin.url",
        remote,
      ],
      { encoding: "utf8" },
    );
    assert.equal(git.status, 0, git.stderr);
    entry.hostedRepository = {
      provider: "fixture",
      host,
      repositoryId: id,
      providerData: {},
    };
    permissions.set(id, "write");
  }
  fs.writeFileSync(input.current, JSON.stringify(state));
  const provider: GitHostProvider = {
    kind: "fixture",
    displayName: "Fixture",
    acceptsHost: (value) => value === host,
    readEnvironment: () => ({}),
    bind: () => ({
      connect: () => {
        throw new Error("fixture_not_interactive");
      },
      readRepositoryName: (remote) => new URL(remote).pathname.slice(1, -4),
      observeBinding: async () => null,
      observeAccess: async ({ reference, userAccessToken }) => {
        if (userAccessToken !== hostToken) return { status: "denied" };
        const permission = permissions.get(reference.repositoryId);
        if (!permission) return { status: "denied" };
        if (permission === "unavailable") return { status: "unavailable" };
        return {
          status: "allowed",
          read: true,
          write: permission === "write",
          name: `fixture/${reference.repositoryId}`,
        };
      },
    }),
  };
  const bound = bindGitHost({
    provider,
    configuration: { host, provider: provider.kind, providerData: {} },
  });
  const hostAccess: NonNullable<Parameters<typeof createOAuthMcpResolver>[2]> =
    {
      hasCurrentToken: (token) => token === input.mcpToken,
      readGitHost: (hostname) => (hostname === host ? bound : undefined),
      repositoryScope: input.repositoryScope,
      readGrantHostReference: (token, _subject, hostname) =>
        token === input.mcpToken && hostname === host
          ? "fixture-reference"
          : null,
      read: (hostname, reference, binding) =>
        hostname === host &&
        reference === "fixture-reference" &&
        binding.userId === input.userId &&
        binding.bindingId === input.bindingId
          ? hostToken
          : null,
    };
  return { ...input, permissions, hostAccess };
}

/** 合成の照会結果だけを返す。認証経路は現行のMCP OAuthを通す。 */
function fixtureOAuthResolver(
  input: ReturnType<typeof fixture> & {
    hostAccess?: Parameters<typeof createOAuthMcpResolver>[2];
  },
) {
  const resolver = createOAuthMcpResolver(
    input.root,
    async (candidate) =>
      candidate === input.mcpToken
        ? {
            status: "completed",
            subject: `${input.userId}:${input.bindingId}`,
            expiresAt: Date.now() + 60_000,
          }
        : { status: "rejected" },
    input.hostAccess,
  );
  return (token: string, signal = new AbortController().signal) =>
    resolver(token, signal);
}

/** 合成OAuthのMCP Listenerを、内部HTTP比較のListenerとは別に所有する。 */
async function openFixtureMcp(
  input: ReturnType<typeof fixture>,
  listeners = input.listeners,
) {
  const server = await startMcpAuthenticatedStreamableHttp(
    fixtureOAuthResolver(input),
    { port: 0 },
  );
  listeners.push(async () => {
    assert.equal((await server.close()).cleanupConfirmed, true);
  });
  return `http://${server.host}:${server.port}`;
}

/** 旧HTTP側の資格とは独立して、同じ利用者の外部アカウントの結合を失効させる。 */
function revokeFixtureBinding(state: AccessManagementState) {
  const actor = state.users[0];
  assert.ok(actor);
  delete actor.accountLinks;
}

/**
 * 内容・非鍵管理ToolのJSON-RPC要求を作る。
 * @responsibility 実HTTPと直接Handlerで同じwire入力を使用する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 宣言済みToolと対応引数を指定する。
 * @stimulus 閉じたEnvelopeとProtocol metadataを構築する。
 * @observation JSON-RPC結果へ同じidが戻る。
 * @oracle Token・RootはTool引数へ含めない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary MCP入力Schema。
 */
function packet(
  tool = MCP_PROJECT_CONTEXT_GET_TOOL as string,
  args?: Record<string, unknown>,
) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: tool,
      arguments:
        args ??
        (tool === MCP_PROJECT_CONTEXT_LIST_TOOL
          ? {}
          : { projectId: "project.fixture" }),
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

/**
 * 認証済みHTTPで内容Toolを呼ぶ。
 * @responsibility 既存TransportのHeader・本文検査を迂回しない。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace EST-IT-002
 * @precondition 起動済みloopback Listener。
 * @stimulus Bearerと固定metadataをPOSTする。
 * @observation HTTP statusとMCP body。
 * @oracle 秘密は認証Headerだけへ渡す。
 * @cleanup 呼出側がServerをcloseしてjoinする。
 * @boundary 実HTTP→MCP Adapter。
 */
function call(
  base: string,
  token: string,
  tool = MCP_PROJECT_CONTEXT_GET_TOOL as string,
  args?: Record<string, unknown>,
) {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": tool,
    },
    body: JSON.stringify(packet(tool, args)),
  });
}

/**
 * Project拘束を検証するTopic本文を作る。
 * @responsibility 改訂・状態と明示Projectを持つ固定入力を提供する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 自己生成Repositoryのみで使用する。
 * @stimulus 指定改訂とProjectの本文を構成する。
 * @observation Parserと実保存結果。
 * @oracle Project以外の必須Meaningを欠落させない。
 * @cleanup N/A: メモリ文字列のみ。
 * @boundary 同Projectの固定Markdown入力生成だけ。保存・公開は呼出し元が検証する。
 */
function topicMarkdown(
  revision = 1,
  project = "project.fixture",
  state = "open",
) {
  return `# Topic\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`${project}\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`PM\`\n\n## 1. 現在の論点\n\n### 結論\n\nHTTP接続を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`MTG-000042\` | 同ProjectのMeeting |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: 未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
}

/**
 * Outcomeを持つMeeting本文を作る。
 * @responsibility 明示Projectと改訂を持つ固定入力を提供する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 自己生成Repositoryのみで使用する。
 * @stimulus 未処置Outcomeを含む本文を構成する。
 * @observation Parserと実保存結果。
 * @oracle Outcome処置と通常更新を区別できる。
 * @cleanup N/A: メモリ文字列のみ。
 * @boundary 同Projectの固定Markdown入力生成だけ。保存・公開は呼出し元が検証する。
 */
function meetingMarkdown(revision = 1, project = "project.fixture") {
  return `# Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`${project}\`\n状態: \`recorded\`\n開催日時: \`2026-10-12 10:00 JST\`\n改訂: \`${revision}\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nHTTP接続を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: 未処置\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正なし\` |\n| 残る影響 | |\n`;
}

/**
 * 全12操作を実HTTP・現在AM認可・実Domain保存へ接続する。
 * @responsibility Tool登録だけを操作成立とせず保存内容と結果を照合する。
 * @trace CPR-IT-010
 * @trace RFD-IT-013
 * @precondition 初回完了済み自己生成Store、二つの同Project Repository。
 * @stimulus 両種別のCRUD、Topic昇格、Meeting Outcomeを順に実行する。
 * @observation wire結果、実Record、Relation Ownerと不存在。
 * @oracle 公開12Toolすべて成功し、指定Repositoryだけを変更する。
 * @cleanup Server終了確認後に所有Fixtureを回収する。
 * @boundary 実認証HTTP→内容MCP→Domain保存。AIと外部通信はない。
 */
test("Topic・Meetingは旧Bearerを拒否し、単体HTTPと共有MCPで対象を明示する", async (t) => {
  const f = fixture(t);
  const hosted = hostedFixture(t);
  const mcpBase = await openFixtureMcp(hosted);
  const [a, b] = f.targets;
  assert.ok(a && b);
  const shared = await startWorkbench({
    workingDirectory: a.target,
    localAccessRoot: f.root,
  });
  f.listeners.push(() => shared.close());
  const primary = await startWorkbench({ workingDirectory: a.target });
  f.listeners.push(() => primary.close());
  const local = await startWorkbench({ workingDirectory: b.target });
  f.listeners.push(() => local.close());
  const topics = `/api/repositories/${a.id}/topics`;
  const meetings = `/api/repositories/${a.id}/meetings`;
  const auth = { authorization: `Bearer ${f.token}` };
  const write = (
    base: string,
    target: string,
    method: string,
    body: object,
    headers: Record<string, string> = {},
  ) =>
    fetch(`${base}${target}`, {
      method,
      headers: { ...headers, origin: base, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(`${shared.baseUrl}${topics}`)).status, 401);
  const before = fs.readFileSync(f.current);
  for (const [resource, markdown] of [
    [topics, topicMarkdown()],
    [meetings, meetingMarkdown()],
  ] as const) {
    assert.equal(
      (await fetch(`${shared.baseUrl}${resource}`, { headers: auth })).status,
      401,
    );
    assert.equal(
      (await write(shared.baseUrl, resource, "POST", { markdown }, auth))
        .status,
      401,
    );
  }
  assert.deepEqual(fs.readFileSync(f.current), before);
  const created = await write(primary.baseUrl, topics, "POST", {
    markdown: topicMarkdown(),
  });
  assert.equal(created.status, 201, await created.text());
  const mcpCreated = await (
    await call(mcpBase, hosted.mcpToken, "crdd.create_topic", {
      repositoryId: a.id,
      markdown: topicMarkdown(),
    })
  ).json();
  assert.equal(mcpCreated.result.isError, false);
  const record = `${topics}/TOPIC-000042`;
  const viewed = await fetch(`${primary.baseUrl}${record}`);
  assert.equal(viewed.status, 200);
  const detail = await (
    await call(mcpBase, hosted.mcpToken, "crdd.get_topic", {
      repositoryId: a.id,
      id: "TOPIC-000042",
    })
  ).json();
  const {
    relationScope,
    relations: hostedRelations,
    ...hostedDetail
  } = detail.result.structuredContent;
  assert.equal(relationScope, "repository");
  const { relations, ...httpDetail } = await viewed.json();
  assert.deepEqual(httpDetail, hostedDetail);
  assert.deepEqual(relations, [
    { id: "MTG-000042", kind: "meeting", state: "not_found" },
  ]);
  assert.deepEqual(hostedRelations, [
    { id: "MTG-000042", kind: "meeting", state: "unavailable" },
  ]);
  const page = await fetch(`${primary.baseUrl}${topics}?limit=10`);
  const mcpPage = await (
    await call(mcpBase, hosted.mcpToken, "crdd.list_topics", {
      repositoryId: a.id,
      limit: 10,
    })
  ).json();
  assert.deepEqual(await page.json(), mcpPage.result.structuredContent);

  assert.equal(
    (
      await write(primary.baseUrl, record, "PATCH", {
        expectedRevision: 6,
        markdown: topicMarkdown(2),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await write(primary.baseUrl, record, "PATCH", {
        expectedRevision: 1,
        markdown: topicMarkdown(2),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await write(primary.baseUrl, meetings, "POST", {
        markdown: meetingMarkdown(),
      })
    ).status,
    201,
  );
  const meeting = `${meetings}/MTG-000042`;
  assert.equal((await fetch(`${primary.baseUrl}${meeting}`)).status, 200);
  assert.equal(
    (
      await write(primary.baseUrl, meeting, "PATCH", {
        expectedRevision: 1,
        markdown: meetingMarkdown(2),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await write(primary.baseUrl, record, "DELETE", {
        expectedRevision: 2,
        confirmed: true,
        reason: "mistaken_registration",
      })
    ).status,
    200,
  );

  const forbidden = await write(
    local.baseUrl,
    topics,
    "POST",
    { markdown: topicMarkdown() },
    {},
  );
  assert.equal(forbidden.status, 404);
  assert.equal((await fetch(`${primary.baseUrl}${record}`)).status, 404);
  const localTopics = `/api/repositories/${b.id}/topics`;
  const localViewUrl = `${local.baseUrl}/api/workbench/view`;
  const beforeFirstLocalWrite = await fetch(localViewUrl);
  assert.equal(beforeFirstLocalWrite.status, 200);
  assert.equal(
    (await beforeFirstLocalWrite.json()).projectData.topics.state,
    "not_configured",
  );
  assert.equal(
    (
      await write(
        local.baseUrl,
        localTopics,
        "POST",
        { markdown: topicMarkdown() },
        {},
      )
    ).status,
    201,
  );
  assert.equal(
    (await fetch(`${local.baseUrl}${localTopics}/TOPIC-000042`)).status,
    200,
  );
  const afterFirstLocalWrite = await fetch(localViewUrl);
  assert.equal(afterFirstLocalWrite.status, 200);
  const localView = await afterFirstLocalWrite.json();
  assert.equal(localView.projectData.topics.state, "available");
  assert.equal(localView.projectData.topics.items[0]?.topicId, "TOPIC-000042");
  assert.equal(localView.topicPage.records[0]?.topicId, "TOPIC-000042");

  const legacyView = await fetch(
    `${shared.baseUrl}/api/workbench/view?repositoryId=${a.id}`,
    { headers: auth },
  );
  assert.equal(legacyView.status, 403);
  assert.doesNotMatch(await legacyView.text(), /MTG-000042/u);
  const stored = createMeetingOperations(a.target, "project.fixture");
  const recordBefore = stored.getDocument("MTG-000042");
  assert.ok(recordBefore);
  const edit = { expectedRevision: 2, markdown: meetingMarkdown(3) };
  assert.equal(
    (await write(shared.baseUrl, meeting, "PATCH", edit, auth)).status,
    401,
  );
  const hostedRoot = hosted.targets.find(({ id }) => id === a.id)?.target;
  assert.ok(hostedRoot);
  const hostedMeeting = createMeetingOperations(hostedRoot, "project.fixture");
  assert.equal(hostedMeeting.create(meetingMarkdown()).status, "completed");
  const hostedBefore = hostedMeeting.getDocument("MTG-000042");
  assert.ok(hostedBefore);
  hosted.permissions.set(a.id, "read");
  const rejected = await (
    await call(mcpBase, hosted.mcpToken, "crdd.update_meeting", {
      ...edit,
      repositoryId: a.id,
      id: "MTG-000042",
    })
  ).json();
  assert.equal(rejected.error.code, -32602);
  assert.deepEqual(stored.getDocument("MTG-000042"), recordBefore);
  assert.deepEqual(hostedMeeting.getDocument("MTG-000042"), hostedBefore);
});

test("AM内容MCPの全12操作は指定Repositoryの実保存へ到達する", async (t) => {
  const f = hostedFixture(t),
    a = f.targets[0],
    b = f.targets[1];
  assert.ok(a && b);
  const topic = createTopicOperations(a.target, "project.fixture");
  const meeting = createMeetingOperations(a.target, "project.fixture");
  const change = path.join(a.target, "99_Roadmap", "Changes", "CHG-000010");
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, "change.md"), "# Change\n");
  const server = await startMcpAuthenticatedStreamableHttp(
    fixtureOAuthResolver(f),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  const commands: [string, Record<string, unknown>][] = [
    ["crdd.create_topic", { markdown: topicMarkdown() }],
    ["crdd.create_meeting", { markdown: meetingMarkdown() }],
    ["crdd.list_topics", {}],
    ["crdd.list_meetings", {}],
    ["crdd.get_topic", { id: "TOPIC-000042" }],
    ["crdd.get_meeting", { id: "MTG-000042" }],
    [
      "crdd.update_topic",
      {
        id: "TOPIC-000042",
        expectedRevision: 1,
        markdown: topicMarkdown(2, "project.fixture", "waiting"),
      },
    ],
    [
      "crdd.update_meeting",
      { id: "MTG-000042", expectedRevision: 1, markdown: meetingMarkdown(2) },
    ],
    [
      "crdd.promote_topic",
      {
        topicId: "TOPIC-000042",
        expectedRevision: 2,
        changeId: "CHG-000010",
        reason: "採用",
        remainingResponsibility: "終了確認",
      },
    ],
    [
      "crdd.treat_meeting_outcome",
      {
        meetingId: "MTG-000042",
        expectedRevision: 2,
        outcomeId: "OUT-001",
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "次回",
        targetKind: "none",
        targetReference: "N/A: 完了",
        treatment: "確認済み",
        completionCondition: "確認",
        result: "完了",
        closeMeeting: true,
      },
    ],
    [
      "crdd.delete_topic",
      {
        id: "TOPIC-000042",
        expectedRevision: 3,
        confirmed: true,
        reason: "mistaken_registration",
      },
    ],
    [
      "crdd.delete_meeting",
      {
        id: "MTG-000042",
        expectedRevision: 3,
        confirmed: true,
        reason: "mistaken_registration",
      },
    ],
  ];
  assert.deepEqual(
    commands.map(([name]) => name).sort(),
    [...MCP_TOPIC_MEETING_TOOLS].sort(),
  );
  try {
    const discovery = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${f.mcpToken}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
        "mcp-method": "tools/list",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: packet().params._meta },
      }),
    });
    assert.equal(discovery.status, 200);
    const tools = (await discovery.json()).result.tools as {
      name: string;
      inputSchema: {
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties: boolean;
      };
    }[];
    assert.deepEqual(
      tools.map(({ name }) => name).sort(),
      [
        ...Object.values(MCP_WORKSPACE_TOOLS),
        MCP_PROJECT_CONTEXT_GET_TOOL,
        MCP_PROJECT_CONTEXT_LIST_TOOL,
        EXECUTION_ACTIVITY_TOOL,
        MCP_CURRENT_ACCESS_TOOL,
        ...MCP_TOPIC_MEETING_TOOLS,
        ...definitionTools,
        ...sharedExecutionToolNames,
      ].sort(),
    );
    for (const tool of tools) {
      const requiresRepositoryId =
        tool.name === MCP_PROJECT_CONTEXT_GET_TOOL ||
        MCP_TOPIC_MEETING_TOOLS.includes(tool.name as never) ||
        [
          ...Object.values(MCP_WORKSPACE_TOOLS),
          ...definitionTools,
          ...sharedExecutionToolNames,
        ].includes(tool.name);
      assert.equal(
        Object.hasOwn(tool.inputSchema.properties, "repositoryId"),
        requiresRepositoryId || tool.name === EXECUTION_ACTIVITY_TOOL,
        tool.name,
      );
      assert.equal(
        tool.inputSchema.required?.includes("repositoryId") ?? false,
        requiresRepositoryId,
        tool.name,
      );
      assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    }
    for (const [name, args] of commands) {
      const response = await call(base, f.mcpToken, name, {
        ...args,
        repositoryId: a.id,
      });
      assert.equal(response.status, 200);
      const text = await response.text(),
        result = JSON.parse(text);
      assert.equal(result.result?.isError, false, `${name}: ${text}`);
      assert.equal(text.includes(f.mcpToken), false);
      assert.equal(text.includes(a.target), false);
      if (name === "crdd.get_topic")
        assert.deepEqual(result.result.structuredContent.relations, [
          {
            id: "MTG-000042",
            kind: "meeting",
            state: "available",
            ownerRepositoryId: a.id,
          },
        ]);
      if (name === "crdd.update_topic")
        assert.equal(topic.get("TOPIC-000042")?.revision, 2);
      if (name === "crdd.update_meeting")
        assert.equal(meeting.get("MTG-000042")?.revision, 2);
      if (name === "crdd.promote_topic")
        assert.equal(topic.get("TOPIC-000042")?.state, "promoted");
      if (name === "crdd.treat_meeting_outcome")
        assert.equal(meeting.get("MTG-000042")?.state, "closed");
    }
    assert.equal(topic.get("TOPIC-000042"), null);
    assert.equal(meeting.get("MTG-000042"), null);
    assert.equal(
      createTopicOperations(b.target, "project.fixture").get("TOPIC-000042"),
      null,
    );
    assert.equal(
      createMeetingOperations(b.target, "project.fixture").get("MTG-000042"),
      null,
    );
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 初回未完了を通常Handlerへ昇格せず、開始前取消で本文を読まない。
 * @responsibility 認証と取消の負境界を直接確認する。
 * @trace RFD-IT-013
 * @trace EST-IT-014
 * @precondition 未完了と完了の自己生成Store。
 * @stimulus 各資格でResolverを呼び、完了Handlerへ取消済みSignalを渡す。
 * @observation null、固定取消結果、target open数。
 * @oracle 未完了Handler0、取消要求のRepository／本文観測0。
 * @cleanup fs hookを復元しFixtureの所有Rootを回収する。
 * @boundary 通常認証→要求Handler→同期読取り直前。
 */
test("未完了資格はHandlerなし、開始前取消は対象読取りなし", async (t) => {
  const initial = fixture(t, false),
    f = fixture(t);
  const open = fs.openSync;
  let reads = 0;
  fs.openSync = (file, flags, mode) => {
    if (
      [...initial.targets, ...f.targets].some(({ target }) =>
        String(file).startsWith(target),
      )
    )
      reads++;
    return open(file, flags, mode);
  };
  try {
    assert.equal(await fixtureOAuthResolver(initial)(initial.mcpToken), null);
    const handler = await fixtureOAuthResolver(f)(f.mcpToken);
    assert.ok(handler);
    const discovery = await invokeMcpSource(
      handler,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: packet().params._meta },
      },
      new AbortController().signal,
    );
    assert.ok("result" in discovery);
    const discovered = discovery.result as { tools: { name: string }[] };
    assert.deepEqual(
      discovered.tools.map((tool) => tool.name).sort(),
      [
        ...Object.values(MCP_WORKSPACE_TOOLS),
        MCP_PROJECT_CONTEXT_GET_TOOL,
        MCP_PROJECT_CONTEXT_LIST_TOOL,
        EXECUTION_ACTIVITY_TOOL,
        MCP_CURRENT_ACCESS_TOOL,
        ...MCP_TOPIC_MEETING_TOOLS,
        ...definitionTools,
        ...sharedExecutionToolNames,
      ].sort(),
    );
    const controller = new AbortController();
    controller.abort();
    const result = await invokeMcpSource(handler, packet(), controller.signal);
    assert.deepEqual(result, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32800, message: "Request cancelled" },
    });
    assert.equal(reads, 0);
  } finally {
    fs.openSync = open;
  }
});

/**
 * 現在認可とProject拘束の拒否を実HTTPで確認する。
 * @responsibility 非許可・foreign本文・Root不明を保存成功へ畳まない。
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @precondition 自己生成Storeと二Repository。
 * @stimulus 不明ID、公開解除、Role変更、資格失効、foreign登録／更新、Root欠測を入力する。
 * @observation 固定Protocol拒否、実本文の改訂と対象open数。
 * @oracle 認可拒否とforeign書込みは実データ不変。集合不明は部分成功なし。
 * @cleanup hook復元とServer終了後に所有Fixtureを回収する。
 * @boundary 実HTTPの現在認可とProject境界。拒否時の対象本文保全を実観測する。
 */
test("AM内容MCPは現在認可とforeign Projectと集合欠測で停止する", async (t) => {
  const f = hostedFixture(t),
    a = f.targets[0],
    b = f.targets[1];
  assert.ok(a && b);
  const original = fs.readFileSync(f.current);
  const topic = createTopicOperations(a.target, "project.fixture");
  const meeting = createMeetingOperations(a.target, "project.fixture");
  topic.create(topicMarkdown());
  meeting.create(meetingMarkdown());
  const topicBefore = topic.getDocument("TOPIC-000042")?.markdown;
  const meetingBefore = meeting.getDocument("MTG-000042")?.markdown;
  const server = await startMcpAuthenticatedStreamableHttp(
    fixtureOAuthResolver(f),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  const open = fs.openSync;
  let targetReads = 0;
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ target }) => String(file).startsWith(target)))
      targetReads++;
    return open(file, flags, mode);
  };
  try {
    for (const mode of ["unknown", "denied", "read-only-admin"] as const) {
      const state = JSON.parse(original.toString()) as AccessManagementState;
      if (mode === "denied") f.permissions.delete(a.id);
      if (mode === "read-only-admin") {
        assert.ok(state.users[0]);
        state.users[0].role = "administrator";
        f.permissions.set(a.id, "read");
      }
      fs.writeFileSync(f.current, JSON.stringify(state));
      targetReads = 0;
      const denied = await call(base, f.mcpToken, "crdd.create_topic", {
        repositoryId: mode === "unknown" ? "repository.unknown" : a.id,
        markdown: topicMarkdown(),
      });
      assert.deepEqual((await denied.json()).error, {
        code: -32602,
        message: "Invalid params",
      });
      if (mode !== "unknown") assert.equal(targetReads, 0);
    }
    fs.writeFileSync(f.current, original);
    f.permissions.set(a.id, "write");
    for (const [name, args] of [
      [
        "crdd.create_topic",
        {
          markdown: topicMarkdown(1, "project.foreign").replaceAll(
            "TOPIC-000042",
            "TOPIC-000043",
          ),
        },
      ],
      [
        "crdd.update_topic",
        {
          id: "TOPIC-000042",
          expectedRevision: 1,
          markdown: topicMarkdown(2, "project.foreign"),
        },
      ],
      [
        "crdd.create_meeting",
        {
          markdown: meetingMarkdown(1, "project.foreign").replaceAll(
            "MTG-000042",
            "MTG-000043",
          ),
        },
      ],
      [
        "crdd.update_meeting",
        {
          id: "MTG-000042",
          expectedRevision: 1,
          markdown: meetingMarkdown(2, "project.foreign"),
        },
      ],
    ] as [string, Record<string, unknown>][]) {
      const result = await call(base, f.mcpToken, name, {
        ...args,
        repositoryId: a.id,
      });
      assert.deepEqual((await result.json()).error, {
        code: -32603,
        message: "Internal error",
      });
      assert.equal(topic.getDocument("TOPIC-000042")?.markdown, topicBefore);
      assert.equal(meeting.getDocument("MTG-000042")?.markdown, meetingBefore);
      assert.equal(topic.get("TOPIC-000043"), null);
      assert.equal(meeting.get("MTG-000043"), null);
    }
    const topicRequest = {
      repositoryId: a.id,
      id: "TOPIC-000042",
    };
    const baseline = await (
      await call(base, f.mcpToken, "crdd.get_topic", topicRequest)
    ).json();
    assert.equal(baseline.result.isError, false);
    const git = path.join(b.target, ".git");
    const heldGit = path.join(b.target, ".git-unavailable");
    fs.renameSync(git, heldGit);
    try {
      const result = await call(
        base,
        f.mcpToken,
        "crdd.get_topic",
        topicRequest,
      );
      assert.deepEqual(await result.json(), baseline);
    } finally {
      fs.renameSync(heldGit, git);
    }
    const manifest = path.join(
      a.target,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    const heldManifest = path.join(
      path.dirname(manifest),
      "manifest-held.json",
    );
    fs.renameSync(manifest, heldManifest);
    try {
      const missing = await call(
        base,
        f.mcpToken,
        "crdd.get_topic",
        topicRequest,
      );
      assert.deepEqual((await missing.json()).error, {
        code: -32603,
        message: "Internal error",
      });
    } finally {
      fs.renameSync(heldManifest, manifest);
    }
    const state = JSON.parse(original.toString()) as AccessManagementState;
    revokeFixtureBinding(state);
    fs.writeFileSync(f.current, JSON.stringify(state));
    targetReads = 0;
    assert.equal(
      (
        await call(base, f.mcpToken, "crdd.get_topic", {
          repositoryId: a.id,
          id: "TOPIC-000042",
        })
      ).status,
      401,
    );
    assert.equal(targetReads, 0);
  } finally {
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 現在許可集合内だけでRelation Ownerの0／1／複数を判定する。
 * @responsibility 別Projectの同じIDを探索対象へ混ぜない。
 * @trace CPR-IT-010
 * @trace RFD-IT-013
 * @precondition 同Project二Repositoryと関連Topic。
 * @stimulus Meeting不在、一意、重複、第二Repositoryの異Project変更を順に入力する。
 * @observation 実HTTPのRelation状態とOwner ID。
 * @oracle 不在／競合ではOwnerなし、一意だけOwnerを返し異Project本文を探索しない。
 * @cleanup Server終了後に所有Fixtureを回収する。
 * @boundary 現在許可されたRepository集合の実Relation探索。集合不明を空集合にしない。
 */
test("共有MCPのRelationは明示Repository内に限定する", async (t) => {
  const f = hostedFixture(t),
    a = f.targets[0],
    b = f.targets[1];
  assert.ok(a && b);
  createTopicOperations(a.target, "project.fixture").create(topicMarkdown());
  const server = await startMcpAuthenticatedStreamableHttp(
    fixtureOAuthResolver(f),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  try {
    for (const stage of [0, 1, 2, 3]) {
      if (stage === 1)
        createMeetingOperations(b.target, "project.fixture").create(
          meetingMarkdown(),
        );
      if (stage === 2)
        createMeetingOperations(a.target, "project.fixture").create(
          meetingMarkdown(),
        );
      if (stage === 3) {
        const manifest = path.join(
          b.target,
          ".crdd",
          "config",
          "repository-manifest.json",
        );
        const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
        data.projectId = "project.other";
        fs.writeFileSync(manifest, JSON.stringify(data));
      }
      const response = await call(base, f.mcpToken, "crdd.get_topic", {
        repositoryId: a.id,
        id: "TOPIC-000042",
      });
      const result = await response.json();
      assert.equal(result.result.isError, false);
      assert.equal(result.result.structuredContent.relationScope, "repository");
      assert.deepEqual(result.result.structuredContent.relations, [
        {
          id: "MTG-000042",
          kind: "meeting",
          state: stage < 2 ? "unavailable" : "available",
          ...(stage >= 2 ? { ownerRepositoryId: a.id } : {}),
        },
      ]);
    }
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 不正入力と開始前取消では内容認可も保存も開始しない。
 * @responsibility 構成拡張後も既存Adapterの検査順序を保持する。
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @precondition 通常認証だけ完了した要求Handler。
 * @stimulus 全12Toolへ不正引数、正規登録へ取消済みSignalを渡す。
 * @observation 管理Storeと対象Repositoryのopen数、Protocol code。
 * @oracle 不正入力は-32602、事前取消は-32800、いずれも観測0。
 * @cleanup hook復元後に自己生成Fixtureを回収する。
 * @boundary MCP入力検証と取消済みSignal。対象open前の拒否を計数する。
 */
test("AM内容MCPの入力拒否と開始前取消は再認可前で閉じる", async (t) => {
  const f = fixture(t),
    a = f.targets[0];
  assert.ok(a);
  const handler = await fixtureOAuthResolver(f)(f.mcpToken);
  assert.ok(handler);
  const open = fs.openSync;
  let observations = 0;
  fs.openSync = (file, flags, mode) => {
    if (
      String(file).startsWith(path.dirname(f.current)) ||
      f.targets.some(({ target }) => String(file).startsWith(target))
    )
      observations++;
    return open(file, flags, mode);
  };
  try {
    for (const tool of MCP_TOPIC_MEETING_TOOLS) {
      const rejected: McpResponse = await invokeMcpSource(
        handler,
        packet(tool, { repositoryId: a.id, extra: true }),
        new AbortController().signal,
      );
      assert.ok("error" in rejected);
      assert.equal(rejected.error.code, -32602);
    }
    const abort = new AbortController();
    abort.abort();
    const cancelled = await invokeMcpSource(
      handler,
      packet("crdd.create_topic", {
        repositoryId: a.id,
        markdown: topicMarkdown(),
      }),
      abort.signal,
    );
    assert.ok("error" in cancelled);
    assert.equal(cancelled.error.code, -32800);
    assert.equal(observations, 0);
  } finally {
    fs.openSync = open;
  }
});

/**
 * 実HTTPの許可集合と本文版を再評価し、文書不完全性と全体停止を分ける。
 * @responsibility 空認可・欠測・部分成功と通常成功を区別する。
 * @trace PPR-IT-002
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @trace RFD-IT-013
 * @precondition 二RepositoryのProject Contextと現在developer資格。
 * @stimulus 反復取得と時刻だけ一年進めた同じ内容要求、administrator空認可、本文欠測・Identity競合・Root不成立、第一本文close後の管理改訂変更、失効資格を送る。
 * @observation Reader回数、完全／空／部分／競合Portfolio、公開前集合差の固定MCPエラーとresult不存在、非秘密body、close後接続拒否。
 * @oracle 毎要求で本文二回、空認可本文0、本文未確認・競合は明示した部分結果。実体不成立または読取り中の管理改訂差は全体エラー、失効は401。
 * @cleanup fs hook復元とServer close／join後にFixtureを回収する。
 * @boundary 実HTTP→AM→Domain固定本文→MCP応答。
 */
test("実HTTPは文書未確認・競合を部分表示し実体不明を全体停止する", async (t) => {
  const f = hostedFixture(t),
    resolver = fixtureOAuthResolver(f);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  const open = fs.openSync;
  let reads = 0;
  const readTargets: string[] = [];
  let baseline: unknown;
  const [first, second] = f.targets;
  assert.ok(first && second);
  const detail = (repositoryId: string) =>
    call(base, f.mcpToken, MCP_PROJECT_CONTEXT_GET_TOOL, {
      projectId: "project.fixture",
      repositoryId,
    });
  const list = () => call(base, f.mcpToken, MCP_PROJECT_CONTEXT_LIST_TOOL);
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ body }) => String(file) === body)) {
      reads++;
      readTargets.push(String(file));
    }
    return open(file, flags, mode);
  };
  try {
    for (let i = 0; i < 2; i++) {
      reads = 0;
      const response = await detail(first.id);
      assert.equal(response.status, 200);
      const text = await response.text(),
        result = JSON.parse(text);
      baseline = result;
      assert.equal(result.result.structuredContent.project.state, "complete");
      assert.equal(result.result.structuredContent.project.sources.length, 1);
      assert.equal(
        result.result.structuredContent.project.sources[0].repositoryId,
        first.id,
      );
      assert.equal(reads, 1);
      for (const target of f.targets)
        assert.equal(text.includes(target.target), false);
      assert.equal(text.includes(f.mcpToken), false);
      assert.equal(text.includes("managementRevision"), false);
      assert.equal(text.includes("bindingId"), false);
    }
    const beforeTimeOnly = fs.readFileSync(f.current);
    readTargets.length = 0;
    reads = 0;
    const later = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const clock = t.mock.method(Date, "now", () => later);
    try {
      const response = await detail(first.id);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), baseline);
      assert.equal(reads, 1);
      assert.deepEqual(readTargets.sort(), [first.body]);
      assert.deepEqual(fs.readFileSync(f.current), beforeTimeOnly);
    } finally {
      clock.mock.restore();
    }
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    const user = state.users[0];
    assert.ok(user);
    user.role = "administrator";
    fs.writeFileSync(f.current, JSON.stringify(state));
    f.permissions.clear();
    reads = 0;
    const empty = await call(base, f.mcpToken, MCP_PROJECT_CONTEXT_LIST_TOOL);
    assert.deepEqual(
      (await empty.json()).result.structuredContent.projects,
      [],
    );
    assert.equal(reads, 0);
    for (const { id } of f.targets) f.permissions.set(id, "write");
    user.role = "developer";
    fs.writeFileSync(f.current, JSON.stringify(state));
    const close = fs.closeSync;
    let firstDescriptor: number | undefined;
    let currentChanged = false;
    fs.openSync = (file, flags, mode) => {
      const fd = open(file, flags, mode);
      if (f.targets.some(({ body }) => String(file) === body)) reads++;
      if (!currentChanged && String(file) === f.targets[0]?.body)
        firstDescriptor = fd;
      return fd;
    };
    fs.closeSync = (fd) => {
      close(fd);
      if (fd === firstDescriptor) {
        firstDescriptor = undefined;
        currentChanged = true;
        fs.writeFileSync(
          f.current,
          JSON.stringify({ ...state, revision: state.revision + 1 }),
        );
      }
    };
    try {
      reads = 0;
      const changed = await list();
      assert.deepEqual(await changed.json(), {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Project Context unavailable" },
      });
      assert.equal(currentChanged, true);
      assert.equal(reads, 2);
    } finally {
      fs.closeSync = close;
      fs.openSync = (file, flags, mode) => {
        if (f.targets.some(({ body }) => String(file) === body)) {
          reads++;
          readTargets.push(String(file));
        }
        return open(file, flags, mode);
      };
      fs.writeFileSync(f.current, JSON.stringify(state));
    }
    const originalContext = fs.readFileSync(second.body, "utf8");
    fs.rmSync(second.body);
    const failed = await detail(second.id);
    const partial = (await failed.json()).result.structuredContent.project;
    assert.equal(partial.state, "partial");
    assert.equal(partial.sources.length, 1);
    assert.deepEqual(partial.sources[0], {
      repositoryId: second.id,
      state: "unavailable",
      revision: null,
      repositoryRole: null,
      context: null,
    });
    for (const field of ["Project ID", "Repository ID", "Repository Role"]) {
      fs.writeFileSync(
        second.body,
        originalContext.replace(
          new RegExp(`${field}: [^\\r\\n]+`, "u"),
          `${field}: foreign-source`,
        ),
      );
      const response = await detail(second.id);
      const text = await response.text();
      const conflict = JSON.parse(text).result.structuredContent.project;
      assert.equal(conflict.state, "conflicting", field);
      assert.deepEqual(
        conflict.sources[0],
        {
          repositoryId: second.id,
          state: "conflicting",
          revision: null,
          repositoryRole: null,
          context: null,
        },
        field,
      );
      assert.equal(text.includes("foreign-source"), false, field);
    }
    fs.writeFileSync(second.body, originalContext);
    const listed = await (await list()).json();
    assert.equal(listed.result.structuredContent.projects[0].sourceCount, 2);
    const git = path.join(second.target, ".git"),
      heldGit = path.join(second.target, ".git-held");
    fs.renameSync(git, heldGit);
    try {
      reads = 0;
      const blocked = await list();
      assert.equal(blocked.status, 200);
      assert.deepEqual((await blocked.json()).error, {
        code: -32603,
        message: "Project Context unavailable",
      });
      assert.equal(reads, 0);
    } finally {
      fs.renameSync(heldGit, git);
    }
    const manifest = path.join(
      second.target,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    const heldManifest = path.join(
      path.dirname(manifest),
      "repository-manifest-held.json",
    );
    fs.renameSync(manifest, heldManifest);
    try {
      reads = 0;
      const blocked = await list();
      assert.deepEqual(await blocked.json(), {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Project Context unavailable" },
      });
      assert.equal(reads, 0);
    } finally {
      fs.renameSync(heldManifest, manifest);
    }
    revokeFixtureBinding(state);
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.equal((await call(base, f.mcpToken)).status, 401);
  } finally {
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
  await assert.rejects(fetch(`${base}/mcp`));
});

/**
 * 同期本文Reader開始後の取消を固定非公開エラーへ閉じる。
 * @responsibility 開始済みReaderの終了と後続読取り停止を直接観測する。
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 通常認証済みの要求Handlerと二Repository。
 * @stimulus 第一本体のopen後に同要求Signalをabortする。
 * @observation 当該descriptorのclose、各本文open数、固定エラーとresult不存在。
 * @oracle 第一本体open1／close1、第二本文0、暗黙再実行0。開始後取消は既存-32603分類。
 * @cleanup open／close hookを復元して自己生成Fixtureを回収する。
 * @boundary 同期Domain読取り→Resolver Signal検出→MCP固定拒否。
 */
test("同期読取り開始後の取消はclose後に固定拒否し後続を読まない", async (t) => {
  const f = hostedFixture(t);
  const handler = await fixtureOAuthResolver(f)(f.mcpToken);
  assert.ok(handler);
  const controller = new AbortController();
  const open = fs.openSync,
    close = fs.closeSync;
  let descriptor: number | undefined,
    closed = 0;
  const openDescriptors = new Set<number>();
  const reads = [0, 0];
  fs.openSync = (file, flags, mode) => {
    const fd = open(file, flags, mode);
    openDescriptors.add(fd);
    const index = f.targets.findIndex(({ body }) => String(file) === body);
    if (index >= 0) reads[index] = (reads[index] ?? 0) + 1;
    if (index === 0) {
      descriptor = fd;
      controller.abort();
    }
    return fd;
  };
  fs.closeSync = (fd) => {
    close(fd);
    openDescriptors.delete(fd);
    if (fd === descriptor) {
      closed++;
      descriptor = undefined;
    }
  };
  try {
    const result = await invokeMcpSource(
      handler,
      packet(MCP_PROJECT_CONTEXT_LIST_TOOL),
      controller.signal,
    );
    assert.deepEqual(result, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32800, message: "Request cancelled" },
    });
    assert.equal(Object.hasOwn(result, "result"), false);
    assert.deepEqual(reads, [1, 0]);
    assert.equal(closed, 1);
    assert.equal(openDescriptors.size, 0);
  } finally {
    fs.openSync = open;
    fs.closeSync = close;
  }
});

/**
 * Header認証後の本文待機中に現在許可を変更する。
 * @responsibility Header時の本人確認を後続内容Authorityへ固定しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 二Repositoryと実HTTP Server。
 * @stimulus Header認証完了後にGitホストの許可または本人紐付けを取り消し、本文を完結する。
 * @observation 空Portfolio／固定エラー、本文open数、Server回収。
 * @oracle 進行中の要求は両方とも内容を返さず、紐付け失効後の新規要求は認証から拒否する。
 * @cleanup fs hook復元、要求終了とServer close後にFixtureを回収する。
 * @boundary 実stream本文待機→fresh AM認可→MCP結果。
 */
test("本文待機中のGitホスト権限喪失と紐付け失効は内容Callへ反映", {
  timeout: 15000,
}, async (t) => {
  const f = hostedFixture(t),
    resolver = fixtureOAuthResolver(f);
  let authenticated: (() => void) | undefined;
  const server = await startMcpAuthenticatedStreamableHttp(
    async (token) => {
      const handler = await resolver(token);
      authenticated?.();
      return handler;
    },
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  const original = fs.readFileSync(f.current);
  const open = fs.openSync;
  let reads = 0;
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ body }) => String(file) === body)) reads++;
    return open(file, flags, mode);
  };
  try {
    for (const [tool, change] of [
      [MCP_PROJECT_CONTEXT_LIST_TOOL, "permission"],
      [MCP_PROJECT_CONTEXT_LIST_TOOL, "unknown"],
      [MCP_PROJECT_CONTEXT_LIST_TOOL, "revoked"],
      ["crdd.create_topic", "permission"],
      ["crdd.create_topic", "unknown"],
      ["crdd.create_topic", "revoked"],
    ] as const) {
      fs.writeFileSync(f.current, original);
      for (const { id } of f.targets) f.permissions.set(id, "write");
      const headerReady = new Promise<void>((resolve) => {
        authenticated = resolve;
      });
      const body = JSON.stringify(
        packet(
          tool,
          tool === "crdd.create_topic"
            ? { repositoryId: "repository.a", markdown: topicMarkdown() }
            : undefined,
        ),
      );
      let finish: (() => void) | undefined;
      const response = new Promise<string>((resolve, reject) => {
        const request = httpRequest(
          `${base}/mcp`,
          {
            method: "POST",
            agent: false,
            headers: {
              authorization: `Bearer ${f.mcpToken}`,
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
              "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
              "mcp-method": "tools/call",
              "mcp-name": tool,
            },
          },
          (incoming) => {
            let text = "";
            incoming.setEncoding("utf8");
            incoming.on("data", (chunk: string) => {
              text += chunk;
            });
            incoming.on("error", reject);
            incoming.on("end", () => resolve(text));
          },
        );
        request.on("error", reject);
        finish = () => request.end(body.slice(1));
        request.write(body.slice(0, 1));
      });
      await headerReady;
      const state = JSON.parse(original.toString()) as AccessManagementState;
      if (change === "permission") f.permissions.clear();
      else if (change === "unknown")
        f.permissions.set("repository.a", "unavailable");
      else {
        revokeFixtureBinding(state);
      }
      fs.writeFileSync(f.current, JSON.stringify(state));
      reads = 0;
      assert.ok(finish);
      finish();
      const result = JSON.parse(await response);
      if (tool === "crdd.create_topic")
        assert.deepEqual(result.error, {
          code: change === "unknown" ? -32603 : -32602,
          message: change === "unknown" ? "Internal error" : "Invalid params",
        });
      else if (change === "unknown")
        assert.deepEqual(result.error, {
          code: -32603,
          message: "Project Context unavailable",
        });
      else assert.deepEqual(result.result.structuredContent.projects, []);
      assert.equal(reads, 0);
      if (change === "revoked")
        assert.equal((await call(base, f.mcpToken, tool)).status, 401);
      if (tool === "crdd.create_topic") {
        const target = f.targets[0];
        assert.ok(target);
        assert.equal(
          createTopicOperations(target.target, "project.fixture").get(
            "TOPIC-000042",
          ),
          null,
        );
      }
    }
  } finally {
    authenticated = undefined;
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});
