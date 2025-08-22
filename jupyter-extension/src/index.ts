import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { 
  ICommandPalette, 
  MainAreaWidget
} from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';
import { LabIcon } from '@jupyterlab/ui-components';

// import { Widget } from '@lumino/widgets'; // DISABLED - no longer needed without ExtensionInfoWidget
import { AuthWidget, ProjectHubWidget, GraphWidget, FederatedLearningWidget, IPFSWidget, ProjectDeploymentWidget, DALWidget } from './components';
import { UserRegistryReactWidget } from './widgets/UserRegistryWidget';

// Export widget opening utilities for use by other components
export { 
  openProjectHubWidget, openProjectDetails, openProjectCreation, openMainProjectHub
} from './utils/WidgetOpener';

// Import CSS
import '../style/index.css';

// Create icons (you can use built-in icons or create custom SVG icons)
const authIcon = new LabIcon({
  name: 'my-extension:auth',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>'
});

const dalIcon = new LabIcon({
  name: 'my-extension:dal',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="3" r="1.2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12.4" cy="5.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12.4" cy="10.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="8" cy="13" r="1.2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="3.6" cy="10.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="3.6" cy="5.5" r="1.2" fill="none" stroke="currentColor" stroke-width="1"/></svg>'
});

// project hub icon
// const collaborationIcon = new LabIcon({
//   name: 'my-extension:collaboration',
//   svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/><path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>'
// });

const collaborationIcon = new LabIcon({
  name: 'my-extension:collaboration',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="2.5" r="1" fill="currentColor"/><circle cx="13.5" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="13.5" r="1" fill="currentColor"/><circle cx="2.5" cy="8" r="1" fill="currentColor"/><circle cx="11.7" cy="4.3" r="1" fill="currentColor"/><circle cx="11.7" cy="11.7" r="1" fill="currentColor"/><circle cx="4.3" cy="11.7" r="1" fill="currentColor"/><circle cx="4.3" cy="4.3" r="1" fill="currentColor"/><line x1="8" y1="6.2" x2="8" y2="3.5" stroke="currentColor" stroke-width="1.2"/><line x1="9.8" y1="8" x2="12.5" y2="8" stroke="currentColor" stroke-width="1.2"/><line x1="8" y1="9.8" x2="8" y2="12.5" stroke="currentColor" stroke-width="1.2"/><line x1="6.2" y1="8" x2="3.5" y2="8" stroke="currentColor" stroke-width="1.2"/><line x1="9.4" y1="6.6" x2="10.7" y2="5.3" stroke="currentColor" stroke-width="1.2"/><line x1="9.4" y1="9.4" x2="10.7" y2="10.7" stroke="currentColor" stroke-width="1.2"/><line x1="6.6" y1="9.4" x2="5.3" y2="10.7" stroke="currentColor" stroke-width="1.2"/><line x1="6.6" y1="6.6" x2="5.3" y2="5.3" stroke="currentColor" stroke-width="1.2"/></svg>'
});

const graphIcon = new LabIcon({
  name: 'my-extension:graph',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="3" r="2" fill="currentColor"/><circle cx="13" cy="3" r="2" fill="currentColor"/><circle cx="8" cy="13" r="2" fill="currentColor"/><path d="M5 3h6M11 5l-3 6M5 5l3 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
});

// const federatedLearningIcon = new LabIcon({
//   name: 'my-extension:federated-learning',
//   svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4" r="1" fill="currentColor"/><circle cx="4" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/><path d="M8 5v2M6 8h2M8 10v2M10 8h2" stroke="currentColor" stroke-width="1"/></svg>'
// });

const federatedLearningIcon = new LabIcon({
  name: 'my-extension:federated-learning',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4" r="1" fill="currentColor"/><circle cx="4" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/><path d="M8 6v4M6 8h4" stroke="currentColor" stroke-width="1.2"/></svg>'
});

const ipfsIcon = new LabIcon({
  name: 'my-extension:ipfs',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><ellipse cx="8" cy="3.5" rx="4" ry="1" fill="currentColor"/><path d="M4 3.5v1.8c0 .5 1.8 1 4 1s4-.5 4-1V3.5" fill="none" stroke="currentColor" stroke-width="1"/><ellipse cx="8" cy="8" rx="4" ry="1" fill="currentColor"/><path d="M4 8v1.8c0 .5 1.8 1 4 1s4-.5 4-1V8" fill="none" stroke="currentColor" stroke-width="1"/><ellipse cx="8" cy="12.5" rx="4" ry="1" fill="currentColor"/><path d="M4 12.5v1.8c0 .5 1.8 1 4 1s4-.5 4-1V12.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>'
});

const deploymentIcon = new LabIcon({
  name: 'my-extension:deployment',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/></svg>'
});

const userRegistryIcon = new LabIcon({
  name: 'my-extension:user-registry',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816zM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275zM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>'
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'my-extension',
  description: 'DVRE Core - Decentralized Virtual Research Environment',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ILauncher],
  activate: (
    app: JupyterFrontEnd, 
    palette: ICommandPalette, 
    launcher: ILauncher | null
  ) => {
    console.log('DVRE Core is activated!');

    // Make app globally accessible for widget opener utilities
    (window as any).jupyterApp = app;

    // Command for authentication
    const authCommand = 'my-extension:auth';
    app.commands.addCommand(authCommand, {
      label: 'Authentication',
      caption: 'Authentication Tool',
      icon: authIcon,
      execute: () => {
        // Check if an authentication widget already exists
        const existingWidget = Array.from(app.shell.widgets('main')).find((widget: any) => 
          widget.id.startsWith('my-auth')
        );
        
        if (existingWidget) {
          // Activate the existing widget instead of creating a new one
          app.shell.activateById(existingWidget.id);
          return;
        }
        
        const content = new AuthWidget('Authentication');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-auth-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = authIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for collaboration
    const collaborationCommand = 'my-extension:collaboration';
    app.commands.addCommand(collaborationCommand, {
      label: 'Project Hub',
      caption: 'Manage and collaborate on projects',
      icon: collaborationIcon,
      execute: () => {
        // Check if a main collaboration widget already exists
        const existingWidget = Array.from(app.shell.widgets('main')).find((widget: any) => 
          widget.id.startsWith('my-collaboration') && 
          !widget.id.includes('-project-') && 
          !widget.id.includes('-create') && 
          !widget.id.includes('-details') && 
          !widget.id.includes('-join')
        );
        
        if (existingWidget) {
          // Activate the existing widget instead of creating a new one
          app.shell.activateById(existingWidget.id);
          return;
        }
        
        const content = new ProjectHubWidget('Project Hub');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-collaboration-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = collaborationIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Helper function to open project hub widget with initial state
    const openProjectHubWidget = (options: { 
      title?: string, 
      initialViewMode?: 'main' | 'create' | 'details' | 'join',
      initialProjectAddress?: string 
    } = {}) => {
      const widgetOptions = {
        title: options.title || 'Project Hub',
        initialViewMode: options.initialViewMode || 'main',
        initialProjectAddress: options.initialProjectAddress
      };
      
      // Create consistent widget ID based on the content, not timestamp
      let baseWidgetId = 'my-collaboration';
      if (options.initialProjectAddress) {
        baseWidgetId += `-project-${options.initialProjectAddress.slice(-6)}`;
      }
      if (options.initialViewMode && options.initialViewMode !== 'main') {
        baseWidgetId += `-${options.initialViewMode}`;
      }
      
      // Check if a widget with this ID already exists
      const existingWidget = Array.from(app.shell.widgets('main')).find((widget: any) => 
        widget.id.startsWith(baseWidgetId)
      );
      
      if (existingWidget) {
        // Activate the existing widget instead of creating a new one
        app.shell.activateById(existingWidget.id);
        return existingWidget;
      }
      
      // Create new widget only if one doesn't exist
      const content = new ProjectHubWidget(widgetOptions);
      const widget = new MainAreaWidget({ content });
      
      // Use base ID with timestamp only for uniqueness if multiple instances are needed
      const finalWidgetId = `${baseWidgetId}-${Date.now()}`;
      
      widget.id = finalWidgetId;
      widget.title.closable = true;
      widget.title.icon = collaborationIcon;
      widget.title.label = widgetOptions.title;
      
      app.shell.add(widget, 'main');
      app.shell.activateById(widget.id);
      
      return widget;
    };

    // Command to open project details directly
    const openProjectDetailsCommand = 'my-extension:open-project-details';
    app.commands.addCommand(openProjectDetailsCommand, {
      label: 'Open Project Details',
      caption: 'Open specific project details page',
      icon: collaborationIcon,
      execute: (args: any) => {
        const projectAddress = args?.projectAddress;
        if (projectAddress) {
          return openProjectHubWidget({
            title: `Project Details - ${projectAddress.slice(0, 6)}...${projectAddress.slice(-4)}`,
            initialViewMode: 'details',
            initialProjectAddress: projectAddress
          });
        } else {
          // Fallback to main project hub view
          return openProjectHubWidget();
        }
      }
    });

    // Store the helper function in app context for other components to use
    (app as any)._dvre_open_collaboration = openProjectHubWidget;

    // Command for graph view
    const graphCommand = 'my-extension:graph';
    app.commands.addCommand(graphCommand, {
      label: 'Project Graph View',
      caption: 'Visualize project connections and relationships',
      icon: graphIcon,
      execute: () => {
        const content = new GraphWidget('Project Graph View');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-graph-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = graphIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for federated learning
    const federatedLearningCommand = 'my-extension:federated-learning';
    app.commands.addCommand(federatedLearningCommand, {
      label: 'Federated Learning',
      caption: 'Manage and monitor federated learning projects',
      icon: federatedLearningIcon,
      execute: () => {
        const content = new FederatedLearningWidget('Federated Learning');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-federated-learning-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = federatedLearningIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for IPFS
    const ipfsCommand = 'my-extension:ipfs';
    app.commands.addCommand(ipfsCommand, {
      label: 'Storage',
      caption: 'Manage files on IPFS and blockchain assets',
      icon: ipfsIcon,
      execute: () => {
        // Check if an IPFS widget already exists
        const existingWidget = Array.from(app.shell.widgets('main')).find((widget: any) => 
          widget.id.startsWith('my-ipfs')
        );
        
        if (existingWidget) {
          // Activate the existing widget instead of creating a new one
          app.shell.activateById(existingWidget.id);
          return;
        }
        
        const content = new IPFSWidget('Storage');
        const widget = new MainAreaWidget({ content });
        widget.id = `my-ipfs-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = ipfsIcon;
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });
    // Command for project deployment (UPDATED from configuration)
    const deploymentCommand = 'my-extension:deployment';
    app.commands.addCommand(deploymentCommand, {
      label: 'Project Deployment',
      caption: 'Deploy projects with RO-Crate and orchestration server integration',
      icon: deploymentIcon,
      execute: () => {
        // Check if a deployment widget already exists
        const existingWidget = Array.from(app.shell.widgets('main')).find((widget: any) => 
          widget.id.startsWith('my-deployment')
        );
        
        if (existingWidget) {
          // Activate the existing widget instead of creating a new one
          app.shell.activateById(existingWidget.id);
          return;
        }
        
        const content = new ProjectDeploymentWidget({
          title: 'Project Deployment'
        });
        const widget = new MainAreaWidget({ content });
        widget.id = `my-deployment-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = deploymentIcon;
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Command for DAL (Decentralized Active Learning)
    const dalCommand = 'my-extension:dal';
    app.commands.addCommand(dalCommand, {
      label: 'Decentralized Active Learning',
      caption: 'Manage and participate in decentralized active learning projects',
      icon: dalIcon,
      execute: () => {
        // Check if a DAL widget already exists
        const existingWidget = Array.from(app.shell.widgets('main')).find((widget: any) => 
          widget.id.startsWith('my-dal')
        );
        
        if (existingWidget) {
          // Activate the existing widget instead of creating a new one
          app.shell.activateById(existingWidget.id);
          return;
        }
        
        const content = new DALWidget();
        const widget = new MainAreaWidget({ content });
        widget.id = `my-dal-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = dalIcon;
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

         // Command for User Registry
    const userRegistryCommand = 'my-extension:user-registry';
    app.commands.addCommand(userRegistryCommand, {
      label: 'User Registry',
      caption: 'View all D-VRE users and their metadata',
      icon: userRegistryIcon,
      execute: () => {
        const content = new UserRegistryReactWidget();
        const widget = new MainAreaWidget({ content });
        widget.id = `my-user-registry-${Date.now()}`;
        widget.title.closable = true;
        widget.title.icon = userRegistryIcon;
        widget.title.label = 'User Registry';
        
        app.shell.add(widget, 'main');
        app.shell.activateById(widget.id);
      }
    });

    // Add core commands to command palette
    palette.addItem({ command: authCommand, category: 'DVRE Core' });
    palette.addItem({ command: collaborationCommand, category: 'DVRE Core' });
    palette.addItem({ command: graphCommand, category: 'DVRE Core' });
    palette.addItem({ command: federatedLearningCommand, category: 'DVRE Core' });
    palette.addItem({ command: ipfsCommand, category: 'DVRE Core' });
    palette.addItem({ command: deploymentCommand, category: 'DVRE Core' });
    palette.addItem({ command: dalCommand, category: 'DVRE Core' });
     palette.addItem({ command: userRegistryCommand, category: 'D-VRE Core' });


    // Add core commands to launcher
    if (launcher) {
      launcher.add({
        command: authCommand,
        category: 'DVRE Core', 
        rank: 1
      });

      launcher.add({
        command: collaborationCommand,
        category: 'DVRE Core',
        rank: 2
      });

      launcher.add({
        command: graphCommand,
        category: 'DVRE Core',
        rank: 3
      });

      launcher.add({
        command: ipfsCommand,
        category: 'DVRE Core',
        rank: 4
      });

      launcher.add({
        command: deploymentCommand,
        category: 'DVRE Core',
        rank: 5
      });
      
      launcher.add({
        command: userRegistryCommand,
        category: 'DVRE Core',
        rank: 6
      });

      // dApps category
      launcher.add({
        command: federatedLearningCommand,
        category: 'DVRE dApps',
        rank: 1
      });

      launcher.add({
        command: dalCommand,
        category: 'DVRE dApps',
        rank: 2
      });

      console.log('DVRE Core: Extension added to launcher successfully!');
      
    } else {
      console.log('DVRE Core: Launcher not available - extension only in command palette');
    }

    // Extension registry (discovery disabled - all dApps are now integrated directly)
    const extensionRegistry = {
      getDiscoveredExtensions: () => [], // Extension discovery disabled
      refreshExtensions: () => Promise.resolve([]) // Extension discovery disabled
    };

    // Store in app context for other extensions to access
    (app as any)._dvre_extension_registry = extensionRegistry;
  }
};

export default plugin;