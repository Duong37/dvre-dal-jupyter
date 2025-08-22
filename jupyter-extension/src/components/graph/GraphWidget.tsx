import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import GraphComponent from './GraphComponent';

export class GraphWidget extends ReactWidget {
  private _title: string;

  constructor(title: string = 'Project Graph View') {
    super();
    this._title = title;
    this.addClass('dvre-widget');
    this.addClass('dvre-graph-widget');
    this.title.label = title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return <GraphComponent title={this._title} />;
  }
}

export default GraphWidget;
