"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxService = void 0;
const cp = __importStar(require("child_process"));
const util = __importStar(require("util"));
const vscode = __importStar(require("vscode"));
const exec = util.promisify(cp.exec);
class TmuxService {
    async getSessions() {
        try {
            const { stdout } = await exec('tmux ls -F "#{session_name}"');
            if (stdout) {
                return stdout.trim().split('\n');
            }
            return [];
        }
        catch (error) {
            // tmux not installed or no server running
            return [];
        }
    }
    async renameSession(oldName, newName) {
        try {
            await exec(`tmux rename-session -t "${oldName}" "${newName}"`);
        }
        catch (error) {
            // Handle error, e.g., show a message to the user
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to rename session: ${errorMessage}`);
        }
    }
    async newSession(sessionName) {
        try {
            await exec(`tmux new-session -d -s "${sessionName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to create session: ${errorMessage}`);
            // Re-throw the error to be caught by the command handler
            throw error;
        }
    }
    async deleteSession(sessionName) {
        try {
            await exec(`tmux kill-session -t "${sessionName}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to delete session: ${errorMessage}`);
        }
    }
}
exports.TmuxService = TmuxService;
//# sourceMappingURL=tmuxService.js.map