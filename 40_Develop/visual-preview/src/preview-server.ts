/**
 * UI成果物をlocalhostへ読取り専用で配信する。
 *
 * @responsibility Repository内の許可Root、HTTP Method、通常FileおよびListener資源の境界を所有する。
 * @trace ARCH-000003
 */
import { createReadStream, lstatSync, realpathSync } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import path from "node:path";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/repository-location.ts";

const HOST = "127.0.0.1" as const;
const HEALTH_PATH = "/.well-known/crdd-visual-preview-health" as const;
const CONTRACT = "crdd/visual-preview/v1" as const;

const contentTypes = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".htm", "text/html; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

/**
 * Visual Previewの開始要求を定義する。
 *
 * @responsibility 作業Directory、公開対象のRepository相対Rootおよび任意Portを型境界として固定する。
 * @trace ARCH-000003
 * @shape workingDirectory、rootRelativePathおよびportで構成する。
 * @invariant hostは入力に含めず、実装が127.0.0.1へ固定する。
 * @boundary CLI・検証ConsumerからVisual Previewへの入力境界。
 * @security rootRelativePathをAuthorityとせず、Repository Rootとの包含を開始時に再検証する。
 * @compatibility port省略または0はOSが割り当てる一時Portを意味する。
 */
export type VisualPreviewRequest = Readonly<{
  workingDirectory: string;
  rootRelativePath: string;
  port?: number;
}>;

/**
 * Visual Previewの開始結果と終了操作を定義する。
 *
 * @responsibility 公開可能なlocalhost URLとListener終了操作だけをConsumerへ渡す。
 * @trace ARCH-000003
 * @shape contract、baseUrl、healthUrlおよびcloseで構成する。
 * @invariant 絶対Path、Repository Identityまたは外部Bind情報を含まない。
 * @boundary Visual PreviewからCLI・検証Consumerへの結果境界。
 * @security closeは当該Handleが所有するListenerとConnectionだけを終了する。
 * @compatibility contractはv1として固定する。
 */
export type VisualPreviewHandle = Readonly<{
  contract: typeof CONTRACT;
  baseUrl: string;
  healthUrl: string;
  close: () => Promise<void>;
}>;

/**
 * 二つのPathが同一かを判定する。
 *
 * @responsibility WindowsのCase差を含め、Filesystem Pathの同一性を判定する。
 * @trace ARCH-000003
 * @input leftとrightに比較するAbsolute Pathを受け取る。
 * @returns 同一ならtrue、それ以外はfalseを返す。
 * @precondition leftとrightは正規化可能な文字列である。
 * @postcondition Filesystemを変更せず判定結果だけを返す。
 * @effect N/A: 局所文字列だけを比較する。
 * @failure N/A: 独自の失敗分岐を所有しない。
 * @invariant OSのPath Case規則以外で一致条件を緩和しない。
 * @boundary N/A: Process内で完結する。
 * @security Path内容を外部へ公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

/**
 * Candidate PathがRoot内にあるかを判定する。
 *
 * @responsibility Root自身またはRoot配下だけを許可する包含判定を所有する。
 * @trace ARCH-000003
 * @input rootとcandidateにAbsolute Pathを受け取る。
 * @returns Root内ならtrue、それ以外はfalseを返す。
 * @precondition rootとcandidateは正規化可能なAbsolute Pathである。
 * @postcondition Filesystemを変更せず判定結果だけを返す。
 * @effect N/A: 局所文字列だけを比較する。
 * @failure N/A: 独自の失敗分岐を所有しない。
 * @invariant `..`またはPrefix一致だけでRoot外を許可しない。
 * @boundary Repository Rootまたは公開Rootの包含境界。
 * @security Case差を利用したWindows上の越境を許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function pathInside(root: string, candidate: string): boolean {
  if (samePath(root, candidate)) return true;
  const relative = path.relative(root, candidate);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/**
 * Responseへ共通Security Headerを付与する。
 *
 * @responsibility Preview ResponseのCache、Content解釈、埋込みおよび参照元送信を制限する。
 * @trace ARCH-000003
 * @input responseにNode HTTP Responseを受け取る。
 * @returns N/A: 戻り値を返さない。
 * @precondition responseは未送信のHeaderを受理できる。
 * @postcondition 固定された共通Headerが設定される。
 * @effect HTTP Response Headerを変更する。
 * @failure Header送信後に呼ばれた場合はNode HTTP境界の失敗を呼出し側へ返す。
 * @invariant CORS許可Headerを追加しない。
 * @boundary Node HTTP Response境界。
 * @security 外部読込み、Frame埋込み、MIME推測およびReferrer送信を制限する。
 * @concurrency 複数要求で共有可変状態を使用しない。
 */
function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

/**
 * 固定Statusと本文を返す。
 *
 * @responsibility 拒否・未検出・Health結果を共通Header付きで完了する。
 * @trace ARCH-000003
 * @input response、statusCode、bodyおよびcontentTypeを受け取る。
 * @returns N/A: Response完了だけを行う。
 * @precondition responseは未完了である。
 * @postcondition Headerと本文を送信してResponseを終了する。
 * @effect HTTP Responseを送信する。
 * @failure Socket失敗はNode HTTP境界が処理する。
 * @invariant Absolute Pathや内部Error内容を本文へ含めない。
 * @boundary Node HTTP Response境界。
 * @security 固定された公開結果だけを返す。
 * @concurrency 複数要求で共有可変状態を使用しない。
 */
function respond(
  response: ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
): void {
  setCommonHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", contentType);
  response.end(body);
}

/**
 * URL Pathを安全な相対Segmentへ変換する。
 *
 * @responsibility 不正Escape、Path越境、Backslash、制御文字およびAbsolute Pathを拒否する。
 * @trace ARCH-000003
 * @input requestUrlにHTTP Request Targetを受け取る。
 * @returns 安全なSegment配列、または拒否時にnullを返す。
 * @precondition requestUrlはNode HTTP Requestから得た文字列である。
 * @postcondition 許可時は`.`と`..`を含まないSegmentだけを返す。
 * @effect N/A: 入力文字列だけを解析する。
 * @failure 不正入力は例外化せずnullへ閉じる。
 * @invariant Percent Encodeを利用したSlash、BackslashまたはTraversalを許可しない。
 * @boundary HTTP Request TargetとFilesystem相対Pathの境界。
 * @security NUL、制御文字およびPath Separatorの曖昧性を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseSafeSegments(requestUrl: string): readonly string[] | null {
  try {
    const rawPath = requestUrl.split("?", 1)[0] ?? "";
    if (/%(?:2f|5c)/iu.test(rawPath)) return null;
    const decoded = decodeURIComponent(rawPath);
    if (
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(decoded) ||
      !decoded.startsWith("/")
    )
      return null;
    const segments = decoded.slice(1).split("/").filter(Boolean);
    if (
      segments.length === 0 ||
      segments.some(
        (segment) =>
          segment === "." || segment === ".." || path.isAbsolute(segment),
      )
    )
      return null;
    return segments;
  } catch {
    return null;
  }
}

/**
 * Rootから対象Fileまでの各SegmentがLinkでないことを確認する。
 *
 * @responsibility Preview対象Pathの途中にSymbolic LinkまたはReparse相当の差替えがないことを確認する。
 * @trace ARCH-000003
 * @input rootとsegmentsに公開Rootと相対Segmentを受け取る。
 * @returns 全SegmentがLinkでなければtrue、それ以外はfalseを返す。
 * @precondition rootは検証済みDirectory、segmentsは安全な相対Segmentである。
 * @postcondition Filesystemを変更せず現在のMetadata観測結果だけを返す。
 * @effect Filesystem Metadataを読取る。
 * @failure 観測不能はfalseへ閉じる。
 * @invariant LinkをRoot内へ戻す場合でも許可しない。
 * @boundary Filesystem Metadata境界。
 * @security Link経由のTOCTOUとRepository外参照を許可しない。
 * @concurrency 各要求でfreshにMetadataを観測する。
 */
async function segmentsAreRegularPath(
  root: string,
  segments: readonly string[],
): Promise<boolean> {
  let current = root;
  try {
    for (const segment of segments) {
      current = path.join(current, segment);
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Repository内のVisual Preview Rootを検証する。
 *
 * @responsibility Repository相対Rootを実Directoryへ解決し、越境・Link・非Directoryを拒否する。
 * @trace ARCH-000003
 * @input workingDirectoryとrootRelativePathを受け取る。
 * @returns 検証済み公開RootのAbsolute Pathを返す。
 * @precondition workingDirectoryはRepository内、rootRelativePathは利用者指定値である。
 * @postcondition Repository内のLinkでない実Directoryだけを返す。
 * @effect FilesystemとRepository Markerを読取る。
 * @failure 不正・観測不能・越境時は公開Listener開始前にErrorを投げる。
 * @invariant Root検証失敗時はNetwork Effect 0である。
 * @boundary Repository LocationとFilesystemの境界。
 * @security Absolute Path、Traversal、LinkおよびRepository外Rootを拒否する。
 * @concurrency N/A: Listener開始前の同期検証である。
 */
function resolvePreviewRoot(
  workingDirectory: string,
  rootRelativePath: string,
): string {
  if (
    rootRelativePath.length === 0 ||
    path.isAbsolute(rootRelativePath) ||
    /[\u0000-\u001f\u007f]/u.test(rootRelativePath)
  )
    throw new Error("visual_preview_root_invalid");
  const repositoryRoot =
    resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  const candidate = path.resolve(repositoryRoot, rootRelativePath);
  if (!pathInside(repositoryRoot, candidate))
    throw new Error("visual_preview_root_outside_repository");
  const metadata = lstatSync(candidate);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("visual_preview_root_invalid");
  const actual = realpathSync.native(candidate);
  if (!samePath(actual, candidate))
    throw new Error("visual_preview_root_link_forbidden");
  return actual;
}

/**
 * UI成果物のlocalhost Previewを開始する。
 *
 * @responsibility 検証済みRootだけを127.0.0.1へ公開し、要求処理とListener終了を所有する。
 * @trace ARCH-000003
 * @input requestに作業Directory、Repository相対Rootおよび任意Portを受け取る。
 * @returns 起動URLと終了操作を持つVisualPreviewHandleを返す。
 * @precondition rootRelativePathがRepository内のLinkでないDirectoryを指す。
 * @postcondition 成功時はlocalhost Listenerが一つ存在し、close後は所有Connectionを含めて終了する。
 * @effect localhost Listenerを開始し、GET／HEADごとに通常Fileを読取る。
 * @failure Root不正、Bind失敗または観測不能時はErrorを返し、未所有資源を残さない。
 * @invariant 外部Bind、書込み、Directory一覧、Root越境およびLink追跡を行わない。
 * @boundary Node HTTP ListenerとRepository Filesystemの直接境界。
 * @security hostは127.0.0.1固定であり、CORSやCredential受付を提供しない。
 * @concurrency 複数要求は独立処理し、closeが所有Connectionを終了する。
 */
export async function startVisualPreview(
  request: VisualPreviewRequest,
): Promise<VisualPreviewHandle> {
  const port = request.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("visual_preview_port_invalid");
  const previewRoot = resolvePreviewRoot(
    request.workingDirectory,
    request.rootRelativePath,
  );
  const connections = new Set<Socket>();
  const server = createServer(async (incoming, response) => {
    try {
      const method = incoming.method ?? "";
      if (method !== "GET" && method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        respond(response, 405, "method_not_allowed\n");
        return;
      }
      const requestUrl = incoming.url ?? "";
      if (requestUrl.split("?", 1)[0] === HEALTH_PATH) {
        const body = JSON.stringify({
          contract: CONTRACT,
          status: "ready",
          host: HOST,
          readOnly: true,
        });
        setCommonHeaders(response);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(method === "HEAD" ? undefined : body);
        return;
      }
      const segments = parseSafeSegments(requestUrl);
      if (
        segments === null ||
        !(await segmentsAreRegularPath(previewRoot, segments))
      ) {
        respond(response, 404, "not_found\n");
        return;
      }
      const candidate = path.join(previewRoot, ...segments);
      const actual = await realpath(candidate).catch(() => null);
      if (actual === null || !pathInside(previewRoot, actual)) {
        respond(response, 404, "not_found\n");
        return;
      }
      const metadata = await lstat(actual).catch(() => null);
      if (
        metadata === null ||
        !metadata.isFile() ||
        metadata.isSymbolicLink()
      ) {
        respond(response, 404, "not_found\n");
        return;
      }
      setCommonHeaders(response);
      response.statusCode = 200;
      response.setHeader(
        "Content-Type",
        contentTypes.get(path.extname(actual).toLocaleLowerCase("en-US")) ??
          "application/octet-stream",
      );
      response.setHeader("Content-Length", metadata.size);
      if (method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(actual)
        .on("error", () => {
          if (!response.headersSent) respond(response, 404, "not_found\n");
          else response.destroy();
        })
        .pipe(response);
    } catch {
      if (!response.headersSent) respond(response, 500, "preview_failed\n");
      else response.destroy();
    }
  });
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("visual_preview_address_unavailable");
  }
  const baseUrl = `http://${HOST}:${address.port}`;
  let closed = false;
  return Object.freeze({
    contract: CONTRACT,
    baseUrl,
    healthUrl: `${baseUrl}${HEALTH_PATH}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error === undefined ? resolve() : reject(error),
        );
        for (const connection of connections) connection.destroy();
      });
    },
  });
}
