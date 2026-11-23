import { redirect } from "next/navigation";
import { ApiError, apiServer } from "@/lib/api";
import type { ProStudio } from "./types";

// Studio dell'utente collegato: senza accesso si torna all'area personale (login), se non è uno studio pure.
export async function loadStudio(): Promise<ProStudio> {
  try {
    return await apiServer<ProStudio>("/api/pro/me");
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/account");
    throw e;
  }
}

export { EVENT_LABEL, fmtDate } from "./format";
