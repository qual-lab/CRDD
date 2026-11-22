/**
 * 読取り検証のHTTP・Owner観測を本文なしで計測する。
 * @responsibility 検証用の要求番号・固定段階・時刻と購読解除だけを所有する。
 * @trace ERB-IT-021
 * @boundary Node HTTP診断通知と同じToolのClient／Owner。Task状態は変更しない。
 * @security URL・本文・Token・結果・例外本文を記録しない。
 * @packageDocumentation
 * @level IT
 * @scope 検証専用のHTTP搬送・子Process又は受動診断。実Provider／Dockerの成功は主張しない。
 */
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { VerificationHttpTiming } from "./ai-verification-http.ts";

type Stage = "initial" | "start" | "observe" | "cancel" | "close";
type Route = "view" | "action";
type ServerTiming = {
  ordinal: number;
  stage: Stage;
  route: Route;
  receivedAt: number;
  finishedAt: number | null;
};

/**
 * 既存の有限な検証Sessionへ時計だけを付加する。
 * @trace ERB-IT-021
 * @effect bind後だけNode診断通知を購読し、disposeで解除する。
 * @failure 観測の例外は件数として残し、元の処理結果を変更しない。
 * @concurrency 同じToolの逐次HTTP。Ownerの相関候補が複数ならnullとする。
 * @responsibility createReadonlyVerificationTimingで検証用の要求・観測を搬送する。
 * @precondition 呼出し元が同じ検証runの入力と終了処理を所有する。
 * @stimulus createReadonlyVerificationTimingで検証用の要求・観測を搬送する。
 * @observation 要求・診断の搬送結果と、取得・終了の観測値。
 * @oracle 入力の相関・欠測・失敗を保持し、搬送だけからTask成功を生成しない。
 * @cleanup 購読・子Process等の終了はこの関数又は呼出し元の明示的な終了処理で確認する。
 * @boundary 検証Tool内部の技術搬送。Provider実成功や処置許可は返さない。
 */
export function createReadonlyVerificationTiming() {
  let stage: Stage = "initial";
  let port: number | null = null;
  let bound = false;
  let closed = false;
  let observationFailures = 0;
  let clientOrdinal = 0;
  let serverOrdinal = 0;
  let ownerOrdinal = 0;
  let loopTimer: ReturnType<typeof setInterval> | null = null;
  let lastLoopAt = 0;
  let loopDelay: {
    expectedAt: number;
    observedAt: number;
    delayMs: number;
  } | null = null;
  const clients: (VerificationHttpTiming & {
    ordinal: number;
    stage: Stage;
    routeKind: Route;
  })[] = [];
  const servers: ServerTiming[] = [];
  const owners: {
    ordinal: number;
    serverOrdinal: number | null;
    stage: Stage;
    startedAt: number;
    completedAt: number | null;
  }[] = [];
  const responses = new WeakMap<ServerResponse, ServerTiming>();
  const routeOf = (route: string): Route | null =>
    route === "/api/workbench-view?route=%2F"
      ? "view"
      : route === "/ai-request/action"
        ? "action"
        : null;
  /**
   * receiveで検証用の要求・観測を搬送する。
   * @responsibility receiveで検証用の要求・観測を搬送する。
   * @trace ERB-IT-021
   * @precondition 呼出し元が同じ検証runの入力と終了処理を所有する。
   * @stimulus receiveで検証用の要求・観測を搬送する。
   * @observation 要求・診断の搬送結果と、取得・終了の観測値。
   * @oracle 入力の相関・欠測・失敗を保持し、搬送だけからTask成功を生成しない。
   * @cleanup 購読・子Process等の終了はこの関数又は呼出し元の明示的な終了処理で確認する。
   * @boundary 検証Tool内部の技術搬送。Provider実成功や処置許可は返さない。
   */
  const receive = (message: unknown) => {
    try {
      const { request, response } = message as {
        request: IncomingMessage;
        response: ServerResponse;
      };
      const route = routeOf(request.url ?? "");
      if (
        closed ||
        !route ||
        request.socket.localPort !== port ||
        request.socket.localAddress !== "127.0.0.1"
      )
        return;
      serverOrdinal++;
      const row = {
        ordinal: serverOrdinal,
        stage,
        route,
        receivedAt: Date.now(),
        finishedAt: null,
      };
      servers.push(row);
      responses.set(response, row);
    } catch {
      observationFailures++;
    }
  };
  /**
   * finishで検証用の要求・観測を搬送する。
   * @responsibility finishで検証用の要求・観測を搬送する。
   * @trace ERB-IT-021
   * @precondition 呼出し元が同じ検証runの入力と終了処理を所有する。
   * @stimulus finishで検証用の要求・観測を搬送する。
   * @observation 要求・診断の搬送結果と、取得・終了の観測値。
   * @oracle 入力の相関・欠測・失敗を保持し、搬送だけからTask成功を生成しない。
   * @cleanup 購読・子Process等の終了はこの関数又は呼出し元の明示的な終了処理で確認する。
   * @boundary 検証Tool内部の技術搬送。Provider実成功や処置許可は返さない。
   */
  const finish = (message: unknown) => {
    try {
      const row = responses.get(
        (message as { response: ServerResponse }).response,
      );
      if (!closed && row) row.finishedAt = Date.now();
    } catch {
      observationFailures++;
    }
  };
  return {
    bind(baseUrl: string) {
      if (bound || closed) throw Error("readonly_timing_binding_invalid");
      const url = new URL(baseUrl);
      if (
        url.protocol !== "http:" ||
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw Error("readonly_timing_binding_invalid");
      port = Number(url.port);
      lastLoopAt = Date.now();
      loopTimer = setInterval(() => {
        const observedAt = Date.now(),
          expectedAt = lastLoopAt + 100;
        const delayMs = Math.max(0, observedAt - expectedAt);
        if (
          observedAt >= expectedAt &&
          (loopDelay === null || delayMs > loopDelay.delayMs)
        )
          loopDelay = { expectedAt, observedAt, delayMs };
        lastLoopAt = observedAt;
      }, 100);
      loopTimer.unref();
      subscribe("http.server.request.start", receive);
      subscribe("http.server.response.finish", finish);
      bound = true;
    },
    setStage(value: Stage) {
      stage = value;
    },
    client(timing: VerificationHttpTiming) {
      try {
        const routeKind = routeOf(timing.route);
        if (closed || !routeKind) return;
        clientOrdinal++;
        // 固定経路だけを再構成し、Callerの任意fieldは複製しない。
        clients.push({
          ordinal: clientOrdinal,
          stage,
          routeKind,
          method: timing.method,
          route:
            routeKind === "view"
              ? "/api/workbench-view?route=%2F"
              : "/ai-request/action",
          startedAt: timing.startedAt,
          requestCreatedAt: timing.requestCreatedAt,
          headersSendingAt: timing.headersSendingAt,
          headersAt: timing.headersAt,
          completedAt: timing.completedAt,
          closedAt: timing.closedAt,
        });
      } catch {
        observationFailures++;
      }
    },
    async observeOwner<T>(operation: () => Promise<T>): Promise<T> {
      let row: (typeof owners)[number] | null = null;
      try {
        if (!closed) {
          ownerOrdinal++;
          const active = servers.filter((item) => item.finishedAt === null);
          row = {
            ordinal: ownerOrdinal,
            serverOrdinal:
              active.length === 1 ? (active[0]?.ordinal ?? null) : null,
            stage,
            startedAt: Date.now(),
            completedAt: null,
          };
          owners.push(row);
        }
      } catch {
        observationFailures++;
      }
      try {
        return await operation();
      } finally {
        if (row) row.completedAt = Date.now();
      }
    },
    dispose() {
      if (loopTimer !== null) {
        clearInterval(loopTimer);
        loopTimer = null;
      }
      if (bound) {
        unsubscribe("http.server.request.start", receive);
        unsubscribe("http.server.response.finish", finish);
        bound = false;
      }
      closed = true;
    },
    snapshot() {
      // 取得時点の投影。dispose前に始まったOwnerの完了時計は後から更新され得る。
      return {
        observationFailures,
        subscriptionsClosed: closed && !bound,
        loopDelay: loopDelay === null ? null : { ...loopDelay },
        clients: clients.map((row) => ({ ...row })),
        servers: servers.map((row) => ({ ...row })),
        owners: owners.map((row) => ({ ...row })),
      };
    },
  };
}
