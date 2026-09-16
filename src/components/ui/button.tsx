import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Press feedback is a 60ms scale: enough to feel mechanical, too fast to read
  // as an animation. Disabled buttons never move.
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium outline-none select-none transition-[color,background-color,border-color,opacity,transform] duration-150 ease-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100 motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-canvas shadow-card hover:bg-ink/90 active:bg-ink/95",
        secondary:
          "border border-line bg-surface text-ink hover:bg-surface-2 active:bg-surface-3",
        subtle: "bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        success:
          "border border-success/25 bg-success-soft text-success hover:bg-success/10",
        danger:
          "border border-danger/25 bg-danger-soft text-danger hover:bg-danger/10",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-9 px-4 [&_svg]:size-4",
        lg: "h-11 px-5 text-[15px] [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
