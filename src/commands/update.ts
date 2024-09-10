import { execAsync } from '../utils/exec';

export async function updateProject(): Promise<void> {
    try {
        await execAsync('git pull');
        console.log('Project updated successfully.');
    } catch (error) {
        console.error('Error updating project:', error);
    }
}
