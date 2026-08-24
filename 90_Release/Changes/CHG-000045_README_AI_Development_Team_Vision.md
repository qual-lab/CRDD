# 変更トレース: READMEのAI開発チームVision

- 変更ID: `CHG-000045`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-24
- 対象: CRDD公開README冒頭の日英Vision、Human Coding-less Developmentおよび人間／AI責務の説明
- 対象version: v0.18.0 Candidate
- 変更分類: `clarification`（既存の人間／AI決定権限、Context RepositoryおよびAgent非依存性を変えず、公開入口の理解順を目的→役割→差分→実践へ再構成）
- 移行要否: `migration_required: false`
- 関連正本: [`README`](../../README.md)、[`外部コミュニケーション`](../../17_Communication.md)、[`課題探索・要求形成`](../../21_Discovery.md)、[`文書化`](../../03_Documentation.md#481-locale-first-display)

## 結論

READMEの最初の説明をContext Repositoryの機構から始めず、「AIが専門家チームとして協働できる開発環境」と、人間がアイデア、判断、責任を保持する境界から始める。続いて、通常のAI Codingとの違いをContext、判断履歴、専門工程および依存関係の共有として説明し、CRDD自身と実プロジェクトでの利用へ接続する。

Human Coding-less Developmentは、人間がコードを書くことを開発の前提にしない目標として追加する。No-code、技術判断不要、検証不要またはAIへの責任移譲ではないことを同じ表示内で明示する。

## 着手前整合

- 受け手: CRDDを初めて読む開発者、個人開発者、プロダクト責任者、および既存READMEをContext管理方法論として理解している利用者。
- 伝える主要な意味: CRDDの中心価値は文書量ではなく、AIへ専門性と許可範囲内の実行を担わせ、人間が価値、判断および最終責任を保持できる協働環境を作ることにある。
- 根拠: 既存README、Agent／Skill／工程契約、Human Authority境界、およびCoordinator Runtime 1.0の非規範Architecture Candidate。実利用の主張は人間の決定権限者が提供した利用事実に限定し、製品名、件数、成果または一般化した効果を追加しない。
- 保持する境界: CRDDは特定AI、複数Agent、Agent topology、RuntimeまたはCoordinatorを必須化しない。v0.18.0 CandidateのRuntime実装状況、Released Baseline、準拠およびRelease状態を変更しない。
- 主な反例: 「全部AIへ丸投げする」「人間のレビューが不要」「AIが責任を持つ」「No-code製品」「Multi-Agent Runtimeが既に一般提供済み」という読み方を本文で否定する。
- 情報不足時: 実利用の対象名、成果、件数または効果を確認できない場合は追加せず、現在の抽象的な利用事実だけを保持する。

## 影響と検証

変更母集団はルート`README.md`の日英Tagline、英語`What CRDD aims to achieve`／`Human Coding-less Development`、日本語`CRDDが目指すもの`／`Human Coding-less Development`である。利用側はREADME内の平易な説明、Human責務、CRDDがしないこと、v0.18.0 Candidate注記および言語間の意味対応である。

外部市場、対象セグメント、獲得経路、媒体、広告、行動喚起または市場反応の新しい採用判断は行わないため、追加の市場探索を発火しない。READMEの理解順と表現を変更するCommunication確認、日英意味対応、文書監査および最終Runtime候補に対する不足／影響監査へ含める。準拠規則、Released Baselineまたは移行を変えないため、単独の準拠監査と移行監査は追加しない。

基準Node.js v24.19.0によるRepository全体CheckerはMarkdown 378件、local link 2140件、anchor 587件を確認し、error 0／warning 0である。Biome formatterも全177対象について差分なしを確認した。意味、日英対応、主張境界および初見理解は、Runtime 1.0全体の固定改訂版に対する独立レビューと文書監査で確認する。

候補Branchでは変更トレースへ保持し、v0.18.0のCHANGELOG／Release metadataはRuntime 1.0全体のRelease準備時に、他のCandidate差分と同じ固定改訂版へ統合する。README更新だけからRelease、公開済み実績または機能利用可能性を推定しない。

現在、人間による追加判断は必要ない。主張の採用は2026-08-24の人間指示で確定しているが、統合、公開Releaseおよび残存リスク受容は別判断である。
