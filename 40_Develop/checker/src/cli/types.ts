/**
 * Checkerの公開操作と内部受付が共有する起動・終了契約。
 *
 * @responsibility 引数・cwd・出力先と終了codeの型を所有する。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 */
/**
 * Checkerの起動要求を定義する。
 *
 * @responsibility 引数・起動Directory・標準出力相当とエラー出力相当の搬送先を共有する。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 * @shape readonly引数列、cwd文字列、文字列を受ける二つの出力callback。
 * @invariant レポート本文と終了結果を混同せず、受付が入力配列を変更しない。
 * @boundary 呼出し元の表示先と各検査操作を接続する値契約。
 * @security Rootの文字列だけで検証済みRepositoryや保存許可を表さない。
 * @compatibility 既存のfield・callback引数・戻り値を維持する。
 */
export type CheckerRunRequest = Readonly<{
  arguments: readonly string[];
  cwd: string;
  writeOutput: (value: string) => void;
  writeError: (value: string) => void;
}>;

/**
 * Checkerの終了結果を定義する。
 *
 * @responsibility 呼出し元がProcess終了へ反映する終了codeだけを表す。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 * @shape 数値のexitCode。レポート本文は保持しない。
 * @invariant 各操作の既存codeを維持し、新しい成功判定を追加しない。
 * @boundary N/A: 終了結果の型だけを定義する。
 * @security 成功codeは専門品質・準拠・試験Passの認定ではない。
 * @compatibility 既存のexitCode fieldを維持する。
 */
export type CheckerResult = Readonly<{
  exitCode: number;
}>;
