/**
 * Browser接続の要求・応答世代を有限のTransport fixtureで検証する。
 * @packageDocumentation
 * @responsibility 同Origin搬送、共有セッション、無効化後の遅延応答拒否と全文搬送を反証する。
 * @trace EST-IT-002
 * @level IT
 * @scope Browser connection module→合成fetch／stream→Caller。
 * @boundary 実Browser・実HTTP・現在Role認可の代替ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceHttpRoutes } from "@qual-lab/crdd-server";
import {
  changeBrowserSession,
  disconnectGitHost,
  isGitHostLinkAbsent,
  isGitHostRevocationUnconfirmed,
  registerAccess,
  requestGitHostConnections,
  requestManagementView,
} from "../../src/api/access.ts";
import {
  invalidateWorkbenchRequests,
  requestWorkbench,
} from "../../src/api/connection.ts";
import { requestWorkspace } from "../../src/api/mutations.ts";
import { workbenchPath, workbenchRequest } from "../../src/api/path.ts";
import { readViewResponse } from "../../src/api/view.ts";

// 実行せず型検査だけで、契約にない組合せを反証する。
const invalidRouteExamples = () => {
  // @ts-expect-error ログイン開始はPOSTのみ。
  workbenchPath(["GET", "/api/session/login/:provider"], {
    provider: "google",
  });
  // @ts-expect-error 既知のHTTPメソッドでも未登録の経路は指定できない。
  workbenchPath(["GET", "/api/workbench/not-registered"]);
  // @ts-expect-error 必須のパス引数は省略できない。
  workbenchPath(["POST", "/api/session/login/:provider"]);
  const rename: WorkspaceHttpRoutes["rename"] = [
    // @ts-expect-error 廃棄の経路を改名操作として扱えない。
    "DELETE",
    "/api/repositories/:repositoryId/workspaces/:workspaceId",
  ];
  return rename;
};
void invalidRouteExamples;

/** 詳細画面はTopicとMeetingのREST応答を表示と操作可否に変換する。 @trace EST-IT-002 */
test("Topic・Meetingの詳細は指定リポジトリのRESTだけを読み、操作可否と対象を守る", async () => {
  const originalFetch = globalThis.fetch;
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  const origin = "http://127.0.0.1:12345";
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin },
  });
  try {
    for (const kind of ["topic", "meeting"] as const) {
      const id = kind === "topic" ? "TOPIC-000001" : "MTG-000001";
      const baseRecord = {
        projectId: "project.test",
        revision: 1,
        owner: "Owner",
        title: "Title",
        summary: "Summary",
      };
      const record =
        kind === "topic"
          ? { ...baseRecord, topicId: id, state: "open" }
          : {
              ...baseRecord,
              meetingId: id,
              state: "recorded",
              occurredAt: "2026-11-27",
              pendingOutcomeCount: 0,
            };
      const paths: string[] = [];
      let responseId = "selected";
      globalThis.fetch = async (value) => {
        const path = new URL(String(value)).pathname;
        paths.push(path);
        if (path === "/api/workbench/context")
          return Response.json({
            contract: "crdd/workbench/context/v1",
            mode: "single",
            repositoryId: "selected",
          });
        return Response.json({
          status: "completed",
          repositoryId: responseId,
          writable: false,
          relationScope: "repository",
          record,
          markdown: "summary",
          relations: [],
        });
      };
      const url = new URL(`/${kind}?id=${id}&repositoryId=selected`, origin);
      const signal = new AbortController().signal;
      const model = await readViewResponse(url, signal);
      assert.equal(model.view, "record-detail");
      assert.equal(model.recordActionsConfigured, false);
      assert.equal(model.record.kind, kind);
      assert.equal(model.record.id, id);
      assert.deepEqual(paths, [`/api/repositories/selected/${kind}s/${id}`]);
      url.searchParams.delete("repositoryId");
      await readViewResponse(url, signal);
      assert.deepEqual(paths.slice(1), [
        "/api/workbench/context",
        `/api/repositories/selected/${kind}s/${id}`,
      ]);
      responseId = "different";
      await assert.rejects(readViewResponse(url, signal));
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (location) Object.defineProperty(globalThis, "location", location);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

/** Projectの画面はREST資源を読み、取得対象と応答を照合する。 @trace EST-IT-002 */
test("Project詳細は表示切替でなくProject資源を読み、別対象を描画しない", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  const originalFetch = globalThis.fetch;
  const origin = "http://127.0.0.1:12345";
  const paths: string[] = [];
  const project = {
    projectId: "project.example",
    state: "partial",
    sources: [
      {
        repositoryId: "visible",
        revision: null,
        state: "missing",
        repositoryRole: null,
        context: null,
      },
    ],
  };
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin },
  });
  globalThis.fetch = async (input) => {
    paths.push(new URL(String(input)).pathname);
    return Response.json(project);
  };
  try {
    const signal = new AbortController().signal;
    const page = new URL("/project?id=project.example", origin);
    const model = await readViewResponse(page, signal);
    assert.equal(model.view, "project-detail");
    assert.deepEqual(paths, ["/api/projects/project.example"]);
    page.searchParams.set("repositoryId", "wrong");
    await assert.rejects(readViewResponse(page, signal), {
      message: "workbench_query_unavailable",
    });
    assert.equal(
      paths.at(-1),
      "/api/repositories/wrong/projects/project.example/context",
    );
    page.searchParams.delete("repositoryId");
    const pending = new AbortController();
    let cancel = false;
    globalThis.fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path === "/api/projects/project.example")
        return Response.json({ error: "login_required" }, { status: 401 });
      assert.equal(path, "/api/workbench/context");
      if (cancel) pending.abort();
      return Response.json({
        contract: "crdd/workbench/context/v1",
        mode: "shared",
        login: {
          contract: "crdd/workbench/view/v1",
          view: "access",
          actionToken: "a".repeat(43),
          authenticated: false,
        },
      });
    };
    const login = await readViewResponse(page, signal);
    assert.equal(login.view, "access");
    assert.deepEqual(paths.slice(-2), [
      "/api/projects/project.example",
      "/api/workbench/context",
    ]);
    cancel = true;
    await assert.rejects(readViewResponse(page, pending.signal));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous) Object.defineProperty(globalThis, "location", previous);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

/** 画面から分離したアクセス操作のHTTP契約。 @trace EST-IT-002 */
test("接続・管理操作は一度だけ正しいパスとJSONを送る", async () => {
  const original = globalThis.fetch;
  const signal = new AbortController().signal;
  const calls: unknown[] = [];
  const revision = {
    expectedRevision: 7,
    operationId: "op",
    formToken: "token",
  };
  globalThis.fetch = async (path, init) => {
    assert.equal(init?.signal, signal);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (body) {
      assert.equal(
        new Headers(init?.headers).get("content-type"),
        "application/json",
      );
      assert.equal(init?.cache, "no-store");
    }
    calls.push([path, init?.method ?? "GET", body]);
    return new Response(null, { status: 204 });
  };
  try {
    await requestGitHostConnections(signal);
    await disconnectGitHost("git.example+1", signal);
    await changeBrowserSession("start_management", signal);
    await changeBrowserSession("sign_out", signal);
    for (const view of ["current", "users", "repositories"] as const)
      await requestManagementView(view, signal);
    await registerAccess(
      { kind: "repository", repositoryId: "repo", directory: "sample" },
      revision,
      signal,
    );
    await registerAccess(
      { kind: "invitation", userId: "user-1", email: "member@example.invalid" },
      revision,
      signal,
    );
    await registerAccess(
      {
        kind: "user",
        username: "member",
        email: "member@example.invalid",
        role: "developer",
      },
      revision,
      signal,
    );
    assert.deepEqual(calls, [
      ["/api/session/git", "GET", null],
      ["/api/session/git/git.example%2B1", "DELETE", null],
      ["/api/session/management", "POST", null],
      ["/api/session", "DELETE", null],
      ["/api/access/me", "GET", null],
      ["/api/users", "GET", null],
      ["/api/repositories", "GET", null],
      [
        "/api/repositories",
        "POST",
        { repositoryId: "repo", directory: "sample", ...revision },
      ],
      [
        "/api/users/user-1/invitations",
        "POST",
        { email: "member@example.invalid", ...revision },
      ],
      [
        "/api/users",
        "POST",
        {
          username: "member",
          email: "member@example.invalid",
          role: "developer",
          ...revision,
        },
      ],
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("プロキシの502をCRDD内の連携解除済みと見なさない", async () => {
  const crdd = {
    status: 502,
    headers: { "content-type": "text/plain; charset=utf-8" },
  };
  assert.equal(
    await isGitHostRevocationUnconfirmed(
      new Response("git_host_revocation_unconfirmed\n", crdd),
    ),
    true,
  );
  assert.equal(
    await isGitHostRevocationUnconfirmed(new Response("Bad gateway", crdd)),
    false,
  );
  const absent = new Response("git_host_link_absent\n", {
    ...crdd,
    status: 200,
  });
  assert.equal(await isGitHostRevocationUnconfirmed(absent), false);
  assert.equal(await isGitHostLinkAbsent(absent), true);
});

test("Workbenchの経路型はメソッドと対象を保ち、値を別のパスやクエリにしない", () => {
  for (const provider of ["", ".", ".."])
    assert.throws(
      () =>
        workbenchPath(["POST", "/api/session/login/:provider"], { provider }),
      /workbench_route_input_invalid/u,
    );
  assert.deepEqual(
    workbenchRequest(["POST", "/api/session/login/:provider/invitation"], {
      provider: "synthetic/?#",
    }),
    {
      method: "POST",
      path: "/api/session/login/synthetic%2F%3F%23/invitation",
    },
  );
  assert.equal(
    workbenchPath(
      [
        "PUT",
        "/api/repositories/:repositoryId/meetings/:meetingId/outcomes/:outcomeId/treatment",
      ],
      { repositoryId: "repo.a", meetingId: "MTG-000001", outcomeId: "OUT-001" },
    ),
    "/api/repositories/repo.a/meetings/MTG-000001/outcomes/OUT-001/treatment",
  );
});

test("Workspaceの選択と改名は経路と本文で対象を混ぜない", async (t) => {
  const savedLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "http://127.0.0.1:12345" },
  });
  t.after(() => {
    if (savedLocation)
      Object.defineProperty(globalThis, "location", savedLocation);
    else Reflect.deleteProperty(globalThis, "location");
  });
  const calls: { path: string; method: string; body: unknown }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    (input: string | URL, options: RequestInit) => {
      const { pathname, search } = new URL(input, "http://127.0.0.1:12345");
      calls.push({
        path: pathname + search,
        method: options.method ?? "GET",
        body: options.body ? JSON.parse(String(options.body)) : null,
      });
      return Promise.resolve(new Response("{}"));
    },
  );
  const workspaceId = "00000000-0000-4000-8000-000000000001";
  await requestWorkspace("repo.a", {
    operation: "get",
    workspaceId,
    ignored: null,
  });
  await requestWorkspace("repo.a", {
    operation: "rename",
    workspaceId,
    name: "改名",
  });
  await requestWorkspace("repo.a", { operation: "select", workspaceId });
  assert.deepEqual(calls, [
    {
      path: `/api/repositories/repo.a/workspaces/${workspaceId}`,
      method: "GET",
      body: null,
    },
    {
      path: `/api/repositories/repo.a/workspaces/${workspaceId}`,
      method: "PATCH",
      body: { name: "改名" },
    },
    {
      path: "/api/repositories/repo.a/selected-workspace",
      method: "PUT",
      body: { workspaceId },
    },
  ]);
});

/**
 * Cookie送信の境界と無効化前後の応答の非混同を検証する。
 * @responsibility Browser storageを使わず、合成streamと要求Headerで反証する。
 * @trace EST-IT-002
 * @precondition Node内の自己所有fetch／location fixtureだけを使用する。
 * @stimulus 単体・共有・画面終了・不正Origin／Header・過大本文を与える。
 * @observation 送信回数、Header、redirect構成、Reader取消／解放、固定失敗。
 * @oracle 別Origin送信0、再送0、旧応答0。旧容量境界を超える本文も搬送しReaderを解放する。
 * @cleanup 元fetchとlocation descriptorを復元し、要求世代を無効化する。
 * @boundary 合成Transportの局所確認。Browser DOM／実API成立は別検証。
 */
test("Browser要求は単体と共有のCookie送信を区別し、古い応答を採用しない", async () => {
  const originalFetch = globalThis.fetch;
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "http://127.0.0.1:12345" },
  });
  let calls = 0;
  let observed: RequestInit | undefined;
  globalThis.fetch = async (_, options) => {
    calls += 1;
    observed = options;
    return new Response('{"status":"completed"}', {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    invalidateWorkbenchRequests();
    const without = await requestWorkbench("/api/workbench/overview");
    assert.equal(new Headers(observed?.headers).has("authorization"), false);
    assert.equal(observed?.credentials, "omit");
    assert.equal((await without.json()).status, "completed");
    const shared = await requestWorkbench("/api/workbench/overview", {}, true);
    assert.equal(new Headers(observed?.headers).has("authorization"), false);
    assert.equal(observed?.redirect, "manual");
    assert.equal(observed?.credentials, "same-origin");
    assert.equal(observed?.mode, "same-origin");
    assert.equal(observed?.cache, "no-store");
    assert.equal((await shared.json()).status, "completed");
    const beforeRejected = calls;
    await assert.rejects(
      requestWorkbench("https://example.invalid/api/workbench/overview"),
      { message: "workbench_request_rejected" },
    );
    await assert.rejects(
      requestWorkbench("/api/workbench/overview", {
        headers: { authorization: "Bearer other" },
      }),
      { message: "workbench_request_rejected" },
    );
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      requestWorkbench("/api/workbench/overview", { signal: cancelled.signal }),
      { message: "workbench_request_rejected" },
    );
    assert.equal(calls, beforeRejected);
    let release: ((value: Response) => void) | undefined;
    globalThis.fetch = async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    const late = requestWorkbench("/api/workbench/overview");
    assert.ok(release);
    invalidateWorkbenchRequests();
    release(new Response("old user result"));
    await assert.rejects(late, { message: "workbench_response_unavailable" });
    let cancelledReader = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16777217));
        controller.close();
      },
      cancel() {
        cancelledReader = true;
      },
    });
    globalThis.fetch = async () => new Response(stream);
    const large = await requestWorkbench("/api/workbench/overview");
    assert.equal((await large.arrayBuffer()).byteLength, 16777217);
    assert.equal(cancelledReader, false);
    assert.equal(stream.locked, false);
    invalidateWorkbenchRequests();
    globalThis.fetch = async (_, options) => {
      observed = options;
      return new Response(null, { status: 204 });
    };
    assert.equal(
      (await requestWorkbench("/api/workbench/overview")).status,
      204,
    );
    assert.equal(new Headers(observed?.headers).has("authorization"), false);
  } finally {
    invalidateWorkbenchRequests();
    globalThis.fetch = originalFetch;
    if (location) Object.defineProperty(globalThis, "location", location);
    else Reflect.deleteProperty(globalThis, "location");
  }
});

/**
 * 送信開始後の取消を同じSignalとReader終端まで確認する。
 * @responsibility native相当のAbortErrorを固定取消結果へ写し、再送とReader残存を拒否する。
 * @trace EST-IT-002
 * @precondition 自己所有のfetchと応答streamだけを差し替える。
 * @stimulus fetch待機中または本文read待機中にSignalをabortする。
 * @observation 同一Signal、要求数、固定失敗、Reader lockと元fixture復元。
 * @oracle 開始後取消は固定失敗、fetchは各一回、Readerは解放、非取消失敗は保存する。
 * @cleanup fetch／locationを復元し、資格memoryを解放する。
 * @boundary 合成Transportの取消だけ。外部Effect rollbackを主張しない。
 */
test("Browser要求の開始後取消は再送せず応答Readerを解放する", async () => {
  const originalFetch = globalThis.fetch;
  const location = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "http://127.0.0.1:12345" },
  });
  try {
    invalidateWorkbenchRequests();
    const cancellation = new AbortController();
    let calls = 0;
    let observedSignal: AbortSignal | null | undefined;
    let readStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        cancellation.signal.addEventListener(
          "abort",
          () => {
            controller.error(new DOMException("fixture abort", "AbortError"));
          },
          { once: true },
        );
      },
      pull() {
        readStarted?.();
      },
    });
    globalThis.fetch = async (_, options) => {
      calls += 1;
      observedSignal = options?.signal;
      return new Response(stream);
    };
    const reading = requestWorkbench("/api/workbench/overview", {
      signal: cancellation.signal,
    });
    await started;
    assert.equal(observedSignal, cancellation.signal);
    cancellation.abort();
    await assert.rejects(reading, {
      message: "workbench_response_unavailable",
    });
    assert.equal(calls, 1);
    assert.equal(stream.locked, false);

    const waitingCancellation = new AbortController();
    globalThis.fetch = (_, options) => {
      calls += 1;
      assert.equal(options?.signal, waitingCancellation.signal);
      return new Promise<Response>((_, reject) => {
        waitingCancellation.signal.addEventListener(
          "abort",
          () => {
            reject(new DOMException("fixture abort", "AbortError"));
          },
          { once: true },
        );
      });
    };
    const waiting = requestWorkbench("/api/workbench/overview", {
      signal: waitingCancellation.signal,
    });
    waitingCancellation.abort();
    await assert.rejects(waiting, {
      message: "workbench_response_unavailable",
    });
    assert.equal(calls, 2);

    const networkFailure = new Error("fixture network failure");
    globalThis.fetch = async () => {
      calls += 1;
      throw networkFailure;
    };
    await assert.rejects(
      requestWorkbench("/api/workbench/overview"),
      (error) => error === networkFailure,
    );
    assert.equal(calls, 3);
  } finally {
    invalidateWorkbenchRequests();
    globalThis.fetch = originalFetch;
    if (location) Object.defineProperty(globalThis, "location", location);
    else Reflect.deleteProperty(globalThis, "location");
  }
});
