import {
  Button,
  DialogBody,
  DialogFooter,
  Intent,
  Spinner,
} from '@blueprintjs/core';
import styled from 'styled-components';
import { AppToaster } from '@/components';
import { useDialogContext } from '@/components/Dialog/DialogProvider';
import { useWiseConnect, useWiseStatus } from '@/hooks/query/banking';
import { useDialogActions } from '@/hooks/state';

/**
 * Connect Wise dialog content. Renders the four integration states:
 * not-configured (env missing), not-connected, connected and error.
 */
export function ConnectWiseDialogContent() {
  const { name } = useDialogContext();
  const { closeDialog } = useDialogActions();

  const { data: status, isLoading } = useWiseStatus();
  const { mutateAsync: connectWise, isPending: isConnecting } =
    useWiseConnect();

  // Handle cancel button click.
  const handleCancelBtnClick = () => {
    closeDialog(name);
  };
  // Handle connect button click.
  const handleConnectBtnClick = () => {
    connectWise({})
      .then(() => {
        AppToaster.show({
          message: 'The Wise profile has been connected.',
          intent: Intent.SUCCESS,
        });
        closeDialog(name);
      })
      .catch((error) => {
        const isConflict =
          error?.status === 409 || error?.response?.status === 409;

        AppToaster.show({
          message: isConflict
            ? 'This Wise profile is already connected by another organization.'
            : 'Something went wrong.',
          intent: Intent.DANGER,
        });
      });
  };

  if (isLoading) {
    return (
      <DialogBody>
        <Spinner size={24} />
      </DialogBody>
    );
  }
  // The integration is not configured on the deployment (env token missing).
  if (!status?.configured) {
    return (
      <>
        <DialogBody>
          <Description>
            Wise bank feeds are not configured on this deployment. An
            administrator needs to set a read-only Wise API token
            (WISE_API_TOKEN) on the server first.
          </Description>
        </DialogBody>
        <DialogFooter
          actions={<Button onClick={handleCancelBtnClick}>Close</Button>}
        />
      </>
    );
  }
  // The tenant is already connected to a Wise profile.
  if (status?.connected) {
    return (
      <>
        <DialogBody>
          <Description>
            Connected to the Wise profile <strong>#{status.profileId}</strong>.
            {status.lastSyncedAt && (
              <>
                {' '}
                Last synced at {new Date(status.lastSyncedAt).toLocaleString()}.
              </>
            )}
          </Description>
          <WiseBalanceList balances={status.balances} />
        </DialogBody>
        <DialogFooter
          actions={<Button onClick={handleCancelBtnClick}>Close</Button>}
        />
      </>
    );
  }
  // The Wise profile could not be resolved or the API errored.
  if (!status?.profileId) {
    return (
      <>
        <DialogBody>
          <Description>
            Cannot resolve a Wise profile. Set WISE_PROFILE_ID on the server, or
            make sure the API token has access to exactly one profile.
          </Description>
        </DialogBody>
        <DialogFooter
          actions={<Button onClick={handleCancelBtnClick}>Close</Button>}
        />
      </>
    );
  }
  // Ready to connect: show the resolved profile and the balances to import.
  return (
    <>
      <DialogBody>
        <Description>
          The following Wise balances of profile{' '}
          <strong>#{status.profileId}</strong> will be imported as bank
          accounts, and their transactions will sync every 6 hours:
        </Description>
        <WiseBalanceList balances={status.balances} />
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={handleCancelBtnClick}>Cancel</Button>
            <Button
              intent={Intent.PRIMARY}
              onClick={handleConnectBtnClick}
              loading={isConnecting}
              data-testId={'wise-connect-confirm'}
            >
              Connect Wise
            </Button>
          </>
        }
      />
    </>
  );
}

function WiseBalanceList({
  balances,
}: {
  balances: {
    id: number;
    currency: string;
    name?: string;
    type: string;
    amount: { value: number; currency: string };
  }[];
}) {
  if (!balances?.length) {
    return <Description>No syncable balances found.</Description>;
  }
  return (
    <BalancesList>
      {balances.map((balance) => (
        <BalancesListItem key={balance.id}>
          <strong>{balance.currency}</strong>
          {balance.type === 'SAVINGS' && balance.name
            ? ` — ${balance.name}`
            : ''}
          <BalanceAmount>
            {balance.amount.value.toFixed(2)} {balance.amount.currency}
          </BalanceAmount>
        </BalancesListItem>
      ))}
    </BalancesList>
  );
}

const Description = styled('p')`
  color: var(--color-text-secondary, #5f6b7c);
`;

const BalancesList = styled('ul')`
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
`;

const BalancesListItem = styled('li')`
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border, #e1e8ed);
`;

const BalanceAmount = styled('span')`
  margin-left: auto;
  color: var(--color-text-secondary, #5f6b7c);
`;
