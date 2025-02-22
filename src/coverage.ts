// src/coverage.ts
import * as vscode from 'vscode';

export class MarkdownFileCoverage extends vscode.FileCoverage {
	constructor(uri: string, public readonly coveredLines: (vscode.StatementCoverage | undefined)[]) {
		super(vscode.Uri.parse(uri), new vscode.TestCoverageCount(0, 0));
		for (const line of coveredLines) {
			if (line) {
				this.statementCoverage.covered += line.executed ? 1 : 0;
				this.statementCoverage.total++;
			}
		}
	}
}