import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';
import ProjectDeploymentComponent from './ProjectDeploymentComponent';

export interface IProjectDeploymentWidget {
  title: string;
  projectId?: string;
}

export class ProjectDeploymentWidget extends ReactWidget {
  private _title: string;
  private _projectId?: string;

  constructor(options: IProjectDeploymentWidget) {
    super();
    this._title = options.title;
    this._projectId = options.projectId;
    this.addClass('project-deployment-widget');
    this.title.label = this._title;
    this.title.closable = true;
    // Icon is set in the main command definition (index.ts) using deploymentIcon
  }

  protected render(): JSX.Element {
    return (
      <ProjectDeploymentComponent
        title={this._title}
        projectId={this._projectId}
      />
    );
  }
}

export default ProjectDeploymentWidget; 