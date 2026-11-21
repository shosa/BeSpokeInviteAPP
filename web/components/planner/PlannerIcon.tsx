"use client";

import {
  Anchor, Baby, Balloon, BookOpen, Briefcase, Building2, Cake, CakeSlice, Camera, Cat, Church, Crown, Diamond, Dog, Feather, Flower2, Gem, Gift,
  GraduationCap, Heart, HeartHandshake, Infinity as InfinityIcon, Leaf, Martini, Medal, Mic, Moon, Mountain, Music, PartyPopper, Plane, Rabbit, Bird,
  Rocket, Sparkles, Star, Sun, TreePalm, Trophy, UtensilsCrossed, Wine, type LucideIcon,
} from "lucide-react";
import { PLANNER_ICONS, defaultPlannerIcon, isPlannerIcon, type PlannerIcon as IconKey } from "@inviteme/shared";

// Disegni delle icone del planner (elenco e nomi in shared/src/plannerIcons.ts).
const ICONS: Record<IconKey, LucideIcon> = {
  gem: Gem, heart: Heart, "heart-handshake": HeartHandshake, infinity: InfinityIcon, church: Church, flower: Flower2, leaf: Leaf, feather: Feather,
  sparkles: Sparkles, star: Star, crown: Crown, diamond: Diamond, cake: Cake, "cake-slice": CakeSlice, "party-popper": PartyPopper, balloon: Balloon,
  gift: Gift, baby: Baby, rabbit: Rabbit, bird: Bird, "graduation-cap": GraduationCap, "book-open": BookOpen, trophy: Trophy, medal: Medal,
  briefcase: Briefcase, building: Building2, mic: Mic, music: Music, wine: Wine, martini: Martini, utensils: UtensilsCrossed, camera: Camera,
  plane: Plane, palm: TreePalm, sun: Sun, moon: Moon, mountain: Mountain, anchor: Anchor, dog: Dog, cat: Cat, rocket: Rocket,
};

// Icona del planner: quella scelta, altrimenti quella del tipo di evento.
export function PlannerIcon({ icon, eventType, size = 24 }: { icon?: string | null; eventType?: string; size?: number }) {
  const key = isPlannerIcon(icon) ? icon : defaultPlannerIcon(eventType);
  const I = ICONS[key];
  return <I size={size} strokeWidth={1.5} aria-hidden="true" />;
}

// Icona della libreria per chiave (categorie dei template): senza una chiave valida, le scintille.
export function LibraryIcon({ icon, size = 20 }: { icon?: string | null; size?: number }) {
  const I = ICONS[isPlannerIcon(icon) ? icon : "sparkles"];
  return <I size={size} strokeWidth={1.5} aria-hidden="true" />;
}

// Griglia di scelta: un pulsante per icona, quella scelta evidenziata.
export function PlannerIconPicker({ value, eventType, onChange, lang, label }: { value?: string | null; eventType?: string; onChange: (key: IconKey) => void; lang: "it" | "en"; label?: string }) {
  const current = isPlannerIcon(value) ? value : defaultPlannerIcon(eventType);
  return (
    <div className="pi-grid" role="radiogroup" aria-label={label ?? (lang === "en" ? "Planner icon" : "Icona del planner")}>
      {PLANNER_ICONS.map((i) => {
        const I = ICONS[i.key];
        const on = current === i.key;
        return (
          <button key={i.key} type="button" role="radio" aria-checked={on} className={`pi-btn${on ? " is-on" : ""}`} title={lang === "en" ? i.en : i.it} aria-label={lang === "en" ? i.en : i.it} onClick={() => onChange(i.key)}>
            <I size={22} strokeWidth={1.5} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
