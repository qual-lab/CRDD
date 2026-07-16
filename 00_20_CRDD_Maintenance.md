# CRDD Maintenance

Version: v0.2.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_01_CRDD_Principles.md](00_01_CRDD_Principles.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_34_Compatibility_Evolution.md](00_34_Compatibility_Evolution.md)
- [CHANGELOG.md](CHANGELOG.md)

---

# Purpose

本ドキュメントは、CRDD自身を維持・監査・変更するための最小運用を定義する。

CRDDは固定された文書セットではなく、プロダクト実践から学び、文書Driftを検出し、変更を破壊的に扱わずに進化するContext Repositoryである。

---

# 1. Feedback Loop

## 1. Purpose

本ドキュメントは、個別プロダクトの実践から得られた知見を、CRDDの一般原則へ昇格させるプロセスを定義する。

CRDDは`00_CRDD`を正本とし、各プロダクトはそれを実践する側である。しかし実践の中で、プロダクト固有の判断が実は他プロダクトにも通用する一般原則だった、という発見が起こる。この発見を`00_CRDD`側へ還元する経路を、本ドキュメントで定義する。

---

## 2. Basic Principle

```text
思想は00_CRDDへ。
実践はプロダクト側へ。
実践から生まれた一般的な知見は、再び00_CRDDへ。
```

CRDDは一方通行の思想供給ではない。プロダクト側の実践から`00_CRDD`へ知見が還元されることで、CRDD自体も成熟する。

---

## 3. Why This Loop Matters

プロダクト側のドキュメント（`02_UX`〜`99_Roadmap`）には、しばしば以下のような記述が生まれる。

```text
障害の事後分析から得られた、一般的に有効な実装チェックリスト
特定機能の設計判断だが、実は他の機能にも当てはまる原則
セキュリティ・Governanceに関する、プロダクト非依存の判断基準
```

これらをプロダクト固有のドキュメントに置いたままにすると、他プロダクト・将来のプロダクトが同じ発見を繰り返すことになる。CRDDでは、これを避けるためにFeedback Loopを明示的なプロセスとして扱う。

---

## 4. Promotion Flow

```text
プロダクト側の実践・判断
    ↓
一般化できるか検討（Generalization Check）
    ↓
00_CRDDへ昇格（プロダクト名・固有名詞を除去）
    ↓
プロダクト側は00_CRDDを参照する形に戻す
```

---

## 5. Generalization Check

プロダクト側の知見を`00_CRDD`へ昇格させてよいかは、以下を確認する。

### 昇格してよい例

```text
特定のプロダクト名・画面名・機能名を含まなくても意味が通じる
他のプロダクト・他のドメインに適用しても妥当性を失わない
「なぜそうすべきか」の理由が、そのプロダクト固有の事情に依存しない
```

### 昇格すべきでない例

```text
特定のプロダクトのドメイン知識に強く依存する（例: 特定業務フローの用語）
特定のUI実装パターンの説明に留まり、原則と呼べるほど一般化されていない
1回限りの個別判断で、再利用可能な原則になっていない
```

判断に迷う場合は、AIは昇格の草案（Draft）を作成し、人間が最終判断する。`00_14_AI_Change_Control.md`の「思想変更は人間承認が必要」という原則がここにも適用される。

昇格先が「CRDDでなければ成立しない中核規範（Core標準、00_10〜00_15番台）」か「推奨知見（Practice Guide、00_30番台）」かも、昇格時に判断する。Core標準は必須要件に近いものに限り、それ以外は基本的にPractice Guideとして扱う。

---

## 6. How to Promote

### Step 1: プロダクト名・固有名詞を除去する

昇格対象の記述から、プロダクト名・画面名・機能名などの固有名詞を除去し、一般的な語彙に置き換える。

### Step 2: 該当する00_CRDDドキュメントを探す

既存の`00_CRDD`ドキュメントに該当する節があれば追記し、無ければ新規ドキュメントの草案を作る。

### Step 3: Draftとして提示する

`00_15_Document.md`のAI Draft Ruleに従い、`Status: Draft` / `Owner: AI Draft`として提示する。

### Step 4: 人間が承認する

人間が内容を確認し、`Status: Approved`へ変更する。必要に応じて`95_Decisions`にDecision Logを残す（書式は[`00_12_Decision_Record.md`](00_12_Decision_Record.md)を参照）。

---

## 7. What Stays at the Product Level

すべての知見が`00_CRDD`へ昇格するわけではない。以下は、プロダクト側のドキュメントに留めるべきものである。

```text
特定のUI実装パターン（例: 特定画面の入力欄の挙動）
特定のドメインモデルに依存する判断
プロダクト固有の優先順位・Roadmap判断
```

`00_CRDD`を肥大化させないことも、CRDDの原則（`00_01_CRDD_Principles.md`の「Docs are not enough」）に含まれる。昇格は慎重に行う。

---

## 8. Minimum Rule

最低限、以下を守る。

```text
プロダクト側の知見を機械的に00_CRDDへコピーしない
固有名詞を除去してから昇格を検討する
昇格の最終判断は人間が行う
昇格しないと決めた知見は、プロダクト側のドキュメントに留め、無理に一般化しない
```

---

## 9. Final Principle

CRDDにおける思想は、`00_CRDD`から各プロダクトへ流れるだけでなく、各プロダクトでの実践から`00_CRDD`へ還流する。

この双方向の流れによって、CRDDは特定プロダクトの経験だけに閉じず、次のプロダクトへ知見を引き継ぐ一般理念であり続ける。


---

# 2. Repository Audit

## 1. Purpose

本ドキュメントは、Context Repositoryとドキュメントの実態とのズレ（Drift）を検出・修正するための監査原則を定義する。

Context Repositoryは一度整備すれば終わりではない。フォルダ構成の変更、ファイルのリネーム、機能の追加・削除のたびに、ドキュメント側が実態に追従できず取り残されることがある。本ドキュメントは、このズレを能動的に検出する仕組みを定める。

---

## 2. Basic Principle

```text
Driftは起きる前提で考える。
Driftは起きてから気づくのではなく、定期的に能動的に検出する。
```

`00_01_CRDD_Principles.md`は「文書放置」をアンチパターンとして挙げているが、それを防ぐ具体的な監査プロセスまでは定義していない。本ドキュメントはその実務的な補完である。

---

## 3. What Drift Looks Like

Driftには、主に以下のパターンがある。

```text
参照切れ: リネーム・削除されたファイルへのリンクが残っている
構成の陳腐化: フォルダ一覧・ファイル一覧の記載が実際のファイルと一致しない
責務の陳腐化: フォルダの説明文が、実際に置かれているドキュメントの内容と合わなくなっている
用語の陳腐化: 同じ概念に複数の用語が使われ始めている
Header情報の陳腐化: Last Updatedが古いまま、Statusが実態と合っていない
```

### Bad

```text
フォルダをリネームした際、リンクを一括置換するスクリプトを実行して終わりにする。
実行結果を確認せず、次の作業に進む。
```

### Good

```text
フォルダをリネームした際、一括置換の実行後に「旧名称の残存」「意図しない二重置換」の両方を
別々に検索して確認する。想定外の一致があれば、原因を特定してから次の作業に進む。
```

---

## 4. When to Audit

以下のタイミングで、Context Repository監査を行う。

```text
大規模なフォルダ・ファイル構成の変更後（必須）
新しいフォルダ・ドキュメント種別を追加した後（推奨）
定期的なタイミング（例: 四半期ごと、推奨）
重要なリリースの前（推奨）
```

---

## 5. Audit Method

### Step 1: 参照切れの検出

旧名称・旧パスの文字列が、変更後もリポジトリ内に残っていないか全文検索する。

### Step 2: 構成一覧の実態確認

各フォルダの実ファイル一覧と、README等に書かれた構成図を突き合わせ、両者が一致するか確認する。

### Step 3: サンプリングによるリンク検証

いくつかのMarkdownリンクを無作為に選び、実際にリンク先のファイルが存在するか確認する。

### Step 4: Header情報の確認

`Status`・`Last Updated`が、実際の内容・変更日と乖離していないか確認する。

これらはAIが機械的に実行できる。ただし、「これは意図した historical citation（歴史的参照）か、それとも修正すべき参照切れか」の判断は、文脈を読んで人間またはAIが個別に判断する必要がある。

---

## 6. Who Performs the Audit

```text
機械的な検出（grep、リンク存在確認等） → AIが実行してよい
検出結果が「修正すべきDrift」か「意図した記録」かの判断 → AIが提案し、人間が確認する
大規模な一括修正の実行 → 修正内容を人間が確認できる単位に分けて実行する
```

---

## 7. Minimum Rule

最低限、以下を守る。

```text
大規模な構成変更の後には、必ず参照切れの全文検索を行う
検出したズレは、修正するか意図的な記録として残すかを明示的に判断する
一括置換を行った場合は、実行後に想定外の副作用がないか確認する
```

---

## 8. Final Principle

Context Repositoryは、放っておけば必ず実態からズレていく。

CRDDでは、そのズレを「気づいたときに直す」のではなく、「変更のたびに確認する」習慣として組み込むことで、Context Repositoryを継続的に信頼できる状態に保つ。


---

# 3. CRDD Change and Versioning

## Purpose

本ドキュメントは、CRDD自身（`00_CRDD`配下の規範文書群）をどう変更し、どうVersionとして扱い、採用プロダクトへどう伝播させるかの最小ルールを定義する。

上記のFeedback LoopとRepository Auditの結果として発生するCRDD自身の変更を、破壊的に扱わないためのVersioningとChange Controlを扱う。

本書は、現時点では集合的なCRDD SemVerを要求しない。
V0段階の安定ルールとして、文書単位の`Version`、`Status`、`Last Updated`、`CHANGELOG`、Protected Area承認を正本とする。

---

## 1. Versioning Model

CRDDでは、現時点で以下をVersioningの正本とする。

```text
Document Version
Document Status
Last Updated
CHANGELOG
Git history
Decision Log（必要な場合）
```

各CRDD文書は、自身のHeaderに`Version`、`Status`、`Last Updated`を持たなければならない。

`00_CRDD`全体の集合的Versionは正本としない。個別文書Versionと`CHANGELOG.md`を変更履歴の正本とする。

---

## 2. Document Version

文書Versionは、その文書の内容構造・責務・規範強度の変化を表す。

```text
v0.x  初期整備・構造変更が残る段階
v1.x  外部採用者に対して互換性説明が必要な段階
```

現時点では、CRDD文書のVersionは厳密なSemVerではない。
ただし、以下の変更ではVersionを更新しなければならない。

```text
Core Concept、Authority、MUST / MUST NOTの追加・変更
Conformance条件の追加・変更
Protected AreaまたはAI Change Controlの変更
Repository構造、正本性、Trace、Decision Logの変更
Guided Skill RuntimeのInput / Output / Authority Boundaryの変更
```

Typo、表記揺れ、リンク修正、説明の明確化だけで意味が変わらない場合は、Versionを据え置いてよい。
ただし、`Last Updated`は変更してよい。

---

## 3. Status

CRDD文書のStatusは、[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)のLifecycle and Status Termsに従う。

特に、以下を混同してはならない。

```text
Stable ≠ Immutable
Experimental ≠ 不要
Implemented ≠ Verified
Reviewed ≠ Approved
```

`Status: Stable` は、その文書が現時点のCRDD運用に利用できることを示す。
将来変更されないことを意味しない。

---

## 4. Change Categories

CRDD自身の変更は、最低限以下に分類する。

| Category | Meaning | Required Handling |
|---|---|---|
| Editorial | Typo、表記揺れ、リンク、説明の明確化 | 通常Review |
| Clarification | 既存Ruleの意味を明確化するが責務は変えない | `CHANGELOG`記録を推奨 |
| Additive | 新しいConcept、Guide、Ruleを追加する | `CHANGELOG`記録、必要に応じてVersion更新 |
| Normative Change | MUST / MUST NOT、Authority、Conformanceを変える | Human approval、Version更新、`CHANGELOG`記録 |
| Breaking Change | 採用プロダクトの既存運用や準拠判定を変える | Human approval、Migration note、必要に応じてDecision Log |

Breaking Changeかどうか迷う場合は、Breaking Changeとして扱う。

---

## 5. Protected CRDD Changes

以下の変更は、必ず人間承認を必要とする。

```text
00_CRDDのCore標準（00_10〜00_19）を変更する
00_01_CRDD_Principles.mdを変更する
00_13_Human_AI_Responsibility.mdを変更する
00_14_AI_Change_Control.mdを変更する
Conformance条件を変更する
Decision、Authority、Risk Acceptanceの境界を変更する
```

AIは草案、差分整理、影響分析、修正案作成を行ってよい。
ただし、上記変更を人間承認なしに確定してはならない。

Protected Areaの編集方針は[`00_14_AI_Change_Control.md`](00_14_AI_Change_Control.md)を優先する。

---

## 6. CHANGELOG

`00_CRDD/CHANGELOG.md`は、CRDD自身の変更履歴の正本である。

以下は`CHANGELOG`へ記録しなければならない。

```text
新規文書の追加
文書名または責務の変更
Core Concept、Conformance、Authority、MUST / MUST NOTの変更
Statusの昇格または降格
Breaking ChangeまたはMigrationが必要な変更
```

Editorial changeは、まとめて記録してよい。

---

## 7. Migration and Adoption

CRDDを採用するプロダクトは、常に最新の`00_CRDD`へ即時追従する必要はない。

CRDD側にBreaking Changeが発生した場合、少なくとも以下を示すべきである。

```text
何が変わったか
なぜ変えたか
既存Repositoryへの影響
移行が必要な場合の手順
移行しない場合の既知Risk
```

---

## 8. Minimum Rule

最低限、以下を守る。

```text
各文書のVersion / Status / Last Updatedを維持する
意味のあるCRDD変更はCHANGELOGへ記録する
Core標準（00_10〜00_19）を変更する場合は人間承認を必要とする
Authority、Decision、Risk Acceptance、Conformance境界をAIが無断で変更しない
Breaking Changeの可能性がある場合は、影響とMigrationを明示する
```
