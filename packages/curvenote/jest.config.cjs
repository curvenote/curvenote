module.exports = {
  rootDir: '../../',
  preset: 'ts-jest/presets/js-with-ts',
  testMatch: ['<rootDir>/packages/curvenote/**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testTimeout: 10000,
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|xml)$':
      '<rootDir>/packages/curvenote/tests/__mocks__/fileMock.js',
    '#(.*)': '<rootDir>/node_modules/$1', // https://github.com/chalk/chalk/issues/532
  },
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
    },
  },
  verbose: true,
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!(vfile|vfile-message|unified|bail|trough|zwitch|unist-|hast-|html-|rehype-|mdast-|micromark-|trim-|web-namespaces|fetch-blob|formdata-polyfill|property-information|space-separated-tokens|comma-separated-tokens|get-port|data-uri-to-buffer|stringify-entities|character-entities-html4|ccount))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.yalc/', '/dist/'],
};
