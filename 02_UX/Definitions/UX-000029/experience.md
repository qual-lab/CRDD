# UX-000029 Work・Change・Evidence・Qualityを迷わず辿る

成果物種別: UX Definition
UX ID: `UX-000029`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

未完了、変更理由、全影響Path、成立根拠および現在品質を役割の違いとともに辿れる

```text
CRDD作成者・保守者
        │ 変更の現在地や根拠を調べる時
        ▼
Work・Change・Evidence・Qualityを役割別に辿る
        │
        ▼
変更理由と全影響Pathを重複なく確認できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| Trigger／Situation | 変更の現在地や根拠を調べる時 |
| Goal | Work・Change・Evidence・Qualityを役割別に辿る |
| Outcome | 変更理由と全影響Pathを重複なく確認できる |

## 成立条件

- 未完了、変更理由、全影響Path、成立根拠および現在品質を役割の違いとともに辿れる
- 重要場面「変更の影響漏れを確認する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
変更の現在地や根拠を調べる時
        ↓
Work・Change・Evidence・Qualityを役割別に辿る
        │
        ├─ ★ Critical: 変更の影響漏れを確認する場面
        ├─ ⚠ Failure:  同じ説明を複製し代表ファイルだけで済ませる
        └─ ✓ Quality:  正本を分け全影響ファイルを列挙する
        ↓
変更理由と全影響Pathを重複なく確認できる
```

## 必要な情報

Work、Change、Affected Path、Evidence、Observed Revision、Qualityを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

Owner混同、代表Pathだけの表示、Evidenceの遡及上書きおよびGit差分への丸投げを反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはWork LifecycleのNavigationとEntity関係を分け、Release・Quality・Checkerは各Owner境界を維持する。

## 関係

- Source REQ Analysis: [REQ-000033](../../Analysis/REQ-000033/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

