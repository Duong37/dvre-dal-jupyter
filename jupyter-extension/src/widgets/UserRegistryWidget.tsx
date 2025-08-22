import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';
import { UserRegistryWidget } from '../components/userregistry/UserRegistryWidget';

export class UserRegistryReactWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-dvre-user-registry-widget');
  }

  render(): JSX.Element {
    return <UserRegistryWidget />;
  }
}
