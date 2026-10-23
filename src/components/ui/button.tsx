import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Matches the current n8n Storybook Button contract. Keep every portal action
// on this shared primitive instead of defining page-specific button skins.
const buttonVariants = cva("portal-button", {
  variants: {
    variant: {
      default: "portal-button--solid",
      destructive: "portal-button--destructive",
      outline: "portal-button--outline",
      secondary: "portal-button--outline",
      ghost: "portal-button--ghost",
      link: "portal-button--link",
    },
    size: {
      default: "portal-button--medium",
      sm: "portal-button--medium",
      large: "portal-button--large",
      lg: "portal-button--xlarge",
      icon: "portal-button--medium portal-button--icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
