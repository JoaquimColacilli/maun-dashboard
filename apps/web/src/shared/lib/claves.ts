export const RAIZ_DE_REPLICA = 'replica';

export function claveDeReplica(usuarioId: string): readonly [string, string] {
  return [RAIZ_DE_REPLICA, usuarioId];
}

export function claveDeTodaReplica(): readonly [string] {
  return [RAIZ_DE_REPLICA];
}
