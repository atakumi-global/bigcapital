import { Intent, Alert } from '@blueprintjs/core';
import React from 'react';
import intl from 'react-intl-universal';
import type { WithAlertActionsProps } from '@/containers/Alert/withAlertActions';
import type { WithAlertStoreConnectProps } from '@/containers/Alert/withAlertStoreConnect';
import { AppToaster } from '@/components';
import { withAlertActions } from '@/containers/Alert/withAlertActions';
import { withAlertStoreConnect } from '@/containers/Alert/withAlertStoreConnect';
import { useWiseDisconnect } from '@/hooks/query/banking';
import { compose } from '@/utils';

interface WiseDisconnectAlertProps
  extends Pick<WithAlertActionsProps, 'closeAlert'>,
    WithAlertStoreConnectProps {
  name: string;
}

/**
 * Disconnect Wise profile alert. Disconnecting removes the feed connection of
 * all Wise accounts of the tenant (the accounts themselves are kept).
 */
function WiseDisconnectAlertRoot({
  name,

  // #withAlertStoreConnect
  isOpen,

  // #withAlertActions
  closeAlert,
}: WiseDisconnectAlertProps) {
  const { mutateAsync: disconnectWise, isPending: isLoading } =
    useWiseDisconnect();

  // Handle the alert cancel.
  const handleCancel = () => {
    closeAlert(name);
  };
  // Handle the alert confirm.
  const handleConfirm = () => {
    disconnectWise()
      .then(() => {
        AppToaster.show({
          message: 'The Wise profile has been disconnected.',
          intent: Intent.SUCCESS,
        });
      })
      .catch(() => {
        AppToaster.show({
          message: 'Something went wrong.',
          intent: Intent.DANGER,
        });
      })
      .finally(() => {
        closeAlert(name);
      });
  };

  return (
    <Alert
      cancelButtonText={intl.get('cancel')}
      confirmButtonText={'Disconnect Wise'}
      intent={Intent.DANGER}
      isOpen={isOpen}
      onCancel={handleCancel}
      loading={isLoading}
      onConfirm={handleConfirm}
      data-testId={'wise-disconnect-alert'}
    >
      <p>
        Are you sure you want to disconnect the Wise profile? All Wise bank
        accounts of this organization will stop syncing. The accounts and their
        transactions are kept.
      </p>
    </Alert>
  );
}

export const WiseDisconnectAlert = compose(
  withAlertStoreConnect(),
  withAlertActions,
)(WiseDisconnectAlertRoot);
