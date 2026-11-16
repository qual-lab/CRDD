/**
 * UXの引渡し表を内容と出典のモデルへ構築する。
 * @responsibility 二種類の実在表の境界・列・順序を保持し、観測や診断表示を所有しない。
 * @trace ARCH-000008
 */
import {
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentTableRow,
  DocumentText,
} from "../artifact/types.ts";

/**
 * 引渡しの記載・比較対象列と局所的な構造成立を保持する。
 * @responsibility 非対象のlabelも原文・出典とともに保持する。
 * @trace ARCH-000008
 * @invariant validは旧表構造だけの結果であり、品質Pass・引渡し済み・認可ではない。
 */
export type UxHandoffModel = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  kind: "contract" | "root";
  heading: string;
  section: DocumentText | null;
  tableRows: readonly DocumentTableRow[];
  entries: readonly Readonly<{ label: string; source: DocumentText }>[];
  comparisonLabels: readonly string[];
  expectedLabels: readonly string[];
  valid: boolean;
}>;

/**
 * 取得済みUX引渡し表の内容と旧構造条件を一回の捕捉から返す。
 * @responsibility contractのH2/H3境界とrootのH2境界・関連label選択を区別する。
 * @trace ARCH-000008
 * @input source: 原文と相対Path。heading: 旧indexOfの選択文字列。kind: 実在する二種類の表。
 * @returns 原文・出典・全label出現・比較対象と局所的なvalid。
 * @effect N/A: 取得済み値だけを扱う。
 * @failure 未知のkindと解析例外は拒否し、不足を補完しない。
 * @security validを工程の完成・品質・認可の証明にしない。
 */
export function parseUxHandoff(
  source: ArtifactSource,
  heading: string,
  kind: "contract" | "root",
): UxHandoffModel {
  if (kind !== "contract" && kind !== "root")
    throw new Error("unknown_ux_handoff_kind");
  const captured = { path: source.path, content: source.content };
  const visible = omitMarkdownCommentsAndFencedCode(captured.content);
  const start = visible.indexOf(heading);
  const tail = start < 0 ? "" : visible.slice(start + heading.length);
  const boundary = tail.search(kind === "contract" ? /^#{2,3} /mu : /^## /mu);
  const text = boundary < 0 ? tail : tail.slice(0, boundary);
  const line = visible.slice(0, start + heading.length).split("\n").length;
  const section =
    start < 0 ? null : { text, location: { path: captured.path, line } };
  const entries = text.split(/\r?\n/u).flatMap((text, index) => {
    const label = text.match(/^\| (?<label>[^|]+) \|/u)?.groups?.label?.trim();
    return label
      ? [
          {
            label,
            source: {
              text,
              location: { path: captured.path, line: line + index },
            },
          },
        ]
      : [];
  });
  const labels = entries
    .map((entry) => entry.label)
    .filter(
      (label) =>
        !/^-+$/u.test(label) &&
        (kind === "contract"
          ? label !== "接続先" && label !== "引き渡し先"
          : label !== "項目"),
    );
  const comparisonLabels =
    kind === "contract"
      ? labels
      : labels.filter((label) =>
          /(引き渡し|伴走入力|UX Contract|Handoff|直接接続|後続Relation)/u.test(
            label,
          ),
        );
  const expectedLabels =
    kind === "contract"
      ? [
          "IA（直後工程への正式な引き渡し）",
          "Quality Analysis / UX（伴走）",
          "UI（後続Contract Relation）",
          "SPEC（後続Contract Relation）",
        ]
      : [
          "IAへの正式な引き渡し",
          "Quality Analysis / UXへの伴走入力",
          "UI／SPECが後続で保持するUX Contract",
        ];
  return {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    kind,
    heading,
    section,
    tableRows: captureDocumentTableRows({
      path: captured.path,
      content: visible,
    }),
    entries,
    comparisonLabels,
    expectedLabels,
    valid:
      start >= 0 &&
      comparisonLabels.length === expectedLabels.length &&
      comparisonLabels.every((label, index) => label === expectedLabels[index]),
  };
}
