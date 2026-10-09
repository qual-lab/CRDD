/**
 * CROSの認可に用いる公開範囲Snapshotの型契約。
 *
 * @responsibility ExposureとRepository集合を同じ改訂へ結合し、Transportに依存せず共有する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 */
import type { CrosExposure, CrosRepository } from "./session-context.ts";

/**
 * CROSの認可・公開範囲境界で使用するCrosExposureSnapshotの構造を固定する。
 *
 * @responsibility CROSの認可・公開範囲境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000005
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */
export type CrosExposureSnapshot = Readonly<{
  revision: string;
  exposures: readonly CrosExposure[];
  repositories: readonly CrosRepository[];
}>;
