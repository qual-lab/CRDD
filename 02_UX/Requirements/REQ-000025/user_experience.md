# REQ-000025の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000025` Deployment Ownerが所有するTrust Policy
探索元: [EXP-000028](../../../01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md)

## 1. REQの一次分析

```text
Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
信頼するPublisherとLocal例外を自分で定める
```

この要求で解くのは機能の有無だけではない。Deployment Ownerが「OSS Forkや組織Buildも方針に従って利用できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない |
| UX Need | 信頼するPublisherとLocal例外を自分で定める |
| 対象範囲 | Deployment Owner、組織のRuntime管理者が、「Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない」状態から「公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Deployment Owner
        │
        │ wants to
        ▼
信頼するPublisherとLocal例外を自分で定める
        │
        │ so that
        ▼
OSS Forkや組織Buildも方針に従って利用できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| 利用場面 | Runtime Artifactを実行候補にする時 |
| Goal | 信頼するPublisherとLocal例外を自分で定める |
| Outcome | OSS Forkや組織Buildも方針に従って利用できる |
| REQ固有の差 | Artifact Integrityと利用者所有Trust Policyを照合することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Runtime導入・運用者が「信頼するPublisherとLocal例外を自分で定める」を判断する場面で、Artifact Integrityと利用者所有Trust Policyを照合することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない
        │
        │ Deployment Ownerが所有するTrust Policyが変える体験
        ▼
After
────────────────
- 公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できる
```

Deployment Ownerが所有するTrust Policyは、単に内部方式を成立させる要求ではない。「Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない」状態から、「公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Deployment Ownerが信頼するPublisherとLocal例外を自分で定めることで、OSS Forkや組織Buildも方針に従って利用できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000025
   │
   ├─ Same → UX-000045 Runtime Trust要素の個別理解
   └─ Same → UX-000046 Deployment Owner所有のTrust Policy
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Runtime Trust要素の個別理解 | `Same → UX-000045` | 利用者はともにRuntime導入・運用者。起点は「Runtime Trustの各要素を別々に評価する」と「信頼するPublisherとLocal例外を自分で定める」、失敗は「成果を失う失敗」と「成果を失う失敗」で異なるが、得る成果は「準拠、Integrity、Publisher、実行許可、公式表示を別々に判断できる」で共通する。 | 本要求側の起点とFailureを、同じ成果の追加成立条件として補う。 |
| Deployment Owner所有のTrust Policy | `Same → UX-000046` | 利用者はともにRuntime導入・運用者。起点は「Runtime Trustの各要素を別々に評価する」と「信頼するPublisherとLocal例外を自分で定める」、失敗は「成果を失う失敗」と「成果を失う失敗」で異なるが、得る成果は「公式版、Fork、組織版、Local開発版の信頼条件を環境所有者が選べる」で共通する。 | 本要求側の起点とFailureを、同じ成果の追加成立条件として補う。 |

Same／Newは技術用語の近さでは決めない。利用者、Goal、Outcome、重要場面およびFailureが同じかを比較し、この要求だけが補う条件を分けて記録する。

## 5. 重要な体験

### このREQのJourney

```text
Runtime Artifactを実行候補にする時
        ↓
Artifact Integrityと利用者所有Trust Policyを照合する
        │
        ├─ ★ Critical: Runtime Authorityを与える直前
        ├─ ⚠ Failure:  Qual-Lab署名だけを唯一の実行資格にする
        └─ ✓ Quality:  Publisher Trustと実行許可を利用環境が所有する
        ↓
OSS Forkや組織Buildも方針に従って利用できる
```

### このREQのService Blueprint

```text
利用者: Runtime導入・運用者
        │ Runtime Artifactを実行候補にする時
        ▼
提供System／AI
        ├─ 支援: 信頼するPublisherとLocal例外を自分で定める
        ├─ ★ 判断点: Runtime Authorityを与える直前
        ├─ ⚠ 防止: Qual-Lab署名だけを唯一の実行資格にする
        └─ ✓ 保証: Publisher Trustと実行許可を利用環境が所有する
        │
        ▼
利用者
        └─ OSS Forkや組織Buildも方針に従って利用できる
                │
                ▼
運用・確認者
        └─ 品質とOutcomeを反例で確認する
```

この図は、このREQで利用者、提供System／AI、運用・確認者の間に生じる受け渡しを示す。詳細な責任と越えてはならない境界は次表で固定する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Deployment Owner） | 信頼するPublisherとLocal例外を自分で定めるために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | Artifact Integrityと利用者所有Trust Policyを照合するための状態、根拠および選択肢を示す | Qual-Lab署名だけを唯一の実行資格にする状態を成功・完了として表示しない |
| 運用・確認者 | 「Publisher Trustと実行許可を利用環境が所有する」ことと、OSS Forkや組織Buildも方針に従って利用できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 補足する品質

- 結果または状態を最初に受け取る時: 既定拒否とLocal開発例外を区別する。（避ける失敗: Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない）
- 結果を判断または引き継ぐ時: Publisher変更を無言で受け入れない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 管理者権限とContent Accessを混ぜない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


## 6. 下流への引き渡し

```text
このREQで確定した利用者成果
        │
        ├─→ IA: 必要な情報・関係・見つけ方
        ├─→ UI: 誤認させない表示・操作意図
        ├─→ SPEC: 振る舞い・失敗・体験品質の条件
        └─→ Verification: 仮説を破る反例と観測
```

### 妥当性確認と未確認事項

| 確認する仮説 | 観測方法 | 現在未確認の範囲 |
|---|---|---|
| 公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できることで、Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えないという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Runtime導入・運用者が「信頼するPublisherとLocal例外を自分で定める」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはPublisher、Trust Policy、Key、Deploymentを分け、UI／SPECはPolicy変更と影響を提示する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「信頼するPublisherとLocal例外を自分で定める」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「OSS Forkや組織Buildも方針に従って利用できる」という成果を無断で弱めない。
