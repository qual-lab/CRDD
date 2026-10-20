/**
 * Project Context本文とManifest Identityの既存整合条件を検査する。
 *
 * @responsibility 固定見出し・Identity・可視Checklistの不一致判定を所有する。
 * @trace ARCH-000005
 */
/**
 * 五場面・Identity・可視Checklistの不一致を判定する。
 *
 * @responsibility 既存の本文条件だけを判定し、不一致をtrueで返す。
 * @trace ARCH-000005
 * @input content: 読取り済みのProject Context本文。追加引数は明示された比較対象。
 * @returns 不一致ならtrue、一致ならfalse。
 * @precondition 呼出し元が対象の選択・読取りを完了している。
 * @postcondition 元の条件と短絡順を保持して結果を返す。
 * @effect N/A: 文字列と明示入力だけを扱う。
 * @failure 入力契約外のManifestへのアクセス失敗は呼出し元へ伝播する。
 * @invariant 検査対象や表記の受理集合を拡張しない。
 * @boundary N/A: Process内の純粋検査でありRootやFilesystemを観測しない。
 * @security 存在しないRepositoryやAuthorityを推測しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理。
 */
export function isProjectContextProjectionInvalid(
  content: string,
  isTemplate: boolean,
): boolean {
  const headings = [
    "## 1. 今どうなっているか",
    "## 2. 何が危ない、または止まっているか",
    "## 3. 今、人間が決めることは何か",
    "## 4. なぜこの状態・判断になったか",
    "## 5. 次に何をすべきか",
    "## Checklist",
  ];
  const checklistItems = [
    "Project ID、Repository IDおよびRepository Roleを評価した。",
    "三つのIdentityがRepository Manifestと一致している。",
    "五場面を省略せず、結論を先に示した。",
    "現在事実と共有分析を区別した。",
    "正本が存在する内容をOwner Relationへ接続した。",
    "Project Context固有の安定IDを追加していない。",
    "項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。",
    "確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。",
    "Owner Artifactとの競合時はProject Contextを現在値として使わない。",
    "保存済みの次候補と対話時の追加提案を区別できる。",
    "Gateを閉じる前に再投影要否を評価する。",
  ];

  const lines = content.split(/\r?\n/u);
  const identityLabels = ["Project ID", "Repository ID", "Repository Role"];
  const isIdentityInvalid = identityLabels.some((label) => {
    const matches = lines.filter((line) => line.startsWith(`${label}: `));
    return (
      matches.length !== 1 ||
      (matches[0] as string).slice(label.length + 2).trim() === ""
    );
  });
  const headingPositions = headings.map((heading) => lines.indexOf(heading));
  const isHeadingOrderInvalid =
    headingPositions.some((position) => position < 0) ||
    headingPositions.some(
      (position, index) =>
        index > 0 && position <= (headingPositions[index - 1] as number),
    ) ||
    headings.some(
      (heading) => lines.filter((line) => line === heading).length !== 1,
    );
  const isChecklistInvalid = checklistItems.some((item) => {
    const expected = isTemplate ? `- [ ] ${item}` : `- [x] ${item}`;
    return !lines.includes(expected);
  });

  return isIdentityInvalid || isHeadingOrderInvalid || isChecklistInvalid;
}

/**
 * 本文Identityとv2 Manifestの不一致を判定する。
 *
 * @responsibility 既存の本文条件だけを判定し、不一致をtrueで返す。
 * @trace ARCH-000005
 * @input content: 読取り済みのProject Context本文。追加引数は明示された比較対象。
 * @returns 不一致ならtrue、一致ならfalse。
 * @precondition 呼出し元が対象の選択・読取りを完了している。
 * @postcondition 元の条件と短絡順を保持して結果を返す。
 * @effect N/A: 文字列と明示入力だけを扱う。
 * @failure 入力契約外のManifestへのアクセス失敗は呼出し元へ伝播する。
 * @invariant 検査対象や表記の受理集合を拡張しない。
 * @boundary N/A: Process内の純粋検査でありRootやFilesystemを観測しない。
 * @security 存在しないRepositoryやAuthorityを推測しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理。
 */
export function isProjectContextManifestIdentityInvalid(
  content: string,
  manifest: Record<string, unknown>,
): boolean {
  const lines = content.split(/\r?\n/u);
  const identityLabels = ["Project ID", "Repository ID", "Repository Role"];
  const identityValues = new Map(
    identityLabels.map((label) => {
      const line = lines.find((candidate) =>
        candidate.startsWith(`${label}: `),
      );
      return [label, line?.match(/`([^`]+)`/u)?.[1] ?? ""];
    }),
  );
  const isManifestIdentityInvalid =
    manifest.schema !== "crdd/repository-manifest/v2" ||
    identityValues.get("Project ID") !== manifest.projectId ||
    identityValues.get("Repository ID") !== manifest.repositoryId ||
    identityValues.get("Repository Role") !== manifest.repositoryRole;

  return isManifestIdentityInvalid;
}
