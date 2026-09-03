export interface MobSymbol {
  id: string;
  icon: string;
  label: string;
}

export const MOB_SYMBOLS: MobSymbol[] = [
  { id: 'skull', icon: '💀', label: 'Calavera' },
  { id: 'cross', icon: '✕', label: 'Cruz' },
  { id: 'square', icon: '⬛', label: 'Cuadrado' },
  { id: 'diamond', icon: '🔶', label: 'Rombo' },
  { id: 'circle', icon: '🔴', label: 'Círculo' },
  { id: 'triangle', icon: '🔺', label: 'Triángulo' },
  { id: 'moon', icon: '🌙', label: 'Luna' },
  { id: 'star', icon: '⭐', label: 'Estrella' },
];

export function symbolIcon(index: number | null | undefined): string {
  if (index === null || index === undefined) return '';
  const sym = MOB_SYMBOLS[index];
  return sym ? sym.icon : '';
}

export function assignedSymbolIndexes(monsters: { symbol?: number | null }[]): Set<number> {
  return new Set(monsters.map((m) => m.symbol).filter((s): s is number => s !== null && s !== undefined));
}

export function nextFreeSymbol(monsters: { symbol?: number | null }[]): number {
  const used = assignedSymbolIndexes(monsters);
  for (let i = 0; i < MOB_SYMBOLS.length; i++) {
    if (!used.has(i)) return i;
  }
  return 0;
}
