/**
 * 共有接続のWorkbench表示GET／HEAD受付。
 * @packageDocumentation
 * @responsibility 現在認可した集合から表示を構築し、公開前再照合と処理済み／未処理を区別する。
 * @trace ARCH-000012
 * @boundary HTTP表示受付と既存のDomain・Access Management・AI観測Owner。
 * @effect Portfolio・資格・選択Repository・活動・AI／Profileを元の順で観測する。
 * @security 既存の認可・取消・情報境界を維持し、新しい保存状態や自動再送を追加しない。
 */
import type { ServerResponse } from "node:http";
import { readRepositoryNetworkPolicies } from "../../../../coordinator/src/index.ts";
import type { AiProfileCatalogAdministration } from "../../../../ai-adapter/src/index.ts";
import type { WorkbenchAiRequests } from "../ai-request/types.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import {
  readWorkbenchChangeArtifact,
  readWorkbenchOwnerArtifact,
} from "../owner-artifact/read.ts";
import type {
  WorkbenchClientModel,
  WorkbenchMainViewModel,
} from "../../shared/view/types.ts";
import {
  readWorkbenchStaticAsset,
  renderClientDocument,
  LOGO_PATH,
} from "../assets.ts";
import {
  createWorkbenchMainViewModel,
  readCredentialAdministrationView,
  type readWorkbenchArtifactSelection,
} from "../presentation/project.ts";
import { readWorkbenchRecordQuery } from "../presentation/record.ts";
import type { WorkbenchTopicMeetingDocumentReader } from "../topic-meeting/action.ts";
import { setResponseHeaders } from "../security.ts";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import {
  type RepositoryAccessCollectionResult,
  resolveRepositoryAccessCollection,
  sameAccessCollection,
} from "../../../../access-management/src/index.ts";
import type { PortfolioProjection } from "../../../../domain-model/src/index.ts";
import { readAuthorizedRuntimeActivity } from "../../../../orchestrator/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  gitRepositoryWorktreeViewAdapter,
  observeRepositoryWorktreeTree,
  observeRepositoryWorktreeFileDiff,
} from "../../../../version-control/src/index.ts";
import { createWorkbenchAiProfileSurface } from "../ai-profile/projection.ts";
import {
  projectRuntimeActivityForWorkbench,
  type WorkbenchRuntimeActivityObservation,
} from "../activity/observe.ts";
import { readAuthorizedPortfolio } from "../project/access-reader.ts";
import { readWorkbenchProjectSurface } from "../project/surface.ts";
import { composeAuthorizedTopicMeeting } from "../topic-meeting/access-resolver.ts";

/**
 * 共有表示を処理し、未処理の場合だけ元の受付へ返す。
 * @responsibility 既存の現在集合・本文・活動・AI観測と公開前認可の順序を維持する。
 * @trace ARCH-000012
 * @input 当該要求の応答・Signal・URL、既存の表示値・Owner・設定と読取り済みAsset。
 * @returns 応答済みまたは取消・切断終了ならtrue、未知Pathで未処理ならfalse。
 * @precondition 共通Origin・Artifact Query・接続形態ごとの前段を元の順序で実行済みである。
 * @postcondition 未知Pathは元の共有Allowlistへ戻し、正常表示や404へ置換しない。
 * @effect 既存Reader・AI Ownerの観測とHTTP応答。単体表示の通知は消費しない。
 * @failure 元の拒否・観測不能・例外を維持し、資格や自由なError本文を公開しない。
 * @invariant 観測不能を正常空へ補完せず、結果不明から再送やrollbackを推定しない。
 * @boundary Workbench HTTPから既存の表示・観測Ownerへの接続。
 * @security 現在認可の読取り時点と公開前照合を維持し、起動Rootへ権限を補完しない。
 * @concurrency 同じ要求Signalと終了Promiseを維持し、await後は現在の設定・状態を同じ参照から読む。
 */
export async function handleSharedView({
  response,
  requestSignal,
  method,
  requestUrl,
  requestPath,
  artifactSelection,
  credentialAdministration,
  localConnectionNotice,
  actionToken,
  configuration,
  sharedAiSession,
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
  localConnectionNotice: string | null;
  actionToken: string;
  configuration: Readonly<{
    sharedAiRequestsFactory?: unknown;
    crosProfileAdministration?: AiProfileCatalogAdministration;
  }>;
  sharedAiSession: (
    connection: CredentialAdministration | undefined,
    repositoryId: string,
    create: boolean,
  ) => { owner: WorkbenchAiRequests; currentId: string | null } | null;
  logo: Buffer;
  clientAsset: Buffer;
  contract: string;
  host: string;
  healthPath: string;
}>): Promise<boolean> {
  const staticAsset = readWorkbenchStaticAsset(requestPath, logo, clientAsset);
  let localBody: string | Buffer | undefined;
  let localContentType = "text/html; charset=utf-8";
  if (
    requestPath === "/" ||
    requestPath === "/index.html" ||
    requestPath === "/project" ||
    requestPath === "/topic" ||
    requestPath === "/meeting" ||
    requestPath === "/change" ||
    requestPath === "/owner-artifact" ||
    requestPath === "/api/workbench-view"
  ) {
    let currentPortfolio: PortfolioProjection | null = null;
    let currentCollection: RepositoryAccessCollectionResult | null = null;
    if (credentialAdministration !== undefined) {
      try {
        currentCollection = resolveRepositoryAccessCollection(
          credentialAdministration.root,
          credentialAdministration.token,
        );
        if (currentCollection.status !== "completed")
          throw new Error("workbench_selected_content_unavailable");
        currentPortfolio = readAuthorizedPortfolio(
          currentCollection.repositories,
          requestSignal,
        );
      } catch {
        localConnectionNotice = "現在の内容を確認できません。";
      }
    }
    let model: WorkbenchClientModel = Object.freeze({
      contract: "crdd/workbench/client-model/v1",
      view: "access",
      actionToken,
      logoPath: LOGO_PATH,
      authenticated: credentialAdministration !== undefined,
      notice: localConnectionNotice,
      portfolio: currentPortfolio,
      credentials: readCredentialAdministrationView(credentialAdministration),
    });
    const selectedId = requestUrl.searchParams.get("repositoryId");
    if (
      requestPath === "/api/workbench-view" &&
      selectedId !== null &&
      selectedId !== "" &&
      !(artifactSelection !== null && credentialAdministration === undefined)
    ) {
      try {
        if (
          !credentialAdministration ||
          currentPortfolio === null ||
          currentCollection?.status !== "completed" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(selectedId)
        )
          throw new Error("workbench_selected_content_unavailable");
        const selected =
          currentCollection.repositories.find(
            (entry) => entry.repositoryId === selectedId,
          ) ?? null;
        const records = composeAuthorizedTopicMeeting(
          currentCollection.repositories,
          selectedId,
          requestSignal,
        );
        const root =
          selected === null
            ? null
            : resolveVerifiedRepositoryRoot(selected.root);
        if (!selected || !records || root === null)
          throw new Error("workbench_selected_content_unavailable");
        const surface = await readWorkbenchProjectSurface(root);
        if (requestSignal.aborted || response.destroyed) return true;
        if (
          surface.context.repositoryId !== selected.repositoryId ||
          surface.context.projectId !== selected.manifest.projectId
        )
          throw new Error("workbench_selected_content_unavailable");
        const topicQuery = readWorkbenchRecordQuery(
          requestUrl.searchParams,
          "topic",
        );
        const meetingQuery = readWorkbenchRecordQuery(
          requestUrl.searchParams,
          "meeting",
        );
        const topicPage = records.topic.list({
          limit: 20,
          query: topicQuery,
          ...(requestUrl.searchParams.has("topicCursor")
            ? {
                cursor: requestUrl.searchParams.get("topicCursor") ?? "",
              }
            : {}),
        });
        const meetingPage = records.meeting.list({
          limit: 20,
          query: meetingQuery,
          ...(requestUrl.searchParams.has("meetingCursor")
            ? {
                cursor: requestUrl.searchParams.get("meetingCursor") ?? "",
              }
            : {}),
        });
        const reader: WorkbenchTopicMeetingDocumentReader = {
          getDocument: (kind, id) => records[kind].getDocument(id),
          relations: (kind, id) => records[kind].relations(id),
        };
        let worktree: WorkbenchMainViewModel["worktree"] = {
          state: "unknown",
          tree: null,
          diff: null,
        };
        const changeSet = surface.repository.changeSet;
        if (surface.repository.state === "available" && changeSet !== null) {
          try {
            const tree = observeRepositoryWorktreeTree(
              selected.root,
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
                    selected.root,
                    changeSet,
                    diffPath,
                    gitRepositoryWorktreeViewAdapter,
                  );
            worktree = { state: "available", tree, diff };
          } catch {
            worktree = { state: "unknown", tree: null, diff: null };
          }
        }
        let activity: WorkbenchRuntimeActivityObservation;
        await yieldToTransport(0);
        if (requestSignal.aborted || response.destroyed) return true;
        try {
          const cursor = requestUrl.searchParams.get("runtimeCursor");
          const observation = await readAuthorizedRuntimeActivity(
            {
              projectId: selected.manifest.projectId,
              repositories: currentCollection.repositories
                .filter(
                  (entry) =>
                    entry.manifest.projectId === selected.manifest.projectId,
                )
                .map((entry) => ({
                  projectId: entry.manifest.projectId,
                  repositoryId: entry.repositoryId,
                  root: entry.root,
                })),
              limit: 20,
              ...(cursor === null ? {} : { cursor }),
            },
            requestSignal,
          );
          if (observation.projectId !== selected.manifest.projectId)
            throw new Error("workbench_activity_unavailable");
          activity = projectRuntimeActivityForWorkbench(observation);
        } catch {
          activity = {
            state: "unknown",
            reason: "observation_failed",
            projection: null,
            eventState: "unknown",
            eventReason: "observation_failed",
            events: [],
            eventContinuation: null,
          };
        }
        await yieldToTransport(0);
        if (requestSignal.aborted || response.destroyed) return true;
        const selectedAi = sharedAiSession(
          credentialAdministration,
          selectedId,
          false,
        );
        const selectedAiSnapshot = selectedAi?.currentId
          ? await selectedAi.owner.observe(selectedAi.currentId)
          : null;
        const sharedProfileRead =
          configuration.sharedAiRequestsFactory &&
          configuration.crosProfileAdministration
            ? configuration.crosProfileAdministration.snapshot()
            : undefined;
        if (sharedProfileRead?.status === "blocked")
          throw new Error(sharedProfileRead.error);
        const sharedProfiles =
          sharedProfileRead?.status === "read"
            ? createWorkbenchAiProfileSurface(sharedProfileRead.value.catalog)
            : null;
        model = createWorkbenchMainViewModel(
          surface,
          currentPortfolio,
          actionToken,
          null,
          credentialAdministration,
          "cros_available",
          surface.topics,
          surface.meetings,
          reader,
          topicPage,
          topicQuery,
          meetingPage,
          meetingQuery,
          null,
          null,
          undefined,
          "CROS",
          null,
          undefined,
          null,
          null,
          activity,
          requestUrl.searchParams.get("documentQuery") ?? "",
          {
            query: requestUrl.searchParams.get("portfolioQuery") ?? "",
            state: requestUrl.searchParams.get("portfolioState") ?? "",
            cursor: requestUrl.searchParams.get("portfolioCursor") ?? "",
          },
          worktree,
          selectedId,
          true,
          true,
        );
        if (requestSignal.aborted || response.destroyed) return true;
        if (
          !currentCollection ||
          !credentialAdministration ||
          !sameAccessCollection(
            currentCollection,
            resolveRepositoryAccessCollection(
              credentialAdministration.root,
              credentialAdministration.token,
            ),
          )
        )
          throw new Error("workbench_selected_content_unavailable");
        const network = selected.workspaceIds.includes("development")
          ? readRepositoryNetworkPolicies(selected.root)
          : null;
        model = {
          ...model,
          aiProfiles: sharedProfiles,
          aiRequest: {
            networkPolicies:
              network?.status === "ready" ? network.policies : null,
            configured:
              configuration.sharedAiRequestsFactory !== undefined &&
              selected.workspaceIds.includes("development"),
            snapshot: selectedAiSnapshot,
            notice: null,
          },
        };
        const route = requestUrl.searchParams.get("route") ?? "/";
        if (route === "/project") {
          const project = currentPortfolio.projects.find(
            (entry) => entry.projectId === requestUrl.searchParams.get("id"),
          );
          if (!project)
            throw new Error("workbench_selected_content_unavailable");
          model = {
            contract: "crdd/workbench/client-model/v1",
            view: "project-detail",
            logoPath: LOGO_PATH,
            project,
          };
        } else if (route === "/topic" || route === "/meeting") {
          const kind = route === "/topic" ? "topic" : "meeting";
          const id = requestUrl.searchParams.get("id") ?? "";
          const document = reader.getDocument(kind, id);
          if (!document)
            throw new Error("workbench_selected_content_unavailable");
          model = {
            contract: "crdd/workbench/client-model/v1",
            view: "record-detail",
            logoPath: LOGO_PATH,
            actionToken,
            repositoryId: selectedId,
            recordActionsConfigured: true,
            record: {
              kind,
              id,
              document,
              relations: reader.relations(kind, id),
            },
          };
        } else if (artifactSelection !== null) {
          const markdown =
            artifactSelection.kind === "change"
              ? await readWorkbenchChangeArtifact(
                  root,
                  artifactSelection.identity,
                )
              : await readWorkbenchOwnerArtifact(
                  root,
                  surface.ownerArtifacts,
                  artifactSelection.identity,
                );
          if (markdown === null)
            throw new Error("workbench_selected_content_unavailable");
          model = {
            contract: "crdd/workbench/client-model/v1",
            view: "artifact",
            logoPath: LOGO_PATH,
            repositoryId: selected.manifest.repositoryId,
            selectedRepositoryId: selectedId,
            artifact: { ...artifactSelection, markdown },
          };
        } else if (route !== "/" && route !== "/index.html") {
          throw new Error("workbench_selected_content_unavailable");
        }
      } catch {
        if (requestSignal.aborted || response.destroyed) return true;
        setResponseHeaders(response);
        response.statusCode = 403;
        response.end("local_repository_access_unavailable\n");
        return true;
      }
    }
    localBody =
      requestPath === "/api/workbench-view"
        ? JSON.stringify(model)
        : renderClientDocument();
    if (requestSignal.aborted || response.destroyed) return true;
    if (
      requestPath === "/api/workbench-view" &&
      currentCollection?.status === "completed" &&
      credentialAdministration !== undefined &&
      !sameAccessCollection(
        currentCollection,
        resolveRepositoryAccessCollection(
          credentialAdministration.root,
          credentialAdministration.token,
        ),
      )
    ) {
      if (requestSignal.aborted || response.destroyed) return true;
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end("local_repository_access_unavailable\n");
      return true;
    }
    if (requestPath === "/api/workbench-view")
      localContentType = "application/json; charset=utf-8";
  } else if (staticAsset !== null) {
    localBody = staticAsset.body;
    localContentType = staticAsset.contentType;
  } else if (requestPath === HEALTH_PATH) {
    localBody = JSON.stringify({
      contract: CONTRACT,
      status: "ready",
      host: HOST,
      mode: "local-cros",
      readOnly: false,
    });
    localContentType = "application/json; charset=utf-8";
  }
  if (localBody !== undefined) {
    if (requestSignal.aborted || response.destroyed) return true;
    setResponseHeaders(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", localContentType);
    response.setHeader("Content-Length", Buffer.byteLength(localBody));
    response.end(method === "HEAD" ? undefined : localBody);
    return true;
  }
  return false;
}
