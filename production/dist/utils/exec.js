"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execAsync = execAsync;
const child_process_1 = require("child_process");
function execAsync(command) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else {
                resolve({ stdout, stderr });
            }
        });
    });
}
