/**
 * Shared Gatewayの現在権限とRepository非開示を実HTTPで検証する。
 *
 * @packageDocumentation
 * @responsibility 公開MCP／RESTから現在Credential、Session、Exposure、Repository解決と内容取得までを通し、拒否と不存在の同値を確認する。
 * @trace RFD-ST-004
 * @level ST
 * @scope shared-gateway、credential、workspace、exposure、repository-projection、non-disclosure
 * @boundary System/E2E: Shared Gateway→MCP／REST→Credential→Session→Exposure→Repository Projection。入力のRepository内容と変更Portは非秘密のMemory Fixture。
 */
import assert from "node:assert/strict";
import { Socket } from "node:net";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  type CrosExposureSnapshot,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import type { TopicMeetingRepository } from "../../../domain-model/src/topic/index.ts";
import { createTopicApplication } from "../../../domain-model/src/topic/index.ts";
import { createMeetingApplication } from "../../../domain-model/src/meeting/index.ts";
import { parseTopicMarkdown } from "../../../domain-model/src/topic/index.ts";
import { parseRepositoryProjectContextMarkdown } from "../../../domain-model/src/project-context/index.ts";
import {
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_GET_TOOL,
  startCrosSharedServer,
} from "../../src/index.ts";

const PUBLIC_ORIGIN = "https://cros.example.test";
const TARGET = "REPO-TARGET";
const ABSENT = "REPO-ABSENT";
const TOPIC = "TOPIC-000001";
const CANARY = "non-disclosed-content-canary";
const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});
const TOPIC_MARKDOWN = `# ${CANARY}\n\n成果物種別: Topic\nTopic ID: \`${TOPIC}\`\nProject ID: \`PRJ-NONDISCLOSURE\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\n${CANARY}\n`;

/**
 * 終了したGatewayへ新しいTCP接続を試み、接続拒否と観測不能を区別する。
 *
 * @responsibility HTTP Clientの既存接続を再利用せず、公開Listenerの停止を直接観測する。
 * @trace RFD-ST-004
 * @precondition Shared Serverのcloseが完了し、確認対象は同じLoopback Portである。
 * @stimulus 新しいSocketで確認対象Portへの接続を一度要求する。
 * @observation 接続成立、接続拒否、その他のErrorまたは観測期限超過を区別する。
 * @oracle ECONNREFUSEDだけをListener停止の根拠とし、それ以外は試験を失敗させる。
 * @cleanup 所有Socketをdestroyし、close通知を待ってTimerを解除する。
 * @boundary Test Process→Loopback TCP Listener。別Process全体の資源不存在は主張しない。
 */
async function assertGatewayListenerAbsent(gateway: string): Promise<string> {
  const outcome = await new Promise<string>((resolve) => {
    const socket = new Socket();
    let observed = "unknown";
    const timer = setTimeout(() => {
      observed = "timeout";
      socket.destroy();
    }, 5_000);
    socket.once("connect", () => {
      observed = "connected";
      socket.destroy();
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      observed = error.code ?? "error_without_code";
      socket.destroy();
    });
    socket.once("close", () => {
      clearTimeout(timer);
      resolve(observed);
    });
    socket.connect({ host: "127.0.0.1", port: Number(new URL(gateway).port) });
  });
  assert.equal(outcome, "ECONNREFUSED");
  return outcome;
}

/**
 * 内容読取りと変更Portの到達を別々に観測できるMemory Repositoryを用意する。
 *
 * @responsibility 実Applicationの読取りを正常対照で観測し、拒否時のPort未到達を確認できるFixtureを提供する。
 * @trace RFD-ST-004
 * @precondition 非秘密の固定Topic MarkdownがParser契約を満たす。
 * @stimulus 公開Applicationへ接続するRepository Portを構築する。
 * @observation getDocument／getの実呼出し数と変更Portの実呼出し数を独立に取得する。
 * @oracle 正常読取りは固定Topicを返し、変更Portは呼出しを計数して明示拒否する。
 * @cleanup N/A: Process Memoryだけを所有し、Filesystemや外部Providerを使用しない。
 * @boundary Project Operation Application→Memory Repository Port。
 */
function observedRepository() {
  const record = parseTopicMarkdown(TOPIC_MARKDOWN);
  const counters = { reads: 0, mutationPortCalls: 0 };
  const port: TopicMeetingRepository = {
    /**
     * 対象TopicのRecord読取りを計数する。
     *
     * @responsibility Record取得Portの到達と固定Topicの返却を観測する。
     * @trace RFD-ST-004
     * @precondition 固定Topic Recordを生成済みである。
     * @stimulus 種類とIDを受け取り、読取り計数を増やす。
     * @observation readsの実増分と返却Recordを観測する。
     * @oracle 指定TopicだけRecordを返し、それ以外はnullとする。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    get: (kind, id) => {
      counters.reads += 1;
      return kind === "topic" && id === TOPIC ? record : null;
    },
    /**
     * 対象Topicの本文読取りを計数する。
     *
     * @responsibility 本文取得Portの到達と非秘密canary本文を観測する。
     * @trace RFD-ST-004
     * @precondition 固定Topicと本文を生成済みである。
     * @stimulus 種類とIDを受け取り、読取り計数を増やす。
     * @observation readsの実増分と返却Markdownを観測する。
     * @oracle 指定Topicだけ本文を返し、それ以外はnullとする。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    getDocument: (kind, id) => {
      counters.reads += 1;
      return kind === "topic" && id === TOPIC
        ? { record, markdown: TOPIC_MARKDOWN }
        : null;
    },
    /**
     * 固定Topic一覧を提供する。
     *
     * @responsibility Applicationへ正常な一覧取得の入力を提供する。
     * @trace RFD-ST-004
     * @precondition 固定Topic Recordを生成済みである。
     * @stimulus 一覧Portの呼出しを受ける。
     * @observation availableと固定一件のRecordを返す。
     * @oracle 一覧は合成Topic一件だけであり外部取得をしない。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    list: () => ({ status: "available", records: [record] }),
    /**
     * FixtureにCHGが存在しないことを返す。
     *
     * @responsibility 変更Relation検証へ固定した不存在の前提を提供する。
     * @trace RFD-ST-004
     * @precondition Memory FixtureはCHGを保持しない。
     * @stimulus CHG存在確認Portの呼出しを受ける。
     * @observation 固定falseを返す。
     * @oracle FixtureのCHG不存在だけを示し、実Repositoryの不存在は主張しない。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    hasChange: () => false,
    /**
     * 作成Portの到達を計数し、実変更を拒否する。
     *
     * @responsibility 正常認可で変更Portへ到達する対照を作る。
     * @trace RFD-ST-004
     * @precondition 固定Topicが既に存在する。
     * @stimulus 作成要求を受けて変更Port計数を増やす。
     * @observation 呼出し増分とblocked結果を返す。
     * @oracle record_already_existsで拒否しfilesystemEffectCountは0とする。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    create: () => {
      counters.mutationPortCalls += 1;
      return {
        status: "blocked",
        reason: "record_already_exists",
        record: null,
        relationPaths: [],
        filesystemEffectCount: 0,
      };
    },
    /**
     * 更新Portの到達を計数し、実変更を拒否する。
     *
     * @responsibility 権限外要求が更新処理へ到達していないことを計数できるようにする。
     * @trace RFD-ST-004
     * @precondition 固定Topic以外の更新状態は保持しない。
     * @stimulus 更新要求を受けて変更Port計数を増やす。
     * @observation 呼出し増分とblocked結果を返す。
     * @oracle record_revision_conflictで拒否しfilesystemEffectCountは0とする。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    update: () => {
      counters.mutationPortCalls += 1;
      return {
        status: "blocked",
        reason: "record_revision_conflict",
        record: null,
        relationPaths: [],
        filesystemEffectCount: 0,
      };
    },
    /**
     * 削除確認用の固定Recordを提供する。
     *
     * @responsibility 削除前確認の入力をMemory内に限定する。
     * @trace RFD-ST-004
     * @precondition 固定Topic Recordを生成済みである。
     * @stimulus 削除確認Portの呼出しを受ける。
     * @observation 固定Recordと空Relationを返す。
     * @oracle 外部RepositoryのRelationを取得しない。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    inspectDeletion: () => ({ record, relationPaths: [] }),
    /**
     * 削除Portの到達を計数し、実変更を拒否する。
     *
     * @responsibility 権限外要求が削除処理へ到達していないことを計数できるようにする。
     * @trace RFD-ST-004
     * @precondition Fixtureへ削除確認Authorityを発行していない。
     * @stimulus 削除要求を受けて変更Port計数を増やす。
     * @observation 呼出し増分とblocked結果を返す。
     * @oracle record_delete_confirmation_requiredで拒否しfilesystemEffectCountは0とする。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    delete: () => {
      counters.mutationPortCalls += 1;
      return {
        status: "blocked",
        reason: "record_delete_confirmation_required",
        record: null,
        relationPaths: [],
        filesystemEffectCount: 0,
      };
    },
  };
  return {
    counters,
    application: Object.freeze({
      topic: createTopicApplication(port),
      meeting: createMeetingApplication(port),
    }),
  };
}

/**
 * 公開応答への内容流出を検出できる五場面Project Contextを用意する。
 *
 * @responsibility 許可正常対照と権限外拒否へ同一の非秘密内容を入力する。
 * @trace RFD-ST-004
 * @precondition 固定Repository Identityと五つの見出しを使う。
 * @stimulus 固定Markdownを本番Parserで解析する。
 * @observation Project／Repository Identityと本文canaryを保持する。
 * @oracle Parserを通ったContextだけをProjectionへ渡す。
 * @cleanup N/A: 文字列とProcess Memoryだけを使用する。
 * @boundary Canonical Markdown Parser→CROS Repository Projection。
 */
function projectContext() {
  const scenes = [
    "1. 今どうなっているか",
    "2. 何が危ない、または止まっているか",
    "3. 今、人間が決めることは何か",
    "4. なぜこの状態・判断になったか",
    "5. 次に何をすべきか",
  ].map(
    (title) =>
      `## ${title}\n\n${CANARY}\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| ${CANARY} | current | protected-source-canary.md |`,
  );
  return parseRepositoryProjectContextMarkdown(
    `# Project Context\n\nProject ID: \`PRJ-NONDISCLOSURE\`\nRepository ID: \`${TARGET}\`\nRepository Role: \`development\`\n\n${scenes.join("\n\n")}\n`,
  );
}

/**
 * 同一Origin Gatewayへ固定MCP要求を搬送する。
 *
 * @responsibility Toolと明示対象を実HTTPへ渡し、同値比較できる公開応答を返す。
 * @trace RFD-ST-004
 * @precondition loopback Gateway、合成Credentialと期待TLS終端Headerを用意する。
 * @stimulus 一Tool Callを5秒期限付きで発行し、JSON応答を消費する。
 * @observation HTTP Statusと公開JSONだけを取得する。
 * @oracle TokenはAuthorization Headerだけに入り、公開応答の比較へTokenを複製しない。
 * @cleanup 応答を最後まで消費し、失敗時はAbortSignalの期限で通信を終了する。
 * @boundary Shared Gateway→認証済みMCP→Application。
 */
async function callTool(
  gateway: string,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
) {
  const response = await fetch(`${gateway}/mcp`, {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "cros.example.test",
      origin: PUBLIC_ORIGIN,
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "non-disclosure-comparison",
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  return { status: response.status, body: await response.json() };
}

/**
 * 三種類の権限外条件を、対象指定の拒否、不存在同値およびPort未到達へ閉じる。
 *
 * @responsibility RFD-ST-004の正常対照、Grant外、Exposure改訂不一致二種類とadmin-onlyを実Shared Gatewayから検証する。
 * @trace RFD-ST-004
 * @precondition Developerとadmin-only Credential、同一Server、可変な現在Exposure Snapshotと計数付きMemory Repositoryを用意する。
 * @stimulus 正常読取り後、四反例それぞれで対象／不存在の内容取得・変更要求とREST／MCP投影を送り、最後に正常状態へ戻す。
 * @observation 公開応答同値、非開示canary、Snapshot取得、Application解決、Reader／変更Port到達、再許可と終了後接続拒否を記録する。
 * @oracle 拒否は不存在と同じ公開結果となり、対象Application／Reader／変更Portへ到達しない。正常対照と再許可だけは実Readerへ到達する。
 * @cleanup Shared Serverをcloseし、Gatewayへの新規接続がECONNREFUSEDとなることを確認する。内部全handleの独立実測とは主張しない。
 * @boundary System/E2E: Shared Gateway→MCP／REST→Credential→Session→Exposure→Repository Projection。
 */
test("Shared Gatewayは現在権限で内容取得を拒否しRepositoryの存在を漏らさない", async (t) => {
  const registry = createMemoryConnectionCredentialRegistry();
  const developer = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  const administrator = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "administrator",
  });
  assert.equal(developer.status, "completed");
  assert.equal(administrator.status, "completed");
  if (developer.status !== "completed" || administrator.status !== "completed")
    return;
  const repository = observedRepository();
  const context = projectContext();
  let snapshotReads = 0;
  let applicationResolutions = 0;
  let mode = "allowed";
  const server = await startCrosSharedServer({
    publicOrigin: PUBLIC_ORIGIN,
    registry,
    /**
     * 現在Exposureの入力を供給し取得回数を計数する。
     *
     * @responsibility RequestごとのSnapshot再取得と四反例の入力を提供する。
     * @trace RFD-ST-004
     * @precondition 同一Serverのmodeを試験が保持する。
     * @stimulus Snapshot要求時に現在modeのGrant範囲と改訂を返す。
     * @observation snapshotReadsの増分とExposure改訂値を観測する。
     * @oracle 各Requestで現在modeを読み、古い改訂二種類を別に返す。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    readExposureSnapshot: (): CrosExposureSnapshot => {
      snapshotReads += 1;
      return {
        revision: "exposure-current-2",
        exposures: [
          {
            workspaceId:
              mode === "grant-outside" ? "management" : "development",
            repositoryId: TARGET,
            repositoryRevision:
              mode === "repository-stale" ? "repo-old-1" : "repo-current-2",
            registryRevision:
              mode === "registry-stale"
                ? "exposure-old-1"
                : "exposure-current-2",
            active: true,
          },
        ],
        repositories: [
          {
            projectId: "PRJ-NONDISCLOSURE",
            repositoryId: TARGET,
            bindingId: "BIND-TARGET",
            revision: "repo-current-2",
            content: { projectContext: context },
          },
        ],
      };
    },
    /**
     * 認可済みApplication解決の到達を計数する。
     *
     * @responsibility 拒否要求が対象Application Factoryへ到達しないことを確認する。
     * @trace RFD-ST-004
     * @precondition 計数付きMemory Repository Applicationを構築済みである。
     * @stimulus Factory呼出しを受けてApplication解決計数を増やす。
     * @observation applicationResolutionsの実増分を観測する。
     * @oracle 正常認可だけが対象Applicationへ到達する。
     * @cleanup N/A: Process Memoryだけを使用し外部資源を取得しない。
     * @boundary Shared Gateway試験→Memory Fixture Port。
     */
    resolveTopicMeetingApplication: () => {
      applicationResolutions += 1;
      return repository.application;
    },
  });
  const gateway = server.localGatewayUrl;
  try {
    const allowed = await callTool(
      gateway,
      developer.token,
      MCP_TOPIC_GET_TOOL,
      {
        repositoryId: TARGET,
        id: TOPIC,
      },
    );
    assert.equal(allowed.status, 200);
    assert.match(JSON.stringify(allowed.body), new RegExp(CANARY, "u"));
    assert.ok(repository.counters.reads > 0);
    assert.ok(applicationResolutions > 0);
    await callTool(gateway, developer.token, MCP_TOPIC_CREATE_TOOL, {
      repositoryId: TARGET,
      markdown: TOPIC_MARKDOWN,
    });
    assert.equal(repository.counters.mutationPortCalls, 1);
    t.diagnostic(
      JSON.stringify({
        phase: "allowed-control",
        publicReadResult: allowed,
        snapshotReads,
        applicationResolutions,
        ...repository.counters,
      }),
    );

    for (const condition of [
      "grant-outside",
      "registry-stale",
      "repository-stale",
      "admin-only",
    ]) {
      mode = condition;
      const token: string =
        condition === "admin-only" ? administrator.token : developer.token;
      const before = {
        snapshotReads,
        applicationResolutions,
        ...repository.counters,
      };
      const denied = await callTool(gateway, token, MCP_TOPIC_GET_TOOL, {
        repositoryId: TARGET,
        id: TOPIC,
      });
      const absent = await callTool(gateway, token, MCP_TOPIC_GET_TOOL, {
        repositoryId: ABSENT,
        id: TOPIC,
      });
      assert.equal(denied.status, 200);
      const publicRefusalEqualsAbsent = isDeepStrictEqual(denied, absent);
      assert.equal(publicRefusalEqualsAbsent, true);
      assert.match(JSON.stringify(denied.body), /Invalid params/u);
      const mutation = await callTool(gateway, token, MCP_TOPIC_CREATE_TOOL, {
        repositoryId: TARGET,
        markdown: TOPIC_MARKDOWN,
      });
      assert.deepEqual(mutation, absent);
      const projection = await callTool(
        gateway,
        token,
        MCP_PROJECT_CONTEXT_GET_TOOL,
        {
          projectId: "PRJ-NONDISCLOSURE",
        },
      );
      const portfolioResponse: Response = await fetch(
        `${gateway}/v1/portfolio`,
        {
          signal: AbortSignal.timeout(5_000),
          headers: {
            "x-forwarded-proto": "https",
            "x-forwarded-host": "cros.example.test",
            origin: PUBLIC_ORIGIN,
            authorization: `Bearer ${token}`,
          },
        },
      );
      assert.equal(portfolioResponse.status, 200);
      const portfolio = await portfolioResponse.json();
      assert.equal(portfolio.status, "available");
      assert.deepEqual(portfolio.portfolio.projects, []);
      for (const body of [
        denied.body,
        mutation.body,
        projection.body,
        portfolio,
      ]) {
        assert.doesNotMatch(
          JSON.stringify(body),
          /REPO-TARGET|BIND-TARGET|non-disclosed-content-canary|protected-source-canary|management/iu,
        );
      }
      assert.equal(snapshotReads - before.snapshotReads, 5);
      assert.equal(applicationResolutions, before.applicationResolutions);
      assert.equal(repository.counters.reads, before.reads);
      assert.equal(
        repository.counters.mutationPortCalls,
        before.mutationPortCalls,
      );
      t.diagnostic(
        JSON.stringify({
          condition,
          credentialId:
            condition === "admin-only"
              ? administrator.record.credentialId
              : developer.record.credentialId,
          credentialRegistryRevision: registry.inspect().revision,
          exposureRevision: "exposure-current-2",
          expectedRequestCount: 5,
          publicResults: {
            denied,
            absent,
            mutation,
            projection,
            portfolio: { status: portfolioResponse.status, body: portfolio },
          },
          snapshotReadDelta: snapshotReads - before.snapshotReads,
          targetApplicationDelta:
            applicationResolutions - before.applicationResolutions,
          targetReadDelta: repository.counters.reads - before.reads,
          targetMutationPortDelta:
            repository.counters.mutationPortCalls - before.mutationPortCalls,
          publicRefusalEqualsAbsent,
        }),
      );
    }
    mode = "allowed";
    const readsBeforeRestore = repository.counters.reads;
    const restored = await callTool(
      gateway,
      developer.token,
      MCP_TOPIC_GET_TOOL,
      {
        repositoryId: TARGET,
        id: TOPIC,
      },
    );
    assert.deepEqual(restored, allowed);
    assert.ok(repository.counters.reads > readsBeforeRestore);
    t.diagnostic(
      JSON.stringify({
        phase: "allowed-restored",
        publicReadResult: restored,
        readDelta: repository.counters.reads - readsBeforeRestore,
        snapshotReads,
        applicationResolutions,
        ...repository.counters,
      }),
    );
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
    t.diagnostic(JSON.stringify({ phase: "closed", result: closed }));
  }
  const listenerOutcome = await assertGatewayListenerAbsent(gateway);
  t.diagnostic(JSON.stringify({ phase: "listener-probe", listenerOutcome }));
});
