/**
 * 検証ToolのHTTP一要求だけを親とは別のevent loopで処理する。
 * @packageDocumentation
 * @responsibility 固定loopback要求、Workspace操作60秒・他15秒の期限、有限結果搬送と自然終了。
 * @trace ERB-IT-021
 * @boundary 一件のIPC入力に限定したactionToken/Formと公開HTTP。Task Ownerは親に残す。
 * @security Provider資格・Root Capability・環境・再送・redirect・子孫生成を持たない。
 */
import { parseUnambiguousJsonDocument } from "../../ai-adapter/src/index.ts";
import {
  projectVerificationTransportFailure,
  requestBounded,
} from "./ai-verification-http.ts";

let startedAt = Date.now();
let headersAt: number | null = null;
try {
  const message = await new Promise<unknown>((resolve, reject) => {
    if (!process.connected || !process.send) {
      reject(Error("input_invalid"));
      return;
    }
    const disconnected = () => {
      process.off("message", receive);
      reject(Error("input_invalid"));
    };
    const receive = (value: unknown) => {
      process.off("disconnect", disconnected);
      try {
        // 一件受領後は、型・JSON拒否やHTTP失敗でもchannelを残さない。
        if (process.connected) process.disconnect();
        resolve(value);
      } catch {
        reject(Error("input_invalid"));
      }
    };
    process.once("disconnect", disconnected);
    process.once("message", receive);
  });
  if (typeof message !== "string") throw Error("input_invalid");
  const bytes = Buffer.from(message, "utf8");
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
