/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

const SIDE_EFFECT_FILE = path.join(__dirname, '..', 'side-effect.txt');

describe('add', () => {
  test('adds positive numbers', () => {
    fs.writeFileSync(SIDE_EFFECT_FILE, 'executed');
    expect(1 + 2).toBe(3);
  });

  test('adds negative numbers', () => {
    expect(-1 + -2).toBe(-3);
  });
});

describe('subtract', () => {
  test('subtracts positive numbers', () => {
    expect(3 - 1).toBe(2);
  });
});

test.each([
  [1, 1, 2],
  [2, 3, 5],
])('table: %i + %i = %i', (a, b, expected) => {
  expect(a + b).toBe(expected);
});
