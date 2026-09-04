import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "num h-9 w-full min-w-0 rounded-[4px] border border-hairline bg-cream px-3 py-1 text-[15px] transition-colors duration-150 ease-[cubic-bezier(.22,.61,.36,1)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground placeholder:text-ash focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-no aria-invalid:ring-2 aria-invalid:ring-no/20 md:text-[13px]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
