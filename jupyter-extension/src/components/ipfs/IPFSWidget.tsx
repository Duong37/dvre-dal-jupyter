import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import IPFSComponent from './IPFSComponent';

export class IPFSWidget extends ReactWidget {
  private _title: string;

  constructor(title: string = 'Storage') {
    super();
    this._title = title;
    this.addClass('dvre-widget');
    this.title.label = title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return <IPFSComponent title={this._title} />;
  }
}

export default IPFSWidget;
