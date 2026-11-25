/** 実Browserで本番の活動Panelへ異なる取得断面を渡す。 @trace ERB-ST-022 */
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ExecutionActivity } from "../../src/components/activity-panel.tsx";
import type { MainViewResponse } from "../../src/api/response.ts";

const container = document.getElementById("activity-fixture");
if (!container) throw Error("activity_fixture_missing");
const root = createRoot(container);
const graph = (id: string, repositoryId: string) => ({
  queueId: "same-queue-id",
  repositoryId,
  workspaceId: id,
  milestoneId: "same-milestone",
  progress: {
    milestoneState: "executing" as const,
    workProgress: `progress-${id}`,
    nextAction: `next-${id}`,
  },
});
const a = graph("workspace-a", "repository-a");
const b = graph("workspace-b", "repository-b");
const render = (graphs: (typeof a)[]) => {
  const model = {
    executionActivity: {
      state: "unknown",
      reason: "fixture_multiple_graphs",
      projection: null,
      graphs,
      singleTasks: [],
      eventState: "observed",
      events: [],
      nextCursor: null,
    },
  } as unknown as MainViewResponse;
  flushSync(() => root.render(createElement(ExecutionActivity, { model })));
};
const choose = (repositoryId: string) => {
  const input = container.querySelector("select");
  if (!input) throw Error("activity_selection_missing");
  flushSync(() => {
    input.value = JSON.stringify([repositoryId, a.queueId]);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const includes = (text: string) => container.textContent.includes(text);
render([a, b]);
choose(a.repositoryId);
const selected =
  includes(a.progress.nextAction) && !includes(b.progress.nextAction);
render([b, a]);
const restored =
  includes(a.progress.nextAction) && !includes(b.progress.nextAction);
render([]);
const missing =
  includes("選択した実行は現在の一覧にありません。") &&
  !includes(a.progress.nextAction);
render([b]);
const notSubstituted =
  includes("状態を表示する実行を選択してください。") &&
  !includes(b.progress.nextAction);
choose(b.repositoryId);
const explicit =
  includes(b.progress.nextAction) && !includes(a.progress.nextAction);
document.body.dataset.activityResult = JSON.stringify({
  selected,
  restored,
  missing,
  notSubstituted,
  explicit,
});
root.unmount();
