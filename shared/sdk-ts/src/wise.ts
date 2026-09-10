import type { ApiFetcher } from "./fetch-utils";
import { paths } from "./schema";

export const WISE_ROUTES = {
  STATUS: "/api/banking/wise/status",
  PROFILES: "/api/banking/wise/profiles",
  CONNECT: "/api/banking/wise/connect",
  SYNC: "/api/banking/wise/sync",
  PAUSE: "/api/banking/wise/pause",
  RESUME: "/api/banking/wise/resume",
  DISCONNECT: "/api/banking/wise/disconnect",
} as const satisfies Record<string, keyof paths>;

export interface WiseProfile {
  id: number;
  type: "personal" | "business";
  details?: Record<string, unknown>;
}

export interface WiseBalance {
  id: number;
  currency: string;
  type: string;
  name?: string | null;
  visible?: boolean;
  investmentState?: string;
  amount: { value: number; currency: string };
}

export interface WiseStatusResponse {
  configured: boolean;
  connected: boolean;
  profileId: string | null;
  profile: WiseProfile | null;
  balances: WiseBalance[];
  lastSyncedAt: string | null;
  syncStartDate: string | null;
  paused: boolean;
  status: string | null;
}

export interface WiseConnectBody {
  profileId?: number;
  syncStartDate?: string;
}

export interface WiseSyncBody {
  syncStartDate?: string;
}

export interface WiseConnectResponse {
  profileId: string;
}

export async function fetchWiseStatus(
  fetcher: ApiFetcher,
): Promise<WiseStatusResponse> {
  const get = fetcher.path(WISE_ROUTES.STATUS).method("get").create();
  const { data } = await get({});
  return data as WiseStatusResponse;
}

export async function fetchWiseProfiles(
  fetcher: ApiFetcher,
): Promise<WiseProfile[]> {
  const get = fetcher.path(WISE_ROUTES.PROFILES).method("get").create();
  const { data } = await get({});
  return (data ?? []) as WiseProfile[];
}

export async function fetchWiseConnect(
  fetcher: ApiFetcher,
  body: WiseConnectBody,
): Promise<WiseConnectResponse> {
  const post = fetcher.path(WISE_ROUTES.CONNECT).method("post").create();
  const { data } = await post(body as never);
  return data as WiseConnectResponse;
}

export async function fetchWiseSync(
  fetcher: ApiFetcher,
  body?: WiseSyncBody,
): Promise<void> {
  const post = fetcher.path(WISE_ROUTES.SYNC).method('post').create();
  await post((body ?? {}) as never);
}

export async function fetchWisePause(fetcher: ApiFetcher): Promise<void> {
  const post = fetcher.path(WISE_ROUTES.PAUSE).method("post").create();
  await post({});
}

export async function fetchWiseResume(fetcher: ApiFetcher): Promise<void> {
  const post = fetcher.path(WISE_ROUTES.RESUME).method("post").create();
  await post({});
}

export async function fetchWiseDisconnect(fetcher: ApiFetcher): Promise<void> {
  const del = fetcher.path(WISE_ROUTES.DISCONNECT).method("delete").create();
  await del({});
}
