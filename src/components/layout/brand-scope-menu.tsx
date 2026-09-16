"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brands, getBrand } from "@/data/brands";
import { useBrandScope } from "@/hooks/use-scope";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BrandScopeMenu() {
  const { brandId, setBrandId } = useBrandScope();
  const scoped = brandId === "all" ? null : getBrand(brandId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2" aria-label="Scope workspace to a brand">
          {scoped ? (
            <Image
              src={scoped.logoSrc}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-xs"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center rounded-xs bg-ink text-[9px] font-medium text-canvas"
            >
              3
            </span>
          )}
          <span className="hidden max-w-32 truncate sm:inline">
            {scoped ? scoped.name : "All brands"}
          </span>
          <ChevronsUpDown className="size-3.5 text-ink-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>Workspace scope</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setBrandId("all")}>
          <span className="flex size-4 items-center justify-center rounded-xs bg-ink text-[9px] font-medium text-canvas">
            OS
          </span>
          <span className="flex flex-col">
            <span>All brands</span>
            <span className="text-[11px] text-ink-3 tnum">
              {formatCompact(
                brands.reduce((total, brand) => total + brand.followers, 0),
              )}{" "}
              followers
            </span>
          </span>
          <Check
            className={cn(
              "ml-auto size-4",
              brandId === "all" ? "opacity-100" : "opacity-0",
            )}
          />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {brands.map((brand) => (
          <DropdownMenuItem key={brand.id} onSelect={() => setBrandId(brand.id)}>
            <Image
              src={brand.logoSrc}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-xs"
            />
            <span className="flex flex-col">
              <span>{brand.name}</span>
              <span className="text-[11px] text-ink-3 tnum">
                {formatCompact(brand.followers)} followers · {brand.handle}
              </span>
            </span>
            <Check
              className={cn(
                "ml-auto size-4",
                brandId === brand.id ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
