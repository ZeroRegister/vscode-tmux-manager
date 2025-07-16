import * as cp from 'child_process';
import * as util from 'util';

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
}