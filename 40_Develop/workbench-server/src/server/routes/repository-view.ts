/**
 * 単体接続のWorkbench表示GET／HEAD受付。
 * @packageDocumentation
 * @responsibility 既存表示・観測・通知消費と固定配信、未知Pathの404を維持する。
 * @trace ARCH-000012
 * @boundary HTTP表示受付と既存のDomain・Access Management・AI観測Owner。
 * @effect 既存AI／活動・Record・資格観測と、元のGET条件での通知消費を行う。
 * @security 既存の認可・取消・情報境界を維持し、新しい保存状態や自動再送を追加しない。
 */
import type { ServerResponse } from "node:http";
import {
  readRepositoryNetworkPolicies,
  readRepositoryAiSelection,
} from "../../../../coordinator/src/index.ts";
import { readWorkbenchAiSelectionSurface } from "../ai-selection/projection.ts";
import type { WorkbenchAiRequests } from "../ai-request/types.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import {
  readWorkbenchChangeArtifact,
  readWorkbenchOwnerArtifact,
} from "../owner-artifact/read.ts";
import type {
  WorkbenchClientModel,
  WorkbenchRecordDocumentView,
} from "../../shared/view/types.ts";
import {
  readWorkbenchStaticAsset,
  renderClientDocument,
  LOGO_PATH,
} from "../assets.ts";
import {
  createWorkbenchMainViewModel,
  type readWorkbenchArtifactSelection,
} from "../presentation/project.ts";
import { readWorkbenchRecordQuery } from "../presentation/record.ts";
import type { WorkbenchTopicMeetingDocumentReader } from "../topic-meeting/action.ts";
import { setResponseHeaders } from "../security.ts";
import type {
  FilesystemStoreRoot,
  PortfolioProjection,
  TopicMeetingAccess,
} from "../../../../domain-model/src/index.ts";
import {
  type VerifiedRepositoryRoot,
  type RepositoryWorktreeTreePage,
  type RepositoryWorktreeFileDiff,
  gitRepositoryWorktreeViewAdapter,
  observeRepositoryWorktreeTree,
  observeRepositoryWorktreeFileDiff,
} from "../../../../version-control/src/index.ts";
import type { WorkbenchActivityReader } from "../activity/observe.ts";
import type {
  WorkbenchPresentationState,
  WorkbenchConnectionState,
} from "../presentation/types.ts";

/**
 * 単体表示・固定配信を元のGET／HEAD契約で処理する。
 * @responsibility Owner観測・表示構築・通知消費・応答の順序と現在状態の参照を維持する。
 * @trace ARCH-000012
 * @input 当該要求の応答・Signal・URL、既存の表示値・Owner・設定と読取り済みAsset。
 * @returns 表示処理と当該Ownerの終了を待つPromise。
 * @precondition 共通Origin・Artifact Query・接続形態ごとの前段を元の順序で実行済みである。
 * @postcondition GETのAPI表示だけ通知を消費し、HEAD・HTML・途中拒否では消費しない。
 * @effect 既存Reader・AI Ownerの観測とHTTP応答。通知消費は従来の単体GET条件だけで行う。
 * @failure 元の拒否・観測不能・例外を維持し、資格や自由なError本文を公開しない。
 * @invariant 観測不能を正常空へ補完せず、結果不明から再送やrollbackを推定しない。
 * @boundary Workbench HTTPから既存の表示・観測Ownerへの接続。
 * @security 現在認可の読取り時点と公開前照合を維持し、起動Rootへ権限を補完しない。
 * @concurrency 同じ要求Signalと終了Promiseを維持し、await後は現在の設定・状態を同じ参照から読む。
 */
export async function handleRepositoryView({
  response,
  requestSignal,
  method,
  requestUrl,
  requestPath,
  artifactSelection,
  credentialAdministration,
  repositoryRoot,
  capability,
  topicMeeting,
  portfolio,
  connectionState,
  presentation,
  aiRequests,
  activityReader,
  actionToken,
  configuration,
  logo,
  clientAsset,
  contract: CONTRACT,
  host: HOST,
  healthPath: HEALTH_PATH,
}: Readonly<{
  response: ServerResponse;
  requestSignal: AbortSignal;
  method: string;
  requestUrl: URL;
  requestPath: string;
  artifactSelection: ReturnType<typeof readWorkbenchArtifactSelection>;
  credentialAdministration: CredentialAdministration | undefined;
  repositoryRoot: string;
  capability: VerifiedRepositoryRoot;
  topicMeeting: TopicMeetingAccess | undefined;
  portfolio: PortfolioProjection | undefined;
  connectionState: WorkbenchConnectionState;
  presentation: WorkbenchPresentationState;
  aiRequests: WorkbenchAiRequests | undefined;
  activityReader: WorkbenchActivityReader | undefined;
  actionToken: string;
  configuration: Readonly<{ localAccessRoot?: FilesystemStoreRoot }>;
  logo: Buffer;
  clientAsset: Buffer;
  contract: string;
  host: string;
  healthPath: string;
}>): Promise<void> {
  const staticAsset = readWorkbenchStaticAsset(requestPath, logo, clientAsset);
  let body: string | Buffer;
  let contentType: string;
  if (presentation.projectSurface === undefined || topicMeeting === undefined)
    throw new Error("workbench_repository_access_unavailable");
  if (
    requestPath === "/" ||
    requestPath === "/index.html" ||
    requestPath === "/api/workbench-view"
  ) {
    if (aiRequests !== undefined && presentation.currentAiRequestId !== null) {
      try {
        presentation.aiRequestSnapshot = await aiRequests.observe(
          presentation.currentAiRequestId,
        );
      } catch {
        presentation.aiRequestSnapshot = Object.freeze({
          requestId: presentation.currentAiRequestId,
          mode: presentation.aiRequestSnapshot?.mode ?? "read_only_advice",
          executionSelection:
            presentation.aiRequestSnapshot?.executionSelection ?? null,
          status: "unknown",
          reason: "observation_failed",
          facts: Object.freeze([]),
          sharedAnalysis: Object.freeze([]),
          additionalInferences: Object.freeze([]),
          nextOptions: Object.freeze([]),
          candidate: null,
        });
      }
    }
    if (activityReader !== undefined) {
      try {
        const runtimeCursor = requestUrl.searchParams.get("runtimeCursor");
        const page = {
          ...(runtimeCursor === null ? {} : { cursor: runtimeCursor }),
          limit: 20,
        };
        presentation.runtimeActivityObservation = await activityReader.observe(
          presentation.projectSurface.context.projectId,
          page,
        );
      } catch {
        presentation.runtimeActivityObservation = Object.freeze({
          state: "unknown",
          reason: "observation_failed",
          projection: null,
          eventState: "unknown",
          eventReason: "observation_failed",
          events: Object.freeze([]),
          eventContinuation: null,
        });
      }
    }
    const topicCursor = requestUrl.searchParams.get("topicCursor");
    const meetingCursor = requestUrl.searchParams.get("meetingCursor");
    const topicQuery = readWorkbenchRecordQuery(
      requestUrl.searchParams,
      "topic",
    );
    const meetingQuery = readWorkbenchRecordQuery(
      requestUrl.searchParams,
      "meeting",
    );
    const selectedRepositoryId = undefined;
    const topicCollection = presentation.projectSurface.topics;
    const meetingCollection = presentation.projectSurface.meetings;
    const topicPage = topicMeeting.topic.list({
      ...(topicCursor === null ? {} : { cursor: topicCursor }),
      limit: 20,
      query: topicQuery,
    });
    const meetingPage = topicMeeting.meeting.list({
      ...(meetingCursor === null ? {} : { cursor: meetingCursor }),
      limit: 20,
      query: meetingQuery,
    });
    const topicMeetingReader: WorkbenchTopicMeetingDocumentReader = {
      getDocument: (kind, id) => topicMeeting[kind].getDocument(id),
      relations: (kind, id) => topicMeeting[kind].relations(id),
    };
    let worktreeView: Readonly<{
      state: "available" | "unknown";
      tree: RepositoryWorktreeTreePage | null;
      diff: RepositoryWorktreeFileDiff | null;
    }> = Object.freeze({ state: "unknown", tree: null, diff: null });
    if (
      presentation.projectSurface.repository.state === "available" &&
      presentation.projectSurface.repository.changeSet !== null
    ) {
      try {
        const changeSet = presentation.projectSurface.repository.changeSet;
        const tree = observeRepositoryWorktreeTree(
          capability,
          changeSet,
          requestUrl.searchParams.get("treeDirectory") ?? "",
          requestUrl.searchParams.get("treeCursor") ?? undefined,
          50,
          gitRepositoryWorktreeViewAdapter,
        );
        const diffPath = requestUrl.searchParams.get("diffPath");
        const diff =
          diffPath === null
            ? null
            : observeRepositoryWorktreeFileDiff(
                capability,
                changeSet,
                diffPath,
                gitRepositoryWorktreeViewAdapter,
              );
        worktreeView = Object.freeze({ state: "available", tree, diff });
      } catch {
        worktreeView = Object.freeze({
          state: "unknown",
          tree: null,
          diff: null,
        });
      }
    }
    presentation.aiSelection = readWorkbenchAiSelectionSurface(capability);
    const baseModel = createWorkbenchMainViewModel(
      presentation.projectSurface,
      portfolio,
      actionToken,
      presentation.lastActionResult,
      credentialAdministration,
      connectionState,
      topicCollection,
      meetingCollection,
      topicMeetingReader,
      topicPage,
      topicQuery,
      meetingPage,
      meetingQuery,
      presentation.topicMeetingResult,
      presentation.aiSelection,
      readRepositoryAiSelection(capability).snapshot ?? undefined,
      true,
      presentation.aiSelectionManagementResult,
      aiRequests,
      presentation.aiRequestSnapshot,
      presentation.aiRequestNotice,
      presentation.runtimeActivityObservation,
      requestUrl.searchParams.get("documentQuery") ?? "",
      Object.freeze({
        query: requestUrl.searchParams.get("portfolioQuery") ?? "",
        state: requestUrl.searchParams.get("portfolioState") ?? "",
        cursor: requestUrl.searchParams.get("portfolioCursor") ?? "",
      }),
      worktreeView,
      selectedRepositoryId,
    );
    const network =
      aiRequests === undefined
        ? null
        : readRepositoryNetworkPolicies(capability);
    const clientModel = {
      ...baseModel,
      aiRequest: {
        ...baseModel.aiRequest,
        networkPolicies: network?.status === "ready" ? network.policies : null,
      },
    };
    let responseModel: WorkbenchClientModel = clientModel;
    const clientRoute = requestUrl.searchParams.get("route") ?? "/";
    if (clientRoute === "/project") {
      const projectId = requestUrl.searchParams.get("id") ?? "";
      const project = portfolio?.projects.find(
        (candidate) => candidate.projectId === projectId,
      );
      if (project === undefined) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end(method === "HEAD" ? undefined : "not_found\n");
        return;
      }
      responseModel = Object.freeze({
        contract: "crdd/workbench/client-model/v1",
        view: "project-detail",
        logoPath: LOGO_PATH,
        project,
      });
    } else if (artifactSelection !== null) {
      if (
        requestUrl.searchParams.has("repositoryId") &&
        requestUrl.searchParams.get("repositoryId") !==
          presentation.projectSurface.context.repositoryId
      ) {
        setResponseHeaders(response);
        response.statusCode = 403;
        response.end("artifact_access_unavailable\n");
        return;
      }
      const markdown =
        artifactSelection.kind === "change"
          ? await readWorkbenchChangeArtifact(
              repositoryRoot,
              artifactSelection.identity,
            )
          : await readWorkbenchOwnerArtifact(
              repositoryRoot,
              presentation.projectSurface.ownerArtifacts,
              artifactSelection.identity,
            );
      if (markdown === null) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end("artifact_unavailable\n");
        return;
      }
      if (requestSignal.aborted || response.destroyed) return;
      responseModel = {
        contract: "crdd/workbench/client-model/v1",
        view: "artifact",
        logoPath: LOGO_PATH,
        repositoryId: presentation.projectSurface.context.repositoryId,
        selectedRepositoryId: null,
        artifact: { ...artifactSelection, markdown },
      };
    } else if (clientRoute === "/topic" || clientRoute === "/meeting") {
      const kind = clientRoute === "/topic" ? "topic" : "meeting";
      const id = requestUrl.searchParams.get("id") ?? "";
      const expectedPattern =
        kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u;
      const repositoryId = requestUrl.searchParams.get("repositoryId");
      let recordView: WorkbenchRecordDocumentView | null = null;
      if (
        expectedPattern.test(id) &&
        (repositoryId === null ||
          repositoryId === presentation.projectSurface.context.repositoryId)
      ) {
        const document = topicMeeting[kind].getDocument(id);
        if (document !== null)
          recordView = Object.freeze({
            kind,
            id,
            document,
            relations: Object.freeze([...topicMeeting[kind].relations(id)]),
          });
      }
      if (recordView === null) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end(method === "HEAD" ? undefined : "not_found\n");
        return;
      }
      responseModel = Object.freeze({
        contract: "crdd/workbench/client-model/v1",
        view: "record-detail",
        logoPath: LOGO_PATH,
        actionToken,
        repositoryId,
        recordActionsConfigured: repositoryId === null,
        record: recordView,
      });
    }
    body =
      requestPath === "/api/workbench-view"
        ? JSON.stringify(responseModel)
        : renderClientDocument();
    if (method === "GET" && requestPath === "/api/workbench-view") {
      presentation.topicMeetingResult = null;
      presentation.aiSelectionManagementResult = null;
      presentation.aiRequestNotice = null;
    }
    contentType =
      requestPath === "/api/workbench-view"
        ? "application/json; charset=utf-8"
        : "text/html; charset=utf-8";
  } else if (
    requestPath === "/project" ||
    requestPath === "/topic" ||
    requestPath === "/meeting"
  ) {
    body = renderClientDocument();
    contentType = "text/html; charset=utf-8";
  } else if (requestPath === "/change") {
    body = renderClientDocument();
    contentType = "text/html; charset=utf-8";
  } else if (requestPath === "/owner-artifact") {
    body = renderClientDocument();
    contentType = "text/html; charset=utf-8";
  } else if (staticAsset !== null) {
    body = staticAsset.body;
    contentType = staticAsset.contentType;
  } else if (requestPath === HEALTH_PATH) {
    body = JSON.stringify({
      contract: CONTRACT,
      status: "ready",
      host: HOST,
      mode: configuration.localAccessRoot === undefined ? "repository" : "cros",
      ...(connectionState === "repository" ? {} : { connectionState }),
      readOnly: false,
    });
    contentType = "application/json; charset=utf-8";
  } else {
    setResponseHeaders(response);
    response.statusCode = 404;
    response.end(method === "HEAD" ? undefined : "not_found\n");
    return;
  }
  setResponseHeaders(response);
  response.statusCode = 200;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(method === "HEAD" ? undefined : body);
}
