/** Return the number of pages needed for a nonnegative integer item count and positive integer page size. */
export function pageCount(totalItems, pageSize) {
  if (!Number.isInteger(totalItems) || totalItems < 0 || !Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('Expected a nonnegative item count and a positive page size');
  }
  return Math.floor(totalItems / pageSize);
}
