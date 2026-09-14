# REQ-000020の利用者体験分析

状態: UX意味再分析済み・独立レビュー待ち
要求: `REQ-000020` 欠測・競合を保つRepository Federation
探索元: [Repository横断Project Context](../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md)

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
| 根拠・確信度 | 探索元の課題と採用要求から導いた設計上の想定。個人属性、利用頻度および許容負担は未実測。 |

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

全36要求を横断比較し、この要求から生じる成果候補をCanonical UX成果へ接続した。同じIDへ接続する場合も、要求固有の成立条件を失わない。

| UX成果候補 | 処置・接続先 | 判断理由とこの要求が補う内容 |
|---|---|---|
| 根拠付きProject View | `Same → UX-000002` | `REQ-000007`と同じ「根拠付きProject View」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「欠測・競合を保つRepository Federation」はその成立条件を別の責務境界から補う。 |
| 未観測値の保持 | `Same → UX-000019` | `REQ-000004`と同じ「未観測値の保持」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「欠測・競合を保つRepository Federation」はその成立条件を別の責務境界から補う。 |
| Sourceと現行性への到達 | `Same → UX-000026` | `REQ-000007`と同じ「Sourceと現行性への到達」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「欠測・競合を保つRepository Federation」はその成立条件を別の責務境界から補う。 |
| 欠測・制限・競合の理解 | `Same → UX-000027` | `REQ-000007`と同じ「欠測・制限・競合の理解」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「欠測・競合を保つRepository Federation」はその成立条件を別の責務境界から補う。 |
| Project・Repository・Rootの対象確認 | `Same → UX-000029` | `REQ-000009`と同じ「Project・Repository・Rootの対象確認」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「欠測・競合を保つRepository Federation」はその成立条件を別の責務境界から補う。 |
| Context不足・競合時の非捏造 | `Same → UX-000043` | `REQ-000017`と同じ「Context不足・競合時の非捏造」を目指す。利用者が得る最終状態と主な失敗条件が同じであり、本要求「欠測・競合を保つRepository Federation」はその成立条件を別の責務境界から補う。 |

## 5. 重要な体験

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

### JourneyとSupporting Model

要求固有の区間は上のFlowが所有し、長い時間軸や複数主体との関係は次の既存成果物へ接続する。統合図をこの文書へ複製しない。

| Supporting Model | 処置 | 理由・参照先 |
|---|---|---|
| Experience Change | `作成` | 本文冒頭で、この要求が変える利用前後の仕事・認知・判断を示した。 |
| Experience Flow／Journey | `既存参照` | 本要求が関わる時間軸は[Project Operator／PMのProject Journey](../../03_Experience_Map.md#projectの現在地を判断する)を参照し、要求固有の区間は上表で示す。 |
| Service Blueprint | `既存参照` | 複数主体の協調が体験成立条件になるため、[共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)を参照し、本要求固有の責任境界を次節で示す。 |
| User／Task Flow／Storyboard | `非該当` | 具体的な操作、画面遷移または利用環境の描写はIA／UIで具体化し、この要求分析では先取りしない。 |

### 責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| 利用者（Project Operator／CROS利用者） | 複数Repositoryを不完全性付きで一つのProjectとして見るために、提示された状態と根拠から次の行動を判断する | 不足情報や内部状態を推測で補うことを要求されない |
| 提供System／AI | 各RepositoryのIdentity・Source状態・Coverageを解決するための状態、根拠および選択肢を示す | 読めないSourceを推測補完し完全表示する状態を成功・完了として表示しない |
| 運用・確認者 | 「partial・restricted・stale・conflictingを保持する」ことと、欠測・制限・競合を保ったまま横断判断できる状態へ到達できることを反証する | 未確認範囲や人間の判断を便宜的に上書きしない |

### 重要場面・失敗・品質期待の対応

| 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|
| 複数Sourceを統合する場面 | 読めないSourceを推測補完し完全表示する | partial・restricted・stale・conflictingを保持する |

要求から得た追加の品質期待は次のとおりである。主Flowの品質を置き換えず、下流で具体化する観測点として保持する。

| 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|
| 結果または状態を最初に受け取る時 | Repositoryごとの状態を手で合成し、不足を見落とす | Sourceごとの取得状態と観測時点を保持する。 |
| 結果を判断または引き継ぐ時 | 必要条件を満たしていないのに完了・正常と理解する | `missing`と`restricted`と`unavailable`を混同しない。 |
| 結果を判断または引き継ぐ時 | 必要条件を満たしていないのに完了・正常と理解する | 競合値をAIが勝手に一つへ統合しない。 |
| 失敗・不足から次の行動を選ぶ時 | 成立不能の理由や回復先が分からないまま作業が止まる | Partialでも分かる範囲と判断できない範囲を示す。 |

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
| 一つのProject Viewで、取得済み・欠測・競合を同時に確認する／Sourceごとの値と統合不能理由を理解することで、Repositoryごとの状態を手で合成し、不足を見落とすという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | 役割ごとの利用頻度、許容待ち時間・操作負担、用語理解および支援技術差 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| IA以降 | IAはProperty単位のProvenanceとCoverageを持つ。SPECは統合決定表とFreshness条件を定め、ArchitectureはSource Adapterの失敗をProject全体成功へ隠さない。 |

Discoveryへ戻す条件は、想定した利用者、問題または「複数Repositoryを不完全性付きで一つのProjectとして見る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「欠測・制限・競合を保ったまま横断判断できる」という成果を無断で弱めない。
