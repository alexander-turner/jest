/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import * as fs from 'graceful-fs';
import runJest from '../runJest';

const COLLECT_ONLY_DIR = path.resolve(__dirname, '..', 'collect-only');
const SIDE_EFFECT_FILE = path.join(COLLECT_ONLY_DIR, 'side-effect.txt');

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
  test('does not execute test bodies (side effect check)', () => {
    const {exitCode} = runJest('collect-only', ['--collectOnly']);

    expect(exitCode).toBe(0);
    expect(fs.existsSync(SIDE_EFFECT_FILE)).toBe(false);
  });

  test('lists test names with tree output using existing each fixture', () => {
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

  test('produces valid JSON with --json using existing each fixture', () => {
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
    const {exitCode, stdout} = runJest('each', [
      '--collectOnly',
      '--testPathPatterns=nonexistent',
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('No tests found');
  });
});
