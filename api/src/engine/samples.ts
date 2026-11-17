import { themeCategories, type BlockType, type EventType, type InviteConfig } from "@inviteme/shared";

// Contenuti d'esempio della vetrina: cambiano a ogni caricamento (nomi, date, luoghi, programma) e seguono la lingua.
// Il tipo di evento segue il nome del template, così un template di laurea non mostra un matrimonio.
type Rnd = () => number;
type Lang = "it" | "en";
// Tipi di festa dei campioni: l'anniversario non ha un tipo proprio nel modello, si salva come matrimonio.
type Kind = EventType | "anniversary";
type Sample = { eventType: Kind; title: string; hosts: string; message: string; program: string[]; dress: string; venue: string; address: string; date: Date; time: string; signature: string };

const pick = <T>(list: T[], rnd: Rnd): T => list[Math.floor(rnd() * list.length)];

// Nomi per genere: le coppie prendono sempre un nome femminile e uno maschile.
const NAMES: Record<Lang, { f: string[]; m: string[] }> = {
  it: { f: ["Marta", "Giulia", "Chiara", "Sofia", "Alessia", "Elena", "Francesca", "Valentina"], m: ["Luca", "Marco", "Davide", "Paolo", "Andrea", "Matteo", "Nicola", "Simone"] },
  en: { f: ["Emma", "Olivia", "Sophie", "Amelia", "Grace", "Lily", "Ruby", "Hannah"], m: ["James", "Oliver", "Harry", "Charlie", "Tom", "Noah", "Jack", "Henry"] },
};
const VENUES: Record<Lang, [string, string][]> = {
  it: [["Villa dei Glicini", "Via dei Giardini 12, Firenze"], ["Tenuta del Lago", "Strada Provinciale 8, Como"], ["Terrazza sul Porto", "Molo Sud 3, Genova"], ["Giardino Botanico", "Viale delle Rose 21, Padova"], ["Sala Ferrara", "Corso Ferrara 4, Torino"], ["Casale degli Ulivi", "Località Colle 9, Siena"]],
  en: [["Willow Garden", "14 Mill Lane, Oxford"], ["Lakeside Estate", "Shore Road 8, Bath"], ["Harbour Terrace", "Quay Street 3, Bristol"], ["Botanic House", "Rose Avenue 21, Leeds"], ["Riverside Hall", "Bridge Walk 4, York"], ["Olive Farm", "Hill Road 9, Cambridge"]],
};

// Per tipo di evento: testi, programma e abbigliamento nelle due lingue.
const KIND: Record<Kind, Record<Lang, { titles: (a: string, b: string, n: number) => string[]; hosts: string[]; messages: string[]; program: string[]; dress: string[]; signature: (a: string, b: string) => string }>> = {
  wedding: {
    it: { titles: (a, b) => [`${a} & ${b}`, `${a} e ${b}`], hosts: ["Con gioia, le famiglie", "Insieme alle nostre famiglie"], messages: ["Abbiamo il piacere di invitarvi al nostro matrimonio.", "Vi aspettiamo per festeggiare il nostro sì."], program: ["Cerimonia", "Aperitivo", "Cena", "Festa"], dress: ["Elegante", "Abito scuro"], signature: (a, b) => `${a} e ${b}` },
    en: { titles: (a, b) => [`${a} & ${b}`, `${a} and ${b}`], hosts: ["With joy, the families", "Together with our families"], messages: ["We would love to invite you to our wedding.", "Join us to celebrate our big day."], program: ["Ceremony", "Drinks", "Dinner", "Party"], dress: ["Formal", "Dark suit"], signature: (a, b) => `${a} & ${b}` },
  },
  birthday: {
    it: { titles: (a, _b, n) => [`I ${n} di ${a}`, `${a} compie ${n}`, `Festa per ${a}`], hosts: ["Vieni a festeggiare con noi", "Musica, cibo e tanta allegria"], messages: ["Ci sarà musica, cibo e tanto divertimento: non mancare!", "Una serata tutta per festeggiare insieme."], program: ["Arrivi", "Aperitivo", "Torta", "Musica"], dress: ["Festa, colori a piacere", "Casual"], signature: (a) => a },
    en: { titles: (a, _b, n) => [`${a} turns ${n}`, `${n} with ${a}`, `${a}'s party`], hosts: ["Come celebrate with us", "Music, food and lots of fun"], messages: ["There will be music, food and plenty of fun: don't miss it!", "An evening all about celebrating together."], program: ["Arrivals", "Drinks", "Cake", "Music"], dress: ["Party, any colour", "Casual"], signature: (a) => a },
  },
  baby: {
    it: { titles: (a) => [`Aspettiamo ${a}`, `Benvenuto ${a}`], hosts: ["Con amore, mamma e papà", "Con gioia, la famiglia"], messages: ["Stiamo per accogliere il nostro piccolo: venite a festeggiare con noi.", "Una festa per dare il benvenuto al nostro bambino."], program: ["Arrivi", "Brindisi", "Giochi", "Torta"], dress: ["Casual", "Colori pastello"], signature: (a) => `Mamma e papà` },
    en: { titles: (a) => [`Welcome, ${a}`, `Waiting for ${a}`], hosts: ["With love, mum and dad", "With joy, the family"], messages: ["We are about to welcome our little one: come and celebrate with us.", "A party to welcome our baby into the world."], program: ["Arrivals", "Toast", "Games", "Cake"], dress: ["Casual", "Pastel colours"], signature: () => "Mum & Dad" },
  },
  corporate: {
    it: { titles: (_a, _b, n) => [`Cena di gala ${n}`, `Premiazioni ${n}`, `Kick-off team ${n}`], hosts: ["Con il patrocinio dell'azienda", "Ti aspettiamo"], messages: ["Vi invitiamo alla nostra serata di gala: una cena per celebrare l'anno.", "Una serata per condividere i risultati e festeggiare il team."], program: ["Accoglienza", "Intervento", "Cena", "Premiazioni"], dress: ["Black tie", "Business"], signature: () => "Ufficio eventi" },
    en: { titles: (_a, _b, n) => [`Gala dinner ${n}`, `Awards night ${n}`, `Team kick-off ${n}`], hosts: ["Under the patronage of the company", "We look forward to seeing you"], messages: ["You are invited to our gala evening: a dinner to celebrate the year.", "An evening to share our results and celebrate the team."], program: ["Welcome", "Keynote", "Dinner", "Awards"], dress: ["Black tie", "Business"], signature: () => "Events team" },
  },
  graduation: {
    it: { titles: (a) => [`Laurea di ${a}`, `Discussione di ${a}`], hosts: ["Con orgoglio, la famiglia", "Vi aspettiamo a festeggiare"], messages: ["Dopo anni di studio, il traguardo è arrivato: vieni a festeggiare con noi.", "Un brindisi per celebrare questo grande risultato."], program: ["Discussione", "Brindisi", "Pranzo"], dress: ["Elegante casual", "Colori a piacere"], signature: (a) => a },
    en: { titles: (a) => [`${a}'s graduation`, `Celebrating ${a}`], hosts: ["With pride, the family", "Come and celebrate with us"], messages: ["After years of study, the big day is here: come and celebrate with us.", "A toast to celebrate this great achievement."], program: ["Ceremony", "Toast", "Lunch"], dress: ["Smart casual", "Any colour"], signature: (a) => a },
  },
  anniversary: {
    it: { titles: (a, b, n) => [`${n} anni insieme`, `${a} & ${b}: ${n} anni`], hosts: ["Con gratitudine, i figli", "Festeggiamo con gli amici di sempre"], messages: ["Festeggiamo insieme un traguardo importante: vi aspettiamo.", "Un anniversario da celebrare con chi ci vuole bene."], program: ["Cerimonia", "Aperitivo", "Cena"], dress: ["Elegante", "Abito scuro"], signature: (a, b) => `${a} e ${b}` },
    en: { titles: (a, b, n) => [`${n} years together`, `${a} & ${b}: ${n} years`], hosts: ["With gratitude, our children", "Celebrating with our oldest friends"], messages: ["We are celebrating an important milestone: join us.", "An anniversary to share with the people who love us."], program: ["Ceremony", "Drinks", "Dinner"], dress: ["Formal", "Dark suit"], signature: (a, b) => `${a} & ${b}` },
  },
};

export function sampleSample(themeId: string, lang: Lang, rnd: Rnd): Sample {
  // Il tipo di festa segue le categorie del template: un template di laurea non mostra un matrimonio.
  const eventType: Kind = pick(themeCategories(themeId), rnd);
  const k = KIND[eventType][lang];
  // Una coppia è sempre un nome femminile con uno maschile, in ordine casuale.
  const fem = pick(NAMES[lang].f, rnd);
  const male = pick(NAMES[lang].m, rnd);
  const [a, b] = rnd() < 0.5 ? [fem, male] : [male, fem];
  const n = eventType === "birthday" ? pick([18, 30, 40, 50, 60], rnd) : eventType === "anniversary" ? pick([10, 15, 25, 30, 50], rnd) : eventType === "corporate" ? 2027 : 7;
  const [venue, address] = pick(VENUES[lang], rnd);
  const days = 30 + Math.floor(rnd() * 330);
  const date = new Date(Date.now() + days * 86_400_000);
  const time = `${String(11 + Math.floor(rnd() * 9)).padStart(2, "0")}:${rnd() < 0.5 ? "00" : "30"}`;
  return {
    eventType,
    title: pick(k.titles(a, b, n), rnd),
    hosts: pick(k.hosts, rnd),
    message: pick(k.messages, rnd),
    program: k.program,
    dress: pick(k.dress, rnd),
    venue,
    address,
    date,
    time,
    signature: k.signature(a, b),
  };
}

// Blocchi con testi d'esempio: il seme cambia i valori, la struttura del template resta quella.
export function sampleProps(type: BlockType, s: Sample, lang: Lang): Record<string, unknown> | null {
  const k = KIND[s.eventType][lang];
  switch (type) {
    case "message": return { heading: lang === "en" ? "Dear friends" : "Cari amici", body: s.message };
    case "program": return { heading: lang === "en" ? "Programme" : "Programma", items: k.program.map((label, i) => ({ time: `${String(Number(s.time.slice(0, 2)) + i).padStart(2, "0")}:${s.time.slice(3)}`, label })) };
    case "venue": return { heading: lang === "en" ? "Where" : "Dove" };
    case "dresscode": return { heading: lang === "en" ? "Dress code" : "Abbigliamento", dress: s.dress };
    case "footer": return { signature: s.signature };
    // Didascalia e testo del trasferimento: senza questi valori restano vuoti nella demo.
    case "image": return { caption: lang === "en" ? "A moment from our day." : "Un momento del nostro giorno." };
    case "faq": return {};
    case "gifts": return { url: "https://www.thebespokeinvite.com" };
    case "transfer": return { body: lang === "en" ? "Follow the signs for the venue. Parking is available on site." : "Seguite le indicazioni per il luogo. C'è parcheggio in loco." };
    default: return null;
  }
}

export function sampleEventFields(s: Sample): Record<string, string> {
  const iso = s.date.toISOString().slice(0, 10);
  return { title: s.title, hosts: s.hosts, eventDate: iso, eventTime: s.time, venue: s.venue, address: s.address };
}

export type { Sample };
export type { InviteConfig };
