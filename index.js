const { exec } = require('child_process');
const readline = require('readline');
const argv = require('yargs').argv;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Update project with timeout
const updateTimeout = setTimeout(() => {
    console.error('Timeout: Update operation took too long. Check your internet connection.');
    rl.close();
}, 10000); // 10 seconds timeout

exec('git pull', (err, stdout, stderr) => {
    clearTimeout(updateTimeout);

    if (err) {
        console.error(`Error updating project: ${err}`);
        rl.close();
        return;
    }

    // Get repository URL
    exec('git config --get remote.origin.url', (err, stdout, stderr) => {
        if (err) {
            console.error(`Error getting repository URL: ${err}`);
            return;
        }

        const repoUrl = stdout.trim();

        // Get latest tag
        exec('git describe --tags --abbrev=0', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error getting latest tag: ${err}`);
                return;
            }

            const latestTag = stdout.trim();
            const latestVersion = latestTag.replace(/^(v|dev)+/, ''); // Remove one or more occurrences of 'v' or 'dev'
            let [major, minor, patch] = latestVersion.split('.');

            let newVersion;

            if (argv.handly) {
                console.log(`Latest version is: ${latestTag}`);
                rl.question('Enter the new version (e.g., v1.2.3): ', (newVersionInput) => {
                    newVersion = newVersionInput;
                    confirmTagging(newVersion);
                });
            } else {
                patch = parseInt(patch);
                if (patch === 99) {
                    minor = parseInt(minor) + 1;
                    patch = 1;
                } else {
                    patch++;
                }

                newVersion = `${major}.${minor.toString().padStart(2, '0')}.${patch.toString().padStart(2, '0')}`;
                rl.question('Enter tag prefix (v for release, dev for development): ', (prefix) => {
                    newVersion = `${prefix}${newVersion}`;
                    confirmTagging(newVersion);
                });
            }

            function confirmTagging(newVersion) {
                rl.question('Enter the branch to tag: ', (branch) => {
                    console.log(`\nPlease confirm tagging details:`);
                    console.log(`- Branch: ${branch}`);
                    console.log(`- Last version: ${latestTag}`);
                    console.log(`- New version: ${newVersion}`);
                    rl.question('Proceed with tagging and pushing? (y/n): ', (confirmation) => {
                        if (confirmation.toLowerCase() === 'y') {
                            handleTagging(newVersion, branch);
                        } else {
                            console.log('Tagging canceled.');
                            rl.close();
                        }
                    });
                });
            }

            function handleTagging(newVersion, branch) {
                const pushTimeout = setTimeout(() => {
                    console.error('Timeout: Push operation took too long.');
                    handlePushFailure(newVersion);
                }, 10000);

                exec(`git tag -a ${newVersion} -m "New version ${newVersion}" ${branch}`, (err) => {
                    if (err) {
                        console.error(`Error tagging: ${err}`);
                        rl.close();
                        return;
                    }

                    exec(`git push origin ${newVersion}`, (err) => {
                        clearTimeout(pushTimeout);

                        if (err) {
                            console.error(`Error pushing tag: ${err}`);
                            handlePushFailure(newVersion);
                            return;
                        }

                        const pipelineUrl = repoUrl.replace(/\.git$/, '') + `/-/commits/${newVersion}`;
                        console.log(`Pipeline URL: ${pipelineUrl}`);
                        rl.close();
                    });
                });
            }

            function handlePushFailure(newVersion) {
                rl.question('Push failed. Retry (r) or delete tag (d)? ', (choice) => {
                    if (choice.toLowerCase() === 'r') {
                        handleTagging(newVersion);
                    } else if (choice.toLowerCase() === 'd') {
                        exec(`git tag -d ${newVersion}`, (err) => {
                            if (err) {
                                console.error(`Error deleting tag: ${err}`);
                            } else {
                                console.log(`Tag ${newVersion} deleted.`);
                            }
                            rl.close();
                        });
                    } else {
                        console.error('Invalid choice. Exiting.');
                        rl.close();
                    }
                });
            }
        });
    });
});
