import { updateProject } from './commands/update';
import { tagProject } from './commands/tag';

// Update project with timeout
setTimeout(() => {
    console.error('Timeout: Update operation took too long. Check your internet connection.');
    process.exit(1);
}, 10000);

updateProject()
    .then(() => {
        const options = {
            handly: process.argv.includes('--handly'),
        };
        return tagProject(options);
    })
    .catch((error: any) => {
        console.error('An error occurred:', error);
        process.exit(1);
    });
