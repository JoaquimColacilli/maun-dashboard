import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Enlace } from '@/entities/enlace';
import { ProveedorDeReplica } from '@/entities/replica';
import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';
import { CLAVE_DE_LOS_ENLACES, enlaceDelCliente } from '@/shared/lib';

import { BotonDelQr, MOSTRAR_EL_QR } from './BotonDelQr';
import { ESCANEALO, ES_EL_MISMO_ENLACE } from './HojaDelQr';

const AHORA = '2026-09-19T12:00:00Z';
const TOKEN = '0ZT7y-Qm4kVb2Rn8LpXsWd1A';

function enlace(cambios: Partial<Enlace> = {}): Enlace {
  return {
    id: 'e1',
    household_id: 'h',
    proyecto_id: 'p1',
    token_hash: 'a'.repeat(64),
    token: TOKEN,
    revocado_at: null,
    visitas: 0,
    ultima_visita_at: null,
    created_at: AHORA,
    updated_at: AHORA,
    deleted_at: null,
    version: 1,
    ...cambios,
  };
}

function replicaCon(enlaces: Enlace[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  tablas.enlaces_publicos = Object.fromEntries(enlaces.map((uno) => [uno.id, uno]));
  return { usuarioId: 'u1', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function montar(replica: Replica) {
  return render(
    <ProveedorDeReplica replica={replica}>
      <BotonDelQr proyectoId="p1" trabajo="Placard 3 puertas" />
    </ProveedorDeReplica>,
  );
}

function elBoton() {
  return screen.queryByRole('button', { name: MOSTRAR_EL_QR });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

describe('el botón del código QR', () => {
  it('con un enlace vivo y su dirección a mano, se ofrece', () => {
    montar(replicaCon([enlace()]));

    expect(elBoton()).toBeInTheDocument();
  });

  it('sin ningún enlace no aparece: no hay nada que escanear', () => {
    montar(replicaCon([]));

    expect(elBoton()).toBeNull();
  });

  it('con el enlace dado de baja tampoco: el QR se muere con él', () => {
    montar(replicaCon([enlace({ revocado_at: AHORA })]));

    expect(elBoton()).toBeNull();
  });

  it('con la fila sin dirección y sin el token guardado en este aparato, no aparece', () => {
    montar(replicaCon([enlace({ token: null })]));

    expect(elBoton()).toBeNull();
  });

  it('con la fila sin dirección pero el token guardado en este aparato, sí', () => {
    localStorage.setItem(CLAVE_DE_LOS_ENLACES, JSON.stringify({ e1: TOKEN }));

    montar(replicaCon([enlace({ token: null })]));

    expect(elBoton()).toBeInTheDocument();
  });

  it('sin conexión se dibuja igual: la dirección ya está en el aparato', async () => {
    onlineManager.setOnline(false);
    montar(replicaCon([enlace()]));

    fireEvent.click(screen.getByRole('button', { name: MOSTRAR_EL_QR }));

    expect(screen.getByText(ESCANEALO)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Código QR del enlace/ })).toBeInTheDocument();
  });

  it('la hoja muestra el trabajo, la dirección entera y de dónde sale el código', async () => {
    montar(replicaCon([enlace()]));

    fireEvent.click(screen.getByRole('button', { name: MOSTRAR_EL_QR }));

    expect(await screen.findByText('Placard 3 puertas')).toBeInTheDocument();
    expect(screen.getByText(enlaceDelCliente(TOKEN))).toBeInTheDocument();
    expect(screen.getByText(ES_EL_MISMO_ENLACE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar el enlace' })).toBeInTheDocument();
  });
});
