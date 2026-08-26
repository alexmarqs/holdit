"use client";

import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { forgetHandle } from "@/components/panels/dilution";
import { claimedAtom, dilutedAtom, heldAtom } from "@/context/wall-atoms";

/** Drop the square this browser was watching — listing highlight and dilution. */
export function useForgetHeld() {
  const setHeld = useSetAtom(heldAtom);
  const setClaimed = useSetAtom(claimedAtom);
  const setDiluted = useSetAtom(dilutedAtom);
  return useCallback(() => {
    forgetHandle(window.localStorage);
    setHeld(null);
    setClaimed(null);
    setDiluted(null);
  }, [setHeld, setClaimed, setDiluted]);
}
