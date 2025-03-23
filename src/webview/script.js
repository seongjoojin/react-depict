// 전역 변수로 노드와 링크 선택자 선언
let nodeSelection;
let linkSelection;
let svgSelection;
let zoomInstance;
let activeFilters = {
  component: true,
  hook: true,
  util: true,
  constant: true
};

// 그래프 시각화 구현
function renderGraph() {
  // 그래프 크기 및 설정
  const width = document.getElementById('graph').clientWidth;
  const height = document.getElementById('graph').clientHeight;
  
  // SVG 생성
  const svg = d3.select('#graph')
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  svgSelection = svg;
  
  // 메인 그룹 생성 (변환 및 줌을 위해)
  const g = svg.append('g');
  
  // 마커 정의 (화살표)
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#555');
  
  // 줌 기능 추가
  const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on('zoom', function(event) {
      g.attr('transform', event.transform);
    });
  
  zoomInstance = zoom;
  svg.call(zoom);
  
  // 초기 중앙 위치
  const initialTransform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(0.8);
    
  svg.call(zoom.transform, initialTransform);
  
  // 시뮬레이션 설정
  const simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.links).id(function(d) { return d.id; }).distance(150))
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(80))
    .alphaDecay(0.05); // 안정화 속도 조절
  
  // 링크(엣지) 생성
  const link = g.append('g')
    .selectAll('path')
    .data(graphData.links)
    .join('path')
    .attr('class', 'link')
    .attr('marker-end', 'url(#arrowhead)');
  
  linkSelection = link;
  
  // 노드 그룹 생성
  const node = g.append('g')
    .selectAll('.node')
    .data(graphData.nodes)
    .join('g')
    .attr('class', function(d) {
      return 'node type-' + (d.type || 'component');
    })
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));
  
  nodeSelection = node;
  
  // 노드 사각형 추가
  node.append('rect')
    .attr('width', function(d) { return Math.max(d.id.length * 12, 120); })
    .attr('height', 50)
    .attr('x', function(d) { return -Math.max(d.id.length * 6, 60); })
    .attr('y', -25);
  
  // 타입 배지 추가
  node.append('circle')
    .attr('class', function(d) { 
      return 'type-badge type-' + (d.type || 'component'); 
    })
    .attr('r', 8)
    .attr('cx', function(d) { return Math.max(d.id.length * 6, 60) - 15; })
    .attr('cy', -15)
    .attr('fill', function(d) {
      const typeColors = {
        'component': '#61dafb', // React Blue
        'hook': '#ff6b81',      // 분홍색 
        'util': '#feca57',      // 노란색
        'constant': '#54a0ff'   // 파란색
      };
      return typeColors[d.type || 'component'];
    });
    
  // 타입 배지 안에 텍스트
  node.append('text')
    .attr('class', 'type-badge-text')
    .attr('x', function(d) { return Math.max(d.id.length * 6, 60) - 15; })
    .attr('y', -12)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#000')
    .text(function(d) {
      const typeShort = {
        'component': 'C',
        'hook': 'H',
        'util': 'U',
        'constant': 'K'
      };
      return typeShort[d.type || 'component'];
    });
  
  // 상단 정보 표시 영역 추가 (더 큰 노드로)
  node.append('rect')
    .attr('class', 'node-info')
    .attr('width', function(d) { return Math.max(d.id.length * 12, 120); })
    .attr('height', 30)
    .attr('x', function(d) { return -Math.max(d.id.length * 6, 60); })
    .attr('y', -60)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', '#2d2d2d')
    .attr('cursor', 'pointer')
    .on('click', function(event, d) {
      event.stopPropagation();
      focusNode(d.id);
    });
    
  // 사용 횟수 및 자식 수 텍스트 추가
  node.append('text')
    .attr('class', 'node-stats')
    .attr('dy', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#cccccc')
    .attr('font-size', '12px')
    .text(function(d) {
      const childrenCount = graphData.links.filter(function(link) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        return sourceId === d.id;
      }).length;
      return 'Used ' + (d.usedCount || 0) + ' times | Has ' + childrenCount + ' children';
    })
    .attr('cursor', 'pointer')
    .on('click', function(event, d) {
      event.stopPropagation();
      focusNode(d.id);
    });
  
  // 노드 텍스트 추가
  node.append('text')
    .attr('x', 0)
    .attr('y', 5)
    .attr('text-anchor', 'middle')
    .attr('font-weight', 'bold')
    .text(function(d) { return d.id; });
  
  // 노드 파일 경로 텍스트 추가 (선택적)
  node.filter(function(d) { return d.filePath; })
    .append('text')
    .attr('x', 0)
    .attr('y', 25)
    .attr('text-anchor', 'middle')
    .attr('font-size', 'smaller')
    .attr('fill', '#777')
    .text(function(d) { 
      const path = d.filePath || '';
      // 경로가 너무 길면 축약
      return path.length > 30 ? '...' + path.substring(path.length - 30) : path;
    });
  
  // 툴팁 추가
  node.append('title')
    .text(function(d) { 
      return '이름: ' + d.id + 
             '\n타입: ' + (d.type || 'component') + 
             (d.filePath ? '\n파일: ' + d.filePath : '') + 
             '\n사용 횟수: ' + (d.usedCount || 0);
    });
  
  // 그래프 배경 클릭 시 하이라이트 제거
  svg.on('click', function(event) {
    if (event.target.tagName === 'svg' || event.target.id === 'graph') {
      node.classed('highlighted', false)
          .classed('related', false)
          .classed('dimmed', false);
      
      link.classed('highlighted', false)
          .classed('dimmed', false);
      
      document.getElementById('details-panel').style.display = 'none';
    }
  });
  
  // 시뮬레이션 업데이트
  simulation.on('tick', function() {
    link.attr('d', function(d) {
      // 곡선형 엣지
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy);
      return 'M' + d.source.x + ',' + d.source.y + 'A' + dr + ',' + dr + ' 0 0,1 ' + d.target.x + ',' + d.target.y;
    });
    
    node.attr('transform', function(d) { 
      return 'translate(' + d.x + ',' + d.y + ')';
    });
  });
  
  // 시뮬레이션 안정화 시작 전 로깅
  console.log('Simulation started');
  
  // 시뮬레이션이 안정화될 때까지 실행
  simulation.alpha(1).restart();
  
  // 노드 드래그 함수
  function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  
  // 컨트롤 버튼 추가
  const controls = d3.select('#graph')
    .append('div')
    .attr('class', 'controls');
  
  controls.append('button')
    .attr('class', 'control-btn')
    .text('확대')
    .on('click', function() {
      console.log('Zoom in clicked');
      svg.transition().duration(300).call(
        zoom.scaleBy, 1.3
      );
    });
  
  controls.append('button')
    .attr('class', 'control-btn')
    .text('축소')
    .on('click', function() {
      console.log('Zoom out clicked');
      svg.transition().duration(300).call(
        zoom.scaleBy, 0.7
      );
    });
  
  controls.append('button')
    .attr('class', 'control-btn')
    .text('리셋')
    .on('click', function() {
      console.log('Reset clicked');
      svg.transition().duration(500).call(
        zoom.transform, initialTransform
      );
      
      // 하이라이트 초기화
      node.classed('highlighted', false)
          .classed('related', false)
          .classed('dimmed', false);
      
      link.classed('highlighted', false)
          .classed('dimmed', false);
      
      document.getElementById('details-panel').style.display = 'none';
    });
  
  // 검색 기능 추가
  const searchContainer = d3.select('#graph')
    .append('div')
    .attr('class', 'search-container');
  
  const searchInput = searchContainer.append('input')
    .attr('class', 'search-input')
    .attr('type', 'text')
    .attr('placeholder', '컴포넌트 검색...');
  
  searchInput.on('input', function() {
    const searchTerm = this.value.toLowerCase();
    console.log('Searching for:', searchTerm);
    
    if (searchTerm.length < 2) {
      node.classed('dimmed', false);
      return;
    }
    
    // 검색어를 포함하는 노드만 밝게 표시
    node.each(function(d) {
      const isMatch = d.id.toLowerCase().includes(searchTerm);
      d3.select(this).classed('dimmed', !isMatch);
    });
  });
  
  // 필터 컨테이너 추가
  const filterContainer = d3.select('#graph')
    .append('div')
    .attr('class', 'filter-container');
    
  // 컴포넌트 필터 버튼
  filterContainer.append('div')
    .attr('class', 'filter-btn component active')
    .html('<input type="checkbox" class="checkbox" checked> 컴포넌트')
    .on('click', function() {
      const isActive = d3.select(this).classed('active');
      d3.select(this).classed('active', !isActive);
      d3.select(this).select('input').property('checked', !isActive);
      activeFilters.component = !isActive;
      applyFilters();
    });
    
  // 훅 필터 버튼
  filterContainer.append('div')
    .attr('class', 'filter-btn hook active')
    .html('<input type="checkbox" class="checkbox" checked> 훅')
    .on('click', function() {
      const isActive = d3.select(this).classed('active');
      d3.select(this).classed('active', !isActive);
      d3.select(this).select('input').property('checked', !isActive);
      activeFilters.hook = !isActive;
      applyFilters();
    });
    
  // 유틸 필터 버튼
  filterContainer.append('div')
    .attr('class', 'filter-btn util active')
    .html('<input type="checkbox" class="checkbox" checked> 유틸')
    .on('click', function() {
      const isActive = d3.select(this).classed('active');
      d3.select(this).classed('active', !isActive);
      d3.select(this).select('input').property('checked', !isActive);
      activeFilters.util = !isActive;
      applyFilters();
    });
    
  // 상수 필터 버튼
  filterContainer.append('div')
    .attr('class', 'filter-btn constant active')
    .html('<input type="checkbox" class="checkbox" checked> 상수')
    .on('click', function() {
      const isActive = d3.select(this).classed('active');
      d3.select(this).classed('active', !isActive);
      d3.select(this).select('input').property('checked', !isActive);
      activeFilters.constant = !isActive;
      applyFilters();
    });
    
  // 필터 적용 함수
  function applyFilters() {
    node.each(function(d) {
      const type = d.type || 'component';
      const visible = activeFilters[type];
      d3.select(this).style('display', visible ? 'block' : 'none');
    });
    
    // 링크도 필터링
    link.each(function(d) {
      const sourceNode = graphData.nodes.find(function(n) { return n.id === d.source.id; });
      const targetNode = graphData.nodes.find(function(n) { return n.id === d.target.id; });
      
      if (!sourceNode || !targetNode) {
        d3.select(this).style('display', 'none');
        return;
      }
      
      const sourceType = sourceNode.type || 'component';
      const targetType = targetNode.type || 'component';
      const sourceVisible = activeFilters[sourceType];
      const targetVisible = activeFilters[targetType];
      
      d3.select(this).style('display', (sourceVisible && targetVisible) ? 'block' : 'none');
    });
  }
}

// 관련 노드 하이라이트 함수
function highlightRelatedNodes(selectedNode) {
  console.log('Highlighting node:', selectedNode.id);
  
  // 모든 노드와 링크를 흐리게 처리
  nodeSelection.classed('highlighted', false)
      .classed('related', false)
      .classed('dimmed', true);
  
  linkSelection.classed('highlighted', false)
      .classed('dimmed', true);
  
  // 직접 연결된 노드 찾기
  const connectedNodeIds = new Set();
  
  // 나가는 링크
  const outgoingLinks = graphData.links.filter(function(l) {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    return sourceId === selectedNode.id;
  });
  
  outgoingLinks.forEach(function(l) {
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    connectedNodeIds.add(targetId);
  });
  
  // 들어오는 링크
  const incomingLinks = graphData.links.filter(function(l) {
    const targetId = typeof l.target === 'object' ? l.target.id : l.target;
    return targetId === selectedNode.id;
  });
  
  incomingLinks.forEach(function(l) {
    const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
    connectedNodeIds.add(sourceId);
  });
  
  console.log('Connected nodes:', Array.from(connectedNodeIds));
  
  // 관련 노드를 하이라이트
  nodeSelection.filter(function(d) { return connectedNodeIds.has(d.id); })
      .classed('related', true)
      .classed('dimmed', false);
  
  // 관련 링크를 하이라이트
  linkSelection.each(function(d) {
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
    
    const isRelated = (sourceId === selectedNode.id) || (targetId === selectedNode.id);
    d3.select(this)
      .classed('highlighted', isRelated)
      .classed('dimmed', !isRelated);
  });
  
  // 선택한 노드를 하이라이트
  nodeSelection.filter(function(d) { return d.id === selectedNode.id; })
      .classed('highlighted', true)
      .classed('dimmed', false);
}

// 상세 정보 표시 함수
function showNodeDetails(node) {
  const detailsPanel = document.getElementById('details-panel');
  if (!detailsPanel) return;
  
  // 의존성 및 의존자 목록 계산
  const dependencies = graphData.links
    .filter(function(link) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      return sourceId === node.id;
    })
    .map(function(link) {
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return graphData.nodes.find(function(n) { return n.id === targetId; });
    });
  
  const dependents = graphData.links
    .filter(function(link) {
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return targetId === node.id;
    })
    .map(function(link) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      return graphData.nodes.find(function(n) { return n.id === sourceId; });
    });
  
  // 노드 타입에 따른 아이콘 및 라벨
  const typeInfo = {
    'component': { icon: '🧩', label: '컴포넌트' },
    'hook': { icon: '🪝', label: '훅' },
    'util': { icon: '🔧', label: '유틸리티' },
    'constant': { icon: '📋', label: '상수' }
  };
  
  const nodeType = node.type || 'component';
  const { icon, label } = typeInfo[nodeType];
  
  // 의존성 목록 HTML 생성
  let dependenciesHtml = '<li class="dep-item">의존성 없음</li>';
  if (dependencies.length > 0) {
    dependenciesHtml = '';
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      if (!dep) continue;
      const depType = dep.type || 'component';
      const depTypeLabel = typeInfo[depType].label;
      const safeId = dep.id.replace(/'/g, "\\'");
      dependenciesHtml += '<li class="dep-item" onclick="focusNode(\'' + safeId + '\')">' +
        dep.id +
        '<span class="badge badge-' + depType + '">' + depTypeLabel + '</span>' +
      '</li>';
    }
  }
  
  // 의존자 목록 HTML 생성
  let dependentsHtml = '<li class="dep-item">의존자 없음</li>';
  if (dependents.length > 0) {
    dependentsHtml = '';
    for (let i = 0; i < dependents.length; i++) {
      const dep = dependents[i];
      if (!dep) continue;
      const depType = dep.type || 'component';
      const depTypeLabel = typeInfo[depType].label;
      const safeId = dep.id.replace(/'/g, "\\'");
      dependentsHtml += '<li class="dep-item" onclick="focusNode(\'' + safeId + '\')">' +
        dep.id +
        '<span class="badge badge-' + depType + '">' + depTypeLabel + '</span>' +
      '</li>';
    }
  }
  
  // HTML 문자열 구성
  let html = '';
  html += '<div class="details-content">';
  html +=   '<div class="details-header">';
  html +=     '<h3 class="node-title">';
  html +=       '<span class="node-icon">' + icon + '</span>';
  html +=       node.id;
  html +=     '</h3>';
  html +=     '<div class="node-type-badge type-' + nodeType + '">' + label + '</div>';
  html +=   '</div>';
  
  html +=   '<div class="stats-container">';
  html +=     '<div class="stat-item">';
  html +=       '<div class="stat-value">' + (node.usedCount || 0) + '</div>';
  html +=       '<div class="stat-label">사용 횟수</div>';
  html +=     '</div>';
  html +=     '<div class="stat-item">';
  html +=       '<div class="stat-value">' + dependencies.length + '</div>';
  html +=       '<div class="stat-label">의존성 수</div>';
  html +=     '</div>';
  html +=     '<div class="stat-item">';
  html +=       '<div class="stat-value">' + dependents.length + '</div>';
  html +=       '<div class="stat-label">의존자 수</div>';
  html +=     '</div>';
  html +=   '</div>';
  
  html +=   '<div class="file-path">';
  html +=     '<span class="path-label">파일 경로:</span> ' + (node.filePath || 'Unknown');
  html +=   '</div>';
  
  html +=   '<h4 class="section-title">의존성 (이 컴포넌트가 사용)</h4>';
  html +=   '<ul class="dep-list">' + dependenciesHtml + '</ul>';
  
  html +=   '<h4 class="section-title">의존자 (이 컴포넌트를 사용)</h4>';
  html +=   '<ul class="dep-list">' + dependentsHtml + '</ul>';
  html += '</div>';
  
  detailsPanel.innerHTML = html;
  detailsPanel.style.display = 'block';
}

// 전역에 노드 포커스 함수 노출
window.focusNode = function(nodeId) {
  console.log('Focusing node:', nodeId);
  const selectedNode = graphData.nodes.find(function(n) { return n.id === nodeId; });
  if (selectedNode) {
    highlightRelatedNodes(selectedNode);
    showNodeDetails(selectedNode);
    
    // 해당 노드로 뷰 이동 (선택된 노드가 중앙에 오도록)
    if (selectedNode.x && selectedNode.y && svgSelection && zoomInstance) {
      const width = document.getElementById('graph').clientWidth;
      const height = document.getElementById('graph').clientHeight;
      
      const transform = d3.zoomTransform(svgSelection.node());
      svgSelection.transition().duration(500).call(
        zoomInstance.transform,
        d3.zoomIdentity
          .translate(width / 2 - selectedNode.x, height / 2 - selectedNode.y)
          .scale(transform.k)
      );
    }
  }
};

// 페이지 로드 시 즉시 실행
document.addEventListener('DOMContentLoaded', renderGraph); 