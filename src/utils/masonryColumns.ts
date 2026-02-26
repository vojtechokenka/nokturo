/**
 * Distributes items into columns left-to-right (row-first order).
 * Item 0 → col 0, item 1 → col 1, item 2 → col 2, item 3 → col 0, etc.
 * Unlike CSS columns which fill column-first, this gives Pinterest-style left-to-right flow.
 */
export function distributeToColumns<T>(items: T[], columnCount: number): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });
  return columns;
}
