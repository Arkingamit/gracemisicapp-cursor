"use client"

import React from "react"
import type { Components } from "react-markdown"
import { ExternalLink } from "lucide-react"

type NavigateFn = (href: string) => void

/** Shared markdown overrides for Grace chat UIs (dark theme). */
export function createGraceChatMarkdownComponents(
  navigate: NavigateFn
): Partial<Components> {
  return {
    h1: ({ children }) => (
      <h1 className="my-3 text-lg font-bold text-zinc-50">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="my-3 text-base font-semibold text-zinc-100">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="my-2 text-sm font-semibold text-indigo-300">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="my-1.5 leading-relaxed text-zinc-200">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-zinc-50">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-indigo-500/60 bg-indigo-500/5 py-1 pl-4 italic text-zinc-300">
        {children}
      </blockquote>
    ),
    ul: ({ children }) => (
      <ul className="my-2 flex list-none flex-col gap-1.5 p-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 flex list-none flex-col gap-1.5 p-0 [counter-reset:item]">
        {children}
      </ol>
    ),
    a: ({ children, href }) => {
      const url = typeof href === "string" ? href : ""
      const isSong = url.includes("/songs/view")
      if (isSong) {
        return (
          <a
            href={url}
            onClick={(e) => {
              e.preventDefault()
              navigate(url)
            }}
            className="my-1 inline-flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 font-medium text-indigo-300 no-underline transition-all hover:bg-indigo-500/25"
          >
            <span className="break-words text-left leading-tight">{children}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        )
      }
      return (
        <a
          href={url}
          className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      )
    },
    li: ({ children, ...props }) => {
      const childArr = React.Children.toArray(children)
      const hasSongLink = childArr.some((child) => {
        if (!React.isValidElement(child)) return false
        const childHref = (child.props as { href?: string })?.href || ""
        return typeof childHref === "string" && childHref.includes("/songs/view")
      })

      if (hasSongLink) {
        return (
          <li className="mb-1.5 ml-0 list-none p-0" {...props}>
            {children}
          </li>
        )
      }

      return (
        <li className="my-1 flex items-start gap-2" {...props}>
          <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
          <span className="min-w-0 flex-1 text-zinc-200">{children}</span>
        </li>
      )
    },
  }
}
