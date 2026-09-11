// Industry-vertical steering. A generic financial-model prompt gets CapEx/OpEx
// categories and revenue units roughly right for any business; a one-line
// steer per vertical gets them right for THIS kind of business — the biggest
// single accuracy lever available without separate prompts per industry.

export interface Vertical {
  key: string;
  label: string;
  /** Appended to every specialist's context. */
  hint: string;
}

export const VERTICALS: Vertical[] = [
  {
    key: "food_beverage",
    label: "Food & Beverage",
    hint:
      "Food & Beverage: CapEx centers on kitchen equipment, fit-out, POS and health-permit costs. " +
      "Revenue streams are typically covers/day, delivery orders/day or subscriptions/week. OpEx is " +
      "dominated by food cost % (COGS) and labor (cooks, front-of-house). Seasonality and weekday/weekend " +
      "patterns matter. Watch food-safety and licensing risk.",
  },
  {
    key: "saas_tech",
    label: "SaaS / Technology",
    hint:
      "SaaS/Technology: CapEx is light (dev tooling, cloud setup, initial infra); most spend is OpEx — " +
      "engineering payroll, hosting/infra, and customer acquisition. Revenue streams are subscriptions/users " +
      "with MRR/ARR, price_per_unit = monthly or annual plan price, units_per_month = active subscribers, " +
      "cogs_percent = hosting + payment-processing cost as % of revenue (often 10-25%). Model churn via a " +
      "slower ramp or a growth-rate haircut. Watch competitive moat and technical execution risk closely.",
  },
  {
    key: "retail",
    label: "Retail",
    hint:
      "Retail: CapEx covers fit-out, shelving/fixtures, initial inventory, POS. Revenue streams are units " +
      "sold per category with cogs_percent = wholesale cost as % of retail price (often 40-65%). OpEx is " +
      "rent, staffing, and inventory shrinkage/insurance. Foot traffic and location quality drive volume — " +
      "weight the location dimension accordingly.",
  },
  {
    key: "real_estate",
    label: "Real Estate / Hospitality",
    hint:
      "Real Estate/Hospitality: CapEx is the largest line — acquisition or fit-out, furnishing, licensing. " +
      "Revenue streams are room-nights or rental units with utilization_percent = occupancy rate. OpEx " +
      "includes property management, utilities, maintenance reserve, and insurance. Financing structure " +
      "(debt/equity split, loan term) matters more here than most verticals — be precise in the funding plan.",
  },
  {
    key: "professional_services",
    label: "Professional Services",
    hint:
      "Professional Services: CapEx is minimal (office setup, licensing/certification, software). Revenue " +
      "streams are billable hours or retainers with unit_label = billable hours or clients/month. OpEx is " +
      "dominated by payroll of billable staff plus admin. Utilization_percent = billable-hours ratio against " +
      "capacity — this single number drives most of the model.",
  },
  {
    key: "manufacturing",
    label: "Manufacturing",
    hint:
      "Manufacturing: CapEx includes machinery, facility fit-out, tooling — often the dominant cost and " +
      "usually financed with debt. Revenue streams are units produced/sold with cogs_percent = raw material " +
      "+ direct labor as % of price. OpEx covers facility, utilities (energy-intensive), and indirect labor. " +
      "Supply-chain and regulatory risk (safety, environmental) deserve extra weight.",
  },
  {
    key: "healthcare",
    label: "Healthcare / Wellness",
    hint:
      "Healthcare/Wellness: CapEx includes clinical/treatment equipment, fit-out to code, and licensing — " +
      "often lengthy and expensive to obtain. Revenue streams are appointments/sessions or memberships with " +
      "utilization_percent = practitioner or chair/bed occupancy. OpEx is dominated by licensed-staff payroll. " +
      "Regulatory and insurance/liability risk should be scored high.",
  },
];

export function verticalByKey(key?: string): Vertical | undefined {
  return VERTICALS.find((v) => v.key === key);
}

export function verticalHint(key?: string): string {
  const v = verticalByKey(key);
  return v ? `\n\nIndustry context — ${v.label}: ${v.hint}` : "";
}
