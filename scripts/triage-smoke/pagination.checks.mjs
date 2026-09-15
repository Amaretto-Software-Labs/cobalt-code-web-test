import assert from 'node:assert/strict';
import test from 'node:test';
import { pageCount } from './pagination.mjs';

test('empty lists have no pages', () => assert.equal(pageCount(0, 10), 0));
test('full pages are counted', () => assert.equal(pageCount(20, 10), 2));
test('invalid page size is rejected', () => assert.throws(() => pageCount(10, 0), RangeError));
