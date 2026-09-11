export function Cargando({ que }: { que: string }) {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-content flex-col gap-3.5 px-(--page-pad-mobile) py-8 md:px-(--page-pad-tablet)"
    >
      <span className="sr-only">{que}</span>
      <div aria-hidden className="h-5 w-2/3 rounded-field bg-surface-2" />
      <div aria-hidden className="h-5 w-1/2 rounded-field bg-surface-2" />
      <div aria-hidden className="h-28 rounded-panel bg-surface-2" />
    </div>
  );
}
