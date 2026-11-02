import { Fraunces } from "next/font/google";

// Titoli del builder in Fraunces, come nel sistema «Bespoke Invites». Caricato solo nella sezione editor.
const display = Fraunces({ subsets: ["latin"], variable: "--font-iv-display", display: "swap", weight: ["300", "400", "500"], style: ["normal", "italic"] });

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <div className={display.variable}>{children}</div>;
}
