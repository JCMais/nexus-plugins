module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist-esm/', '/dist/'],
  globals: {
    skipBabel: true,
  },
  coverageDirectory: './coverage',
}
