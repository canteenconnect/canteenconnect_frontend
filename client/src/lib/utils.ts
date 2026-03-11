import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrencyINR(value: number | string) {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(amount)) return inrFormatter.format(0);
  return inrFormatter.format(amount);
}

const dayMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const orderDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function toValidDate(value: Date | string | number) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDayMonth(value: Date | string | number) {
  const date = toValidDate(value);
  return date ? dayMonthFormatter.format(date) : "--";
}

export function formatDateTimeCompact(value: Date | string | number) {
  const date = toValidDate(value);
  if (!date) return "--";
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

export function formatDateTimeWithAt(value: Date | string | number) {
  const date = toValidDate(value);
  if (!date) return "--";
  return `${orderDateFormatter.format(date)} at ${timeFormatter.format(date)}`;
}
