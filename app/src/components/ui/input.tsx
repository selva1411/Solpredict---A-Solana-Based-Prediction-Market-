import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[3px] border border-[#E2DFD7] dark:border-[#2A2F36] bg-[#FFFFFF] dark:bg-[#1A1D21] px-3 py-1 text-[13px] text-[#181A1C] dark:text-[#EAE8E3] placeholder:text-[#7F8892] dark:placeholder:text-[#68707B] transition-colors duration-150 outline-none focus-visible:border-[#1F3A52] dark:focus-visible:border-[#7A9BB5] focus-visible:ring-1 focus-visible:ring-[#1F3A52] dark:focus-visible:ring-[#7A9BB5] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
