export function hoyLocal(ahora: Date = new Date()): string {
  const anio = String(ahora.getFullYear()).padStart(4, '0');
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}
