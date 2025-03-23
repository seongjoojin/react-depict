import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 인터페이스 정의
interface TreeNode {
  id: string;
  children?: string[];
  filePath?: string;
  usedCount?: number;
  type?: 'component' | 'hook' | 'util' | 'constant';
  [key: string]: any;
}

export class ReactDependencyAnalyzerView {
  private panel!: vscode.WebviewPanel;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public createWebviewPanel(
    extensionUri: vscode.Uri,
    treeData: TreeNode[]
  ): vscode.WebviewPanel {
    this.panel = vscode.window.createWebviewPanel(
      'reactDependencyTree',
      'React Dependency Tree',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'web'),
          vscode.Uri.joinPath(extensionUri, 'src', 'webview')
        ]
      }
    );

    // 데이터를 그래프 형식으로 변환
    const graphData = this.prepareGraphData(treeData);
    
    this.panel.webview.html = this.getWebviewContent(graphData);
    
    return this.panel;
  }

  private getWebviewContent(treeData: any) {
    // 웹뷰 리소스 경로 생성
    const scriptUri = this.getWebviewResourceUri('script.js');
    const stylesUri = this.getWebviewResourceUri('styles.css');
    const nonce = this.getNonce();
    
    // HTML 템플릿 읽기
    const htmlPath = path.join(this.context.extensionPath, 'src', 'webview', 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // 리소스 URI와 논스 값 삽입
    htmlContent = htmlContent
      .replace('${scriptUri}', scriptUri.toString())
      .replace('${stylesUri}', stylesUri.toString())
      .replace(/\${nonce}/g, nonce)
      .replace('${graphData}', this.safeStringify(treeData));
    
    return htmlContent;
  }
  
  // 웹뷰 리소스 URI 생성 함수
  private getWebviewResourceUri(fileName: string): vscode.Uri {
    const webviewDir = path.join(this.context.extensionPath, 'src', 'webview');
    const resourcePath = path.join(webviewDir, fileName);
    
    return this.panel.webview.asWebviewUri(vscode.Uri.file(resourcePath));
  }
  
  // CSP 논스 생성 함수
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
  
  // 안전한 JSON 문자열 생성 함수
  private safeStringify(obj: any): string {
    try {
      // 이스케이프된 문자열을 생성하여 JSON.parse에서 사용할 수 있도록 함
      return JSON.stringify(obj)
        .replace(/\\/g, '\\\\')  // 백슬래시를 두 번 이스케이프
        .replace(/'/g, "\\'")    // 작은따옴표 이스케이프
        .replace(/"/g, '\\"');   // 큰따옴표 이스케이프
    } catch (error) {
      console.error('Error stringifying object:', error);
      return '{}';
    }
  }

  // 트리 데이터를 그래프 형식으로 변환하는 함수
  private prepareGraphData(treeData: TreeNode[]): { nodes: any[], links: any[] } {
    // 노드 및 링크 배열 초기화
    const nodes: any[] = [];
    const links: any[] = [];
    
    // 노드 ID 맵 생성 (중복 방지)
    const nodeIds = new Set<string>();
    
    // 노드 추가
    treeData.forEach(function(node) {
      if (!nodeIds.has(node.id)) {
        nodeIds.add(node.id);
        nodes.push({
          id: node.id,
          filePath: node.filePath || `components/${node.id}.tsx`,
          usedCount: node.usedCount || Math.floor(Math.random() * 20) + 1,
          type: node.type || 'component'
        });
      }
      
      // 의존성 링크 추가
      if (node.children && node.children.length > 0) {
        node.children.forEach(function(childId) {
          // 자식 노드가 없다면 추가
          if (!nodeIds.has(childId)) {
            // 자식 노드에 대한 데이터 찾기
            const childNode = treeData.find(function(n) { return n.id === childId; });
            nodeIds.add(childId);
            nodes.push({
              id: childId,
              filePath: childNode?.filePath || `components/${childId}.tsx`,
              usedCount: childNode?.usedCount || Math.floor(Math.random() * 20) + 1,
              type: childNode?.type || 'util' // 기본값으로 util 타입 지정
            });
          }
          
          // 링크 추가
          links.push({
            source: node.id,
            target: childId
          });
        });
      }
    });
    
    return { nodes, links };
  }
}