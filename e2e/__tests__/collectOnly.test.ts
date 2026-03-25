/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import * as fs from 'graceful-fs';
import runJest from '../runJest';

const DIR = path.resolve(__dirname, '..', 'collect-only');
const SIDE_EFFECT_FILE = path.join(DIR, 'side-effect.txt');

beforeEach(() => {
  if (fs.existsSync(SIDE_EFFECT_FILE)) {
    fs.unlinkSync(SIDE_EFFECT_FILE);
  }
});

afterAll(() => {
  if (fs.existsSync(SIDE_EFFECT_FILE)) {
    fs.unlinkSync(SIDE_EFFECT_FILE);
  }
});

describe('jest --collectOnly', () => {
  test('lists all test names without executing test bodies', () => {
    const {exitCode, stdout} = runJest('collect-only', ['--collectOnly']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('adds positive numbers');
    expect(stdout).toContain('adds negative numbers');
    expect(stdout).toContain('subtracts positive numbers');
    expect(stdout).toContain('table: 1 + 1 = 2');
    expect(stdout).toContain('table: 2 + 3 = 5');
    // Verify describe blocks appear
    expect(stdout).toContain('add');
    expect(stdout).toContain('subtract');
    // Verify the side-effect file was NOT created (tests were not executed)
    expect(fs.existsSync(SIDE_EFFECT_FILE)).toBe(false);
  });

  test('prints file paths in the output', () => {
    const {exitCode, stdout} = runJest('collect-only', ['--collectOnly']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('math.test.js');
  });

  test('produces valid JSON with --json', () => {
    const {exitCode, stdout} = runJest('collect-only', [
      '--collectOnly',
      '--json',
    ]);

    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.success).toBe(true);
    expect(json.numTotalTests).toBe(5);
    expect(json.numTotalTestSuites).toBe(1);
    expect(json.collectedTests).toBeInstanceOf(Array);
    expect(json.collectedTests).toHaveLength(5);

    for (const test of json.collectedTests) {
      expect(test).toHaveProperty('filePath');
      expect(test).toHaveProperty('testName');
      expect(test).toHaveProperty('ancestorTitles');
      expect(Array.isArray(test.ancestorTitles)).toBe(true);
    }

    // Check specific test entries
    const addPositive = json.collectedTests.find(
      (t: {testName: string}) => t.testName === 'adds positive numbers',
    );
    expect(addPositive).toBeDefined();
    expect(addPositive.ancestorTitles).toEqual(['add']);
  });

  test('filters correctly with --testNamePattern', () => {
    const {exitCode, stdout} = runJest('collect-only', [
      '--collectOnly',
      '--testNamePattern=add',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('adds positive numbers');
    expect(stdout).toContain('adds negative numbers');
    expect(stdout).not.toContain('subtracts positive numbers');
    expect(stdout).not.toContain('table:');
  });

  test('exits 0 even when no tests match', () => {
    const {exitCode, stdout} = runJest('collect-only', [
      '--collectOnly',
      '--testPathPatterns=nonexistent',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('No tests found');
  });

  test('does not execute test bodies (side effect check)', () => {
    const {exitCode} = runJest('collect-only', ['--collectOnly']);

    expect(exitCode).toBe(0);
    expect(fs.existsSync(SIDE_EFFECT_FILE)).toBe(false);
  });
});
