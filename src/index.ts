import { updateProject } from './commands/update.js';
import { tagProject } from './commands/tag.js';

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
