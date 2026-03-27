/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {makeProjectConfig} from '@jest/test-utils';
import type {Circus} from '@jest/types';
import {
  ROOT_DESCRIBE_BLOCK_NAME,
  getState as getRunnerState,
  resetState,
} from '../../state';
import {makeDescribe, makeTest} from '../../utils';
import {collectTestsWithoutRunning} from '../jestAdapterInit';

// Mock dispatch to avoid running real teardown event handlers
jest.mock('../../state', () => {
  const actual =
    jest.requireActual<typeof import('../../state')>('../../state');
  return {
    ...actual,
    dispatch: jest.fn<typeof actual.dispatch>(),
  };
});

beforeEach(() => {
  resetState();
});

const addTestToBlock = (
  name: string,
  parent: Circus.DescribeBlock,
): Circus.TestEntry => {
  const test = makeTest(
    () => {},
    undefined,
    false,
    name,
    parent,
    undefined,
    new Error(),
    false,
  );
  parent.children.push(test);
  return test;
};

describe('collectTestsWithoutRunning', () => {
  it('collects tests from a flat describe block', async () => {
    const state = getRunnerState();
    const root = state.rootDescribeBlock;

    addTestToBlock('test one', root);
    addTestToBlock('test two', root);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults).toHaveLength(2);
    expect(result.testResults[0].title).toBe('test one');
    expect(result.testResults[0].status).toBe('pending');
    expect(result.testResults[0].ancestorTitles).toEqual([]);
    expect(result.testResults[1].title).toBe('test two');
    expect(result.numPendingTests).toBe(2);
    expect(result.numPassingTests).toBe(0);
    expect(result.numFailingTests).toBe(0);
    expect(result.testFilePath).toBe('/path/to/test.js');
  });

  it('collects tests from nested describe blocks', async () => {
    const state = getRunnerState();
    const root = state.rootDescribeBlock;

    const suite = makeDescribe('my suite', root);
    root.children.push(suite);
    addTestToBlock('nested test', suite);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults).toHaveLength(1);
    expect(result.testResults[0].title).toBe('nested test');
    expect(result.testResults[0].ancestorTitles).toEqual(['my suite']);
    expect(result.testResults[0].fullName).toBe('my suite nested test');
  });

  it('collects tests from deeply nested describe blocks', async () => {
    const state = getRunnerState();
    const root = state.rootDescribeBlock;

    const outer = makeDescribe('outer', root);
    root.children.push(outer);

    const inner = makeDescribe('inner', outer);
    outer.children.push(inner);

    addTestToBlock('deep test', inner);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults).toHaveLength(1);
    expect(result.testResults[0].title).toBe('deep test');
    expect(result.testResults[0].ancestorTitles).toEqual(['outer', 'inner']);
    expect(result.testResults[0].fullName).toBe('outer inner deep test');
  });

  it('returns empty results when no tests exist', async () => {
    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults).toHaveLength(0);
    expect(result.numPendingTests).toBe(0);
  });

  it('sets all assertion results to pending status with correct defaults', async () => {
    const state = getRunnerState();
    const root = state.rootDescribeBlock;

    addTestToBlock('a test', root);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    const assertion = result.testResults[0];
    expect(assertion.status).toBe('pending');
    expect(assertion.duration).toBeNull();
    expect(assertion.failureMessages).toEqual([]);
    expect(assertion.failureDetails).toEqual([]);
    expect(assertion.invocations).toBe(0);
    expect(assertion.numPassingAsserts).toBe(0);
    expect(assertion.retryReasons).toEqual([]);
    expect(assertion.startAt).toBeNull();
    expect(assertion.location).toBeNull();
    expect(assertion.failing).toBe(false);
  });

  it('collects tests from multiple sibling suites', async () => {
    const state = getRunnerState();
    const root = state.rootDescribeBlock;

    const suite1 = makeDescribe('suite A', root);
    root.children.push(suite1);
    addTestToBlock('test A1', suite1);

    const suite2 = makeDescribe('suite B', root);
    root.children.push(suite2);
    addTestToBlock('test B1', suite2);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults).toHaveLength(2);
    expect(result.testResults[0].ancestorTitles).toEqual(['suite A']);
    expect(result.testResults[0].title).toBe('test A1');
    expect(result.testResults[1].ancestorTitles).toEqual(['suite B']);
    expect(result.testResults[1].title).toBe('test B1');
    expect(result.numPendingTests).toBe(2);
  });

  it('filters out ROOT_DESCRIBE_BLOCK from ancestor titles', async () => {
    const state = getRunnerState();
    const root = state.rootDescribeBlock;

    addTestToBlock('root test', root);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults[0].ancestorTitles).not.toContain(
      ROOT_DESCRIBE_BLOCK_NAME,
    );
  });

  it('includes config displayName in result', async () => {
    const config = makeProjectConfig({
      displayName: {color: 'blue', name: 'my-project'},
    });

    const result = await collectTestsWithoutRunning({
      config,
      testPath: '/path/to/test.js',
    });

    expect(result.displayName).toEqual({color: 'blue', name: 'my-project'});
  });
});
