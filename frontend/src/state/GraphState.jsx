import {cloneDeep, flatten, get, intersection, isEmpty, some, sortBy, sum, uniq, set} from "lodash";
import Graph from "graphology";
// import {bidirectional} from 'graphology-shortest-path/unweighted';
// import {dfsFromNode} from "graphology-traversal/dfs";
import {setOp, } from "../utils";

// window.graphFuncs = {bidirectional, dfsFromNode};

// versions of Set and Map that force keys to be strings
class StringSet extends Set {
  add(value) { super.add(value.toString()); }
  has(value) { return super.has(value.toString()); }
  delete(value) { return super.delete(value.toString()); }
}
class StringKeyMap extends Map {
  set(key, value) { super.set(key.toString(), value); }
  get(key) { return super.get(key.toString()); }
  has(key) { return super.has(key.toString()); }
  delete(key) { return super.delete(key.toString()); }
}

export const makeGraph = (edges, concepts) => {
  const graph = new Graph({allowSelfLoops: false, multi: false, type: 'directed'});
  let nodes = {};
  // add each concept as a node in the graph, the concept properties become the node attributes
  for (let c of concepts) {
    let nodeId = c.concept_id;
    graph.addNode(nodeId);
    nodes[nodeId] = {...c};
  }
  for (let edge of edges) {
    graph.addDirectedEdge(edge[0], edge[1]);
  }
  return [graph, nodes];
};

export class GraphContainer {
  constructor(graphData, /*, cloneThis */) {
    window.graphW = this; // for debugging
    this.gd = graphData;  // concepts, specialConcepts, csmi, edges, concept_ids, filled_gaps,
                          // missing_from_graph, hidden_by_vocab, nonstandard_concepts_hidden
    set(this, 'gd.specialConcepts.allButFirstOccurrence', []);

    [this.graph, this.nodes] = makeGraph(this.gd.edges, this.gd.concepts);

    this.roots = this.graph.nodes().filter(n => !this.graph.inDegree(n));
    this.leaves = this.graph.nodes().filter(n => !this.graph.outDegree(n));

    // for concepts not linked to anything, move them under an artificial
    //  'unlinked' concept, and remove them from this.roots
    this.unlinkedConcepts = intersection(this.roots, this.leaves);

    let unlinkedConceptsParent = {
      concept_id: 'unlinked',
      concept_name: 'Concepts included but not linked to other concepts',
      not_a_concept: true,
      vocabulary_id: '--',
      standard_concept: '',
      total_cnt: 0,
      distinct_person_cnt: '0',
      status: "",
      // hasChildren: true,
      // levelsBelow: 1,
      childIds: this.unlinkedConcepts,
      // childCount: this.unlinkedConcepts.length,
      // descendantCount: this.unlinkedConcepts.length,
      // drc: sum(this.unlinkedConcepts.map(d => this.nodes[d].total_cnt || 0)), // Compute descendant counts
      // descendants: uniq(descendants), // Remove duplicates
    };
    this.graph.addNode('unlinked');
    this.nodes['unlinked'] = unlinkedConceptsParent;
    for (let c of this.unlinkedConcepts) {
      this.graph.addDirectedEdge('unlinked', c);
    }

    // delete unlinked concepts from this.roots
    this.roots = this.graph.nodes().filter(n => !this.graph.inDegree(n));

    this.#computeAttributes();
  }

  getDisplayedRows(graphOptions) {
    /*
      New algorithm
      Special classes           Action              Default
        concepts                expandAll           false
        standard                nothing
        classification          nothing

        specificPaths (expanded/collapsed)

        addedCids               showThoughCollapsed true
        definitionConcepts      showThoughCollapsed false
        added                   showThoughCollapsed false
        removed                 showThoughCollapsed false

        allButFirstOccurrence   hideThoughExpanded  true
        expansionConcepts       hideThoughExpanded  false
        nonStandard             hideThoughExpanded  false
        zeroRecord              hideThoughExpanded  false

      For each row:
        showReasons:
          - showThoughCollapsed (include which option in reason?)
          - hidden parent/ancestor of showThoughCollapsed
          - child of specificPathsExpanded1G
        hideReasons:
          - hideThoughExpanded (include which option?)
          - child of specificPathsCollapsed
          - duplicate occurrence

      TODO:
        [ ] Column shows how many rows hidden below each displayed row
          With tooltip giving reasons
          Too complicated to have expand control in that field
        [ ] If expandAll, default icon is (-), otherwise (+)
          What happens to SNC/SNE when expandAll changes?
          Clear them? Have two sets of SNC/SNE and swap?
          Clear for now, then implement swap maybe

      Cases to think about (test?)
        Shown (definition) concept is descendant of hidden (nonStandard, zeroRecord) concept
          (-) Hidden concept    {hideReasons: [HTE(zero)],  showReasons: [parentOfSTC], result: show}
            (-) Def concept     {hideReasons: [childOfHTE], showReasons: [STC(def)],    result: show}
              (-) Another       {hideReasons: [],           showReasons: [childOfSTC],  result: show}
            (+) Def concept     {hideReasons: [childOfHTE], showReasons: [STC(def)],    result: show}
              (-) Another       {hideReasons: [childOfSNC], showReasons: [],            result: hide}

        Shown (definition) concept is descendant of hidden specificPathsCollapsed concept
          Ideally might depend on order of events, but too hard to code?
            If you collapse a parent of a STC node, expect the STC node to get hidden?
            If you turn show def concepts on while some are hidden undeer SNC, expect them to appear?
            Ok, keep hidden, but implement idea
          (+) Concept           {hideReasons: [],           showReasons: [root],        result: show}
            (-) Def concept     {hideReasons: [childOfSNC], showReasons: [STC(def)],    result: hide}
              (-) Another       {hideReasons: [descOfSNC],  showReasons: [childOfSTC],  result: hide}

        Shown (definition) concept is also hidden (zeroRecord) concept
          (-) Def zero concept  {hideReasons: [HTE(zero)],  showReasons: [STC(def)],    result: show}
          STC takes precedence over HTE

        Hidden (zeroRecord) concept is root
          Don't hide roots (will sort to bottom anyway probably)

        specificNodeCollapsed while expandAll is on
          (currently broken, but should hide descendants)

      1. [ ] Generate allRows: list of all rows, in order, with duplicates
      2. [ ] If allButFirstOccurrence hidden, hide allButFirstOccurrence
          (and their descendants? descendants will be duplicate occurrences
          and hidden anyway)
          crap: what if STC/HTE settings affect which occurrence comes first?
            could that happen?
            having a hard time constructing the case (below). maybe just don't
              worry about it for now?

          (-) Concept 1         {hideReasons: [HTE(zero)],  showReasons: [parentOfSTC], result: show}
            (-) Concept 2       {hideReasons: [childOfHTE], showReasons: [STC(def)],    result: show}
            (-) Concept 3       {hideReasons: [childOfHTE], showReasons: [STC(def)],    result: show}
          ...
          (-) Concept 4         {hideReasons: [],           showReasons: [childOfSNE],  result: show}
            (-) Concept 2       {hideReasons: [childOfHTE], showReasons: [STC(def)],    result: show}
            (-) Concept 3       {hideReasons: [childOfHTE], showReasons: [STC(def)],    result: show}

      3. If expandAll, hide all HTE
      4. If not expandAll, hide everything that's
          a. not a root -- hides everything depth > 0;
      5. Unhide
          a. STC (showThoughCollapsed) That includes ancestors up to
             nearest not collapsed
          b. Child of SNE (specificPathsExpanded)
      6. Hide remaining HTE (hideThoughExpanded)
     */

    // 1. Generate allRows
    let allRows = this.setupAllRows(this.roots);

    if (graphOptions.expandAll) {
      // 3....  no need to expand STC, because nothing collapsed except SNC
    } else {
      // 4. Hide non-root rows; just hide depth > 0;
      for (let row of allRows) {
        if (row.depth > 0) {
          row.display.hideReasons.nonRoot = true;
          row.display.result = 'hide';
        }
      }
      // 5. Unhide STC (showThoughCollapsed)
      /*    maybe don't do this -- TOO COMPLICATED
        const showThoughCollapsed = new StringSet();

        // just for testing/dev
        // showThoughCollapsed.add(4154309);
        this.gd.specialConcepts.definitionConcepts.push('4154309'); // Severe recurrent major depression with psychotic features, down a couple levels

        for (let type in graphOptions.specialConceptTreatment) {
          if (get(this, ['graphDisplayConfig', type, 'specialTreatmentRule']) === 'show though collapsed' &&
              graphOptions.specialConceptTreatment[type]) {
            for (let id of this.gd.specialConcepts[type] || []) {
              showThoughCollapsed.add(id);
            }
          }
        }
        let shown = new StringSet();
        showThoughCollapsed.forEach(nodeIdToShow => {
          if (nodeRows.has(nodeIdToShow)) return; // already displayed
          showThoughCollapsed.add(nodeIdToShow);
          this.insertShowThoughCollapsed([nodeIdToShow], shown, nodeRows);
        });
       */
      // 5a. Expand children of specificPaths: expand, but only for displayed rows


      const hideThoughExpanded = new StringSet();
    }

    // Expand and collapse children based on user having clicked +/- on row
    allRows.forEach((row, rowIdx) => {
      if (row.display.result === 'hide') return;
      if (graphOptions.specificPaths[row.rowPath] === 'collapse') {
        for (let childRow of this.getDescendantRows(rowIdx, allRows)) {
          childRow.display.hideReasons.descendantOfCollapsed = row;
          childRow.display.result = 'hide';
        }
      }
      if (graphOptions.specificPaths[row.rowPath] === 'expand') {
        for (let childRow of this.getDescendantRows(rowIdx, allRows, 1)) {
          childRow.display.showReasons.childOfExpanded = row;
          childRow.display.result = 'show';
        }
      }
    });

    let displayedRows = allRows.filter(r => r.display.result !== 'hide');

    // 2. Get list of allButFirstOccurrence; hide if option on
    let rowsPerId = {};
    displayedRows.forEach(row => {
      if (rowsPerId[row.concept_id]) {
        this.gd.specialConcepts.allButFirstOccurrence.push(row.rowPath);
        if (graphOptions.specialConceptTreatment.allButFirstOccurrence) {
          row.display.hideReasons.duplicate = true;
          row.display.result = 'hide';
        }
      } else {
        rowsPerId[row.concept_id] = 0;
      }
      row.nodeOccurrence = rowsPerId[row.concept_id]++;
    });
    //  this could filter allRows, shouldn't matter
    displayedRows = displayedRows.filter(r => r.display.result !== 'hide');

    // return this.displayedRows.filter(r => r.depth < 3);
    return displayedRows;
    // return this.getDisplayedRowsOLD(graphOptions);
  }
  getDescendantRows(parentRowIdx, allRows, howDeep=Infinity) {
    // sort of a fragile way to do it, but will get all rows deeper
    //  than current row until the next row of the same depth
    // if howDeep is passed, will not return rows that much deeper than current row
    //  so, howDeep = 1 will get direct children, howDeep = 2, children and grandchildren
    // let idx = allRows.indexOf(parentRow) + 1;
    const parentRow = allRows[parentRowIdx];
    let idx = parentRowIdx + 1;
    let rows = [];
    while (idx < allRows.length && allRows[idx].depth > parentRow.depth) {
      if (allRows[idx].depth <= parentRow.depth + howDeep) {
        rows.push(allRows[idx]);
      }
      idx++;
    }
    return rows;
  }
  setupAllRows(rootNodes) {
    let allRows = [];

    // rows and nodes and concepts are all the same thing, I just use the term
    //  that fits the purpose at the moment
    const addRows = (nodeIds, parentPath = '', depth = 0) => {
      let nodes = nodeIds.map(id => this.nodes[id]);
      nodes = sortBy(nodes, this.sortFunc);
      for (let node of nodes) {
        let nodeId = node.concept_id;
        let row = {...node, depth, rowPath: `${parentPath}/${nodeId}` };
        row.display = {
          hideReasons: {},
          showReasons: {},
          result: '',
        }

        allRows.push(row);

        if (node.childIds && node.childIds.length) {
          addRows(node.childIds, row.rowPath, depth + 1);
        }
      }
    };
    addRows(rootNodes);
    return allRows;
  }

  sortFunc = (d => {
    // used to sort each level of the comparison table.
    // todo: allow this to be changed by user
    let n = typeof(d) === 'object' ? d : this.nodes[d];
    return n.not_a_concept
        ? Infinity
        : (
            (n.pathFromDisplayedNode && !n.hasChildren
                ? -(10**9)
                : 0
            ) + (n.pathFromDisplayedNode || []).length * 10**6 - n.drc);
    let statusRank = n.isItem && 3 + n.added && 2 + n.removed && 1 || 0;
    // return - (n.drc || n.descendantCount || n.levelsBelow || n.status ? 1 : 0);
    return - (n.levelsBelow || n.descendantCount || n.status ? 1 : 0);
  })

  #computeAttributes() {
    // compute children, descendants, child/descendant counts -- counts
    //  of concepts and also of records using this term's children/descendants
    const graph = this.graph;
    let nodes = this.nodes;
    function computeAttributesFunc(nodeId, level) { // recursive function, called on each node's children
      let node = nodes[nodeId];
      // Check if the attributes have already been computed to avoid recomputation
      if (node.descendantCount !== undefined) {
        return node;
      }
      node.levelsBelow = 0;
      node.descendantCount = 0;
      node.childCount = 0;
      node.drc = node.total_cnt || 0;

      const childIds = graph.outNeighbors(node.concept_id); // Get outgoing neighbors (children)
      if (childIds.length == 0) { // If there are no children, this node is a leaf node
        return node;
      }
      node.childIds = childIds;
      let descendants = childIds;

      childIds.forEach(childId => {
        let child = computeAttributesFunc(childId, level + 1);

        node.levelsBelow = Math.max(node.levelsBelow, 1 + child.levelsBelow); // Update max depth if this path is deeper
        if (child.descendants) {
          descendants = descendants.concat(child.descendants);
        }
      });

      // nodes[nodeId] = node = {...node, descendantCount: descendants.length, levelsBelow, drc};
      // nodes[nodeId] = node = {...node};   // why?
      // TODO: node.level = level; not sure why level isn't always correct;
      //  to see problem, try `gc.displayedRows.filter(d => d.depth != d.level)` from comparison renderer

      // if (levelsBelow > 0) { // todo: WHY IS THIS COMMENTED OUT?
        // node.expanded = false;  // TODO: deal with expanded differently for shown and hidden
        node.hasChildren = true;
        node.descendants = uniq(descendants); // Remove duplicates
        node.descendantCount = node.descendants.length;
        node.drc += sum(node.descendants.map(d => nodes[d].total_cnt || 0)); // Compute descendant counts
        node.childIds = childIds;
        node.childCount = childIds.length;
      // }

      return node;
    }

    // Iterate over all nodes to compute and store attributes
    // this.graph.nodes().forEach(node => {})
    for (let root of this.roots) {
      computeAttributesFunc(root, 0);
    };
    return nodes;
  }
  graphCopy() {
    return this.graph.copy();
  }

  setGraphDisplayConfig(graphOptions) {
    // these are all options that appear in Show Stats/Options

    const displayedConcepts = this.displayedRows || []; // first time through, don't have displayed rows yet
    const displayedConceptIds = displayedConcepts.map(r => r.concept_id);
    let displayOrder = 0;
    let brandNew = isEmpty(graphOptions);
    if (brandNew) {
      graphOptions = {
        specialConceptTreatment: {},
        expandAll: false,
        nested: true,
      };
    }
    let displayOptions = {
      /*
        displayOptions logic
        See code for hidden-rows column in CsetComparisonPage StatsAndOptions
        table.

        If specialTreatmentRule is 'show though collapsed', then what we care
        about are how many currently hidden rows will be shown if option is
        turned on and how many currently shown rows will be hidden if option
        is turned off.

        If specialTreatmentRule is 'hide though expanded', then what we care
        about are how many currently visible rows will be hidden if option is
        turned on and how many currently hidden rows will be unhidden if option
        is turned off.
       */
      displayedRows: {
        name: "Visible rows", displayOrder: displayOrder++,
        value: displayedConcepts.length,
      },
      concepts: {
        name: "Concepts", displayOrder: displayOrder++,
        value: this.gd.concept_ids.length,
        hiddenConceptCnt: setOp('difference', this.gd.concept_ids, displayedConceptIds).length,
        displayedConceptCnt: setOp('intersection', this.gd.concept_ids, displayedConceptIds).length,
        specialTreatmentRule: 'expandAll',
        specialTreatmentDefault: false,
      },
      addedCids: {
        name: "Individually added concept_ids", displayOrder: displayOrder++,
        value: this.gd.specialConcepts.addedCids.length,
        hiddenConceptCnt: setOp('difference', this.gd.specialConcepts.addedCids, displayedConceptIds).length,
        displayedConceptCnt: setOp('intersection', this.gd.specialConcepts.addedCids, displayedConceptIds).length,
        specialTreatmentDefault: true,
        specialTreatmentRule: 'show though collapsed',
      },
      definitionConcepts: {
        name: "Definition concepts", displayOrder: displayOrder++,
        value: this.gd.specialConcepts.definitionConcepts.length,
        displayedConceptCnt: setOp('intersection', this.gd.specialConcepts.definitionConcepts, displayedConceptIds).length,
        hiddenConceptCnt: setOp('difference', this.gd.specialConcepts.definitionConcepts, displayedConceptIds).length,
        specialTreatmentDefault: false,
        specialTreatmentRule: 'show though collapsed',
      },
      expansionConcepts: {
        name: "Expansion only concepts", displayOrder: displayOrder++,
        value: this.gd.specialConcepts.expansionConcepts.length,
        // value: uniq(flatten(Object.values(this.gd.csmi).map(Object.values)) .filter(c => c.csm).map(c => c.concept_id)).length,
        displayedConceptCnt: setOp('intersection', this.gd.specialConcepts.expansionConcepts, displayedConceptIds).length,
        hiddenConceptCnt: setOp('difference', this.gd.specialConcepts.expansionConcepts, displayedConceptIds).length,
        specialTreatmentDefault: false,
        specialTreatmentRule: 'hide though expanded',
      },
      added: {
        name: "Added to compared", displayOrder: displayOrder++,
        value: get(this.gd.specialConcepts, 'added.length', undefined),
        hiddenConceptCnt: setOp('difference', this.gd.specialConcepts.added, displayedConceptIds).length,
        specialTreatmentDefault: false,
        specialTreatmentRule: 'show though collapsed',
      },
      removed: {
        name: "Removed from compared", displayOrder: displayOrder++,
        value: get(this.gd.specialConcepts, 'removed.length', undefined),
        hiddenConceptCnt: setOp('difference', this.gd.specialConcepts.removed, displayedConceptIds).length,
        specialTreatmentDefault: false,
        specialTreatmentRule: 'show though collapsed',
      },
      standard: {
        name: "Standard concepts", displayOrder: displayOrder++,
        value: this.gd.concepts.filter(c => c.standard_concept === 'S').length,
        displayedConceptCnt: setOp('intersection', this.gd.concepts.filter(c => c.standard_concept === 'S'), displayedConceptIds).length,
      },
      classification: {
        name: "Classification concepts", displayOrder: displayOrder++,
        value: this.gd.concepts.filter(c => c.standard_concept === 'C').length,
      },
      nonStandard: {
        name: "Non-standard", displayOrder: displayOrder++,
        value: this.gd.specialConcepts.nonStandard.length,
        displayedConceptCnt: setOp('intersection', this.gd.specialConcepts.nonStandard, displayedConceptIds).length,
        hiddenConceptCnt:  setOp('intersection', this.gd.specialConcepts.nonStandard, this.hideThoughExpanded).length,
        specialTreatmentDefault: false,
        specialTreatmentRule: 'hide though expanded',
      },
      zeroRecord: {
        name: "Zero records / patients", displayOrder: displayOrder++,
        value: this.gd.specialConcepts.zeroRecord.length,
        displayedConceptCnt: setOp('intersection', this.gd.specialConcepts.zeroRecord, displayedConceptIds).length,
        hiddenConceptCnt: setOp('intersection', this.gd.specialConcepts.zeroRecord, [...(this.hideThoughExpanded || [])]).length,
        specialTreatmentDefault: false,
        specialTreatmentRule: 'hide though expanded',
      },
      allButFirstOccurrence: {
        name: "All but first occurrence", displayOrder: displayOrder++,
        value: this.gd.specialConcepts.allButFirstOccurrence.length,
        displayedConceptCnt: get(graphOptions, 'specialConceptTreatment.allButFirstOccurrence', true)
            ? 0
            : this.gd.specialConcepts.allButFirstOccurrence.length,
        hiddenConceptCnt: get(graphOptions, 'specialConceptTreatment.allButFirstOccurrence', true)
            ? this.gd.specialConcepts.allButFirstOccurrence.length
            : 0,
        /* special_v_displayed: () => {
          let special = this.gd.specialConcepts.allButFirstOccurrence.map(p => p.join('/'));
          let displayed = flatten(Object.values(this.displayedNodePaths)
                                      .map(paths => paths.map(path => path.join('/'))))
          return [special, displayed];
        }, */
        specialTreatmentDefault: true,
        specialTreatmentRule: 'hide though expanded',
      },
    }
    for (let type in displayOptions) {
      let displayOption = {...get(this, ['graphDisplayConfig', type], {}), ...displayOptions[type]};  // don't lose stuff previously set
      // if (typeof(displayOption.value) === 'undefined') // don't show displayOptions that don't represent any concepts
      if (!displayOption.value) {  // addedCids was 0 instead of undefined. will this hide things that shouldn't be hidden?
        // console.log(`deleting ${type} from statsopts`);
        delete displayOptions[type];
        continue;
      }
      displayOption.type = type;
      if (typeof(displayOption.specialTreatmentDefault) !== 'undefined') {
        if (typeof (displayOption.specialTreatment) === 'undefined') {
          // set specialTreatment to default only when initializing stats options
          // type === 'addedCids' && console.log(`setting ${type} to default`);
          displayOption.specialTreatment = displayOption.specialTreatmentDefault;
        }
        if (typeof(graphOptions.specialConceptTreatment[type]) === 'undefined') {
          // set specialConceptTreatment[type] only when not already in graphOptions
          // type === 'addedCids' && console.log(`setting graphOption.specialConceptTreatment.${type} to ${displayOption.specialTreatment}`);
          graphOptions.specialConceptTreatment[type] = displayOption.specialTreatment;
        } else {
          // already have an option set, use that
          // this is wrong, but allows flipping bit if other bit is true
          // graphOptions.specialConceptTreatment[type] = (Boolean(graphOptions.specialConceptTreatment[type] + displayOption.specialTreatment) % 2);
          // no this is wrong
          displayOption.specialTreatment = graphOptions.specialConceptTreatment[type];
          // type === 'addedCids' && console.log(`just set specialTreatment.${type} to ${displayOption.specialTreatment}`);
        }
      }
      displayOptions[type] = displayOption;

    }
    // TODO: gotta assemble whatever's needed for graphOptions
    this.graphDisplayConfigList = sortBy(displayOptions, d => d.displayOrder);
    this.graphDisplayConfig = displayOptions;
    return graphOptions;
  }

  graphLayout(maxWidth=12) {
    const layerSpacing = 120;
    const nodeSpacing = 120;
    const graph = this.graph.copy();
    for (let nodeId in this.nodes) {
      graph.replaceNodeAttributes(nodeId, {...this.nodes[nodeId]});
    }
    const layers = computeLayers(graph, maxWidth); // Use a copy to keep the original graph intact
    // const layers = coffmanGrahamLayering(graph, maxWidth); // Use a copy to keep the original graph intact
    // that algorithm (both are from chatgpt) doesn't include all the nodes. dropping the ones left
    //    out of layering for the moment
    for (let nodeId in setOp('difference', graph.nodes(), flatten(layers))) {
      graph.dropNode(nodeId);
    }

    layers.forEach((layer, i) => {
      layer.forEach((node, j) => {
        graph.setNodeAttribute(node, 'size', 4);
        graph.setNodeAttribute(node, 'position', j); // Spread nodes horizontally within a layer
        graph.setNodeAttribute(node, 'layer', i); // Stack layers vertically
        // Here we are simply setting x and y for visualization
        // Spacing might need adjustments based on your visualization container's size
        graph.setNodeAttribute(node, 'x', j * nodeSpacing); // Spread nodes horizontally within a layer
        graph.setNodeAttribute(node, 'y', i * layerSpacing); // Stack layers vertically
      });
    });
    console.log(layers);
    return graph;
  }

  wholeHierarchy() {
    // deep copy the node so we don't mutate the original
    let nodes = cloneDeep(this.nodes);
    let rows = [];
    function traverse(nodeId, depth = 0) {
      let node = nodes[nodeId];
      node.depth = depth;
      rows.push(node);
      node.hasChildren && node.childIds.forEach(childId => {
        traverse(childId, depth + 1); // Recurse
      });
    }
    for (let rootId of sortBy(this.roots, this.sortFunc)) {
      traverse(rootId);
    }
    return rows;
  }
}

function coffmanGrahamLayering(graph, maxWidth) {
  let layers = [];
  let currentLayer = [];
  let visited = new StringSet();

  // Function to find nodes with in-degree 0
  function findSources() {
    return graph.nodes().filter(node => {
      return graph.inDegree(node) === 0 && !visited.has(node);
    });
  }

  // Assign nodes to layers
  while (visited.size < graph.order) {
    let sources = findSources();
    if (sources.length === 0) {
      break; // Avoid infinite loop for cyclic graphs
    }

    for (let node of sources) {
      if (currentLayer.length < maxWidth) {
        currentLayer.push(node);
        visited.add(node);
      }
      if (currentLayer.length === maxWidth) {
        layers.push(currentLayer);
        currentLayer = [];
      }
    }

    // Remove nodes from graph to simulate "layer assignment"
    sources.forEach(node => {
      // graph.dropNode(node);
    });
  }

  if (currentLayer.length > 0) {
    layers.push(currentLayer); // Add remaining nodes to layers
  }

  return layers;
}
/*
   chatgpt graph layering stuff:
     https://chat.openai.com/share/443602bd-e90f-48cb-92a7-4f85b0accad2
 */
function computeLayers(graph, maxWidth) {
  const inDegrees = {};
  graph.nodes().forEach(node => {
    inDegrees[node] = graph.inDegree(node);
  });

  const layers = [];
  let currentLayer = [];
  let layerIndex = 0;

  while (Object.keys(inDegrees).length > 0) {
    // Select nodes with in-degree of 0 up to the maxWidth
    Object.entries(inDegrees).forEach(([node, inDegree]) => {
      if (inDegree === 0 && currentLayer.length < maxWidth) {
        currentLayer.push(node);
      }
    });

    // If no node was added but there are still nodes left, increment the layer index to avoid an infinite loop
    if (currentLayer.length === 0 && Object.keys(inDegrees).length > 0) {
      layerIndex++;
      continue;
    }

    // Update inDegrees for the next iteration
    currentLayer.forEach(node => {
      graph.outEdges(node).forEach(edge => {
        const target = graph.target(edge);
        if (inDegrees[target] !== undefined) {
          inDegrees[target]--;
        }
      });
      delete inDegrees[node];
    });

    if (layers[layerIndex] === undefined) {
      layers[layerIndex] = [];
    }

    // Add current layer to layers and prepare for next iteration
    layers[layerIndex] = layers[layerIndex].concat(currentLayer);
    currentLayer = [];

    // If the current layer is full or no more nodes can be added, move to the next layer
    if (layers[layerIndex].length >= maxWidth || !Object.values(inDegrees).some(inDegree => inDegree === 0)) {
      layerIndex++;
    }
  }

  return layers;
}
