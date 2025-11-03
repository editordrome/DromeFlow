import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeCallbacks<T = any> {
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (record: T) => void;
}

export interface UseRealtimeSubscriptionOptions<T = any> {
  table: string;
  filter?: (record: T) => boolean;
  callbacks: RealtimeCallbacks<T>;
  enabled?: boolean; // Permite desabilitar subscription temporariamente
}

/**
 * Hook customizado para subscription Supabase Realtime
 * 
 * @example
 * useRealtimeSubscription({
 *   table: 'pos_vendas',
 *   filter: (record) => record.unit_id === selectedUnit.id,
 *   callbacks: {
 *     onInsert: (newRecord) => setRecords(prev => [...prev, newRecord]),
 *     onUpdate: (updated) => setRecords(prev => prev.map(r => r.id === updated.id ? updated : r)),
 *     onDelete: (deleted) => setRecords(prev => prev.filter(r => r.id !== deleted.id))
 *   }
 * });
 */
export function useRealtimeSubscription<T = any>(
  options: UseRealtimeSubscriptionOptions<T>
) {
  const { table, filter, callbacks, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log(`[Realtime] Subscription desabilitada para tabela: ${table}`);
      return;
    }

    console.log(`[Realtime] Iniciando subscription na tabela: ${table}`);

    // Criar canal único baseado no nome da tabela
    const channelName = `realtime:${table}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: table
        },
        (payload) => {
          const newRecord = payload.new as T;
          console.log(`[Realtime] INSERT em ${table}:`, newRecord);
          
          // Aplicar filtro se fornecido
          if (filter && !filter(newRecord)) {
            console.log(`[Realtime] Registro INSERT ignorado por filtro`);
            return;
          }
          
          callbacks.onInsert?.(newRecord);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: table
        },
        (payload) => {
          const updatedRecord = payload.new as T;
          console.log(`[Realtime] UPDATE em ${table}:`, updatedRecord);
          
          // Aplicar filtro se fornecido
          if (filter && !filter(updatedRecord)) {
            console.log(`[Realtime] Registro UPDATE ignorado por filtro`);
            return;
          }
          
          callbacks.onUpdate?.(updatedRecord);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: table
        },
        (payload) => {
          const deletedRecord = payload.old as T;
          console.log(`[Realtime] DELETE em ${table}:`, deletedRecord);
          
          // Para DELETE, não aplicamos filtro pois queremos sempre remover
          callbacks.onDelete?.(deletedRecord);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status da subscription em ${table}:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ✅ Conectado com sucesso à tabela: ${table}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] ❌ Erro ao conectar na tabela: ${table}`);
        } else if (status === 'TIMED_OUT') {
          console.error(`[Realtime] ⏱️ Timeout ao conectar na tabela: ${table}`);
        } else if (status === 'CLOSED') {
          console.log(`[Realtime] 🔌 Conexão fechada na tabela: ${table}`);
        }
      });

    channelRef.current = channel;

    // Cleanup: remover subscription ao desmontar
    return () => {
      console.log(`[Realtime] Removendo subscription da tabela: ${table}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, enabled, filter, callbacks]);

  return {
    isConnected: channelRef.current?.state === 'joined'
  };
}
