"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

type RangeSliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value: [number, number]
  onValueChange?: (next: [number, number]) => void
}

const RangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RangeSliderProps
>(({ className, value, onValueChange, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    value={value}
    onValueChange={(next) => onValueChange?.([next[0] ?? 0, next[1] ?? 0])}
    minStepsBetweenThumbs={0}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[#1f2230]">
      <SliderPrimitive.Range className="absolute h-full bg-[#ff2f5f]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label="Lower bound"
      className="block h-4 w-4 rounded-full border-2 border-[#ff2f5f] bg-[#0c0d12] ring-offset-[#0c0d12] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2f5f]/60 disabled:pointer-events-none disabled:opacity-50"
    />
    <SliderPrimitive.Thumb
      aria-label="Upper bound"
      className="block h-4 w-4 rounded-full border-2 border-[#ff2f5f] bg-[#0c0d12] ring-offset-[#0c0d12] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2f5f]/60 disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
))
RangeSlider.displayName = "RangeSlider"

export { RangeSlider }
