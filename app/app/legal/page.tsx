import { redirect } from "next/navigation";

// The legal text moved to the public /terms and /privacy pages, so it can be
// read before signing up. Old links land on the Terms.
export default function LegalRedirect() {
  redirect("/terms");
}
