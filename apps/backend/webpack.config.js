const {
  NxAppWebpackPlugin,
} = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack'); // 👈 import webpack for DefinePlugin

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/backend'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
    }),

    // 👇 Inject environment variables here
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
