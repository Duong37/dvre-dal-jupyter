import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';
import ProjectHubComponent from './ProjectHubComponent';

export interface IProjectHubWidget {
  title?: string;
  initialViewMode?: 'main' | 'create' | 'details' | 'join';
  initialProjectAddress?: string;
}

export class ProjectHubWidget extends ReactWidget {
  private _title: string;
  private _initialViewMode: 'main' | 'create' | 'details' | 'join';
  private _initialProjectAddress?: string;

  constructor(options: IProjectHubWidget | string = {}) {
    super();
    
    // Handle backward compatibility - if string is passed, use it as title
    if (typeof options === 'string') {
      this._title = options;
      this._initialViewMode = 'main';
      this._initialProjectAddress = undefined;
    } else {
      this._title = options.title || 'Project Hub';
      this._initialViewMode = options.initialViewMode || 'main';
      this._initialProjectAddress = options.initialProjectAddress;
    }
    
    this.addClass('dvre-widget');
    this.title.label = this._title;
    this.title.closable = true;
  }

  render(): JSX.Element {
    return (
      <ProjectHubComponent 
        title={this._title}
        initialViewMode={this._initialViewMode}
        initialProjectAddress={this._initialProjectAddress}
      />
    );
  }
}

export default ProjectHubWidget;