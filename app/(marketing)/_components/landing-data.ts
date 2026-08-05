import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  IndianRupee,
  LineChart,
  MessageCircle,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Store,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

// NOTE: placeholder contact details — replace before going live.
export const CONTACT = {
  email: "hello@example.com",
  whatsapp: "918178362985",
  whatsappDisplay: "+91 81783 62985",
} as const;

export const demoMailto = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
  "Demo request — GymOS",
)}&body=${encodeURIComponent(
  "Hi, I run a gym and would like a demo of GymOS.\n\nGym name:\nCity:\nApprox. members:\n",
)}`;

export const demoWhatsapp = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(
  "Hi, I'd like a demo of GymOS for my gym.",
)}`;

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
] as const;

export type Problem = { icon: LucideIcon; title: string; body: string };
export const PROBLEMS: ReadonlyArray<Problem> = [
  {
    icon: CalendarClock,
    title: "Missed renewals",
    body: "Expired memberships go unnoticed for weeks. Every one is recurring revenue you have already lost.",
  },
  {
    icon: ShieldCheck,
    title: "A register you can't trust",
    body: "Paper and Excel have no history. You can't tell who changed what, or recover a record once it's gone.",
  },
  {
    icon: UserX,
    title: "Members who quietly leave",
    body: "Without renewal tracking, lapsed members disappear silently — with no list to win them back.",
  },
];

export type Pillar = {
  step: string;
  icon: LucideIcon;
  title: string;
  body: string;
};
export const PILLARS: ReadonlyArray<Pillar> = [
  {
    step: "01",
    icon: UserPlus,
    title: "Enroll and collect",
    body: "Add a member and record payment in under 30 seconds. Cash, UPI, card, or bank transfer — each generates a numbered, GST-ready invoice automatically.",
  },
  {
    step: "02",
    icon: BellRing,
    title: "Track renewals and remind",
    body: "GymOS tracks every expiry date and surfaces members 14, 7, and 3 days out, with a one-tap WhatsApp reminder for each.",
  },
  {
    step: "03",
    icon: LineChart,
    title: "Report and recover",
    body: "See where revenue comes from, catch discount leakage, and turn lapsed members into an actionable win-back list.",
  },
];

export type Metric = {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
};
export const SHOWCASE_METRICS: ReadonlyArray<Metric> = [
  { label: "Collected today", value: "₹18,400", delta: "+12%", positive: true },
  { label: "New enrolments", value: "6", delta: "+2", positive: true },
  { label: "Expiring in 14 days", value: "23", delta: "Action", positive: false },
  { label: "Frozen now", value: "4", delta: "2 resume soon", positive: true },
];

export type ExpiringRow = {
  name: string;
  plan: string;
  expires: string;
  tone: "danger" | "warn";
};
export const EXPIRING_ROWS: ReadonlyArray<ExpiringRow> = [
  { name: "Rohan Mehta", plan: "Gym + Cardio", expires: "in 3 days", tone: "danger" },
  { name: "Aisha Khan", plan: "Cardio", expires: "in 7 days", tone: "warn" },
  { name: "Vikram Rao", plan: "Gym", expires: "in 11 days", tone: "warn" },
  { name: "Neha Gupta", plan: "Gym + Cardio", expires: "in 12 days", tone: "warn" },
  { name: "Arjun Singh", plan: "Gym", expires: "in 13 days", tone: "warn" },
  { name: "Meera Nair", plan: "Cardio", expires: "in 14 days", tone: "warn" },
];

export type IndiaTag = { icon: LucideIcon; label: string };
export const INDIA_TAGS: ReadonlyArray<IndiaTag> = [
  { icon: IndianRupee, label: "Rupee-accurate accounting (paise-level)" },
  { icon: Receipt, label: "GST-ready numbered invoices" },
  { icon: MessageCircle, label: "WhatsApp renewal reminders" },
  { icon: Store, label: "Multi-branch support" },
  { icon: UserCog, label: "Owner / Manager / Receptionist roles" },
  { icon: FileSpreadsheet, label: "CSV import from your existing Excel" },
  { icon: RefreshCw, label: "Runs on any front-desk laptop" },
  { icon: Users, label: "Built for independent gyms & small chains" },
];

export type RoleCard = {
  icon: LucideIcon;
  role: string;
  body: string;
};
export const ROLES: ReadonlyArray<RoleCard> = [
  {
    icon: LineChart,
    role: "Owner",
    body: "Full revenue, outstanding payments, and where money leaks.",
  },
  {
    icon: Store,
    role: "Manager",
    body: "Their branch only, without owner-level financials.",
  },
  {
    icon: CreditCard,
    role: "Receptionist",
    body: "Fast enrolments and payments. Cannot view total revenue or delete members. Every action is logged.",
  },
];

export type PricingTier = {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  featured: boolean;
  features: ReadonlyArray<string>;
};
export const PRICING: ReadonlyArray<PricingTier> = [
  {
    name: "Basic",
    price: "₹3,500",
    cadence: "/month",
    tagline: "Everything to run the front desk.",
    featured: false,
    features: [
      "Members, plans, and payments",
      "Automatic renewal tracking",
      "Reports & anomaly alerts",
      "Manual WhatsApp (click-to-send)",
      "CSV import & Excel exports",
    ],
  },
  {
    name: "Pro",
    price: "₹7,500",
    cadence: "/month",
    tagline: "Automate reminders and win-back.",
    featured: true,
    features: [
      "Everything in Basic",
      "Automated WhatsApp reminders with payment links",
      "Digital invoices sent to WhatsApp",
      "Lapsed-member win-back campaigns",
      "Priority support",
    ],
  },
];
