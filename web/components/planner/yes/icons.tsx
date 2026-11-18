// Icone del planner: contorno quando la sezione non è aperta, piene quando è quella aperta (come le app del telefono).
// Disegni nostri, 24×24.

type P = { on?: boolean; className?: string };
const base = { width: 24, height: 24, viewBox: "0 0 24 24", "aria-hidden": true } as const;
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IcHome({ on, className }: P) {
  return on ? (
    <svg {...base} className={className}><path fill="currentColor" d="M11.3 3.2a1.1 1.1 0 0 1 1.4 0l7.6 6.4c.3.2.4.5.4.9v9.1c0 .8-.6 1.4-1.4 1.4h-4.1v-5.6c0-.6-.4-1-1-1h-4.4c-.6 0-1 .4-1 1V21H4.7c-.8 0-1.4-.6-1.4-1.4v-9.1c0-.4.1-.7.4-.9z" /></svg>
  ) : (
    <svg {...base} className={className}><path {...line} d="M4 10.4 12 3.8l8 6.6V20a.9.9 0 0 1-.9.9h-4.3v-5.6H9.2v5.6H4.9A.9.9 0 0 1 4 20z" /></svg>
  );
}

export function IcWallet({ on, className }: P) {
  return on ? (
    <svg {...base} className={className}><path fill="currentColor" d="M5.5 4h11.2c.9 0 1.6.7 1.6 1.6V7H5.6a.8.8 0 0 0 0 1.6H19c1 0 1.8.8 1.8 1.8v8.1c0 1-.8 1.8-1.8 1.8H5.5c-1.4 0-2.5-1.1-2.5-2.5V6.5C3 5.1 4.1 4 5.5 4m11.3 9.1a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4" /></svg>
  ) : (
    <svg {...base} className={className}><path {...line} d="M18.2 7.4V5.8c0-.9-.7-1.6-1.6-1.6H5.6c-1.3 0-2.3 1-2.3 2.3v11.1c0 1.3 1 2.3 2.3 2.3h13.2c.9 0 1.6-.7 1.6-1.6V9c0-.9-.7-1.6-1.6-1.6H5.6a1.6 1.6 0 0 1 0-3.2" /><circle cx="16.6" cy="13.8" r="1.1" fill="currentColor" /></svg>
  );
}

export function IcGuests({ on, className }: P) {
  return on ? (
    <svg {...base} className={className}><circle cx="9" cy="8" r="3.6" fill="currentColor" /><path fill="currentColor" d="M2.6 19.4c.4-3.6 3-5.9 6.4-5.9s6 2.3 6.4 5.9c.1.6-.4 1.1-1 1.1H3.6c-.6 0-1.1-.5-1-1.1" /><circle cx="16.6" cy="8.6" r="2.9" fill="currentColor" /><path fill="currentColor" d="M16.9 13.2c2.6.2 4.4 2.2 4.6 5.2 0 .6-.4 1-1 1h-3.3a8.6 8.6 0 0 0-2.4-5.6c.6-.4 1.3-.6 2.1-.6" /></svg>
  ) : (
    <svg {...base} className={className}><circle {...line} cx="9" cy="8.2" r="3.3" /><path {...line} d="M3.3 19.7c.4-3.3 2.7-5.5 5.7-5.5s5.3 2.2 5.7 5.5z" /><circle {...line} cx="16.7" cy="8.8" r="2.6" /><path {...line} d="M16.3 13.6c2.6 0 4.3 1.9 4.5 4.9h-3.5" /></svg>
  );
}

export function IcTasks({ on, className }: P) {
  return on ? (
    <svg {...base} className={className}><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.4" fill="currentColor" /><path d="m7.8 12.2 2.9 2.9 5.6-6" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg {...base} className={className}><rect {...line} x="3.8" y="3.8" width="16.4" height="16.4" rx="3.2" /><path {...line} d="m8 12.2 2.8 2.8 5.3-5.6" /></svg>
  );
}

export function IcBinder({ on, className }: P) {
  return on ? (
    <svg {...base} className={className}><path fill="currentColor" d="M3 6.6C3 5.2 4.1 4 5.5 4h3.9c.6 0 1.1.2 1.5.6l1.3 1.3c.2.2.4.3.7.3h6.6c1.4 0 2.5 1.1 2.5 2.5v9.8c0 1.4-1.1 2.5-2.5 2.5h-13C4.1 21 3 19.9 3 18.5z" /></svg>
  ) : (
    <svg {...base} className={className}><path {...line} d="M3.6 6.7c0-1.1.9-2 2-2h3.8c.4 0 .8.2 1.1.5l1.4 1.4c.3.3.6.4 1 .4h6.6c1.1 0 2 .9 2 2v9.5c0 1.1-.9 2-2 2H5.6c-1.1 0-2-.9-2-2z" /><path {...line} d="M3.6 9.6h16.8" /></svg>
  );
}

export function IcSearch({ className }: P) {
  return <svg {...base} className={className}><circle {...line} cx="10.6" cy="10.6" r="6.4" /><path {...line} d="m15.4 15.4 4.8 4.8" /></svg>;
}

export function IcGear({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path {...line} d="M10.3 3.6h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.7 1.6v1.9l1.7 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8L4.3 14l1.7-1.6v-1.9L4.3 8.9 6 6l2.2.8 1.6-.9z" />
      <circle {...line} cx="12" cy="11.4" r="2.8" />
    </svg>
  );
}

export function IcPlus({ className }: P) {
  return <svg {...base} className={className}><path {...line} d="M12 4.5v15M4.5 12h15" /></svg>;
}

export function IcPrint({ className }: P) {
  return <svg {...base} className={className}><path {...line} d="M7 8.5V4.2h10v4.3M7 16.6H5a1.8 1.8 0 0 1-1.8-1.8v-4.5c0-1 .8-1.8 1.8-1.8h14c1 0 1.8.8 1.8 1.8v4.5c0 1-.8 1.8-1.8 1.8h-2" /><path {...line} d="M7 13.4h10v6.4H7z" /></svg>;
}

export function IcChevron({ className }: P) {
  return <svg {...base} className={className ?? "y-chev"}><path {...line} strokeWidth={2} d="m9 5 7 7-7 7" /></svg>;
}

export function IcCheck({ className }: P) {
  return <svg {...base} className={className}><path fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" d="m5.5 12.5 4.2 4.2 8.8-9.4" /></svg>;
}

export function IcClose({ className }: P) {
  return <svg {...base} className={className}><path {...line} strokeWidth={1.8} d="m6 6 12 12M18 6 6 18" /></svg>;
}

export function IcCamera({ className }: P) {
  return <svg {...base} className={className}><path {...line} d="M4 8.6c0-1 .8-1.8 1.8-1.8h2l1.4-2h5.6l1.4 2h2c1 0 1.8.8 1.8 1.8v9c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8z" /><circle {...line} cx="12" cy="12.8" r="3.3" /></svg>;
}

export function IcSun({ className }: P) {
  return <svg {...base} className={className}><circle {...line} cx="12" cy="12" r="3.6" /><path {...line} d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M5.8 18.2l1.4-1.4M16.8 7.2l1.4-1.4" /></svg>;
}

export function IcCloud({ rain, className }: P & { rain?: boolean }) {
  return (
    <svg {...base} className={className}>
      <path {...line} d="M7.2 17.4h9.6a3.7 3.7 0 0 0 .5-7.4 5.3 5.3 0 0 0-10.2 1.3 3.1 3.1 0 0 0 .1 6.1" />
      {rain ? <path {...line} d="m9 19.6-.6 1.4M12.4 19.6l-.6 1.4M15.8 19.6l-.6 1.4" /> : <path {...line} d="m9.6 13.6 1.6 1.5 3.2-3.2" />}
    </svg>
  );
}

export function IcGlobe({ className }: P) {
  return <svg {...base} className={className}><circle {...line} cx="12" cy="12" r="8.4" /><path {...line} d="M3.6 12h16.8M12 3.6c2.3 2.3 3.4 5.1 3.4 8.4s-1.1 6.1-3.4 8.4c-2.3-2.3-3.4-5.1-3.4-8.4S9.7 5.9 12 3.6" /></svg>;
}

export function IcPhone({ className }: P) {
  return <svg {...base} className={className}><path {...line} d="M6.6 3.8h2.6l1.4 4-2 1.4a11 11 0 0 0 6.2 6.2l1.4-2 4 1.4v2.6c0 1-.8 1.8-1.8 1.8C10.4 19.2 4.8 13.6 4.8 5.6c0-1 .8-1.8 1.8-1.8" /></svg>;
}

export function IcClock({ className }: P) {
  return <svg {...base} className={className}><circle {...line} cx="12" cy="12" r="8.4" /><path {...line} d="M12 7.4V12l3 2" /></svg>;
}

export function IcList({ className }: P) {
  return <svg {...base} className={className}><path {...line} d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10M4.6 6.5h.8M4.6 12h.8M4.6 17.5h.8" /></svg>;
}

export function IcBack({ className }: P) {
  return <svg {...base} className={className}><path {...line} strokeWidth={2} d="M15 5 8 12l7 7" /></svg>;
}
