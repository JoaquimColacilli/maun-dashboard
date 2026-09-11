import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';

import { CA_DE_SUPABASE, hostDelPooler } from './conexion.ts';

function cadenaDelPooler(host: string): Promise<tls.DetailedPeerCertificate[]> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(5432, host);
    socket.once('error', reject);
    socket.once('connect', () => {
      const pedido = Buffer.alloc(8);
      pedido.writeInt32BE(8, 0);
      pedido.writeInt32BE(80877103, 4);
      socket.write(pedido);
    });
    socket.once('data', () => {
      const seguro = tls.connect({ socket, servername: host, rejectUnauthorized: false }, () => {
        const cadena: tls.DetailedPeerCertificate[] = [];
        let cert = seguro.getPeerCertificate(true);
        while (!cadena.some((visto) => visto.fingerprint256 === cert.fingerprint256)) {
          cadena.push(cert);
          cert = cert.issuerCertificate;
        }
        seguro.end();
        resolve(cadena);
      });
      seguro.once('error', reject);
    });
  });
}

const fijada = new X509Certificate(readFileSync(CA_DE_SUPABASE));
const host = hostDelPooler();
const cadena = await cadenaDelPooler(host);

console.log(`Raíz fijada en el repo: ${fijada.subject.replaceAll('\n', ', ')}`);
console.log(`  vence: ${fijada.validTo}`);
console.log(`  sha256: ${fijada.fingerprint256}`);
console.log(`Cadena que presenta ${host}:`);
function nombreComun(campo: string | string[] | undefined): string {
  return Array.isArray(campo) ? campo.join(', ') : (campo ?? '?');
}

for (const cert of cadena) {
  console.log(
    `  ${nombreComun(cert.subject.CN)} (emisor: ${nombreComun(cert.issuer.CN)}, vence: ${cert.valid_to})`,
  );
  console.log(`    sha256: ${cert.fingerprint256}`);
}

const coincide = cadena.some((cert) => cert.fingerprint256 === fijada.fingerprint256);
console.log(
  coincide
    ? 'La raíz fijada es la que usa el pooler.'
    : 'La raíz fijada NO está en la cadena del pooler: Supabase rotó su CA. Ver ADR 0008, "Raíz TLS".',
);
process.exitCode = coincide ? 0 : 1;
