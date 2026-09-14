# UX-000013 許可されたWorkspaceだけをRemote利用する

成果物種別: UX Definition
UX ID: `UX-000013`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

接続元やCredentialが変わっても、現在許可されたWorkspaceだけを利用し、利用不能理由と管理能力を内容閲覧から区別できる

```text
Project Operator／PM
        │ Remote Sessionを開始・再接続する時
        ▼
許可されたWorkspaceだけへ接続する
        │
        ▼
場所が変わっても開示範囲を理解して安全に使える
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | Remote Sessionを開始・再接続する時 |
| Goal | 許可されたWorkspaceだけへ接続する |
| Outcome | 場所が変わっても開示範囲を理解して安全に使える |

## 成立条件

- 接続元やCredentialが変わっても、現在許可されたWorkspaceだけを利用し、利用不能理由と管理能力を内容閲覧から区別できる
- 重要場面「利用可能Contextを表示する時」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Remote Sessionを開始・再接続する時
        ↓
許可されたWorkspaceだけへ接続する
        │
        ├─ ★ Critical: 利用可能Contextを表示する時
        ├─ ⚠ Failure:  利用不能なRepositoryの存在や内容を推測表示する
        └─ ✓ Quality:  現在Grantだけを開示し不足を補完しない
        ↓
場所が変わっても開示範囲を理解して安全に使える
```

## 必要な情報

Credential、Session、Workspace Grant、System Capability、Disclosureを分ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

存在漏えい、一律Unlock、古いGrantおよび管理能力からの閲覧権限推定を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはCredential、Session、Workspace、ExposureおよびSource可用性を区別する。Threat／SPEC／Architectureは開示可否とEffect Authorityを別契約として具体化する。

## 関係

- Source REQ Analysis: [REQ-000011](../../Analysis/REQ-000011/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

