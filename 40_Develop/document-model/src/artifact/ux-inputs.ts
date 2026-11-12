/**
 * UX分析本文から正式入力の参照候補を解析する。
 *
 * @responsibility 参照形式・Discovery形状・限定Entity Decodeと候補重複の意味を所有する。
 * @trace ARCH-000008
 * @boundary 本文と参照組立て用Root文字列だけを受け、Filesystem・Git・認可は扱わない。
 * @effect N/A: HostのPath文字列規則だけを使い、外部I/O・共有状態変更を行わない。
 * @security 返却候補を存在・Root内・安全・認可済みとは扱わない。
 */
import path from "node:path";
import type { UxFormalInputTarget } from "./types.ts";
import { omitMarkdownFencedCode } from "./anchors.ts";
import { parseMarkdownLinkTargets } from "./links.ts";

/**
 * UX分析本文の正式入力参照候補を抽出する。
 *
 * @responsibility Markdown・HTML・裸Path・Entity候補の走査順と重複候補の異常flag合成を所有する。
 * @trace ARCH-000008
 * @input textはUX分析本文、repositoryRootは参照組立て用文字列。Hostのpath.join規則を利用する。
 * @returns UxFormalInputTarget[]を返す。
 * @precondition textとrepositoryRootは文字列であり、呼出し元が必要なRoot検証を別途行う。
 * @postcondition parseUxFormalInputTargetsの責務を完了した結果だけを返す。
 * @effect N/A: parseUxFormalInputTargetsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseUxFormalInputTargetsは独自の失敗分岐を所有しない。
 * @invariant parseUxFormalInputTargetsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: 本文と文字列Rootだけを扱い、Rootの検証やFilesystem読取りは行わない。
 * @security Root引数はCapabilityではなく、返却候補も存在・Root内・安全・認可済みを保証しない。
 * @concurrency N/A: parseUxFormalInputTargetsは共有非同期状態を持たない同期処理である。
 */
export function parseUxFormalInputTargets(
  text: string,
  repositoryRoot: string,
): UxFormalInputTarget[] {
  const content = omitMarkdownFencedCode(text)
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/\\\[[^\]\n]+\](?:\([^\n)]*\)|\[[^\]\n]*\])?/gu, "")
    .replace(
      /\\(?=(?:\.\.[\\/])+01_Discovery[\\/])(?:\.\.[\\/])+01_Discovery[\\/](?:Analysis|Definitions)[\\/][^\s"'<>`()#]+(?:#[^\s"'<>`()#]+)?/gu,
      "",
    );
  const targets = new Map<string, UxFormalInputTarget>();
  const addCandidate = (
    candidate: string,
    isDiscoveryShapeRequired = false,
    predecoded?: Readonly<{ value: string; invalid: boolean }>,
  ): void => {
    const decoded = predecoded ?? decodeHtmlEntitiesOnce(candidate);
    const isPathRelevant = isDiscoveryPathCandidate(candidate, decoded.value);
    if (isDiscoveryShapeRequired && !isPathRelevant) return;
    const current = targets.get(decoded.value);
    targets.set(decoded.value, {
      target: decoded.value,
      invalidEntity: Boolean(
        current?.invalidEntity || (decoded.invalid && isPathRelevant),
      ),
    });
  };
  for (const candidate of parseMarkdownLinkTargets(content))
    addCandidate(candidate);
  for (const match of content.matchAll(
    /<a\s+[^>]*\bhref\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<unquoted>[^\s"'=<>]+))[^>]*>/giu,
  ))
    for (const candidate of [
      match.groups?.double,
      match.groups?.single,
      match.groups?.unquoted,
    ]) {
      if (!candidate) continue;
      addCandidate(candidate);
    }
  for (const match of content.matchAll(
    /(?<![\\/\p{L}\p{N}_])(?<target>(?:(?:[A-Za-z]:[\\/]|\/)(?:[^\s"'<>`]+[\\/])*|(?:\.[\\/])?(?:\.\.[\\/])+|(?:\.[\\/]))?01_Discovery[\\/](?:Analysis|Definitions)[\\/][^\s"'<>`()#]+(?:#[^\s"'<>`()#]+)?)/gu,
  ))
    if (match.groups?.target)
      addCandidate(
        /^01_Discovery[\\/]/u.test(match.groups.target)
          ? path.join(repositoryRoot, match.groups.target)
          : match.groups.target,
      );
  for (const token of content.match(/[^\s"'<>`()]+/gu) ?? []) {
    const candidate = rawEntityPathCandidate(token);
    if (candidate) addCandidate(candidate.value, true, candidate);
  }
  return [...targets.values()];
}

/**
 * Entity表現を含む生のTokenからDiscovery参照候補を取り出す。
 *
 * @responsibility Escapeを私用markerで区別し、既存のEntity候補抽出と異常flagを保持する。
 * @trace ARCH-000008
 * @input token: string
 * @returns Readonly<{ value: string; invalid: boolean }> | nullを返す。
 * @precondition 「token: string」がrawEntityPathCandidateの入力契約を満たす。
 * @postcondition rawEntityPathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: rawEntityPathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rawEntityPathCandidateは独自の失敗分岐を所有しない。
 * @invariant rawEntityPathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: rawEntityPathCandidateはProcess内の同一Subsystemで完結する。
 * @security rawEntityPathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rawEntityPathCandidateは共有非同期状態を持たない同期処理である。
 */
function rawEntityPathCandidate(
  token: string,
): Readonly<{ value: string; invalid: boolean }> | null {
  const escapedPathMarker = "\u{e001}";
  const escapedNonPathMarker = "\u{e002}";
  let masked = token.replace(
    /\\&(?<name>#[xX]?[0-9A-Fa-f]*|[A-Za-z][A-Za-z0-9]*);?/gu,
    (_match, ...args: unknown[]) => {
      const groups = args.at(-1) as Readonly<{ name?: string }> | undefined;
      return /^(?:sol|bsol)$/iu.test(groups?.name ?? "")
        ? escapedPathMarker
        : escapedNonPathMarker;
    },
  );
  if (/^\\(?=[./\\0])/u.test(masked))
    masked = `${escapedPathMarker}${masked.slice(1)}`;
  const decoded = decodeHtmlEntitiesOnce(masked);

  for (const rootMatch of decoded.value.matchAll(/0(?:1|&)/gu)) {
    const rootIndex = rootMatch.index ?? 0;
    const precedingMarker = decoded.value.lastIndexOf(
      escapedPathMarker,
      rootIndex,
    );
    if (precedingMarker >= 0) {
      const between = decoded.value.slice(precedingMarker + 1, rootIndex);
      if (!/[^A-Za-z0-9._/\\-]/u.test(between)) continue;
    }
    const candidate = decoded.value.slice(rootIndex);
    if (
      decoded.invalid ||
      /[\u{e001}\u{e002}]/u.test(candidate) ||
      candidate !== token.slice(rootIndex)
    )
      return { value: candidate, invalid: decoded.invalid };
  }
  return null;
}

/**
 * Discovery Path 候補かを判定する。
 *
 * @responsibility Discovery Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input raw: string、decoded: string
 * @returns booleanを返す。
 * @precondition 「raw: string、decoded: string」がisDiscoveryPathCandidateの入力契約を満たす。
 * @postcondition isDiscoveryPathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isDiscoveryPathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDiscoveryPathCandidateは独自の失敗分岐を所有しない。
 * @invariant isDiscoveryPathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDiscoveryPathCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: isDiscoveryPathCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDiscoveryPathCandidateは共有非同期状態を持たない同期処理である。
 */
function isDiscoveryPathCandidate(raw: string, decoded: string): boolean {
  const entityLike = /&(?:#[xX]?[0-9A-Fa-f]*|[A-Za-z][A-Za-z0-9]*);?/gu;
  const entityMarker = "\u{e000}";
  const candidates = [raw, decoded];
  const directPathSkeleton =
    /(?:^|[\\/])01_Discovery[\\/](?:Analysis|Definitions)[\\/](?:REQ|EXP)-[0-9]/iu;
  const possibleEntityPathSkeleton =
    /(?:^|[\\/\u{e000}])0\u{e000}*1\u{e000}*(?:_|\u{e000})\u{e000}*D\u{e000}*i\u{e000}*s\u{e000}*c\u{e000}*o\u{e000}*v\u{e000}*e\u{e000}*r\u{e000}*y[\\/\u{e000}]+(?:A\u{e000}*n\u{e000}*a\u{e000}*l\u{e000}*y\u{e000}*s\u{e000}*i\u{e000}*s|D\u{e000}*e\u{e000}*f\u{e000}*i\u{e000}*n\u{e000}*i\u{e000}*t\u{e000}*i\u{e000}*o\u{e000}*n\u{e000}*s)[\\/\u{e000}]+(?:R\u{e000}*E\u{e000}*Q|E\u{e000}*X\u{e000}*P)\u{e000}*-\u{e000}*[0-9]/iu;
  return candidates.some(
    (candidate) =>
      directPathSkeleton.test(candidate) ||
      possibleEntityPathSkeleton.test(
        candidate.replace(entityLike, entityMarker),
      ),
  );
}

/**
 * 限定したHTML Entityを一度Decodeし、異常の有無を付けて返す。
 *
 * @responsibility 限定した名前・数値Entityを一度Decodeし、未知・不正・残存Entityの異常flagを返す。
 * @trace ARCH-000008
 * @input value: string
 * @returns Readonly<{ value: string; invalid: boolean }>を返す。
 * @precondition 「value: string」がdecodeHtmlEntitiesOnceの入力契約を満たす。
 * @postcondition decodeHtmlEntitiesOnceの責務を完了した結果だけを返す。
 * @effect N/A: decodeHtmlEntitiesOnceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不正数値や未知名は原文を保持してinvalid=trueを返す。例外による拒否は行わない。
 * @invariant decodeHtmlEntitiesOnceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeHtmlEntitiesOnceはProcess内の同一Subsystemで完結する。
 * @security N/A: decodeHtmlEntitiesOnceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeHtmlEntitiesOnceは共有非同期状態を持たない同期処理である。
 */
function decodeHtmlEntitiesOnce(
  value: string,
): Readonly<{ value: string; invalid: boolean }> {
  let isInvalid = false;
  const decoded = value.replace(
    /&(?:#(?<decimal>[0-9]+)|#x(?<hex>[0-9A-Fa-f]+)|(?<named>[A-Za-z][A-Za-z0-9]*));/gu,
    (match, ...args: unknown[]) => {
      const groups = args.at(-1) as
        | Readonly<{
            decimal?: string;
            hex?: string;
            named?: string;
          }>
        | undefined;
      const numeric = groups?.decimal ?? groups?.hex;
      if (numeric) {
        const point = Number.parseInt(numeric, groups?.decimal ? 10 : 16);
        if (
          !Number.isSafeInteger(point) ||
          point < 0 ||
          point > 0x10ffff ||
          (point >= 0xd800 && point <= 0xdfff)
        ) {
          isInvalid = true;
          return match;
        }
        return String.fromCodePoint(point);
      }
      const named = {
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
        sol: "/",
        bsol: "\\",
        lowbar: "_",
        period: ".",
      }[groups?.named ?? ""];
      if (named === undefined) {
        isInvalid = true;
        return match;
      }
      return named;
    },
  );
  if (/&(?:#[xX]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);?/u.test(decoded))
    isInvalid = true;
  return { value: decoded, invalid: isInvalid };
}
