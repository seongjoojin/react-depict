import * as path from 'path';
import * as fs from 'fs';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { JSXOpeningElement, ImportDeclaration, FunctionDeclaration, VariableDeclaration } from '@babel/types';
import * as vscode from 'vscode';

interface ComponentNode {
  id: string;
  children: string[];
  filePath?: string;
  type?: 'component' | 'hook' | 'util' | 'constant';
  usedCount?: number;
}

interface ParseOptions {
  maxNodes?: number;
  includeLibraries?: boolean;
  focusComponent?: string;
  importDepth?: number;
}

export async function parseProject(
  rootPath: string, 
  options: ParseOptions = {}
): Promise<ComponentNode[]> {
  // 기본 옵션 설정
  const defaultOptions: Required<ParseOptions> = {
    maxNodes: 150,           // 최대 노드 수 제한
    includeLibraries: false, // 외부 라이브러리 의존성 포함 여부
    focusComponent: '',      // 특정 컴포넌트 중심으로 분석
    importDepth: 2           // 분석할 임포트 깊이
  };
  
  const opts = { ...defaultOptions, ...options };
  
  const components = new Map<string, Set<string>>();
  const parsedFiles = new Set<string>();
  const skippedFiles = new Set<string>();
  const filePathMap = new Map<string, string>();
  const nodeTypeMap = new Map<string, string>(); // 노드 유형 저장
  const usedCountMap = new Map<string, number>(); // 사용 횟수 저장

  function isImportantNode(name: string): boolean {
    // 중요도 판단 함수: 비즈니스 로직 이름이나 중요 컴포넌트 이름 등을 우선시
    if (name.length <= 2) return false; // 너무 짧은 이름 제외
    
    // 컴포넌트처럼 보이는 이름
    if (name[0] === name[0].toUpperCase() && !name.includes('_') && 
        !name.startsWith('USE_') && !name.endsWith('_TYPE')) {
      return true;
    }
    
    // 중요한 훅이나 함수
    if (name.startsWith('use') && name.length > 4) {
      return true;
    }
    
    // 주요 유틸리티나 서비스
    if (name.includes('Service') || name.includes('Manager') || name.includes('Factory')) {
      return true;
    }
    
    // 예외 목록 - 일반적인 변수/상수명은 제외
    const commonNames = ['props', 'state', 'data', 'response', 'result', 'config', 'styles'];
    if (commonNames.includes(name.toLowerCase())) {
      return false;
    }
    
    return false;
  }

  function getNodeType(name: string): 'component' | 'hook' | 'util' | 'constant' {
    if (name[0] === name[0].toUpperCase() && !name.includes('_')) {
      return 'component';
    }
    if (name.startsWith('use')) {
      return 'hook';
    }
    if (name === name.toUpperCase()) {
      return 'constant';
    }
    return 'util';
  }

  function processFile(filePath: string, depth = 0) {
    try {
      if (parsedFiles.has(filePath) || skippedFiles.has(filePath)) {
        return;
      }
      
      if (filePath.endsWith('.d.ts') || filePath.includes('node_modules')) {
        skippedFiles.add(filePath);
        return;
      }
      
      // 분석 깊이 제한 (지정된 깊이 이상으로는 분석하지 않음)
      if (depth > opts.importDepth && !opts.focusComponent) {
        return;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (content.length > 500000) {
        skippedFiles.add(filePath);
        return;
      }
      
      parsedFiles.add(filePath);
      
      const ast = parser.parse(content, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['jsx', 'typescript', 'classProperties']
      });

      let currentComponent = '';
      let isComponentFile = false;
      const localImports = new Set<string>(); // 현재 파일에서 로컬 임포트 추적

      traverse(ast, {
        FunctionDeclaration(nodePath: NodePath<FunctionDeclaration>) {
          try {
            if (nodePath.node.id?.name) {
              const name = nodePath.node.id.name;
              
              // 중요한 노드인지 확인
              if ((name[0] === name[0].toUpperCase() || name.startsWith('use')) && isImportantNode(name)) {
                currentComponent = name;
                filePathMap.set(name, filePath);
                nodeTypeMap.set(name, getNodeType(name));
                isComponentFile = true;
                
                // 특정 컴포넌트에 집중하는 경우, 관련된 것만 처리
                if (opts.focusComponent && !name.includes(opts.focusComponent)) {
                  isComponentFile = false;
                }
              }
            }
          } catch (e) {
            // 오류 무시
          }
        },
        
        VariableDeclaration(nodePath: NodePath<VariableDeclaration>) {
          try {
            const declarations = nodePath.node.declarations;
            for (const declaration of declarations) {
              if (declaration.id.type === 'Identifier') {
                const name = declaration.id.name;
                if (isImportantNode(name)) {
                  currentComponent = name;
                  filePathMap.set(name, filePath);
                  nodeTypeMap.set(name, getNodeType(name));
                  isComponentFile = true;
                  
                  // 특정 컴포넌트에 집중하는 경우, 관련된 것만 처리
                  if (opts.focusComponent && !name.includes(opts.focusComponent)) {
                    isComponentFile = false;
                  }
                }
              }
            }
          } catch (e) {
            // 오류 무시
          }
        },
        
        ImportDeclaration(nodePath: NodePath<ImportDeclaration>) {
          try {
            const source = nodePath.node.source.value;
            if (typeof source === 'string') {
              // 로컬 임포트인지 확인
              const isLocalImport = source.startsWith('.');
              
              // 외부 라이브러리를 포함할지 여부 확인
              if (!isLocalImport && !opts.includeLibraries) {
                return;
              }
              
              let importedNames: string[] = [];
              
              nodePath.node.specifiers.forEach(specifier => {
                if (specifier.type === 'ImportDefaultSpecifier' || 
                    specifier.type === 'ImportSpecifier') {
                  const importedName = specifier.local.name;
                  
                  // 중요한 임포트만 추가
                  if (isImportantNode(importedName)) {
                    importedNames.push(importedName);
                    
                    // 로컬 임포트 추적
                    if (isLocalImport) {
                      localImports.add(importedName);
                    }
                    
                    // 사용 횟수 증가
                    usedCountMap.set(
                      importedName, 
                      (usedCountMap.get(importedName) || 0) + 1
                    );
                  }
                }
              });
              
              if (currentComponent && importedNames.length > 0 && isComponentFile) {
                const dependencies = components.get(currentComponent) || new Set();
                importedNames.forEach(name => dependencies.add(name));
                components.set(currentComponent, dependencies);
              }
              
              // 로컬 임포트의 경우 해당 파일도 처리
              if (isLocalImport && depth < opts.importDepth) {
                try {
                  const importedFilePath = resolveImportPath(source, path.dirname(filePath));
                  if (importedFilePath) {
                    processFile(importedFilePath, depth + 1);
                  }
                } catch (e) {
                  // 임포트 경로 해석 오류 무시
                }
              }
            }
          } catch (e) {
            // 오류 무시
          }
        },
        
        JSXOpeningElement(nodePath: NodePath<JSXOpeningElement>) {
          try {
            const elementName = nodePath.node.name;
            if (elementName.type === 'JSXIdentifier') {
              const componentName = elementName.name;
              if (componentName[0] === componentName[0].toUpperCase() && 
                  currentComponent && isComponentFile && 
                  isImportantNode(componentName)) {
                
                components.set(currentComponent, 
                  components.get(currentComponent) || new Set()
                ).get(currentComponent)!.add(componentName);
                
                // 사용 횟수 증가
                usedCountMap.set(
                  componentName, 
                  (usedCountMap.get(componentName) || 0) + 1
                );
              }
            }
          } catch (e) {
            // 오류 무시
          }
        }
      });
    } catch (error: unknown) {
      skippedFiles.add(filePath);
    }
  }

  // 임포트 경로 해석 함수
  function resolveImportPath(importPath: string, basePath: string): string | null {
    try {
      // 확장자가 있는 경우
      if (importPath.endsWith('.ts') || importPath.endsWith('.tsx') || 
          importPath.endsWith('.js') || importPath.endsWith('.jsx')) {
        return path.resolve(basePath, importPath);
      }
      
      // 확장자가 없는 경우 가능한 확장자 시도
      const extensions = ['.tsx', '.ts', '.jsx', '.js'];
      for (const ext of extensions) {
        const fullPath = path.resolve(basePath, `${importPath}${ext}`);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
      
      // index 파일 시도
      for (const ext of extensions) {
        const indexPath = path.resolve(basePath, importPath, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  function walkDir(dir: string) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        try {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          // 무시할 디렉토리나 파일 패턴
          if (filePath.includes('node_modules') || file.startsWith('.') || 
              file.includes('test') || file.includes('dist')) {
            continue;
          }
          
          if (stats.isDirectory()) {
            walkDir(filePath);
          } else if (file.endsWith('.tsx') || file.endsWith('.jsx') || 
                     file.endsWith('.ts') || file.endsWith('.js')) {
            // 특정 컴포넌트에 집중하는 경우 파일명 필터링
            if (opts.focusComponent && !filePath.includes(opts.focusComponent)) {
              continue;
            }
            processFile(filePath);
          }
        } catch (fileError) {
          // 오류 무시
        }
      }
    } catch (dirError) {
      // 오류 무시
    }
  }

  try {
    walkDir(rootPath);
    
    // 중요도에 따라 노드 필터링
    let result = Array.from(components.entries())
      .map(([id, children]) => ({
        id,
        children: Array.from(children),
        filePath: filePathMap.get(id) || `unknown/${id}`,
        type: nodeTypeMap.get(id) as 'component' | 'hook' | 'util' | 'constant' || 'component',
        usedCount: usedCountMap.get(id) || 1
      }))
      // 중요한 노드 우선 정렬
      .sort((a, b) => {
        // 컴포넌트 > 훅 > 유틸 > 상수 순서로 정렬
        const typeOrder = { component: 0, hook: 1, util: 2, constant: 3 };
        const typeComparison = typeOrder[a.type || 'util'] - typeOrder[b.type || 'util'];
        
        if (typeComparison !== 0) return typeComparison;
        
        // 사용 횟수 많은 순
        return (b.usedCount || 0) - (a.usedCount || 0);
      });
    
    // 최대 노드 수 제한
    if (result.length > opts.maxNodes) {
      result = result.slice(0, opts.maxNodes);
      
      // 자식 노드도 필터링된 노드에 있는 것만 포함
      const validIds = new Set(result.map(node => node.id));
      result.forEach(node => {
        node.children = node.children.filter(childId => validIds.has(childId));
      });
    }
    
    const componentCount = result.length;
    vscode.window.showInformationMessage(
      `총 ${componentCount}개의 중요 컴포넌트와 함수를 분석했습니다. ` +
      `(${components.size}개 중 ${componentCount}개 표시)`
    );
    
    return result;
  } catch (error: unknown) {
    vscode.window.showErrorMessage(`분석 중 오류가 발생했습니다.`);
    return [];
  }
}