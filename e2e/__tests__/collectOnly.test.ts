/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import runJest from '../runJest';

describe('jest --collectOnly', () => {
  test('lists test names without executing test bodies', () => {
    const {exitCode, stdout} = runJest('each', [
      '--collectOnly',
      '--testPathPatterns=success',
    ]);

    expect(exitCode).toBe(0);
    // Verify test.each tests appear
    expect(stdout).toContain("The word red contains the letter 'e'");
    expect(stdout).toContain('passes one row expected true == true');
    // Verify describe.each blocks appear
    expect(stdout).toContain('passes all rows expected true == true');
    // Verify file path appears
    expect(stdout).toContain('success.test.js');
  });

  test('produces valid JSON with --json', () => {
    const {exitCode, stdout} = runJest('each', [
      '--collectOnly',
      '--json',
      '--testPathPatterns=success',
    ]);

    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.success).toBe(true);
    expect(json.numTotalTestSuites).toBe(1);
    expect(json.collectedTests).toBeInstanceOf(Array);
    expect(json.collectedTests.length).toBeGreaterThan(0);

    for (const test of json.collectedTests) {
      expect(test).toHaveProperty('filePath');
      expect(test).toHaveProperty('testName');
      expect(test).toHaveProperty('ancestorTitles');
      expect(Array.isArray(test.ancestorTitles)).toBe(true);
    }

    // Verify a describe.each test has correct ancestor titles
    const nestedTest = json.collectedTests.find(
      (t: {testName: string}) => t.testName === 'passes',
    );
    expect(nestedTest).toBeDefined();
    expect(nestedTest.ancestorTitles.length).toBeGreaterThan(0);
  });

  test('does not execute tests (failing tests still exit 0)', () => {
    const {exitCode, stdout} = runJest('each', [
      '--collectOnly',
      '--testPathPatterns=failure',
    ]);

    // failure.test.js would exit 1 if tests actually ran
    expect(exitCode).toBe(0);
    expect(stdout).toContain('failure.test.js');
    expect(stdout).toContain('fails');
  });

  test('filters correctly with --testNamePattern', () => {
    const {exitCode, stdout} = runJest('each', [
      '--collectOnly',
      '--testPathPatterns=success',
      '--testNamePattern=one row',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('passes one row expected');
    expect(stdout).not.toContain("The word red contains the letter 'e'");
  });

  test('exits 0 even when no tests match', () => {
    const {exitCode, stdout} = runJest('each', [
      '--collectOnly',
      '--testPathPatterns=nonexistent',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('No tests found');
  });
});
