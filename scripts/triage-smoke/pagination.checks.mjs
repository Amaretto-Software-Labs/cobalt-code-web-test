import assert from 'node:assert/strict';
import test from 'node:test';
import { pageCount } from './pagination.mjs';

test('empty lists have no pages', () => assert.equal(pageCount(0, 10), 0));
test('full pages are counted', () => assert.equal(pageCount(20, 10), 2));
test('a partial final page is counted after full pages', () => assert.equal(pageCount(21, 10), 3));
test('a list smaller than one page still needs a page', () => assert.equal(pageCount(1, 10), 1));
test('invalid page size is rejected', () => assert.throws(() => pageCount(10, 0), RangeError));
test('invalid item counts are rejected', () => {
  for (const totalItems of [-1, 1.5, NaN, Infinity, '1']) {
    assert.throws(() => pageCount(totalItems, 10), RangeError);
  }
});
test('invalid nonzero page sizes are rejected', () => {
  for (const pageSize of [-1, 1.5, NaN, Infinity, '10']) {
    assert.throws(() => pageCount(10, pageSize), RangeError);
  }
});
