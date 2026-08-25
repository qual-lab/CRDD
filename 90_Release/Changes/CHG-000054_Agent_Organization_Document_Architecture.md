# 変更トレース: エージェント組織の文書アーキテクチャ

- 変更ID: `CHG-000054`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: エージェント組織の基礎正本候補、エージェント／プロバイダー調整アーキテクチャ、Coordinator Runtime実装README、用語集、監査接続、配布ひな型、変更トレース／Roadmap責務およびv0.18候補文書の配置
- 対象version: v0.18.0 Candidate
- 変更分類: `normative`（v0.18.0候補への基礎正本とエージェント型提供基準AD-22の追加。公開済み基準、Runtime動作またはリリースは変更しない）
- 移行要否: `migration_required: true`（v0.18.0採用時に、既存のエージェント型提供対象のAD-22根拠を基準版採用評価で再評価する）
- 関連正本: [エージェント組織](../../04_Agent_Organization.md)、[自律Operation](../../05_Autonomous_Operation.md)、[文書化](../../03_Documentation.md)、[変更](../../12_Change.md)、[保守](../../19_Maintenance.md)、[課題探索・要求形成](../../21_Discovery.md)

## 結論

`tools/coordinator/README.md`をエージェント組織、費用、独立レビューまたは決定権限の意味正本にしない。エージェント組織とプロバイダー非依存の経路制御をルートの`04_Agent_Organization.md`へ集約し、`tools/coordinator`を現在の実装と強制方法へ限定する。併せて、恒久的な自律Operation候補をルート正本へ、未完了作業だけを単一のProduct Roadmapへ置き、CHGを変更意図より細かく分割しない境界を明示する。

決定権限、人間の決定権限、独立レビューおよび品質の既存決定権限は維持する。新しいエージェント組織文書はそれらを組織概念へ適用する候補基礎正本であり、文書の`Candidate`状態だけから公開済み基準、準拠表明、特定プロバイダー、固定役割、固定フローまたはRuntime必須条件を成立させない。

## 着手前整合

- 受付: エージェント組織を一つのMDへ分かりやすく集約し、概念／ポリシー／アーキテクチャを実装READMEから分離したいという人間判断。
- 基準改訂版: `5cea6d4`。Coordinator Runtimeの状態表示だけを対象とする独立確認、文書監査、不足／影響監査および準拠監査は指摘事項0件で`Pass`。
- 変更する契約母集団: エージェント組織の定義、概念責務、アーキテクチャ責務、実装READMEの責務表示、正式用語の境界表示。
- 既知の利用側母集団: 概要、用語、README日英v0.18候補入口、v0.18構想、責務境界、PoC Profile 5、運用健全性、エージェント／プロバイダー調整、Coordinator Runtime README、準拠監査、CHANGELOG日英候補節、`template/AGENTS.md`、`template/CLAUDE.md`。
- 保持する意図: 人間の決定権限、役割と決定権限の分離、プロバイダー／Runtime非依存、不要な複数エージェントの非必須、費用は適格集合内だけで最適化、プロバイダー差とレビュー独立性の分離、調整役は人間の決定権限を取得しない。
- 目指さないこと: Runtime機能、固定作業手順、固定プロバイダー対応関係、新しいスキーマ、`Execution Slate`の正式用語化、専用監査、v0.18の採用またはリリース、既存成果物や履歴の一括書換え。
- 必須確認: エージェント／アーキテクチャ独立レビュー、文書監査、不足／影響監査、準拠監査。
- 非該当: 実装・セキュリティ監査。コード、Runtime実行契約または配布物を変更しないため。リリース判断は本変更で行わないが、将来採用時の移行影響はCHANGELOG、不足／影響監査および準拠監査の対象に含める。
- 経路変更: 初稿監査後、人間の決定権限者がエージェント組織を基礎帯の`04_Agent_Organization.md`へ置く方針を決定した。これにより、非規範Roadmap候補の新設から候補基礎正本の追加へ変更分類と利用側を再計算した。
- 規範追加の承認: 固定改訂版`74c498c`の監査集合で、主要境界を準拠評価へ投影するAD-22と将来採用時の移行が必要と判明した。人間の決定権限者は2026-08-25に、この規範追加を承認した。
- 停止条件: 公開済み基準の変更、v0.18採用または準拠表明の確定、既存Runtime動作変更、人間の決定権限変更、または人間判断なしに一意化できない概念競合を検出した場合。

着手前整合確認の結果は`着手可`。用語・表現は日本語を主要表示とし、初出で正式英語名を併記する。エージェント組織は複数文書で独立概念として使用され、固有の責務境界を持つため、同じ変更で用語集へ登録する。

## 専門探索と収束

判断を変え得る不確実性は、概念の配置、非規範／規範の強さ、既存の調整文書との重複、およびtools READMEに残すべき実装上の安全制約であった。

比較した案は次のとおりである。

1. `tools/coordinator/README.md`を中心のまま維持する案は、実装READMEを上流コンテキストや判断理由の暗黙正本にしないという文書化契約に反するため不採用。
2. `07 Agent & Provider Orchestration`だけを拡張する案は、エージェント組織の目的／内容と経路制御／適格性の方法を同じ文書へ残し、将来別Runtimeから参照しにくいため不採用。
3. `99_Roadmap`へ概念本文を置く案は、未完了作業の登録簿を第二の正本にするため不採用。初稿ではこの案を採ったが、文書監査、不足／影響監査および準拠監査の指摘により撤回した。
4. `00`–`09`の基礎帯に`04_Agent_Organization.md`を候補基礎正本として置き、プロバイダー非依存の経路制御も同書の実行アーキテクチャへ統合し、tools READMEを実装へ分ける案は、概念の抽象度と文書責務を一致させるため採用。

反証として、概念文書がエージェント契約、独立レビューまたは決定権限を再定義する危険と、実装READMEから安全条件を削りすぎる危険を確認した。前者は既存Coreを最終正本として直接参照し、後者は実装が強制する具体条件をREADMEへ保持しつつ意味正本ではないと明示して回避する。

専用のエージェント組織監査を追加する案も確認したが、エージェント契約と品質保証の独立レビュー、文書監査、準拠監査および不足／影響監査で現在の適用条件、判定、根拠を扱えるため不採用とした。既存監査で表現できない固有契約が生じた場合だけ再評価する。

## 代表例と境界

- 発火例: 複数エージェント／プロバイダーへ作業を割り当てる場合、`04_Agent_Organization.md`§1～§11の規範候補、§12の非規範実行Architecture候補、Runtimeの具体強制を順に参照する。
- 非発火例: 単一エージェントで成立する通常作業へ、エージェント組織を理由に調整役、別プロバイダーまたは独立レビューを追加しない。
- 境界例: 費用／利用枠の分散は適格集合内で比較できるが、決定権限、安全性、プライバシー、能力または検証を弱めない。
- 判定情報不足例: エージェントの能力、独立性、決定権限または情報境界を確認できない場合、低費用候補として選ばず既存の停止／人間判断へ戻す。

## 変更と確認

予定編集は、基礎正本候補の新設、用語登録、概要、README日英入口、v0.18候補文書、準拠監査のAD-22、CHANGELOG日英候補節、配布ひな型およびtools READMEの参照・責務更新、Roadmap内の重複削減である。再開後は、エージェント／プロバイダー調整を同じ正本へ統合し、恒久Architectureをルートへ移し、単一Product Roadmapへ未完了作業だけを残し、未リリースCHGを変更意図より細かく分けない規則を同じ文書責務是正として扱う。Coordinator Runtimeのコード、試験、脅威モデル、現在の判断ゲート、Issue #30の採否／close、リリースIdentityおよび過去CHANGELOG履歴は変更しない。

初回固定前に、予定した契約母集団、利用側母集団、代表例、変更禁止範囲と実際の差分を照合する。固定改訂版へRepository全体Checkerを一度実行し、その共通結果を独立レビューと必須監査へ渡す。指摘事項があれば全監査結果を統合してから修正し、新しい固定改訂版を再確認する。

初稿のRepository全体CheckerはMarkdown 388件、local link 2211件、anchor 588件、Related block 26件、versioned document 26件、remediation row 74件を確認し、error 0／warning 0である。コード、Runtime契約、Threat Modelおよび試験の差分はない。

初稿固定改訂版`722fe6e`に対するエージェント／アーキテクチャ独立レビューは指摘事項0件で`Pass`だった。一方、同じ固定改訂版に対する文書監査、不足／影響監査および準拠監査は、Roadmapを概念正本候補にしたこと、責務境界／調整／運用健全性に概念重複を残したこと、再利用可能な用語定義へ具体versionを埋め込んだことを指摘し、`Fail`となった。この結果を統合し、基礎正本候補への移設、利用側全数更新、重複縮約およびversion非依存化を一つの是正として実施する。初稿の監査結果を修正版の合格根拠へ流用しない。

是正後の固定前Repository全体CheckerはMarkdown 389件、local link 2234件、anchor 588件、Related block 27件、versioned document 27件、remediation row 74件を確認し、error 0／warning 0である。`09_CRDD_v0_18_Agent_Organization.md`は概念本文を持たない一時索引へ縮約し、CHG-000054の必須確認完了後に別の未完了作業がなければ削除する。

固定改訂版`74c498c`のエージェント／アーキテクチャレビュー、文書監査、不足／影響監査および準拠監査は、基礎配置と旧3指摘の解消を確認した一方、エージェント組織の主要境界を準拠判定へ完全投影するAD-22、README日英の3区分と導線、採用短絡表現、locale-first表示、概要と配布入口の読込境界、規範分類と移行影響を新たに指摘した。全結果を統合し、AD-22を既存AD-04／07／08／11の再定義ではなく編成固有の横断基準として追加し、`normative`／`migration_required: true`、CHANGELOG日英、README、表示名および読込境界を一括是正する方針を各監査へ再提示した。各監査は条件付きで受け入れ、人間の決定権限者が規範追加を承認した。

規範追加後の固定前Repository全体CheckerはMarkdown 389件、local link 2240件、anchor 588件、Related block 27件、versioned document 27件、remediation row 74件を確認し、error 0／warning 0である。`tools/checker`の契約試験は151件中150件が合格し、`tools/coordinator/runtime/claude-managed-settings.json`を既存命名規則が認識していない1件を検出した。当時は本変更と別の残件として記録したが、後続確認で同じ未リリース命名変更の契約不足と判定し、原因契約を所有する[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)を再開した。

固定改訂版`34d7496`のエージェント／アーキテクチャ独立レビューと準拠監査は`Pass`だった。文書監査と不足／影響監査は、現行v0.18英日CHANGELOGがCHG-000012／013／014／054の統合集合を名乗りながらAD-22だけへ移行内容を縮約し、集合最上位の`breaking`を`normative`と過小表示したMajor 1件、今回変更した日本語説明面のlocale-first不一致と、契約試験150／151の後続追跡不足というMinor 2件を返した。全監査結果を統合し、英日CHANGELOGを三つの規範差分と非規範アーキテクチャに分けて`breaking`／`migration_required: true`へ再構成し、CHG-000054単体の`normative`／`true`を維持し、変更した説明面を日本語主体へ整え、命名不整合へ追跡先を設定する方針を各監査へ再提示した。各監査は条件付きで受け入れ、是正を適用・自己確認中である。新しい固定改訂版の必須再監査前に、これらを`Resolved`または`Pass`と扱わない。

固定改訂版`51d81ec823ce08497a1d561db7c85110ffd1e36b`に対するエージェント／アーキテクチャ独立レビュー、文書監査、不足／影響監査および準拠監査は、Critical／Major／Minor 0件で全て`Pass`した。旧指摘事項は全て`Resolved`であり、Repository全体CheckerもMarkdown 389件、local link 2243件、anchor 590件、Related block 27件、versioned document 27件、remediation row 74件、error 0／warning 0だった。命名個別契約試験の1件不合格は全体Passへ丸めず後続追跡した。概念を所有しない一時索引`99_Roadmap/09_CRDD_v0_18_Agent_Organization.md`は、必須監査集合の統合Passと別の未完了作業がないことを確認したため削除した。その後、命名不整合は[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)の同じ未リリース意図で、分類器、現行ソース、契約試験およびChecker test runnerを一括是正し、Coordinator 740件、Checker 151件と両package checkを合格させた。完了結果をRoadmapへ残さない。

## 同じ未リリース意図としての再開

人間の決定権限者は、恒久的なエージェント組織／自律Operation文書がRoadmapへ残り、同一対象バージョンのRoadmap詳細が分裂し、命名是正が発見元と原因契約の別CHGへ細分化されかけた状態を、同じ未リリース文書アーキテクチャの不足として是正するよう承認した。本変更を`Reopened`とし、次を同じ変更意図へ含める。

- プロバイダー非依存の経路制御、適格性、最適化、コンテキスト投影、代替経路および実行来歴を`04_Agent_Organization.md`へ統合する。
- 自律Operationの恒久候補をルート`05_Autonomous_Operation.md`へ集約し、再利用可能な本文から特定バージョンの説明を除く。バージョンと移管履歴はヘッダー、CHGおよびRelease成果物で扱う。
- `99_Roadmap`を単一Product Roadmapへ縮約し、現在も未完了のRuntime最終run、上流工程強化、自律Operation実証、Issue #30再評価およびRelease準備だけを残す。完了済み命名是正と部品別Runtime状態は各CHGへ閉じる。
- 未リリースCHGは工程、ファイル、コミット、確認者または個別Findingだけで分割せず、変更意図、決定権限、移行／切戻しおよびリリース境界が同じなら原因契約を所有するCHGを再開する。

発火例は未リリース命名分類器の現行source漏れ、非発火例は独立して採否できるProvider認証不具合、境界例は二つの独立してリリース可能な契約へ及ぶFinding、判定情報不足例は意図／決定権限／移行／Release境界を再構成できない場合である。判定情報不足では新CHGを機械的に作らず停止または再整理する。

この再開は文書責務と現在のRepository配置を是正する。公開済み基準、Runtime動作、Issue #30の採否／close、v0.18.0の統合またはReleaseを決定しない。移管後の固定改訂版へ全体Checker、独立エージェント／アーキテクチャレビュー、文書監査、不足／影響監査および準拠影響確認を取り直すまで、過去の`Pass`を現在の解消根拠へ流用しない。

現在、人間による追加判断は必要ない。基礎正本候補の作成と責務分離は人間が承認済みだが、v0.18採用、統合またはReleaseは別判断である。

## 文書移管固定版の監査と統合是正

文書移管の初回固定改訂版はCommit `e2933955cc84ec325137d01d5d6af8897b9ea48d`である。全体CheckerはMarkdown 386件、local link 2,206件、anchor 587件をError 0／Warning 0で確認し、Checker契約試験151／151、Coordinator契約試験740／740および`git diff --check`はPassだった。機械確認は独立レビューまたは監査を代替しない。

同じ固定改訂版を対象とした必須監査集合は、エージェント／Architectureレビュー、Security／Conformanceレビュー、文書監査および不足／影響監査である。結果は全体として`Fail`で、次を一括是正対象とした。

1. `00_Overview.md`が`00`～`09`全体を基礎規範と表示し、`05`の非規範Architecture Candidate境界を失わせた。
2. `04_Agent_Organization.md`で§1～§11の基礎規範候補と§12の非規範実行Architecture候補が混在し、AD-22、Coordinator README、README／CHANGELOGへ強度が一意に伝播していなかった。
3. `12_Change.md`が、未リリース変更だけを`Reopened`にする保守契約と競合し、リリース後の同一意図を再開できる余地を残した。
4. 単一Product Roadmapへの縮約後、未終了CHGの全数割当と、会話で採用した上流工程強化の情報源を再構成できなかった。
5. 旧PoC計画の四つの参照実証、共通評価軸、Routing／Result Integration／Forward Compatibility Fixture、避けるべき失敗およびActivation Profile 0～5の意味が、節別の移管証跡なしに圧縮されていた。
6. 現行参照ラベルに削除済みの`07`、`Roadmap 08`または「実装残件台帳」が残り、完了項目を主要表示へ一度`Completed`として残す図が完了時除去契約と競合した。

全監査結果を統合した是正方針を各確認者へ編集前に再提示し、条件付きAcceptを得た。補正後の処置は次のとおりである。

- `00`～`04`を基礎規範候補、`05`を非規範Architecture Candidateとして、概要と各文書から直接判別可能にした。
- `04`の§1～§11を規範候補、§12を非規範Architecture Candidate、§13～§15を強度を継承する共有境界とした。適格性成立後の最適化、判定不能時停止、外部送信、FallbackおよびContext最小化の規範根拠は§5、§8～§9、`01_Principles.md`およびAD-22へ残した。
- `Reopened`を未リリースの同じ変更意図へ限定し、リリース後の不足または回帰は原因が同じでも参照付き新CHGとした。
- [`CHG-000014`](CHG-000014_V018_Architecture_Candidate_Integration.md#51-未終了変更トレースの移管スナップショット)へ、固定改訂時点の全54 CHGの割当スナップショットと、旧PoC全節の移管／終了表を置いた。これは現在状態の第二台帳にしない。
- 上流工程強化は着手済みCHGを先取りせず、[`01_Discovery/01_CRDD_Product_Discovery.md`](../../01_Discovery/01_CRDD_Product_Discovery.md)へ採用済み意図、保持条件、優先順位、開始条件、変更禁止範囲および検証義務を保存した。Runtime完成後の人間による着手判断で一つの主変更意図へ接続する。
- Product Roadmapは未完了項目だけを表示し、完了項目は結果を責務正本へ反映して主要表示から除去する。現在参照だけを`Product Roadmap`または`04`§12へ更新し、過去固定時点の説明は履歴として書き換えない。

この処置は`Applied`／`Self-checked`であり、指摘事項を`Resolved`、監査を`Pass`または本変更を`Verified`とする根拠ではない。新しいCommit／Treeへ全体Checker、Checker契約試験、エージェント／Architectureレビュー、Security／Conformanceレビュー、文書監査および不足／影響監査を取り直し、同じ監査集合の統合Passを得るまで`Reopened`を維持する。公開済みv0.17.0、Runtime動作、Issue #30、v0.18採用、統合またはReleaseは変更していない。現在、人間による追加判断は必要ない。

## 文書移管是正版`d60bcd8`の再監査

固定改訂版`d60bcd8b835d684829d1059d304c9ab369bb3a99`に対し、エージェント／Architectureレビュー、Security／Conformanceレビュー、文書監査および不足／影響監査を同じ共通機械確認で実行した。前節の6 Findingは全て解消済みだったが、監査集合は新たに次の文書アーキテクチャFindingを返し、全体として`Fail`となった。

1. `04_Agent_Organization.md`を節単位で規範／非規範へ分けた後も、`00_Overview.md`の番号帯、`05_Autonomous_Operation.md`、README英日、Coordinator READMEおよびCHG-000014の現行移管導線が文書全体を一つの強度として参照していた。
2. Product RoadmapのCHG／保守契約が実行根拠となる3項目へ判断状態`Adopted`を重複表示し、採否対象と実行・参照項目を分ける`21_Discovery.md`§6.3と不一致だった。
3. `00_Overview.md`の終了図だけが、詳細固有情報を正本へ移管する前に完了項目を主要表示から除去する順となり、一時的に発見経路を失い得た。

同じレビューで検出したChecker試験母集団とBoolean閉集合のMajor 2件は、原因契約を所有する[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)へ同じ未リリース意図として接続した。Findingを発見元ごとに新しいCHGへ分割していない。

統合是正方針は編集前に全確認者へ再提示し、条件付きでAcceptされた。`00`は`00`～`03`と`04`§1～§11の基礎規範候補、`04`§12と`05`の非規範Architecture Candidate、`04`§13～§15の参照元強度を継承する共有境界へ分けた。一般的なエージェント組織、AD-22およびAuthorityの参照は規範候補へ保ち、Orchestration、Routing、経路制御または実行Architectureを説明する現在導線だけを§12へ直結した。履歴引用は書き換えていない。

Product Roadmapでは、正式署名一般Task、命名／文書是正の再検証およびv0.18最終化の判断状態を`—（非適用）`とし、対応状態とCHG／保守契約の実行根拠を維持した。上流工程強化の`Adopted`、自律OperationとIssue #30の`Exploring`は変更していない。終了図は、詳細固有情報の正本移管、終了結果／参照反映、参照確認、主要表示除去、詳細削除の順へ揃えた。

Checker 153／153、Coordinator 740／740およびChecker package checkはPassした。この結果は`Applied`／`Self-checked`であり、新固定Commit／Treeの全体Checker、両package check、`git diff --check`、エージェント／Architectureレビュー、Security／Conformanceレビュー、文書監査および不足／影響監査の統合Passまでは、Findingを`Resolved`、監査を`Pass`または本変更を`Verified`としない。Runtime動作、公開Schema／CLI、AD-22、v0.17公開基準、Issue #30、統合またはReleaseは変更していない。現在、人間による追加判断は必要ない。

固定改訂版`85e0893af0541bd264cf70eb0ce3563855357ce4`の再監査では、本変更が所有する規範強度の伝播、意味別リンク、Roadmap判断軸および終了順Findingは全て解消済みと確認された。ただし必須監査集合は、[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)が所有するChecker 0件拒否の共有負試験不足とBoolean suffix件数転記を検出したため、全体として`Fail`である。発見元だけを理由に本変更へ命名規則を再移管せず、原因契約の同じ未リリース意図で是正し、新固定版の監査集合が統合Passするまで本変更も`Reopened`を維持する。

## 再開変更の完了とRelease引き渡し

再開変更の実質固定版はCommit `7dbf610c43b827a82901a270c039e44e887782c7`、Tree `b40c7f4924651596c1a813b7abc548364df4cbc1`である。Repository全体Checkerは697 file／387 Markdown／2242 local link／621 anchor、Error 0／Warning 0、Checker契約試験は153／153、Coordinator契約試験は740／740、両package checkおよび`git diff --check`は全てPassした。CheckerとCoordinatorの試験結果は、この固定版と同一のコード実体に対する根拠である。

同じ固定版に対するエージェント／Architectureレビュー、Security／Conformanceレビュー、文書監査および不足／影響監査は、全て`Pass`／Finding 0で完了した。再開後に検出した規範／非規範境界、意味別参照、Roadmap／CHG責務、旧PoC移管、終了順、およびCHG-000017へ接続したChecker契約のFindingは全て`Resolved`である。旧固定版の結果は履歴として保持するが、現在の合否へ流用しない。

実際の影響は、エージェント組織（Agent Organization）の概念・規範候補をルート`04`へ、プロバイダー非依存の実行Architectureを同書§12へ、恒久的な自律Operation Architectureをルート`05`へ集約し、`tools/coordinator/README.md`を実装責務へ戻したことである。単一Product Roadmapには未完了作業だけを残し、完了結果と変更履歴は責務正本およびCHGへ移した。Coordinator Runtimeのコード、試験、Threat Model、公開済みv0.17.0、Issue #30の採否／closeおよび既存公開Releaseは変更していない。

残存リスクは、非規範Architecture Candidateの将来採否、正式署名一般Taskの実Provider run、上流工程強化、自律Operationの参照実証、Issue #30の再評価、およびv0.18.0の統合／Release判断である。これらはProduct Roadmapの独立した未完了項目へ接続し、本変更の完了阻害へ混同しない。

この固定版では、v0.18.0 Candidateの最終Release項目へ引き渡せる状態まで到達していた。`Ready for Release Handoff`は、統合、採用、準拠表明、Stable化、タグまたはReleaseを意味しない。Product Roadmapの完了済み再検証行は、本節へ結果と参照を移した後に除去する。CHG-000014 §5.1は固定時点の移管スナップショットであり、現在状態へ書き換えない。当時、人間による追加判断は必要なかった。

## 自律Operation候補文書の最終統合

Release前の文書構造再確認で、`05`～`09`は同じv0.18.0 Candidate、同じ決定権限、同じ非規範Architecture強度および同じ変更lifecycleを持ち、分割を独立した採否、移行、レビューまたは利用形態へ結び付ける根拠がないと判定した。責務、安全、Operation健全性、人間接続および将来互換は自律Operation全体を理解する連続した章であり、分割したままでは相互参照と正本選択を増やす。このため、旧`06`～`09`の本文を`05_Autonomous_Operation.md`の§10～§13へ意味を変えず統合し、旧ファイルを互換shimなしで削除する。過去または現在の参照に使われた主要anchorは統合先へ保持し、README、概要、Agent Organization、Product RoadmapおよびCHG-000014の現在参照を新しい単一正本へ接続する。

`04_Agent_Organization.md`への全統合案も再評価したが採用しない。`04`§1～§11は役割、専門性、委譲、独立レビュー、費用、Authorityおよび人間境界を所有する規範候補であり、`05`は再評価、Operation Contract、Effect、安全、健全性および将来互換を所有する非規範Architecture Candidateである。両者を一ファイルへ統合すると、規範強度、変更頻度、採用単位およびレビュー範囲が不必要に結合する。したがって、`04`を「AIチームをどう編成・統治するか」、`05`を「そのチームがどう安全にOperationするか」の二正本として維持する。

この整理は新しい概念、規範、Runtime機能、準拠要件、決定権限またはRelease判断を追加しない。`06`～`09`は予約へ戻し、番号を埋めるための空文書、redirectまたは互換wrapperを残さない。現在状態を`Ready for Verification`へ戻し、統合後の同一固定改訂版に対する文書監査、不足／影響監査および必要な準拠影響確認がFinding 0で完了するまで、以前の`Ready for Release Handoff`を現在結果へ流用しない。
