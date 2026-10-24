/**
 * 検証ToolのHTTP一要求だけを親とは別のevent loopで処理する。
 * @packageDocumentation
 * @responsibility 固定loopback要求、既存15秒期限、有限結果搬送と自然終了。
 * @trace ERB-IT-021
 * @boundary stdinの用途限定actionToken/Formと公開HTTP。Task Ownerは親に残す。
 * @security Provider資格・Root Capability・環境・再送・redirect・子孫生成を持たない。
 */
import fs from "node:fs";
import { parseUnambiguousJsonDocument } from "../../ai-adapter/src/index.ts";
import {
  requestBounded,
  projectVerificationTransportFailure,
} from "./ai-verification-http.ts";

let startedAt = Date.now();
let headersAt: number | null = null;
try {
  const bytes = fs.readFileSync(0);
  if (bytes.length > 256 * 1024) throw Error("input_invalid");
  const input = parseUnambiguousJsonDocument(bytes.toString("utf8"));
  if (!input || typeof input !== "object") throw Error("input_invalid");
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).sort().join(",") !== "baseUrl,form,route" ||
    typeof value.baseUrl !== "string" ||
    typeof value.route !== "string" ||
    (value.form !== null && typeof value.form !== "string")
  )
    throw Error("input_invalid");
  const url = new URL(value.baseUrl);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    ![
      "/api/workbench-view?route=%2F",
      "/ai-request/action",
      "/workspace/action",
    ].includes(value.route)
  )
    throw Error("input_invalid");
  const response = await requestBounded(
    value.baseUrl,
    value.route,
    value.form === null ? undefined : new URLSearchParams(value.form),
    (phase, at) => {
      if (phase === "start") startedAt = at;
      else headersAt = at;
    },
  );
  process.stdout.write(
    JSON.stringify({
      version: 1,
      ...response,
      failure: null,
      timing: { startedAt, headersAt, completedAt: Date.now() },
    }),
  );
} catch (error) {
  const failure = projectVerificationTransportFailure(error);
  process.stdout.write(
    JSON.stringify({
      version: 1,
      status: null,
      location: null,
      body: null,
      failure,
      timing: { startedAt, headersAt, completedAt: Date.now() },
    }),
  );
  process.exitCode = failure ? 2 : 1;
}
