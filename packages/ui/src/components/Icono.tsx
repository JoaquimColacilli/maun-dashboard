import {
  ArrowLeftRight,
  ChevronLeft,
  Church,
  CloudOff,
  FolderKanban,
  FolderPlus,
  Hammer,
  HandCoins,
  House,
  PiggyBank,
  Plus,
  Route,
  Settings,
  TriangleAlert,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

const ICONOS = {
  'arrow-left-right': ArrowLeftRight,
  'chevron-left': ChevronLeft,
  church: Church,
  'cloud-off': CloudOff,
  'folder-kanban': FolderKanban,
  'folder-plus': FolderPlus,
  hammer: Hammer,
  'hand-coins': HandCoins,
  house: House,
  'piggy-bank': PiggyBank,
  plus: Plus,
  route: Route,
  settings: Settings,
  'triangle-alert': TriangleAlert,
  truck: Truck,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
} as const;

export type NombreDeIcono = keyof typeof ICONOS;

export interface IconoProps {
  nombre: NombreDeIcono;
  tamano?: number;
  grosor?: number;
  className?: string;
}

export function Icono({ nombre, tamano = 20, grosor = 1.75, className }: IconoProps) {
  const Dibujo = ICONOS[nombre];
  return (
    <Dibujo
      aria-hidden
      focusable={false}
      size={tamano}
      strokeWidth={grosor}
      className={className}
    />
  );
}
