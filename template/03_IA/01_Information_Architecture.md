# 情報アーキテクチャ（Information Architecture）

状態: [分析中／レビュー中／引き渡し可能]
担当責任者: [owner]
最終更新日: YYYY-MM-DD
工程規則: [IA](../../23_IA.md)

## 1. 何を分かりやすくするか

[利用者が何を見分け、どの判断や行動へ進める必要があるかを、画面・DB・APIより先に説明する。]

```text
UX定義 → IA分析 → IA定義 → UI／SPEC／Architecture
```

## 2. 入力と網羅状況

| 入力 | 件数 | 現在の処置 |
|---|---:|---|
| UX定義 | [n] | [全件分析済み／不足あり] |
| IA分析 | [n] | [候補抽出・統合判断] |
| IA定義 | [n] | [定義候補／採用後に現在有効な意味] |

## 3. IA定義台帳

| IA | 利用者が見分ける情報 | 主な入力UX |
|---|---|---|
| [IA-XXXXXX](Definitions/IA-XXXXXX/ia_definition.md) | [意味] | [UX-ID] |

## 4. 全体の情報構造

[個別定義を横断したオブジェクト・関係・導線を図で示す。]

## 5. 基本図の処置

処置は`作成`、`既存参照`、`非該当`、`作成不能`のいずれかとする。

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| オブジェクト／関係図 | [対象] | [目的] |  | [link/reason] | [revision] | [state] | [scope] | [next] |
| 情報階層図 | [対象] | [目的] |  | [link/reason] | [revision] | [state] | [scope] | [next] |
| Navigation図 | [対象] | [目的] |  | [link/reason] | [revision] | [state] | [scope] | [next] |
| 可視性／状態概念図 | [対象] | [目的] |  | [link/reason] | [revision] | [state] | [scope] | [next] |

## 6. 現在状態と次工程

[確定事項、未確認事項、人間判断、UI／SPEC／Architectureへ渡す意味を記す。]
