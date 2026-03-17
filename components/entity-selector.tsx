"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityOption } from "@/lib/types";
import { cn } from "@/lib/utils";

type EntitySelectorProps = {
  availableEntities: EntityOption[];
  selectedEntities: EntityOption[];
  onSelectionChange: (entities: EntityOption[]) => void;
  questionId?: string;
  className?: string;
};

export function EntitySelector({
  availableEntities,
  selectedEntities,
  onSelectionChange,
  questionId,
  className,
}: EntitySelectorProps) {
  const [localSelected, setLocalSelected] =
    useState<EntityOption[]>(selectedEntities);

  useEffect(() => {
    setLocalSelected(selectedEntities);
  }, [selectedEntities]);

  const toggleEntity = (entity: EntityOption) => {
    const isSelected = localSelected.some(
      (e) => e.kind === entity.kind && e.name === entity.name
    );

    if (isSelected) {
      setLocalSelected(
        localSelected.filter(
          (e) => !(e.kind === entity.kind && e.name === entity.name)
        )
      );
    } else {
      setLocalSelected([...localSelected, entity]);
    }
  };

  const handleApply = () => {
    onSelectionChange(localSelected);
  };

  const handleClear = () => {
    setLocalSelected([]);
    onSelectionChange([]);
  };

  if (availableEntities.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium text-sm">Select accounts to analyze</h3>
          <p className="text-muted-foreground text-xs">
            Choose one or more accounts for your finance query
          </p>
        </div>
        {localSelected.length > 0 && (
          <Button
            className="h-7 text-xs"
            onClick={handleClear}
            size="sm"
            variant="ghost"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {availableEntities.map((entity) => {
          const isSelected = localSelected.some(
            (e) => e.kind === entity.kind && e.name === entity.name
          );
          const label =
            entity.kind === "personal" ? "Personal" : entity.name || "Unknown";

          return (
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background"
              )}
              key={`${entity.kind}-${entity.name || "null"}`}
              onClick={() => toggleEntity(entity)}
              type="button"
            >
              {isSelected ? (
                <Check className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded border" />
              )}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        {localSelected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {localSelected.map((entity) => {
              const label =
                entity.kind === "personal"
                  ? "Personal"
                  : entity.name || "Unknown";
              return (
                <Badge
                  key={`${entity.kind}-${entity.name || "null"}`}
                  variant="secondary"
                >
                  {label}
                </Badge>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground text-xs">
            No accounts selected
          </div>
        )}
        <Button
          className="h-8"
          disabled={localSelected.length === 0}
          onClick={handleApply}
          size="sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
