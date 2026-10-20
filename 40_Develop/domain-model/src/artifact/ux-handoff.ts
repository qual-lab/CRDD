/**
 * UX成果物の引渡し先と入口表の順序付き契約を検査する。
 *
 * @responsibility 読取り済み本文の引渡し表だけを判定し、対象選択と診断は所有しない。
 * @trace ARCH-000008
 */
import { omitMarkdownCommentsAndFencedCode } from "./markdown.ts";

/**
 * UX成果物の引渡し先が期待する四項目と順序まで一致するか返す。
 *
 * @responsibility 指定Section内の第一列を抽出して正式な引渡し列と比較する。
 * @trace ARCH-000008
 * @input source: 読取り済み本文。heading: 既存のSection見出し。
 * @returns 一致する場合だけtrue。
 * @precondition 呼出し元が対象成果物と見出しを選択している。
 * @postcondition 欠落・重複・順序違いをfalseで返す。
 * @effect N/A: 入力文字列と局所配列だけを扱う。
 * @failure 文字列操作の例外を伝播し、不足を補完しない。
 * @invariant 二段階または三段階の次見出しでSectionを終える既存条件を保つ。
 * @boundary N/A: 同一Process内の純粋な本文検査。
 * @security 結果を品質全体の成立や認可へ読み替えない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isUxHandoffTargetSetExact(
  source: string,
  heading: string,
): boolean {
  const expected = [
    "IA（直後工程への正式な引き渡し）",
    "Quality Analysis / UX（伴走）",
    "UI（後続Contract Relation）",
    "SPEC（後続Contract Relation）",
  ] as const;
  const visible = omitMarkdownCommentsAndFencedCode(source);
  const start = visible.indexOf(heading);
  if (start < 0) return false;
  const tail = visible.slice(start + heading.length);
  const boundary = tail.search(/^#{2,3} /mu);
  const section = boundary < 0 ? tail : tail.slice(0, boundary);
  const targets = section
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = line.match(/^\| (?<target>[^|]+) \|/u);
      const target = match?.groups?.target?.trim();
      return target && target !== "接続先" && target !== "引き渡し先"
        ? [target]
        : [];
    })
    .filter((target) => !/^-+$/u.test(target));
  return (
    targets.length === expected.length &&
    targets.every((target, index) => target === expected[index])
  );
}

/**
 * UX入口の引渡し表に正式な三ラベルが順序どおりあるか返す。
 *
 * @responsibility 引渡しに関係する行だけを抽出し、入口の三つの責務を比較する。
 * @trace ARCH-000008
 * @input source: 読取り済み入口本文。heading: 指定Section見出し。
 * @returns 関係するラベル列が一致する場合だけtrue。
 * @precondition 呼出し元がUX入口と見出しを選択している。
 * @postcondition 関係のない行を無視し、関係ラベルの不足・余剰・重複を拒否する。
 * @effect N/A: 入力文字列と局所配列だけを扱う。
 * @failure 文字列操作の例外を伝播し、不足を補完しない。
 * @invariant 二段階見出しでSectionを終え、三段階見出しでは終えない既存条件を保つ。
 * @boundary N/A: 同一Process内の純粋な本文検査。
 * @security 入口の表構造だけを検査し、人間の意味判断を代替しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isUxRootHandoffValid(source: string, heading: string): boolean {
  const visible = omitMarkdownCommentsAndFencedCode(source);
  const start = visible.indexOf(heading);
  if (start < 0) return false;
  const tail = visible.slice(start + heading.length);
  const boundary = tail.search(/^## /mu);
  const section = boundary < 0 ? tail : tail.slice(0, boundary);
  const labels = section.split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^\| (?<label>[^|]+) \|/u);
    const label = match?.groups?.label?.trim();
    return label && label !== "項目" && !/^-+$/u.test(label) ? [label] : [];
  });
  const requiredLabels = [
    "IAへの正式な引き渡し",
    "Quality Analysis / UXへの伴走入力",
    "UI／SPECが後続で保持するUX Contract",
  ];
  const handoffLabels = labels.filter((label) =>
    /(引き渡し|伴走入力|UX Contract|Handoff|直接接続|後続Relation)/u.test(
      label,
    ),
  );
  return (
    handoffLabels.length === requiredLabels.length &&
    handoffLabels.every((label, index) => label === requiredLabels[index])
  );
}
