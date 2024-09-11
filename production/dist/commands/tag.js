"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagProject = tagProject;
const readline_1 = require("../utils/readline");
const exec_1 = require("../utils/exec");
const rl = (0, readline_1.createReadlineInterface)();
function getRepoUrl() {
    return __awaiter(this, void 0, void 0, function* () {
        const { stdout } = yield (0, exec_1.execAsync)('git config --get remote.origin.url');
        return stdout.trim();
    });
}
function getLatestTag() {
    return __awaiter(this, void 0, void 0, function* () {
        const { stdout } = yield (0, exec_1.execAsync)('git describe --tags --abbrev=0');
        return stdout.trim();
    });
}
function parseLatestVersion(latestTag) {
    const latestVersion = latestTag.replace(/^(v|dev)+/, '');
    const [major, minor, patch] = latestVersion.split('.');
    return [parseInt(major), parseInt(minor), parseInt(patch)];
}
function getManualNewVersion(latestTag) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Latest version is: ${latestTag}`);
        while (true) { // Loop until valid input is received
            const newVersionInput = yield new Promise((resolve) => {
                rl.question('Enter the new version (e.g., v1.2.3): ', resolve);
            });
            // Basic validation: check if it starts with 'v' or 'dev'
            if (/^(v|dev)/.test(newVersionInput)) {
                return newVersionInput;
            }
            else {
                console.error('Invalid version format. Please start with "v" or "dev".');
            }
        }
    });
}
function getAutomatedNewVersion(latestTag) {
    return __awaiter(this, void 0, void 0, function* () {
        const [major, minor, patch] = parseLatestVersion(latestTag);
        let newPatch = patch;
        let newMinor = minor;
        if (patch === 99) {
            newMinor = minor + 1;
            newPatch = 1;
        }
        else {
            newPatch++;
        }
        const versionWithoutPrefix = `${major}.${newMinor
            .toString()
            .padStart(2, '0')}.${newPatch.toString().padStart(2, '0')}`;
        while (true) {
            const prefixChoice = yield new Promise((resolve) => {
                rl.question('Select tag prefix:\n1. v (for release)\n2. dev (for development)\nEnter your choice (1 or 2): ', resolve);
            });
            if (prefixChoice === '1' || prefixChoice === '2') {
                const prefix = prefixChoice === '1' ? 'v' : 'dev';
                return `${prefix}${versionWithoutPrefix}`;
            }
            else {
                console.error('Invalid choice. Please enter 1 or 2.');
            }
        }
    });
}
function getNewVersion(latestTag, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (options.handly) {
            return getManualNewVersion(latestTag);
        }
        else {
            return getAutomatedNewVersion(latestTag);
        }
    });
}
function confirmTagging(newVersion, latestTag) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            let branch = ''; // Initialize branch variable
            let confirmed = false;
            while (!confirmed) {
                // Fetch all branches
                const { stdout: branchesOutput } = yield (0, exec_1.execAsync)('git branch');
                const branches = branchesOutput
                    .split('\n')
                    .map((branch) => branch.trim().replace(/^\* /, '')) // Remove '* ' at the beginning
                    .filter((branch) => branch !== '');
                // Display branches as a numbered list
                console.log('\nAvailable branches:');
                branches.forEach((branch, index) => {
                    console.log(`${index + 1}. ${branch}`);
                });
                const branchChoice = yield new Promise((resolve) => {
                    rl.question('Select the branch to tag (enter the number): ', resolve);
                });
                const selectedBranchIndex = parseInt(branchChoice) - 1;
                if (isNaN(selectedBranchIndex) ||
                    selectedBranchIndex < 0 ||
                    selectedBranchIndex >= branches.length) {
                    console.error('Invalid branch selection. Please try again.');
                    continue; // Re-prompt for branch selection
                }
                branch = branches[selectedBranchIndex];
                console.log(`\nPlease confirm tagging details:`);
                console.log(`- Branch: ${branch}`);
                console.log(`- Last version: ${latestTag}`);
                console.log(`- New version: ${newVersion}`);
                const confirmation = yield new Promise((resolve) => {
                    rl.question('Proceed with tagging and pushing? (y/n): ', resolve);
                });
                confirmed = confirmation.toLowerCase() === 'y' || confirmation.toLowerCase() === '';
            }
            resolve({ branch, confirmed });
        }));
    });
}
function handleTagging(newVersion, branch) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(newVersion, branch);
        try {
            yield (0, exec_1.execAsync)(`git tag -a ${newVersion} -m "New version ${newVersion}" ${branch}`);
            yield (0, exec_1.execAsync)(`git push origin ${newVersion}`);
            const repoUrl = yield getRepoUrl();
            const pipelineUrl = repoUrl.replace(/\.git$/, '') + `/-/commits/${newVersion}`;
            console.log(`Pipeline URL: ${pipelineUrl}`);
        }
        catch (error) {
            console.error(`Error tagging or pushing: ${error}`);
            handlePushFailure(newVersion);
        }
    });
}
function handlePushFailure(newVersion) {
    rl.question('Push failed. Retry (r) or delete tag (d)? ', (choice) => {
        if (choice.toLowerCase() === 'r') {
            handleTagging(newVersion, ''); // Need to get the branch again if retrying
        }
        else if (choice.toLowerCase() === 'd') {
            (0, exec_1.execAsync)(`git tag -d ${newVersion}`)
                .then(() => console.log(`Tag ${newVersion} deleted.`))
                .catch((error) => console.error(`Error deleting tag: ${error}`))
                .finally(() => rl.close());
        }
        else {
            console.error('Invalid choice. Exiting.');
            rl.close();
        }
    });
}
function tagProject(options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const latestTag = yield getLatestTag();
            const newVersion = yield getNewVersion(latestTag, options);
            const { branch, confirmed } = yield confirmTagging(newVersion, latestTag);
            if (confirmed) {
                yield handleTagging(newVersion, branch);
            }
            else {
                console.log('Tagging canceled.');
                rl.close();
            }
        }
        catch (error) {
            console.error('Error during tagging process:', error);
        }
    });
}
