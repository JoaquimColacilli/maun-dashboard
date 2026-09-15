import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import type { AccionesDeLaAgenda } from '@/entities/agenda';
import { useReplicaDelTaller } from '@/entities/replica';
import { filaPorId } from '@/shared/api';
import { rutaDelProyecto } from '@/shared/lib';

import { borrar, marcar, marcarDelTrabajo, tildar, type Avisador } from '../model/acciones';

export function useAccionesDeLaAgenda(avisar?: Avisador): AccionesDeLaAgenda {
  const cliente = useQueryClient();
  const replica = useReplicaDelTaller();
  const navegar = useNavigate();

  return {
    alAbrirTrabajo: (evento) => {
      void navegar(rutaDelProyecto(evento.proyectoId));
    },
    alTildar: (evento) => {
      tildar(cliente, evento, avisar);
    },
    alMarcar: (evento) => {
      if (evento.clase === 'propia') {
        marcar(cliente, evento, avisar);
        return;
      }
      const proyecto = filaPorId(replica, 'proyectos', evento.proyectoId);
      if (proyecto) marcarDelTrabajo(cliente, evento, proyecto, avisar);
    },
    alBorrar: (evento) => {
      const fila = filaPorId(replica, 'anotaciones', evento.id);
      if (fila) borrar(cliente, fila, avisar);
    },
  };
}
