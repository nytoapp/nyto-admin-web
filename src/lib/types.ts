export type UserRole = "USER" | "VENUE_STAFF" | "ADMIN";

/** Frontend-first; backend will persist later. */
export type HostedBy = "NYTO" | "PARTNER";

export type AdminUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  fullName?: string;
  role?: UserRole;
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  city: string;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Who organises nights — NYTO curated or partner venue. Frontend-first. */
  hostedBy?: HostedBy | string | null;
  _count?: { tables: number; staff: number; menus: number };
};

export type VenueMenu = {
  id: string;
  venueId: string;
  name: string;
  description?: string | null;
  dietaryType: "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";
  costPerHead: number;
  createdAt: string;
};

export type TableStatus =
  | "OPEN"
  | "MATCHING"
  | "AWAITING_REVIEW"
  | "APPROVED"
  | "REVEALED"
  | "COMPLETED"
  | "CANCELLED";

export type NytoTableType = "WEEKLY" | "WOMEN_LED" | "COUPLES" | "SINGLES";
export type TablePaymentType = "ALL_INCLUSIVE" | "PAY_OWN_BILL";
export type PriceTier = "DAYTIME" | "EVENING";

export type AdminTable = {
  id: string;
  venueId: string;
  menuId?: string | null;
  startsAt: string;
  bookingOpensAt: string;
  priceTier: PriceTier;
  seatPrice: number;
  capacity: number;
  tableType: NytoTableType;
  paymentType: TablePaymentType;
  vibeCopy?: string | null;
  inclusions: string[];
  status: TableStatus;
  /** Who runs this night. Missing → treated as NYTO curated. */
  hostedBy?: HostedBy | string | null;
  seatsTaken?: number;
  seatsLeft?: number;
  menu?: VenueMenu | null;
};

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW"
  | string;

export type AdminBooking = {
  id: string;
  status: BookingStatus;
  seatsBooked: number;
  createdAt: string;
  amountPaid?: number | null;
  checkInCode?: string | null;
  bookingType?: string | null;
  cancelReason?: string | null;
  user?: {
    id: string;
    firstName?: string | null;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  table?: AdminTable & {
    venue?: Pick<Venue, "id" | "name" | "city" | "area" | "hostedBy">;
  };
  payment?: {
    id: string;
    status: string;
    amountInr?: number;
    amount?: number;
    method?: string | null;
    providerRef?: string | null;
  } | null;
};

export type AdminPayment = {
  id: string;
  status: string;
  amountInr?: number;
  amount?: number;
  method?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  bookingId?: string;
  createdAt: string;
  booking?: AdminBooking | null;
};

export type ApiErrorBody = {
  ok?: false;
  error?: string;
  message?: string;
};
