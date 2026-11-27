/**
 * Host対話による初回管理者の設定・再紐付け。
 * @trace ARCH-000013
 * @boundary 保存は行わず、ループバックを閉じてからHostへ確認候補だけを渡す。
 */
import { randomInt } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { createInterface } from "node:readline/promises";
import {
  initializeAdministratorFromHost,
  readExistingHostRoot,
  readAdministratorFromHost,
  readHostInitializationState,
  resolveHostRootInput,
  linkAccountFromHost,
} from "@qual-lab/crdd-access-management";
import { createLogin } from "../transport/login.ts";
import { loginProviderProfiles } from "../transport/login-providers.ts";

export const hostAdministratorCallbackPath = "/api/session/host-admin/callback";
const cookieName = "crdd-host-google";
type Login = Awaited<ReturnType<typeof createLogin>>;
type Proof = Readonly<{
  issuer: string;
  subject: string;
  confirmation: string;
}>;

function setProofHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

/** 相関した確認コードをブラウザーだけに表示し、一時Listenerを閉じる。 @trace ARCH-000013 */
export async function receiveHostLoginProof(
  origin: URL,
  login: Login,
  ready: (url: string) => void,
  signal: AbortSignal,
): Promise<Proof | null> {
  if (signal.aborted) return null;
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    !origin.port ||
    origin.href !== `${origin.origin}/`
  )
    throw new Error("host_google_origin_invalid");
  const stop = new AbortController();
  const closing = AbortSignal.any([signal, stop.signal]);
  const sockets = new Set<Socket>();
  const requests = new Set<Promise<void>>();
  let found: Proof | null = null;
  let finish: (proof: Proof | null) => void = () => {};
  const pending = new Promise<Proof | null>((resolve) => {
    finish = resolve;
  });
  const cancelled = () => finish(null);
  signal.addEventListener("abort", cancelled, { once: true });
  const server = createServer((request, response) => {
    if (closing.aborted) {
      request.destroy();
      return;
    }
    const disconnected = new AbortController();
    const abortRequest = () => disconnected.abort();
    const closeResponse = () => {
      if (!response.writableFinished) abortRequest();
    };
    request.once("aborted", abortRequest);
    response.once("close", closeResponse);
    const active = AbortSignal.any([closing, disconnected.signal]);
    const task = handleRequest(request, response, active)
      .catch(() => {
        if (!active.aborted && !response.destroyed && !response.headersSent)
          reply(response, 500, "本人確認を処理できません。\n");
      })
      .finally(() => {
        request.off("aborted", abortRequest);
        response.off("close", closeResponse);
        requests.delete(task);
      });
    requests.add(task);
  });
  server.on("connection", (socket) => {
    if (closing.aborted) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  function reply(
    response: ServerResponse,
    status: number,
    body: string,
    contentType = "text/plain; charset=utf-8",
  ) {
    setProofHeaders(response);
    response.statusCode = status;
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(body);
  }
  async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    active: AbortSignal,
  ) {
    const accept = (status: number, body: string) =>
      reply(response, status, body);
    if (active.aborted) return;
    if (
      request.headersDistinct.host?.length !== 1 ||
      request.headers.host !== origin.host
    )
      return accept(403, "接続先が一致しません。\n");
    if (request.url === "/" && request.method === "GET")
      return reply(
        response,
        200,
        '<!doctype html><html lang="ja"><meta charset="utf-8"><title>CRDD 管理者の紐付け</title><h1>CRDD 管理者の紐付け</h1><form method="post"><button>Googleで本人確認する</button></form>',
        "text/html; charset=utf-8",
      );
    if (request.url === "/" && request.method === "POST") {
      if (
        request.headersDistinct.origin?.length !== 1 ||
        request.headers.origin !== origin.origin ||
        found
      )
        return accept(403, "本人確認を開始できません。\n");
      const started = await login.start();
      if (active.aborted || response.destroyed) return;
      setProofHeaders(response);
      response.setHeader(
        "Set-Cookie",
        `${cookieName}=${started.browserBinding}; Path=${hostAdministratorCallbackPath}; Max-Age=300; HttpOnly; SameSite=Lax`,
      );
      response.statusCode = 303;
      response.setHeader("Location", started.location.href);
      response.end();
      return;
    }
    if (
      request.method !== "GET" ||
      request.url?.split("?", 1)[0] !== hostAdministratorCallbackPath
    )
      return accept(404, "該当する操作がありません。\n");
    const cookies = (request.headersDistinct.cookie ?? []).flatMap((value) =>
      value
        .split(";")
        .map((field) => field.trim())
        .filter((field) => field.startsWith(`${cookieName}=`)),
    );
    const binding =
      cookies.length === 1
        ? cookies[0]?.slice(cookieName.length + 1)
        : undefined;
    const url = new URL(request.url, origin);
    const result = await login.complete(url.searchParams, binding, active);
    if (active.aborted || response.destroyed) return;
    if (!result || found) return accept(403, "本人確認を確定できません。\n");
    found = {
      ...result.identity,
      confirmation: String(randomInt(100_000_000)).padStart(8, "0"),
    };
    response.setHeader(
      "Set-Cookie",
      `${cookieName}=; Path=${hostAdministratorCallbackPath}; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
    accept(
      200,
      `Host端末に入力する確認コード: ${found.confirmation}\n端末から確定するまでは保存しません。\n`,
    );
    // 応答の送出を閉じ方に巻き込まない。途中切断では候補を渡さない。
    if (response.writableFinished) finish(found);
    else {
      response.once("finish", () => finish(found));
      response.once("close", () => {
        if (!response.writableFinished) finish(null);
      });
    }
  }
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(Number(origin.port), "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    if (signal.aborted) return null;
    ready(origin.href);
    return await pending;
  } finally {
    signal.removeEventListener("abort", cancelled);
    stop.abort();
    const closed = server.listening
      ? new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
      : Promise.resolve();
    for (const socket of sockets) socket.destroy();
    try {
      await closed;
    } finally {
      await Promise.allSettled([...requests]);
    }
  }
}

/** Hostの明示対話を確認してから、本人確認と保存を順番に行う。 @trace ARCH-000013 */
export async function runHostAdministratorCommand(
  operation: { kind: "initialize" } | { kind: "link"; userId: string },
  provider: keyof typeof loginProviderProfiles,
  port: number,
  environment: NodeJS.ProcessEnv,
  terminalInput: NodeJS.ReadStream,
  output: NodeJS.WriteStream,
  hostSignal: AbortSignal,
): Promise<number> {
  if (
    !terminalInput.isTTY ||
    !output.isTTY ||
    output.destroyed ||
    !output.writable
  ) {
    output.write("管理者設定はHostの対話端末で実行してください。\n");
    return 2;
  }
  if (hostSignal.aborted) return 2;
  if (!Object.hasOwn(loginProviderProfiles, provider)) return 2;
  const profile = loginProviderProfiles[provider];
  const settings = (() => {
    try {
      return profile.readConfiguration(environment);
    } finally {
      for (const name of Object.keys(environment))
        if (profile.environmentNames.includes(name.toUpperCase()))
          delete environment[name];
    }
  })();
  const input = resolveHostRootInput(environment);
  const root = input && readExistingHostRoot(input);
  const target =
    root && operation.kind === "link"
      ? readAdministratorFromHost(root, operation.userId)
      : null;
  if (operation.kind === "link" && (!root || !target))
    throw new Error("host_google_administrator_unavailable");
  if (
    !input ||
    (operation.kind === "initialize" &&
      root &&
      readHostInitializationState(root, { settlePending: false }).status !==
        "fresh")
  )
    throw new Error("host_google_initialization_unavailable");
  const controller = new AbortController();
  const stop = () => controller.abort();
  const signal = AbortSignal.any([
    hostSignal,
    controller.signal,
    AbortSignal.timeout(5 * 60_000),
  ]);
  output.write(
    target
      ? `対象: ${target.username} (${target.userId})\n${profile.displayName}で本人確認し、その発行者の紐付けだけを更新します。ほかの発行者の紐付けは変わりません。\n`
      : `${profile.displayName}で本人確認したアカウントを最初の管理者に設定します。接続鍵は発行しません。\n`,
  );
  const origin = new URL(`http://127.0.0.1:${port}`);
  const login = await createLogin(profile, {
    ...settings,
    callback: new URL(hostAdministratorCallbackPath, origin),
    chooseAccount: true,
  });
  const proof = await receiveHostLoginProof(
    origin,
    login,
    (url) => {
      output.write(`同じPCのブラウザーで ${url} を開いてください。\n`);
    },
    signal,
  );
  if (!proof || signal.aborted) return 2;

  const terminal = createInterface({
    input: terminalInput,
    output,
    terminal: true,
  });
  terminal.once("SIGINT", stop);
  terminal.once("close", stop);
  let username: string | undefined;
  try {
    const answer = await terminal.question(
      "確定する場合は、画面に出た8桁の確認コードを入力してください: ",
      { signal },
    );
    if (signal.aborted || answer !== proof.confirmation) return 2;
    if (operation.kind === "initialize")
      username = (
        await terminal.question("最初の管理者の表示名: ", { signal })
      ).trim();
  } catch {
    return 2;
  } finally {
    terminal.removeListener("SIGINT", stop);
    terminal.removeListener("close", stop);
    terminal.close();
  }
  if (signal.aborted) return 2;
  const identity = { issuer: proof.issuer, subject: proof.subject };
  const result =
    operation.kind === "initialize" && username !== undefined
      ? initializeAdministratorFromHost(input, username, identity, signal)
      : root && target
        ? linkAccountFromHost(root, target.userId, identity, target.revision)
        : null;
  if (result?.status !== "completed") {
    output.write(
      "管理者設定の完了を確認できません。やり直す前に保存済み状態を確認してください。\n",
    );
    return 2;
  }
  output.write(
    operation.kind === "initialize"
      ? "最初の管理者を設定しました。共有サーバーをGoogleログイン付きで起動してください。\n"
      : `${profile.displayName}アカウントの紐付けを確定しました。\n`,
  );
  return 0;
}
