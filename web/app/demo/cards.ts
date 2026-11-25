// Gli inviti della demo: testi della scheda (il contenuto vero dell'invito è in api/src/showcase.ts).
export type DemoCard = { key: string; themeId: string; theme: string; kind: [string, string]; title: string; when: [string, string]; where: [string, string]; text: [string, string]; notes: [string, string][] };

export const DEMO_CARDS: DemoCard[] = [
  {
    key: "melograno",
    themeId: "melograno-di-sicilia",
    theme: "Melograno di Sicilia",
    kind: ["Matrimonio", "Wedding"],
    title: "Giulia & Matteo",
    when: ["Sabato 18 settembre 2027", "Saturday 18 September 2027"],
    where: ["Tenuta Busulmone, Noto", "Tenuta Busulmone, Noto"],
    text: [
      "Si sono conosciuti in fila per una granita e tornano in Sicilia per sposarsi. Rito in giardino, cena nel cortile, navette da Noto e brunch al mare la domenica.",
      "They met queuing for granita and are going back to Sicily to get married. Ceremony in the garden, dinner in the courtyard, shuttles from Noto and a beach brunch on Sunday.",
    ],
    notes: [["Risposta con navetta e brunch", "RSVP with shuttle and brunch"], ["Planner collegato", "Linked planner"], ["Domande frequenti", "FAQ"]],
  },
  {
    key: "smeraldo",
    themeId: "stemma-smeraldo",
    theme: "Stemma Smeraldo",
    kind: ["Nozze d'oro", "Golden anniversary"],
    title: "Alice & Davide",
    when: ["Sabato 12 giugno 2027", "Saturday 12 June 2027"],
    where: ["San Miniato al Monte e Bellosguardo, Firenze", "San Miniato al Monte and Bellosguardo, Florence"],
    text: [
      "Cinquant'anni di matrimonio, organizzati in segreto dai tre figli: messa dove tutto è iniziato, pranzo sulla collina e una sorpresa alle quattro.",
      "Fifty years of marriage, secretly organised by their three children: Mass where it all began, lunch on the hill and a surprise at four.",
    ],
    notes: [["Galleria e filmino di famiglia", "Family photos and home movie"], ["Messaggi da leggere alla festa", "Messages to read at the party"], ["Busta di velluto", "Velvet envelope"]],
  },
  {
    key: "pizzo",
    themeId: "velo-di-pizzo",
    theme: "Velo di Pizzo",
    kind: ["Matrimonio", "Wedding"],
    title: "Elisa & James",
    when: ["Sabato 5 giugno 2027", "Saturday 5 June 2027"],
    where: ["Villa delle Rose Bianche, Cernobbio", "Villa delle Rose Bianche, Cernobbio"],
    text: [
      "Lei di Como, lui di Londra: un matrimonio in due lingue sul lago, con il battello per arrivare, la cena alla lunga tavola e si balla nella limonaia.",
      "She's from Como, he's from London: a bilingual wedding on the lake, with a boat to get there, dinner at the long table and dancing in the lemon house.",
    ],
    notes: [["Invito in italiano e inglese", "Italian and English versions"], ["Battello e piano pioggia", "Boat times and rain plan"], ["Canzone richiesta nella risposta", "Song request in the RSVP"]],
  },
];
