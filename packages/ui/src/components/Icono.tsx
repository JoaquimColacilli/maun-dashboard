import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Church,
  CircleAlert,
  Clock,
  CloudOff,
  FolderKanban,
  FolderPlus,
  Hammer,
  HandCoins,
  House,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  PiggyBank,
  Plus,
  Route,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  Truck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const ICONOS = {
  'arrow-down': ArrowDown,
  'arrow-left-right': ArrowLeftRight,
  'arrow-up': ArrowUp,
  'arrow-up-down': ArrowUpDown,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  church: Church,
  'circle-alert': CircleAlert,
  clock: Clock,
  'cloud-off': CloudOff,
  'folder-kanban': FolderKanban,
  'folder-plus': FolderPlus,
  hammer: Hammer,
  'hand-coins': HandCoins,
  house: House,
  mail: Mail,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  pencil: Pencil,
  phone: Phone,
  'piggy-bank': PiggyBank,
  plus: Plus,
  route: Route,
  search: Search,
  settings: Settings,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  truck: Truck,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
  x: X,
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
