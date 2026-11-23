"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Image as ImageIcon, Share2, X } from "lucide-react";

// Pannello «Condividi» dell'invito, prima di quello del sistema: QR code del link, da scaricare o condividere come
// immagine (una cartolina con titolo, QR e indirizzo), poi copia del link e condivisione di sistema.
const COPY = {
  it: { title: "Condividi l'invito", qr: "Inquadra per aprire l'invito", download: "Scarica immagine", shareImg: "Condividi immagine", other: "Altre app", copy: "Copia link", copied: "Link copiato", close: "Chiudi", text: "Vi invitiamo! Trovate tutti i dettagli qui", noShare: "Il dispositivo non condivide immagini: l'ho scaricata" },
  en: { title: "Share the invitation", qr: "Scan to open the invitation", download: "Download image", shareImg: "Share image", other: "Other apps", copy: "Copy link", copied: "Link copied", close: "Close", text: "You're invited! All the details here", noShare: "This device can't share images: it has been downloaded" },
};
const INK = "#2a2119";
const PAPER = "#fdfbf7";
const BRASS = "#8a6427";

export function ShareSheet({ url, title, lang = "it", onClose }: { url: string; title: string; lang?: "it" | "en"; onClose: () => void }) {
  const T = COPY[lang];
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  const fileName = `qr-${title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "invito"}.png`;

  // Cartolina 1080×1350: titolo, QR, indirizzo e firma, con i caratteri del sito.
  async function card(): Promise<Blob> {
    const css = getComputedStyle(document.documentElement);
    const serif = `${css.getPropertyValue("--font-iv-display").trim() || "Georgia"}, Georgia, serif`;
    const sans = `${css.getPropertyValue("--font-text").trim() || "Helvetica Neue"}, Arial, sans-serif`;
    await document.fonts?.ready;
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1350;
    const g = c.getContext("2d")!;
    g.fillStyle = PAPER; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = "rgba(160,115,45,0.35)"; g.lineWidth = 2; g.strokeRect(48, 48, c.width - 96, c.height - 96);
    g.textAlign = "center"; g.fillStyle = BRASS;
    g.font = `600 30px ${sans}`;
    g.fillText(lang === "en" ? "YOU'RE INVITED" : "SIETE INVITATI", c.width / 2, 190);
    g.fillStyle = INK;
    let size = 92;
    g.font = `300 ${size}px ${serif}`;
    while (g.measureText(title).width > c.width - 200 && size > 44) { size -= 4; g.font = `300 ${size}px ${serif}`; }
    g.fillText(title, c.width / 2, 300);
    const img = new Image();
    img.src = await QRCode.toDataURL(url, { margin: 2, width: 620, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } });
    await img.decode();
    const q = 620, x = (c.width - q) / 2, y = 380;
    g.fillStyle = "#ffffff";
    g.beginPath(); g.roundRect(x - 24, y - 24, q + 48, q + 48, 32); g.fill();
    g.drawImage(img, x, y, q, q);
    g.fillStyle = "#7b6a57"; g.font = `400 32px ${sans}`;
    g.fillText(T.qr, c.width / 2, y + q + 110);
    g.fillStyle = INK; g.font = `500 30px ${sans}`;
    g.fillText(url.replace(/^https?:\/\//, ""), c.width / 2, y + q + 160);
    g.fillStyle = BRASS; g.font = `400 34px ${serif}`;
    g.fillText("The Bespoke Invite", c.width / 2, c.height - 110);
    return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("png"))), "image/png"));
  }

  async function download(blob?: Blob) {
    const b = blob ?? (await card());
    const href = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = href; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }

  async function shareImage() {
    const blob = await card();
    const file = new File([blob], fileName, { type: "image/png" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text: `${T.text}: ${url}` }); return; }
      catch (e) { if ((e as DOMException)?.name === "AbortError") return; }
    }
    await download(blob);
    setNote(T.noShare);
  }

  async function shareLink() {
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title, text: T.text, url }); return; }
      catch (e) { if ((e as DOMException)?.name === "AbortError") return; }
    }
    await copy();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt(T.copy, url); }
  }

  return (
    <div className="shs-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shs" role="dialog" aria-modal="true" aria-labelledby="shs-t">
        <div className="shs-head">
          <h2 id="shs-t">{T.title}</h2>
          <button ref={closeRef} type="button" className="shs-x" onClick={onClose} aria-label={T.close}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="shs-qr">
          {qr ? <img src={qr} alt={T.qr} width={240} height={240} /> : <span className="shs-qr-ph" aria-hidden="true" />}
          <p>{T.qr}</p>
          <span className="shs-url">{url.replace(/^https?:\/\//, "")}</span>
        </div>
        <div className="shs-main">
          <button type="button" className="shs-btn is-primary" onClick={() => void download()}><Download size={18} aria-hidden="true" />{T.download}</button>
          <button type="button" className="shs-btn" onClick={() => void shareImage()}><ImageIcon size={18} aria-hidden="true" />{T.shareImg}</button>
        </div>
        <div className="shs-more">
          <button type="button" className="shs-link" onClick={() => void copy()}>{copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{copied ? T.copied : T.copy}</button>
          <button type="button" className="shs-link" onClick={() => void shareLink()}><Share2 size={17} aria-hidden="true" />{T.other}</button>
        </div>
        <span className="visually-hidden" role="status">{copied ? T.copied : note ?? ""}</span>
        {note && <p className="shs-note">{note}</p>}
      </div>
    </div>
  );
}
