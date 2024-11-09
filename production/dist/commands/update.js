import { execAsync } from '../utils/exec.js';
export async function updateProject() {
    try {
        await execAsync('git pull');
        console.log('Project updated successfully.');
        return;
    }
    catch (error) {
        console.error('Error updating project:', error);
    }
}
