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
import { useApiFetcher } from '../../../useRequest';
import { accountsKeys } from '../../accounts/query-keys';
import { cashflowAccountsKeys } from '../../cashflow-accounts/query-keys';
import type {
  WiseConnectBody,
  WiseConnectResponse,
  WiseProfile,
  WiseStatusResponse,
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
 * Enqueues a Wise transactions sync.
 */
export function useWiseSync(props?: UseMutationOptions<void, Error, void>) {
  const fetcher = useApiFetcher();
  const invalidate = useInvalidateWiseQueries();

  return useMutation({
    ...props,
    mutationFn: () => fetchWiseSync(fetcher),
    onSuccess: (...args) => {
      invalidate();
      props?.onSuccess?.(...args);
    },
  });
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
