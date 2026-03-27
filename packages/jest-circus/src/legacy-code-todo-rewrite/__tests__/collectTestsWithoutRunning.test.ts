/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {makeProjectConfig} from '@jest/test-utils';
import type {Circus} from '@jest/types';
import {getState as getRunnerState, resetState} from '../../state';
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
  it('collects flat tests with pending status', async () => {
    const root = getRunnerState().rootDescribeBlock;
    addTestToBlock('test one', root);
    addTestToBlock('test two', root);

    const result = await collectTestsWithoutRunning({
      config: makeProjectConfig(),
      testPath: '/path/to/test.js',
    });

    expect(result.testResults).toHaveLength(2);
    expect(result.testResults[0].title).toBe('test one');
    expect(result.testResults[0].status).toBe('pending');
    expect(result.numPendingTests).toBe(2);
    expect(result.numPassingTests).toBe(0);
    expect(result.numFailingTests).toBe(0);
    expect(result.testFilePath).toBe('/path/to/test.js');
  });

  it('collects nested tests with correct ancestor titles', async () => {
    const root = getRunnerState().rootDescribeBlock;
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
});
