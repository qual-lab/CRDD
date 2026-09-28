/**
 * Workbench Browser ClientのVite Buildを定義する。
 *
 * @responsibility React ClientをNode Workbench Serverが固定Pathで配信できる単一Bundleへ変換する。
 * @trace ARCH-000012
 * @input client/entry-client.tsとその依存Moduleを受け取る。
 * @returns dist/client/assets/workbench-client.jsを生成するVite設定を返す。
 * @precondition Node.jsとpackage-lock.jsonで固定したVite Toolchainが利用可能である。
 * @postcondition Serverがallowlist配信できる固定名のES Moduleが生成される。
 * @effect 40_Develop/workbench/dist/clientだけを生成または置換する。
 * @failure Buildまたは依存解決に失敗した場合は非0終了し、不完全なReleaseを開始しない。
 * @invariant Browser BundleへCredential、Repository PathまたはServer Authorityを埋め込まない。
 * @boundary Workbench SourceとBrowser配布AssetのBuild境界。
 * @security 任意のRuntime環境変数をClientへ展開しない。
 * @concurrency Viteが所有するBuild処理に限定し、Workbench Runtimeとは並行実行しない。
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: "dist/client",
    rollupOptions: {
      input: "client/entry-client.ts",
      output: {
        entryFileNames: "assets/workbench-client.js",
        chunkFileNames: "assets/workbench-[name].js",
        assetFileNames: "assets/workbench-[name][extname]",
      },
    },
  },
});
