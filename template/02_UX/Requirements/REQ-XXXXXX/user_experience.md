# REQ-XXXXXXの利用者体験分析

状態: UX分析中
要求: `REQ-XXXXXX` （要求名）
探索元: （該当するExplorationへの参照）

本書は要求を機能へ言い換える文書ではない。誰の何が問題かを確認し、利用者のGoalとOutcome、利用前後の変化、Canonical UXへの統合、重要場面と下流義務を順に導く。図を人間が理解する主表現にし、ID、Relation、Coverageおよび処置は表で厳密に残す。

## 1. REQの一次分析

```text
┌──────────────────────────────┐
│ REQ-XXXXXX （要求名）         │
└──────────────┬───────────────┘
               │
               ▼
          解決したい問題
               │
        ┌──────┴──────┐
        ▼             ▼
   （困りごと）    （補完・誤認）
        └──────┬──────┘
               ▼
          UXとして必要
               │
               ▼
      （解決策から独立したNeed）
```

（なぜ人の体験として扱うか、探索上の課題、対象範囲、対象外、保持する制約を短く説明する。）

## 2. 利用者・目標・成果

```text
        （Product横断Persona）
                  │
             wants to
                  ▼
              （Goal）
                  │
              so that
                  ▼
             （Outcome）
```

| 項目 | 内容 |
|---|---|
| Primary Persona | （`02_Personas.md`の参照） |
| Related Persona | （該当時のみ） |
| 利用場面 | |
| REQ固有の差 | （横断Personaへ複製しない状況、制約、判断差） |
| 根拠・確信度 | （観測／人間判断／仮説と参照） |

## 3. 利用者に起きる変化

```text
Before
────────────────
（現在の仕事・負担・判断）
        │
        │ この要求が変える体験
        ▼
After
────────────────
（望む仕事・理解・行動・人間へ残る判断）
```

（なぜこの変化がGoalとOutcomeへつながるかを短く説明する。）

## 4. UX成果への統合

```text
REQ-XXXXXX
    │
    ├──────────────→ UX-XXXXXX
    │                 （成果名） [New／Same]
    └──────────────→ UX-XXXXXX
                      （成果名） [New／Same]
```

| UX成果候補 | 処置・接続先 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| | （New／Same／Not Applicable） | （Actor、Goal、Trigger、Outcome、Experienceの比較） | |

REQとUXは多対多を許容する。Same判定はREQ Identityや技術上の近さではなく、利用者成果の同一性を基準にする。

## 5. 重要な体験

```text
（体験の起点）
        ↓
（利用者の行動・判断）
        │
        ├─ ★ Critical: （重要場面）
        ├─ ⚠ Failure:  （避ける失敗）
        └─ ✓ Quality:  （守る体験品質）
        ↓
（Outcomeまたは回復後の次の行動）
```

| Supporting Model | 処置 | 理由・参照先 |
|---|---|---|
| Experience Flow／Journey | （作成／既存参照／非該当／作成不能） | |
| Service Blueprint | | |
| User／Task Flow／Storyboard | | |

重要場面、失敗・回復、品質期待および人間／System・AI／運用の責任境界を、Flow上の発生地点から理解できるようにする。数値、状態値、API、Componentまたは実現方式は下流へ先送りする。

## 6. 下流への引き渡し

```text
                 UX-XXXXXX
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
      IA            UI          SPEC
  情報と関係     表示と操作意図   振る舞いと品質
                    │
                    ▼
               Verification
                 反証と観測
```

| 引き渡し先 | 具体化する意味・義務 |
|---|---|
| IA | |
| UI | |
| SPEC | |
| Architecture | （実現境界へ渡す必要がある場合） |
| Verification | |

未決事項、妥当性を確認する観測、Discoveryへ戻す条件を記載する。図や表では保持できない理由、ConstraintまたはNuanceだけを短い文章で補う。
