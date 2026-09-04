import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[4px] border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[.08em] whitespace-nowrap transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream focus-visible:outline-none has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-no aria-invalid:ring-no/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-ink-fill bg-ink-fill text-white [a]:hover:bg-ink-fill-soft",
        secondary:
          "border-hairline-2 bg-sheet text-ash [a]:hover:border-ink [a]:hover:text-ink",
        destructive: "border-no/30 bg-no/10 text-no [a]:hover:bg-no/20",
        success: "border-yes/30 bg-yes/15 text-ink [a]:hover:bg-yes/25",
        outline:
          "border-hairline text-ink [a]:hover:border-ink [a]:hover:text-ink",
        ghost: "text-ash [a]:hover:text-ink",
        link: "text-inkblue underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
