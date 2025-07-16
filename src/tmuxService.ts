import * as cp from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';

const exec = util.promisify(cp.exec);

export class TmuxService {
    public async getSessions(): Promise<string[]> {
        try {
            const { stdout } = await exec('tmux ls -F "#{session_name}"');
            if (stdout) {
                return stdout.trim().split('\n');
            }
            return [];
        } catch (error) {
            // tmux not installed or no server running
            return [];
        }
    }

    public async renameSession(oldName: string, newName: string): Promise<void> {
        try {
            await exec(`tmux rename-session -t "${oldName}" "${newName}"`);
        } catch (error) {
            // Handle error, e.g., show a message to the user
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to rename session: ${errorMessage}`);
        }
    }

    public async newSession(sessionName: string): Promise<void> {
        try {
            await exec(`tmux new-session -d -s "${sessionName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to create session: ${errorMessage}`);
            // Re-throw the error to be caught by the command handler
            throw error;
        }
    }

    public async deleteSession(sessionName: string): Promise<void> {
        try {
            await exec(`tmux kill-session -t "${sessionName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to delete session: ${errorMessage}`);
        }
    }
}