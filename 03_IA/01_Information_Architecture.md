# CRDD／CROSの情報アーキテクチャ

状態: 引き渡し可能（v0.21.0、公開済みの基準版: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [IA](../23_IA.md)

## 1. 何を分かりやすくするか

利用者は、内部のファイル、Process、通信方式を覚えるのではなく、いま扱っている対象、現在状態、根拠、判断が必要な箇所、次の安全な行動を理解する必要がある。IAは、[31件の利用者成果](../02_UX/01_User_Experience.md#22-要求を利用者成果へまとめた結果)を、利用者が見分けて辿れる情報の単位、関係、状態、導線へ変換する。

```text
31件のUX定義
      │
      ▼
UXごとのIA分析 ──→ 現行文書・実装との照合
      │                    │
      └────────┬───────────┘
               ▼
          IA定義
    （現在有効な意味の正本）
               │
      ┌────────┼────────┐
      ▼        ▼        ▼
  情報構造   Navigation  状態・責任
               │
               ▼
          UI／SPEC／Architecture
```

画面、API、DB、Class、Folderを先に決めない。現行実装は、UXから導いた意味を現在支えられるかを確認する根拠であり、利用者の情報構造を決める正本ではない。

## 2. 入力と網羅状況

| 入力 | 件数 | 現在の処置 |
|---|---:|---|
| UX定義 | 31 | 全件を`Analysis/UX-*/ia_analysis.md`で個別分析する |
| IA分析 | 31 | 対象、関係、状態、可視性、導線、責任を抽出し、既存設計と照合する |
| IA定義 | 21 | 複数UXで共有する意味を統合し、独立して変更・検証できる利用者向け情報単位へIDを発行する |
| 現行IA | 1 | v0.19～v0.21の内容を再分類し、現行正本へ移す |
| Architecture／実装 | 11責務領域 | IA定義の実在性と利用側を照合する。内部構造はIAへ昇格しない |

個別分析は[Analysis](Analysis/)に、現在有効な意味定義は[Definitions](Definitions/)に置く。個別分析から複数のIA定義が生じる場合も、複数分析を一つのIA定義へまとめる場合もある。

## 3. IA定義台帳

| IA | 利用者が見分ける情報 | 主な入力UX |
|---|---|---|
| [IA-000001](Definitions/IA-000001/ia_definition.md) | 検査対象・条件・指摘 | `UX-000001` |
| [IA-000002](Definitions/IA-000002/ia_definition.md) | 目的・節目・Task・受入・判断 | `UX-000002`、`UX-000003`、`UX-000005` |
| [IA-000003](Definitions/IA-000003/ia_definition.md) | 実行・失敗・外部作用・回復 | `UX-000003`、`UX-000004`、`UX-000021`、`UX-000022` |
| [IA-000004](Definitions/IA-000004/ia_definition.md) | 実行事実・観測・評価 | `UX-000006` |
| [IA-000005](Definitions/IA-000005/ia_definition.md) | 成立済み能力・契約・利用側・置換根拠 | `UX-000007` |
| [IA-000006](Definitions/IA-000006/ia_definition.md) | Project・Repository・Binding・Projection | `UX-000009`、`UX-000011`、`UX-000015` |
| [IA-000007](Definitions/IA-000007/ia_definition.md) | 手元の情報源と横断情報源 | `UX-000010` |
| [IA-000008](Definitions/IA-000008/ia_definition.md) | 公開受付・通信方式・結果 | `UX-000012` |
| [IA-000009](Definitions/IA-000009/ia_definition.md) | 接続資格・作業領域・公開範囲 | `UX-000013` |
| [IA-000010](Definitions/IA-000010/ia_definition.md) | Meeting・Topic・候補・採否 | `UX-000014` |
| [IA-000011](Definitions/IA-000011/ia_definition.md) | Tool能力・利用可否・配布根拠 | `UX-000016` |
| [IA-000012](Definitions/IA-000012/ia_definition.md) | 実行時データ・保持・清掃 | `UX-000017`、`UX-000022` |
| [IA-000013](Definitions/IA-000013/ia_definition.md) | AIモデル構成・選択・再選定 | `UX-000018` |
| [IA-000014](Definitions/IA-000014/ia_definition.md) | 受け渡す情報・Task・結果・帰還 | `UX-000019`、`UX-000021`、`UX-000024` |
| [IA-000015](Definitions/IA-000015/ia_definition.md) | 準拠・改ざん有無・配布者・信頼方針 | `UX-000020`、`UX-000031` |
| [IA-000016](Definitions/IA-000016/ia_definition.md) | 変更・指摘・是正・試験・品質 | `UX-000023`、`UX-000026`、`UX-000029` |
| [IA-000017](Definitions/IA-000017/ia_definition.md) | 外部送信先・目的・分類・同意・候補 | `UX-000024` |
| [IA-000018](Definitions/IA-000018/ia_definition.md) | 物語・構造・図・引き渡す意図 | `UX-000027`、`UX-000028` |
| [IA-000019](Definitions/IA-000019/ia_definition.md) | 公式素材・由来・権利・用途 | `UX-000030` |
| [IA-000020](Definitions/IA-000020/ia_definition.md) | 実行基盤の故障箇所と利用可能範囲 | `UX-000008` |
| [IA-000021](Definitions/IA-000021/ia_definition.md) | 過去の判断と現在有効な意図 | `UX-000025` |

## 4. 全体の情報構造

```text
[O: 利用者の仕事]
   │ --目的を定める-->
   ▼
[O: Project／変更／実行]
   │
   ├─ --対象を特定--> [O: Repository／Binding／改訂版]
   ├─ --状態を示す--> [O: 現在状態／不足／競合／観測時点]
   ├─ --根拠へ戻る--> [O: 情報源／試験／Evidence]
   ├─ --判断を求める--> [O: 選択肢／決定権限／次の行動]
   └─ --失敗後に戻る--> [O: 結果／残存物／回復対象]

入口
├ [N: Repository内の文書・CLI]
├ [N: MCP]
└ [N: Workbench]
       │
       └─ 入口は違っても同じ対象・状態・根拠・判断へ到達する
```

詳細は[情報オブジェクトと関係](02_Object_and_Relation_Model.md)、[情報のまとまりと導線](03_Information_Structure_and_Navigation.md)、[状態・可視性・責任](04_State_Visibility_and_Responsibility.md)に投影する。

## 5. 基本図の処置

| 基本図 | 処置 | 現行図 | 未確認範囲 |
|---|---|---|---|
| オブジェクト／関係図 | 作成 | [情報オブジェクトと関係](02_Object_and_Relation_Model.md) | 実利用者が同じ単位で対象を見分けるか |
| 情報階層図 | 作成 | [情報のまとまり](03_Information_Structure_and_Navigation.md#2-情報のまとまり) | Workbenchの具体的な表示量 |
| Navigation図 | 作成 | [入口から根拠・次の行動まで](03_Information_Structure_and_Navigation.md#3-入口から根拠次の行動まで) | Prototypeでの到達しやすさ |
| 可視性／状態概念図 | 作成 | [状態と可視性](04_State_Visibility_and_Responsibility.md) | 支援技術、端末差、認知負荷 |

## 6. 現在状態と次工程

IAは31件のUX定義から対象・識別・関係・状態・可視性・導線・責任を再導出し、入力固有の意味を失わない21件のIA定義へ統合した。独立レビューは意味伝播と関係閉包をCritical／Major／Moderate／Minor 0で確認した。UI部品、画面遷移、API、保存形式、状態実値は未確定であり、下流工程が本IAを満たす方法を比較する。

工程完了には、全31分析と21定義の独立再レビュー、UXだけからの再導出結果と現行文書・実装からの照合結果の分離、基本図の意味確認が必要である。IA-000020とIA-000021への分割は、人間の決定権限者が2026-09-15に採用した。
