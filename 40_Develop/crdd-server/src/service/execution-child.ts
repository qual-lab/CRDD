/**
 * Graph一件のCoordinator Processを起動し、認可・取消・結果だけを搬送する。
 * @packageDocumentation
 * @trace ARCH-000012
 * @boundary 親だけが認可を持つ。子を状態の正本にせず、異常終了を清掃完了にしない。
 */
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

type ObjectiveTarget = Readonly<{ projectId: string; workspaceId?: string }>;
type Grant = Readonly<{ directory: string; principalId: string }>;
type Authorize = (target: ObjectiveTarget) => Grant | null;
const startTimeoutMs = 15_000;
const cancellationGraceMs = 30_000;
const closeGraceMs = 2_000;

function isMessage(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 元要求に一対一で子を割り当て、応答と正常終了の両方を確認する。 @trace ARCH-000012 */
export function runObjectiveInChild(
  request: unknown,
  signal: AbortSignal,
  authorize: Authorize,
  confirm: () => boolean,
): Promise<unknown> {
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    // Provider・OSの実行環境は維持するが、親のNode独自loaderを子へ持ち込まない。
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !["NODE_OPTIONS", "NODE_PATH"].includes(key.toUpperCase()),
      ),
    );
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
      env,
    });
    let phase: "initial" | "authorized" | "confirmed" | "result" = "initial";
    let grantSent = false;
    let confirmed = false;
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
        send({ kind: "grant", grant });
        return;
      }
      if (
        message.kind === "confirm" &&
        grantSent &&
        (phase === "authorized" || (phase === "confirmed" && confirmed))
      ) {
        clearTimeout(startup);
        phase = "confirmed";
        try {
          confirmed = confirm() && !signal.aborted;
        } catch {
          /* 不明は拒否。 */
        }
        send({ kind: "confirmed", allowed: confirmed });
        return;
      }
      if (
        phase !== "result" &&
        message.kind === "result" &&
        Object.hasOwn(message, "value")
      ) {
        if (!confirmed) {
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

/** 一度受けた要求を既存Coordinatorへ配送する。子側で新しい受付台帳は持たない。 @trace ARCH-000012 */
function serveObjective(): void {
  if (!process.send) throw Error("objective_child_requires_ipc");
  const send = process.send.bind(process);
  const cancellation = new AbortController();
  let received = false;
  let pending:
    | {
        kind: "grant" | "confirmed";
        resolve: (message: Record<string, unknown> | null) => void;
      }
    | undefined;
  const stop = () => {
    cancellation.abort();
    pending?.resolve(null);
    pending = undefined;
  };
  const ask = (kind: "grant" | "confirmed", message: object) =>
    new Promise<Record<string, unknown> | null>((resolve) => {
      if (cancellation.signal.aborted || !process.connected)
        return resolve(null);
      pending = { kind, resolve };
      send(message, (error: Error | null) => {
        if (error) stop();
      });
    });
  const run = async (request: unknown) => {
    const coordinator = await import("@qual-lab/crdd-coordinator");
    const result = await coordinator.runObjective(
      request,
      cancellation.signal,
      async (target) => {
        const message = await ask("grant", { kind: "authorize", ...target });
        const grant = message?.grant;
        if (
          !isMessage(grant) ||
          typeof grant.directory !== "string" ||
          typeof grant.principalId !== "string" ||
          cancellation.signal.aborted
        )
          return () => null;
        const { directory, principalId } = grant;
        const prepareWorkspaceTarget = target.workspaceId
          ? (await import("./workspace.ts")).observeWorkspaceExecutionTarget
          : null;
        const confirmed = await ask("confirmed", { kind: "confirm" });
        return () =>
          confirmed?.allowed === true && !cancellation.signal.aborted
            ? {
                directory,
                principalId,
                ...(prepareWorkspaceTarget
                  ? {
                      prepareWorkspaceTarget: () =>
                        prepareWorkspaceTarget(
                          directory,
                          target.projectId,
                          target.workspaceId,
                        ),
                    }
                  : {}),
                revalidate: async () =>
                  (await ask("confirmed", { kind: "confirm" }))?.allowed ===
                  true,
              }
            : null;
      },
    );
    if (process.connected)
      await new Promise<void>((resolve) =>
        send({ kind: "result", value: result }, () => resolve()),
      );
  };
  process.on("disconnect", stop);
  process.on("message", (message: unknown) => {
    if (!isMessage(message)) return stop();
    if (message.kind === "cancel") {
      stop();
      if (!received && process.connected) process.disconnect();
    } else if (!received && message.kind === "execute") {
      received = true;
      void run(message.request)
        .catch(() => {
          process.exitCode = 1;
        })
        .finally(() => {
          if (process.connected) process.disconnect();
        });
    } else if (pending && message.kind === pending.kind) {
      const waiting = pending;
      pending = undefined;
      waiting.resolve(message);
    } else stop();
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  serveObjective();
