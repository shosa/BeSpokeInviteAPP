"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BLOCKS, formatPrice, getAddon, getModel, type AddonKey, type BlockType, type Catalog, type InviteConfig } from "@inviteme/shared";
import { ui, type Lang } from "@/lib/ui";
import { blockCopy, blockDescCopy } from "@/lib/catalogCopy";
import { BlockIcon } from "@/lib/blockIcons";

type Props = {
  catalog: Catalog;
  config: InviteConfig;
  features: ReadonlySet<AddonKey>;
  present: ReadonlySet<string>;
  lang?: Lang;
  onClose: () => void;
  onAdd: (type: BlockType, feature?: AddonKey) => void;
  onToggleAddon: (key: AddonKey) => void;
  onSetModel: (id: string) => void;
};

// Finestra dei blocchi aggiungibili. Ogni blocco dice se è disponibile, già presente, o da sbloccare:
// con una funzione attivabile si attiva qui; con un'altra modello che la include si passa a quello.
export function AddBlockDialog(p: Props) {
  const lang = p.lang ?? "it";
  const L = ui(lang).builder;
  const model = getModel(p.catalog, p.config.model);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.onClose]);

  // Nel portale (body): la colonna del builder ha animazioni con trasformazioni, che sposterebbero il modale.
  return createPortal(
    <div className="bl-app bl-layer">
    <div className="bl-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div className="bl-modal" role="dialog" aria-modal="true" aria-labelledby="bl-modal-title">
        <header className="bl-modal-head">
          <div>
            <h2 id="bl-modal-title">{L.addTitle}</h2>
            <p className="hint">{L.addHint}</p>
          </div>
          <button type="button" className="bl-icon" aria-label={L.addClose} onClick={p.onClose}>×</button>
        </header>

        <ul className="bl-cards">
          {BLOCKS.map((def) => {
            const feature = def.feature;
            const locked = !!feature && !p.features.has(feature);
            const taken = !!def.unique && p.present.has(def.type);
            const addon = feature ? getAddon(p.catalog, feature) : undefined;
            const inModel = !!feature && !!model?.options.includes(feature);
            const extra = feature ? p.catalog.models.find((m) => m.enabled && m.id !== p.config.model && (m.included.includes(feature) || m.options.includes(feature))) : undefined;
            const bought = !!feature && p.config.addons.includes(feature) && !model?.included.includes(feature);
            return (
              <li key={def.type} className={`bl-card${locked ? " is-locked" : ""}`}>
                <div className="bl-card-head">
                  <span className="bl-card-icon"><BlockIcon type={def.type} size={20} /></span>
                  <h3>{blockCopy(def.type, def.label, lang)}</h3>
                </div>
                <p className="hint">{blockDescCopy(def.type, def.description, lang)}</p>
                <div className="bl-card-foot">
                  {!locked && (
                    <button type="button" className="btn solid small" disabled={taken} onClick={() => p.onAdd(def.type)}>
                      {taken ? L.already : L.addBlock}
                    </button>
                  )}
                  {locked && addon && inModel && (
                    <button type="button" className="btn outline small" onClick={() => p.onAdd(def.type, addon.key)}>
                      {L.activate(formatPrice(addon.cents, lang === "en" ? "en-US" : "it-IT"))}
                    </button>
                  )}
                  {locked && !inModel && extra && (
                    <button type="button" className="btn outline small" onClick={() => p.onSetModel(extra.id)}>{L.switchTo(extra.name)}</button>
                  )}
                  {locked && !inModel && !extra && <small>{L.notInModel}</small>}
                  {!locked && bought && addon && (
                    <button type="button" className="link" onClick={() => p.onToggleAddon(addon.key)}>{L.deactivate}</button>
                  )}
                  {!locked && bought && <small>{L.activeFeature}</small>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
    </div>,
    document.body,
  );
}
