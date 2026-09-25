import { faseDeLosAvisos } from '../model/fase';
import { HORA_INICIAL } from '../model/textos';
import { ActivarLosAvisos } from './ActivarLosAvisos';
import {
  AvisosBloqueados,
  ErrorDeLosAvisos,
  EsqueletoDeLosAvisos,
  InstalarEnElIphone,
  MejorEsfuerzo,
  SinClaves,
  SinSoporte,
} from './EstadosSinAvisos';
import { PreferenciasDeLosAvisos } from './PreferenciasDeLosAvisos';
import { useAvisosDelDispositivo } from './useAvisosDelDispositivo';

export function AvisosDelDispositivo() {
  const avisos = useAvisosDelDispositivo();
  const { carga } = avisos;

  if (carga.tipo === 'cargando') return <EsqueletoDeLosAvisos />;
  if (carga.tipo === 'error') {
    return <ErrorDeLosAvisos sinSenal={carga.sinSenal} alReintentar={avisos.reintentar} />;
  }

  const fase = faseDeLosAvisos(carga.dispositivo, carga.servidor, carga.estado);
  const { preferencias } = carga.estado;
  const activos = fase === 'activos' && preferencias !== null;

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {fase === 'sin-claves' && <SinClaves />}
      {fase === 'sin-instalar' && <InstalarEnElIphone />}
      {fase === 'sin-soporte' && <SinSoporte />}
      {fase === 'denegado' && (
        <AvisosBloqueados
          comoApp={carga.dispositivo.comoApp}
          mensaje={avisos.mensaje}
          alRevisar={avisos.revisarElPermiso}
        />
      )}
      {(fase === 'sin-pedir' || (fase === 'activos' && !activos)) && (
        <ActivarLosAvisos
          hora={preferencias?.hora ?? HORA_INICIAL}
          zonaGuardada={preferencias?.zona ?? null}
          activando={avisos.activando}
          mensaje={avisos.mensaje}
          alActivar={avisos.activar}
        />
      )}
      {activos && (
        <PreferenciasDeLosAvisos
          estado={carga.estado}
          preferencias={preferencias}
          probando={avisos.probando}
          apagando={avisos.apagando}
          alCambiar={avisos.guardar}
          alProbar={avisos.probar}
          alApagar={avisos.apagar}
        />
      )}
      <MejorEsfuerzo />
    </div>
  );
}
