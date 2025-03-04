import * as vscode from 'vscode';


export async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch (err: any) {
        // File doesn't exist if the error indicates a missing file.
        if (err.code === 'FileNotFound' || err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

export async function fileExistsText(uri: string): Promise<boolean> {
    return fileExists(vscode.Uri.file(uri));
}