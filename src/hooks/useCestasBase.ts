import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { CACHE_KEYS } from '../lib/constants/queryKeys';
import { CestaBaseService, CreateCestaBaseData } from '../services/cestaBaseService';

export const useCestasBase = (adminId?: string) => {
  return useQuery({
    queryKey: [CACHE_KEYS.CESTAS_BASE, adminId],
    queryFn: () => CestaBaseService.listar(adminId!),
    enabled: !!adminId,
  });
};

export const useCreateCestaBase = () => {
  const queryClient = useQueryClient();
  const { adminId, user } = useAuth();
  const id = adminId || user?.id;

  return useMutation({
    mutationFn: (dados: CreateCestaBaseData) => CestaBaseService.criar(id!, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS_BASE] });
    },
  });
};

export const useUpdateCestaBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<CreateCestaBaseData> }) =>
      CestaBaseService.atualizar(id, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS_BASE] });
    },
  });
};

export const useDeleteCestaBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CestaBaseService.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS_BASE] });
    },
  });
};

export const useCestaBaseDetalhes = (id: string, options?: { enabled?: boolean }) => {
  const { adminId, user } = useAuth();
  const targetId = adminId || user?.id;
  return useQuery({
    queryKey: [CACHE_KEYS.CESTAS_BASE, 'detalhes', id],
    queryFn: async () => {
      const data = await CestaBaseService.listar(targetId!);
      return data.find(c => c.id === id) || null;
    },
    enabled: options?.enabled && !!id && !!targetId,
  });
};

export const useDistribuirCestaBase = () => {
  const queryClient = useQueryClient();
  const { adminId, user } = useAuth();
  const id = adminId || user?.id;

  return useMutation({
    mutationFn: ({ cestaBaseId, vendedorId }: { cestaBaseId: string; vendedorId: string }) =>
      CestaBaseService.distribuirParaVendedor(cestaBaseId, vendedorId, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS_BASE] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CESTAS] });
      queryClient.invalidateQueries({ queryKey: ['estoque_vendedor'] });
    },
  });
};
