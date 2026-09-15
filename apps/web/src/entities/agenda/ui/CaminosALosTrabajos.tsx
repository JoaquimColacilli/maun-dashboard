import { useId } from 'react';
import { Link, useLocation } from 'react-router';

import {
  conFondo,
  esRutaDeHoja,
  rutaDeContactoNuevo,
  rutaDeProyectoNuevo,
  useUbicacionVisible,
} from '@/shared/lib';
import { Icono } from '@/shared/ui';

import { MarcaDeCategoria } from './MarcaDeCategoria';

export interface CaminosALosTrabajosProps {
  fecha?: string;
  alIr?: () => void;
}

export function CaminosALosTrabajos({ fecha, alIr }: CaminosALosTrabajosProps) {
  const location = useLocation();
  const fondo = useUbicacionVisible();
  const idDeLaExplicacion = useId();
  const desdeUnaHojaPorRuta = esRutaDeHoja(location.pathname);

  function alTocar(): void {
    if (!desdeUnaHojaPorRuta) alIr?.();
  }

  return (
    <div className="flex flex-col gap-1">
      <p id={idDeLaExplicacion} className="text-meta leading-snug text-text-2">
        Las visitas y las entregas no se anotan: salen del contacto y del proyecto, y aparecen solas
        en la agenda.
      </p>
      <ul aria-labelledby={idDeLaExplicacion} className="flex flex-col">
        <li>
          <Link
            to={rutaDeContactoNuevo(fecha)}
            state={conFondo(fondo)}
            replace={desdeUnaHojaPorRuta}
            onClick={alTocar}
            className="-mx-2 flex min-h-tap items-center gap-3 rounded-field px-2 py-1 hover:bg-surface"
          >
            <MarcaDeCategoria categoria="visita" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-body font-medium">Cargar un contacto de seguimiento</span>
              <span className="block text-meta text-text-2">con la visita ese día</span>
            </span>
            <Icono nombre="chevron-right" tamano={16} className="text-text-3" />
          </Link>
        </li>
        <li>
          <Link
            to={rutaDeProyectoNuevo(fecha)}
            replace={desdeUnaHojaPorRuta}
            onClick={alTocar}
            className="-mx-2 flex min-h-tap items-center gap-3 rounded-field px-2 py-1 hover:bg-surface"
          >
            <MarcaDeCategoria categoria="entrega" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-body font-medium">Cargar un proyecto</span>
              <span className="block text-meta text-text-2">con la entrega estimada ese día</span>
            </span>
            <Icono nombre="chevron-right" tamano={16} className="text-text-3" />
          </Link>
        </li>
      </ul>
    </div>
  );
}
