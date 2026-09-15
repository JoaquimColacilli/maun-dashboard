import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Bell,
  BellOff,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Church,
  Circle,
  CircleAlert,
  Clock,
  CloudOff,
  Eye,
  EyeOff,
  FileText,
  FingerprintPattern,
  FolderKanban,
  FolderPlus,
  Hammer,
  HandCoins,
  House,
  Link2,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  Package,
  Pencil,
  PencilLine,
  PencilRuler,
  Phone,
  PiggyBank,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings,
  Smartphone,
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
  bell: Bell,
  'bell-off': BellOff,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  'calendar-days': CalendarDays,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  church: Church,
  circle: Circle,
  'circle-alert': CircleAlert,
  clock: Clock,
  'cloud-off': CloudOff,
  eye: Eye,
  'eye-off': EyeOff,
  'file-text': FileText,
  fingerprint: FingerprintPattern,
  'folder-kanban': FolderKanban,
  'folder-plus': FolderPlus,
  hammer: Hammer,
  'hand-coins': HandCoins,
  house: House,
  'link-2': Link2,
  mail: Mail,
  'map-pin': MapPin,
  'maximize-2': Maximize2,
  'message-circle': MessageCircle,
  'monitor-smartphone': MonitorSmartphone,
  moon: Moon,
  package: Package,
  pencil: Pencil,
  'pencil-line': PencilLine,
  'pencil-ruler': PencilRuler,
  phone: Phone,
  'piggy-bank': PiggyBank,
  plus: Plus,
  'refresh-cw': RefreshCw,
  route: Route,
  search: Search,
  settings: Settings,
  smartphone: Smartphone,
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
