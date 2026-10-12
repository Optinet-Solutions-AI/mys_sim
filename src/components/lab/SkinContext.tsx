"use client";
import { createContext, useContext, type ReactNode } from "react";
import { SKINS, type Skin } from "@/lib/skins";

const SkinCtx = createContext<Skin>(SKINS.vendor);

export function SkinProvider({ skin, children }: { skin: Skin; children: ReactNode }) {
  return <SkinCtx.Provider value={skin}>{children}</SkinCtx.Provider>;
}

export function useSkin(): Skin {
  return useContext(SkinCtx);
}

export function cta(template: string, price: string): string {
  return template.replace("{price}", price);
}
