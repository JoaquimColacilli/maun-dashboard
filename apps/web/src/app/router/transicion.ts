interface ConTransiciones {
  startViewTransition: (actualizar: () => void | Promise<void>) => unknown;
}

function soportaTransiciones(documento: Document): documento is Document & ConTransiciones {
  return 'startViewTransition' in documento && typeof documento.startViewTransition === 'function';
}

function prefiereMenosMovimiento(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function conTransicion(actualizar: () => void | Promise<void>): void {
  if (prefiereMenosMovimiento() || !soportaTransiciones(document)) {
    void actualizar();
    return;
  }
  document.startViewTransition(actualizar);
}
