# 振る舞い仕様

状態: Canonical（v0.21.0、公開済みの基準版: v0.20.1）
担当責任者: Qual-Lab
対象版: v0.21.0
工程規則: [振る舞い仕様](../26_Behavior_Specification.md)、[UIとSPECの対応](../24_UI_Behavior_Specification.md)

## 1. SPEC工程で解くこと

UXが求める利用者成果と、IAが定めた情報・状態・関係を別々に分析し、観測可能な契機、条件、状態、結果、失敗、回復および受入条件へ統合する。REQはUXを介した履歴として辿れるが、SPECの直接入力にはしない。

```text
UX定義 ── 利用者が得る結果 ─→ UX観点のSPEC分析 ─┐
                                                    ├─→ SPEC定義
IA定義 ── 対象・状態・関係 ───→ IA観点のSPEC分析 ─┘

UI定義 ───── pairs_with ───── SPEC定義
```

## 2. 入力と網羅状況

| 入力／成果 | 件数 | 現在の処置 |
|---|---:|---|
| UX定義 | 31 | 全件を`Analysis/UX-*/spec_analysis.md`で個別分析する |
| IA定義 | 21 | 全件を`Analysis/IA-*/spec_analysis.md`で個別分析する |
| SPEC分析 | 52 | UX観点とIA観点を混ぜずに保持する |
| SPEC定義 | 29 | 独立して条件・状態・結果を変更／検証できる振る舞い単位へ統合する |
| UI定義 | 19 | 多対多の`pairs_with`で操作・Feedbackと対応づける |

## 3. SPEC定義台帳

| SPEC | 観測可能な振る舞い契約 | 主な入力UX | 主な入力IA | 対応UI |
|---|---|---|---|---|
| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | 事前検査を実行し意味レビューへ案内する | `UX-000001` | `IA-000001` | `UI-000001` |
| [SPEC-000002](Definitions/SPEC-000002/spec_definition.md) | 委任範囲と権限を確定して受理する | `UX-000002`、`UX-000005` | `IA-000002` | `UI-000002` |
| [SPEC-000003](Definitions/SPEC-000003/spec_definition.md) | 委任した仕事の状態と判断要否を返す | `UX-000003` | `IA-000002`、`IA-000003` | `UI-000002` |
| [SPEC-000004](Definitions/SPEC-000004/spec_definition.md) | 失敗後の再試行と回復を安全に選別する | `UX-000004`、`UX-000022` | `IA-000003`、`IA-000012` | `UI-000003` |
| [SPEC-000005](Definitions/SPEC-000005/spec_definition.md) | 残存資源を清掃し終了後を確認する | `UX-000017`、`UX-000022` | `IA-000003`、`IA-000012` | `UI-000003`、`UI-000011` |
| [SPEC-000006](Definitions/SPEC-000006/spec_definition.md) | Projectと節目の現在状態を投影する | `UX-000005`、`UX-000009` | `IA-000002`、`IA-000006` | `UI-000004` |
| [SPEC-000007](Definitions/SPEC-000007/spec_definition.md) | 複数Projectを比較可能な投影へ統合する | `UX-000015` | `IA-000006` | `UI-000004` |
| [SPEC-000008](Definitions/SPEC-000008/spec_definition.md) | 実行事実と評価を区別して取得する | `UX-000006` | `IA-000004` | `UI-000005` |
| [SPEC-000009](Definitions/SPEC-000009/spec_definition.md) | 実行基盤の故障境界と利用可能範囲を診断する | `UX-000008` | `IA-000020` | `UI-000005` |
| [SPEC-000010](Definitions/SPEC-000010/spec_definition.md) | Repositoryと実行対象のBindingを解決する | `UX-000010`、`UX-000011` | `IA-000006`、`IA-000007` | `UI-000006` |
| [SPEC-000011](Definitions/SPEC-000011/spec_definition.md) | 複数入口で同じ依頼・結果契約を保つ | `UX-000012` | `IA-000008` | `UI-000007` |
| [SPEC-000012](Definitions/SPEC-000012/spec_definition.md) | 接続資格からWorkspace利用範囲を確定する | `UX-000013` | `IA-000009` | `UI-000008` |
| [SPEC-000013](Definitions/SPEC-000013/spec_definition.md) | Meeting内容を候補化し所有正本へ昇格する | `UX-000014` | `IA-000010` | `UI-000009` |
| [SPEC-000014](Definitions/SPEC-000014/spec_definition.md) | Repositoryに適合する標準Toolを解決する | `UX-000016` | `IA-000011` | `UI-000010` |
| [SPEC-000015](Definitions/SPEC-000015/spec_definition.md) | AIモデル構成を検証し実効選択を決める | `UX-000018` | `IA-000013` | `UI-000010` |
| [SPEC-000016](Definitions/SPEC-000016/spec_definition.md) | 実行時データの配置・保持・清掃を制御する | `UX-000017`、`UX-000022` | `IA-000012`、`IA-000003` | `UI-000011` |
| [SPEC-000017](Definitions/SPEC-000017/spec_definition.md) | Task情報と結果を同じ仕事へ引き継ぎ再取得する | `UX-000019`、`UX-000021` | `IA-000014`、`IA-000003` | `UI-000012` |
| [SPEC-000018](Definitions/SPEC-000018/spec_definition.md) | Runtimeの信頼要素を独立評価する | `UX-000020`、`UX-000031` | `IA-000015` | `UI-000013` |
| [SPEC-000019](Definitions/SPEC-000019/spec_definition.md) | 責務変更後の利用側閉包を検証する | `UX-000007` | `IA-000005` | `UI-000014` |
| [SPEC-000020](Definitions/SPEC-000020/spec_definition.md) | 変更・監査・試験・品質の閉包を評価する | `UX-000023`、`UX-000026`、`UX-000029` | `IA-000016` | `UI-000015` |
| [SPEC-000021](Definitions/SPEC-000021/spec_definition.md) | 外部送信の同意範囲を検証して送信する | `UX-000024` | `IA-000014`、`IA-000017` | `UI-000016` |
| [SPEC-000022](Definitions/SPEC-000022/spec_definition.md) | 過去情報と現在有効な意図を区別して解決する | `UX-000025` | `IA-000021` | `UI-000017` |
| [SPEC-000023](Definitions/SPEC-000023/spec_definition.md) | 文書の物語・構造・図と工程引継ぎを検査する | `UX-000027`、`UX-000028` | `IA-000018` | `UI-000018` |
| [SPEC-000024](Definitions/SPEC-000024/spec_definition.md) | 公式素材の由来・権利・用途を確認する | `UX-000030` | `IA-000019` | `UI-000019` |
| [SPEC-000026](Definitions/SPEC-000026/spec_definition.md) | 外部処理の結果を元の仕事へ持ち帰る | `UX-000024` | `IA-000014`、`IA-000017` | `UI-000016` |
| [SPEC-000027](Definitions/SPEC-000027/spec_definition.md) | 持ち帰った候補を所有正本へ昇格する | `UX-000024` | `IA-000014`、`IA-000017` | `UI-000016` |
| [SPEC-000028](Definitions/SPEC-000028/spec_definition.md) | Taskの取消を要求し終了状態を確認する | `UX-000003` | `IA-000003` | `UI-000002` |
| [SPEC-000029](Definitions/SPEC-000029/spec_definition.md) | 判断待ちTaskへ判断を返し再開可能にする | `UX-000003` | `IA-000002` | `UI-000002` |
| [SPEC-000030](Definitions/SPEC-000030/spec_definition.md) | 実行事実を同じ契約で記録する | `UX-000032` | `IA-000022` | `UI-000020` |

## 4. 振る舞いの種類


| 種類 | 主なSPEC | 完了の意味 |
|---|---|---|
| 照会・投影 | 000003、000006、000007、000008、000010、000014、000018、000022 | 対象を変更せず、根拠・不足・観測時点を伴う結果を返す |
| 判定・分類 | 000001、000004、000009、000019、000020、000023 | 判断対象と根拠を固定し、未確定を成功へ畳まない |
| 記録・状態変更 | 000002、000012、000013、000015、000016、000024、000027、000029、000030 | 必要なAuthorityの下で、発行した変更と耐久確定を区別する |
| 外部Effect・結果帰還 | 000005、000017、000021、000026、000028 | 同意、送信、結果帰還、再接続、取消、終了後確認を各SPECの適用範囲で分ける |
| 通信方式の変換 | 000011 | 入口を変えても意味契約やAuthorityを変えない |

各SPEC定義は上表の共通形ではなく、固有の契機、Authority、状態、副作用および失敗を正本とする。

## 5. 基本図の処置

| 基本図 | 処置 | 現行図 | 未確認範囲 |
|---|---|---|---|
| Use Case／振る舞いFlow | 作成 | [利用場面と振る舞いFlow](02_Use_Case_and_Behavior_Flow.md) | 実利用時の頻度・順序 |
| 状態遷移表／状態遷移図 | 作成 | [状態遷移](03_State_Transition_Model.md) | 実装状態値との対応 |
| Actor／System間Sequence図 | 作成 | [Actor／System間Sequence](04_Actor_System_Sequence.md) | 外部境界ごとの実測 |
| Error／Effect分岐図 | 作成 | [失敗・Effect・回復](05_Error_Effect_and_Recovery.md) | 外部依存固有の障害 |
| UI／SPEC対応図 | 作成 | [UI／SPEC対応](06_UI_SPEC_Correspondence.md) | 対応レビュー結果 |

## 6. 現在状態と次工程

32件のUX定義と22件のIA定義を別々に分析し、29件の振る舞い仕様へ統合した。Quality分析でREQ-000004の記録側成立条件が取得契約へ縮退していたGapを検出し、記録する側のUX-000032、IA-000022、UI-000020を通して、取得とは別のState Owner、Effect、失敗を持つSPEC-000030へ再導出した。現行実装との比較は[現行振る舞い参照](07_Current_Behavior_Reference.md)で行い、分析の不足を現行コードから補完していない。更新後のUI／SPEC対応は再レビュー待ちである。
