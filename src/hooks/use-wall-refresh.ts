"use client";

import type { MapState } from "@holdit/core";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { writeWallCache } from "@/lib/utils/wall-query";

const REFRESH_KEY = ["wall", "refresh"] as const;

export function useWallRefresh() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation<MapState | null, Error, boolean>({
    mutationKey: REFRESH_KEY,
    mutationFn: apiClient.tryFetchWall,
    retry: false,
    onSuccess: (wall) => {
      if (wall === null) return;
      writeWallCache(queryClient, wall);
    },
  });

  return {
    refresh: useCallback((fresh = false) => mutate(fresh), [mutate]),
    refreshing: useIsMutating({ mutationKey: REFRESH_KEY }) > 0,
  };
}
