import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function runComparativeExperiment() {
  console.log('🎯 Starting Comparative Analysis Experiment');
  console.log('='.repeat(60));
  
  // Ensure results directory exists
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }
  
  // Create experiment-specific directories
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const experimentDir = `results/comparative-experiment-${timestamp}`;
  const fourNodesDir = `${experimentDir}/4-nodes-with-distant`;
  const threeNodesDir = `${experimentDir}/3-nodes-close-only`;
  
  fs.mkdirSync(experimentDir, { recursive: true });
  fs.mkdirSync(fourNodesDir, { recursive: true });
  fs.mkdirSync(threeNodesDir, { recursive: true });
  
  console.log(`📁 Experiment directory: ${experimentDir}`);
  
  // Phase 1: Test with 4 nodes (including distant Node 4)
  console.log('\n🌍 Phase 1: Testing with 4 nodes (including distant Node 4)');
  console.log('Run 5 iterations to gather statistical data...\n');
  
  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 Running iteration ${i}/5 with 4 nodes...`);
    
    try {
      // Run the test
      const output = execSync('node test-write-latency-only.js', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      // Move the generated results to the 4-nodes directory
      const resultsFiles = fs.readdirSync('results')
        .filter(file => file.startsWith('write-concurrency-') && file.endsWith('.json'))
        .sort((a, b) => {
          const aTime = fs.statSync(`results/${a}`).mtime;
          const bTime = fs.statSync(`results/${b}`).mtime;
          return bTime - aTime; // Most recent first
        });
      
      // Move the 4 most recent files (1level, 2level, 4level, 8level) and summary
      const filesToMove = resultsFiles.slice(0, 5); // Top 5 most recent
      filesToMove.forEach(file => {
        const oldPath = `results/${file}`;
        const newPath = `${fourNodesDir}/iteration${i}_${file}`;
        fs.renameSync(oldPath, newPath);
        console.log(`📁 Moved: ${file} -> ${newPath}`);
      });
      
      console.log(`✅ Iteration ${i} with 4 nodes completed\n`);
      
    } catch (error) {
      console.error(`❌ Error in iteration ${i}:`, error.message);
    }
    
    // Wait between iterations to avoid overwhelming the network
    if (i < 5) {
      console.log('⏳ Waiting 10 seconds before next iteration...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  // Phase 2: Modify code to use only 3 nodes
  console.log('\n🏢 Phase 2: Modifying configuration for 3 close nodes only...');
  
  // Read and modify the test file
  let testFileContent = fs.readFileSync('test-write-latency-only.js', 'utf8');
  testFileContent = testFileContent.replace(
    'CONFIG.BESU_NODES.node4.url  // Added back: distant node for comparison',
    '// CONFIG.BESU_NODES.node4.url  // Commented out: distant node for comparison'
  );
  testFileContent = testFileContent.replace(
    'Comparative Analysis: Including all 4 nodes (with distant Node 4)',
    'Comparative Analysis: Testing with only 3 close nodes (excluding distant Node 4)'
  );
  fs.writeFileSync('test-write-latency-only.js', testFileContent);
  
  console.log('✅ Configuration updated to use only 3 close nodes');
  
  // Phase 2: Test with 3 nodes (excluding distant Node 4)
  console.log('\n🏢 Phase 2: Testing with 3 close nodes only');
  console.log('Run 5 iterations to gather statistical data...\n');
  
  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 Running iteration ${i}/5 with 3 close nodes...`);
    
    try {
      // Run the test
      const output = execSync('node test-write-latency-only.js', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      // Move the generated results to the 3-nodes directory
      const resultsFiles = fs.readdirSync('results')
        .filter(file => file.startsWith('write-concurrency-') && file.endsWith('.json'))
        .sort((a, b) => {
          const aTime = fs.statSync(`results/${a}`).mtime;
          const bTime = fs.statSync(`results/${b}`).mtime;
          return bTime - aTime; // Most recent first
        });
      
      // Move the 5 most recent files
      const filesToMove = resultsFiles.slice(0, 5); // Top 5 most recent
      filesToMove.forEach(file => {
        const oldPath = `results/${file}`;
        const newPath = `${threeNodesDir}/iteration${i}_${file}`;
        fs.renameSync(oldPath, newPath);
        console.log(`📁 Moved: ${file} -> ${newPath}`);
      });
      
      console.log(`✅ Iteration ${i} with 3 nodes completed\n`);
      
    } catch (error) {
      console.error(`❌ Error in iteration ${i}:`, error.message);
    }
    
    // Wait between iterations
    if (i < 5) {
      console.log('⏳ Waiting 10 seconds before next iteration...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log('\n🎯 Comparative Analysis Experiment Completed!');
  console.log('='.repeat(60));
  console.log(`📁 All results saved in: ${experimentDir}`);
  console.log(`📊 Ready for statistical analysis and pattern detection`);
  console.log(`\nNext steps:`);
  console.log(`1. Analyze success rates across both configurations`);
  console.log(`2. Compare latency distributions`);
  console.log(`3. Identify node-specific failure patterns`);
  console.log(`4. Generate comparative visualizations for thesis`);
}

// Run the experiment
runComparativeExperiment().catch(console.error); 