/**
 * HTTPサーバーの起動・終了契約。
 * @responsibility 共有する構成・起動ハンドルと公開入力の形を所有する。
 * @trace ARCH-000012
 */
import type { AiSelectionSnapshot } from "@qual-lab/crdd-configuration-model";
import type {
  TopicMeetingPage,
  TopicMeetingListQuery,
} from "@qual-lab/crdd-document-model";
import type { TreePage, FileDiff } from "@qual-lab/crdd-version-control";
import type { AccessViewResponse } from "../service/access.ts";
import type {
  ProjectDetailResponse,
  ArtifactViewResponse,
} from "../service/project-context.ts";
import type {
  RecordDocumentView,
  RecordDetailResponse,
} from "../service/topic.ts";
import type { AiSelectionSaveResult } from "@qual-lab/crdd-configuration-model";
import type { AiSelectionView } from "../service/configuration.ts";
import type {
  AiRequestSnapshot,
  WorkbenchExecutionActivityObservation,
} from "../service/execution.ts";
import type { ProjectViewData } from "../service/project-context.ts";
import type { FilesystemStoreRoot } from "@qual-lab/crdd-access-management";
import type { PortfolioProjection } from "@qual-lab/crdd-document-model";
import type { Repository } from "@qual-lab/crdd-version-control";
import type { WorkbenchActivityReader } from "../service/execution.ts";
import type { AiRequests } from "../service/execution.ts";
import type { RepositoryActionRequest } from "../service/repository.ts";
import type { createMcpOAuthProvider } from "./mcp-oauth.ts";
import type { LoginProviderConfiguration } from "./login-providers.ts";
import type { GitHostConfiguration } from "../service/git-host.ts";

/** 共有起動の信頼済み構成。署名材料を明示し、一時状態は発行側が所有する。 @trace ARCH-000012 */
export type EmbeddedMcpOAuthOptions = Omit<
  Parameters<typeof createMcpOAuthProvider>[0],
  "issuer" | "resource"
>;

/** Workbenchの公開先とRepository接続・任意の利用側機能の構成。 */
export type WorkbenchStartRequest = Readonly<{
  workingDirectory: string;
  publicOrigin?: string;
  port?: number;
  apiDocumentation?: true;
  portfolio?: PortfolioProjection;
  localAccessRoot?: FilesystemStoreRoot;
  loginProviders?: LoginProviderConfiguration;
  gitHosts?: readonly GitHostConfiguration[];
  sharedRepositoryRoots?: readonly string[];
  aiRequests?: AiRequests;
  sharedAiRequestsFactory?: (
    root: Repository,
    projectId: string,
    principalId: string,
    authorize: () => boolean,
  ) => AiRequests;
  activityReader?: WorkbenchActivityReader;
}>;

/** 共有でHTTPとMCPを同じ待受へ接続する構成。 @trace ARCH-000012 */
export type CrddServerStartRequest = WorkbenchStartRequest &
  Readonly<{
    localAccessRoot: FilesystemStoreRoot;
    mcpPublicOrigin?: string;
    mcpOAuth?: EmbeddedMcpOAuthOptions;
  }>;

/** 起動済みWorkbenchのURLと所有Listenerを閉じる操作。 */
export type WorkbenchHandle = Readonly<{
  contract: "crdd/workbench/v1";
  baseUrl: string;
  publicUrl: string;
  healthUrl: string;
  close: () => Promise<void>;
}>;

/**
 * 主画面と起動が共有する接続形態の表示値。
 * @responsibility 単体と横断表示の既存区別だけを保持する。
 * @trace ARCH-000012
 * @shape repositoryまたはcros_available。
 * @invariant 認証・認可結果または内容公開のAuthorityとして使わない。
 * @boundary 起動Compositionと主画面投影。
 * @security 資格・Rootを含まない。
 * @compatibility 既存の表示値と同一である。
 */
export type WorkbenchConnectionState = "repository" | "cros_available";

/**
 * 一つの起動中だけ共有する表示値と直前結果。
 * @responsibility 既存変数の読取り・更新時点を変えず、操作受付と表示の間で保持する。
 * @trace ARCH-000012
 * @shape 現在投影、Repository別AI選択表示、単体操作結果、単体AI表示ID・Snapshot・Notice、既存の活動観測。
 * @invariant 保存・clone・汎用更新APIを追加せず、共有AI Sessionと混在しない。
 * @boundary Server内の実Consumerだけで共有する型。
 * @security 認証資格や許可済みRootを表示状態のAuthorityとして保持しない。
 * @compatibility 既存のメモリ内変数だけをまとめ、通信・永続Schemaを変更しない。
 */
export type WorkbenchPresentationState = {
  executionActivityObservation:
    | WorkbenchExecutionActivityObservation
    | undefined;
  projectSurface: ProjectViewData | undefined;
  aiSelection: AiSelectionView;
  pendingRecordRefresh?: object;
  currentAiRequestId: string | null;
  aiRequestSnapshot: AiRequestSnapshot | null;
  aiRequestNotice: string | null;
  aiSelectionManagementResult: AiSelectionSaveResult | null;
};

/**
 * Repository単体または同Host共有接続の公開表示値。
 * @responsibility 接続状態と非秘密の結果だけを表示する。
 * @trace ARCH-000012
 * @shape stateだけで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition 同Hostの直接接続をServerが構成している。
 * @postcondition 接続先URLや資格を含まない。
 * @effect N/A: 型宣言である。
 * @failure unavailableをavailableへ畳まない。
 * @invariant 接続Authorityを所有しない。
 * @boundary Workbench ServerとBrowser表示の境界。
 * @security 接続資格を含めない。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type WorkbenchConnectionView = Readonly<{
  state: "repository" | "cros_available";
}>;

/**
 * Workbenchの主画面を一回描画できる閉じたBrowser Read Model。
 * @responsibility Main Viewの全表示値、用途限定Tokenおよび操作結果の型境界を所有する。
 * @trace ARCH-000012
 * @shape contract、view、actionToken、各Surface、Queryおよび一回表示結果で構成する。aiSelectionのnullは今回Ownerからの未取得で、欠測や空Catalogとは区別する。
 * @invariant viewはmainで、正本やApplication関数を所有しない。
 * @boundary Workbench Node ServerとMain Browser ScreenのJSON境界。
 * @security Remote Bearer、verifier、Private Key、Host Pathおよび永続Authorityを含めない。
 * @compatibility contract `crdd/workbench/view/v1`のmain variantである。
 */
export type MainViewResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "main";
  actionToken: string;
  projectData: ProjectViewData;
  portfolio: PortfolioProjection | null;
  portfolioPage: Readonly<{
    nextCursor: string | null;
    cursorInvalid: boolean;
  }>;
  connection: WorkbenchConnectionView;
  topicPage: TopicMeetingPage;
  topicQuery: TopicMeetingListQuery;
  meetingPage: TopicMeetingPage;
  meetingQuery: TopicMeetingListQuery;
  recordDocuments: readonly RecordDocumentView[];
  selectedRepositoryId: string | null;
  recordActionsConfigured: boolean;
  repositoryActions: readonly RepositoryActionRequest["operation"][];
  workspaceAccess?: "read" | "write" | "unavailable";
  worktree: Readonly<{
    state: "available" | "unknown";
    tree: TreePage | null;
    diff: FileDiff | null;
  }>;
  aiSelection: AiSelectionView | null;
  aiSelectionManagement: Readonly<{
    snapshot: AiSelectionSnapshot | null;
    allowed: boolean;
    result: AiSelectionSaveResult | null;
  }>;
  aiRequest: Readonly<{
    configured: boolean;
    additionalHosts: readonly string[] | null;
    snapshot: AiRequestSnapshot | null;
    notice: string | null;
  }>;
  executionActivity: WorkbenchExecutionActivityObservation | null;
}>;

/**
 * Workbench Browserが描画できる全View ModelのUnion。
 * @responsibility view discriminantと対応する表示Modelの閉集合を定義する。
 * @trace ARCH-000012
 * @shape access、main、project-detail、record-detailおよびartifactの判別可能Unionである。
 * @invariant 全variantが同じcontract revisionを使用する。
 * @boundary JSON Runtime InspectorとWorkbenchAppの判別境界。
 * @security 未知viewをUnionへ受理しない。
 * @compatibility contract `crdd/workbench/view/v1`に固定する。
 */
export type ViewResponse =
  | ArtifactViewResponse
  | AccessViewResponse
  | MainViewResponse
  | ProjectDetailResponse
  | RecordDetailResponse;
/** REST文書とMCP Toolの、操作を決めた後の公開入力欄。 @trace ARCH-000012 */
export function workspaceInputSchema(operation: string) {
  const actions: Record<string, string[]> = {
    list: ["cursor", "limit"],
    get: [],
    inspect: ["path"],
    "candidate-diff": ["path"],
    create: [
      "baseBranch",
      "baseCommit",
      "name",
      "acceptUncommittedChangesExcluded",
    ],
    select: [],
    rename: ["name"],
    hold: ["until"],
    discard: ["expectedHead", "discardChanges"],
    freeze: [
      "operationId",
      "baseCommit",
      "expectedHead",
      "selection",
      "candidateName",
      "relatedChangeIds",
    ],
    adopt: ["candidateCommit", "targetBranch", "expectedTargetHead"],
    "close-candidate": ["expectedCommit", "disposition"],
  };
  const keys = [
    "repositoryId",
    "projectId",
    ...(operation === "list" ? [] : ["queueId", "workspaceId"]),
    ...(!["list", "get", "inspect", "candidate-diff"].includes(operation)
      ? ["expectedGeneration"]
      : []),
    ...(actions[operation] ?? []),
  ];
  const properties = Object.fromEntries(
    keys.map((key) => [
      key,
      key === "repositoryId"
        ? { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" }
        : key === "expectedGeneration"
          ? { type: "integer", minimum: 0 }
          : key === "limit"
            ? { type: "integer", minimum: 1, maximum: 50 }
            : key === "acceptUncommittedChangesExcluded"
              ? {
                  type: "boolean",
                  description:
                    "未コミット変更は引き継がれないことを利用者が了承した場合だけtrue。変更があり未了承ならworkspace_creation_confirmation_requiredで作成前に停止します。",
                }
              : key === "discardChanges"
                ? { type: "boolean" }
                : key === "relatedChangeIds"
                  ? {
                      type: "array",
                      items: { type: "string", pattern: "^CHG-[0-9]{6}$" },
                    }
                  : key === "selection"
                    ? {
                        type: "array",
                        minItems: 1,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["path", "blobId", "mode"],
                          properties: {
                            path: { type: "string" },
                            blobId: {
                              anyOf: [{ type: "string" }, { type: "null" }],
                            },
                            mode: { enum: ["100644", "100755", null] },
                          },
                        },
                      }
                    : [
                          "cursor",
                          "name",
                          "until",
                          "candidateName",
                          "expectedCommit",
                        ].includes(key)
                      ? { anyOf: [{ type: "string" }, { type: "null" }] }
                      : { type: "string" },
    ]),
  );
  return {
    type: "object",
    additionalProperties: false,
    required: keys.filter((key) => key !== "acceptUncommittedChangesExcluded"),
    properties,
  };
}
