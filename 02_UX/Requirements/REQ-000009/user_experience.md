# REQ-000009の利用者体験分析

状態: Candidate
要求: `REQ-000009` Project・Repository・Root Identity分離
探索元: [Repository横断Project Context](../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md)

## 1. なぜこの要求を体験として扱うのか

一つのProjectが複数Repositoryに分かれても、利用者は物理配置から案件全体を再構成したくない。一方、異なるRepositoryやRootを同一視すると、根拠と操作対象を取り違える。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Repository名や配置から論理Projectを推測する | 一つのProjectとして見ながら、必要時に各Sourceへ辿る |
| 横断結果の操作対象が曖昧になる | Project、Repository、検証済みRootを区別して確認できる |

## 3. UXへの処置

`UX-000002@1`「根拠付きProject View」に統合する。Identity分離自体を利用者へ常時露出せず、出典確認、競合、診断または操作時に段階表示する。

## 4. 重要場面、失敗、品質期待

- 同じProject IDを持つRepositoryを一つのViewで理解できる。
- 名前の一致だけでRepositoryやRootを同一とみなさない。
- 変更操作前には対象RepositoryとAuthorityを確認できる。
- 利用できないRepositoryの内容を推測で補完しない。

## 5. 下流への引き渡し

IAはProject、Repository、RootおよびBindingを別Entityとして関連付ける。UIは通常表示とSource詳細を分け、Architectureは検証済みIdentityを公開結果まで保持する。
