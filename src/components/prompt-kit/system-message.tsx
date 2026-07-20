"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, AlertTriangle, Info } from "lucide-react"
import React from "react"

const systemMessageVariants = cva(
  "flex flex-row items-center gap-3 rounded-[12px] border py-2 pr-2 pl-3 text-sm",
  {
    variants: {
      variant: {
        action: "text-zinc-700 dark:text-zinc-300",
        error: "text-red-700 dark:text-red-400",
        warning: "text-amber-700 dark:text-amber-500",
      },
      fill: {
        true: "bg-background",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "action",
        fill: true,
        class: "bg-zinc-100 dark:bg-zinc-900 border-transparent",
      },
      {
        variant: "error",
        fill: true,
        class: "bg-red-100 dark:bg-red-900/20 border-transparent",
      },
      {
        variant: "warning",
        fill: true,
        class: "bg-amber-100 dark:bg-amber-900/20 border-transparent",
      },
      {
        variant: "action",
        fill: false,
        class: "border-zinc-200 dark:border-zinc-800",
      },
      {
        variant: "error",
        fill: false,
        class: "border-red-600 dark:border-red-900",
      },
      {
        variant: "warning",
        fill: false,
        class: "border-amber-600 dark:border-amber-900",
      },
    ],
    defaultVariants: {
      variant: "action",
      fill: false,
    },
  }
)

type CTAConfig = {
  label: string
  onClick?: () => void
  variant?: "solid" | "outline" | "ghost"
}

export type SystemMessageProps = React.ComponentProps<"div"> &
  VariantProps<typeof systemMessageVariants> & {
    icon?: React.ReactNode
    isIconHidden?: boolean
    cta?: CTAConfig
  }

export function SystemMessage({
  children,
  variant = "action",
  fill = false,
  icon,
  isIconHidden = false,
  cta,
  className,
  ...props
}: SystemMessageProps) {
  const getDefaultIcon = () => {
    if (isIconHidden) return null

    switch (variant) {
      case "error":
        return <AlertCircle className="h-4 w-4 shrink-0" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 shrink-0" />
      default:
        return <Info className="h-4 w-4 shrink-0" />
    }
  }

  const iconToShow = isIconHidden ? null : icon ?? getDefaultIcon()

  const ctaButtonVariant =
    cta?.variant === "solid"
      ? "default"
      : cta?.variant === "ghost"
        ? "ghost"
        : "outline"

  return (
    <div
      className={cn(systemMessageVariants({ variant, fill }), className)}
      role={variant === "error" ? "alert" : "status"}
      {...props}
    >
      {iconToShow && (
        <div className="flex shrink-0 items-center justify-center">
          {iconToShow}
        </div>
      )}

      <div className="min-w-0 flex-1 leading-snug">{children}</div>

      {cta && (
        <Button
          type="button"
          size="sm"
          variant={ctaButtonVariant}
          className="h-7 shrink-0 rounded-lg px-2.5 text-xs"
          onClick={cta.onClick}
        >
          {cta.label}
        </Button>
      )}
    </div>
  )
}
