import { describe, it, expect } from 'vitest';

function getCollectionIdsFromSummaryItem(item) {
  const { collections, collectionIds } = item;
  if (Array.isArray(collectionIds) && collectionIds.length > 0) {
    return collectionIds.map(id => Number(id)).filter(Boolean);
  }
  if (Array.isArray(collections) && collections.length > 0) {
    if (typeof collections[0] === 'number') {
      return collections.map(id => Number(id)).filter(Boolean);
    }
    return collections.map(c => Number(c.id)).filter(Boolean);
  }
  return [];
}

describe('paymentSettlement helpers', () => {
  it('extracts collection ids from summary item', () => {
    expect(
      getCollectionIdsFromSummaryItem({
        farmerId: 1,
        collectionIds: [10, 11],
        collections: [{ id: 99 }],
      })
    ).toEqual([10, 11]);
  });

  it('falls back to collection objects when ids missing', () => {
    expect(
      getCollectionIdsFromSummaryItem({
        farmerId: 2,
        collections: [{ id: 21 }, { id: 22 }],
      })
    ).toEqual([21, 22]);
  });
});
