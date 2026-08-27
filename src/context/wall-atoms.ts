"use client";

import { DEFAULT_AMOUNT_CENTS } from "@holdit/core";
import { atom } from "jotai";

export const flashAtom = atom<string | null>(null);
export const previewAtom = atom<number | null>(DEFAULT_AMOUNT_CENTS);
export const previewHandleAtom = atom<string | null>(null);
/** In-memory only: a reload puts the dashed square back. */
export const mapPreviewOnAtom = atom(true);
/** Find-a-square needle. Empty is the live wall, undimmed. */
export const mapSearchAtom = atom("");
export const awaitingAtom = atom<{ handle: string; timedOut: boolean } | null>(null);
export const claimedAtom = atom<{ handle: string; share: number } | null>(null);
export const heldAtom = atom<string | null>(null);
export const dilutedAtom = atom<{ handle: string; before: number; after: number } | null>(null);
