#!/usr/bin/env node
// local-rocrate-saver.js - Node.js service to save RO-Crate files locally
// Test comment to verify edit tool functionality

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

class LocalROCrateSaver {
  constructor() {
    this.projectFilesDir = path.join(__dirname, 'ro-crates');
    this.port = 3001; // Different from JupyterLab's port
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  async saveROCrateBundle(projectId, bundleData) {
    console.log(`Saving RO-Crate for project ${projectId}...`);
    
    try {
      // Create project directory
      const projectDir = path.join(this.projectFilesDir, projectId);
      await this.ensureDirectoryExists(projectDir);

      const savedFiles = [];

      // Save each file in the bundle
      for (const file of bundleData.files) {
        const filePath = path.join(projectDir, file.name);
        const fileDir = path.dirname(filePath);

        // Ensure subdirectories exist
        await this.ensureDirectoryExists(fileDir);

        // Write file content
        await fs.writeFile(filePath, file.content, 'utf8');
        savedFiles.push(file.name);
        
        console.log(`Saved: ${file.name} (${file.content.length} bytes)`);
      }

      // Create project manifest
      const manifest = {
        project_id: projectId,
        created_at: new Date().toISOString(),
        local_path: projectDir,
        files: savedFiles,
        total_files: savedFiles.length,
        ...bundleData.metadata
      };

      const manifestPath = path.join(projectDir, 'project-manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      savedFiles.push('project-manifest.json');
      
      console.log(`Successfully saved RO-Crate for project ${projectId}`);
      console.log(`Location: ${projectDir}`);
      console.log(`Files saved: ${savedFiles.length}`);

      return {
        success: true,
        projectPath: projectDir,
        savedFiles,
        totalFiles: savedFiles.length
      };

    } catch (error) {
      console.error(`Failed to save RO-Crate for project ${projectId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listLocalProjects() {
    try {
      const entries = await fs.readdir(this.projectFilesDir, { withFileTypes: true });
      const projects = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      console.log(`Found ${projects.length} local projects:`, projects);
      return projects;
    } catch (error) {
      console.error('Failed to list local projects:', error);
      return [];
    }
  }

  async projectExists(projectId) {
    try {
      const projectDir = path.join(this.projectFilesDir, projectId);
      await fs.access(projectDir);
      return true;
    } catch {
      return false;
    }
  }

  async removeProject(projectId) {
    try {
      const projectDir = path.join(this.projectFilesDir, projectId);
      await fs.rm(projectDir, { recursive: true, force: true });
      console.log(`Removed project ${projectId}`);
      return true;
    } catch (error) {
      console.error(`Failed to remove project ${projectId}:`, error);
      return false;
    }
  }

  setupHTTPServer() {
    const server = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const method = req.method;
        const pathname = url.pathname;

        if (method === 'POST' && pathname === '/save-rocrate') {
          // Save RO-Crate bundle
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const result = await this.saveROCrateBundle(data.projectId, data.bundleData);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          });

        } else if (method === 'GET' && pathname === '/projects') {
          // List projects
          const projects = await this.listLocalProjects();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ projects }));

        } else if (method === 'GET' && pathname.startsWith('/projects/')) {
          // Check if project exists
          const projectId = pathname.split('/')[2];
          const exists = await this.projectExists(projectId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ exists }));

        } else if (method === 'DELETE' && pathname.startsWith('/projects/')) {
          // Remove project
          const projectId = pathname.split('/')[2];
          const success = await this.removeProject(projectId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success }));

        } else if (method === 'GET' && pathname === '/read-file') {
          // Read query samples JSON files for frontend
          try {
            const filePath = url.searchParams.get('path');
            if (!filePath) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File path is required' }));
              return;
            }

            console.log(`Reading file: ${filePath}`);

            // Security check: only allow reading from al-engine/ro-crates directory
            if (!filePath.includes('al-engine/ro-crates/') || filePath.includes('..')) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Access denied: Invalid file path' }));
              return;
            }

            // Construct absolute path
            const absolutePath = path.resolve(__dirname, '../', filePath);
            const fileContent = await fs.readFile(absolutePath, 'utf8');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              content: fileContent,
              path: filePath
            }));
            
          } catch (error) {
            console.error('Failed to read file:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              error: error.message 
            }));
          }

        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }

      } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    server.listen(this.port, 'localhost', () => {
      console.log(`Local RO-Crate Saver running on http://localhost:${this.port}`);
      console.log(`Project files directory: ${this.projectFilesDir}`);
      console.log('Available endpoints:');
      console.log('POST /save-rocrate - Save RO-Crate bundle');
      console.log('GET /projects - List all projects');
      console.log('GET /projects/:id - Check if project exists');
      console.log('DELETE /projects/:id - Remove project');
      console.log('GET /read-file?path=<filepath> - Read files from ro-crates directory');
    });

    return server;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const saver = new LocalROCrateSaver();

  if (args.length === 0 || args[0] === 'server') {
    // Start HTTP server
    await saver.ensureDirectoryExists(saver.projectFilesDir);
    saver.setupHTTPServer();
  } else if (args[0] === 'list') {
    // List projects
    await saver.listLocalProjects();
  } else if (args[0] === 'remove' && args[1]) {
    // Remove project
    const success = await saver.removeProject(args[1]);
    process.exit(success ? 0 : 1);
  } else {
    console.log('Usage:');
    console.log('node local-rocrate-saver.js [server]  # Start HTTP server (default)');
    console.log('node local-rocrate-saver.js list      # List saved projects');
    console.log('node local-rocrate-saver.js remove <project-id>  # Remove project');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LocalROCrateSaver; 