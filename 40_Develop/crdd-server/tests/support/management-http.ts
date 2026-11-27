/**
 * 確定済み管理セッションを管理RESTへ接続するローカル試験用受付。
 * @trace EST-IT-010
 * @boundary 実HTTP・入力検査・取消と管理操作。OIDC自体の保証は別の結合試験で扱う。
 */
import { once } from "node:events";
import type {
  AccountAccessPrincipal,
  FilesystemStoreRoot,
} from "@qual-lab/crdd-access-management";
import type { createManagementSessionHandler } from "../../src/transport/api-server.ts";

export async function startManagementHttpFixture(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  observeBinding: () => ReturnType<
    Parameters<typeof createManagementSessionHandler>[5]
  >,
) {
  const { createManagementSessionHandler: createHandler } = await import(
    "../../src/transport/api-server.ts"
  );
  const { createApiServer } = await import("../../src/transport/api-http.ts");
  const transport = createApiServer();
  const { server } = transport;
  const cookie = "fixture-management=session";
  const formToken = "fixture-management-form";
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  const address = server.address();
  if (!address || typeof address === "string") {
    await transport.close();
    throw Error("fixture_management_address_unavailable");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const readSession = (request: {
    headers: { cookie?: string | undefined };
  }) => (request.headers.cookie === cookie ? principal : null);
  server.on(
    "request",
    transport.handleRequest(
      createHandler(
        new URL(baseUrl),
        root,
        (request) =>
          readSession(request) && {
            principal,
            formToken,
            readGitHost: () => undefined,
            readHostToken: () => null,
          },
        false,
        readSession,
        (request) =>
          readSession(request) ? observeBinding() : { status: "rejected" },
      ),
    ),
  );
  let closing: Promise<void> | undefined;
  return {
    baseUrl,
    cookie,
    formToken,
    close: () => (closing ??= transport.close()),
  };
}
