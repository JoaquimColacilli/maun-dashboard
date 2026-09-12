const PREFIJO_ARGENTINA = '54';
const LARGO_NACIONAL = 10;
const CON_QUINCE = /^(\d{2,4})15(\d{6,8})$/;

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return `${primera}${ultima}`.toUpperCase();
}

export function nombreCorto(nombre: string): string {
  const limpio = nombre.trim();
  const primera = limpio.split(/\s+/)[0] ?? limpio;
  return primera === 'Familia' || primera === 'Estudio' ? limpio : primera;
}

// El teléfono se guarda como lo escribió el usuario: normalizar solo sirve para armar el enlace de
// WhatsApp, que necesita el número en formato internacional. Un número argentino escrito a mano
// viene de mil formas y rechazarlas sería hostil.
export function telefonoParaWhatsapp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos === '') return null;

  if (telefono.trim().startsWith('+')) return digitos;
  if (digitos.startsWith('00')) return digitos.slice(2);
  if (digitos.startsWith(PREFIJO_ARGENTINA) && digitos.length > LARGO_NACIONAL + 1) return digitos;

  const sinCero = digitos.startsWith('0') ? digitos.slice(1) : digitos;
  const sinQuince = sinCero.replace(CON_QUINCE, '$1$2');
  return `${PREFIJO_ARGENTINA}9${sinQuince}`;
}

export function enlaceDeLlamada(telefono: string): string | null {
  const numero = telefono.replace(/[^\d+]/g, '');
  return numero === '' ? null : `tel:${numero}`;
}

export function enlaceDeWhatsapp(telefono: string): string | null {
  const numero = telefonoParaWhatsapp(telefono);
  return numero === null ? null : `https://wa.me/${numero}`;
}

export function enlaceDeMapa(direccion: string, zona: string): string | null {
  const partes = [direccion, zona].map((parte) => parte.trim()).filter(Boolean);
  if (partes.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`;
}

export function enlaceDeEmail(email: string): string | null {
  const limpio = email.trim();
  return limpio === '' ? null : `mailto:${limpio}`;
}
