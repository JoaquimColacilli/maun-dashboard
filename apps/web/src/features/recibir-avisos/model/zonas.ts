export interface ZonaHoraria {
  id: string;
  lugar: string;
}

export interface OpcionDeZona {
  id: string;
  etiqueta: string;
}

export const ZONAS_HORARIAS: readonly ZonaHoraria[] = [
  { id: 'America/Argentina/Buenos_Aires', lugar: 'Argentina' },
  { id: 'America/Argentina/Cordoba', lugar: 'Córdoba' },
  { id: 'America/Montevideo', lugar: 'Uruguay' },
  { id: 'America/Santiago', lugar: 'Chile' },
  { id: 'America/La_Paz', lugar: 'Bolivia' },
  { id: 'Europe/Madrid', lugar: 'España' },
];

export function desfaseDeLaZona(zona: string, ahora: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    timeZoneName: 'shortOffset',
  }).formatToParts(ahora);
  const desfase = partes.find((parte) => parte.type === 'timeZoneName')?.value ?? 'GMT';
  return desfase.replace('-', '−');
}

export function opcionesDeZona(guardada: string | null, ahora: Date): OpcionDeZona[] {
  const conocida = guardada === null || ZONAS_HORARIAS.some((zona) => zona.id === guardada);
  const zonas = conocida
    ? ZONAS_HORARIAS
    : [...ZONAS_HORARIAS, { id: guardada, lugar: guardada.replaceAll('_', ' ') }];
  return zonas.map((zona) => ({
    id: zona.id,
    etiqueta: `${zona.lugar} (${desfaseDeLaZona(zona.id, ahora)})`,
  }));
}
