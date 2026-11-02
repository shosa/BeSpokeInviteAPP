import { redirect } from "next/navigation";

// Niente landing: chi apre la radice va al proprio profilo (che chiede il link di accesso se manca).
export default function Home() {
  redirect("/account");
}
