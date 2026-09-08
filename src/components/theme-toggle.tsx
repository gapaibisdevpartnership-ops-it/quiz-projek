"use client";

import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

function getSnapshot(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "dark" || t === "light" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("themechange", onChange);
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => apply(getSnapshot());
  mql.addEventListener("change", onMedia);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("themechange", onChange);
    mql.removeEventListener("change", onMedia);
  };
}

/** Cycles light → dark → system. Persists the choice in localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "system" as Theme,
  );

  function next() {
    const order: Theme[] = ["light", "dark", "system"];
    const value = order[(order.indexOf(theme) + 1) % order.length];
    try {
      if (value === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", value);
    } catch {
      /* private mode — apply for this session only */
    }
    apply(value);
    window.dispatchEvent(new Event("themechange"));
  }

  const Icon =
    theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon;
  const label =
    theme === "dark"
      ? "Dark theme"
      : theme === "light"
        ? "Light theme"
        : "System theme";

  return (
    <button
      type="button"
      onClick={next}
      title={`${label} — click to change`}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
