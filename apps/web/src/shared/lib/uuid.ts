const HEX = Array.from({ length: 256 }, (_, valor) => valor.toString(16).padStart(2, '0'));

export function uuidv7(ahora: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  let resto = Math.floor(ahora);
  for (let posicion = 5; posicion >= 0; posicion--) {
    bytes[posicion] = resto % 256;
    resto = Math.floor(resto / 256);
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (valor) => HEX[valor] ?? '00').join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
