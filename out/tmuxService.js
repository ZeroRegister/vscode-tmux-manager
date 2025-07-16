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
    async getTmuxTree() {
        try {
            const [windowsOutput, panesOutput] = await Promise.all([
                exec('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}"'),
                exec('tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_current_command}"')
            ]);
            const panesByWindow = {};
            if (panesOutput.stdout) {
                panesOutput.stdout.trim().split('\n').forEach(line => {
                    const [sessionName, windowIndex, paneIndex, paneCommand] = line.split(':');
                    const key = `${sessionName}:${windowIndex}`;
                    if (!panesByWindow[key]) {
                        panesByWindow[key] = [];
                    }
                    panesByWindow[key].push({ sessionName, windowIndex, index: paneIndex, command: paneCommand });
                });
            }
            const windowsBySession = {};
            if (windowsOutput.stdout) {
                windowsOutput.stdout.trim().split('\n').forEach(line => {
                    const [sessionName, windowIndex, windowName] = line.split(':');
                    const key = `${sessionName}:${windowIndex}`;
                    if (!windowsBySession[sessionName]) {
                        windowsBySession[sessionName] = [];
                    }
                    windowsBySession[sessionName].push({
                        sessionName,
                        index: windowIndex,
                        name: windowName,
                        panes: panesByWindow[key] || []
                    });
                });
            }
            const sessions = Object.keys(windowsBySession).map(sessionName => ({
                name: sessionName,
                windows: windowsBySession[sessionName]
            }));
            return sessions;
        }
        catch (error) {
            // tmux not installed or no server running
            return [];
        }
    }
    async getSessions() {
        try {
            const { stdout } = await exec('tmux ls -F "#{session_name}"');
            if (stdout) {
                return stdout.trim().split('\n');
            }
            return [];
        }
        catch (error) {
            return [];
        }
    }
    async renameSession(oldName, newName) {
        try {
            await exec(`tmux rename-session -t "${oldName}" "${newName}"`);
        }
        catch (error) {
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
    async killWindow(sessionName, windowIndex) {
        try {
            await exec(`tmux kill-window -t "${sessionName}:${windowIndex}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to kill window: ${errorMessage}`);
        }
    }
    async killPane(sessionName, windowIndex, paneIndex) {
        try {
            await exec(`tmux kill-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to kill pane: ${errorMessage}`);
        }
    }
    async selectWindow(sessionName, windowIndex) {
        try {
            await exec(`tmux select-window -t "${sessionName}:${windowIndex}"`);
        }
        catch (error) {
            // Don't show error message here, as it might be confusing if attach works.
        }
    }
    async selectPane(sessionName, windowIndex, paneIndex) {
        try {
            await exec(`tmux select-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
        }
        catch (error) {
            // Don't show error message here.
        }
    }
}
exports.TmuxService = TmuxService;
//# sourceMappingURL=tmuxService.js.map