"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const update_1 = require("./commands/update");
const tag_1 = require("./commands/tag");
(0, update_1.updateProject)()
    .then(() => {
    const options = {
        handly: process.argv.includes('--handly'),
    };
    return (0, tag_1.tagProject)(options);
})
    .catch((error) => {
    console.error('An error occurred:', error);
    process.exit(1);
});
