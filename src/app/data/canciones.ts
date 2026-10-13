export interface Cancion {
  id: string;
  name: string;
  short: string;
  notes: number[];
  color: string;
}

export const WHEEL_NOTES: { n: number; name: string }[] = [
  { n: 1, name: 'Do' },
  { n: 2, name: 'Sol' },
  { n: 3, name: 'Re' },
  { n: 4, name: 'La' },
  { n: 5, name: 'Mi' },
  { n: 6, name: 'Si' },
  { n: 7, name: 'Fa#' },
  { n: 8, name: 'Do#' },
  { n: 9, name: 'Sol#' },
  { n: 10, name: 'Re#' },
  { n: 11, name: 'La#' },
  { n: 12, name: 'Fa' },
];

export const CANCIONES: Cancion[] = [
  { id: 'alba', name: 'Cantar del Alba', short: 'Alba', notes: [1, 5, 9], color: '#3498db' },
  { id: 'arquero', name: 'Balada del Arquero Errante', short: 'Balada', notes: [5, 8, 12], color: '#e74c3c' },
  { id: 'tormenta', name: 'Oda a la Tormenta', short: 'Oda', notes: [3, 5, 7, 11], color: '#f1c40f' },
  { id: 'requiem', name: 'Réquiem por los Caídos', short: 'Réquiem', notes: [1, 2, 3, 8, 10], color: '#2ecc71' },
  { id: 'marcha', name: 'Marcha de los Héroes', short: 'Marcha', notes: [2, 4, 6, 10, 12], color: '#9b59b6' },
];
