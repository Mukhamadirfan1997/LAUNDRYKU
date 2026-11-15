import { Badge } from "@/components/ui/badge";

interface ActiveBadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function ActiveBadge({
  active,
  activeLabel = "Aktif",
  inactiveLabel = "Nonaktif",
}: ActiveBadgeProps) {
  return (
    <Badge variant={active ? "success" : "secondary"}>
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
