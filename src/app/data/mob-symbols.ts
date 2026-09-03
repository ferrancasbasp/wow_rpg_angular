export interface MobSymbol {
  id: string;
  icon: string;
  img: string;
  label: string;
}

export const MOB_SYMBOLS: MobSymbol[] = [
  { id: 'skull', icon: '💀', img: 'img/mobs/skull.jpg', label: 'Calavera' },
  { id: 'cross', icon: '✕', img: 'img/mobs/cross.jpg', label: 'Cruz' },
  { id: 'square', icon: '⬛', img: 'img/mobs/square.jpg', label: 'Cuadrado' },
  { id: 'diamond', icon: '🔶', img: 'img/mobs/diamond.jpg', label: 'Rombo' },
  { id: 'circle', icon: '🔴', img: 'img/mobs/circle.jpg', label: 'Círculo' },
  { id: 'triangle', icon: '🔺', img: 'img/mobs/triangle.jpg', label: 'Triángulo' },
  { id: 'moon', icon: '🌙', img: 'img/mobs/moon.jpg', label: 'Luna' },
  { id: 'star', icon: '⭐', img: 'img/mobs/star.jpg', label: 'Estrella' },
];

export function symbolIcon(index: number | null | undefined): string {
  if (index === null || index === undefined) return '';
  const sym = MOB_SYMBOLS[index];
  return sym ? sym.icon : '';
}

export function symbolImg(index: number | null | undefined): string {
  if (index === null || index === undefined) return '';
  const sym = MOB_SYMBOLS[index];
  return sym ? sym.img : '';
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
