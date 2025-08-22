#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to copy all compiled contract ABIs from artifacts to jupyter-extension/src/abis
 * 
 * Usage: node scripts/copy-abis.js
 */

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts', 'contracts');
const SRC_DESTINATION_DIR = path.join(__dirname, '..', 'jupyter-extension', 'src', 'abis');
const LIB_DESTINATION_DIR = path.join(__dirname, '..', 'jupyter-extension', 'lib', 'abis');

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

function copyABIFiles(sourceDir, destDir) {
    const results = {
        new: [],
        changed: [],
        unchanged: [],
        failed: [],
        skipped: []
    };
    
    const processedFiles = new Set(); // Track files we've already processed
    
    function processDirectory(currentDir, relativePath = '') {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const itemPath = path.join(currentDir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Recursively process subdirectories
                processDirectory(itemPath, path.join(relativePath, item));
            } else if (stat.isFile() && item.endsWith('.json') && !item.endsWith('.dbg.json')) {
                // Process .json files but skip .dbg.json debug files
                
                // Skip interface files that are duplicates from different contracts
                if (item.startsWith('I') && item.endsWith('.json') && processedFiles.has(item)) {
                    results.skipped.push({
                        name: item,
                        source: itemPath,
                        reason: 'Duplicate interface file'
                    });
                    continue;
                }
                
                const destPath = path.join(destDir, item);
                
                try {
                    const sourceContent = fs.readFileSync(itemPath, 'utf8');
                    const fileInfo = {
                        name: item,
                        source: itemPath,
                        dest: destPath,
                        size: (stat.size / 1024).toFixed(1) + 'KB'
                    };
                    
                    if (fs.existsSync(destPath)) {
                        // File exists, check if content is different
                        const destContent = fs.readFileSync(destPath, 'utf8');
                        if (sourceContent !== destContent) {
                            // Content is different, copy and mark as changed
                            fs.copyFileSync(itemPath, destPath);
                            results.changed.push(fileInfo);
                        } else {
                            // Content is the same, mark as unchanged
                            results.unchanged.push(fileInfo);
                        }
                    } else {
                        // File doesn't exist, copy and mark as new
                        fs.copyFileSync(itemPath, destPath);
                        results.new.push(fileInfo);
                    }
                    
                    // Mark this filename as processed
                    processedFiles.add(item);
                    
                } catch (error) {
                    console.error(` Failed to process ${item}:`, error.message);
                    results.failed.push({
                        name: item,
                        error: error.message
                    });
                }
            }
        }
    }
    
    processDirectory(sourceDir);
    return results;
}

function main() {
    console.log('Starting ABI copy process...\n');
    
    // Check if source directory exists
    if (!fs.existsSync(ARTIFACTS_DIR)) {
        console.error(` Source directory not found: ${ARTIFACTS_DIR}`);
        console.log('Run "npx hardhat compile" first to generate artifacts');
        process.exit(1);
    }
    
    // Ensure destination directories exist
    ensureDirectoryExists(SRC_DESTINATION_DIR);
    ensureDirectoryExists(LIB_DESTINATION_DIR);
    
    // Copy ABI files to both destinations
    console.log(`📂 Copying ABIs from: ${ARTIFACTS_DIR}`);
    console.log(`📂 Copying ABIs to:`);
    console.log(`• ${SRC_DESTINATION_DIR} (TypeScript source)`);
    console.log(`• ${LIB_DESTINATION_DIR} (Runtime/compiled)\n`);
    
    const srcResults = copyABIFiles(ARTIFACTS_DIR, SRC_DESTINATION_DIR);
    const libResults = copyABIFiles(ARTIFACTS_DIR, LIB_DESTINATION_DIR);
    
    if (srcResults.new.length === 0 && srcResults.changed.length === 0 && srcResults.unchanged.length === 0 && srcResults.failed.length === 0) {
        console.log('No ABI files found to copy');
        return;
    }
    
    // Display detailed results
    console.log('ABI update results:\n');
    
    // Show new files
    if (srcResults.new.length > 0) {
        console.log(`🆕 New files (${srcResults.new.length}):`);
        srcResults.new.forEach(file => {
            console.log(`• ${file.name} (${file.size})`);
        });
        console.log('');
    }
    
    // Show changed files
    if (srcResults.changed.length > 0) {
        console.log(`Changed files (${srcResults.changed.length}):`);
        srcResults.changed.forEach(file => {
            console.log(`• ${file.name} (${file.size})`);
        });
        console.log('');
    }
    
    // Show unchanged files
    if (srcResults.unchanged.length > 0) {
        console.log(`Unchanged files (${srcResults.unchanged.length}):`);
        srcResults.unchanged.forEach(file => {
            console.log(`• ${file.name} (${file.size})`);
        });
        console.log('');
    }
    
    // Show failed files
    if (srcResults.failed.length > 0) {
        console.log(`Failed files (${srcResults.failed.length}):`);
        srcResults.failed.forEach(file => {
            console.log(`• ${file.name}: ${file.error}`);
        });
        console.log('');
    }
    
    // Show skipped files (for debugging)
    if (srcResults.skipped.length > 0) {
        console.log(`Skipped files (${srcResults.skipped.length}):`);
        srcResults.skipped.forEach(file => {
            console.log(`• ${file.name} (${file.reason})`);
        });
        console.log('');
    }
    
    // Summary
    const totalProcessed = srcResults.new.length + srcResults.changed.length + srcResults.unchanged.length;
    const totalUpdated = srcResults.new.length + srcResults.changed.length;
    
    if (totalUpdated > 0) {
        console.log(`${totalUpdated} files updated, ${srcResults.unchanged.length} unchanged (${totalProcessed} total processed)`);
        console.log('\n Updated ABIs are now available in both src/ and lib/ directories without needing yarn build!');
    } else {
        console.log(`All ${totalProcessed} ABI files are already up to date!`);
        console.log('\n No changes needed - your ABIs are current.');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { copyABIFiles, ensureDirectoryExists }; 