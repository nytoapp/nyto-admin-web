/** Same table types as the NYTO guest app / Prisma enum. Multi-select on experiences. */
export type ExperienceCategory =
  | "WEEKLY"
  | "WOMEN_LED"
  | "COUPLES"
  | "SINGLES";

export const EXPERIENCE_CATEGORIES: {
  id: ExperienceCategory;
  label: string;
  hint: string;
}[] = [
  {
    id: "WEEKLY",
    label: "Weekly",
    hint: "Standard six-seat dinner",
  },
  {
    id: "WOMEN_LED",
    label: "Women-led",
    hint: "Room that starts with her",
  },
  {
    id: "COUPLES",
    label: "Couples",
    hint: "Pairs at one long table",
  },
  {
    id: "SINGLES",
    label: "Singles",
    hint: "Solo seats, live mix",
  },
];

export function categoryLabel(id: string): string {
  return (
    EXPERIENCE_CATEGORIES.find((c) => c.id === id)?.label ??
    id
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function toggleCategory(
  current: ExperienceCategory[],
  id: ExperienceCategory,
): ExperienceCategory[] {
  return current.includes(id)
    ? current.filter((c) => c !== id)
    : [...current, id];
}
