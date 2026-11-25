import type { InviteConfig, BlockInstance, RsvpQuestion } from "@inviteme/shared";

// Vetrina privata (raggiungibile solo dal suo link): tre inviti completi, scritti come li scriverebbero davvero
// gli sposi o le famiglie. Partono dalla configurazione d'esempio del template (immagini, video e colori dello stile)
// e ne sostituiscono testi, date e luoghi. Nessun dato è salvato: la pagina si genera a ogni richiesta.

export const SHOWCASE_KEYS = ["melograno", "smeraldo", "pizzo"] as const;
export type ShowcaseKey = (typeof SHOWCASE_KEYS)[number];
export const isShowcaseKey = (k: string): k is ShowcaseKey => (SHOWCASE_KEYS as readonly string[]).includes(k);

// Slug fittizio della pagina: l'underscore non è ammesso negli slug veri, quindi non può coincidere con un invito.
// L'RSVP con questo slug risponde «ricevuto» senza salvare nulla.
export const SHOWCASE_SLUG_PREFIX = "_vetrina-";

type Lang = "it" | "en";
type Patch = Record<string, unknown>;
type Content = {
  themeId: string;
  eventType: InviteConfig["eventType"];
  event: Record<string, string>;
  blocks: Partial<Record<BlockInstance["type"], Patch>>;
  extra?: { after: BlockInstance["type"]; type: BlockInstance["type"]; props: Patch }[];
  hide?: BlockInstance["type"][];
  rsvp: RsvpQuestion[];
};

const Q = {
  name: (it: boolean): RsvpQuestion => ({ id: "name", label: it ? "Nome e cognome" : "Full name", type: "text", required: true }),
  attending: (it: boolean, yes: string, no: string): RsvpQuestion => ({ id: "attending", label: it ? "Ci sarai?" : "Will you join us?", type: "yes-no", required: true, yes, no }),
  guests: (it: boolean): RsvpQuestion => ({ id: "guests", label: it ? "Quante persone, te compreso?" : "How many people, including you?", type: "number" }),
};

function melograno(lang: Lang): Content {
  const it = lang === "it";
  return {
    themeId: "melograno-di-sicilia",
    eventType: "wedding",
    event: {
      title: "Giulia & Matteo",
      hosts: it ? "Con le famiglie Scivoletto e Lo Monaco" : "Together with the Scivoletto and Lo Monaco families",
      eventDate: "2027-09-18",
      eventTime: "17:30",
      venue: "Tenuta Busulmone",
      address: "Contrada Busulmone, 96017 Noto SR",
    },
    blocks: {
      cover: { topText: it ? "Per voi, da Noto" : "For you, from Noto", sealText: "G·M" },
      hero: { kicker: it ? "Dopo nove anni e un trasloco a Milano" : "After nine years and one move to Milan", occasion: it ? "torniamo a casa per sposarci" : "we're coming home to get married", scrollLabel: it ? "Scorri" : "Scroll" },
      scratchdate: { dateTitle: it ? "Segnatevi la data" : "Save the date", revealLabel: it ? "Gratta e scopri" : "Scratch to reveal" },
      message: {
        heading: it ? "Due righe da parte nostra" : "A few words from us",
        body: it
          ? "Ci siamo conosciuti al liceo, in fila per la granita da Costanzo, e da allora non abbiamo più smesso di litigare su quale sia la migliore: mandorla (Giulia) o gelso (Matteo).\nAbbiamo vissuto a Milano, poi a Torino, poi di nuovo a Milano. Ma per dirci sì volevamo tornare qui, tra la pietra dorata di Noto e gli alberi di melograno di nonna Pina.\nSarà una festa lunga, all'aperto, con il mare a dieci minuti. Ci farebbe felici avervi con noi, dal primo brindisi all'ultima granita del mattino dopo."
          : "We met at secondary school in Noto, queuing for granita at Caffè Costanzo, and we've been arguing ever since about which flavour is best: almond (Giulia) or mulberry (Matteo).\nWe've lived in Milan, then Turin, then Milan again. But to say yes we wanted to come back here, among Noto's golden stone and Nonna Pina's pomegranate trees.\nIt'll be a long party, outdoors, with the sea ten minutes away. We'd love to have you with us, from the first toast to the last granita the morning after.",
      },
      program: {
        heading: it ? "Il programma" : "The day",
        items: it
          ? [
              { time: "17:30", label: "Rito civile nel giardino dei melograni" },
              { time: "18:15", label: "Aperitivo sulla terrazza, con arancine e Grillo freddo" },
              { time: "19:30", label: "Foto al tramonto tra gli ulivi (per chi vuole)" },
              { time: "20:30", label: "Cena nel cortile della tenuta" },
              { time: "22:45", label: "Primo ballo e taglio della torta" },
              { time: "23:00", label: "Banda, DJ e cannoli fino a tardi" },
              { time: "02:00", label: "Ultima navetta per Noto" },
            ]
          : [
              { time: "17:30", label: "Civil ceremony in the pomegranate garden" },
              { time: "18:15", label: "Drinks on the terrace, with arancine and chilled Grillo" },
              { time: "19:30", label: "Sunset photos among the olive trees (if you fancy it)" },
              { time: "20:30", label: "Dinner in the estate courtyard" },
              { time: "22:45", label: "First dance and cutting the cake" },
              { time: "23:00", label: "Band, DJ and cannoli until late" },
              { time: "02:00", label: "Last shuttle back to Noto" },
            ],
      },
      venue: { heading: it ? "Dove ci sposiamo" : "Where we're getting married", venue: "Tenuta Busulmone", kind: "villa" },
      transfer: {
        heading: it ? "Arrivare e dormire" : "Getting here and staying over",
        body: it
          ? "L'aeroporto più comodo è Catania Fontanarossa: un'ora di auto. Vi consigliamo di noleggiare un'auto, ma se non volete guidare scriveteci e vi mettiamo in contatto con altri invitati.\nAlle 16:45 e alle 17:00 parte una navetta da Piazza Municipio, davanti alla Cattedrale. Riparte dalla tenuta a mezzanotte, all'una e alle due.\nAbbiamo bloccato camere al B&B Le Zagare e all'Albergo Corso Vittorio fino al 30 giugno: dite che venite al matrimonio Scivoletto–Lo Monaco."
          : "The easiest airport is Catania Fontanarossa, an hour's drive away. We recommend hiring a car, but if you'd rather not drive, write to us and we'll put you in touch with other guests.\nShuttles leave Piazza Municipio, in front of the Cathedral, at 16:45 and 17:00. They head back from the estate at midnight, 1am and 2am.\nWe've reserved rooms at B&B Le Zagare and Albergo Corso Vittorio until 30 June: just mention the Scivoletto–Lo Monaco wedding.",
      },
      gifts: {
        heading: it ? "Un pensiero" : "Gifts",
        body: it
          ? "La casa a Milano è piccola e già piena. Se volete farci un regalo, ci aiutereste a realizzare il viaggio che rimandiamo da anni: tre settimane in Giappone, a novembre."
          : "Our flat in Milan is small and already full. If you'd like to give us something, you'd help us take the trip we've been putting off for years: three weeks in Japan, this November.",
        buttonLabel: it ? "Il nostro viaggio" : "Our honeymoon fund",
      },
      faq: {
        heading: it ? "Domande frequenti" : "Questions you might have",
        intro: "",
        items: it
          ? [
              { q: "I bambini sono invitati?", a: "Certo. Ci sarà un'area giochi con due animatrici dalle 20 a mezzanotte, e un menu pensato per loro." },
              { q: "Che tempo farà?", a: "A metà settembre a Noto di giorno ci sono ancora 28 gradi; la sera scende un po' di brezza dal mare. Portate uno scialle." },
              { q: "Tacchi sì o no?", a: "Il giardino ha i vialetti in ghiaia e il cortile è in pietra: meglio tacchi larghi o zeppe. All'ingresso troverete un cesto di espadrillas." },
              { q: "Ho intolleranze o allergie", a: "Scrivetelo nel modulo di risposta: il catering prepara piatti senza glutine, vegetariani e vegani." },
              { q: "Ci vediamo anche il giorno dopo?", a: "Sì: domenica dalle 11 brunch e bagno al Lido di Noto, per chi ha ancora energie." },
            ]
          : [
              { q: "Are children invited?", a: "Of course. There'll be a play area with two childminders from 8pm to midnight, and a menu just for them." },
              { q: "What will the weather be like?", a: "In mid-September Noto is still around 28°C during the day; in the evening a light sea breeze comes in. Bring a shawl." },
              { q: "Heels or no heels?", a: "The garden paths are gravel and the courtyard is stone: block heels or wedges work best. You'll find a basket of espadrilles at the entrance." },
              { q: "I have allergies or dietary needs", a: "Let us know in the reply form: the caterer prepares gluten-free, vegetarian and vegan dishes." },
              { q: "Is there anything the day after?", a: "Yes: on Sunday from 11am, brunch and a swim at Lido di Noto, for anyone with energy left." },
            ],
      },
      dresscode: {
        heading: "Dress code",
        dress: it ? "Elegante estivo. Se vi va, un dettaglio rosso melograno" : "Summer formal. If you like, a touch of pomegranate red",
        colors: [
          { hex: "#9B1B30", name: it ? "Melograno" : "Pomegranate" },
          { hex: "#C9A15B", name: it ? "Pietra di Noto" : "Noto stone" },
          { hex: "#6F7D5C", name: it ? "Ulivo" : "Olive" },
          { hex: "#F3E7DA", name: it ? "Mandorla" : "Almond" },
        ],
      },
      rsvp: {
        heading: it ? "Rispondete entro il 15 luglio" : "Please reply by 15 July",
        intro: it ? "Ci serve per i posti a tavola e per le navette. Se cambiate idea, scriveteci pure." : "We need it for seating and shuttles. If your plans change, just let us know.",
        openLabel: it ? "Rispondi all'invito" : "Reply to the invitation",
        submitLabel: it ? "Invia" : "Send",
        thanksLabel: it ? "Grazie! Ci vediamo a Noto" : "Thank you! See you in Noto",
      },
      footer: { signature: it ? "Giulia e Matteo · per qualsiasi cosa, Giulia: 347 000 2814" : "Giulia & Matteo · for anything at all, Giulia: +39 347 000 2814" },
    },
    hide: ["gallery", "image", "video", "music"],
    rsvp: [
      Q.name(it),
      Q.attending(it, it ? "Sì, ci sarò" : "Yes, I'll be there", it ? "Purtroppo no" : "Sadly not"),
      Q.guests(it),
      { id: "shuttle", label: it ? "Prendi la navetta da Noto?" : "Will you take the shuttle from Noto?", type: "yes-no", yes: it ? "Sì" : "Yes", no: it ? "No, vengo in auto" : "No, I'll drive" },
      { id: "brunch", label: it ? "Vieni al brunch della domenica?" : "Are you coming to Sunday brunch?", type: "yes-no", yes: it ? "Certo" : "Definitely", no: it ? "No" : "No" },
      { id: "diet", label: it ? "Allergie o esigenze alimentari" : "Allergies or dietary needs", type: "text" },
    ],
  };
}

function smeraldo(lang: Lang): Content {
  const it = lang === "it";
  return {
    themeId: "stemma-smeraldo",
    eventType: "wedding",
    event: {
      title: "Alice & Davide",
      hosts: it ? "Francesca, Luca e Marta vi invitano a festeggiare" : "Francesca, Luca and Marta invite you to celebrate",
      eventDate: "2027-06-12",
      eventTime: "11:00",
      venue: "Villa Le Lune di Bellosguardo",
      address: "Via di Bellosguardo 12, 50124 Firenze FI",
    },
    blocks: {
      cover: { topText: it ? "1977 · 2027" : "1977 · 2027", sealText: "A·D" },
      hero: { kicker: it ? "Cinquant'anni fa, nella stessa chiesa" : "Fifty years ago, in the same church", occasion: it ? "festeggiano le nozze d'oro" : "celebrate their golden anniversary", scrollLabel: it ? "Scorri l'invito" : "Scroll down" },
      scratchdate: { dateTitle: it ? "Il giorno" : "The day", revealLabel: it ? "Scopri la data" : "Reveal the date" },
      message: {
        heading: it ? "Cinquant'anni, più o meno" : "Fifty years, give or take",
        body: it
          ? "Il 12 giugno 1977 la mamma e il babbo si sono sposati a San Miniato al Monte, con un pranzo per sessanta persone in una trattoria del Galluzzo che oggi non c'è più.\nDa allora: una casa in via dei Serragli, tre figli, sei nipoti, un cane di nome Brunello e almeno quattrocento domeniche al mare a Castiglioncello.\nVorremmo festeggiarli come si deve, con le persone che hanno fatto parte di questa storia. Loro non sanno ancora tutto: vi chiediamo di non rovinare la sorpresa del pomeriggio."
          : "On 12 June 1977 Mum and Dad got married at San Miniato al Monte, followed by lunch for sixty at a trattoria in Galluzzo that no longer exists.\nSince then: a home on Via dei Serragli, three children, six grandchildren, a dog called Brunello and at least four hundred Sundays at the beach in Castiglioncello.\nWe'd like to celebrate them properly, with the people who have been part of their story. They don't know everything yet: please don't spoil the afternoon surprise.",
      },
      gallery: { heading: it ? "Un po' di album di famiglia" : "From the family album" },
      image: { caption: it ? "Il salone della villa, dove si pranza." : "The villa's main hall, where lunch will be served." },
      program: {
        heading: it ? "Programma" : "Schedule",
        items: it
          ? [
              { time: "11:00", label: "Messa a San Miniato al Monte, celebrata da don Bernardo" },
              { time: "12:15", label: "Trasferimento a Bellosguardo (dieci minuti)" },
              { time: "12:45", label: "Aperitivo in giardino, con la vista su Firenze" },
              { time: "13:30", label: "Pranzo nel salone" },
              { time: "16:00", label: "La sorpresa per gli sposi (acqua in bocca)" },
              { time: "16:30", label: "Torta, brindisi e il discorso dei nipoti" },
              { time: "18:00", label: "Saluti" },
            ]
          : [
              { time: "11:00", label: "Mass at San Miniato al Monte, celebrated by Don Bernardo" },
              { time: "12:15", label: "Short drive to Bellosguardo (ten minutes)" },
              { time: "12:45", label: "Drinks in the garden, overlooking Florence" },
              { time: "13:30", label: "Lunch in the main hall" },
              { time: "16:00", label: "The surprise for the couple (not a word!)" },
              { time: "16:30", label: "Cake, toasts and the grandchildren's speech" },
              { time: "18:00", label: "Farewell" },
            ],
      },
      venue: { heading: it ? "Il pranzo" : "Lunch", venue: "Villa Le Lune di Bellosguardo", kind: "villa" },
      transfer: {
        heading: it ? "Come arrivare" : "Getting there",
        body: it
          ? "A San Miniato si parcheggia nel piazzale Galileo, cinque minuti a piedi in salita (per chi ha difficoltà, c'è un permesso per salire fino alla basilica: chiedete a Luca).\nPer la villa il parcheggio è all'interno, dal cancello di via di Bellosguardo. Da Firenze centro sono 15 minuti in taxi.\nChi arriva da fuori: l'Hotel Porta al Prato, vicino alla stazione, ci ha riservato dieci camere fino al 10 maggio."
          : "At San Miniato, park in Piazzale Galileo and walk five minutes uphill (if walking is difficult, there's a permit to drive up to the basilica: ask Luca).\nAt the villa, parking is inside, through the gate on Via di Bellosguardo. It's 15 minutes by taxi from central Florence.\nComing from out of town? Hotel Porta al Prato, near the station, is holding ten rooms for us until 10 May.",
      },
      gifts: {
        heading: it ? "Regali" : "Gifts",
        body: it
          ? "La mamma ha detto chiaramente: «niente regali, abbiamo tutto». Se proprio volete, raccogliamo un contributo per il viaggio che sognano da sempre: i fiordi norvegesi, in nave, a giugno."
          : "Mum has been very clear: \"no presents, we have everything\". If you really want to, we're collecting towards the trip they've always dreamed of: the Norwegian fjords by boat, this June.",
        buttonLabel: it ? "Contribuisci al viaggio" : "Contribute to the trip",
      },
      faq: {
        heading: it ? "Prima di venire" : "Before you come",
        intro: "",
        items: it
          ? [
              { q: "È una sorpresa?", a: "In parte. Sanno della messa e del pranzo, non sanno chi ci sarà e cosa succede alle 16. Non parlatene con loro, per favore." },
              { q: "Posso portare i bambini?", a: "Sì, i bambini sono i benvenuti. C'è un prato dove possono correre." },
              { q: "C'è un menu per chi non mangia carne?", a: "Sì, indicatelo nella risposta: ci sono un menu vegetariano e uno senza glutine." },
              { q: "A chi posso chiedere?", a: "A Francesca (333 000 7712) o a Luca (338 000 4490), non alla mamma." },
            ]
          : [
              { q: "Is it a surprise?", a: "Partly. They know about the Mass and lunch, but not who's coming or what happens at 4pm. Please don't mention it to them." },
              { q: "Can I bring children?", a: "Yes, children are very welcome. There's a lawn where they can run around." },
              { q: "Is there a menu for non-meat eaters?", a: "Yes, tell us in your reply: there's a vegetarian menu and a gluten-free one." },
              { q: "Who can I ask?", a: "Francesca (+39 333 000 7712) or Luca (+39 338 000 4490). Not Mum." },
            ],
      },
      dresscode: {
        heading: "Dress code",
        dress: it ? "Da cerimonia di giorno. Un tocco di verde è un omaggio all'abito della mamma nel '77" : "Daytime formal. A touch of green is a nod to Mum's 1977 dress",
        colors: [
          { hex: "#0F3D2C", name: it ? "Smeraldo" : "Emerald" },
          { hex: "#6B8F71", name: it ? "Salvia" : "Sage" },
          { hex: "#C9A35A", name: it ? "Oro" : "Gold" },
          { hex: "#F4ECDC", name: it ? "Avorio" : "Ivory" },
        ],
      },
      video: { heading: it ? "Dal filmino del 1977" : "From the 1977 home movie" },
      rsvp: {
        heading: it ? "Fateci sapere entro il 10 maggio" : "Please let us know by 10 May",
        intro: it ? "Ci serve per prenotare i posti in chiesa e al pranzo." : "We need it to reserve seats in church and at lunch.",
        openLabel: it ? "Rispondi" : "Reply",
        submitLabel: it ? "Invia la risposta" : "Send reply",
        thanksLabel: it ? "Grazie, a presto!" : "Thank you, see you soon!",
      },
      footer: { signature: it ? "Francesca, Luca e Marta" : "Francesca, Luca & Marta" },
    },
    hide: ["music"],
    rsvp: [
      Q.name(it),
      Q.attending(it, it ? "Ci sarò" : "I'll be there", it ? "Non posso" : "I can't make it"),
      Q.guests(it),
      { id: "mass", label: it ? "Vieni anche alla messa?" : "Are you coming to the Mass too?", type: "yes-no", yes: it ? "Sì" : "Yes", no: it ? "Solo al pranzo" : "Just lunch" },
      { id: "note", label: it ? "Un ricordo o un messaggio per Alice e Davide (lo leggeremo alla festa)" : "A memory or message for Alice and Davide (we'll read it at the party)", type: "text" },
    ],
  };
}

function pizzo(lang: Lang): Content {
  const it = lang === "it";
  return {
    themeId: "velo-di-pizzo",
    eventType: "wedding",
    event: {
      title: it ? "Elisa & James" : "Elisa & James",
      hosts: it ? "Insieme alle loro famiglie" : "Together with their families",
      eventDate: "2027-06-05",
      eventTime: "16:00",
      venue: "Villa delle Rose Bianche",
      address: "Via Regina 21, 22012 Cernobbio CO",
    },
    blocks: {
      cover: { topText: it ? "Lago di Como" : "Lake Como", sealText: "E·J" },
      hero: { kicker: it ? "Save the date" : "Save the date", occasion: it ? "ci sposiamo sul lago" : "we're getting married by the lake", scrollLabel: it ? "Scopri il nostro giorno" : "See our day" },
      scratchdate: { dateTitle: it ? "La data" : "The date", revealLabel: it ? "Scopri la data" : "Reveal the date" },
      message: {
        heading: it ? "Da Londra a Como" : "From London to Como",
        body: it
          ? "Ci siamo conosciuti a Londra nel 2019, a una cena di amici in cui nessuno dei due voleva andare. James ha passato la serata a chiedere a Elisa come si fa davvero la carbonara. Lei gliel'ha spiegato, lui ha messo la panna lo stesso.\nCinque anni dopo, sul pontile di Brienno, le ha chiesto di sposarlo. In italiano, con un accento terribile.\nSiamo felicissimi di festeggiare in Italia, tra le famiglie di due paesi: ci saranno brindisi in due lingue e, promettiamo, nessuna carbonara."
          : "We met in London in 2019, at a dinner party neither of us wanted to go to. James spent the evening asking Elisa how you really make carbonara. She explained; he added cream anyway.\nFive years later, on the jetty in Brienno, he asked her to marry him. In Italian, with a terrible accent.\nWe're thrilled to celebrate in Italy, with families from two countries: there'll be toasts in two languages and, we promise, no carbonara.",
      },
      gallery: { heading: it ? "La villa, in anteprima" : "A first look at the villa" },
      image: { caption: it ? "La tavola lungo il lago, dove ceneremo." : "The long table by the water, where we'll have dinner." },
      program: {
        heading: it ? "Il nostro giorno" : "Our day",
        items: it
          ? [
              { time: "15:15", label: "Partenza del battello da Piazza Cavour, Como" },
              { time: "16:00", label: "Cerimonia civile nel giardino all'italiana" },
              { time: "17:00", label: "Aperitivo sulla darsena, con lo Spritz di Elisa e il gin tonic di James" },
              { time: "19:30", label: "Cena alla lunga tavola sul lago" },
              { time: "21:30", label: "Discorsi dei testimoni (in due lingue)" },
              { time: "22:00", label: "Taglio della torta e primo ballo" },
              { time: "22:15", label: "Si balla nella limonaia" },
              { time: "00:30", label: "Battello di rientro a Como" },
            ]
          : [
              { time: "15:15", label: "Boat leaves Piazza Cavour, Como" },
              { time: "16:00", label: "Civil ceremony in the Italian garden" },
              { time: "17:00", label: "Drinks on the boathouse terrace, with Elisa's Spritz and James's G&T" },
              { time: "19:30", label: "Dinner at the long table by the lake" },
              { time: "21:30", label: "Best man and maid of honour speeches (in two languages)" },
              { time: "22:00", label: "Cutting the cake and first dance" },
              { time: "22:15", label: "Dancing in the lemon house" },
              { time: "00:30", label: "Boat back to Como" },
            ],
      },
      venue: { heading: it ? "La villa" : "The villa", venue: "Villa delle Rose Bianche", kind: "villa" },
      transfer: {
        heading: it ? "Arrivare a Como" : "Getting to Como",
        body: it
          ? "Gli aeroporti più vicini sono Milano Malpensa (50 minuti) e Linate (un'ora). Da Milano Cadorna c'è un treno ogni mezz'ora per Como Lago.\nAlla villa si arriva in battello: partenza alle 15:15 dal pontile di Piazza Cavour, rientro alle 00:30. Chi viene in auto trova il parcheggio a Cernobbio, ma il battello è molto più bello.\nPer chi arriva dall'Inghilterra abbiamo raccolto hotel e consigli in un documento: chiedetelo a James."
          : "The nearest airports are Milan Malpensa (50 minutes) and Linate (one hour). From Milano Cadorna there's a train every half hour to Como Lago.\nWe'll all reach the villa by boat: it leaves the Piazza Cavour jetty at 15:15 and comes back at 00:30. If you drive, there's parking in Cernobbio, but the boat is much nicer.\nFor those travelling from the UK we've put together hotels and tips in a document: ask James for it.",
      },
      gifts: {
        heading: it ? "Lista nozze" : "Wedding list",
        body: it
          ? "Viviamo tra Londra e Milano con due valigie e poche pentole. Abbiamo una piccola lista per la casa nuova e un fondo per il viaggio di nozze in Patagonia."
          : "We live between London and Milan with two suitcases and very few pans. We have a small list for our new home and a fund for our honeymoon in Patagonia.",
        buttonLabel: it ? "Vedi la lista" : "View the list",
      },
      faq: {
        heading: "FAQ",
        intro: "",
        items: it
          ? [
              { q: "In che lingua sarà la cerimonia?", a: "In italiano e in inglese: l'ufficiale del Comune di Cernobbio sarà affiancata da un'interprete." },
              { q: "Posso portare un accompagnatore?", a: "Se è indicato nel tuo invito, sì. Abbiamo posti contati sul battello: scrivici se hai dubbi." },
              { q: "E se piove?", a: "Cerimonia e cena si spostano nel salone della villa, che guarda sul lago. Il battello parte comunque." },
              { q: "I bambini?", a: "Amiamo i vostri bambini, ma abbiamo scelto una festa per soli adulti. Ci sono baby-sitter consigliate a Como." },
            ]
          : [
              { q: "What language will the ceremony be in?", a: "Italian and English: the Cernobbio registrar will be joined by an interpreter." },
              { q: "Can I bring a plus-one?", a: "If your invitation says so, yes. Space on the boat is limited, so drop us a line if you're unsure." },
              { q: "What if it rains?", a: "The ceremony and dinner move into the villa's hall, which looks out over the lake. The boat runs either way." },
              { q: "Children?", a: "We love your children, but we've chosen an adults-only celebration. We can recommend babysitters in Como." },
            ],
      },
      dresscode: {
        heading: "Dress code",
        dress: it ? "Formale da giardino. Niente bianco, per favore: quello tocca a Elisa" : "Garden formal. No white, please: that one's for Elisa",
        colors: [
          { hex: "#A79C98", name: it ? "Tortora" : "Taupe" },
          { hex: "#8FA3B0", name: it ? "Lago" : "Lake blue" },
          { hex: "#D8C3B8", name: it ? "Cipria" : "Blush" },
          { hex: "#4F4648", name: it ? "Antracite" : "Charcoal" },
        ],
      },
      video: { heading: it ? "Una sera di giugno sul lago" : "A June evening on the lake" },
      rsvp: {
        heading: it ? "Ci sarai?" : "Will you be there?",
        intro: it ? "Rispondi entro il 1° aprile: ci serve per il battello e per i posti a tavola." : "Please reply by 1 April: we need numbers for the boat and the seating plan.",
        openLabel: it ? "Conferma la presenza" : "RSVP",
        submitLabel: it ? "Invia la conferma" : "Send my reply",
        thanksLabel: it ? "Grazie! Ci vediamo sul lago" : "Thank you! See you by the lake",
      },
      footer: { signature: it ? "Con tutto il nostro amore, Elisa e James" : "With all our love, Elisa & James" },
    },
    hide: ["music"],
    rsvp: [
      Q.name(it),
      Q.attending(it, it ? "Sì, con piacere" : "Joyfully accepts", it ? "Purtroppo non posso" : "Regretfully declines"),
      Q.guests(it),
      { id: "boat", label: it ? "Prendi il battello delle 15:15?" : "Will you take the 15:15 boat?", type: "yes-no", yes: it ? "Sì" : "Yes", no: it ? "No, arrivo in auto" : "No, I'll drive" },
      { id: "diet", label: it ? "Allergie o esigenze alimentari" : "Allergies or dietary requirements", type: "text" },
      { id: "song", label: it ? "Una canzone che non può mancare" : "A song that has to be played", type: "text" },
    ],
  };
}

const CONTENT: Record<ShowcaseKey, (lang: Lang) => Content> = { melograno, smeraldo, pizzo };

export function showcaseThemeId(key: ShowcaseKey): string {
  return CONTENT[key]("it").themeId;
}

// Configurazione completa: quella d'esempio del template (base) con i contenuti della vetrina sopra.
export function showcaseConfig(key: ShowcaseKey, lang: Lang, base: InviteConfig): InviteConfig {
  const c = CONTENT[key](lang);
  const hide = new Set(c.hide ?? []);
  const blocks: BlockInstance[] = [];
  for (const b of base.blocks) {
    const patch = c.blocks[b.type] ?? {};
    blocks.push({ ...b, hidden: hide.has(b.type) ? true : b.hidden, props: { ...b.props, ...patch } });
    for (const x of (c.extra ?? []).filter((e) => e.after === b.type)) blocks.push({ id: `${b.id}-${x.type}-2`, type: x.type, hidden: false, props: { ...b.props, ...x.props } });
  }
  return { ...base, locale: lang, eventType: c.eventType, event: { ...base.event, ...c.event }, blocks, rsvpQuestions: c.rsvp };
}
