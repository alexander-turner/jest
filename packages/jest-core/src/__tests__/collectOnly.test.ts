/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {AssertionResult, Suite} from '@jest/test-result';
import {printCollectedSuite, printCollectedTestTree} from '../runJest';

const makeMockStream = () => {
  const chunks: Array<string> = [];
  return {
    chunks,
    output: () => chunks.join(''),
    write: (data: string) => {
      chunks.push(data);
      return true;
    },
  };
};

const makeAssertionResult = (
  title: string,
  ancestorTitles: Array<string> = [],
): AssertionResult => ({
  ancestorTitles,
  duration: null,
  failing: false,
  failureDetails: [],
  failureMessages: [],
  fullName: [...ancestorTitles, title].join(' '),
  invocations: 0,
  location: null,
  numPassingAsserts: 0,
  retryReasons: [],
  startAt: null,
  status: 'pending',
  title,
});

describe('printCollectedSuite', () => {
  test('prints suite title and its tests', () => {
    const stream = makeMockStream();
    const suite: Suite = {
      suites: [],
      tests: [
        {duration: null, title: 'test one'},
        {duration: null, title: 'test two'},
      ],
      title: 'my suite',
    };

    printCollectedSuite(suite, stream, 1);

    const output = stream.output();
    expect(output).toContain('  \u270E my suite\n');
    expect(output).toContain('    \u270E test one\n');
    expect(output).toContain('    \u270E test two\n');
  });

  test('omits suite title when empty', () => {
    const stream = makeMockStream();
    const suite: Suite = {
      suites: [],
      tests: [{duration: null, title: 'only test'}],
      title: '',
    };

    printCollectedSuite(suite, stream, 0);

    const output = stream.output();
    expect(output).not.toContain('\u270E \n');
    expect(output).toContain('  \u270E only test\n');
  });

  test('recursively prints nested suites', () => {
    const stream = makeMockStream();
    const suite: Suite = {
      suites: [
        {
          suites: [],
          tests: [{duration: null, title: 'deep test'}],
          title: 'inner',
        },
      ],
      tests: [],
      title: 'outer',
    };

    printCollectedSuite(suite, stream, 0);

    const output = stream.output();
    expect(output).toContain('\u270E outer\n');
    expect(output).toContain('  \u270E inner\n');
    expect(output).toContain('    \u270E deep test\n');
  });
});

describe('printCollectedTestTree', () => {
  test('prints top-level tests', () => {
    const stream = makeMockStream();
    const results = [makeAssertionResult('standalone test')];

    printCollectedTestTree(results, stream);

    expect(stream.output()).toContain('  \u270E standalone test\n');
  });

  test('prints tests grouped by describe blocks', () => {
    const stream = makeMockStream();
    const results = [
      makeAssertionResult('nested test', ['my describe']),
      makeAssertionResult('another test', ['my describe']),
    ];

    printCollectedTestTree(results, stream);

    const output = stream.output();
    expect(output).toContain('\u270E my describe\n');
    expect(output).toContain('\u270E nested test\n');
    expect(output).toContain('\u270E another test\n');
  });

  test('prints deeply nested describe blocks', () => {
    const stream = makeMockStream();
    const results = [makeAssertionResult('deep', ['outer', 'inner'])];

    printCollectedTestTree(results, stream);

    const output = stream.output();
    expect(output).toContain('\u270E outer\n');
    expect(output).toContain('\u270E inner\n');
    expect(output).toContain('\u270E deep\n');
  });

  test('handles empty results', () => {
    const stream = makeMockStream();

    printCollectedTestTree([], stream);

    expect(stream.output()).toBe('');
  });
});
