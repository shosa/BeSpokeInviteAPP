// Dati dell'area Bespoke Pro (api/src/pro.ts).

export type ProStudio = {
  id: string;
  name: string;
  active: boolean;
  credits: { invitations: number; planners: number };
  plan: { invitations: number; planners: number; renewDay: number; rollover: boolean };
  nextRenewal: string | null;
  stats: { clients: number; active: number; next30: number; online: number; rsvps7: number; todo: number };
  usedThisMonth: { invitations: number; planners: number };
};

export type ProClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  venue: string;
  archived: boolean;
  invitation: { id: string; published: boolean; themeId: string; rsvps: number } | null;
  pendingOrder: string | null;
  plannerId: string | null;
  guests: number;
  access: boolean;
};

export type ProClientDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  venue: string;
  address: string;
  notes: string;
  archived: boolean;
  invitations: { id: string; slug: string; published: boolean; views: number; themeId: string; themeName: string; rsvps: number; lastRsvp: string | null }[];
  planners: { id: string; budgetPct: number | null; tasks: number; tasksDone: number; tables: number; guests: number }[];
  pendingOrders: string[];
  access: { email: string; canInvite: boolean; canPlanner: boolean; sentAt: string }[];
  activity: { at: string; what: string }[];
  credits: { invitations: number; planners: number };
};

export type ProLedgerRow = { at: string; what: string; invitations: number; planners: number };

export const initials = (name: string) =>
  name
    .split(/[\s&]+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "·";
