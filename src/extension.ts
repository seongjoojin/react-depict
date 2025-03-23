import * as vscode from 'vscode';
import { parseProject } from './parser';
import { ReactDependencyAnalyzerView } from './webview';

// 웹뷰 패널을 전역 변수로 관리하여 중복 열림 방지
let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  // 뷰 클래스 인스턴스 생성
  const dependencyView = new ReactDependencyAnalyzerView(context);

  // 특정 컴포넌트 중심으로 분석하는 명령 추가
  const focusDisposable = vscode.commands.registerCommand(
    'react-depict.analyzeFocusedComponent',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('작업 공간이 열려있지 않습니다.');
        return;
      }

      try {
        // 컴포넌트 이름 입력 받기
        const focusComponent = await vscode.window.showInputBox({
          placeHolder: '중심으로 분석할 컴포넌트 이름을 입력하세요',
          prompt: '컴포넌트 이름의 일부만 입력해도 됩니다 (예: Button, TodoList)',
        });

        if (!focusComponent) return; // 사용자가 취소함

        // 상태 표시
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = `$(sync~spin) ${focusComponent} 컴포넌트 분석 중...`;
        statusBarItem.show();

        // 프로젝트 분석 진행 (컴포넌트 중심으로)
        const treeData = await parseProject(workspaceFolders[0].uri.fsPath, {
          focusComponent,
          maxNodes: 50, // 중심 컴포넌트 분석은 더 적은 노드 수로 제한
          importDepth: 3, // 더 깊은 관계까지 분석
        });
        
        // 새 패널 생성
        if (currentPanel) {
          try {
            currentPanel.title;
            currentPanel.dispose();
          } catch (e) {
            // 이미 닫힌 패널
          }
        }
        
        currentPanel = dependencyView.createWebviewPanel(context.extensionUri, treeData);
        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });

        statusBarItem.hide();
        statusBarItem.dispose();
        
        // 완료 메시지 표시
        vscode.window.showInformationMessage(`${focusComponent} 컴포넌트 중심 분석이 완료되었습니다.`);
      } catch (error) {
        console.error('컴포넌트 중심 분석 중 오류 발생:', error);
        vscode.window.showErrorMessage(`분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  context.subscriptions.push(focusDisposable);
}