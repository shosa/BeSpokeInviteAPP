import { CalendarDays, CircleHelp, Car, CalendarClock, Gift, Hand, Image as ImageIcon, ListOrdered, PartyPopper, Mail, Map, MapPin, Images, Music, PenLine, Shirt, Timer, MessageSquare, CircleCheck, Video, type LucideIcon } from "lucide-react";
import type { BlockType } from "@inviteme/shared";

// Un'icona per ogni tipo di blocco: la vetrina dei blocchi e i modelli le mostrano accanto al nome.
const ICON: Record<BlockType, LucideIcon> = {
  cover: Mail,
  hero: PartyPopper,
  scratchdate: Hand,
  date: CalendarDays,
  countdown: Timer,
  message: MessageSquare,
  gallery: Images,
  image: ImageIcon,
  program: ListOrdered,
  venue: MapPin,
  map: Map,
  transfer: Car,
  dresscode: Shirt,
  video: Video,
  music: Music,
  rsvp: CircleCheck,
  gifts: Gift,
  faq: CircleHelp,
  footer: PenLine,
};

export function BlockIcon({ type, size = 18 }: { type: BlockType; size?: number }) {
  const Icon = ICON[type] ?? Gift;
  return <Icon size={size} aria-hidden="true" />;
}

export { CalendarClock, Sparkles } from "lucide-react";
