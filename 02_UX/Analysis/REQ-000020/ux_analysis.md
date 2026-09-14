# REQ-000020の利用者体験分析

成果物種別: UX Analysis

状態: UX再統合済み・独立再レビュー待ち
分析対象: [REQ-000020 欠測・競合を保つRepository Federation](../../../01_Discovery/Definitions/REQ-000020/requirement.md)

## 1. REQの一次分析

```text
Repositoryごとの状態を手で合成し、不足を見落とす／最新値らしい一つを選んでしまう
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
複数Repositoryを不完全性付きで一つのProjectとして見る
```

この要求で解くのは機能の有無だけではない。Project Operator／CROS利用者が「欠測・制限・競合を保ったまま横断判断できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Repositoryごとの状態を手で合成し、不足を見落とす／最新値らしい一つを選んでしまう |
| UX Need | 複数Repositoryを不完全性付きで一つのProjectとして見る |
| 対象範囲 | 複数Repositoryを横断するProject Operatorが、「Repositoryごとの状態を手で合成し、不足を見落とす」状態から「一つのProject Viewで、取得済み・欠測・競合を同時に確認する」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Project Operator／CROS利用者
        │
        │ wants to
        ▼
複数Repositoryを不完全性付きで一つのProjectとして見る
        │
        │ so that
        ▼
欠測・制限・競合を保ったまま横断判断できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| 利用場面 | Federated Projectを開く時 |
| Goal | 複数Repositoryを不完全性付きで一つのProjectとして見る |
| Outcome | 欠測・制限・競合を保ったまま横断判断できる |
| REQ固有の差 | 各RepositoryのIdentity・Source状態・Coverageを解決することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Project Operator／PMが「複数Repositoryを不完全性付きで一つのProjectとして見る」を判断する場面で、各RepositoryのIdentity・Source状態・Coverageを解決することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Repositoryごとの状態を手で合成し、不足を見落とす
- 最新値らしい一つを選んでしまう
        │
        │ 欠測・競合を保つRepository Federationが変える体験
        ▼
After
────────────────
- 一つのProject Viewで、取得済み・欠測・競合を同時に確認する
- Sourceごとの値と統合不能理由を理解する
```

複数Repositoryを束ねると、一部の取得失敗や値の競合を一つの正常値へ丸めたくなる。しかし利用者が必要なのは、見栄えのよい統合結果より、判断に使える正確な全体像である。

この変化で守るのは操作手順ではない。Project Operator／CROS利用者が複数Repositoryを不完全性付きで一つのProjectとして見ることで、欠測・制限・競合を保ったまま横断判断できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000020
   │
   ├─ Same → UX-000009 Projectの現在地を根拠と不完全性付きで理解する
   └─ Same → UX-000011 Project・Repository・Rootを区別して対象を選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Projectの現在地を根拠と不完全性付きで理解する | `Same → UX-000009` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: Project状況を確認する時<br>現在REQのTrigger: Federated Projectを開く時<br>Trigger差: 既存UXの「Project状況を確認する時」に対して現在REQは「Federated Projectを開く時」を具体化するが、同じ「Projectの現在地を根拠と不完全性付きで理解する」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 物理構成を意識せずProjectの現在地を理解し、欠測・制限・競合・古さとSourceへ戻れる<br>現在REQのOutcome: Federationの欠測・制限・競合を完全な状態へ畳まず、Sourceへ戻りながらProjectの現在地を理解できる<br>Outcome差: 現在REQは「Projectの現在地を根拠と不完全性付きで理解する」をこの要求の場面で成立させるOutcomeを具体化しており、REQ全体のPrimary Outcomeや別のUX成果へ置き換えていない<br>既存UXのFailure: 欠測・制限・競合・古さを完全なProject現在値として信じる<br>現在REQのFailure: 読めないRepositoryを推測補完し、Federated Projectを完全な状態として表示する<br>Failure差: 複数Repository化で欠測原因が増えるが、不完全な現在地を完全と誤認する失敗は同じである<br>同一Outcomeへ統合できる理由: FederationのCoverageは同じProject理解成果に必要なInformation／Quality条件である | 各RepositoryのIdentity・Source状態・Coverageを解決することが、この要求固有の成立条件になる |
| Project・Repository・Rootを区別して対象を選ぶ | `Same → UX-000011` | 既存UXのActor: Project Operator／PM<br>現在REQのActor: Project Operator／PM<br>Actor差: 既存UXと現在REQはいずれも「Project Operator／PM」であり、Actorの差はない<br>既存UXのTrigger: 参照または操作対象を選ぶ時<br>現在REQのTrigger: Federated Projectを開く時<br>Trigger差: 既存UXの「参照または操作対象を選ぶ時」に対して現在REQは「Federated Projectを開く時」を具体化するが、同じ「Project・Repository・Rootを区別して対象を選ぶ」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる<br>現在REQのOutcome: Federated Viewから参照・実行・回復の対象Repository／Rootを特定し、別対象へ作用せず選べる<br>Outcome差: 現在REQは「Project・Repository・Rootを区別して対象を選ぶ」をこの要求の場面で成立させるOutcomeを具体化しており、REQ全体のPrimary Outcomeや別のUX成果へ置き換えていない<br>既存UXのFailure: 論理Projectと作用対象Repository／Rootを混同し、別の場所へ参照・実行・回復を行う<br>現在REQのFailure: 複数Repositoryを束ねたViewから、どのRepositoryがSourceまたは作用対象か見失う<br>Failure差: Federation時の選択場面が加わるが、Projectと物理対象を取り違える失敗は同じである<br>同一Outcomeへ統合できる理由: Repository Bindingは同じ対象選択成果を横断構成で成立させる条件である | 各RepositoryのIdentity・Source状態・Coverageを解決することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Federated Projectを開く時
        ↓
各RepositoryのIdentity・Source状態・Coverageを解決する
        │
        ├─ ★ Critical: 複数Sourceを統合する場面
        ├─ ⚠ Failure:  読めないSourceを推測補完し完全表示する
        └─ ✓ Quality:  partial・restricted・stale・conflictingを保持する
        ↓
欠測・制限・競合を保ったまま横断判断できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Project Operator／PM]
        │ 利用者行動: Coverageを確認して横断判断または掘り下げを選ぶ
        ▼
[T: Federated Projectを開く時]
        │
        ├─ 時間差: Repositoryごとの観測後にFederationを合成するため、Source間に時点差がある
        ├─ 完了時: Repository別Source状態、Coverage、欠測・制限・競合
        └─ 失敗時: 読めないRepositoryと競合Propertyを各正本Ownerへ返す
                     │
                     ▼
             [R: Repositoryごとの正本Owner]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 部分Viewで判断するか、Source解決を依頼する

---------------- 可視境界 ----------------
                     │ 時間関係: Repositoryごとの観測後にFederationを合成するため、Source間に時点差がある
                     ▼
[S: 提供System]
        └─ 提供責務: 利用可能なSourceだけを統合し不完全性を保持する
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Projectの現在地を判断する](../../03_Experience_Map.md#projectの現在地を判断する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Project Operator／PM | Coverageを確認して横断判断または掘り下げを選ぶ | 読めない情報を推測で補わない |
| Repositoryごとの正本Owner | 担当Contextと現在の開示可否を提供する | 他Repositoryの状態を複製して正本化しない |
| 提供System | 利用可能なSourceだけを統合し不完全性を保持する | 非開示Sourceの存在や内容を漏らさない |

### 補足する品質

- 結果または状態を最初に受け取る時: Sourceごとの取得状態と観測時点を保持する。（避ける失敗: Repositoryごとの状態を手で合成し、不足を見落とす）
- 結果を判断または引き継ぐ時: `missing`と`restricted`と`unavailable`を混同しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 結果を判断または引き継ぐ時: 競合値をAIが勝手に一つへ統合しない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: Partialでも分かる範囲と判断できない範囲を示す。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 一つのProject Viewで、取得済み・欠測・競合を同時に確認する／Sourceごとの値と統合不能理由を理解することで、Repositoryごとの状態を手で合成し、不足を見落とすという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Project Operator／PMが「複数Repositoryを不完全性付きで一つのProjectとして見る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはProperty単位のProvenanceとCoverageを持つ。SPECは統合決定表とFreshness条件を定め、ArchitectureはSource Adapterの失敗をProject全体成功へ隠さない。 |

Discoveryへ戻す条件は、想定した利用者、問題または「複数Repositoryを不完全性付きで一つのProjectとして見る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「欠測・制限・競合を保ったまま横断判断できる」という成果を無断で弱めない。
