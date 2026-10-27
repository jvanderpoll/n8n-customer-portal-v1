import { forwardRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button, type ButtonProps } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Shared row/action popover used by instance menus and the download menu. */
export function ActionMenu({
  label,
  children,
  trigger,
  open,
  onOpenChange,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="icon-action"
            aria-label={label}
          >
            <MoreHorizontal size={20} />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="action-menu">
        {children}
      </PopoverContent>
    </Popover>
  );
}

type ActionMenuItemProps = Omit<ButtonProps, "variant" | "size" | "children"> & {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
};

/** Icon + label row used inside ActionMenu (Edit, Remove, export actions). */
export const ActionMenuItem = forwardRef<HTMLButtonElement, ActionMenuItemProps>(
  ({ label, icon, danger = false, className, type = "button", ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size="default"
      className={`management-menu-action ${danger ? "danger-text" : ""} ${className ?? ""}`}
      {...props}
    >
      {icon}
      {label}
    </Button>
  ),
);
ActionMenuItem.displayName = "ActionMenuItem";
