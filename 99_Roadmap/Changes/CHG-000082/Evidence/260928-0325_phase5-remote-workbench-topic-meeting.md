# Phase 5 Remote Workbench Topic／Meeting

成果物種別: Verification Evidence
対象変更: `CHG-000082`
状態: Completed

## 1. 結論

Remote CROSへ接続したWorkbenchから、現在の許可済みPortfolio Sourceを明示選択し、そのRepositoryのTopic／MeetingをMCP経由で一覧・詳細表示・更新できることを確認した。

Repositoryを選択していないRemote接続ではTopic／Meetingを表示せず、Local Repositoryへのfallbackも行わない。Repository IDの指定だけをAuthorityとして扱わず、現在表示できるPortfolio Sourceとの一致をWorkbench側で確認し、CROS側でもCredential、Workspace Grant、ExposureおよびRepository BindingをRequestごとに再確認する。

## 2. 対象と境界

| 観点 | 結果 |
|---|---|
| Repository選択 | 現在の許可済みPortfolio Sourceから明示選択する |
| 一覧 | 検索、状態、Owner、期間、Relation、未処置Outcome、並び順およびCursorをMCPへ搬送する |
| 詳細 | 選択Repositoryの本文とRelationだけを取得する |
| 書込み | 選択Repositoryと期待Revisionを明示してMCPへ渡す |
| Repository間Relation | MCPが返した`ownerRepositoryId`を使い、遷移時に対象Repositoryを明示切替する |
| 不完全性 | Repository未選択、Grant外、取得失敗をLocal Repositoryの結果で補完しない |
| Secret | Bearer CredentialをAuthorization Header以外へ複製しない |

## 3. 実行結果

| 対象 | 結果 | 観測 |
|---|---|---|
| Workbench Format／Type／Lint | PASS | 14 files |
| Workbench Integration | PASS | 18 tests、失敗0 |
| Remote Workbench Topic／Meeting操作 | PASS | DEV Repositoryだけを表示・更新し、未選択時のLocal fallback 0、非表示Repository本文の開示0を確認。登録、編集、削除、Topic昇格およびMeeting Outcome処置の全8 Action Variantが明示Repository付きの対応MCP Toolへ一回だけ写像されることを確認 |
| MCP Format／Type／Lint | PASS | 22 files |
| MCP Unit／Integration／System | PASS | 43 tests、失敗0 |
| Repository間Relation | PASS | 一意な許可済みOwnerにRepository IDを付与し、0件を`unavailable`、複数件を`conflicting`として維持 |

## 4. 残る範囲

Shared ServerのREST／MCP同一Origin、TLS配置および運用設定入口は未成立である。Productionでは同じEndpointを使用する構成を既定とし、結合試験ではPortfolio RESTとMCPの境界を個別に観測できるようCompositionからMCP Endpointを注入した。

この未成立範囲を理由に、成立済みのRepository選択、MCP読書きまたはLocal fallback禁止を拡大解釈しない。

## Checklist

- [x] Remote操作のRepositoryを明示した
- [x] Repository IDの知識をAuthorityとして扱っていない
- [x] RequestごとのCredential／Grant／Exposure再確認を維持した
- [x] 一覧、詳細、書込みおよびRelation遷移でRepositoryを保持した
- [x] Remote失敗時のLocal fallbackがない
- [x] 非表示Repositoryの本文または存在を推測していない
- [x] Format、型、Lintおよび対象回帰を実行した
- [x] 未成立のShared Server配置を分離して記録した
