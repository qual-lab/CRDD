# CRDDスキル（Skill）

Version: v0.11.1
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-29
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [12_Change.md](12_Change.md)
- [16_Quality_Assurance.md](16_Quality_Assurance.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

> この文書で分かること（非規範の案内）
>
> - スキルが受け取る入力と返す出力
> - スキル実行中の質問、判断支援、状態管理
> - 中断・再開・完了をどう区別するか
> - スキル完了と工程承認を混同しない方法
> - 次の工程やエージェントへ何を引き渡すか

<a id="1-purpose-and-boundary"></a>

# 1. 目的と適用範囲（Purpose and Boundary）

本書は、CRDDスキルの共通定義と、スキルを開始、中断、再開、確認、保存、引き渡しまで一貫して実行するスキル実行環境の正本である。

スキルは専門活動と状態遷移を定義する。エージェントはスキルまたは限定作業を、明示されたコンテキスト、決定権限、操作境界で実行する主体である。エージェントの入力、出力、決定権限、アクセス権、委譲、レビューは[エージェント](10_Agent.md)を正本とする。

工程固有の入口、変換、必要な責務の網羅、出口、ゲート、監査、成果物は各工程文書を正本とし、本書で再定義しない。本書は全スキルに共通する次の責務だけを持つ。

```text
スキル定義契約
スキル実行の状態と再開可能性
共通実行状態遷移
ガイド付き対話
人間レビューと実行時引き渡し
ツール接続部とリスクに応じた実行規模
```

ガイド付きスキルは固定質問票ではない。既存コンテキストを読み、次の判断に必要な不足だけを確認し、回答を専門コンテキストへ変換し、人間が変換結果を確認できる状態で次の活動へ渡す。

---

# 2. スキル定義契約

各スキルは、工程正本を参照しながら、最低限次を定義する。スキル自体は決定権限を持たず、実行者と対象コンテキストの決定権限に従う。

```yaml
skill:
  id: skill.ui.contract
  purpose: UXとIAをUI契約へ変換する
  process_authority: 25_UI.md
  authority_boundary:
    source: 10_Agent.md
    may_propose:
      - UI契約
    must_escalate:
      - Behavior Rule or Feature Scope change
  entry_conditions:
    - target scope is explicit
    - required UX and IA context is identifiable
  input:
    required:
      - UX Outcome
      - IA Structure
      - Use Case
  responsibility_coverage:
    source: 25_UI.md#required-responsibility-coverage
  interaction:
    core_topics:
      - first_information
      - primary_action
      - feedback
    adaptive_topics:
      - permission
      - empty
      - conflict
  professional_knowledge:
    options:
      - existing pattern
      - new contract
    decision_criteria:
      - preserved intent
      - responsibility boundary
    common_failures:
      - missing error and recovery state
  output:
    - UI契約
    - Open Question
    - Trace
  exit_conditions:
    - required responsibility coverage is evaluated
    - result is reviewable
  stop_conditions:
    - IA responsibility missing
  human_confirmation:
    - preserved_intent
    - responsibility_boundary
    - coverage_state
  handoff:
    route_candidates:
      - type: Skill
        target: skill.spec.behavior
      - type: Prototype
        target: ui interaction validation
```

スキル定義は、開始条件、必要入力、質問または分析方針、専門知識、生成コンテキスト、停止、確認、終了、引き渡しを再現可能にする。工程契約を参照し、入口、網羅範囲、出口、ゲート、監査の内容を複製しない。

## 2.1. ガイド付きスキルと専門成果物

```text
ガイド付きスキル
= 既存コンテキストの読込、質問、変換、確認、経路選択を行う実行手順

専門成果物
= 専門コンテキストを保存、レビュー、継承する成果物
```

専門成果物は利用者へ空欄を埋めさせる質問票ではない。スキル、専門家、エージェント、既存成果物から更新する。成果物の共通項目、安定コンテキストID、根拠、判断、関係は[文書化](03_Documentation.md)を正本とし、本書で共通成果物ひな型を再定義しない。

## 2.2. 専門知識

専門知識を個人の暗黙知や見出しへ閉じず、スキル定義と工程固有の工程実行契約から次を取得可能にする。

```text
最初に確認すべき論点
必須入力
検討すべき選択肢
判断基準
共通の失敗
必須責務網羅範囲への参照
出口 / レビュー / 専門家上位判断への移送条件
```

スキルは専門家を不要にするものではない。定型作業を支援し、人間と専門家が重要判断、例外、品質、成立性へ集中するための接続部である。

---

# 3. スキル実行モデル

スキルの一回の実行を`Skill Run`として扱う。スキル実行は会話セッションと同一ではなく、一つの実行を複数セッションに分けても、一つのセッションで複数実行を実行してもよい。

`run_id`は実行を再開・識別するための運用上のIDであり、CRDD安定コンテキストIDではない。`RUN-*`等の新しい安定コンテキストID接頭辞を要求しない。

## 3.1. 実行状態・現在の手順・経路

実行の状態、現在の手順、次の経路、生成した成果物の状態を分離する。

| 実行状態 | 意味 |
|---|---|
| `NotStarted` | まだ開始していない |
| `InProgress` | 実行中 |
| `Paused` | 再開情報を残して安全に中断した |
| `Blocked` | 外部判断または不足コンテキストにより進めない |
| `Completed` | スキル定義の実行終了条件を満たした |
| `Failed` | 実行を試みたが契約された結果を生成できなかった |
| `Superseded` | 後続実行に置き換えられた |

現在の手順は4章の状態遷移上の現在地であり、実行状態ではない。経路は次に行う調査、判断、専門家レビュー、別スキル、工程ゲートのレビュー、一時停止、終了等であり、成果物の状態ではない。

機械可読な`current_step`は、`SelectSkill`、`Orient`、`LoadContext`、`ConfirmScope`、`AssessGap`、`Interact`、`Transform`、`DetectConflict`、`HumanReview`、`Register`、`DetermineRoute`、`CloseOrPause`を使用する。

機械可読な`route.type`は、`Continue`、`Research`、`Decision`、`ExpertReview`、`Skill`、`Prototype`、`GateReview`、`Pause`、`Close`を使用する。

`Completed`はスキル実行の終了だけを表し、生成した成果物の`Reviewed`や`Approved`、工程完了、判定承認、変更トレースの完了を意味しない。

## 3.2. 最小実行記録

```yaml
skill_run:
  run_id: skill-run-20260717-001
  skill: skill.ux.outcome
  run_owner: Product Design Lead
  executed_by: ui-agent-contract-123
  status: InProgress
  current_step: HumanReview
  scale: Standard
  update_strategy: Revise
  scope:
    change_trace: 90_Release/Changes/CHG-000004_Topic_Detail.md
    feature: Important Topic Review
  input_revision:
    - artifact: 01_Discovery/00_Product_Origin.md
      revision: 2
    - artifact: 01_Discovery/01_Product_Discovery.md
      anchor: decision-fragmentation
      revision: 3
  completed_topics:
    - target_user
    - before_state
    - desired_outcome
  open_topics:
    - success_signal
  produced:
    - id: UX-000004
      revision: rev-4
      artifact_status: Draft
  route:
    type: Continue
    target: Register
    owner: Product Design Lead
    required_input: []
  result_summary: UX Outcome draft is ready for registration
  propagation:
    required: false
    reason: no new approved meaning in this run
```

重要な実行では、次の主体を識別する。

- 継続、上位判断への移送、監査を担う実行の担当責任者
- 実行した人間、エージェント契約、またはシステム

安定コンテキストIDを付与するのは、[文書化](03_Documentation.md)の対象と割当基準を満たすREQ、UX、IA、UI、SPECだけである。

実行結果、未決事項、アーキテクチャ、根拠、判断、変更トレース、テスト等は、安定コンテキストIDを新設せず成果物参照で識別する。

## 3.3. 一時停止・失敗・再開

回答待ち、疲労、外部調査、ツール停止等で実行を中断できる。`Paused`、`Blocked`、`Failed`にする前に、対象リスクに応じて次を残す。

```yaml
resume:
  run_id: skill-run-20260717-001
  reason: external evidence pending
  input_revision:
    - id: UX-000004
      revision: rev-4
  completed:
    - target_user
    - current_problem
    - desired_outcome
  current_understanding: 利用者が重要相談を見逃す不安を減らす
  unresolved:
    - success signal
    - notification boundary
  changed_but_unverified: []
  remaining_side_effects: []
  rollback_required: false
  next_action: ask success signal
```

再開時は入力改訂版と対象範囲の変化を確認し、既知事項を最初から質問し直さない。前提が変化している場合は、再開スナップショットを無言で適用せず、再確認、リベース、停止、または上位判断への移送を選ぶ。

---

# 4. 標準実行の流れ

```text
0. スキルを選択
1. 目的と現在地を確認
2. 読み込みコンテキスト
3. 対象範囲と改訂版を確認
4. 不足を評価し作業待ち行列を作る
5. 対話または分析
6. 変換
7. 不足と競合を検出
8. 必要な場合は人間によるレビュー
9. コンテキストと関係を登録
10. 経路を決定
11. 終了または一時停止
```

## 4.1. 対象選択と方向付け

現在の不足コンテキストと目的からスキルを選び、今回整理すること、決めないこと、活動理由、残す結果を短く示す。スキル名や専門用語を利用者へ押し付けず、活動の意味を説明する。

## 4.2. コンテキストの読込みと確認

対象範囲、有効な改訂版、上流コンテキスト、関連判断、未決事項、既存成果物、過去の実行を必要な範囲で読む。回答済み事項を再質問しない。対象範囲、改訂版、決定権限が競合する場合は実行を進めず、使用する基準版を確認する。

## 4.3. 不足評価と作業キューの作成

質問または分析キューは固定順ではなく、未充足責務、リスク、下流影響に基づいて優先する。

| 優先順位 | 意味 |
|---|---|
| 重大 | 不明なままでは対象専門コンテキストを成立させられない |
| 重要 | 下流で重大な手戻りまたはリスクを生む |
| 有用 | 精度を高めるが未決事項として残せる |
| 延期 | 現在対象範囲では扱わない |

キュー項目はトピック、理由、優先順位、情報源不足、状態を必要な粒度で持つ。質問数やひな型充足率を品質指標にしない。

## 4.4. 対話・取得・変換

インタラクションは5章に従う。回答、観察、根拠、解釈、提案、判断、未決事項を区別し、次を分離して専門コンテキストへ変換する。

```text
人間が明示したこと
既存コンテキストから継承したこと
AIが整理・言い換えたこと
AIが提案したこと
未確認または不明なこと
```

## 4.5. 不足と競合の検出

上流コンテキストとの矛盾、名称揺れ、既存判断との競合、別項目の決定権限への越境、根拠不足、未確認のAI補完を確認する。解消できない場合は隠して一案にせず、必要な調査、判断、専門家レビュー、上流工程へ経路する。

## 4.6. 人間によるレビュー

人間の判断、コンテキスト採用、重要な意味変換、工程の引き渡しを含む場合は、6章に従って変換結果を確認する。対象項目と工程移行の人間の決定権限者が同じ場合は、独立レビュー後の一度の人間による判断で、内容の採用と移行を決定してよい。

読取り専用の監査や機械的妥当性確認は、人間承認を自己生成せず、結果をレビュー可能な状態で返すことで実行を終了できる。工程を移行する場合は、独立した工程移行レビューと人間による判断を区別する。

## 4.7. コンテキストの登録と更新

人間によるレビューまたは対象契約に従い、責務を持つ正本成果物、関係、状態、成果物参照、未決事項を更新する。安定コンテキストIDは対象種別と割当基準を満たす場合だけ付与する。

更新方法は作成、改訂、根拠の追記、未決事項、置換候補、変更なしから選べる。重要な意味変更では既存改訂版を破壊的に上書きしない。根拠、判断、状態、改訂版、削除は[文書化](03_Documentation.md)、変更の契機と想定／実際の影響は[変更](12_Change.md)を正本とする。

人間の判断、制約、学び、根拠、指摘事項を新たに確定または変更した場合は、登録直後に[変更影響の伝播確認](10_Agent.md#74-triggered-propagation-check)が必要かを判定する。

意味的影響の可能性がある場合は、`agent.gap_impact.audit`または同等の独立確認者へ経路する。上流・同層の未決事項、未解決事項、仮定、判断、制約を探索する。

正本更新と再監査が必要な実行は、下流成果物へ判断を記録しただけで`Completed`にしてはならない。

## 4.8. 次経路・完了・一時停止

終了または中断時は、次の経路、担当責任者、必要入力、未解決事項を示す。

スキル実行を`Completed`にできるのは、次をすべて満たす場合に限る。

- スキル定義の出口条件を評価している
- 結果、トレース、未決事項、リスクを記録している
- 次の経路または終了理由を記録している
- 発火した変更影響の伝播確認が完了している

未完了の伝播を伴う終了は、`Conditional`、`Blocked`、`Escalated`、または人間の指示による`propagation_exception`として通常完了と区別する。引き渡しする場合は6章を満たす。

---

# 5. 対話による実行支援

## 5.1. 対話の層

```text
人間との対話層
= 自然な言葉、経験、具体例、選択肢

構造化コンテキスト層
= 生の声、観察、根拠、解釈、仮説、制約、未決事項

専門成果物層
= REQ、UX、IA、UI契約、振る舞い仕様、アーキテクチャ、計画等
```

利用者へ専門成果物の全項目を常に表示する必要はない。ただし、どの発言や根拠をどう変換し、どこにAI解釈を加え、何を未決にしたかを追跡可能にする。

## 5.2. 質問と分析の規則

```text
一度に原則一つの重要判断を扱う
専門用語の試験ではなく経験、出来事、困りごとから聞く
抽象回答には具体例と対比を求める
生の声を保持し、AIによる構造化結果と分ける
解決策を必要性、守る価値、代替可能部分へ分ける
不明点を仮説、仮定、根拠が必要な事項、未決事項として保持する
質問理由を責務、不足、次判断と結び付けて説明する
利用者・業務・プロダクトへの影響を、専門構造や実装詳細より先に説明する
```

回答が広い場合はAIが勝手に確定せず、理解を要約して次の一問へ進む。利用者へ分類作業やひな型入力を要求しない。専門的用語、オブジェクト分類、状態名、技術方式をそのまま質問として返さず、PM、ディレクター、顧客、利用者等がプロダクト上の違いとして判断できる人間会話層へ変換する。

人間会話層は、[Documentationのロケール規則](03_Documentation.md#481-locale-first-display)に従う。利用者の主要ロケールで結論と影響を説明し、正式英語名は初出または参照時に限って併記する。同じ節で英語名を不必要に繰り返さない。

同じ規則を、スキルが新規作成・更新する人間可読成果物へ適用する。正本文書、CHG、根拠の説明・要約、ロードマップ、リリース記録、レビュー・監査結果を、ディレクトリ名やひな型の英語表記だけを理由に英語で作成しない。原文、正式名称、ID、ファイル名、スキーマ実値は維持する。

<a id="53-decision-support-contract"></a>

## 5.3. 判断支援契約

人間による判断（Human Decision）を求めるとき、AIは単に「AかBか」「分けるか統合するか」「よろしいですか」と質問しない。回答によって正本コンテキストの意味、対象範囲、責任、既定値、優先順位、リスク受容、下流契約が変わる確認・明確化・レビューも同様である。

AIは、対象リスクと8.1の実行環境規模に応じて判断材料を示す。質問の表示名を変えて、この契約を迂回してはならない。最初の表示では、内部の作業順や監査報告の順ではなく、人間が判断しやすい順に次を示す。

```text
1. 今回決めること
2. AIの推奨
3. なぜ今決める必要があるか
4. 推奨案によって変わる利用者、業務、プロダクト、計画・費用、リスク
5. 推奨案の主な短所
6. 保留または不採用の場合に残る問題
7. 人間の決定権限者へ確認する具体的な判断
```

判断に必要な場合または利用者が求めた場合は、次の判断材料を続けて示す。

```text
現行コンテキストと守る原則 / 制約
判断価値のある選択肢と、推奨案との差分
各選択肢の利点 / 欠点 / リスク
推奨を決めた評価基準と根拠 / 承認済み原則
確信度 / 不確実性と、推奨が変わる条件
元に戻せるか / 再検討の条件
```

変更トレース、監査名、指摘事項ID、対象改訂版、更新する正本、再開工程、再レビュー／監査等のCRDD実行詳細は追跡可能に保ち、最初の表示の中心にしない。ただし、重大な安全性、セキュリティ、プライバシー、法務上のリスク、不可逆性、強い不確実性、人間が受容する残存リスク、決定権限の競合は、詳細へ折り畳まず最初の表示で明示する。

AIは、既存コンテキスト、専門知識、リスクから支持できる案を推奨として先に示す。推奨と人間による最終判断を混同してはならない。

推奨には次を含める。

- 守る成果または原則
- 結論を左右したトレードオフ
- 根拠または専門的な根拠
- 確信度と不確実性
- 推奨が変わる条件または再検討契機

価値の優先順位によって結論が変わる場合は、条件付きで推奨する。架空の一意解を作ってはならない。

根拠が不足して推奨できない場合は、利用者へ中立な選択だけを投げ返さない。推奨できない理由、追加で必要な根拠、調査または専門家レビューへの経路を示す。

承認済み原則と委譲された決定権限によって一意に処理できる専門分類は、不要な人間の判断として利用者へ転嫁しない。

「推奨案で進めてよいか」というYes／No形式は、判断が実質的に二値であり、推奨案の主な短所と不採用時の結果を説明済みで、独立して決められる複数事項を束ねていない場合に使用する。価値の優先順位によって結論が変わる場合、複数案を別々に採否できる場合、または推奨が条件付きの場合は、判断価値のある二つまたは三つの案と差分を示す。一つの応答で複数の判断を求める必要がある場合も、判断ごとの対象と結果を分離する。

```text
悪い例:
候補と確定タスクを別対象物にしますか？

判断-準備完了:
AIが提案しただけの候補と、人間が引き受けた確定タスクを
同じ扱いにすると、提案が義務に見え、担当・完了管理も曖昧になります。
内部では分け、採用時に候補からタスクへつながる体験を推奨します。
実装対象は増えますが、人間の責任境界を守れます。この方針を採用しますか？
```

会話／構造化された要約を標準表示とし、専門的な詳細と機械可読な詳細は、判断に必要な場合または利用者が求めた場合に段階的に示す。簡略化しても情報源、不確実性、トレードオフ、決定権限の境界を失わせない。

## 5.4. 状況に応じた経路選択

回答と既存コンテキストに応じてキューと経路を変える。

```text
対象アクターまたは決定権限が不明 → 課題探索・要求形成または人間による判断
根拠が弱い                 → 調査または課題探索・要求形成
解決策が先に固定             → 必要性と代替案確認
複数成果が競合          → 人間による判断
別工程の責務が未定義           → 該当工程へ戻る
未知の技術制約が大きい         → プロトタイプ / 技術調査
既存挙動から「なぜ」を復元する → 課題探索・要求形成で既存系から逆引き
```

質問を続けること自体を目的にしない。別スキル、調査、試作、専門家レビュー、判断、工程ゲートのレビューへ移る方が有効なら経路を変更する。

## 5.5. 段階的な情報開示

| 段階 | 表示 |
|---|---|
| 1. 会話 | 自然な質問、簡単な選択肢、具体例 |
| 2. 構造化要約 | 分かったこと、未決事項、AI解釈、次の提案 |
| 3. 専門的詳細 | コンテキスト、契約、状態、受入条件、アーキテクチャ等 |
| 4. 機械可読 | ID、関係、改訂版、状態、来歴 |

利用者の役割と関心に応じて表示レベルを変えてよいが、情報源、意味、不確実性、判断境界を失わせない。

---

# 6. レビューと引き渡し

<a id="61-human-review"></a>

## 6.1. 人間によるレビュー

独立レビュー後に人間による判断が必要な場合、最初の表示は[判断支援契約](#53-decision-support-contract)に従う。報告だけで終了できるレビューへ、人間による判断を追加で要求しない。

判断支援契約の初期表示に続けて、対象リスクに応じて次のレビュー固有情報を必要な範囲で示す。

```text
今回の結論または生成したコンテキストの詳細
保持した生の声 / 意図
AIが変換または提案した部分
別責務へ分離した内容
未決事項、未解決不足、リスク
次へ進む場合の影響と網羅範囲状態
```

重大な安全性、セキュリティ、プライバシー、法務上のリスク、不可逆性、強い不確実性、人間が受容する残存リスク、決定権限の競合は、レビュー固有情報へ移して初期表示から隠さない。初期表示で意味を示し、必要に応じてレビュー固有情報で詳細化する。

対象項目の人間の決定権限者は、思いが失われていないか、AIが価値判断を追加していないか、前提が抜けていないか、対象範囲について内容を採用し次へ進めるかを確認する。内容と移行の決定権限が異なる場合だけ、判断を別々に記録する。

未解決事項は正式用語だけを見出しや結論として表示せず、何が不足し、なぜ必要で、未解決のまま進む影響、停止要因 / 非停止、担当責任者、次の操作 / 経路を人間が理解できる言葉で示す。未決事項、未作成成果物、競合、根拠不足、未検証、延期対象範囲を同じ一行へ潰さない。

レビューの詳しさは8章の規模に従う。簡潔では要約と重要な不足、標準では情報源、生成したコンテキスト、意図、代替案、関係、拡張では専門家所見、影響、判断 / 判断理由、ゲート根拠を扱う。

## 6.2. スキル引き渡し契約

工程を移行して次のスキルへ渡す場合は、次を満たす。

- 受信工程の入口契約を満たす
- [`10_Agent.md`](10_Agent.md#72-phase-transition-review-and-remediation-loop)に従い、契約確認と対象工程または対象共有契約に必要な専門品質確認を含む工程移行レビューを完了する
- 対象工程が追加・更新した検証義務、検証意図、検証観点と、検証設計への接続を[品質保証](16_Quality_Assurance.md)に従って取得可能にする
- 必要な是正と再レビューを完了する
- 対象リスクに応じて、以下の引き渡し情報を保持する

工程固有の入口、網羅範囲、出口は本書で再記述しない。同一工程内の調査、作成、限定レビュー等には、工程移行レビューを機械的に要求しない。エージェント契約、スキル定義、リスクに応じたレビューを使用する。

```yaml
handoff:
  from_skill: skill.ux.outcome
  to_skill: skill.ia.structure
  scope:
    feature: Important Topic Review
  source_revision:
    - id: UX-000004
      revision: 3
  coverage_state: Partial — Human Authorized
  coverage_summary:
    complete:
      - UX Outcome
      - Critical Journey
    open:
      - Secondary actor journey
      - Service Blueprint failure rows
  human_authorization:
    decision: IA may start for the stated scope only
    accepted_risk: Secondary actor structure may require rework
    owner: Product Owner
  receiving_entry:
    authority: 23_IA.md#phase-entry-contract
    assessment: satisfied_for_stated_scope
  independent_review:
    role: agent.phase_transition.review
    target_revision: UX-000004@3
    specialist_coverage:
      required:
        - id: primary_user_outcome
          criterion: 22_UX.md「基礎」「成功と学び」
        - id: primary_journey_validity
          criterion: 22_UX.md「利用者体験の流れ」
      reviewed:
        - perspective: primary_user_outcome
          reviewer: <independent reviewer>
          capability_basis: 対象REQ、利用者根拠、UX成果を照合する評価方法と、その方法を対象へ適用した所見
          criteria: 22_UX.md「基礎」「成功と学び」と工程監査チェックリスト
          evidence: UX-000004@3
          result: Pass
        - perspective: primary_journey_validity
          reviewer: <independent reviewer>
          capability_basis: 主要ジャーニーの目標、困りごと、重要場面、成功条件を照合する評価方法と、その方法を対象へ適用した所見
          criteria: 22_UX.md「利用者体験の流れ」と工程監査チェックリスト
          evidence: UX-000004@3
          result: Pass
      unreviewed: []
    result: Pass
    finding_ids: []
    re_reviewed_after_remediation: false
  human_decision:
    authority: Product Owner
    content: approved_for_stated_scope
    transition: proceed_for_stated_scope
    basis: independent_review
  preserve:
    - 人間が最終判断する
    - 根拠と提案を区別する
  obligations:
    - トピック / 根拠 / 判断の責務を分離する
  quality_assurance:
    obligation_references:
      - UX-000004#verification-obligations
    verification_design_reference: 07_Quality/Verification_Design.md
    unresolved_verification_viewpoints:
      - Secondary actor journey
  open_questions:
    - description: 重要度の算出規則は未決
      source:
        artifact: 02_UX/01_User_Experience.md
        anchor: important-topic-principle
  must_not_decide:
    - 重要度の算出規則
  reopen_condition:
    - Secondary actor journey changes the object responsibility
```

`specialist_coverage.required`には、対象範囲へ適用した具体的な専門観点または該当する網羅項目への参照を置く。工程名や節名だけで済ませず、`reviewed`の各結果、確認者、評価能力の根拠、使用基準、参照した根拠と対応づける。評価能力の根拠を説明できない観点は`reviewed`へ含めず、`unreviewed`として追加委譲またはレビュー例外へ接続する。

引渡し（Handoff）は、成果物へのリンクだけでは成立しない。工程間の通常引き渡しは、次の条件をすべて満たす場合に行う。

- 送信工程が`Complete for Scope`である
- 受信工程の入口契約を満たしている
- 対象改訂版までに発火した変更影響の伝播確認が完了している
- 工程移行レビューが、対象範囲へ必要な専門観点をすべて含んだうえで`Pass`である
- 対象内容と工程移行の人間の決定権限者が、レビュー結果を基に内容の採用と移行を決定している

指摘事項がある場合は、責務を持つ工程で修正し、修正後改訂版を再監査・再レビューする。監査実行の完了、`Conditional`、担当責任者の付与だけを`Pass`として扱わない。

`Partial — Human Authorized`を使用できるのは、人間が対象範囲、未解決事項、リスク、担当責任者、再開条件を明示した場合だけである。この場合も、承認された移行対象範囲の独立レビューは省略しない。

レビューの省略または未解消指摘事項を伴う移行には、対象人間の決定権限による[人間が指示したレビュー例外](10_Agent.md#73-human-directed-review-exception)が必要である。その移行を通常引き渡しまたはレビューの`Pass`と表示してはならない。

エージェントまたはサブエージェント間の委譲は[エージェント](10_Agent.md)、成果物の改訂版は[文書化](03_Documentation.md)、変更の影響トレースは[変更](12_Change.md)、品質保証成果物の接続は[品質保証](16_Quality_Assurance.md)、共通引き渡し不変条件は[原則](01_Principles.md)を正本とする。

---

# 7. Git / Markdown Adapter

本章は共通スキル実行環境をGitリポジトリとMarkdownへ写像するツール接続部であり、別の状態遷移ではない。専用適用、データベース、ベクトル検索、サブエージェント構成を要求しない。

## 7.1. 入口と開始

`CLAUDE.md`、`AGENTS.md`等の入口ファイルはツール向けの起動指示である。工程契約を複製せず、概要、原則、用語、対象変更 / 対象範囲、対象工程とスキル、正本コンテキスト、改訂版、決定権限、停止条件への参照を一致させる。

同一セッションで既読かつ改訂版が変わっていないコンテキストは再読を省略できる。現在の対象範囲または決定権限が不明な場合は大規模変更を開始せず、最小対象範囲を確認または提案する。

## 7.2. 状態遷移の対応

| 実行環境責務 | Git / Markdownの操作 |
|---|---|
| 負荷 / 確認 | 入口、変更トレース、工程正本、正本コンテキスト、改訂版を読む |
| 評価 | 入口、網羅範囲、不足、競合を評価する |
| 操作 | 既知コンテキストを再質問せず必要な判断を確認する |
| 記録 / 変換 | 情報源、解釈、提案、判断を分離して成果物へ反映する |
| レビュー | AI変換、不足、リスク、影響を人間または確認者へ提示する |
| 登録 | 正本成果物、関係、状態を更新する |
| 経路 | 次のスキル、調査、判断、レビュー、ゲート、一時停止を示す |

コンテキスト / 関係とコンテキスト選択の規則は[文書化](03_Documentation.md)、変更トレースは[変更](12_Change.md)を正本とする。

## 7.3. 実行結果と検証

終了または中断時は3.2のスキル実行記録を更新し、中断または失敗時は3.3の再開スナップショットを残す。変更済みファイル、検証、副作用等の実行結果がある場合は[Agent結果](10_Agent.md)へ接続する。思考過程の全文は不要だが、判断に必要な根拠と推論理由要約を失わない。

別セッションの人間またはエージェントが、現在地、対象範囲、改訂版、責務網羅範囲、情報源とAI変換、未決事項、中断点を再現できなければならない。ツール固有入口ファイルや作業状態は正本コンテキストを置き換えない。

---

# 8. 実行規模と失敗制御

## 8.1. 実行規模

実行環境は独自の文書化規模を選定しない。[文書化](03_Documentation.md)の規模を使用し、本節ではスキル実行への影響だけを定義する。対象CHGがある場合は、その影響対象範囲と参照を入力に含める。

| 運用規模 | スキル実行 |
|---|---|
| 簡潔 | 必要な核心判断、短い要約、既存コンテキスト更新 |
| 標準 | 適応的キュー、専門コンテキスト、トレース、レビュー |
| 拡張 | 複数根拠、専門レビュー、代替案、影響、ゲート根拠 |

判断支援の表示は、情報を失わず次のように段階化する。

| 規模 | 判断支援表示 |
|---|---|
| 簡潔 | 今回決めること、利用者・業務・プロダクトへの影響、推奨と決め手、主要な短所、具体的な確認 |
| 標準 | 簡潔に加え、判断価値のある代替案、主要トレードオフ、可逆性、保留影響、再確認条件 |
| 拡張 | 標準に加え、根拠、確信度 / 不確実性、重大リスク、専門レビューまたは追加調査、推奨が変わる条件 |

簡潔でも推奨の根拠と主要な短所を省略しない。質問数やファイル数から規模を変更せず、規模を品質等級として扱わない。

## 8.2. 失敗と監査の境界

共通失敗の検査は[準拠監査](52_Conformance_Audit.md)のエージェント型提供プロファイル基準を正本とする。工程固有失敗は各工程文書を正本とし、本書へ再掲しない。
