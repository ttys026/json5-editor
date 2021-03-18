const path = require('path');

let libraryName = 'index';

module.exports = {
  entry: `${__dirname}/src/index.ts`,
  devtool: 'source-map',
  mode: 'production',

  output: {
    path: `${__dirname}/dist`,
    filename: `${libraryName}.js`,
    library: libraryName,
    libraryTarget: 'umd',
    globalObject: "(typeof self !== 'undefined' ? self : this)",
    umdNamedDefine: true,
  },
  externals: {
    react: {
      root: 'React',
      commonjs2: 'react',
      commonjs: 'react',
      amd: 'react',
      umd: 'react',
    },
    'react-dom': {
      root: 'ReactDOM',
      commonjs2: 'react-dom',
      commonjs: 'react-dom',
      amd: 'react-dom',
      umd: 'react-dom',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.less'],
  },
  module: {
    rules: [
      {
        test: /(\.tsx|\.ts|\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.less|\.css$/,
        include: [path.resolve(__dirname, 'src')],
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              modules: {
                mode: 'local',
                localIdentName: '[path][name]__[local]--[hash:base64:5]',
              },
            },
          },
          {
            loader: 'less-loader',
          },
        ],
      },
    ],
  },
};
