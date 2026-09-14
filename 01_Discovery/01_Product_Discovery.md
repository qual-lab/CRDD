# Discovery

状態: Active
維持責任者: Qual-Lab
判断する人: Qual-Lab

本書は、CRDD標準自身の個別探索を一覧し、現在採用している判断をUXへ渡すための入口である。CRDDの方法論、実装史、版計画、設計詳細は説明しない。それぞれの所有文書を参照する。

```text
個別の課題と仮説
    ↓
探索記録（Analysis/EXP-*）
    ↓ 人間が採用
採用要求（Definitions/REQ-*）
    ↓
UXへ引き渡す
```

`EXP-*`は課題と仮説の来歴を識別し、`Analysis/`が探索過程を所有する。`REQ-*`は、人間が採用した要求を識別し、`Definitions/`が現在の要求定義を所有する。過去に成立していた機能へ付けた本書の`EXP-*`と`REQ-*`は、2026-09-13の再編時に既存CHG、根拠、公開記録、実装から再構成して採番した。当時から同じIDが存在したとは扱わない。UX工程は要求を利用者が得る結果と体験へ具体化するが、新しい`REQ-*`を独自に発行しない。新しい必要性が見つかった場合はDiscoveryへ戻す。

<a id="current-discovery-map"></a>

## 探索台帳

| 探索 | 出発点となった問題 | Discoveryでの判断 |
|---|---|---|
| [EXP-000001 機械で見つけられる不備を先に落とす](Analysis/EXP-000001/exploration.md) | 繰り返し可能な構造確認と、人にしかできない判断が分かれていなかった | 要求採用 |
| [EXP-000002 判断と監査を収束させる](Analysis/EXP-000002/exploration.md) | 監査、修正、再監査と人間判断が同じ問題を小刻みに往復した | 要求採用 |
| [EXP-000003 外部情報を勝手に昇格させない](Analysis/EXP-000003/exploration.md) | 外部送信、外部情報、公開反応、依存更新の権限と事実が混ざった | 要求採用 |
| [EXP-000004 複数AIの実行責任を失わない](Analysis/EXP-000004/exploration.md) | AIへの委譲で範囲、権限、結果、清掃、回復の所有者がいなかった | 要求採用 |
| [EXP-000005 導入したCommitのツールをその場で使う](Analysis/EXP-000005/exploration.md) | submoduleと別配布実行基盤の版合わせが利用者責任になった | 要求採用 |
| [EXP-000006 AI入口を別々の標準にしない](Analysis/EXP-000006/exploration.md) | AI別指示の複製で正本と行動が分岐した | 要求採用 |
| [EXP-000007 プロジェクトの現在地を毎回組み立て直さない](Analysis/EXP-000007/exploration.md) | 状態、品質、判断、根拠を毎回探してまとめ直している | 要求採用 |
| [EXP-000008 プロジェクトの仕事として進める](Analysis/EXP-000008/exploration.md) | タスク成功と目的／節目達成を結ぶ一連の状態変化がなかった | 要求採用 |
| [EXP-000009 判断理由を外在化する](Analysis/EXP-000009/exploration.md) | 成果物だけでは捨てた案、制約、仮説の現行性を辿れなかった | 要求採用 |
| [EXP-000010 最終E2Eまで実境界不具合を残さない](Analysis/EXP-000010/exploration.md) | 検証量は多いのに実境界の失敗発見と切り分けが遅かった | 要求採用 |
| [EXP-000011 人が理解できる文書へ戻す](Analysis/EXP-000011/exploration.md) | 確認項目を満たすことが読者の理解順より前に出た | 要求採用 |
| [EXP-000012 公式識別情報を視覚的に見分ける](Analysis/EXP-000012/exploration.md) | 公式入口を識別する素材と権利・保証境界がなかった | 要求採用 |
| [EXP-000013 実行を次の改善へつなぐ](Analysis/EXP-000013/exploration.md) | 実行経路の時間、結果、利用量を共通に比較できなかった | 要求採用 |
| [EXP-000014 Coordinatorへ集まりすぎた責務を分ける](Analysis/EXP-000014/exploration.md) | プロジェクト、通信方式、観測、OS境界の所有者が曖昧だった | 要求採用 |
| [EXP-000015 同じ実行基盤を複数入口から使う](Analysis/EXP-000015/exploration.md) | 通信方式ごとにプロジェクトの意味が分かれ得た | 要求採用 |
| [EXP-000016 `.crdd`に残ったものの意味を迷わない](Analysis/EXP-000016/exploration.md) | 責任者、保持、清掃、回復がパスと結び付いていなかった | 要求採用 |
| [EXP-000017 図で意図を引き渡す](Analysis/EXP-000017/exploration.md) | 状態、境界、分岐、試験義務が後工程まで見えなかった | 要求採用 |
| [EXP-000018 Workと根拠の責任者を分ける](Analysis/EXP-000018/exploration.md) | 公開状態の伝播漏れと根拠配置の分散が起きた | 要求採用 |
| [EXP-000019 単一リポジトリの作業を守る](Analysis/EXP-000019/exploration.md) | 横断機能が普段の開発まで複雑にし得る | 要求採用 |
| [EXP-000020 複数リポジトリを一つのプロジェクトとして見る](Analysis/EXP-000020/exploration.md) | プロジェクトとリポジトリを同一視すると分離と欠測を扱えない | 要求採用 |
| [EXP-000021 人とAIの入口を同じ仕事へつなぐ](Analysis/EXP-000021/exploration.md) | 入口ごとに意味と更新処理が分かれ得る | 要求採用 |
| [EXP-000022 別Hostからプロジェクト情報へ届く](Analysis/EXP-000022/exploration.md) | リモート接続だけでは利用範囲と再取得を守れない | 要求採用 |
| [EXP-000023 会議後も論点を置き去りにしない](Analysis/EXP-000023/exploration.md) | Meeting、継続Topic、正式判断が混ざる | 要求採用 |
| [EXP-000024 複数プロジェクトを根拠付きで見比べる](Analysis/EXP-000024/exploration.md) | 要約で欠測、制限、根拠を失い得る | 要求採用 |
| [EXP-000025 リポジトリのツール能力を推測させない](Analysis/EXP-000025/exploration.md) | ツールの存在、公開、利用可能性、実行許可が混ざる | 要求採用 |
| [EXP-000026 AIモデル更新で中核を書き換えない](Analysis/EXP-000026/exploration.md) | モデル情報と接続部／中核の一連の状態変化が結合している | 要求採用 |
| [EXP-000027 プロジェクトを越えて情報を受け渡す](Analysis/EXP-000027/exploration.md) | 横断時に出所、許可、結果の帰り先を失い得る | 要求採用 |
| [EXP-000028 公式署名と利用者の信頼判断を分ける](Analysis/EXP-000028/exploration.md) | 公式配布の証明と、forkを信頼する判断が混ざる | 要求採用 |

本台帳は探索の版別対象範囲や実装順を分類しない。まだ探索を始めない長期候補は[将来候補一覧](02_Product_Candidates.md)、版と作業状態は[Roadmap](../99_Roadmap/01_Roadmap.md)が所有する。

<a id="requirement-register"></a>

## 要求台帳

要求本文は各`Definitions/REQ-*/requirement.md`が所有する。本表は、採用済み要求の所在、状態および特に関係する責務領域を一箇所から確認するための台帳であり、要求を再定義しない。`主な関係領域`は工程の通過可否を決める列ではない。採用済み要求はすべてUX以降の固定工程で処置し、新規成果へ変換、既存成果へ統合、理由付き非該当または情報不足による停止のいずれかを記録する。

| 要求 | 要約 | 探索元 | Discoveryでの判断 | 主な関係領域 |
|---|---|---|---|---|
| [REQ-000001](Definitions/REQ-000001/requirement.md) | 決定論的なリポジトリ事前確認 | [EXP-000001](Analysis/EXP-000001/exploration.md) | 要求採用 | 品質、Maintenance |
| [REQ-000002](Definitions/REQ-000002/requirement.md) | 複数AI実行の範囲・権限・回復 | [EXP-000004](Analysis/EXP-000004/exploration.md) | 要求採用 | Architecture、Development |
| [REQ-000003](Definitions/REQ-000003/requirement.md) | 目的から統合までのプロジェクトの開始から完了・再開までの状態 | [EXP-000008](Analysis/EXP-000008/exploration.md) | 要求採用 | UX、Architecture |
| [REQ-000004](Definitions/REQ-000004/requirement.md) | 実行事実の再利用可能な記録 | [EXP-000013](Analysis/EXP-000013/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000005](Definitions/REQ-000005/requirement.md) | 実行基盤責務と依存方向の分離 | [EXP-000014](Analysis/EXP-000014/exploration.md) | 要求採用 | Architecture、Development |
| [REQ-000006](Definitions/REQ-000006/requirement.md) | ローカルMCP 通信方式間の意味統一 | [EXP-000015](Analysis/EXP-000015/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000007](Definitions/REQ-000007/requirement.md) | 出典と不完全性を保つプロジェクト全体の表示 | [EXP-000007](Analysis/EXP-000007/exploration.md) | 要求採用 | UX、IA、Verification |
| [REQ-000008](Definitions/REQ-000008/requirement.md) | CROSなしで成立するリポジトリ作業 | [EXP-000019](Analysis/EXP-000019/exploration.md) | 要求採用 | UX、Architecture、RT |
| [REQ-000009](Definitions/REQ-000009/requirement.md) | プロジェクト・リポジトリ・基点フォルダの識別情報分離 | [EXP-000020](Analysis/EXP-000020/exploration.md) | 要求採用 | UX、IA、Architecture |
| [REQ-000010](Definitions/REQ-000010/requirement.md) | Workbench・MCP・CLIの公開契約共有 | [EXP-000021](Analysis/EXP-000021/exploration.md) | 要求採用 | UX、UI／SPEC、Architecture |
| [REQ-000011](Definitions/REQ-000011/requirement.md) | リモート接続の作業領域限定 | [EXP-000022](Analysis/EXP-000022/exploration.md) | 要求採用 | UX、Threat、SPEC、Architecture |
| [REQ-000012](Definitions/REQ-000012/requirement.md) | Meetingから候補を経た正本更新 | [EXP-000023](Analysis/EXP-000023/exploration.md) | 要求採用 | UX、IA、Communication |
| [REQ-000013](Definitions/REQ-000013/requirement.md) | 根拠と不完全性を保つ複数プロジェクトの一覧 | [EXP-000024](Analysis/EXP-000024/exploration.md) | 要求採用 | UX、IA、Verification |
| [REQ-000014](Definitions/REQ-000014/requirement.md) | リポジトリ ツール能力の明示登録一覧 | [EXP-000025](Analysis/EXP-000025/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000015](Definitions/REQ-000015/requirement.md) | 実行時データの基点フォルダの所有と用途 | [EXP-000016](Analysis/EXP-000016/exploration.md) | 要求採用 | Architecture、Maintenance |
| [REQ-000016](Definitions/REQ-000016/requirement.md) | AIモデル設定内容の検証可能な外部構成 | [EXP-000026](Analysis/EXP-000026/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000017](Definitions/REQ-000017/requirement.md) | 出所付き受け渡す情報一式の解決 | [EXP-000027](Analysis/EXP-000027/exploration.md) | 要求採用 | UX、IA、Architecture |
| [REQ-000018](Definitions/REQ-000018/requirement.md) | 実行環境の信頼要素の分離 | [EXP-000028](Analysis/EXP-000028/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000019](Definitions/REQ-000019/requirement.md) | 契約移行時の利用側閉包 | [EXP-000014](Analysis/EXP-000014/exploration.md) | 要求採用 | Maintenance、Architecture、Verification |
| [REQ-000020](Definitions/REQ-000020/requirement.md) | 欠測・競合を保つリポジトリ横断統合 | [EXP-000020](Analysis/EXP-000020/exploration.md) | 要求採用 | UX、IA、Architecture |
| [REQ-000021](Definitions/REQ-000021/requirement.md) | リモート要求結果の同一識別情報再取得 | [EXP-000022](Analysis/EXP-000022/exploration.md) | 要求採用 | UX、SPEC、Architecture、Verification |
| [REQ-000022](Definitions/REQ-000022/requirement.md) | 実行時データの保持・清掃・回復 | [EXP-000016](Analysis/EXP-000016/exploration.md) | 要求採用 | Architecture、Maintenance、Verification |
| [REQ-000023](Definitions/REQ-000023/requirement.md) | 異なるAI実行環境の開始から終了・回復までの接続部分離 | [EXP-000026](Analysis/EXP-000026/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000024](Definitions/REQ-000024/requirement.md) | 境界を越えるタスク結果の帰還 | [EXP-000027](Analysis/EXP-000027/exploration.md) | 要求採用 | UX、SPEC、Architecture |
| [REQ-000025](Definitions/REQ-000025/requirement.md) | 導入責任者が所有する信頼方針 | [EXP-000028](Analysis/EXP-000028/exploration.md) | 要求採用 | Architecture、Verification |
| [REQ-000026](Definitions/REQ-000026/requirement.md) | 判断・監査・是正の収束可能な閉包 | [EXP-000002](Analysis/EXP-000002/exploration.md) | 要求採用 | Agent、Maintenance、Audit |
| [REQ-000027](Definitions/REQ-000027/requirement.md) | 外部情報の送信・昇格境界 | [EXP-000003](Analysis/EXP-000003/exploration.md) | 要求採用 | Principles、Communication、Dependency |
| [REQ-000028](Definitions/REQ-000028/requirement.md) | AI入口と共通正本の分離 | [EXP-000006](Analysis/EXP-000006/exploration.md) | 要求採用 | Agent、Documentation |
| [REQ-000029](Definitions/REQ-000029/requirement.md) | 推論に使った情報の履歴・現行性・選択 | [EXP-000009](Analysis/EXP-000009/exploration.md) | 要求採用 | Discovery、全工程、AIが使う情報 |
| [REQ-000030](Definitions/REQ-000030/requirement.md) | 段階的実境界試験と回帰選択 | [EXP-000010](Analysis/EXP-000010/exploration.md) | 要求採用 | Verification、品質、Architecture |
| [REQ-000031](Definitions/REQ-000031/requirement.md) | 人の理解順と構造を両立する成果物 | [EXP-000011](Analysis/EXP-000011/exploration.md) | 要求採用 | Documentation、全工程 |
| [REQ-000032](Definitions/REQ-000032/requirement.md) | 工程固有の基本図と意図引き渡し | [EXP-000017](Analysis/EXP-000017/exploration.md) | 要求採用 | 全工程、Checker、Verification |
| [REQ-000033](Definitions/REQ-000033/requirement.md) | 作業の一連の流れと根拠所有の分離 | [EXP-000018](Analysis/EXP-000018/exploration.md) | 要求採用 | Roadmap、Change、リリース、品質 |
| [REQ-000034](Definitions/REQ-000034/requirement.md) | リポジトリ固定Commitから使える標準ツール | [EXP-000005](Analysis/EXP-000005/exploration.md) | 要求採用 | ツール、Template、リリース |
| [REQ-000035](Definitions/REQ-000035/requirement.md) | 公式視覚素材の権利・用途・追跡 | [EXP-000012](Analysis/EXP-000012/exploration.md) | 要求採用 | Communication、リリース |
| [REQ-000036](Definitions/REQ-000036/requirement.md) | 差し替え可能な履歴管理境界 | [EXP-000014](Analysis/EXP-000014/exploration.md) | 要求採用 | Architecture、全ツール |

<a id="current-discovery-relations"></a>

## 探索同士の関係

個別探索を一つの完成システムへまとめるのはUX以降の責務である。Discoveryでは、どの問題が同じ利用体験へ合流しそうかだけを示す。

```text
プロジェクトの現在地 ───────────────┐
単一リポジトリ作業 ────────────┤
複数リポジトリのプロジェクト ───────┤
Topic・Meetingの継続 ──────────┼→ プロジェクトを理解して次の仕事へ進む体験
複数プロジェクトの一覧での比較 ─────────────┤
人とAIの共通入口 ──────────────┘

リモート 情報 ───────┐
プロジェクト間の受け渡し ─┼→ CROSを介して安全に届く体験
利用者所有信頼 ─────┘

ツール能力の発見 ──────┐
AI実行基盤の変更 ────┼→ 変化しても入口と実行契約を保つ体験
実行時データの所有 ──┘
```

この関係はUXへ渡す仮説であり、構成要素構成やサービス提供の流れの正本ではない。

## 基本図の処置

基本図は、対象となる問題と業務過程がある個別探索で作成する。本表は図を一か所へ再集約せず、CRDD標準自身の全探索を横断した現在の処置を示す。

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 課題・根拠・機会の関係 | 各`EXP-*` | 問題、根拠、仮説および採用要求の因果 | `既存参照` | [探索台帳](#探索台帳)から各`exploration.md`の因果説明・図へ進む | 各探索の記載根拠 | 現行 | 遡及再構成した探索の当時の未観測範囲 | 新しい根拠が仮説または要求を変える時 |
| 業務範囲／入出力（SIPOC） | 業務過程を扱う`EXP-*` | 対象境界と入出力 | `作成不能` | 全28探索を一つの業務過程へ畳めない。対象探索で必要になった時に作成する | 各探索 | 対象別 | 現在は横断SIPOCの共通Supplier／Outputを定義していない | 業務過程を持つ探索の開始・再Discovery時 |
| 担い手別の仕事の流れ（Swimlane） | 担い手同士の受け渡しを扱う`EXP-*` | 活動、判断および受け渡し | `作成不能` | 探索全体に単一の担い手列を置くと、後工程の完成システム像を先取りする | 各探索 | 対象別 | 採用した要求を統合した担い手同士の体験 | UXの[サービス提供の流れ](../02_UX/04_Service_Blueprint.md)で統合する |
| 価値が届くまでの流れ | 待機・滞留・手戻りを扱う`EXP-*` | 処理、待機、滞留および手戻り | `作成不能` | 全探索共通の処理時間・待機・流量は観測していない | 各探索 | 対象別 | 時間・頻度・手戻り量 | 実運用で対象値を観測した時 |
| 現状／変更後 | 各`EXP-*` | 現状の困りごとと望ましい変化 | `既存参照` | [探索台帳](#探索台帳)から各記録の問題、仮説、選択へ進む | 各探索 | 現行 | 実利用での変化量 | UXのExperience Changeと実測で具体化する |
| 項目間全体像 | 全体 | 探索間の関係、競合およびUXへの合流候補 | `作成` | [探索同士の関係](#探索同士の関係) | 本書の探索・要求台帳 | 現行 | UXで確定する体験全体と提供責務 | 要求追加・統合判断変更時 |

<a id="human-understanding-confirmation"></a>

## 人間理解の確認

本書の28探索と36要求は、既存CHG、根拠、公開記録および保守対話から2026-09-13に再構成し、人間が課題、要求、対象外およびUXへの移行を確認した。理解確認の具体的な問題・仮説・修正は各`exploration.md`が所有し、本書へ複製しない。新しい探索では、AIが課題認識を再構成した場合に該当記録へ確認内容を残し、要求採用とは別に扱う。

<a id="current-discovery-decisions"></a>

## UXへ渡す現在の判断

| UXで扱うこと | Discoveryから渡す条件 | まだ証明できていないこと |
|---|---|---|
| リポジトリ内の普段の作業 | CROSやWorkbenchを使わなくても成立する | 横断機能追加後も負担が増えないか |
| プロジェクトの現在地確認 | 出典、観測時点、欠測、制限、競合を失わない | WorkbenchがAIや静的報告より役立つか |
| 複数リポジトリのプロジェクト | リポジトリ分割を普段は意識させず、不足は隠さない | 代表構成以外でも理解できるか |
| TopicとMeeting | 候補、確認、採用、正本更新を区別する | 実Meetingで転記漏れと確認負担が減るか |
| 複数プロジェクトの一覧 | 読取り専用とし、根拠プロジェクトへ戻れる | PM／経営・管理層に必要な情報が足りるか |
| 人とAIの入口 | Workbench、MCP、CLIは同じ公開契約を使う | 各入口で同じ意味と結果になるか |
| リモート利用 | 認証、作業領域範囲、部分取得、応答喪失後の再取得を扱う | 実Networkと長期接続単位で成立するか |

個別探索で採用した要求と検証義務は、UXで都合よく統合、弱化、追加しない。新しい課題や必要性が分かった場合は、該当する探索へ戻すか、新しい`EXP-*`を発行してDiscoveryで判断する。

<a id="ux-handoff"></a>

## UXへの入口と戻り方

### UXへ進める条件

- 対象の`EXP-*`で、本当の問題、置いた仮説、守る条件、未確認事項が読める。
- 人間が採用した内容だけが`REQ-*`または現在の判断として区別されている。
- 複数の探索を統合する場合、どの条件を引き継いだかを示せる。
- 成果を判断するための検証義務が残っている。

### Discoveryへ戻す条件

- UXで、前提にしていた利用者や問題が違うと分かった。
- 複数の探索を統合すると、守る条件が競合した。
- 新しい必要性を`REQ-*`として採用する必要がある。
- 解決仮説を縮小または棄却する根拠が得られた。

UXは、ここで渡した課題と仮説を利用者の仕事として深掘りし、最終的にサービス提供の流れで一つの体験へ接続する。Discoveryはその完成形を先回りして定義しない。
