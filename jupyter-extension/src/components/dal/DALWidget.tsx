import React from 'react';
import { ReactWidget } from '@jupyterlab/ui-components';
import { DALComponent } from './DALComponent';

/**
 * Clean DAL Widget - JupyterLab Integration
 * Minimal wrapper for the DAL component
 */
export class DALWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-DALWidget');
    this.title.label = 'Active Learning';
    this.title.caption = 'Decentralized Active Learning Projects';
    // Icon is set in the main command definition (index.ts) using dalIcon
  }

  render(): JSX.Element {
    return (
      <div className="jp-DALWidget-body">
        <DALComponent />
      </div>
    );
  }
}

export default DALWidget; 