import { type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Help({ label, children }: { label: string; children: ReactNode }) {
  return <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={label}><Info className="size-3.5" /></Button></PopoverTrigger><PopoverContent className="text-sm leading-relaxed">{children}</PopoverContent></Popover>;
}
