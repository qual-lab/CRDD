# REQ-000008の利用者体験分析

状態: Candidate
要求: `REQ-000008` CROSなしで成立するRepository作業
探索元: [Repository単独作業](../../../01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md)

## 1. なぜこの要求を体験として扱うのか

横断機能が便利でも、一つのRepositoryで完結する日常作業へServer、WorkspaceまたはFederationの理解を要求すると、基礎体験が悪化する。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| 横断機能の設定有無が作業開始を左右する | 対象Repositoryだけで開発を開始・完了できる |
| 別Repositoryの存在を意識してContextを選ぶ | 必要になった時だけProject横断入口へ進む |

## 3. UXへの処置

`UX-000001@1`「Repository単独利用」として独立させる。LocalとRemoteを同じ開始手順に統合せず、横断利用は追加能力として段階的に開示する。

## 4. 重要場面、失敗、品質期待

- CROS未設定でも通常のRepository作業が成立する。
- AIが同じProject IDの兄弟Repositoryを推測探索しない。
- 横断Contextが必要になった理由と切替後に増える範囲が分かる。
- Remote都合のCredentialやWorkspaceをLocal作業へ要求しない。

## 5. 下流への引き渡し

IAはLocal Sourceを既定とし、横断Sourceを別状態にする。ArchitectureはLocal経路をCROS Serverの可用性へ依存させず、回帰試験はCROSなしの開始と完了を守る。
