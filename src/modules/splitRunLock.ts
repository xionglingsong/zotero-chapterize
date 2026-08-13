const activeTargets = new Set<string>();

export function makeSplitRunKey(libraryID: number, itemID: number): string {
  return `${libraryID}:${itemID}`;
}

export function tryAcquireSplitRun(key: string): boolean {
  if (activeTargets.has(key)) return false;
  activeTargets.add(key);
  return true;
}

export function releaseSplitRun(key: string): void {
  activeTargets.delete(key);
}
