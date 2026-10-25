/**
 * 親event loop停止の反証に独立した合成HTTP応答を提供する。
 * @trace ERB-IT-021
 * @level IT
 * @scope loopback固定経路のみ。AI・Docker・Repository操作なし。
 * @cleanup 親のclose要求でSocket・Server・IPCを終了する。
 */
import { createServer } from "node:http";

const server = createServer((request, response) => {
  if (request.url !== "/api/workbench-view?route=%2F") {
    response.writeHead(404).end();
    return;
  }
  response.end("synthetic");
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address === "object") process.send?.(address.port);
});
process.once("message", (message) => {
  if (message !== "close") throw Error("fixture_input_invalid");
  server.closeAllConnections();
  server.close(() => process.disconnect?.());
});
