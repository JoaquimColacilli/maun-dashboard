export function precargarElQr(): void {
  void import('./DibujoDelQr').catch(() => undefined);
}
