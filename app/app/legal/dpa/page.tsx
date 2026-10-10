import { redirect } from "next/navigation";

// The DPA moved to the public /dpa page (next to /terms and /privacy), so an
// organization can review it before signing up.
export default function DpaRedirect() {
  redirect("/dpa");
}
