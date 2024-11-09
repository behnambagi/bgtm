import { createReadlineInterface } from '../utils/readline.js';
import { execAsync } from '../utils/exec.js';
import inquirer from 'inquirer';
import axios from "axios";
import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';
import * as https from "node:https";
import ora from "ora";
import CliTable3 from "cli-table3";
import chalk from "chalk";

const rl = createReadlineInterface();

interface TaggingOptions {
    handly: boolean;
}

async function getRepoUrl(): Promise<string> {
    const { stdout } = await execAsync('git config --get remote.origin.url');
    return stdout.trim();
}

async function getLatestTag(): Promise<string> {
    const { stdout } = await execAsync('git describe --tags --abbrev=0');
    return stdout.trim();
}

function parseLatestVersion(latestTag: string): [number, number, number] {
    const latestVersion = latestTag.replace(/^(v|dev)+/, '');
    const [major, minor, patch] = latestVersion.split('.');
    return [parseInt(major), parseInt(minor), parseInt(patch)];
}

async function getManualNewVersion(latestTag: string): Promise<string> {
    console.log(`Latest version is: ${latestTag}`);

    while (true) { // Loop until valid input is received
        const newVersionInput = await new Promise<string>((resolve) => {
            rl.question('Enter the new version (e.g., v1.2.3): ', resolve);
        });

        // Basic validation: check if it starts with 'v' or 'dev'
        if (/^(v|dev)/.test(newVersionInput)) {
            return newVersionInput;
        } else {
            console.error('Invalid version format. Please start with "v" or "dev".');
        }
    }
}

async function getVersionWithPrefix(versionWithoutPrefix: string): Promise<string> {
    while (true) {
        const { prefixChoice } = await inquirer.prompt<{ prefixChoice: '1' | '2' }>([
            {
                type: 'list',
                name: 'prefixChoice',
                message: 'Select tag prefix:',
                choices: [
                    { name: 'v (for release)', value: '1' },
                    { name: 'dev (for development)', value: '2' },
                ],
            },
        ]);

        if (prefixChoice === '1' || prefixChoice === '2') {
            const prefix = prefixChoice === '1' ? 'v' : 'dev';
            return `${prefix}${versionWithoutPrefix}`;
        } else {
            console.error('Invalid choice. Please enter 1 or 2.');
        }
    }
}

async function getAutomatedNewVersion(latestTag: string): Promise<string> {
    const [major, minor, patch] = parseLatestVersion(latestTag);
    let newPatch = patch;
    let newMinor = minor;

    if (patch === 99) {
        newMinor = minor + 1;
        newPatch = 1;
    } else {
        newPatch++;
    }

    const versionWithoutPrefix = `${major}.${newMinor
        .toString()
        .padStart(2, '0')}.${newPatch.toString().padStart(2, '0')}`;

    return getVersionWithPrefix(versionWithoutPrefix);
}

async function getNewVersion(latestTag: string, options: TaggingOptions): Promise<string> {
    if (options.handly) {
        return getManualNewVersion(latestTag);
    } else {
        return getAutomatedNewVersion(latestTag);
    }
}

async function confirmTagging(
    newVersion: string,
    latestTag: string
): Promise<{ branch: string; confirmed: boolean }> {
    let branch = '';
    let confirmed = false;

    while (!confirmed) {
        const { stdout: branchesOutput } = await execAsync('git branch');
        const branches = branchesOutput
            .split('\n')
            .map((branch) => branch.trim().replace(/^\* /, ''))
            .filter((branch) => branch !== '');

        const isRelease = newVersion.startsWith('v');
        const recommendedBranch = isRelease ?
            (branches.includes('main') ? 'main' : (branches.includes('master') ? 'master' : '')) :
            (branches.includes('develop') ? 'develop' : (branches.includes('dev') ? 'dev' : ''));

        const { branchChoice } = await inquirer.prompt<{ branchChoice: string }>([
            {
                type: 'list',
                name: 'branchChoice',
                message: 'Select the branch to tag:',
                choices: branches.map(branch => ({ name: branch, value: branch })),
                default: recommendedBranch // Set the recommended branch as the default selection
            },
        ]);

        branch = branchChoice;

        console.log(`\nPlease confirm tagging details:`);
        console.log(`- Branch: ${branch}`);
        console.log(`- Last version: ${latestTag}`);
        console.log(`- New version: ${newVersion}`);

        const { confirmation } = await inquirer.prompt<{ confirmation: string }>([
            {
                type: 'confirm',
                name: 'confirmation',
                message: 'Proceed with tagging and pushing?',
                default: true, // Default to 'yes'
            },
        ]);

        confirmed = !!confirmation;
    }

    return { branch, confirmed };
}

async function handleTagging(newVersion: string, branch: string): Promise<void> {
    try {
        await execAsync(`git tag -a ${newVersion} -m "New version ${newVersion}" ${branch}`);
        await execAsync(`git push origin ${newVersion}`);

        const repoUrl = await getRepoUrl();
        const pipelineUrl = repoUrl.replace(/\.git$/, '') + `/-/commits/${newVersion}`;
        console.log(`Pipeline URL: ${pipelineUrl}`);
    } catch (error) {
        console.error(`Error tagging or pushing: ${error}`);
        handlePushFailure(newVersion);
    }
}

function handlePushFailure(newVersion: string): void {
    rl.question('Push failed. Retry (r) or delete tag (d)? ', (choice) => {
        if (choice.toLowerCase() === 'r') {
            handleTagging(newVersion, ''); // Need to get the branch again if retrying
        } else if (choice.toLowerCase() === 'd') {
            execAsync(`git tag -d ${newVersion}`)
                .then(() => console.log(`Tag ${newVersion} deleted.`))
                .catch((error) => console.error(`Error deleting tag: ${error}`))
                .finally(() => rl.close());
        } else {
            console.error('Invalid choice. Exiting.');
            rl.close();
        }
    });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE_PATH = path.join(__dirname, '.gitlab-config.json');

interface GitLabConfig {
    [host: string]: string; // Store token per host
}

async function getGitLabToken(host: string): Promise<string> {
    try {
        let config: GitLabConfig = {};
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
            config = JSON.parse(configData);
        }

        if (config[host]) {
            return config[host];
        } else {
            console.info(`Generate token: https://${host}-/profile/personal_access_tokens`);

            const { token } = await inquirer.prompt<{ token: string }>([
                {
                    type: 'password',
                    name: 'token',
                    message: `Please enter your GitLab personal access token for ${host}:`,
                },
            ]);

            config[host] = token;
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
            return token;
        }
    } catch (error) {
        console.error('Error getting GitLab token:', error);
        throw error;
    }
}

async function getGitLabProjectAndPipelineIds(): Promise<{ projectId: string; pipelineId: string; gitlabAddress: string }> {
    try {
        // Get the remote URL of the current repository
        const { stdout: remoteUrlOutput } = await execAsync('git config --get remote.origin.url');
        const remoteUrl = remoteUrlOutput.trim();

        // Extract project path from the remote URL (more generic approach)
        const projectPathMatch = remoteUrl.match(/^(?:https?:\/\/|git@)([^/:]+)[:/](.+)\.git$/);
        if (!projectPathMatch) {
            throw new Error('Could not extract project path from remote URL');
        }
        const projectPath = projectPathMatch[2];

        // Fetch the latest pipeline ID for the project (assuming you have a default branch)
        const token = await getGitLabToken(projectPathMatch[1]); // Get token based on host
        const apiUrl = `https://${projectPathMatch[1]}/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines`;
        const { stdout: pipelineIdOutput } = await execAsync(`curl -k --header "PRIVATE-TOKEN: ${token}" "${apiUrl}"`);
        const pipelinesData = JSON.parse(pipelineIdOutput);
        if (!pipelinesData || pipelinesData.length === 0) {
            throw new Error('No pipelines found for the project');
        }
        const latestPipelineId = pipelinesData[0].id;

        return {
            projectId: encodeURIComponent(projectPath),
            pipelineId: latestPipelineId.toString(),
            gitlabAddress: projectPathMatch[1],
        };
    } catch (error) {
        console.error('Error getting GitLab project and pipeline IDs:', error);
        throw error;
    }
}

async function getPipelineStatus(projectId: string, pipelineId: string, gitlabAddress: string): Promise<string> {
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false // This tells Axios to trust self-signed certificates
        });

        const response = await axios.get(
            `https://${gitlabAddress}/api/v4/projects/${projectId}/pipelines/${pipelineId}`,
            {
                headers: { "PRIVATE-TOKEN" : await getGitLabToken(gitlabAddress) },
                httpsAgent: agent
            }
        );
        return response.data.status;
    } catch (error: any) {
        // Handle specific error for unauthorized access (401)
        if (error.response && error.response.status === 401) {
            console.error('Error fetching pipeline status: Unauthorized (401).');
            console.error('Your token might be invalid or expired. Please regenerate your token and try again.');
            throw new Error('InvalidGitLabToken'); // Custom error for easier handling later
        } else {
            console.error('Error fetching pipeline status:', error);
            return 'unknown';
        }
    }
}


async function displayPipelineStatus(projectId: string, pipelineId: string, gitlabAddress: string) {

    let currentStatus = await getPipelineStatus(projectId, pipelineId, gitlabAddress);
    let prevStatus = currentStatus;

    const table = new CliTable3({
        head: ['Pipeline ID', 'Status', 'Updated At'],
        colWidths: [15, 20, 30],
        style: {
            head: ['cyan', 'bold'],
            border: ['gray']
        }
    });

    function getStatusColor(status: string) {
        switch (status) {
            case 'success':
                return 'green';
            case 'failed':
                return 'red';
            case 'canceled':
                return 'yellow';
            case 'pending':
                return 'blue'; // Blue for pending status
            default:
                return 'white'; // Default color for other statuses
        }
    }

    table.push([pipelineId, chalk[getStatusColor(currentStatus)](currentStatus), new Date().toLocaleString()]);
    console.log(`\n${table.toString()}\n`);
    const spinner = ora('Fetching pipeline status...').start();


    const intervalId = setInterval(async () => {
        currentStatus = await getPipelineStatus(projectId, pipelineId, gitlabAddress);

        if (currentStatus !== prevStatus) {
            spinner.text = 'Pipeline status updated!';
            prevStatus = currentStatus;

            table.splice(0, 1); // Remove the previous row
            table.push([pipelineId, chalk[getStatusColor(currentStatus)](currentStatus), new Date().toLocaleString()]);
            console.log(`\n${table.toString()}\n`);

            if (currentStatus === 'success' || currentStatus === 'failed' || currentStatus === 'canceled') {
                clearInterval(intervalId);
                switch (currentStatus) {
                    case 'success':
                        spinner.succeed(chalk.green(`Pipeline finished successfully! `));
                        break;
                    case 'failed':
                        spinner.fail(chalk.red(`Pipeline failed. ❌ Please check logs.`));
                        break;
                    case 'canceled':
                        spinner.warn(chalk.yellow(`Pipeline was canceled. ⚠️`));
                        break;
                    default:
                        spinner.info(`Pipeline finished with unexpected status: ${currentStatus}`);
                }
            } else if (currentStatus === 'running') {
                spinner.text = 'Pipeline is running...';
            } if (currentStatus === 'pending') {
                    spinner.text = 'Pipeline is pending...';
                } else {
                spinner.text = `Pipeline status: ${currentStatus}`;
                   }
        }
    }, 5000); // Poll every 5 seconds
}

export async function tagProject(options: TaggingOptions): Promise<void> {
    try {
        const latestTag = await getLatestTag();
        const newVersion = await getNewVersion(latestTag, options);

        const { branch, confirmed } = await confirmTagging(newVersion, latestTag);

        if (confirmed) {
            await handleTagging(newVersion, branch);
            await new Promise(resolve => setTimeout(resolve, 500));
            const { projectId, pipelineId, gitlabAddress } = await getGitLabProjectAndPipelineIds();

            try {
                await displayPipelineStatus(projectId, pipelineId, gitlabAddress);
            } catch (error:any) {
                if (error.message === 'InvalidGitLabToken') {
                    // Handle the case of invalid token specifically
                    console.error('Failed to display pipeline status due to invalid token.');
                } else {
                    throw error; // Re-throw other errors
                }
            }
        } else {
            console.log('Tagging canceled.');
            rl.close();
        }
    } catch (error) {
        console.error('Error during tagging process:', error);
    }
}
