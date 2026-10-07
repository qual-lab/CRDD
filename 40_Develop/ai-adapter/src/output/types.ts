/**
 * Provider出力の曖昧でないJSON構文解析を所有する。
 *
 * @packageDocumentation
 * @responsibility 重複key・不正文法・末尾データを拒否し、ProviderのEnvelope判定と分離する。
 * @trace ARCH-000015
 * @boundary 未信頼JSON文字列から構造化値への純粋解析境界。
 */
/**
 * 共通JSON解析で使用するScan 結果の値契約を定義する。
 *
 * @responsibility Scan 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ScanResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ScanResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ScanResultの宣言は外部境界を開かない。
 * @security ScanResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ScanResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ScanResult = Readonly<{
  nextIndex: number;
  hasDuplicateKey: boolean;
}>;
