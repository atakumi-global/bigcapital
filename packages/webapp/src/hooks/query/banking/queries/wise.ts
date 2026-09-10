import {
  fetchWiseConnect,
  fetchWiseDisconnect,
  fetchWisePause,
  fetchWiseProfiles,
  fetchWiseResume,
  fetchWiseStatus,
  fetchWiseSync,
} from '@bigcapital/sdk-ts';
import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useApiFetcher } from '../../../useRequest';
import { accountsKeys } from '../../accounts/query-keys';
import { cashflowAccountsKeys } from '../../cashflow-accounts/query-keys';
import type {
  WiseConnectBody,
  WiseConnectResponse,
  WiseProfile,
  WiseStatusResponse,
  WiseSyncBody,
} from '@bigcapital/sdk-ts';

// Query key constants for the Wise integration.
export const WISE_STATUS = 'WISE_STATUS';
export const WISE_PROFILES = 'WISE_PROFILES';

export const wiseKeys = {
  status: () => [WISE_STATUS] as const,
  profiles: () => [WISE_PROFILES] as const,
};

/**
 * Invalidates the queries affected by a Wise connection/sync change.
 */
function useInvalidateWiseQueries() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: wiseKeys.status() });
    queryClient.invalidateQueries({ queryKey: cashflowAccountsKeys.all() });
    queryClient.invalidateQueries({ queryKey: accountsKeys.all() });
  };
}

/**
 * Retrieves the Wise integration status (configured/connected/profile/paused).
 */
export function useWiseStatus(
  props?: Omit<
    UseQueryOptions<WiseStatusResponse, Error, WiseStatusResponse>,
    'queryKey' | 'queryFn'
  >,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useQuery<WiseStatusResponse, Error, WiseStatusResponse>({
    ...props,
    queryKey: wiseKeys.status(),
    queryFn: () => fetchWiseStatus(fetcher),
  });
}

/**
 * Retrieves the Wise profiles visible to the configured token.
 */
export function useWiseProfiles(
  props?: Omit<
    UseQueryOptions<WiseProfile[], Error, WiseProfile[]>,
    'queryKey' | 'queryFn'
  >,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useQuery<WiseProfile[], Error, WiseProfile[]>({
    ...props,
    queryKey: wiseKeys.profiles(),
    queryFn: () => fetchWiseProfiles(fetcher),
  });
}

/**
 * Connects the tenant to a Wise profile.
 */
export function useWiseConnect(
  props?: UseMutationOptions<WiseConnectResponse, Error, WiseConnectBody>,
) {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateWiseQueries();

  return useMutation({
    ...props,
    mutationFn: (data: WiseConnectBody) => fetchWiseConnect(fetcher, data),
    onSuccess: (...args) => {
      invalidate();
      props?.onSuccess?.(...args);
    },
  });
}

/**
 * Enqueues a Wise transactions sync. Pass `syncStartDate` to reset the
 * cursor and re-import from that date.
 */
export function useWiseSync(
  props?: UseMutationOptions<void, Error, WiseSyncBody>,
) {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateWiseQueries();

  return useMutation({
    ...props,
    mutationFn: (data: WiseSyncBody) => fetchWiseSync(fetcher, data),
    onSuccess: (...args) => {
      invalidate();
      props?.onSuccess?.(...args);
    },
  });
}

/**
 * Enqueues a Wise sync and waits for it to land: polls the status until
 * `lastSyncedAt` advances (or the timeout hits), instead of fire-and-forget.
 * Returns `{ syncAndWait, isWaiting, ...mutation }` — `syncAndWait` resolves
 * `true` when the sync landed and `false` on timeout.
 */
export function useWiseSyncAndWait(
  props?: UseMutationOptions<void, Error, WiseSyncBody>,
) {
  const queryClient = useQueryClient();
  const syncMutation = useWiseSync(props);

  const [isWaiting, setIsWaiting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const POLL_INTERVAL_MS = 4000;
  const WAIT_TIMEOUT_MS = 3 * 60 * 1000;

  const stopWaiting = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    setIsWaiting(false);
  };
  // Cleanup on unmount.
  useEffect(() => stopWaiting, []);

  const syncAndWait = (data: WiseSyncBody): Promise<boolean> => {
    const prevLastSyncedAt = (
      queryClient.getQueryData(wiseKeys.status()) as
        | WiseStatusResponse
        | undefined
    )?.lastSyncedAt;

    return new Promise<boolean>((resolve, reject) => {
      syncMutation
        .mutateAsync(data)
        .then(() => {
          setIsWaiting(true);

          intervalRef.current = setInterval(async () => {
            // Await the refetch so the cache holds the fresh status.
            await queryClient.refetchQueries({ queryKey: wiseKeys.status() });

            const lastSyncedAt = (
              queryClient.getQueryData(wiseKeys.status()) as
                | WiseStatusResponse
                | undefined
            )?.lastSyncedAt;

            if (lastSyncedAt && lastSyncedAt !== prevLastSyncedAt) {
              stopWaiting();
              queryClient.invalidateQueries({
                queryKey: cashflowAccountsKeys.all(),
              });
              queryClient.invalidateQueries({ queryKey: accountsKeys.all() });
              resolve(true);
            }
          }, POLL_INTERVAL_MS);

          timeoutRef.current = setTimeout(() => {
            stopWaiting();
            resolve(false);
          }, WAIT_TIMEOUT_MS);
        })
        .catch(reject);
    });
  };

  return {
    ...syncMutation,
    syncAndWait,
    isWaiting,
    isSyncingOrWaiting: syncMutation.isPending || isWaiting,
  };
}

/**
 * Pauses the Wise feed sync.
 */
export function useWisePause(props?: UseMutationOptions<void, Error, void>) {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateWiseQueries();

  return useMutation({
    ...props,
    mutationFn: () => fetchWisePause(fetcher),
    onSuccess: (...args) => {
      invalidate();
      props?.onSuccess?.(...args);
    },
  });
}

/**
 * Resumes the Wise feed sync.
 */
export function useWiseResume(props?: UseMutationOptions<void, Error, void>) {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateWiseQueries();

  return useMutation({
    ...props,
    mutationFn: () => fetchWiseResume(fetcher),
    onSuccess: (...args) => {
      invalidate();
      props?.onSuccess?.(...args);
    },
  });
}

/**
 * Disconnects the Wise profile.
 */
export function useWiseDisconnect(
  props?: UseMutationOptions<void, Error, void>,
) {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateWiseQueries();

  return useMutation({
    ...props,
    mutationFn: () => fetchWiseDisconnect(fetcher),
    onSuccess: (...args) => {
      invalidate();
      props?.onSuccess?.(...args);
    },
  });
}
