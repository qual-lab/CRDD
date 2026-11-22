/**
 * Workbench Browser ClientのVite Buildを定義する。
 *
 * @responsibility React Clientを単一Bundleにし、起動HTMLとCSSを同じ配布Directoryに含める。
 * @trace ARCH-000012
 * @input src/index.htmlと、そこから参照するReact入口・CSS。
 * @returns dist/clientに固定名のHTML・CSS・JSを用意するVite設定。
 * @precondition Node.jsとpackage-lock.jsonで固定したVite Toolchainが利用可能である。
 * @postcondition Serverがallowlist配信できる固定名のES Moduleが生成される。
 * @effect 40_Develop/workbench-ui/dist/clientだけを生成または置換する。
 * @failure Buildまたは依存解決に失敗した場合は非0終了し、不完全なReleaseを開始しない。
 * @invariant Browser BundleへCredential、Repository PathまたはServer Authorityを埋め込まない。
 * @boundary Workbench SourceとBrowser配布AssetのBuild境界。
 * @security 任意のRuntime環境変数をClientへ展開しない。
 * @concurrency Viteが所有するBuild処理に限定し、Workbench Runtimeとは並行実行しない。
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: false,
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: "../dist/client",
    modulePreload: false,
    cssMinify: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/workbench-client.js",
        chunkFileNames: "assets/workbench-[name].js",
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith(".css"))
            ? "workbench.css"
            : "assets/workbench-[name][extname]",
      },
    },
  },
});
