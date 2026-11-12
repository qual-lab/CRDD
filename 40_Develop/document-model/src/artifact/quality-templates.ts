/**
 * Qualityの検証結果・分析・統合ひな型の本文条件を所有する。
 * @responsibility 読取り済み本文の限定条件だけを検査し、Fileの探索・実在・表示は扱わない。
 * @trace ARCH-000008
 */
/**
 * 検証結果書式の十一の必須適用判断と表構造を検査する。
 * @responsibility 検証結果書式の十一の必須適用判断と表構造を検査する。
 * @trace ARCH-000008
 * @input verificationResultTemplate: 検証結果ひな型本文。
 * @returns 必須適用判断の見出し・表・十一項目が不足すればtrue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。Issueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isQualityVerificationResultTemplateInvalid(
  verificationResultTemplate: string,
): boolean {
  const requiredApplicabilityItems = [
    "安全上重要な層間搬送",
    "耐久状態のAuthority分類",
    "発行前失敗／発行後失敗／retry",
    "残存資源／Recovery",
    "根拠の主張軸（入口形態）",
    "根拠の主張軸（観測基盤）",
    "根拠の主張軸（成果物Identity）",
    "根拠の主張軸（lifecycle）",
    "性能試験（PT）",
    "負荷試験（LT）",
    "人間による判断",
  ];

  return (
    !verificationResultTemplate.includes("### 必須の適用判断") ||
    !verificationResultTemplate.includes(
      "| 評価対象 | 判定 | 内容／理由 | 根拠／再評価契機 |",
    ) ||
    requiredApplicabilityItems.some(
      (item) =>
        !verificationResultTemplate.includes(
          `| ${item} | Applicable／N/A／OPEN |`,
        ),
    )
  );
}
/**
 * Quality書式の情報源層・Definition／Detail統合条件を検査する。
 * @responsibility Quality書式の情報源層・Definition／Detail統合条件を検査する。
 * @trace ARCH-000008
 * @input source: コメント・Fence除去済みのQuality分析ひな型本文。
 * @returns 情報源層とDefinition／Detail対応の必須語彙が不足すればtrue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。Issueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isQualityAnalysisTemplateInvalid(source: string): boolean {
  return (
    !source.includes("Source Layer") ||
    !source.includes("Definition／Detail") ||
    !source.includes("導出元／Relation")
  );
}
/**
 * Quality書式の情報源層・Definition／Detail統合条件を検査する。
 * @responsibility Quality書式の情報源層・Definition／Detail統合条件を検査する。
 * @trace ARCH-000008
 * @input source: コメント・Fence除去済みのQuality統合ひな型本文。
 * @returns Definition／Detail入力統合・層・Same／New／Mergeの必須語彙が不足すればtrue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。Issueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isQualityIntegrationTemplateInvalid(source: string): boolean {
  return (
    !source.includes("## 3. Definition／Detail入力の統合") ||
    !source.includes("Source Layer") ||
    !source.includes("Same／New／Merge")
  );
}
