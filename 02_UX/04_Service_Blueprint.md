# CRDD／CROS Service Blueprint

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [UX](../22_UX.md)

本書は、CRDD／CROSの主要な利用体験を、人間、利用者接点、公開Application Contract、Runtime、Repositoryおよび確認・回復責務へ接続する。内部Component構成やProtocolはArchitectureが所有する。

## 1. 共同Service Blueprint

```text
利用者
  [目的・対象を示す] ─→ [現在状態を理解] ─→ [候補・判断を確認] ─→ [次の仕事へ進む]
          │                       │                     │
============================== 可視境界 ==================================
          ▼                       ▼                     ▼
接点
  Chat Agent／CLI／MCP ─────→ Workbench／結果表示 ───→ 判断・回復の入口
          │                       │                     │
          ▼                       ▼                     ▼
公開契約
  [入力とAuthority確認] ─────→ [同じ意味の状態・結果] ─→ [Command／Candidate]
          │                       │                     │
          ▼                       ▼                     ▼
提供側
  [正本とSourceを解決] ──────→ [処理・投影・相関] ───→ [記録・再取得・回復]
          │                       │                     │
          ▼                       ▼                     ▼
根拠・運用
  Repository／Evidence ──────→ Coverage／現在性 ─────→ 検証・改善へ戻す
```

入口ごとに別の業務状態、権限判断または結果を作らない。Workbenchは人間向けの薄いSurface、MCP／CLIは別のTransportであり、いずれも同じ公開Application Contractへ接続する。

## 2. 主要区間と責任境界

| 区間 | 利用者が経験すること | 提供側が担うこと | 越えてはならない境界 | 失敗・回復 |
|---|---|---|---|---|
| Contextを選ぶ | 現在使えるSourceと不足を理解する | Repository、Workspace、Constraint、現在性を検証する | 利用不能Sourceを推測探索しない | `restricted`、`unavailable`、`unknown`を分ける |
| 依頼・確認する | 目的、対象、許可範囲、費用影響を理解する | Canonical入力と必要Authorityを構成する | 接続や表示だけからEffect Authorityを発行しない | 判断不足ならEffect 0で戻す |
| 実行・待機する | 実行中、待機、停止、判断要否を理解する | Task Identity、状態、取消、外部境界を相関する | 無反応を成功や安全な取消へ畳まない | 同じIdentityで状態確認・回復へ進む |
| 結果を受け取る | 結果、根拠、欠測、Risk、採否を区別する | Source、Revision、Coverageと結果を結合する | Agent完了や部分結果を採用・完成へ昇格しない | 不完全性を保って再取得または判断待ちにする |
| 候補を反映する | 試案、比較、採用、正本反映を区別する | 所有正本のCommandと決定権限へ戻す | ProjectionやMeeting記録を直接正本へ昇格しない | Candidateを保持し、判断後に再投影する |
| 停止後に戻る | 再試行、再取得、Recovery、Cleanupを選べる | Effect State、残存、exact Recovery Identityを保持する | 新規実行で不明Effectを上書きしない | 回復不能なら理由と手動処置を示す |

## 3. Agent Handoff

```text
Human／Customer
      ↕ 対話・判断
Chat Agent
      ↕ 構造化Handoff
    CROS
      ↕ Operating Context／Resume
Coding Agent
      ↕ Result／Evidence／Decision Request
Repository
```

会話全文、秘密値または全Repository ContextをHandoffへ複製しない。承認済み目標、必要なContext、判断境界、結果、未決事項および再開条件を同じTaskへ接続する。

## 4. Milestone委任

```text
Objectiveと受入条件を示す
          ↓
Project RuntimeがTaskへ分解・実行
          ↓
部分結果を統合し、品質を確認
          ↓
判断が必要？ ── Yes ─→ 人間へ理由・選択肢・影響
          │                         │
          No                        └──→ 同じMilestoneへ再開
          ↓
Milestoneの成立状態を提示
```

利用者へ内部Task列の逐次操作を要求せず、Task成功数をMilestone完成へ読み替えない。

## 5. 未確認事項

- 実利用で、どの区間に最も再探索、待機または誤認が集中するか。
- Workbenchの定型操作とChat Agentによる柔軟な判断支援の境界。
- Remote、複数Repositoryおよび応答喪失時に、同じ公開契約が体験として同値になるか。
