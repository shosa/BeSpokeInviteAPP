import { Bodoni_Moda, Montserrat } from "next/font/google";

// Caratteri del planner: Bodoni Moda corsivo per i titoli, Montserrat 600 per le etichette in maiuscolo.
// Scaricati in build e serviti dal nostro dominio, come gli altri caratteri del sito.
const bodoni = Bodoni_Moda({ subsets: ["latin"], style: ["italic"], weight: ["400", "500"], display: "swap", variable: "--yp-bodoni" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600"], display: "swap", variable: "--yp-mont" });

export const plannerFonts = `${bodoni.variable} ${montserrat.variable}`;
