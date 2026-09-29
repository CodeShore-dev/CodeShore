const {
  NxAppWebpackPlugin,
} = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

// Lambda 專用打包：與 webpack.config.js 幾乎相同，差別在
//   1. entry 改為 lambda.ts（export handler，而非呼叫 listen 的 main.ts）
//   2. output 設為 commonjs2 library，讓 Lambda runtime 能 require('index').handler
//
// `library: commonjs2` 會讓所有外部相依在執行期用 require() 載入。`@openrouter/sdk`
// 是 ESM-only 套件（package.json 的 "type": "module"，只有 esm 進入點），在 Node 22
// 下 require() 一個 ESM 會丟 ERR_REQUIRE_ESM，導致 Lambda 冷啟動就崩、CloudFront 回 502。
// 解法：只把 `@openrouter/sdk` 從外部化名單排除、改由 webpack 打包進 bundle
//（ESM 會被轉成 CJS），其餘相依維持原本的 nodeExternals 行為不變。
const BUNDLED_ESM_PACKAGES = /^@openrouter\/sdk(\/|$)/;

// 排在 NxAppWebpackPlugin 之後執行，覆寫它設好的 externals：
// 沿用它原本的 nodeExternals 函式處理所有相依，只對上面的 ESM 套件短路成
// callback()（＝不外部化 → 交給 webpack 打包）。
class BundleEsmExternalsPlugin {
  apply(compiler) {
    const existing = compiler.options.externals;
    const delegates = (
      Array.isArray(existing) ? existing : [existing]
    ).filter(entry => typeof entry === 'function');

    compiler.options.externals = [
      (data, callback) => {
        const request = data && data.request;
        if (request && BUNDLED_ESM_PACKAGES.test(request)) {
          return callback(); // 不外部化 → webpack 打包進 bundle
        }
        if (delegates.length === 0) {
          return callback();
        }
        return delegates[0](data, callback); // 其餘沿用原本的 nodeExternals
      },
    ];
  }
}

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/backend-lambda'),
    filename: 'index.js',
    library: { type: 'commonjs2' },
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/lambda.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
    }),

    new webpack.DefinePlugin({
      'process.env.REPO': JSON.stringify(
        process.env.REPO || '',
      ),
      'process.env.VER': JSON.stringify(
        process.env.VER || '',
      ),
    }),

    new BundleEsmExternalsPlugin(),
  ],
};
