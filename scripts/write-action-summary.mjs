import { appendFile, readFile } from 'node:fs/promises';
import { renderActionSummary } from '../dist/action-summary.js';

const comparisonFile=process.argv[2];
if(!comparisonFile)throw new Error('Expected a comparison JSON file.');
if(!process.env.GITHUB_STEP_SUMMARY)throw new Error('GITHUB_STEP_SUMMARY is unavailable outside GitHub Actions.');
if(!process.env.REPOATLAS_ARTIFACT_URL)throw new Error('The architecture artifact URL is missing.');
const comparison=JSON.parse(await readFile(comparisonFile,'utf8'));
const summary=renderActionSummary(comparison,process.env.REPOATLAS_ARTIFACT_URL);
await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(!(await readFile(process.env.GITHUB_STEP_SUMMARY,'utf8')).endsWith(summary))throw new Error('Could not verify the architecture summary in the GitHub Actions job summary file.');
