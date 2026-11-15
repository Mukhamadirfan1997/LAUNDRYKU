import { WashingMachine } from "lucide-react";

import { cn } from "@/lib/utils";

interface LogoProps {
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}

const iconSizes = {
  sm: "size-8 rounded-lg",
  md: "size-10 rounded-xl",
  lg: "size-14 rounded-2xl",
};

const glyphSizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

/** Placeholder logo LaundryKu — mudah diganti dengan gambar/logo resmi nanti. */
export function Logo({
  collapsed = false,
  size = "md",
  showTagline = false,
  className,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center bg-gradient-to-br from-cyan-500 via-cyan-600 to-teal-700 text-white shadow-md shadow-cyan-600/20 ring-1 ring-inset ring-white/25",
          iconSizes[size],
        )}
        aria-hidden="true"
      >
        <WashingMachine className={cn(glyphSizes[size], "drop-shadow-sm")} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-sidebar" />
      </div>

      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight tracking-tight text-foreground">
            Laundry<span className="text-primary">Ku</span>
          </p>
          {showTagline ? (
            <p className="truncate text-[10px] leading-tight text-muted-foreground">
              Kelola laundry, catat kas
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
