const path = require('path');
const webpack = require('webpack');
const YAML = require('yamljs');

const allEntries = Object.keys(YAML.load('serverless.yml').functions)
  .reduce((entryObj, functionName) => {
    entryObj[functionName] = `.${path.sep}${path.join('src', 'functions', functionName, 'framework', 'handler.ts')}`
    return entryObj;
  }, {});

module.exports = env => ({
  target: 'node',
  mode: 'production',
  entry: env && env.lambdas
    ? env.lambdas.split(',').reduce((entryObj, fnName) => ({ ...entryObj, [fnName]: allEntries[fnName] }), {})
    : allEntries,
  devtool: 'eval',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /^aws-crt/,
    }),
  ],
  resolve: {
    extensions: [ '.ts', '.js', '.jsx', '.json' ]
  },
  output: {
    filename: `[name].js`,
    path: path.join(__dirname, 'build', 'bundle'),
    libraryTarget: 'commonjs'
  },
});
