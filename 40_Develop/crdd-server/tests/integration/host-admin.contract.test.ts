/**
 * Host管理者の本人確認はloopbackで完結し、確認候補をブラウザーと端末へ分ける。
 * @trace ARCH-000013
 * @level IT
 * @scope Google応答は合成。Host保存、実Googleとは分離する。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  hostAdministratorCallbackPath,
  receiveHostLoginProof,
  runHostAdministratorCommand,
} from "../../src/cli/admin.ts";

test("Host管理CLIの引数拒否と非対話は保存領域と入出力を変更しない", async (t) => {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.equal(fs.realpathSync.native(repository), repository);
  assert.ok(!fs.lstatSync(path.join(repository, ".git")).isSymbolicLink());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const base = fs.mkdtempSync(path.join(parent, "host-admin-cli-"));
  t.after(() => {
    assert.equal(path.dirname(base), parent);
    assert.equal(fs.realpathSync.native(base), base);
    fs.rmSync(base, { recursive: true });
    assert.equal(fs.existsSync(base), false);
  });
  const environment = {
    SystemRoot: process.env.SystemRoot,
    CROS_TRUST_DOMAIN_ID: "local-test",
    LOCALAPPDATA: base,
    HOME: base,
    XDG_STATE_HOME: base,
  };
  let notices = "";
  const input = new PassThrough();
  const output = new Writable({
    write(chunk, _encoding, callback) {
      notices += chunk.toString();
      callback();
    },
  });
  t.after(() => {
    input.destroy();
    output.destroy();
  });
  assert.equal(
    await runHostAdministratorCommand(
      { kind: "initialize" },
      "google",
      4567,
      environment,
      input as unknown as NodeJS.ReadStream,
      output as unknown as NodeJS.WriteStream,
      new AbortController().signal,
    ),
    2,
  );
  assert.match(notices, /対話端末/u);
  assert.equal(input.destroyed, false);
  assert.equal(output.destroyed, false);
  assert.deepEqual(fs.readdirSync(base), []);
  const entry = path.join(repository, "template", "tools", "crdd-server.ts");
  for (const [args, code] of [
    [["--help"], 0],
    [["--initialize"], 64],
    [["--unknown"], 64],
    [["--initialize", "--provider", "google", "--port", "4567"], 2],
  ] as const) {
    const result = spawnSync(process.execPath, [entry, ...args], {
      encoding: "utf8",
      env: environment,
      timeout: 15_000,
      windowsHide: true,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, code);
    if (code === 64) assert.match(result.stderr, /使い方: crdd-server/u);
    else assert.equal(result.stderr, "");
    assert.equal(result.stdout.includes(base), false);
    assert.doesNotMatch(result.stdout, /^CRDD Server:/mu);
    assert.deepEqual(fs.readdirSync(base), []);
  }
});

test("Google初回設定のCLIは共有起動・既存紐付けと排他的でHost対話を要求する", () => {
  const bin = fileURLToPath(
    new URL("../../bin/crdd-server.ts", import.meta.url),
  );
  const invoke = (...args: string[]) =>
    spawnSync(process.execPath, [bin, ...args], {
      encoding: "utf8",
      env: { SystemRoot: process.env.SystemRoot },
      timeout: 15_000,
      windowsHide: true,
    });
  const help = invoke("--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--initialize --provider/u);
  assert.match(help.stdout, /--link-admin <管理者UUID> --provider/u);
  assert.doesNotMatch(help.stdout, /--(?:initialize|link)-google/u);
  assert.doesNotMatch(
    help.stdout,
    /--initialize-admin\b|--exchange-(?:all|user)\b/u,
  );
  for (const args of [
    ["--initialize"],
    ["--exchange-user", "00000000-0000-4000-8000-000000000001"],
    ["--exchange-all", "00000000-0000-4000-8000-000000000001"],
    ["--initialize-google", "--port", "4567"],
    ["--link-google", "00000000-0000-4000-8000-000000000001", "--port", "4567"],
    ["--initialize-admin", "--provider", "google", "--port", "4567"],
    ["--initialize", "--port", "4567"],
    ["--initialize", "--provider", "google", "--port", "0"],
    ["--initialize", "--provider", "microsoft", "--port", "4567"],
    ["--provider", "google", "--port", "4567"],
    ["--initialize", "--provider", "google", "--port", "4567", "--docs"],
    ["--initialize", "--provider", "google", "--port", "4567", "--mcp-stdio"],
    ["--initialize", "--provider", "google", "--port", "4567", "--shared"],
    [
      "--initialize",
      "--provider",
      "google",
      "--port",
      "4567",
      "--link-admin",
      "00000000-0000-4000-8000-000000000001",
    ],
  ]) {
    const result = invoke(...args);
    assert.equal(result.status, 64);
    assert.match(result.stderr, /使い方: crdd-server/u);
    assert.doesNotMatch(result.stdout, /^CRDD Server:/mu);
  }
  for (const operation of [
    ["--initialize"],
    ["--link-admin", "00000000-0000-4000-8000-000000000001"],
  ]) {
    const noTerminal = invoke(
      ...operation,
      "--provider",
      "google",
      "--port",
      "4567",
    );
    assert.equal(noTerminal.status, 2);
    assert.match(noTerminal.stdout, /Hostの対話端末/u);
  }
});

async function loopback(): Promise<URL> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  assert.ok(address && typeof address !== "string");
  return new URL(`http://127.0.0.1:${address.port}`);
}

test("Hostは同じブラウザーでの本人確認だけを受け付け、一時Listenerを閉じる", async () => {
  const origin = await loopback();
  const callback = new URL(hostAdministratorCallbackPath, origin);
  callback.searchParams.set("code", "synthetic");
  const googleAuthorization = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  const binding = "b".repeat(43);
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "fixture-subject",
  } as const;
  let listening: (url: string) => void = () => {};
  const ready = new Promise<string>((resolve) => {
    listening = resolve;
  });
  const controller = new AbortController();
  const proof = receiveHostLoginProof(
    origin,
    {
      async start() {
        return { location: googleAuthorization, browserBinding: binding };
      },
      async complete(query, supplied) {
        return supplied === binding && query.get("code") === "synthetic"
          ? { identity, returnTo: "/" }
          : null;
      },
    },
    listening,
    controller.signal,
  );
  try {
    assert.equal(await Promise.race([ready, proof]), origin.href);
    const form = await fetch(origin);
    assert.equal(form.status, 200);
    assert.equal(form.headers.get("cache-control"), "no-store");
    assert.equal(form.headers.get("referrer-policy"), "no-referrer");
    assert.doesNotMatch(
      form.headers.get("content-security-policy") ?? "",
      /form-action/u,
    );
    assert.equal((await fetch(callback)).status, 403);
    assert.equal(
      (
        await fetch(origin, {
          method: "POST",
          headers: { origin: "https://other.example" },
          redirect: "manual",
        })
      ).status,
      403,
    );
    const started = await fetch(origin, {
      method: "POST",
      headers: { origin: origin.origin },
      redirect: "manual",
    });
    assert.equal(started.status, 303);
    assert.equal(started.headers.get("location"), googleAuthorization.href);
    const cookie = started.headers.getSetCookie()[0]?.split(";")[0];
    assert.ok(cookie);
    const confirmed = await fetch(callback, { headers: { cookie } });
    assert.equal(confirmed.status, 200);
    const outcome = await proof;
    assert.ok(outcome);
    assert.equal(outcome.subject, identity.subject);
    assert.match(outcome.confirmation, /^\d{8}$/u);
    const body = await confirmed.text();
    assert.ok(body.includes(outcome.confirmation));
    assert.ok(!body.includes(identity.subject));
    await assert.rejects(fetch(origin));
  } finally {
    controller.abort();
    await proof;
  }
});

test("Hostの取消は確認候補を返さず、一時受付と進行中の本人確認の終了を待つ", {
  timeout: 5000,
}, async () => {
  const origin = await loopback();
  const controller = new AbortController();
  let ready = () => {};
  const listening = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let notifyStarted = () => {};
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let notifyAbort = () => {};
  const cancelled = new Promise<void>((resolve) => {
    notifyAbort = resolve;
  });
  const callback = new URL(hostAdministratorCallbackPath, origin);
  let settled = false;
  const proof = receiveHostLoginProof(
    origin,
    {
      async start() {
        throw Error("not_used");
      },
      async complete(_search, _binding, signal) {
        signal.addEventListener("abort", notifyAbort, { once: true });
        notifyStarted();
        await pending;
        return {
          identity: {
            issuer: "https://accounts.google.com",
            subject: "fixture",
          },
          returnTo: "/",
        };
      },
    },
    ready,
    controller.signal,
  ).finally(() => {
    settled = true;
  });
  try {
    await listening;
    const response = fetch(callback).catch(() => null);
    await started;
    controller.abort();
    await cancelled;
    assert.equal(await response, null);
    assert.equal(settled, false);
    release();
    assert.equal(await proof, null);
    await assert.rejects(fetch(origin));
  } finally {
    controller.abort();
    release();
    await proof;
  }
});
