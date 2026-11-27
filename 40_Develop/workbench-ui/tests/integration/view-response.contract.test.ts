/**
 * UIのJSON受付をHTTPサーバーなしで反証する。
 * @packageDocumentation
 * @responsibility 認証前表示とMain応答の型・状態・相関の拒否条件を検証する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary 合成HTTP応答とBrowserの表示モデル。保存・実行は行わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateGitHostConnections,
  validateManagementResponse,
  validateViewResponse,
} from "../../src/api/response.ts";

/** 管理画面は各正常結果を受け付け、秘密項目・相関違反を描画へ渡さない。 @trace ERB-IT-021 */
test("管理の応答は操作別の閉形式と改訂の相関を守る", () => {
  const userId = "a0000000-0000-4000-8000-000000000001";
  const user = { userId, role: "administrator", username: "Fixture" };
  const exposure = {
    repositoryId: "repository.fixture",
    workspaceIds: ["development"],
  };
  const complete = { status: "completed", revision: 2 };
  const mutation = {
    ...complete,
    operationId: userId,
    expectedRevision: 1,
    userId,
    publication: "confirmed",
    cleanupConfirmed: true,
  };
  const current = {
    ...complete,
    user,
  };
  for (const [view, value] of [
    ["current", current],
    ["users", { ...complete, users: [user] }],
    [
      "repositories",
      { ...complete, repositories: [{ repositoryId: exposure.repositoryId }] },
    ],
    ["mutation", mutation],
    ["mutation", { status: "rejected", reason: "management_request_rejected" }],
    [
      "mutation",
      { status: "rejected", reason: "management_revision_conflict" },
    ],
  ] as const) {
    assert.equal(validateManagementResponse(value, view), value);
    assert.throws(
      () =>
        validateManagementResponse({ ...value, token: "never-display" }, view),
      /workbench_management_result_invalid/u,
    );
  }
  for (const [view, value] of [
    [
      "current",
      { ...current, user: { ...user, tokenVerifier: "never-display" } },
    ],
    ["current", { ...current, permittedRepositories: [exposure] }],
    ["current", { ...current, contentAccess: { workspaceIds: [] } }],
    ["users", { ...complete, users: [{ ...user, role: "unknown" }] }],
    [
      "repositories",
      {
        ...complete,
        repositories: [
          { ...exposure, workspaceIds: ["development", "development"] },
        ],
      },
    ],
    ["mutation", { ...mutation, expectedRevision: 2 }],
    ["mutation", { ...mutation, cleanupConfirmed: false }],
    [
      "mutation",
      {
        status: "rejected",
        reason: "management_revision_conflict",
        revision: 2,
      },
    ],
  ] as const)
    assert.throws(
      () => validateManagementResponse(value, view),
      /workbench_management_result_invalid/u,
    );
});

/** 受理される合成AI選定。実Providerは接続しない。 @trace ERB-IT-021 */
function selectionConfig() {
  const advice = { provider: "codex", model: "advice-model", effort: "medium" };
  const task = { provider: "codex", model: "task-model", effort: "medium" };
  return {
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: {
      coordinator: advice,
      executor: task,
      independent_reviewer: task,
      result_integration: advice,
      advice,
    },
    workTypes: { coding: { label: "Coding" } },
    overrides: {},
  };
}

/** 不信入力の反証の起点になる、受理確認済みの合成Main応答。 @trace ERB-IT-021 */
function mainResponse() {
  const collection = { state: "not_configured", items: [], reason: null };
  const page = { status: "not_configured", records: [], nextCursor: null };
  const response = validateViewResponse({
    contract: "crdd/workbench/view/v1",
    view: "main",
    actionToken: "a".repeat(43),
    projectData: {
      context: {
        projectId: "project.fixture",
        repositoryId: "repository.fixture",
        repositoryRole: "product",
        scenes: ["current", "risk", "decision", "reason", "next"].map(
          (key) => ({
            key,
            title: key,
            summary: null,
            table: { columns: [], rows: [] },
          }),
        ),
      },
      topics: collection,
      meetings: collection,
      plan: {
        state: "available",
        reason: null,
        projection: {
          publishedBaseline: "v1",
          targetVersion: "v2",
          targetReleaseDate: null,
          workState: "active",
          releaseDecision: "pending",
          scheduleRisk: "unknown",
          scope: [],
          dependencies: [],
        },
      },
      quality: {
        state: "available",
        reason: null,
        projection: {
          overallState: "unknown",
          target: "fixture",
          observed: "",
          unobserved: "",
          knownGap: "",
          nextGate: "",
          humanDecision: "",
          rationale: {},
        },
      },
      ownerArtifacts: {
        state: "available",
        reason: null,
        artifacts: [
          {
            relativePath: "docs/example.md",
            title: "Fixture",
            category: "relation",
            origin: "fixed",
            sourceSection: null,
          },
        ],
      },
      repository: {
        state: "available",
        reason: null,
        changeSet: {
          contract: "crdd-version-control/local-change-set/v1",
          contractRevision: 1,
          revisionChanges: [],
          preparedChanges: [],
          workingChanges: [],
          unregisteredPaths: [],
          observationComplete: true,
          repositoryPathReported: false,
        },
        publicationTarget: {
          status: "not_configured",
          reason: "fixture",
          destination: null,
          branch: null,
          localBranch: null,
          revisionIdentity: null,
        },
      },
    },
    portfolio: null,
    portfolioPage: { nextCursor: null, cursorInvalid: false },
    connection: { state: "repository" },
    topicPage: page,
    topicQuery: {},
    meetingPage: page,
    meetingQuery: {},
    recordDocuments: [],
    selectedRepositoryId: null,
    recordActionsConfigured: false,
    repositoryActions: [],
    worktree: { state: "unknown", tree: null, diff: null },
    aiSelection: {
      catalog: {
        identity: "fixture",
        catalog: { contract: "crdd/ai-model-catalog", models: [] },
      },
      selection: {
        status: "missing",
        reason: "ai_selection_not_configured",
        snapshot: null,
      },
    },
    aiSelectionManagement: { allowed: false, result: null, snapshot: null },
    aiRequest: {
      configured: false,
      additionalHosts: null,
      snapshot: null,
      notice: null,
    },
    executionActivity: null,
  });
  assert.equal(response.view, "main");
  return response;
}

/**
 * Local CROSの接続専用Modelが未認証内容と秘密fieldを拒否する。
 * @responsibility 仮のMain Modelを使わず、接続と内容選択の境界を検査する。
 * @trace ERB-IT-021
 * @precondition ProductionのClient Model Inspectorを直接使用する。
 * @stimulus 正規未接続・認証済み空集合と、余剰秘密field／未認証内容を入力する。
 * @observation access判別子受理と固定Errorを確認する。
 * @oracle 未認証にPortfolio・資格Snapshotなし、未知fieldは全拒否。
 * @cleanup N/A: 純粋なModel検査だけ。
 * @boundary 接続JSON→CSR Model Inspector。
 */
test("Local CROS Client Modelは接続専用の閉集合と未認証境界を守る", () => {
  const model = {
    contract: "crdd/workbench/view/v1",
    view: "access",
    actionToken: "a".repeat(43),
    authenticated: false,
    notice: null,
    portfolio: null,
  };
  assert.equal(validateViewResponse(model).view, "access");
  const loginProviders = [
    { id: "google", displayName: "Google" },
    { id: "fixture", displayName: "Fixture" },
  ];
  assert.deepEqual(validateViewResponse({ ...model, loginProviders }), {
    ...model,
    loginProviders,
  });
  assert.equal(
    validateViewResponse({ ...model, loginProviders, authenticated: true })
      .view,
    "access",
  );
  const empty = { projects: [], retainedAsSourceOfTruth: false };
  assert.equal(
    validateViewResponse({
      ...model,
      authenticated: true,
      portfolio: empty,
    }).view,
    "access",
  );
  for (const value of [
    { ...model, token: "synthetic-secret" },
    { ...model, root: "synthetic-host-root" },
    { ...model, portfolio: empty },
    { ...model, loginProviders, portfolio: empty },
    { ...model, loginProviders: [] },
    { ...model, loginProviders: [loginProviders[0], loginProviders[0]] },
    { ...model, loginProviders: [{ id: "../other", displayName: "Other" }] },
    {
      ...model,
      loginProviders: [
        { ...loginProviders[0], clientSecret: "synthetic-secret" },
      ],
    },
    { ...model, credentials: { state: "available", snapshot: null } },
    { ...model, actionToken: "" },
    { ...model, logoPath: "https://external.invalid/logo" },
    {
      ...model,
      authenticated: true,
      portfolio: { projects: [], retainedAsSourceOfTruth: true },
    },
  ])
    assert.throws(() => validateViewResponse(value), {
      message: "workbench_client_model_invalid",
    });
});

test("Google共有画面の作業領域権限を、単体や通常Gitの書込みへ読み替えない", () => {
  const main = mainResponse();
  const hosted = {
    ...main,
    connection: { state: "cros_available" },
    selectedRepositoryId: "repository.fixture",
  };
  for (const workspaceAccess of ["read", "write", "unavailable"])
    assert.equal(
      validateViewResponse({ ...hosted, workspaceAccess }).view,
      "main",
    );
  assert.equal(
    validateViewResponse({
      ...hosted,
      workspaceAccess: "write",
      repositoryActions: ["prepare", "unprepare"],
    }).view,
    "main",
  );
  for (const value of [
    { ...main, workspaceAccess: "read" },
    { ...hosted, workspaceAccess: "unknown" },
    { ...hosted, workspaceAccess: "read", repositoryActions: ["prepare"] },
    {
      ...hosted,
      workspaceAccess: "write",
      repositoryActions: ["create_revision", "publish_revision"],
    },
    {
      ...hosted,
      workspaceAccess: "write",
      repositoryActions: ["prepare", "prepare"],
    },
    { ...hosted, workspaceAccess: "write", repositoryActions: ["unknown"] },
    {
      ...hosted,
      workspaceAccess: "read",
      selectedRepositoryId: "repository.other",
    },
  ])
    assert.throws(() => validateViewResponse(value), {
      message: "workbench_client_model_invalid",
    });
});

/**
 * Browser JSON境界が不正Discriminantと必須構造欠落を拒否することを検証する。
 *
 * @responsibility TypeScript castだけで不正JSONを成功画面へ通さないことを反証する。
 * @trace ERB-IT-021
 * @precondition Client Model InspectorがProduction入口と同じ実装である。
 * @stimulus 不正contract、未知viewおよびmain必須構造欠落を入力する。
 * @observation 送出される固定Errorを観測する。
 * @oracle 全入力がworkbench_client_model_invalidで拒否される。
 * @cleanup N/A: 外部資源を使用しない。
 * @boundary ERB-IT-021=Direct Boundary: JSON unknown value→Client Model Inspector
 */
test("Workbench Clientは契約不正JSONを描画前に拒否する", () => {
  const github = {
    id: "github",
    host: "github.com",
    displayName: "GitHub",
    connected: true,
  };
  const alternate = {
    id: "fixture.git--team.example-test",
    host: "git--team.example-test",
    displayName: "Fixture Host",
    connected: false,
  };
  assert.deepEqual(validateGitHostConnections({ hosts: [github, alternate] }), [
    github,
    alternate,
  ]);
  for (const hosts of [
    [github, { ...alternate, id: github.id }],
    [github, { ...alternate, host: github.host }],
    [{ ...github, id: "../github" }],
    [{ ...alternate, host: "git-.example-test" }],
    [{ ...alternate, host: `${"x".repeat(64)}.example-test` }],
    [{ ...github, connected: "true" }],
    [{ ...github, token: "never-display" }],
    [{ ...github, reference: "never-display" }],
  ]) {
    assert.throws(() => validateGitHostConnections({ hosts }), {
      message: "git_hosts_response_invalid",
    });
  }
  for (const value of [
    null,
    { contract: "invalid", view: "main" },
    { contract: "crdd/workbench/view/v1", view: "unknown" },
    { contract: "crdd/workbench/view/v1", view: "main" },
    {
      contract: "crdd/workbench/view/v1",
      view: "main",
      actionToken: "action-token",
      projectData: {},
      connection: {},
      topicPage: {},
      topicQuery: {},
      meetingPage: {},
      meetingQuery: {},
      credentials: {},
      aiRequest: {},
    },
    {
      contract: "crdd/workbench/view/v1",
      view: "project-detail",
      project: { projectId: "PRJ-001", state: "complete", sources: {} },
    },
    {
      contract: "crdd/workbench/view/v1",
      view: "record-detail",
      actionToken: "action-token",
      repositoryId: null,
      record: {
        kind: "topic",
        id: "TOPIC-000001",
        document: {
          markdown: "# Topic",
          record: {
            topicId: "TOPIC-000001",
            projectId: "PRJ-001",
            state: "unknown",
            revision: 1,
            owner: "Owner",
            title: "Topic",
            summary: "Summary",
          },
        },
        relations: [],
      },
    },
  ])
    assert.throws(
      () => validateViewResponse(value),
      /workbench_client_model_invalid/u,
    );
});

/** Main応答の欠測・余剰・相関違反を、受理済みの正常入力から独立に反証する。 @trace ERB-IT-021 */
test("Main表示は未信頼JSONの状態と相関を検証する", () => {
  const model = mainResponse();
  assert.doesNotThrow(() => validateViewResponse(structuredClone(model)));
  assert.throws(
    () =>
      validateViewResponse({
        ...model,
        credentials: { state: "not_configured", snapshot: null },
      }),
    { message: "workbench_client_model_invalid" },
  );
  for (const connection of [
    { ...model.connection, endpoint: "http://127.0.0.1:1/mcp" },
    { ...model.connection, notice: null },
    { state: "cros_unavailable" },
  ])
    assert.throws(() => validateViewResponse({ ...model, connection }));
  for (const aiSelection of [{}, undefined])
    assert.throws(
      () => validateViewResponse({ ...model, aiSelection }),
      /workbench_client_model_invalid/u,
    );
  const { projectData, ...rest } = model;
  assert.throws(
    () => validateViewResponse({ ...rest, surface: projectData }),
    /workbench_client_model_invalid/u,
  );
  const invalidSelection = structuredClone(model);
  assert.ok(invalidSelection.aiSelection);
  Object.assign(invalidSelection.aiSelection, {
    selection: {
      status: "available",
      reason: null,
      snapshot: { config: selectionConfig(), identity: "invalid" },
    },
  });
  assert.throws(
    () => validateViewResponse(invalidSelection),
    /workbench_client_model_invalid/u,
  );

  const invalidQuality = structuredClone(model) as unknown as {
    projectData: {
      quality: {
        projection: { rationale: Record<string, unknown> } | null;
      };
    };
  };
  assert.notEqual(invalidQuality.projectData.quality.projection, null);
  if (invalidQuality.projectData.quality.projection !== null) {
    invalidQuality.projectData.quality.projection.rationale.既知Gap = {
      unsafe: true,
    };
  }
  assert.throws(
    () => validateViewResponse(invalidQuality),
    /workbench_client_model_invalid/u,
  );

  const invalidPlan = structuredClone(model) as unknown as {
    projectData: {
      plan: {
        projection: { scope: unknown[] } | null;
      };
    };
  };
  assert.notEqual(invalidPlan.projectData.plan.projection, null);
  if (invalidPlan.projectData.plan.projection !== null) {
    invalidPlan.projectData.plan.projection.scope = [
      { item: { unsafe: true }, disposition: "in_scope", rationale: "x" },
    ];
  }
  assert.throws(
    () => validateViewResponse(invalidPlan),
    /workbench_client_model_invalid/u,
  );

  const invalidPlanReason = structuredClone(model) as unknown as {
    projectData: { plan: { reason: unknown } };
  };
  invalidPlanReason.projectData.plan.reason = { unsafe: true };
  assert.throws(
    () => validateViewResponse(invalidPlanReason),
    /workbench_client_model_invalid/u,
  );

  for (const invalidSceneKeys of [
    ["current", "risk", "decision", "reason"],
    ["current", "risk", "decision", "reason", "reason"],
    ["risk", "current", "decision", "reason", "next"],
  ]) {
    const invalidScenes = structuredClone(model) as unknown as {
      projectData: {
        context: {
          scenes: Array<Record<string, unknown>>;
        };
      };
    };
    invalidScenes.projectData.context.scenes = invalidSceneKeys.map(
      (key, index) => ({
        ...invalidScenes.projectData.context.scenes[index],
        key,
      }),
    );
    assert.throws(
      () => validateViewResponse(invalidScenes),
      /workbench_client_model_invalid/u,
    );
  }

  const invalidOperationRecord = structuredClone(model) as unknown as {
    topicPage: { records: unknown[] };
  };
  invalidOperationRecord.topicPage.records = [
    {
      kind: "meeting",
      topicId: "TOPIC-UNSAFE",
      meetingId: "MTG-000001",
      projectId: "PRJ-001",
      state: "recorded",
      occurredAt: "2026-09-28T00:00:00Z",
      revision: 1,
      owner: "Qual-Lab",
      title: "境界混同",
      summary: "MeetingへTopic Identityを混在させる。",
      pendingOutcomeCount: 0,
    },
  ];
  assert.throws(
    () => validateViewResponse(invalidOperationRecord),
    /workbench_client_model_invalid/u,
  );

  assert.equal(Object.hasOwn(model, "topic"), false);
  assert.equal(Object.hasOwn(model, "meeting"), false);
  const invalidSurfaceRecord = structuredClone(model) as unknown as {
    projectData: { topics: { items: unknown[] } };
  };
  invalidSurfaceRecord.projectData.topics.items =
    invalidOperationRecord.topicPage.records;
  assert.throws(
    () => validateViewResponse(invalidSurfaceRecord),
    /workbench_client_model_invalid/u,
  );

  const invalidRecordIdentity = structuredClone(model) as unknown as {
    recordDocuments: unknown[];
  };
  invalidRecordIdentity.recordDocuments = [
    {
      kind: "topic",
      id: "TOPIC-000001",
      document: {
        markdown: "# Topic",
        record: {
          topicId: "TOPIC-000002",
          projectId: "PRJ-001",
          state: "open",
          revision: 1,
          owner: "Qual-Lab",
          title: "Identity不一致",
          summary: "外側と内側のIdentityを変える。",
        },
      },
      relations: [],
    },
  ];
  assert.throws(
    () => validateViewResponse(invalidRecordIdentity),
    /workbench_client_model_invalid/u,
  );

  const invalidFederation = structuredClone(model) as unknown as {
    portfolio: unknown;
  };
  invalidFederation.portfolio = {
    retainedAsSourceOfTruth: false,
    projects: [
      {
        projectId: model.projectData.context.projectId,
        state: "complete",
        sources: [
          {
            repositoryId: "missing.repository",
            revision: "1",
            state: "missing",
            repositoryRole: null,
            context: null,
          },
        ],
      },
    ],
  };
  assert.throws(
    () => validateViewResponse(invalidFederation),
    /workbench_client_model_invalid/u,
  );

  const validFederatedProject = {
    retainedAsSourceOfTruth: false,
    projects: [
      {
        projectId: model.projectData.context.projectId,
        state: "complete",
        sources: [
          {
            repositoryId: model.projectData.context.repositoryId,
            revision: "1",
            state: "complete",
            repositoryRole: model.projectData.context.repositoryRole,
            context: model.projectData.context,
          },
        ],
      },
    ],
  };
  const mismatchedProjectContext = structuredClone(validFederatedProject);
  const projectContextSource = mismatchedProjectContext.projects
    .at(0)
    ?.sources.at(0);
  assert.ok(projectContextSource);
  projectContextSource.context = {
    ...model.projectData.context,
    projectId: "PRJ-OTHER",
  };
  const mismatchedRepositoryContext = structuredClone(validFederatedProject);
  const repositoryContextSource = mismatchedRepositoryContext.projects
    .at(0)
    ?.sources.at(0);
  assert.ok(repositoryContextSource);
  repositoryContextSource.context = {
    ...model.projectData.context,
    repositoryId: "other.repository",
  };
  const mismatchedRoleContext = structuredClone(validFederatedProject);
  const roleContextSource = mismatchedRoleContext.projects.at(0)?.sources.at(0);
  assert.ok(roleContextSource);
  roleContextSource.repositoryRole = "management";
  const unorderedSources = {
    retainedAsSourceOfTruth: false,
    projects: [
      {
        projectId: model.projectData.context.projectId,
        state: "partial",
        sources: [
          {
            repositoryId: "z.repository",
            revision: null,
            state: "missing",
            repositoryRole: null,
            context: null,
          },
          {
            repositoryId: "a.repository",
            revision: null,
            state: "missing",
            repositoryRole: null,
            context: null,
          },
        ],
      },
    ],
  };
  const duplicateSources = structuredClone(unorderedSources);
  const duplicateSource = duplicateSources.projects.at(0)?.sources.at(1);
  assert.ok(duplicateSource);
  duplicateSource.repositoryId = "z.repository";
  const contextOnMissingSource = {
    retainedAsSourceOfTruth: false,
    projects: [
      {
        projectId: model.projectData.context.projectId,
        state: "partial",
        sources: [
          {
            repositoryId: model.projectData.context.repositoryId,
            revision: "1",
            state: "missing",
            repositoryRole: model.projectData.context.repositoryRole,
            context: model.projectData.context,
          },
        ],
      },
    ],
  };
  for (const invalidPortfolio of [
    mismatchedProjectContext,
    mismatchedRepositoryContext,
    mismatchedRoleContext,
    unorderedSources,
    duplicateSources,
    contextOnMissingSource,
  ]) {
    const invalidPortfolioModel = structuredClone(model) as unknown as {
      portfolio: unknown;
    };
    invalidPortfolioModel.portfolio = invalidPortfolio;
    assert.throws(
      () => validateViewResponse(invalidPortfolioModel),
      /workbench_client_model_invalid/u,
    );
  }
  for (const sourceState of [
    "missing",
    "unavailable",
    "conflicting",
  ] as const) {
    const partialModel = {
      ...structuredClone(model),
      portfolio: structuredClone(validFederatedProject),
    };
    const project = partialModel.portfolio.projects[0];
    assert.ok(project);
    const source = project.sources[0];
    assert.ok(source);
    Object.assign(source, {
      state: sourceState,
      revision: null,
      context: null,
      repositoryRole: null,
    });
    Object.assign(project, {
      state: sourceState === "conflicting" ? "conflicting" : "partial",
    });
    assert.doesNotThrow(() => validateViewResponse(partialModel));
    for (const field of [
      "revision",
      "context",
      "repositoryRole",
      "state",
    ] as const) {
      const invalid = structuredClone(partialModel);
      const invalidSource = invalid.portfolio?.projects[0]?.sources[0];
      assert.ok(invalidSource);
      Object.assign(invalidSource, {
        [field]: field === "context" ? model.projectData.context : "invalid",
      });
      assert.throws(
        () => validateViewResponse(invalid),
        /workbench_client_model_invalid/u,
      );
    }
    Object.assign(project, { state: "complete" });
    assert.throws(
      () => validateViewResponse(partialModel),
      /workbench_client_model_invalid/u,
    );
  }
  const nullComplete = {
    ...structuredClone(model),
    portfolio: structuredClone(validFederatedProject),
  };
  const completeSource = nullComplete.portfolio.projects[0]?.sources[0];
  assert.ok(completeSource);
  Object.assign(completeSource, {
    revision: null,
    context: null,
    repositoryRole: null,
  });
  assert.throws(
    () => validateViewResponse(nullComplete),
    /workbench_client_model_invalid/u,
  );

  const invalidQualityState = structuredClone(model) as unknown as {
    projectData: {
      quality: {
        state: string;
        projection: unknown;
        reason: unknown;
      };
    };
  };
  invalidQualityState.projectData.quality.state = "unknown";
  invalidQualityState.projectData.quality.reason = "observation_failed";
  assert.throws(
    () => validateViewResponse(invalidQualityState),
    /workbench_client_model_invalid/u,
  );

  const invalidOwnerState = structuredClone(model) as unknown as {
    projectData: {
      ownerArtifacts: { state: string; reason: unknown };
    };
  };
  invalidOwnerState.projectData.ownerArtifacts.state = "unknown";
  invalidOwnerState.projectData.ownerArtifacts.reason =
    "owner_artifact_observation_failed";
  assert.throws(
    () => validateViewResponse(invalidOwnerState),
    /workbench_client_model_invalid/u,
  );

  const invalidRepositoryState = structuredClone(model) as unknown as {
    projectData: {
      repository: { state: string; reason: unknown };
    };
  };
  invalidRepositoryState.projectData.repository.state = "unknown";
  invalidRepositoryState.projectData.repository.reason = "observation_failed";
  assert.throws(
    () => validateViewResponse(invalidRepositoryState),
    /workbench_client_model_invalid/u,
  );

  const invalidCollectionState = structuredClone(model) as unknown as {
    projectData: {
      topics: { state: string; items: unknown[]; reason: unknown };
    };
  };
  invalidCollectionState.projectData.topics = {
    state: "unknown",
    items: [
      {
        topicId: "TOPIC-000001",
        projectId: "PRJ-001",
        state: "open",
        revision: 1,
        owner: "Qual-Lab",
        title: "観測不能",
        summary: "未知状態にPayloadを混在させる。",
      },
    ],
    reason: null,
  };
  assert.throws(
    () => validateViewResponse(invalidCollectionState),
    /workbench_client_model_invalid/u,
  );

  const invalidWorktree = structuredClone(model) as unknown as {
    worktree: { diff: unknown };
  };
  invalidWorktree.worktree.diff = {
    path: { unsafe: true },
    status: "modified",
    staged: false,
    binary: false,
    oldPath: null,
    patch: "diff",
    reason: null,
  };
  assert.throws(
    () => validateViewResponse(invalidWorktree),
    /workbench_client_model_invalid/u,
  );

  const invalidActivity = structuredClone(model) as unknown as {
    executionActivity: Record<string, unknown> | null;
  };
  invalidActivity.executionActivity = {
    state: "available",
    reason: "observed",
    eventState: "observed",
    eventReason: "observed",
    eventContinuation: null,
    projection: null,
    events: [
      {
        eventId: "EVT-1",
        occurredAt: "2026-09-28T00:00:00Z",
        objectiveId: "OBJ-1",
        taskId: "TASK-1",
        attemptId: "ATTEMPT-1",
        status: "completed",
        reason: { unsafe: true },
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
      },
    ],
  };
  assert.throws(
    () => validateViewResponse(invalidActivity),
    /workbench_client_model_invalid/u,
  );

  const activityProjection = {
    projectId: "PRJ-001",
    milestoneId: "MILESTONE-1",
    generation: 1,
    milestoneState: "active",
    objectiveCounts: {},
    taskCounts: {},
    objectiveTaskSummaries: [],
    workProgress: "進行中",
    qualityState: "観測済み",
    humanDecisionRequired: false,
    recoveryRequired: false,
    nextAction: "継続",
  };
  const observedWithoutProjection = structuredClone(model) as unknown as {
    executionActivity: Record<string, unknown> | null;
  };
  observedWithoutProjection.executionActivity = {
    state: "observed",
    reason: "observed",
    projection: null,
    eventState: "observed",
    eventReason: "execution_events_observed",
    events: [],
    eventContinuation: null,
  };
  const graphModel = {
    ...model,
    executionActivity: {
      ...observedWithoutProjection.executionActivity,
      state: "unknown",
      graphs: [
        {
          repositoryId: "repo-a",
          queueId: "queue-a",
          milestoneId: "MILESTONE-1",
          workspaceId: "workspace-a",
          progress: {
            milestoneState: "executing",
            workProgress: "in_progress",
            nextAction: "wait_for_task",
          },
        },
        {
          repositoryId: "repo-a",
          queueId: "queue-b",
          milestoneId: "MILESTONE-1",
          workspaceId: "workspace-b",
          progress: null,
        },
      ],
    },
  };
  assert.doesNotThrow(() => validateViewResponse(graphModel));
  assert.throws(
    () =>
      validateViewResponse({
        ...graphModel,
        executionActivity: {
          ...graphModel.executionActivity,
          graphs: [
            ...graphModel.executionActivity.graphs,
            graphModel.executionActivity.graphs[0],
          ],
        },
      }),
    /workbench_client_model_invalid/u,
  );
  const absentWithProjection = structuredClone(model) as unknown as {
    executionActivity: Record<string, unknown> | null;
  };
  absentWithProjection.executionActivity = {
    state: "absent",
    reason: "not_found",
    projection: activityProjection,
    eventState: "observed",
    eventReason: "execution_events_observed",
    events: [],
    eventContinuation: null,
  };
  const unknownEventsWithPayload = structuredClone(model) as unknown as {
    executionActivity: Record<string, unknown> | null;
  };
  unknownEventsWithPayload.executionActivity = {
    state: "unknown",
    reason: "observation_failed",
    projection: null,
    eventState: "unknown",
    eventReason: "observation_failed",
    events: [
      {
        eventId: "EVT-1",
        occurredAt: "2026-09-28T00:00:00Z",
        objectiveId: "OBJ-1",
        taskId: "TASK-1",
        attemptId: "ATTEMPT-1",
        status: "completed",
        reason: "completed",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
      },
    ],
    eventContinuation: "cursor",
  };
  for (const invalidActivityCorrelation of [
    observedWithoutProjection,
    absentWithProjection,
    unknownEventsWithPayload,
  ])
    assert.throws(
      () => validateViewResponse(invalidActivityCorrelation),
      /workbench_client_model_invalid/u,
    );
});
