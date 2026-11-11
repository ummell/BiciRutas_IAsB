import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const useEscenarios = () => useQuery({ queryKey: ["escenarios"], queryFn: api.escenarios });

export const useRed = (id: string) =>
  useQuery({ queryKey: ["red", id], queryFn: () => api.red(id), staleTime: Infinity });

export const useEstadoTramos = (id: string, hora: string) =>
  useQuery({
    queryKey: ["estado", id, hora],
    queryFn: () => api.estadoTramos(id, hora),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

export const useLote = (id: string, peso: number, enabled = true) =>
  useQuery({
    queryKey: ["lote", id, peso],
    queryFn: () => api.lote(id, peso),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
