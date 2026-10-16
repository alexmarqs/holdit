"use client";

import type { MapState } from "@holdit/core";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { WALL_QUERY_KEY } from "@/lib/utils/wall-query";

export function useWall(): MapState {
  const { data } = useQuery({
    queryKey: WALL_QUERY_KEY,
    queryFn: () => apiClient.fetchWall(false),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  if (data === undefined) throw new Error("The wall cache was not seeded.");

  return data;
}
