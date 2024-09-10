import readline from 'readline';

export function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}
