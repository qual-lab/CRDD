/**
 * 読取り検証の有限時計と購読解除を外部AIなしで確認する。
 * @responsibility 元結果・例外の同一性、対象選別、欠測・上限と終了を検査する。
 * @trace ERB-IT-021
 * @level IT
 * @scope 合成loopback通信と有限Owner。Docker・資格・Repositoryを使わない。
 * @boundary 診断通知と検証Toolのみ。
 */
import assert from "node:assert/strict";
import { channel } from "node:diagnostics_channel";
import { createServer } from "node:http";
import test from "node:test";
import {
  projectVerificationTransportFailure,
  requestInChild,
} from "../../scripts/ai-verification-http.ts";
import { createReadonlyVerificationTiming } from "../../scripts/ai-verification-timing.ts";

/**
 * 同じGETを番号で区別しServer・Owner・Clientの区間を観測する。
 * @trace ERB-IT-021
 * @stimulus 二GET、別経路、Owner拒否と終了後の通知。
 * @oracle 本文・Tokenなし、元結果・例外は同一、終了後記録増加零。
 * @cleanup finallyでServer・診断購読を閉じる。
 */
test("有限時計は実HTTPとOwnerを観測し購読解除する", async () => {
  const timing = createReadonlyVerificationTiming();
  const value = Object.freeze({ synthetic: true });
  const server = createServer((_request, response) => {
    void timing
      .observeOwner(async () => value)
      .then((result) => {
        assert.equal(result, value);
        response.end("synthetic-secret-body");
      });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}`;
    timing.bind(url);
    for (const stage of ["initial", "observe"] as const) {
      timing.setStage(stage);
      await requestInChild(
        url,
        "/api/workbench-view?route=%2F",
        undefined,
        timing.client,
      );
    }
    await (await fetch(`${url}/synthetic-secret-path`)).text();
    const original = Error("synthetic-secret-error");
    await assert.rejects(
      timing.observeOwner(async () => {
        throw original;
      }),
      (error) => error === original,
    );
    const before = timing.snapshot();
    assert.equal(before.clients.length, 2);
    assert.equal(before.servers.length, 2);
    assert.deepEqual(
      before.clients.map((row) => row.ordinal),
      [1, 2],
    );
    assert.deepEqual(
      before.servers.map((row) => row.stage),
      ["initial", "observe"],
    );
    for (const row of before.servers)
      assert.ok(row.finishedAt !== null && row.finishedAt >= row.receivedAt);
    assert.deepEqual(
      before.owners.slice(0, 2).map((row) => row.serverOrdinal),
      [1, 2],
    );
    assert.equal(JSON.stringify(before).includes("synthetic-secret"), false);
    timing.dispose();
    timing.dispose();
    await (await fetch(`${url}/api/workbench-view?route=%2F`)).text();
    const after = timing.snapshot();
    assert.equal(after.subscriptionsClosed, true);
    assert.equal(after.servers.length, before.servers.length);
    assert.equal(after.owners.length, before.owners.length);
  } finally {
    timing.dispose();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

/**
 * 他接続・未知経路と過大通知を保存せず、相関不能をnullで保持する。
 * @trace ERB-IT-021
 * @stimulus 合成通知、別port／address／path、513通知。
 * @oracle 各配列上限512、曖昧なOwner相関null、dispose後不変。
 * @cleanup 診断購読だけをfinallyで解除する。
 */
test("有限時計は対象を限定し過大・曖昧な通知を成功へ補完しない", async () => {
  const timing = createReadonlyVerificationTiming();
  timing.bind("http://127.0.0.1:12345");
  const start = channel("http.server.request.start");
  const publish = (
    port = 12345,
    address = "127.0.0.1",
    url = "/api/workbench-view?route=%2F",
  ) =>
    start.publish({
      request: { url, socket: { localPort: port, localAddress: address } },
      response: {},
    });
  try {
    publish(12346);
    publish(12345, "::1");
    publish(12345, "127.0.0.1", "/synthetic-secret");
    assert.equal(timing.snapshot().servers.length, 0);
    for (let i = 0; i < 513; i++) publish();
    await timing.observeOwner(async () => true);
    const result = timing.snapshot();
    assert.equal(result.servers.length, 512);
    assert.equal(result.dropped, 1);
    assert.equal(result.owners[0]?.serverOrdinal, null);
  } finally {
    timing.dispose();
  }
  const before = timing.snapshot();
  publish();
  assert.deepEqual(timing.snapshot(), before);
});

/**
 * headers未観測Timeoutを欠測のまま計測して解除する。
 * @trace ERB-IT-021
 * @stimulus 応答しない合成Serverへの一GET。
 * @oracle 15秒の元失敗、headers／finish欠測、Owner開始なしを維持する。
 * @cleanup 子終了後に診断購読とServer／Socketを閉じる。
 */
test("計測付きHTTPも15秒失敗を成功へ変換しない", async () => {
  const timing = createReadonlyVerificationTiming();
  const server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}`;
    timing.bind(url);
    timing.setStage("observe");
    await assert.rejects(
      requestInChild(
        url,
        "/api/workbench-view?route=%2F",
        undefined,
        timing.client,
      ),
      (error) => {
        const failure = projectVerificationTransportFailure(error);
        assert.equal(failure?.failureClass, "headers_unobserved");
        assert.equal(failure?.timedOut, true);
        return true;
      },
    );
    const result = timing.snapshot();
    assert.equal(result.clients.length, 1);
    assert.equal(result.clients[0]?.headersAt, null);
    assert.equal(result.servers[0]?.finishedAt, null);
    assert.equal(result.owners.length, 0);
  } finally {
    timing.dispose();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  assert.equal(timing.snapshot().subscriptionsClosed, true);
});
