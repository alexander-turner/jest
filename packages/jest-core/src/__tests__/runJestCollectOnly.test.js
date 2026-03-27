/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {TestPathPatterns} from '@jest/pattern';
import {makeEmptyAggregatedTestResult} from '@jest/test-result';
import runJest from '../runJest';

jest.mock('@jest/console');

const mockScheduleTests = jest.fn();
jest.mock('../TestScheduler', () => ({
  createTestScheduler: jest.fn(() => ({
    scheduleTests: mockScheduleTests,
  })),
}));

jest.mock('../SearchSource', () => {
  const mockGetTestPaths = jest.fn();
  return jest.fn(() => ({
    findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
    getTestPaths: mockGetTestPaths,
  }));
});

jest.mock('../runGlobalHook', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const SearchSource = require('../SearchSource');

const makeContext = () => ({
  config: {rootDir: '/test'},
});

const makeTest = (testPath, context) => ({
  context: context || makeContext(),
  duration: undefined,
  path: testPath,
});

const baseGlobalConfig = {
  collectOnly: true,
  rootDir: '',
  testPathPatterns: new TestPathPatterns([]),
  testSequencer: require.resolve('@jest/test-sequencer'),
};

describe('runJest with collectOnly', () => {
  let outputStream;
  let processStdoutWrite;

  beforeEach(() => {
    outputStream = {write: jest.fn()};
    processStdoutWrite = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    mockScheduleTests.mockReset();
    SearchSource.mockClear();
  });

  afterEach(() => {
    processStdoutWrite.mockRestore();
  });

  test('prints "No tests found." when no tests exist', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const context = makeContext();
    const mockGetTestPaths =
      SearchSource.mock.results[0]?.value?.getTestPaths || jest.fn();

    // Need to create a fresh SearchSource mock for this test
    SearchSource.mockImplementation(() => ({
      findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
      getTestPaths: jest.fn(() => ({noSCM: false, tests: []})),
    }));

    const onComplete = jest.fn();
    await runJest({
      contexts: [context],
      globalConfig: baseGlobalConfig,
      onComplete,
      outputStream,
      startRun: jest.fn(),
      testWatcher: {isInterrupted: () => false},
    });

    expect(consoleSpy).toHaveBeenCalledWith('No tests found.');
    expect(onComplete).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('prints collected test tree in text mode', async () => {
    const context = makeContext();
    const testFile = '/path/to/test.js';

    SearchSource.mockImplementation(() => ({
      findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
      getTestPaths: jest.fn(() => ({
        noSCM: false,
        tests: [makeTest(testFile, context)],
      })),
    }));

    mockScheduleTests.mockResolvedValue({
      ...makeEmptyAggregatedTestResult(),
      testResults: [
        {
          testFilePath: testFile,
          testResults: [
            {
              ancestorTitles: ['describe block'],
              title: 'test one',
            },
            {
              ancestorTitles: ['describe block'],
              title: 'test two',
            },
          ],
        },
      ],
    });

    const onComplete = jest.fn();
    await runJest({
      contexts: [context],
      globalConfig: baseGlobalConfig,
      onComplete,
      outputStream,
      startRun: jest.fn(),
      testWatcher: {isInterrupted: () => false},
    });

    expect(onComplete).toHaveBeenCalled();
    // Should print the file path
    expect(outputStream.write).toHaveBeenCalledWith(`${testFile}\n`);
    // Should print tests with pencil icon
    expect(outputStream.write).toHaveBeenCalledWith(
      expect.stringContaining('test one'),
    );
    expect(outputStream.write).toHaveBeenCalledWith(
      expect.stringContaining('test two'),
    );
  });

  test('outputs JSON when json flag is set', async () => {
    const context = makeContext();
    const testFile = '/path/to/test.js';

    SearchSource.mockImplementation(() => ({
      findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
      getTestPaths: jest.fn(() => ({
        noSCM: false,
        tests: [makeTest(testFile, context)],
      })),
    }));

    mockScheduleTests.mockResolvedValue({
      ...makeEmptyAggregatedTestResult(),
      testResults: [
        {
          testFilePath: testFile,
          testResults: [
            {
              ancestorTitles: ['suite'],
              title: 'a test',
            },
          ],
        },
      ],
    });

    const onComplete = jest.fn();
    await runJest({
      contexts: [context],
      globalConfig: {...baseGlobalConfig, json: true},
      onComplete,
      outputStream,
      startRun: jest.fn(),
      testWatcher: {isInterrupted: () => false},
    });

    expect(processStdoutWrite).toHaveBeenCalled();
    const jsonOutput = JSON.parse(processStdoutWrite.mock.calls[0][0]);
    expect(jsonOutput.success).toBe(true);
    expect(jsonOutput.numTotalTests).toBe(1);
    expect(jsonOutput.numTotalTestSuites).toBe(1);
    expect(jsonOutput.collectedTests).toEqual([
      {
        ancestorTitles: ['suite'],
        filePath: testFile,
        testName: 'a test',
      },
    ]);
  });

  test('filters by testNamePattern when provided', async () => {
    const context = makeContext();
    const testFile = '/path/to/test.js';

    SearchSource.mockImplementation(() => ({
      findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
      getTestPaths: jest.fn(() => ({
        noSCM: false,
        tests: [makeTest(testFile, context)],
      })),
    }));

    mockScheduleTests.mockResolvedValue({
      ...makeEmptyAggregatedTestResult(),
      testResults: [
        {
          testFilePath: testFile,
          testResults: [
            {
              ancestorTitles: [],
              title: 'matching test',
            },
            {
              ancestorTitles: [],
              title: 'other test',
            },
          ],
        },
      ],
    });

    const onComplete = jest.fn();
    await runJest({
      contexts: [context],
      globalConfig: {...baseGlobalConfig, testNamePattern: 'matching'},
      onComplete,
      outputStream,
      startRun: jest.fn(),
      testWatcher: {isInterrupted: () => false},
    });

    // Should print matching test
    expect(outputStream.write).toHaveBeenCalledWith(
      expect.stringContaining('matching test'),
    );
    // Should NOT print the non-matching test file path separately
    // Verify by checking all write calls
    const allWrites = outputStream.write.mock.calls.map(c => c[0]).join('');
    expect(allWrites).toContain('matching test');
    expect(allWrites).not.toContain('other test');
  });

  test('writes JSON to outputFile when specified', async () => {
    const context = makeContext();
    const testFile = '/path/to/test.js';

    SearchSource.mockImplementation(() => ({
      findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
      getTestPaths: jest.fn(() => ({
        noSCM: false,
        tests: [makeTest(testFile, context)],
      })),
    }));

    mockScheduleTests.mockResolvedValue({
      ...makeEmptyAggregatedTestResult(),
      testResults: [
        {
          testFilePath: testFile,
          testResults: [
            {
              ancestorTitles: [],
              title: 'a test',
            },
          ],
        },
      ],
    });

    const onComplete = jest.fn();
    await runJest({
      contexts: [context],
      globalConfig: {
        ...baseGlobalConfig,
        json: true,
        outputFile: 'results.json',
      },
      onComplete,
      outputStream,
      startRun: jest.fn(),
      testWatcher: {isInterrupted: () => false},
    });

    // When outputFile is specified with json, it writes to outputStream
    // to indicate where results were written
    expect(outputStream.write).toHaveBeenCalledWith(
      expect.stringContaining('Test results written to:'),
    );
  });

  test('suppresses reporter output with silent mode', async () => {
    const {createTestScheduler} = require('../TestScheduler');
    const context = makeContext();
    const testFile = '/path/to/test.js';

    SearchSource.mockImplementation(() => ({
      findRelatedSourcesFromTestsInChangedFiles: jest.fn(() => []),
      getTestPaths: jest.fn(() => ({
        noSCM: false,
        tests: [makeTest(testFile, context)],
      })),
    }));

    mockScheduleTests.mockResolvedValue({
      ...makeEmptyAggregatedTestResult(),
      testResults: [
        {
          testFilePath: testFile,
          testResults: [],
        },
      ],
    });

    await runJest({
      contexts: [context],
      globalConfig: baseGlobalConfig,
      onComplete: jest.fn(),
      outputStream,
      startRun: jest.fn(),
      testWatcher: {isInterrupted: () => false},
    });

    // Verify scheduler was created with silent and empty reporters
    const schedulerConfig = createTestScheduler.mock.calls[0][0];
    expect(schedulerConfig.silent).toBe(true);
    expect(schedulerConfig.reporters).toEqual([]);
  });
});
