import yargs from 'yargs';
import { createReadlineInterface } from '../utils/readline';
import { execAsync } from '../utils/exec';

const argv = yargs.argv;
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

async function getNewVersion(latestTag: string, options: TaggingOptions): Promise<string> {
    if (options.handly) {
        console.log(`Latest version is: ${latestTag}`);
        return new Promise((resolve) => {
            rl.question('Enter the new version (e.g., v1.2.3): ', (newVersionInput) => {
                resolve(newVersionInput);
            });
        });
    } else {
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

        return new Promise((resolve) => {
            rl.question('Enter tag prefix (v for release, dev for development): ', (prefix) => {
                resolve(`${prefix}${versionWithoutPrefix}`);
            });
        });
    }
}

async function confirmTagging(
    newVersion: string,
    latestTag: string
): Promise<{ branch: string; confirmed: boolean }> {
    return new Promise((resolve) => {
        rl.question('Enter the branch to tag: ', (branch) => {
            console.log(`\nPlease confirm tagging details:`);
            console.log(`- Branch: ${branch}`);
            console.log(`- Last version: ${latestTag}`);
            console.log(`- New version: ${newVersion}`);
            rl.question('Proceed with tagging and pushing? (y/n): ', (confirmation) => {
                resolve({ branch, confirmed: confirmation.toLowerCase() === 'y' });
            });
        });
    });
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

export async function tagProject(options: TaggingOptions): Promise<void> {
    try {
        const repoUrl = await getRepoUrl();
        const latestTag = await getLatestTag();
        const newVersion = await getNewVersion(latestTag, options);

        const { branch, confirmed } = await confirmTagging(newVersion, latestTag);

        if (confirmed) {
            await handleTagging(newVersion, branch);
        } else {
            console.log('Tagging canceled.');
        }
    } catch (error) {
        console.error('Error during tagging process:', error);
    } finally {
        rl.close();
    }
}
