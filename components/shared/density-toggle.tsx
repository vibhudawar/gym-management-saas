"use client";

import { Rows3, Rows4 } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gym-app:member-density";

export type Density = "comfortable" | "dense";

function readDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  return window.localStorage.getItem(STORAGE_KEY) === "dense"
    ? "dense"
    : "comfortable";
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("density-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("density-changed", callback);
  };
}

function getServerSnapshot(): Density {
  return "comfortable";
}

export function useDensity(): [Density, (next: Density) => void] {
  const density = useSyncExternalStore(subscribe, readDensity, getServerSnapshot);
  const setDensity = useCallback((next: Density) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event("density-changed"));
  }, []);
  return [density, setDensity];
}

type DensityToggleProps = {
  density: Density;
  onChange: (next: Density) => void;
  className?: string;
};

export function DensityToggle({ density, onChange, className }: DensityToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={
        density === "comfortable" ? "Switch to dense rows" : "Switch to comfortable rows"
      }
      title={density === "comfortable" ? "Dense rows" : "Comfortable rows"}
      onClick={() => onChange(density === "comfortable" ? "dense" : "comfortable")}
      className={cn(className)}
    >
      {density === "comfortable" ? (
        <Rows3 className="size-4" />
      ) : (
        <Rows4 className="size-4" />
      )}
    </Button>
  );
}
