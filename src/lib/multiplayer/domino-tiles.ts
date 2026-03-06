export interface DominoTile {
  id: number;
  high: number;
  low: number;
  isDouble: boolean;
  totalPips: number;
}

export function createTileSet(): DominoTile[] {
  const tiles: DominoTile[] = [];
  let id = 0;
  for (let high = 0; high <= 6; high++) {
    for (let low = 0; low <= high; low++) {
      tiles.push({ id: id++, high, low, isDouble: high === low, totalPips: high + low });
    }
  }
  return tiles;
}

export function shuffleTiles(tiles: DominoTile[]): DominoTile[] {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function canPlay(tile: DominoTile, openEnds: [number, number]): boolean {
  return tile.high === openEnds[0] || tile.low === openEnds[0] ||
         tile.high === openEnds[1] || tile.low === openEnds[1];
}

export function getPlayableEnd(tile: DominoTile, openEnds: [number, number]): 'left' | 'right' | 'both' | null {
  const matchesLeft = tile.high === openEnds[0] || tile.low === openEnds[0];
  const matchesRight = tile.high === openEnds[1] || tile.low === openEnds[1];
  if (matchesLeft && matchesRight) return 'both';
  if (matchesLeft) return 'left';
  if (matchesRight) return 'right';
  return null;
}
