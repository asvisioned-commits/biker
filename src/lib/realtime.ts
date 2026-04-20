/**
 * Supabase Realtime hooks for live order tracking
 * Uses channels for order status updates and rider location
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/types';

interface OrderUpdate {
  id: string;
  status: OrderStatus;
  rider_lat?: number;
  rider_lng?: number;
  updated_at: string;
  proof_url?: string;
}

interface RiderLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

/**
 * Subscribe to real-time order status changes
 */
export function useOrderTracking(orderId: string | null) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [timeline, setTimeline] = useState<OrderUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();

    // Subscribe to order status changes via Postgres Changes
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_requests',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newData = payload.new as OrderUpdate;
          setStatus(newData.status);
          setTimeline((prev) => [...prev, newData]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_proofs',
          filter: `request_id=eq.${orderId}`,
        },
        (payload) => {
          // New proof uploaded — update timeline
          const proof = payload.new as { proof_type: string; file_url: string; created_at: string };
          setTimeline((prev) => [
            ...prev,
            {
              id: orderId,
              status: 'at_pickup' as OrderStatus,
              proof_url: proof.file_url,
              updated_at: proof.created_at,
            },
          ]);
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR') {
          setError('Failed to connect to live tracking');
        }
      });

    // Subscribe to rider location broadcasts
    const locationChannel = supabase
      .channel(`rider-location-${orderId}`)
      .on('broadcast', { event: 'location' }, (payload) => {
        setRiderLocation(payload.payload as RiderLocation);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(locationChannel);
    };
  }, [orderId]);

  return { status, riderLocation, timeline, error };
}

/**
 * Broadcast rider location (used by rider app)
 */
export function useRiderLocationBroadcast(orderId: string | null) {
  const [broadcasting, setBroadcasting] = useState(false);

  const broadcastLocation = useCallback(
    async (lat: number, lng: number, heading?: number, speed?: number) => {
      if (!orderId) return;

      const supabase = createClient();
      const channel = supabase.channel(`rider-location-${orderId}`);

      await channel.send({
        type: 'broadcast',
        event: 'location',
        payload: {
          lat,
          lng,
          heading,
          speed,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [orderId]
  );

  const startBroadcasting = useCallback(() => {
    if (!navigator.geolocation) return;

    setBroadcasting(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        broadcastLocation(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.heading ?? undefined,
          position.coords.speed ?? undefined
        );
      },
      (err) => {
        console.error('Geolocation error:', err);
        setBroadcasting(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setBroadcasting(false);
    };
  }, [broadcastLocation]);

  return { broadcasting, startBroadcasting, broadcastLocation };
}

/**
 * Subscribe to a rider's incoming job offers
 */
export function useRiderJobFeed(riderId: string | null) {
  const [newJobs, setNewJobs] = useState<OrderUpdate[]>([]);

  useEffect(() => {
    if (!riderId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`rider-jobs-${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_requests',
          filter: `assigned_rider_id=eq.${riderId}`,
        },
        (payload) => {
          const job = payload.new as OrderUpdate;
          if (job.status === 'rider_assigned') {
            setNewJobs((prev) => [job, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId]);

  const dismissJob = (jobId: string) => {
    setNewJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  return { newJobs, dismissJob };
}
