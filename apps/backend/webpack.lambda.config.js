const {
  NxAppWebpackPlugin,
} = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

// Lambda 專用打包：與 webpack.config.js 幾乎相同，差別在
//   1. entry 改為 lambda.ts（export handler，而非呼叫 listen 的 main.ts）
//   2. output 設為 commonjs2 library，讓 Lambda runtime 能 require('index').handler
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
  ],
};
