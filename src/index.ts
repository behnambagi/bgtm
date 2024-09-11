import { updateProject } from './commands/update';
import { tagProject } from './commands/tag';

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
