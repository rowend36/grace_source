// webpack.config.js
export default {
  entry: './src/index.js',
  mode: 'production',
  output: {
    filename: 'lezer-generator.js',
    library: {
      type: 'umd',
      name: 'LezerGenerator',
    },
    // prevent error: `Uncaught ReferenceError: self is not define`
    globalObject: 'this',
  },
};
