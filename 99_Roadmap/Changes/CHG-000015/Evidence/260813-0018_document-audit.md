# CHG-000015 Document Audit

- 対象Commit: `d03be5ba59634dd060562f090e4740daf79ca831`
- 対象Tree: `0780b43c090ba3f0ac3acc56d2cfe195ae84e9a5`
- Parent: `5be85702e9b443e941e010e209f621b293babe75`
- 結果: `Pass`
- Finding: `0`
- 確信度: `High`

## 確認者と能力根拠

文書監査基準に基づき、構造、主要ロケール、用語、状態、正本一意性、決定権限、直接伝播、履歴／現在境界および実装contractとの意味整合を独立確認した。旧固定版の合否は流用していない。

## 共通入力

- Coordinator tests: `216 / 216 Pass`
- Checker tests: `143 / 143 Pass`
- full checker: Error `0`／Warning `0`
- diff／worktree: clean

## 結果

`DOC-PROVISION-CORE-001`の解消を確認した。READMEとThreat Modelは、準備記録の`issuedAt < expiresAt`、最大180日の有効期間、および集約評価の`issuedAt <= evaluationTime < expiresAt`を同義に記載し、180日を鍵寿命、鍵切替期間または失効一覧の保持期間と区別する。失効一覧へ列挙された署名鍵は`revokedAt`の過去／現在／未来を問わず拒否し、予約失効として扱わない境界も現在契約と一致する。

CHGは5be固定版のSecurity Fail Major 4件、Document Conditional Minor 1件、Gap Passを個別保持し、集合を`Invalidated`／現在判定不使用、処置を`Applied`／`Self-checked`かつ再監査前未`Resolved`として記録する。exact Schema、domain、key ID、aggregate、12 blocker／6 run根拠、Authority／Capability／Gate／Release境界に回帰はない。新規候補4分類はすべて`0`である。

## 水平探索・Sampling・未評価

親差分5ファイルを全数確認し、README、Threat Model、CHG、pure Core、専用試験およびdomain参照を水平探索した。実鍵、同梱Trust、rollback、Filesystem、resolver、Lifecycle、Authority、Capability、Provider／OperationおよびRelease判断は未実装または未評価である。
