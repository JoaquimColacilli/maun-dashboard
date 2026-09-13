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
  Eye,
  EyeOff,
  FolderKanban,
  FolderPlus,
  Hammer,
  HandCoins,
  House,
  Mail,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  Pencil,
  Phone,
  PiggyBank,
  Plus,
  Route,
  Search,
  Settings,
  Sun,
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
  eye: Eye,
  'eye-off': EyeOff,
  'folder-kanban': FolderKanban,
  'folder-plus': FolderPlus,
  hammer: Hammer,
  'hand-coins': HandCoins,
  house: House,
  mail: Mail,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  'monitor-smartphone': MonitorSmartphone,
  moon: Moon,
  pencil: Pencil,
  phone: Phone,
  'piggy-bank': PiggyBank,
  plus: Plus,
  route: Route,
  search: Search,
  settings: Settings,
  sun: Sun,
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
