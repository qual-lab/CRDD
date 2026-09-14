# CRDD／CROS Experience Map

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [UX](../22_UX.md)

本書は、利用者がどこから仕事を始め、何を理解・判断し、どこへ進むかをProduct横断の時間軸で示す。Repository構造や画面遷移ではなく、利用者の仕事とOutcomeを主語にする。

## 1. Product Experience Map

```text
                    仕事を始める       状態を理解する       判断する          継続する
────────────────────────────────────────────────────────────────────
Developer           Repository ─────→ Local Context ───→ 実装・技術判断 ──→ Repository作業
                                           │
                                           └─ 横断情報が必要 ─────────────┐
                                                                            ▼
Project Operator／PM  Project ─────────→ 状態＋不足＋根拠 ─→ 次のProject判断 ─→ Topic／CHG／実行
                                           │
                                           └─ 上位比較が必要 ─────────────┐
                                                                            ▼
Management          Portfolio ───────→ 重要差分＋Coverage ─→ 優先判断 ─────→ Project根拠確認

Runtime運用者         配布物・現在状態 ─→ 信頼条件＋停止理由 ─→ 導入／回復判断 ─→ 実行または安全停止

外部Context所有者     送信候補 ───────→ 送信先＋目的＋範囲 ─→ 許可／拒否 ─────→ 出所付き結果の採否
```

通常の開発はRepository単独で成立する。Project横断やPortfolio比較が必要になった時だけCROSへ進み、利用できないContextは推測で補わない。

## 2. 主要Journey

| Journey | Primary Persona | 起点 | 望むOutcome | 関係する主なREQ |
|---|---|---|---|---|
| Repositoryで日常作業を進める | Developer | 対象Repositoryで仕事を始める | 横断機能を強制されず、必要時だけCROSへ進める | `REQ-000006`、`REQ-000008`、`REQ-000010`、`REQ-000014`、`REQ-000034`、`REQ-000036` |
| Projectの現在地を判断する | Project Operator／PM | Project全体を確認する必要がある | 状態、欠測、競合、根拠、判断待ちを理解して次へ進める | `REQ-000003`、`REQ-000007`、`REQ-000009`、`REQ-000012`、`REQ-000020` |
| 複数Projectを比較する | Management | Portfolio上の注意対象を見つける | 許可範囲とCoverageを失わず、Projectの根拠へ戻れる | `REQ-000013` |
| 対話と構築を往復する | 依頼者、Chat Agent、Coding Agent | 合意した仕事を構築へ渡す | 会話全文を転記せず、同じTaskへ判断と結果が戻る | `REQ-000002`、`REQ-000017`、`REQ-000028`、`REQ-000029` |
| RemoteでContextと結果へ戻る | Remote利用者 | 別HostからProjectへ接続する | 現在のWorkspace範囲だけを使い、応答喪失後も同じRequestへ戻れる | `REQ-000011`、`REQ-000021` |
| Runtimeを導入・更新・回復する | Runtime導入・運用者 | 配布物を利用または停止後に再開する | Trust要素、現在状態、残存、再試行、回復を取り違えない | `REQ-000004`、`REQ-000005`、`REQ-000015`、`REQ-000016`、`REQ-000018`、`REQ-000022`、`REQ-000023`、`REQ-000025`、`REQ-000034` |
| 外部Contextを送受信する | 外部Contextの所有者 | 外部利用の候補が生じる | 許可範囲だけを送り、同じTaskへ出所付き結果を戻す | `REQ-000017`、`REQ-000024`、`REQ-000027` |
| 標準を変更・検証・公開する | CRDD作成者・保守者 | 課題または変更を受け取る | 意図、Consumer、検証、Evidence、公開状態を閉じる | `REQ-000001`、`REQ-000019`、`REQ-000026`、`REQ-000030`、`REQ-000031`、`REQ-000032`、`REQ-000033`、`REQ-000035` |

### Repositoryで日常作業を進める

```text
対象Repositoryを開く → 利用可能な正本・Toolを確認 → 作業・判断 → そのRepositoryで完了
                                      │
                                      └─ 横断Contextが本当に必要 → CROSへ移る
```

### Projectの現在地を判断する

```text
Projectを選ぶ → 状態＋不足＋根拠を確認 → 判断が必要な箇所を選ぶ → 正本または次の仕事へ
```

### 複数Projectを比較する

```text
Portfolioを見る → Coverage付きの差を比較 → 注意Projectを選ぶ → Projectの根拠へ戻る
```

### 対話と構築を往復する

```text
対話で目的・判断を固める → 構造化Contextを渡す → 構築する → 結果・不足・判断要求を同じTaskへ戻す
```

### RemoteでContextと結果へ戻る

```text
接続する → 現在のWorkspace範囲を確認 → 要求する → 応答喪失？
                                                   │
                                      Yes ─────────┘
                                       ↓
                              同じRequestの状態を再取得
```

### Runtimeを導入・更新・回復する

```text
配布物を選ぶ → Integrity・Publisher・Trust Policyを確認 → 導入／更新 → 停止？
                                                                   │
                                                     Yes ──────────┘
                                                      ↓
                                      残存とEffect Stateを確認して回復
```

### 外部Contextを送受信する

```text
送信候補 → 送信先・目的・分類・範囲を確認 → 許可範囲だけ送信 → 出所付き結果 → 採否判断
```

### 標準を変更・検証・公開する

```text
課題・要求 → 設計・変更 → Consumer閉包 → 段階検証 → 独立確認 → 署名・E2E → 公開
```

## 3. 体験をまたぐ分岐

```text
現在の入口で必要Contextが揃う？
        │
     ┌──┴──┐
    Yes    No
     │      │
     ▼      ▼
その場で継続  不足の種類を確認
              │
       ┌──────┼─────────┐
       ▼      ▼         ▼
   横断Source  Credential  未観測／競合
       │      │         │
       ▼      ▼         ▼
   CROSへ移る 再接続     推測せず判断待ち
```

横断移行、認証、再取得または回復は、失敗を隠すFallbackではない。利用者が不足の種類と次の行動を理解できる場合だけ選択肢として示す。

## 4. 現在未確認の体験

- Workbench、Chat Agent、CLIのどれが各Journeyで最も少ない再探索でOutcomeへ届くか。
- 複数RepositoryやRemote接続でも、物理構造を隠しつつ根拠へ戻れるか。
- Project、PortfolioおよびRuntime運用で必要な情報量と認知負荷の上限。
- Topic／Meetingの候補化が、転記漏れを減らしながら確認負担を増やしすぎないか。
