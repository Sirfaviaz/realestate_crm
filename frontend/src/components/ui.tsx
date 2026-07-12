"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 min-h-12 px-4 text-base active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400",
        outline: "border-2 border-slate-200 bg-white hover:bg-slate-50 focus-visible:ring-slate-400",
        ghost: "hover:bg-slate-100 focus-visible:ring-slate-400",
        danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
      },
      size: {
        default: "min-h-12 px-4",
        sm: "min-h-10 px-3 text-sm rounded-lg",
        lg: "min-h-14 px-6 text-lg rounded-2xl",
        icon: "h-12 w-12 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex min-h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-base placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <select
      required={required}
      className={cn(
        "flex min-h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-base focus:border-emerald-500 focus:outline-none",
        className
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800", className)}>
      {children}
    </span>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("sticky top-0 z-10 bg-slate-50 pb-3 pt-1", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="text-lg"
      />
    </div>
  );
}

export function ListItem({
  title,
  subtitle,
  onClick,
  active,
  right,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  active?: boolean;
  right?: React.ReactNode;
}) {
  const className = cn(
    "flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-colors min-h-[72px]",
    active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"
  );
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="truncate text-sm text-slate-500">{subtitle}</div>}
      </div>
      {right}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm font-medium text-emerald-600">
        Step {step} of {total}
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-slate-500">{message}</p>;
}
