/**
 * Graph一件のCoordinator Processを起動し、認可・取消・結果だけを搬送する。
 * @packageDocumentation
 * @trace ARCH-000012
 * @boundary 親だけが認可を持つ。子を状態の正本にせず、異常終了を清掃完了にしない。
 */
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CoordinatorObjectiveRequest } from "@qual-lab/crdd-coordinator";
import { loginProviderProfiles } from "./login-providers.ts";
import { isGitHostCredentialEnvironment } from "./git-host.ts";

type ObjectiveTarget = Readonly<{ projectId: string; workspaceId?: string }>;
type Grant = Readonly<{
  directory: string;
  principalId: string;
  confirmBeforeTask?: true;
}>;
type Authorize = (target: ObjectiveTarget) => Grant | null;
const startTimeoutMs = 15_000;
const cancellationGraceMs = 30_000;
const closeGraceMs = 2_000;
const loginEnvironmentNames = new Set([
  "CRDD_LOGIN_PROVIDERS",
  "CRDD_SHARED_REPOSITORY_ROOTS",
  ...Object.values(loginProviderProfiles).flatMap(
    ({ environmentNames }) => environmentNames,
  ),
]);

function isMessage(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 元要求に一対一で子を割り当て、応答と正常終了の両方を確認する。 @trace ARCH-000012 */
export function runObjectiveInChild(
  request: CoordinatorObjectiveRequest,
  signal: AbortSignal,
  authorize: Authorize,
  confirm: (purpose?: "task") => boolean | Promise<boolean>,
): Promise<unknown> {
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    // Provider・OSの実行環境は維持するが、親のNode独自loaderを子へ持ち込まない。
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !loginEnvironmentNames.has(key.toUpperCase()) &&
          !isGitHostCredentialEnvironment(key) &&
          !/^(?:NODE_OPTIONS|NODE_PATH|CRDD_GIT_HOSTS|CRDD_MCP_OAUTH_.*)$/iu.test(
            key,
          ),
      ),
    );
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
      env,
    });
    let phase: "initial" | "authorized" | "confirmed" | "result" = "initial";
    let grantSent = false;
    let taskConfirmation = false;
    let allowed = false;
    let everAllowed = false;
    let confirmationPending = false;
    let result: unknown;
    let failed = false;
    let settled = false;
    let forcedClose: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(startup);
      clearTimeout(cancellation);
      clearTimeout(closeAfterResult);
      clearTimeout(forcedClose);
      signal.removeEventListener("abort", cancel);
      resolve(value);
    };
    const terminate = () => {
      if (failed || settled) return;
      failed = true;
      try {
        child.kill();
      } catch {
        /* 終了を確認できない。 */
      }
      forcedClose = setTimeout(() => {
        // closeの未観測を成功にせず、残る処置は既存の耐久回復へ委ねる。
        if (child.connected) {
          try {
            child.disconnect();
          } catch {
            /* IPCも未確認。 */
          }
        }
        child.unref();
        finish(undefined);
      }, closeGraceMs);
    };
    const startup = setTimeout(terminate, startTimeoutMs);
    let cancellation: ReturnType<typeof setTimeout> | undefined;
    let closeAfterResult: ReturnType<typeof setTimeout> | undefined;
    const send = (message: object) => {
      if (!child.connected) return terminate();
      try {
        child.send(message, (error: Error | null) => {
          if (error) terminate();
        });
      } catch {
        terminate();
      }
    };
    const cancel = () => {
      if (cancellation !== undefined || phase === "result" || settled) return;
      clearTimeout(startup);
      cancellation = setTimeout(terminate, cancellationGraceMs);
      send({ kind: "cancel" });
    };
    child.on("error", terminate);
    child.once("disconnect", () => {
      if (phase !== "result") terminate();
    });
    child.on("message", (message: unknown) => {
      if (failed || !isMessage(message)) return terminate();
      if (phase === "initial" && message.kind === "authorize") {
        if (
          !isMessage(request) ||
          typeof message.projectId !== "string" ||
          message.projectId !== request.projectId ||
          message.workspaceId !== request.workspaceId ||
          (message.workspaceId !== undefined &&
            typeof message.workspaceId !== "string")
        )
          return terminate();
        phase = "authorized";
        let grant: Grant | null = null;
        try {
          // 取消後も受付側に拒否理由を確定させる。子へは権限を渡さない。
          grant = authorize({
            projectId: message.projectId,
            ...(message.workspaceId === undefined
              ? {}
              : { workspaceId: message.workspaceId }),
          });
        } catch {
          // 不明な認可を許可にしない。
        }
        if (signal.aborted) grant = null;
        grantSent = grant !== null;
        taskConfirmation = grant?.confirmBeforeTask === true;
        send({ kind: "grant", grant });
        return;
      }
      if (
        message.kind === "confirm" &&
        grantSent &&
        !confirmationPending &&
        (phase === "authorized" || (phase === "confirmed" && allowed))
      ) {
        if (
          message.purpose !== undefined &&
          (message.purpose !== "task" ||
            !taskConfirmation ||
            phase !== "confirmed")
        )
          return terminate();
        clearTimeout(startup);
        phase = "confirmed";
        allowed = false;
        confirmationPending = true;
        const complete = (permitted: boolean) => {
          confirmationPending = false;
          if (failed || settled || phase !== "confirmed" || signal.aborted)
            return;
          allowed = permitted;
          everAllowed ||= allowed;
          send({ kind: "confirmed", allowed });
        };
        try {
          const decision = confirm(
            message.purpose === "task" ? "task" : undefined,
          );
          if (typeof decision === "boolean") complete(decision);
          else void decision.then(complete, () => complete(false));
        } catch {
          complete(false);
        }
        return;
      }
      if (
        phase !== "result" &&
        message.kind === "result" &&
        Object.hasOwn(message, "value")
      ) {
        // 再確認で停止した場合も、以前の許可で起きた処置と回復参照は保持する。
        if (!everAllowed) {
          const denial =
            phase === "initial"
              ? "coordinator_objective_request_invalid"
              : "coordinator_authenticated_principal_not_verified";
          if (
            !isMessage(message.value) ||
            message.value.reason !== denial ||
            message.value.status !== "blocked" ||
            message.value.effectState !== "no_effect"
          )
            return terminate();
        }
        clearTimeout(startup);
        phase = "result";
        result = message.value;
        closeAfterResult = setTimeout(terminate, startTimeoutMs);
        return;
      }
      terminate();
    });
    child.once("close", (code) => {
      finish(!failed && code === 0 && phase === "result" ? result : undefined);
    });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    else send({ kind: "execute", request });
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const { serveObjectiveChild } = await import(
    "@qual-lab/crdd-coordinator/objective-child"
  );
  serveObjectiveChild(
    async () =>
      (await import("./workspace.ts")).observeWorkspaceExecutionTarget,
  );
}
