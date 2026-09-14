# REQ-000013の利用者体験分析

状態: Candidate
要求: `REQ-000013` 根拠と不完全性を保つPortfolio
探索元: [Portfolio可視性](../../../01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md)

## 1. なぜこの要求を体験として扱うのか

複数Projectを比較する人には要約が必要だが、単一Scoreや色だけでは、なぜ注意が必要か、どの情報が欠けているかを判断できない。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Projectごとの資料を開いて比較表を手で作る | 許可されたProjectの要点を同じ観点で比較する |
| 集計結果を根拠不明のまま受け取る | 注意事項からProject、Source、観測時点へ段階的に辿る |

## 3. UXへの処置

`UX-000005@1`「最小Portfolio比較」とする。Portfolioを中央正本や新しいProject管理DBにせず、読取り専用Projectionとして扱う。

## 4. 重要場面、失敗、品質期待

- 非開示Projectの存在や件数を漏らさない。
- Projectごとの観測時点とCoverage差を比較時に保持する。
- 単一Scoreだけで健全性や優先順位を確定しない。
- 要約から判断根拠へ戻れる。

## 5. 下流への引き渡し

IAはProject比較軸、Source Coverage、Freshnessおよび根拠導線をモデル化する。Verificationは不完全なProject集合を完全Portfolioとして表示しないことを確認する。
