# Execution Intelligence

CRDDへ明示的に結合した仕事の実行Eventを、特定のCoordinator、TransportまたはAI Providerに依存せず記録・集約するprivate開発packageである。公開契約、保存境界および完成条件は[実行知のアーキテクチャ](../../06_Architecture/execution-intelligence/01_Architecture.md)、検証項目は[検証設計](../../07_Quality/03_Verification_Design.md#execution-intelligence-verification)を正本とする。

## 構成

- `src/core/`: 共通Event、検証、集約、非Authority改善候補。
- `src/store/`: 検証済みRepository Root直下の`.crdd/execution/events/`を扱う不変Storeと清掃。
- `src/index.ts`: 利用側Adapter向けの公開入口。
- `tests/unit/`: Eventと分析の単体試験。
- `tests/integration/`: StoreとFilesystem境界の結合試験。

Coordinator固有のProject／Single Task結果の変換は、このpackageではなく[Coordinator Adapter](../coordinator/src/security/execution-intelligence-adapter.ts)が所有する。MCP、HTTP、Provider SDKまたは採用Repositoryも、認証、情報分類、外部Effectおよび仕事Identityを自身の境界で確認したうえでAdapterから接続する。

外部AI APIを利用する採用Repositoryでは、API呼出しそのものをこのpackageへ委譲しない。利用側が既存の認証・送信許可・実行契約に従ってAPIを実行し、その結果から確認できたProvider、Model、利用量、所要時間および結果だけを共通Eventへ変換する。取得していない値は理由付き`not_observed`とし、要求値、推定値または既定値で補わない。これにより、ロガーや分析入力として利用できる一方、Prompt、Response、秘密値または外部送信AuthorityはExecution Intelligenceへ渡さない。

## 開発確認

```text
npm run check
npm test
```

静的検査はCRDD公式Repositoryの共通Node.js開発toolchainを使用する。Runtime依存はNode.js組込みmoduleだけであり、Provider SDKやCoordinator packageへ依存しない。性能試験・長時間試験・外部Provider実行は通常確認に含めない。
