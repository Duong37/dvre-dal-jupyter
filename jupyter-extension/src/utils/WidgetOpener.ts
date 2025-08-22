/**
 * Widget Opener Utilities - Consistent widget opening across the application
 * 
 * Problem Solved:
 * Previously, when users clicked on widgets from different entry points (launcher, 
 * command palette, other components), they would always get a fresh widget starting 
 * in the default state. This created inconsistent user experiences where clicking 
 * on a "Project Details" link would open the main project hub view instead of 
 * the specific project details.
 * 
 * Additional Problem: Multiple identical widgets were being created every time 
 * a user clicked on the same widget, leading to cluttered tabs and confusion.
 * 
 * Solution:
 * These utilities provide a consistent way to open widgets with specific initial 
 * states, ensuring that when a user clicks on "Project Details" or "Create Project", 
 * they get exactly what they expect. Additionally, widget deduplication prevents 
 * multiple identical widgets from being created - if a widget already exists, it 
 * will be activated instead of creating a new one.
 * 
 * Features:
 * - Initial state preservation (opens to specific views/projects)
 * - Widget deduplication (no duplicate tabs for the same content)
 * - Consistent experience across all entry points
 * - Graceful fallbacks if utilities aren't available
 * 
 * Usage Examples:
 * - openProjectDetails('0x123...abc') // Opens directly to project details
 * - openProjectCreation() // Opens directly to project creation form
 * - openMainProjectHub() // Opens main project hub view
 */

export interface ProjectHubWidgetOptions {
  title?: string;
  initialViewMode?: 'main' | 'create' | 'details' | 'join';
  initialProjectAddress?: string;
}

/**
 * Opens a project hub widget with the specified options
 * This function can be called from anywhere in the application to ensure
 * consistent user experience when opening project hub views
 */
export const openProjectHubWidget = (options: ProjectHubWidgetOptions = {}): void => {
  // Check if the global opener function is available
  const app = (window as any).jupyterlab?.app || (window as any).jupyterApp;
  
  if (app && (app as any)._dvre_open_collaboration) {
    (app as any)._dvre_open_collaboration(options);
  } else {
    console.warn('DVRE: Project Hub widget opener not available. Please ensure the extension is loaded.');
    
    // Fallback: Try to execute the collaboration command
    if (app && app.commands) {
      if (options.initialProjectAddress) {
        app.commands.execute('my-extension:open-project-details', {
          projectAddress: options.initialProjectAddress
        });
      } else {
        app.commands.execute('my-extension:collaboration');
      }
    }
  }
};

/**
 * Opens project details directly
 */
export const openProjectDetails = (projectAddress: string, title?: string): void => {
  openProjectHubWidget({
    title: title || `Project Details - ${projectAddress.slice(0, 6)}...${projectAddress.slice(-4)}`,
    initialViewMode: 'details',
    initialProjectAddress: projectAddress
  });
};

/**
 * Opens project creation form
 */
export const openProjectCreation = (): void => {
  openProjectHubWidget({
    title: 'Create New Project',
    initialViewMode: 'create'
  });
};

/**
 * Opens main project hub view
 */
export const openMainProjectHub = (): void => {
  openProjectHubWidget({
    title: 'Project Hub',
    initialViewMode: 'main'
  });
}; 