export interface InterruptorProps {
  etiqueta: string;
  activo: boolean;
  alCambiar: (activo: boolean) => void;
}

export function Interruptor({ etiqueta, activo, alCambiar }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => {
        alCambiar(!activo);
      }}
      className="flex min-h-tap flex-none items-center rounded-pill"
    >
      <span
        aria-hidden
        className={`flex h-8 w-[52px] items-center rounded-pill p-[3px] transition-colors duration-(--dur-fast) ${
          activo ? 'justify-end bg-ink' : 'justify-start bg-border'
        }`}
      >
        <span className="size-[26px] rounded-pill bg-paper shadow-float" />
      </span>
    </button>
  );
}
