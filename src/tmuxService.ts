import * as cp from 'child_process';
import * as util from 'util';
import * as vscode from 'vscode';
import { TmuxSession, TmuxWindow, TmuxPane } from './types';

const exec = util.promisify(cp.exec);

export class TmuxService {

    public async getTmuxTree(): Promise<TmuxSession[]> {
        try {
            const [windowsOutput, panesOutput] = await Promise.all([
                exec('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}"'),
                exec('tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_current_command}"')
            ]);

            const panesByWindow: { [key: string]: TmuxPane[] } = {};
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

            const windowsBySession: { [key: string]: TmuxWindow[] } = {};
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

            const sessions: TmuxSession[] = Object.keys(windowsBySession).map(sessionName => ({
                name: sessionName,
                windows: windowsBySession[sessionName]
            }));

            return sessions;

        } catch (error) {
            // tmux not installed or no server running
            return [];
        }
    }

    public async getSessions(): Promise<string[]> {
        try {
            const { stdout } = await exec('tmux ls -F "#{session_name}"');
            if (stdout) {
                return stdout.trim().split('\n');
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    public async renameSession(oldName: string, newName: string): Promise<void> {
        try {
            await exec(`tmux rename-session -t "${oldName}" "${newName}"`);
        } catch (error) {
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

    public async killWindow(sessionName: string, windowIndex: string): Promise<void> {
        try {
            await exec(`tmux kill-window -t "${sessionName}:${windowIndex}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to kill window: ${errorMessage}`);
        }
    }

    public async killPane(sessionName: string, windowIndex: string, paneIndex: string): Promise<void> {
        try {
            await exec(`tmux kill-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to kill pane: ${errorMessage}`);
        }
    }

    public async selectWindow(sessionName: string, windowIndex: string): Promise<void> {
        try {
            await exec(`tmux select-window -t "${sessionName}:${windowIndex}"`);
        } catch (error) {
            // Don't show error message here, as it might be confusing if attach works.
        }
    }

    public async selectPane(sessionName: string, windowIndex: string, paneIndex: string): Promise<void> {
        try {
            await exec(`tmux select-pane -t "${sessionName}:${windowIndex}.${paneIndex}"`);
        } catch (error) {
            // Don't show error message here.
        }
    }

    public async newWindow(sessionName: string): Promise<void> {
        try {
            await exec(`tmux new-window -t "${sessionName}"`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to create new window: ${errorMessage}`);
        }
    }

    public async splitPane(targetPane: string, direction: 'h' | 'v'): Promise<void> {
        try {
            await exec(`tmux split-window -t "${targetPane}" -${direction}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to split pane: ${errorMessage}`);
        }
    }
}