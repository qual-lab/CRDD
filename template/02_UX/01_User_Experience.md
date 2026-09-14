# User Experience

工程規則: `00_CRDD/22_UX.md`
状態: （UX分析中／Complete for Scope／Blocked）
維持責任者: （記入）
判断する人: （記入）

本書はUX工程の固定入口である。Product全体の体験意図、Canonical UX成果、REQとのCoverage、詳細成果物へのNavigationを所有する。Persona、横断Experience Map、Service Blueprintprintおよび品質期待の詳細を複製しない。

```text
DiscoveryのREQ-*
      ↓ 個別分析
Analysis/<REQ-ID>/ux_analysis.md
      ↓ Same／Newを横断判断
Definitions/<UX-ID>/experience.md
      ↓
Persona・Experience Map・Service Blueprint・品質期待
      ↓
IA／UI／SPEC／Verification
```

## 1. Product Experience Intent

誰の何を、なぜ良くするのか、利用者に起きる中心的な変化、守る体験原則および目指さないことを短く示す。

## 2. UX成果台帳

| UX成果 | 利用者成果 | 入力REQ | 主な体験区間 | 現在状態 |
|---|---|---|---|---|
| [UX-XXXXXX](Definitions/UX-XXXXXX/experience.md) | | `REQ-XXXXXX` | | |

## 3. REQとUX成果のCoverage

採用された全要求について、個別分析とCanonical UXへの処置を示す。要求を一対一のUXへ固定しない。

| REQ | 個別分析 | UX成果／処置 | 未確認範囲 |
|---|---|---|---|
| `REQ-XXXXXX` | [分析](Analysis/REQ-XXXXXX/ux_analysis.md) | | |

## 4. UX全体の関係

Canonical UX成果が、どのPersona、体験区間、重要場面および品質期待へ接続するかを人間向けの図で示す。Relationの厳密な正本は前節の台帳と各詳細成果物が所有する。

```text
Persona
   ↓
Experience Map ──→ UX-*
   │                 │
   ▼                 ▼
Service Blueprint  品質期待
   └────────┬────────┘
            ▼
      下流への引き渡し
```

## 5. 詳細成果物への案内

| 読みたいこと | 所有成果物 |
|---|---|
| 誰が、どんな状況で使うか | [Personas](02_Personas.md) |
| 利用者の仕事が全体でどう流れるか | [Experience Map](03_Experience_Map.md) |
| その体験を誰・何がどう支えるか | [Service Blueprint](04_Service_Blueprint.md) |
| 体験として何を守るか | [Quality Expectations](05_Quality_Expectations.md) |
| 各要求をどうUXへ変換したか | `Analysis/<REQ-ID>/ux_analysis.md` |

## 基本図の処置

図の本体は責務を持つ横断成果物へ置く。本表は図を複製せず、現在状態と一意な参照を示す。各行は`作成`、`既存参照`、`非該当`、`作成不能`のいずれかで処置する。

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 利用者Journey | Product全体／主要Persona | 時間をまたぐ利用者の仕事と判断 | `既存参照` | [Experience Map](03_Experience_Map.md) | | | | |
| 重要場面・失敗／回復体験図 | Product全体／UX-* | 誤認・損失・回復と品質期待の発生点 | | [Quality Expectations](05_Quality_Expectations.md) | | | | |
| Service Blueprint | Product全体／主要Journey | 利用者接点と提供側責務の接続 | | [Service Blueprint](04_Service_Blueprint.md) | | | | |

## 6. 現在状態と次工程への引き渡し

| 項目 | 内容 |
|---|---|
| 対象範囲・網羅状態 | |
| 人間による判断 | |
| 未解決事項と戻り先 | |
| IA／UI／SPEC／Verificationへ渡す義務 | |
| 工程移行レビュー | |
