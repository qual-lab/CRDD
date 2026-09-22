/**
 * CROSの別Process耐久境界を実行する固定Test Worker。
 *
 * @packageDocumentation
 * @responsibility Source、DestinationおよびResult Returnを別Processから公開APIへ接続する。
 * @trace ERB-ST-013
 * @trace EST-ST-011
 * @boundary Test Parent→Worker Process→CROS Durable Store。
 * @effect Testが指定した一時Store内だけへ耐久Recordを作成する。
 * @security Test入力以外のPath、Credentialまたは環境値を読み取らない。
 */
import fs from "node:fs";
import path from "node:path";

import { createFilesystemStoreRoot } from "../../../crdd-domain-library/src/filesystem-store-root/index.ts";

import {
  closeDurableCrosSession,
  consumeDurableContextPackage,
  createContextPackage,
  createDurableFederatedContextPackage,
  createDurableCrosSession,
  createHandoff,
  resolveDurableRepository,
  resumeDurableHandoff,
  settleDurableDelegatedResult,
  writeDurableContextPackage,
  writeDurableHandoff,
  type ContextItem,
  type DelegatedResult,
  type DurableContextSourceRequest,
} from "../../src/index.ts";

const [command, first, second, third, fourth] = process.argv.slice(2);
const rootPath = first ? path.dirname(first) : "";
const storeRoot = rootPath ? createFilesystemStoreRoot(rootPath) : null;
if (!storeRoot) throw new Error("cros_durable_store_root_invalid");
const relative = (file: string) => path.relative(rootPath, file);

if (command === "write-handoff" && first) {
  const handoff = createHandoff(
    "handoff-system-1",
    "task-1",
    "PRJ-1",
    "revision-1",
    ["read"],
    { requirement: "REQ-1" },
  );
  writeDurableHandoff(storeRoot, relative(first), handoff);
  process.stdout.write(JSON.stringify(handoff));
} else if (command === "resume-handoff" && first && second && third) {
  const destination = JSON.parse(third) as Parameters<
    typeof resumeDurableHandoff
  >[3];
  process.stdout.write(
    JSON.stringify(
      resumeDurableHandoff(
        storeRoot,
        relative(first),
        relative(second),
        destination,
      ),
    ),
  );
} else if (command === "write-origin" && first && second) {
  fs.writeFileSync(first, `${second}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(JSON.stringify({ written: true }));
} else if (command === "settle-result" && first && second && third) {
  const result = JSON.parse(third) as DelegatedResult;
  process.stdout.write(
    JSON.stringify(
      settleDurableDelegatedResult(
        result,
        storeRoot,
        relative(first),
        relative(second),
      ),
    ),
  );
} else if (command === "create-session" && first && second && third) {
  if (!fourth)
    throw new Error("cros_durable_boundary_worker_arguments_invalid");
  process.stdout.write(
    JSON.stringify(
      createDurableCrosSession(
        storeRoot,
        relative(first),
        relative(second),
        third,
        "registry-1",
        fourth,
      ),
    ),
  );
} else if (command === "resolve-session" && first && second && third) {
  const [repositoryFile, repositoryId] = process.argv.slice(5);
  if (!repositoryFile || !repositoryId)
    throw new Error("cros_durable_boundary_worker_arguments_invalid");
  process.stdout.write(
    JSON.stringify(
      resolveDurableRepository(
        storeRoot,
        relative(first),
        repositoryId,
        relative(second),
        relative(repositoryFile),
      ),
    ),
  );
} else if (command === "close-session" && first) {
  process.stdout.write(
    JSON.stringify(closeDurableCrosSession(storeRoot, relative(first))),
  );
} else if (command === "write-context" && first && second && third) {
  const items = JSON.parse(fs.readFileSync(second, "utf8")) as ContextItem[];
  const contextPackage = createContextPackage(
    third,
    "review",
    ["development"],
    items,
  );
  writeDurableContextPackage(storeRoot, relative(first), contextPackage);
  process.stdout.write(JSON.stringify(contextPackage));
} else if (command === "write-context-federated" && first && second && third) {
  const configuration = JSON.parse(fs.readFileSync(second, "utf8")) as {
    sessionFile: string;
    exposureFile: string;
    allowedScopes: readonly string[];
    requests: readonly DurableContextSourceRequest[];
  };
  const contextPackage = createDurableFederatedContextPackage(
    storeRoot,
    relative(configuration.sessionFile),
    relative(configuration.exposureFile),
    third,
    "review",
    configuration.allowedScopes,
    configuration.requests.map((request) => ({
      ...request,
      repositoryRelativePath: relative(request.repositoryRelativePath),
    })),
  );
  writeDurableContextPackage(storeRoot, relative(first), contextPackage);
  process.stdout.write(JSON.stringify(contextPackage));
} else if (command === "consume-context" && first && second && third) {
  process.stdout.write(
    JSON.stringify(
      consumeDurableContextPackage(
        storeRoot,
        relative(first),
        relative(second),
        third,
      ),
    ),
  );
} else {
  throw new Error("cros_durable_boundary_worker_arguments_invalid");
}
