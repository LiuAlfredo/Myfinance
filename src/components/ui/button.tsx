import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      primary: "bg-[var(--accent)] px-4 py-2.5 text-white shadow-sm hover:bg-[var(--accent-strong)] hover:shadow-md active:scale-[0.98]",
      secondary: "bg-[var(--surface-muted)] px-4 py-2.5 text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.98]",
      ghost: "px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
      outline: "border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[var(--text)] hover:bg-[var(--surface-muted)]",
    },
    size: {
      default: "text-sm",
      sm: "px-3 py-2 text-xs",
      icon: "size-9 p-0",
    },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
