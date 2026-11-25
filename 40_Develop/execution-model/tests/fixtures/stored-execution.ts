/**
 * 試験所有の保存本文から検証対象を取り出す。
 * @packageDocumentation
 * @trace PRL-IT-013
 * @boundary 製品の保存内部を参照せず、fixtureの物理観測にだけ用いる。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  Decision,
  LeaseKind,
  OperationRecord,
  ProjectExecutionState,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  StateVersion,
  readQueueState,
  readState,
  readWorkspaceState,
} from "../../src/index.ts";

type WorkspaceView = NonNullable<
  ReturnType<typeof readWorkspaceState>["value"]
>;
type QueueView = NonNullable<ReturnType<typeof readQueueState>["value"]>;
type TechnicalView = NonNullable<ReturnType<typeof readState>["value"]>;
type ProjectSection = Omit<
  ProjectExecutionState,
  | "contract"
  | "taskExecutionSelections"
  | "ownerGeneration"
  | "maximumConcurrency"
  | "tasks"
> & { contract: string; tasks: readonly ProjectTaskDefinition[] };

/** 合成保存物を物理的に確認する試験上の期待値。製品の公開型ではない。 @trace PRL-IT-013 */
export type StoredExecutionFixture = Readonly<{
  schema: string;
  revision: number;
  previous: StateVersion | null;
  repositoryBinding: string;
  repositoryBindingId: string | null;
  projects: readonly ProjectSection[];
  managedExecutions: readonly {
    definitionHash: string;
    tasks: readonly (Partial<Omit<ProjectTaskRecord, "definition">> & {
      taskId: string;
      settlement?: unknown;
    })[];
  }[];
  operations: readonly OperationRecord[];
  unresolvedRecoveries: TechnicalView["snapshot"]["unresolvedRecoveries"];
  workspaces: WorkspaceView["workspaces"];
  queueEntries: QueueView["queueEntries"];
  leaseIntents: QueueView["leaseIntents"];
  results: WorkspaceView["results"];
  leaseEvidence: readonly {
    repositoryBindingId: string;
    projectId: string;
    content: Readonly<{
      kind: LeaseKind;
      queueId: string;
      ownerGeneration: string;
      ownerProcessId: number;
      disposition:
        | "acquired"
        | "released"
        | "recovered_after_owner_loss"
        | "acquisition_unknown_closed";
    }>;
  }[];
  historyPending: readonly {
    id: string;
    occurredAt: string;
    outcome: string;
    cleanup: string;
    primaryFailure: string | null;
  }[];
  decisions: readonly Decision[];
  blockers: readonly {
    blockerId: string;
    target: Decision["target"];
    status: string;
  }[];
}>;

/** ケース自身の保存本文だけをJSONとして読む。受入検査や保存は行わない。 @trace PRL-IT-013 */
export function parseStoredExecutionFixture(
  source: string,
): StoredExecutionFixture {
  return JSON.parse(source) as StoredExecutionFixture;
}

/** ケースが生成したファイルを読み、正式Readerの改訂と同じ本文であることを照合する。 @trace PRL-IT-013 */
export function readStoredExecutionFixture(
  fixtureRoot: string,
  expectedPayloadSha256: string,
): StoredExecutionFixture {
  const bytes = readFileSync(
    path.join(fixtureRoot, ".crdd", "execution-model", "state.json"),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    expectedPayloadSha256,
  );
  return parseStoredExecutionFixture(bytes.toString("utf8"));
}
