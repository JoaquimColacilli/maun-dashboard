export function hayCambios<T extends object>(inicial: T, actual: T): boolean {
  return (Object.keys(inicial) as (keyof T)[]).some(
    (clave) => !Object.is(inicial[clave], actual[clave]),
  );
}
