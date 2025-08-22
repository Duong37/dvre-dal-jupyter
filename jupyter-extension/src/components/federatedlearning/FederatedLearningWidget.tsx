import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import FederatedLearningComponent from './FederatedLearningComponent';

export class FederatedLearningWidget extends ReactWidget {
  private _title: string;

  constructor(title: string = 'Federated Learning') {
    super();
    this._title = title;
    this.addClass('dvre-widget');
    this.addClass('dvre-federated-learning-widget');
    this.title.label = title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return <FederatedLearningComponent title={this._title} />;
  }
}

export default FederatedLearningWidget;
