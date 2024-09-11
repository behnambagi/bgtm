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
exports.updateProject = updateProject;
const exec_1 = require("../utils/exec");
function updateProject() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, exec_1.execAsync)('git pull');
            console.log('Project updated successfully.');
            return;
        }
        catch (error) {
            console.error('Error updating project:', error);
        }
    });
}
