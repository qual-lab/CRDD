/**
 * CRDD回帰試験Runnerの公開境界。
 * @packageDocumentation
 * @responsibility 固定された試験集合を実行し構造化結果を返す。
 * @trace ARCH-000003
 * @boundary 検証計画と試験用子Process・実行環境の境界。
 * @effect 選択済み試験を子Processとして開始し、取消・終了・清掃を観測する。
 */
export {
  runRegression,
  type RegressionRunRequest,
  type RegressionRunResult,
} from "./application/regression-runner.ts";
