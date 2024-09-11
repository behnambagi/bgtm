import { createReadlineInterface } from '../utils/readline';
import { execAsync } from '../utils/exec';

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

    while (true) {
        const prefixChoice = await new Promise<string>((resolve) => {
            rl.question(
                'Select tag prefix:\n1. v (for release)\n2. dev (for development)\nEnter your choice (1 or 2): ',
                resolve
            );
        });

        if (prefixChoice === '1' || prefixChoice === '2') {
            const prefix = prefixChoice === '1' ? 'v' : 'dev';
            return `${prefix}${versionWithoutPrefix}`;
        } else {
            console.error('Invalid choice. Please enter 1 or 2.');
        }
    }
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
    return new Promise(async (resolve) => {
        let branch = ''; // Initialize branch variable
        let confirmed = false;

        while (!confirmed) {
            // Fetch all branches
            const { stdout: branchesOutput } = await execAsync('git branch');
            const branches = branchesOutput
                .split('\n')
                .map((branch) => branch.trim().replace(/^\* /, '')) // Remove '* ' at the beginning
                .filter((branch) => branch !== '');

            // Display branches as a numbered list
            console.log('\nAvailable branches:');
            branches.forEach((branch, index) => {
                console.log(`${index + 1}. ${branch}`);
            });

            const branchChoice = await new Promise<string>((resolve) => {
                rl.question('Select the branch to tag (enter the number): ', resolve);
            });

            const selectedBranchIndex = parseInt(branchChoice) - 1;

            if (
                isNaN(selectedBranchIndex) ||
                selectedBranchIndex < 0 ||
                selectedBranchIndex >= branches.length
            ) {
                console.error('Invalid branch selection. Please try again.');
                continue; // Re-prompt for branch selection
            }

            branch = branches[selectedBranchIndex];

            console.log(`\nPlease confirm tagging details:`);
            console.log(`- Branch: ${branch}`);
            console.log(`- Last version: ${latestTag}`);
            console.log(`- New version: ${newVersion}`);

            const confirmation = await new Promise<string>((resolve) => {
                rl.question('Proceed with tagging and pushing? (y/n): ', resolve);
            });

            confirmed = confirmation.toLowerCase() === 'y' || confirmation.toLowerCase() === '';
        }

        resolve({ branch, confirmed });

    });
}

async function handleTagging(newVersion: string, branch: string): Promise<void> {
    console.log(newVersion, branch)
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

export async function tagProject(options: TaggingOptions): Promise<void> {
    try {
        const latestTag = await getLatestTag();
        const newVersion = await getNewVersion(latestTag, options);

        const { branch, confirmed } = await confirmTagging(newVersion, latestTag);

        if (confirmed) {
            await handleTagging(newVersion, branch);
        } else {
            console.log('Tagging canceled.');
            rl.close();
        }
    } catch (error) {
        console.error('Error during tagging process:', error);
    }
}
