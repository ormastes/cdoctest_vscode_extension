module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/unittest/**/*.spec.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/test/unittest/mocks/vscode.js'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.vscode-test/'
  ],
  modulePathIgnorePatterns: [
    '/.vscode-test/'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**'
  ]
};