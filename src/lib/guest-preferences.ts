/**
 * Human labels for guest-app onboarding / table-profile IDs.
 * Keep in sync with frontend/lib/features/onboarding/onboarding_data.dart
 * and table_profile_screen.dart.
 */

const INTEREST_LABELS: Record<string, string> = {
  food: "Food & flavour",
  cooking: "Cooking",
  tea_coffee: "Tea & coffee",
  wine: "Wine",
  cricket: "Cricket",
  football: "Football",
  badminton: "Badminton",
  running: "Running",
  gym: "Gym",
  yoga: "Yoga",
  film: "Film & series",
  music: "Live music",
  books: "Books",
  art: "Art",
  travel: "Travel",
  photography: "Photography",
  startups: "Startups",
  tech: "Tech",
  design: "Design",
  business: "Business",
  gaming: "Gaming",
  pets: "Pets",
  nature: "Nature",
  languages: "Languages",
  board_games: "Board games",
};

const ENERGY_LABELS: Record<string, string> = {
  introverted: "Introverted",
  ambiverted: "Ambiverted",
  extroverted: "Extroverted",
};

const STYLE_LABELS: Record<string, string> = {
  calm: "Calm",
  mixed: "A mix",
  lively: "Lively",
};

const DATING_LABELS: Record<string, string> = {
  women: "Interested in women",
  men: "Interested in men",
  open: "Open",
};

const GENDER_LABELS: Record<string, string> = {
  man: "Man",
  woman: "Woman",
  nonbinary: "Non-binary",
  skip: "Prefer not to say",
};

function titleCaseId(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function interestLabel(id: string): string {
  return INTEREST_LABELS[id] ?? titleCaseId(id);
}

export function socialEnergyLabel(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return ENERGY_LABELS[id] ?? titleCaseId(id);
}

export function conversationStyleLabel(
  id: string | null | undefined,
): string | null {
  if (!id?.trim()) return null;
  return STYLE_LABELS[id] ?? titleCaseId(id);
}

export function datingIntentLabel(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return DATING_LABELS[id] ?? titleCaseId(id);
}

export function genderLabel(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return GENDER_LABELS[id] ?? titleCaseId(id);
}

export type GuestPreferences = {
  gender?: string | null;
  dateOfBirth?: string | null;
  socialEnergy?: string | null;
  conversationStyle?: string | null;
  tableOneLiner?: string | null;
  datingIntent?: string | null;
  interests?: string[];
};

export function hasAnyGuestPreferences(p: GuestPreferences | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    (p.interests && p.interests.length > 0) ||
      p.socialEnergy ||
      p.conversationStyle ||
      p.tableOneLiner ||
      p.datingIntent ||
      p.gender ||
      p.dateOfBirth,
  );
}

export function formatGuestAge(dateOfBirth: string | null | undefined): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return `${age}`;
}
