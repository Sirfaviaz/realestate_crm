/** Standard pick-list values for inventory, listings, and lead matching. */

export type PresetOption = { value: string; label: string };

export const BHK_OPTIONS: PresetOption[] = [
  { value: "RK", label: "RK" },
  { value: "Studio", label: "Studio" },
  ...Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return { value: `${n} BHK`, label: `${n} BHK` };
  }),
];

export const PROPERTY_TYPE_OPTIONS: PresetOption[] = [
  { value: "flat", label: "Flat / Apartment" },
  { value: "house", label: "House" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial" },
  { value: "pg", label: "PG" },
];

export const POSSESSION_OPTIONS: PresetOption[] = [
  { value: "ready", label: "Ready to move" },
  { value: "near_possession", label: "Near possession (0–6 mo)" },
  { value: "under_construction", label: "Under construction" },
  { value: "new_launch", label: "New launch" },
];

export const FACING_OPTIONS: PresetOption[] = [
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "north_east", label: "North-East" },
  { value: "north_west", label: "North-West" },
  { value: "south_east", label: "South-East" },
  { value: "south_west", label: "South-West" },
];

export const FURNISHING_OPTIONS: PresetOption[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "fully_furnished", label: "Fully furnished" },
];

export const PARKING_OPTIONS: PresetOption[] = [
  { value: "none", label: "None" },
  { value: "open_1", label: "1 open" },
  { value: "covered_1", label: "1 covered" },
  { value: "open_2", label: "2 open" },
  { value: "covered_2", label: "2 covered" },
  { value: "open_covered", label: "1 open + 1 covered" },
];

export const PARKING_DETAIL_OPTIONS: PresetOption[] = [
  { value: "none", label: "No parking" },
  { value: "visitor_only", label: "Visitor parking only" },
  { value: "1_covered", label: "1 covered slot" },
  { value: "2_covered", label: "2 covered slots" },
  { value: "1_open_1_covered", label: "1 open + 1 covered" },
  { value: "stilt", label: "Stilt parking" },
  { value: "basement", label: "Basement parking" },
];

export const FLOOR_COUNT_OPTIONS: PresetOption[] = Array.from({ length: 40 }, (_, i) => {
  const n = i + 1;
  return { value: String(n), label: `${n} floors` };
});

export const AVAILABLE_FLOOR_OPTIONS: PresetOption[] = [
  { value: "ground", label: "Ground floor" },
  { value: "1-3", label: "Floors 1–3" },
  { value: "4-7", label: "Floors 4–7" },
  { value: "8-12", label: "Floors 8–12" },
  { value: "13-20", label: "Floors 13–20" },
  { value: "21+", label: "Floor 21+" },
  { value: "all", label: "All floors" },
];

export const GST_OPTIONS: PresetOption[] = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

export const DOWN_PAYMENT_OPTIONS: PresetOption[] = [
  { value: "10", label: "10%" },
  { value: "15", label: "15%" },
  { value: "20", label: "20%" },
  { value: "25", label: "25%" },
  { value: "30", label: "30%" },
  { value: "40", label: "40%" },
  { value: "50", label: "50%" },
];

export const INSTALMENT_OPTIONS: PresetOption[] = [
  { value: "3", label: "3 instalments" },
  { value: "6", label: "6 instalments" },
  { value: "12", label: "12 instalments" },
  { value: "24", label: "24 instalments" },
  { value: "36", label: "36 instalments" },
];

export const LAUNCH_TIMELINE_OPTIONS: PresetOption[] = [
  { value: "launched", label: "Already launched" },
  { value: "q1_2026", label: "Q1 2026" },
  { value: "q2_2026", label: "Q2 2026" },
  { value: "q3_2026", label: "Q3 2026" },
  { value: "q4_2026", label: "Q4 2026" },
  { value: "2027", label: "2027" },
  { value: "2028_plus", label: "2028 or later" },
];

export const COMPLETION_TIMELINE_OPTIONS: PresetOption[] = [
  { value: "ready", label: "Ready now" },
  { value: "6_months", label: "Within 6 months" },
  { value: "1_year", label: "Within 1 year" },
  { value: "2_years", label: "Within 2 years" },
  { value: "3_years", label: "Within 3 years" },
  { value: "3_years_plus", label: "3+ years" },
];

export const STREAM_OPTIONS: PresetOption[] = [
  { value: "sales", label: "Sale" },
  { value: "rental", label: "Rental" },
];

export const AMENITY_OPTIONS = [
  "Pool",
  "Gym",
  "Clubhouse",
  "Parking",
  "Garden",
  "Security",
  "Power Backup",
  "Lift",
  "Kids Play Area",
  "Jogging Track",
] as const;

export function presetLabel(options: PresetOption[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label || value;
}
