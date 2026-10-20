/**
 * 許可済みPortfolioの表示ページを構成する。
 *
 * @packageDocumentation
 * @responsibility Project検索と表示状態の絞込み、条件に結合した継続Cursorと20件上限を所有する。
 * @trace ARCH-000012
 * @boundary 認可済みDomain投影とWorkbench表示ページ。
 * @effect N/A: 入力投影から不変の表示値を生成するだけ。
 * @security 認可集合を拡張せず、未構成と正常空、不正Cursorを区別する。
 */
import type { PortfolioProjection } from "../../../../domain-model/src/index.ts";

/**
 * Portfolio継続位置を同じ検索・状態条件へ結合する。
 * @responsibility 検索条件と最後のProject IDの組を保持する。
 * @trace ARCH-000012
 * @shape 検索文字・状態・最後のProject IDの三要素。
 * @invariant Cursorだけで認可集合や観測範囲を拡張しない。
 * @boundary 要求QueryとPortfolio表示ページ。
 * @security 非Authorityの継続位置であり、Rootや資格を含めない。
 * @compatibility 既存base64url Cursorの意味と形状を維持する。
 */
type PortfolioCursor = readonly [string, string, string];

/**
 * 許可済みPortfolioを同じ検索条件の20件へ閉じる。
 * @responsibility 検索・状態条件と継続位置を相関し、未知Cursorを先頭ページへ補完しない。
 * @trace ARCH-000012
 * @input 認可済みPortfolioまたは未構成と、検索文字・状態・Cursor。
 * @returns 有界Portfolio、次Cursor、不正Cursorの明示状態。
 * @precondition 入力Portfolioの認可と観測は呼出し側Ownerが完了している。
 * @postcondition 表示件数は20以下で、次Cursorは同じ検索・状態条件へ結合する。
 * @effect N/A: 同期の絞込みと不変値生成。
 * @failure 不正CursorはcursorInvalidと空の当該ページとして返し、正常ページへ丸めない。
 * @invariant Source・不完全性を維持し、未構成を空Portfolioへ変換しない。
 * @boundary Domain投影と表示用ページ。
 * @security Cursorは表示継続位置であり、Repository認可や物理Rootを表さない。
 * @concurrency N/A: 当該要求の投影だけを同期処理する。
 */
export function createPortfolioPage(
  portfolio: PortfolioProjection | undefined,
  query: Readonly<{ query: string; state: string; cursor: string }>,
): Readonly<{
  portfolio: PortfolioProjection | null;
  nextCursor: string | null;
  cursorInvalid: boolean;
}> {
  if (portfolio === undefined)
    return Object.freeze({
      portfolio: null,
      nextCursor: null,
      cursorInvalid: false,
    });
  const normalizedQuery = query.query.toLocaleLowerCase("ja-JP");
  const filtered = portfolio.projects.filter(
    (project) =>
      (normalizedQuery.length === 0 ||
        project.projectId
          .toLocaleLowerCase("ja-JP")
          .includes(normalizedQuery)) &&
      (query.state.length === 0 || project.state === query.state),
  );
  let cursor: PortfolioCursor | null = null;
  let cursorInvalid = false;
  if (query.cursor.length > 0) {
    try {
      const value: unknown = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      );
      if (
        !Array.isArray(value) ||
        value.length !== 3 ||
        !value.every((entry) => typeof entry === "string")
      )
        cursorInvalid = true;
      else {
        const decoded = value as string[];
        if (
          decoded[0] !== query.query ||
          decoded[1] !== query.state ||
          decoded[2] === undefined ||
          decoded[2].length === 0
        )
          cursorInvalid = true;
        else cursor = Object.freeze(decoded) as PortfolioCursor;
      }
    } catch {
      cursorInvalid = true;
    }
  }
  const start =
    cursor === null
      ? 0
      : filtered.findIndex((project) => project.projectId === cursor?.[2]) + 1;
  if (cursor !== null && start === 0) cursorInvalid = true;
  const projects = cursorInvalid ? [] : filtered.slice(start, start + 20);
  const last = projects.at(-1);
  const nextCursor =
    !cursorInvalid &&
    last !== undefined &&
    start + projects.length < filtered.length
      ? Buffer.from(
          JSON.stringify([query.query, query.state, last.projectId]),
          "utf8",
        ).toString("base64url")
      : null;
  return Object.freeze({
    portfolio: Object.freeze({
      ...portfolio,
      projects: Object.freeze(projects),
    }),
    nextCursor,
    cursorInvalid,
  });
}
