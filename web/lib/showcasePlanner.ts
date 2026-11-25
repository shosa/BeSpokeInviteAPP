import type { PremiumData } from "@/components/planner/PremiumPlanner";

// Planner della vetrina: il matrimonio di Giulia e Matteo (Noto, 18 settembre 2027), lo stesso dell'invito
// «Melograno di Sicilia». Si tocca tutto; le modifiche restano in memoria e spariscono uscendo dalla pagina.

const DATE = "2027-09-18";
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type G = [name: string, size: number, response: "yes" | "pending" | "no", table?: string];

export function showcasePlanner(en: boolean): PremiumData {
  const L = (it: string, eng: string) => (en ? eng : it);
  const groups = {
    sc: L("Famiglia Scivoletto (Giulia)", "Scivoletto family (Giulia)"),
    lm: L("Famiglia Lo Monaco (Matteo)", "Lo Monaco family (Matteo)"),
    noto: L("Amici di Noto", "Friends from Noto"),
    mi: L("Amici di Milano", "Friends in Milan"),
    work: L("Colleghi", "Colleagues"),
  };
  const byGroup: Record<keyof typeof groups, G[]> = {
    sc: [
      ["Pina e Corrado Scivoletto", 2, "yes", "t0"], ["Giusi Scivoletto e Andrea Ferla", 2, "yes", "t1"], ["Famiglia Scivoletto (Modica)", 4, "yes", "t1"],
      ["Zia Concetta Scivoletto", 1, "yes", "t1"], ["Nonna Pina", 1, "yes", "t0"], ["Famiglia Iacono", 4, "yes", "t2"], ["Famiglia Calvo", 3, "yes", "t2"],
      ["Carmelo e Rosaria Gennaro", 2, "yes", "t2"], ["Famiglia Scivoletto (Bologna)", 4, "pending"], ["Sebastiano Scivoletto", 1, "yes"],
      ["Famiglia Cannata", 3, "no"], ["Lucia e Franco Aprile", 2, "yes"], ["Famiglia Di Rosa", 4, "pending"], ["Famiglia Occhipinti", 4, "yes"], ["Padrino Giovanni e Nella", 2, "yes"], ["Famiglia Scivoletto (Ragusa)", 3, "pending"], ["Cugina Federica e Alberto", 2, "yes"],
    ],
    lm: [
      ["Enza e Turi Lo Monaco", 2, "yes", "t0"], ["Davide Lo Monaco e Sara Riva", 2, "yes", "t3"], ["Nonno Salvatore", 1, "yes", "t0"],
      ["Famiglia Lo Monaco (Avola)", 5, "yes", "t3"], ["Famiglia Corsaro", 4, "yes", "t3"], ["Zio Nino e zia Melina", 2, "yes"],
      ["Famiglia Spadaro", 3, "pending"], ["Famiglia Lo Monaco (Germania)", 4, "pending"], ["Grazia Lo Monaco", 1, "no"],
      ["Famiglia Russo", 3, "yes"], ["Pippo e Marisa Tiralongo", 2, "yes"], ["Famiglia Assenza", 4, "yes"], ["Zia Rita", 1, "pending"], ["Famiglia Lo Monaco (Siracusa)", 4, "yes"], ["Corrado e Ivana Fronte", 2, "no"],
    ],
    noto: [
      ["Martina Belfiore e Ivan Rizza", 2, "yes", "t4"], ["Giorgia Fichera", 1, "yes", "t4"], ["Alessio e Federica Bonomo", 2, "yes", "t4"],
      ["Totò Midolo", 1, "yes", "t4"], ["Valeria Nicita e Marco Sortino", 2, "yes"], ["Ciccio Pantano", 1, "pending"], ["Elisa Caruso", 1, "yes"],
      ["Gabriele e Noemi Agosta", 2, "yes"], ["Rosario Calabrese", 1, "no"], ["Ilenia Baglieri e Paolo Giunta", 2, "pending"], ["Dario Inturrisi e Chiara Sipala", 2, "yes"], ["Manuela Cassarino", 1, "yes"], ["Peppe e Lorena Garofalo", 2, "pending"],
    ],
    mi: [
      ["Beatrice Colombo e Tommaso Galli", 2, "yes", "t5"], ["Francesca Brambilla", 1, "yes", "t5"], ["Luca e Anna Riva", 2, "yes", "t5"],
      ["Matteo Sala", 1, "pending"], ["Irene Fumagalli e Diego Monti", 2, "yes"], ["Camilla Ferri", 1, "yes"], ["Simone Villa e Laura Pozzi", 2, "no"],
      ["Giada Mariani", 1, "pending"], ["Andrea e Silvia Longoni", 2, "yes"], ["Chiara Bassi e Marco Viganò", 2, "yes"], ["Edoardo Rossetti", 1, "yes"], ["Nadia e Paolo Cereda", 2, "pending"],
    ],
    work: [
      ["Roberta Cattaneo", 1, "yes"], ["Fabio De Santis e Marta Ricci", 2, "yes"], ["Pietro Mazza", 1, "pending"], ["Sofia Bianchi", 1, "yes"],
      ["Nicola Ferretti", 1, "no"], ["Arianna Gatti e Leo Conti", 2, "pending"], ["Stefano Rinaldi", 1, "yes"], ["Elena Moretti e Davide Sala", 2, "yes"], ["Giacomo Neri", 1, "pending"],
    ],
  };
  const guests: PremiumData["guests"] = [];
  let n = 0;
  for (const [g, list] of Object.entries(byGroup) as [keyof typeof groups, G[]][]) {
    for (const [name, size, response, table] of list) guests.push({ id: `g${n++}`, name, group_name: groups[g], party_size: size, response, table_id: table ?? null });
  }
  const tables: PremiumData["tables"] = [
    { id: "t0", name: L("Tavolo degli sposi", "Top table"), seats: 8 },
    { id: "t1", name: "Ortigia", seats: 10 },
    { id: "t2", name: "Vendicari", seats: 10 },
    { id: "t3", name: "Marzamemi", seats: 12 },
    { id: "t4", name: L("Cava d'Ispica", "Cava d'Ispica"), seats: 10 },
    { id: "t5", name: "Calamosche", seats: 8 },
    { id: "t6", name: L("Scala dei Turchi", "Scala dei Turchi"), seats: 10 },
    { id: "t7", name: "Pantalica", seats: 10 },
    { id: "t8", name: "Etna", seats: 10 },
    { id: "t9", name: L("Tavolo dei bambini", "Kids' table"), seats: 12 },
  ];
  const quote = (id: string, category: string, name: string, euros: number, o: Partial<PremiumData["quotes"][number]> = {}) => ({
    id, category, name, amount_cents: euros * 100, rating: 4, notes: "", booked: false, signed: false, arrival: "", contact: "", tip_cents: 0, envelope: false, ...o,
  });
  const quotes: PremiumData["quotes"] = [
    quote("q1", "location", "Tenuta Busulmone", 16800, { rating: 5, booked: true, signed: true, arrival: "10:00", contact: "Valentina · +39 0931 000 412", notes: L("140 € a persona per 120 adulti, bambini a 45 €. Include sedie, tovagliato e personale. Esclusiva fino alle 3.", "€140 per adult for 120, children €45. Includes chairs, linen and staff. Exclusive use until 3am.") }),
    quote("q2", "location", "Masseria Agnello", 19500, { rating: 3, notes: L("Bellissima, ma niente musica dopo l'una.", "Beautiful, but no music after 1am.") }),
    quote("q3", "foto", "Studio Ippolito · foto e video", 3900, { rating: 5, booked: true, signed: true, arrival: "13:00", contact: "Marco Ippolito · +39 349 000 1185", tip_cents: 10000, envelope: true, notes: L("Reportage dalle 13 alle 24, album 30x30 e video di 5 minuti.", "Coverage from 1pm to midnight, 30x30 album and 5-minute film.") }),
    quote("q4", "foto", "Lumen Wedding", 4600, { rating: 4, notes: L("Drone incluso, consegna in 6 mesi.", "Drone included, delivery in 6 months.") }),
    quote("q5", "fiori", "Fiori di Zagara · Avola", 2700, { rating: 5, booked: true, signed: true, arrival: "11:00", contact: "Lucia · +39 338 000 6620", notes: L("Melograni, ulivo e bouganville; bouquet e 10 centrotavola.", "Pomegranates, olive and bougainvillea; bouquet and 10 centrepieces.") }),
    quote("q6", "musica", "Banda Iblea (aperitivo)", 900, { rating: 5, booked: true, signed: false, arrival: "17:30", contact: "Gianni · +39 333 000 2210" }),
    quote("q7", "musica", "DJ Ernesto Lupo", 1300, { rating: 4, booked: true, signed: true, arrival: "21:00", contact: "+39 340 000 7754", tip_cents: 5000, envelope: true }),
    quote("q8", "abiti", L("Abito: Atelier Carmen, Siracusa", "Dress: Atelier Carmen, Siracusa"), 2600, { rating: 5, booked: true, signed: true }),
    quote("q9", "abiti", L("Completo: Sartoria Puglisi", "Suit: Sartoria Puglisi"), 1100, { rating: 4, booked: true, signed: true }),
    quote("q10", "abiti", L("Trucco e parrucco: Rosy Make-up", "Hair and make-up: Rosy Make-up"), 450, { rating: 4, booked: true, signed: false, arrival: "09:00" }),
    quote("q11", "fedi", L("Fedi: Gioielleria Valvo", "Rings: Gioielleria Valvo"), 1350, { rating: 5, booked: true, signed: true }),
    quote("q12", "inviti", "Bespoke Invite", 65, { rating: 5, booked: true, signed: true }),
    quote("q13", "bomboniere", L("Bomboniere: vasetti di miele ibleo", "Favours: Hyblaean honey jars"), 780, { rating: 4, booked: true, signed: false, notes: L("130 vasetti da 100 g con etichetta.", "130 × 100 g jars with labels.") }),
    quote("q14", "trasporti", L("Navette: Autolinee Caruso", "Shuttles: Autolinee Caruso"), 1200, { rating: 4, booked: true, signed: false, arrival: "16:30" }),
    quote("q15", "cerimonia", L("Officiante e diritti comunali", "Celebrant and town hall fees"), 450, { rating: 4, booked: true, signed: true }),
    quote("q16", "altro", L("Animazione bambini", "Childminders"), 320, { rating: 4, booked: true, signed: false }),
  ];
  const budget: PremiumData["budget"] = [
    { id: "b1", category: "location", label: L("Caparra", "Deposit"), amount_cents: 400000, due_date: "2026-10-03", paid: true, quote_id: "q1" },
    { id: "b2", category: "location", label: L("Secondo acconto", "Second instalment"), amount_cents: 600000, due_date: "2027-05-15", paid: false, quote_id: "q1" },
    { id: "b3", category: "location", label: L("Saldo", "Balance"), amount_cents: 680000, due_date: addDays(DATE, 7), paid: false, quote_id: "q1" },
    { id: "b4", category: "foto", label: L("Acconto", "Deposit"), amount_cents: 100000, due_date: "2026-11-02", paid: true, quote_id: "q3" },
    { id: "b5", category: "foto", label: L("Saldo alla consegna", "Balance on delivery"), amount_cents: 290000, due_date: "2028-02-01", paid: false, quote_id: "q3" },
    { id: "b6", category: "fiori", label: L("Acconto", "Deposit"), amount_cents: 80000, due_date: "2027-02-10", paid: false, quote_id: "q5" },
    { id: "b7", category: "fiori", label: L("Saldo", "Balance"), amount_cents: 190000, due_date: addDays(DATE, -3), paid: false, quote_id: "q5" },
    { id: "b8", category: "abiti", label: L("Abito, acconto", "Dress, deposit"), amount_cents: 130000, due_date: "2026-11-20", paid: true, quote_id: "q8" },
    { id: "b9", category: "abiti", label: L("Abito, saldo all'ultima prova", "Dress, balance at final fitting"), amount_cents: 130000, due_date: "2027-08-28", paid: false, quote_id: "q8" },
    { id: "b10", category: "musica", label: L("DJ, acconto", "DJ, deposit"), amount_cents: 30000, due_date: "2027-01-15", paid: false, quote_id: "q7" },
    { id: "b11", category: "fedi", label: L("Fedi", "Rings"), amount_cents: 135000, due_date: "2027-07-10", paid: false, quote_id: "q11" },
    { id: "b12", category: "inviti", label: "Bespoke Invite", amount_cents: 6500, due_date: "2026-11-24", paid: true, quote_id: "q12" },
  ];
  // Attività: giorni prima del matrimonio (oggi siamo a circa dieci mesi). Le prime sono già fatte.
  const tasks: [string, string, number, boolean][] = [
    ["Decidere data e numero di invitati", "Decide the date and guest count", 420, true],
    ["Visitare le location a Noto e dintorni", "Visit venues around Noto", 400, true],
    ["Firmare con Tenuta Busulmone e versare la caparra", "Sign with Tenuta Busulmone and pay the deposit", 350, true],
    ["Prenotare il Comune per il rito civile in villa", "Book the town hall for the civil ceremony at the venue", 330, true],
    ["Scegliere il fotografo", "Choose the photographer", 320, true],
    ["Mandare l'invito digitale", "Send the digital invitation", 300, true],
    ["Bloccare le camere a Noto per chi viene da fuori", "Reserve rooms in Noto for out-of-town guests", 280, false],
    ["Prima prova dell'abito a Siracusa", "First dress fitting in Siracusa", 240, false],
    ["Scegliere fiorista e allestimento del cortile", "Choose the florist and courtyard styling", 220, false],
    ["Prenotare banda e DJ", "Book the band and the DJ", 200, false],
    ["Prova del menu con la tenuta", "Menu tasting at the estate", 150, false],
    ["Organizzare le navette da Piazza Municipio", "Arrange the shuttles from Piazza Municipio", 120, false],
    ["Comprare le fedi da Valvo", "Buy the rings at Valvo", 70, false],
    ["Chiudere la lista delle risposte (15 luglio)", "Close the RSVP list (15 July)", 65, false],
    ["Preparare la disposizione dei tavoli", "Prepare the seating plan", 30, false],
    ["Confermare i numeri finali al catering", "Confirm final numbers with the caterer", 14, false],
    ["Ritirare le bomboniere", "Collect the favours", 10, false],
    ["Preparare le buste per i fornitori", "Prepare the vendor envelopes", 2, false],
    ["Prenotare il brunch al Lido di Noto", "Book the brunch at Lido di Noto", 1, false],
  ];
  const vendors: PremiumData["vendors"] = [
    { id: "v1", name: "Tenuta Busulmone", role: L("Location e catering", "Venue and catering"), contact: "Valentina · +39 0931 000 412", contract_status: "signed" },
    { id: "v2", name: "Studio Ippolito", role: L("Foto e video", "Photo and video"), contact: "+39 349 000 1185", contract_status: "signed" },
    { id: "v3", name: "Fiori di Zagara", role: L("Fiori", "Flowers"), contact: "Lucia · +39 338 000 6620", contract_status: "signed" },
    { id: "v4", name: "Banda Iblea", role: L("Musica aperitivo", "Drinks music"), contact: "Gianni · +39 333 000 2210", contract_status: "unsigned" },
    { id: "v5", name: "DJ Ernesto Lupo", role: "DJ", contact: "+39 340 000 7754", contract_status: "signed" },
    { id: "v6", name: "Autolinee Caruso", role: L("Navette", "Shuttles"), contact: "+39 0931 000 778", contract_status: "unsigned" },
    { id: "v7", name: "Rosy Make-up", role: L("Trucco e parrucco", "Hair and make-up"), contact: "+39 345 000 9031", contract_status: "unsigned" },
  ];
  const tl = (rows: [string, string, string][]) => ({ items: rows.map(([time, it, eng]) => ({ time, item: en ? eng : it })) });
  const ck = (rows: [string, string, boolean][]) => ({ items: rows.map(([it, eng, done]) => ({ text: en ? eng : it, done })) });
  const ct = (rows: [string, string, string, string][]) => ({ items: rows.map(([name, it, eng, phone]) => ({ name, role: en ? eng : it, phone })) });
  return {
    id: "vetrina",
    event: { title: "Giulia & Matteo", eventType: "wedding", eventDate: DATE, venue: "Tenuta Busulmone", address: "Contrada Busulmone, Noto" },
    invitation: null,
    linkable: [],
    guests,
    tables,
    budget,
    quotes,
    tasks: tasks.map(([it, eng, d, done], i) => ({ id: `k${i}`, title: en ? eng : it, done, days_before: d })),
    vendors,
    rsvpResponses: 58,
    docs: {
      "programma-generale": tl([
        ["09:00", "Trucco e parrucco a casa Scivoletto", "Hair and make-up at the Scivoletto house"],
        ["13:00", "Arriva il fotografo", "Photographer arrives"],
        ["16:45", "Prima navetta da Piazza Municipio", "First shuttle from Piazza Municipio"],
        ["17:30", "Rito civile nel giardino", "Civil ceremony in the garden"],
        ["18:15", "Aperitivo con la Banda Iblea", "Drinks with the Banda Iblea"],
        ["19:30", "Foto al tramonto", "Sunset photos"],
        ["20:30", "Cena nel cortile", "Dinner in the courtyard"],
        ["22:45", "Primo ballo e torta", "First dance and cake"],
        ["23:00", "DJ", "DJ"],
        ["02:00", "Ultima navetta", "Last shuttle"],
      ]),
      "ordine-cerimonia": tl([
        ["17:25", "Gli invitati prendono posto", "Guests take their seats"],
        ["17:30", "Ingresso di Matteo con mamma Enza", "Matteo walks in with his mum Enza"],
        ["17:33", "Ingresso di Giulia con papà Corrado (Ave Maria, violino)", "Giulia walks in with her dad Corrado (Ave Maria, violin)"],
        ["17:40", "Lettura di Giusi: Neruda, Sonetto XVII", "Reading by Giusi: Neruda, Sonnet XVII"],
        ["17:50", "Promesse scritte da noi", "Our own vows"],
        ["17:55", "Scambio degli anelli (li porta il nipote Matteo)", "Ring exchange (nephew Matteo brings them)"],
        ["18:00", "Firme e lancio di petali di bouganville", "Signing and bougainvillea petal toss"],
      ]),
      "chi-chiamare": ct([
        ["Valentina", "Coordinatrice della tenuta", "Venue coordinator", "+39 0931 000 412"],
        ["Giusi", "Testimone di Giulia", "Giulia's witness", "+39 347 000 5531"],
        ["Davide", "Testimone di Matteo", "Matteo's witness", "+39 328 000 1964"],
        ["Marco Ippolito", "Fotografo", "Photographer", "+39 349 000 1185"],
        ["Autolinee Caruso", "Navette", "Shuttles", "+39 0931 000 778"],
        ["Radio Taxi Noto", "Rientro", "Ride home", "+39 0931 000 900"],
      ]),
      corteo: ct([
        ["Giusi Scivoletto", "Testimone di Giulia", "Giulia's witness", "+39 347 000 5531"],
        ["Martina Belfiore", "Testimone di Giulia", "Giulia's witness", "+39 340 000 8812"],
        ["Davide Lo Monaco", "Testimone di Matteo", "Matteo's witness", "+39 328 000 1964"],
        ["Totò Midolo", "Testimone di Matteo", "Matteo's witness", "+39 333 000 4120"],
      ]),
      luoghi: ct([
        ["Tenuta Busulmone", "Contrada Busulmone, Noto", "Contrada Busulmone, Noto", "+39 0931 000 412"],
        ["Piazza Municipio", "Partenza navette", "Shuttle pick-up", ""],
        ["Lido di Noto", "Brunch della domenica", "Sunday brunch", ""],
      ]),
      musica: ck([
        ["Ingresso: Ave Maria (Schubert), violino", "Entrance: Ave Maria (Schubert), violin", true],
        ["Uscita: «Vitti 'na crozza», banda", "Exit: \"Vitti 'na crozza\", band", true],
        ["Primo ballo: «La cura», Battiato", "First dance: \"La cura\", Battiato", true],
        ["Torta: «Tintarella di luna»", "Cake: \"Tintarella di luna\"", false],
        ["Lista del DJ: niente reggaeton prima di mezzanotte", "DJ list: no reggaeton before midnight", false],
      ]),
      discorsi: ck([
        ["Papà Corrado, prima della cena", "Dad Corrado, before dinner", false],
        ["Giusi e Davide, dopo il secondo", "Giusi and Davide, after the main course", false],
        ["Nonno Salvatore, se se la sente", "Grandpa Salvatore, if he feels up to it", false],
      ]),
      menu: ck([
        ["Aperitivo: arancine, panelle, caponata, ricotta fresca", "Drinks: arancine, panelle, caponata, fresh ricotta", true],
        ["Primo: busiate al pesto trapanese con gamberi rossi", "First course: busiate with Trapani pesto and red prawns", true],
        ["Secondo: ricciola al forno con agrumi", "Main: baked amberjack with citrus", true],
        ["Torta: cassata al forno e buffet di cannoli", "Cake: baked cassata and a cannoli buffet", false],
        ["4 vegetariani, 2 senza glutine, 1 allergia alla frutta secca (zia Concetta)", "4 vegetarian, 2 gluten-free, 1 nut allergy (Aunt Concetta)", false],
      ]),
      bevande: ck([
        ["Grillo e Nero d'Avola della cantina della tenuta", "Grillo and Nero d'Avola from the estate winery", true],
        ["Moscato di Noto con la torta", "Moscato di Noto with the cake", true],
        ["Bar dalle 23: gin tonic e amaro siciliano", "Bar from 11pm: G&T and Sicilian amaro", false],
      ]),
      alloggio: ck([
        ["B&B Le Zagare: 8 camere bloccate fino al 30 giugno", "B&B Le Zagare: 8 rooms held until 30 June", true],
        ["Albergo Corso Vittorio: 6 camere", "Albergo Corso Vittorio: 6 rooms", true],
        ["Famiglia Lo Monaco (Germania): casa vacanze a Marzamemi", "Lo Monaco family (Germany): holiday flat in Marzamemi", false],
      ]),
      "piano-b": ck([
        ["Pioggia: rito sotto il loggiato, cena nella sala delle botti", "Rain: ceremony under the loggia, dinner in the barrel room", true],
        ["Caldo: ventagli e acqua aromatizzata all'ingresso", "Heat: fans and flavoured water at the entrance", true],
        ["Ritardo navetta: Valentina ha il numero di un secondo autista", "Shuttle delay: Valentina has a backup driver's number", false],
      ]),
      "lista-foto": ck([
        ["Giulia con nonna Pina sotto il melograno", "Giulia with Nonna Pina under the pomegranate tree", false],
        ["Tutti i cugini Scivoletto e Lo Monaco insieme", "All the Scivoletto and Lo Monaco cousins together", false],
        ["Noi due sulla scalinata della Cattedrale (venerdì)", "The two of us on the Cathedral steps (Friday)", false],
      ]),
      "kit-emergenza": ck([
        ["Cerotti, ago e filo avorio, spille", "Plasters, ivory needle and thread, safety pins", false],
        ["Crema solare e ventaglio", "Sunscreen and a fan", false],
        ["Antistaminico per Matteo (polline)", "Antihistamine for Matteo (pollen)", false],
      ]),
      "ultima-settimana": ck([
        ["Consegnare alla tenuta il tableau e i segnaposto", "Drop off the seating chart and place cards at the venue", false],
        ["Mandare a tutti l'orario delle navette", "Send everyone the shuttle times", false],
        ["Ritirare l'abito a Siracusa (giovedì)", "Collect the dress in Siracusa (Thursday)", false],
      ]),
      palette: L(
        "Rosso melograno, oro della pietra di Noto, verde ulivo e bianco mandorla. Tovaglie di lino grezzo, centrotavola di melograni aperti e rami d'ulivo, candele in vetro. Niente fiori bianchi classici: bouganville e zagara.",
        "Pomegranate red, Noto-stone gold, olive green and almond white. Raw linen tablecloths, centrepieces of open pomegranates and olive branches, candles in glass. No classic white flowers: bougainvillea and orange blossom.",
      ),
    },
    notes: L(
      "Ricordarsi di chiedere a Valentina se il cortile ha abbastanza prese per la banda. Nonna Pina vuole sedersi lontano dalle casse.",
      "Remember to ask Valentina whether the courtyard has enough sockets for the band. Nonna Pina wants to sit away from the speakers.",
    ),
    budgetCents: 3_800_000,
    guestQuota: 130,
    groupQuotas: { [groups.sc]: 45, [groups.lm]: 40 },
    icon: null,
    // Foto di copertina: Julia_Malcher su Pixabay (licenza Pixabay), vedi public/stock/CREDITS.md.
    bannerImage: "/stock/wedding-couple-julia-malcher.jpg",
    archImage: null,
  };
}
