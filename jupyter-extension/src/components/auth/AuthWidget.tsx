import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import AuthComponent from './AuthComponent';

export class AuthWidget extends ReactWidget {
  private _title: string;

  constructor(title: string = 'Authentication Tool') {
    super();
    this._title = title;
    this.addClass('dvre-widget');
    this.title.label = title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return <AuthComponent title={this._title} />;
  }
}

export default AuthWidget;
