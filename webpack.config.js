/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path')

const merge = require('webpack-merge').merge

// plugins
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = (env) => {
  const config = {
    entry: './src/index.ts',

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },

    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            {
              loader: MiniCssExtractPlugin.loader,
            },
            'css-loader',
          ],
        },
      ],
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },

    plugins: [
      new HtmlWebpackPlugin({
        title: '7DRL 2022',
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'assets/**',

            // if there are nested subdirectories , keep the hierarchy
            to({ absoluteFilename }) {
              const assetsPath = path.resolve(__dirname, 'assets')
              return `assets/${absoluteFilename.slice(assetsPath.length)}`
            },
          },
        ],
      }),
    ],
  }
  const envConfig = require(path.resolve(__dirname, `./webpack.${env.mode}.js`))(env)

  const mergedConfig = merge(config, envConfig)

  return mergedConfig
}
