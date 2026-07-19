import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import type { WorkflowDefinition, WorkflowState, WorkflowTransition, WorkflowCondition, WorkflowAction, InternalApiAction, ExternalApiAction, WorkflowChoiceNode, WorkflowChoiceBranch } from '../types';
import { 
  Plus, Trash2, Shield, Settings, ArrowRight, GitMerge,
  Layers, Cpu
} from 'lucide-react';

export const WorkflowDesigner: React.FC = () => {
  const { 
    workflows, addWorkflow, updateWorkflow, deleteWorkflow, nodes 
  } = useStore();

  const [selectedWorkflowIndex, setSelectedWorkflowIndex] = useState<number>(-1);
  const [selectedStateIndex, setSelectedStateIndex] = useState<number>(-1);
  const [selectedTransitionIndex, setSelectedTransitionIndex] = useState<number>(-1);
  const [selectedChoiceNodeIndex, setSelectedChoiceNodeIndex] = useState<number>(-1);
  
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [linkSourceNode, setLinkSourceNode] = useState<string>('');

  // Extract all entity names from class nodes on the canvas
  const availableEntities = useMemo(() => {
    return nodes
      .filter(n => n.type === 'classNode')
      .map(n => n.data.entity.name);
  }, [nodes]);

  const selectedWorkflow = selectedWorkflowIndex >= 0 ? workflows[selectedWorkflowIndex] : null;

  const handleUpdateSelectedWorkflow = (updated: Partial<WorkflowDefinition>) => {
    if (selectedWorkflowIndex >= 0) {
      updateWorkflow(selectedWorkflowIndex, updated);
    }
  };

  // Add State to Selected Workflow
  const handleAddState = () => {
    if (!selectedWorkflow) return;
    const name = `State_${selectedWorkflow.states.length + 1}`;
    const newState: WorkflowState = {
      name,
      isInitial: selectedWorkflow.states.length === 0,
      isFinal: false,
      allowedRoles: ['Admin']
    };
    handleUpdateSelectedWorkflow({
      states: [...selectedWorkflow.states, newState]
    });
    setSelectedStateIndex(selectedWorkflow.states.length);
    setSelectedTransitionIndex(-1);
    setSelectedChoiceNodeIndex(-1);
  };

  // Add Decision Gate (Choice Node)
  const handleAddChoiceNode = () => {
    if (!selectedWorkflow) return;
    const name = `Check_Gate_${(selectedWorkflow.choiceNodes || []).length + 1}`;
    const newChoice: WorkflowChoiceNode = {
      id: name.toLowerCase(),
      name,
      branches: [],
      defaultState: selectedWorkflow.states[0]?.name || ''
    };
    handleUpdateSelectedWorkflow({
      choiceNodes: [...(selectedWorkflow.choiceNodes || []), newChoice]
    });
    setSelectedChoiceNodeIndex((selectedWorkflow.choiceNodes || []).length);
    setSelectedStateIndex(-1);
    setSelectedTransitionIndex(-1);
  };

  // Delete State from Selected Workflow
  const handleDeleteState = (stateIndex: number) => {
    if (!selectedWorkflow) return;
    const stateName = selectedWorkflow.states[stateIndex].name;
    const states = selectedWorkflow.states.filter((_, idx) => idx !== stateIndex);
    
    // Also clean up any transitions referencing this state
    const transitions = selectedWorkflow.transitions.filter(
      t => t.fromState !== stateName && t.toState !== stateName
    );

    handleUpdateSelectedWorkflow({ states, transitions });
    setSelectedStateIndex(-1);
    setSelectedTransitionIndex(-1);
    setSelectedChoiceNodeIndex(-1);
  };

  // Delete Choice Node
  const handleDeleteChoiceNode = (choiceIndex: number) => {
    if (!selectedWorkflow) return;
    const choice = selectedWorkflow.choiceNodes[choiceIndex];
    const choiceNodes = selectedWorkflow.choiceNodes.filter((_, idx) => idx !== choiceIndex);
    
    // Clean up references in transitions
    const transitions = selectedWorkflow.transitions.filter(
      t => t.fromState !== choice.id && t.toState !== choice.id
    );

    handleUpdateSelectedWorkflow({ choiceNodes, transitions });
    setSelectedChoiceNodeIndex(-1);
    setSelectedTransitionIndex(-1);
    setSelectedStateIndex(-1);
  };

  // Start transition link mode
  const startTransitionLink = (nodeId: string) => {
    setIsLinking(true);
    setLinkSourceNode(nodeId);
  };

  // Complete transition link mode
  const completeTransitionLink = (targetNodeId: string) => {
    if (!selectedWorkflow || !linkSourceNode || linkSourceNode === targetNodeId) {
      setIsLinking(false);
      setLinkSourceNode('');
      return;
    }

    const transitionId = `${linkSourceNode.toLowerCase()}_to_${targetNodeId.toLowerCase()}`;
    // Check if transition already exists
    if (selectedWorkflow.transitions.some(t => t.fromState === linkSourceNode && t.toState === targetNodeId)) {
      setIsLinking(false);
      setLinkSourceNode('');
      return;
    }

    const newTransition: WorkflowTransition = {
      id: transitionId,
      name: `Transition to ${targetNodeId}`,
      fromState: linkSourceNode,
      toState: targetNodeId,
      trigger: `${linkSourceNode}To${targetNodeId}Command`,
      useCustomCommand: false,
      requiredRoles: ['Admin'],
      conditions: [],
      actions: []
    };

    handleUpdateSelectedWorkflow({
      transitions: [...selectedWorkflow.transitions, newTransition]
    });

    setSelectedTransitionIndex(selectedWorkflow.transitions.length);
    setSelectedStateIndex(-1);
    setSelectedChoiceNodeIndex(-1);
    setIsLinking(false);
    setLinkSourceNode('');
  };

  // Delete Transition
  const handleDeleteTransition = (transIndex: number) => {
    if (!selectedWorkflow) return;
    const transitions = selectedWorkflow.transitions.filter((_, idx) => idx !== transIndex);
    handleUpdateSelectedWorkflow({ transitions });
    setSelectedTransitionIndex(-1);
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-900 text-slate-100 font-sans h-full">
      {/* Left Sidebar - Workflows List */}
      <div className="w-64 border-r border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-500" />
            Workflows
          </h2>
          <button
            onClick={addWorkflow}
            className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-all cursor-pointer"
            title="Create New Workflow"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {workflows.map((wf, idx) => (
            <div
              key={wf.id}
              onClick={() => {
                setSelectedWorkflowIndex(idx);
                setSelectedStateIndex(-1);
                setSelectedTransitionIndex(-1);
                setSelectedChoiceNodeIndex(-1);
              }}
              className={`p-3 rounded-lg text-left text-xs transition-all cursor-pointer border flex flex-col gap-1.5 ${
                selectedWorkflowIndex === idx
                  ? 'bg-sky-500/10 border-sky-500/50 text-white font-semibold shadow-lg shadow-sky-500/5'
                  : 'bg-slate-900/40 border-slate-800/85 hover:bg-slate-800/50 text-slate-400'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium truncate max-w-[140px]">{wf.name || 'Unnamed'}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${wf.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {wf.version}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-mono text-slate-500 truncate max-w-[120px]">{wf.entity || 'No Entity Bound'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteWorkflow(idx);
                    if (selectedWorkflowIndex === idx) setSelectedWorkflowIndex(-1);
                  }}
                  className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {workflows.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-600 italic">
              No workflows defined.<br />Click the plus icon to start.
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Diagram/State Canvas & Configuration */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/60 relative">
        {selectedWorkflow ? (
          <>
            {/* Top Config Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 grid grid-cols-5 gap-4 items-center print-hide">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Workflow Name</label>
                <input
                  type="text"
                  value={selectedWorkflow.name}
                  onChange={(e) => handleUpdateSelectedWorkflow({ name: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Target Entity</label>
                <select
                  value={selectedWorkflow.entity}
                  onChange={(e) => handleUpdateSelectedWorkflow({ entity: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                >
                  <option value="">-- Select Entity --</option>
                  {availableEntities.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Version</label>
                <input
                  type="text"
                  value={selectedWorkflow.version}
                  onChange={(e) => handleUpdateSelectedWorkflow({ version: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Effective Date</label>
                <input
                  type="date"
                  value={selectedWorkflow.effectiveDate}
                  onChange={(e) => handleUpdateSelectedWorkflow({ effectiveDate: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Expiration Date</label>
                <input
                  type="date"
                  value={selectedWorkflow.expirationDate}
                  onChange={(e) => handleUpdateSelectedWorkflow({ expirationDate: e.target.value })}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                />
              </div>
            </div>

            {/* Interactive State Diagram Grid */}
            <div className="flex-1 p-6 overflow-y-auto relative bg-slate-950/20 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-mono">
                  {isLinking ? (
                    <span className="text-amber-400 font-bold animate-pulse">
                      Linking node "{linkSourceNode}"... click target state/choice node card below to map transition
                    </span>
                  ) : (
                    'Configure workflow states and automated decision choice gates.'
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddState}
                    className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold shadow-md shadow-sky-600/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add State</span>
                  </button>
                  <button
                    onClick={handleAddChoiceNode}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow-md shadow-amber-600/10 cursor-pointer"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Add Decision Gate</span>
                  </button>
                </div>
              </div>

              {/* Grid of States and Decision Choice Gates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {/* 1. STATES */}
                {selectedWorkflow.states.map((st, idx) => (
                  <div
                    key={`state-${st.name}`}
                    onClick={() => {
                      if (isLinking) {
                        completeTransitionLink(st.name);
                      } else {
                        setSelectedStateIndex(idx);
                        setSelectedTransitionIndex(-1);
                        setSelectedChoiceNodeIndex(-1);
                      }
                    }}
                    className={`relative p-5 rounded-xl border flex flex-col gap-3 transition-all ${
                      isLinking && linkSourceNode !== st.name
                        ? 'border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer animate-pulse'
                        : selectedStateIndex === idx
                        ? 'bg-sky-500/5 border-sky-500 shadow-lg shadow-sky-500/5'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-white tracking-wide">{st.name}</span>
                        <div className="flex gap-1.5 mt-1">
                          {st.isInitial && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded uppercase">
                              Initial
                            </span>
                          )}
                          {st.isFinal && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded uppercase">
                              Final
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startTransitionLink(st.name);
                          }}
                          className="p-1 hover:text-white text-slate-500 bg-slate-950/40 rounded transition-all cursor-pointer"
                          title="Add Transition Link"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteState(idx);
                          }}
                          className="p-1 hover:text-red-400 text-slate-500 bg-slate-950/40 rounded transition-all cursor-pointer"
                          title="Delete State"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">Roles: {st.allowedRoles.join(', ') || 'None'}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 2. CHOICE NODES (DECISION GATES) */}
                {(selectedWorkflow.choiceNodes || []).map((ch, idx) => (
                  <div
                    key={`choice-${ch.id}`}
                    onClick={() => {
                      if (isLinking) {
                        completeTransitionLink(ch.id);
                      } else {
                        setSelectedChoiceNodeIndex(idx);
                        setSelectedStateIndex(-1);
                        setSelectedTransitionIndex(-1);
                      }
                    }}
                    className={`relative p-5 rounded-xl border flex flex-col gap-3 transition-all ${
                      isLinking && linkSourceNode !== ch.id
                        ? 'border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer animate-pulse'
                        : selectedChoiceNodeIndex === idx
                        ? 'bg-amber-500/5 border-amber-500 shadow-lg shadow-amber-500/5'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
                          <GitMerge className="w-4 h-4 text-amber-500" />
                          {ch.name}
                        </span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded uppercase w-max mt-1">
                          Decision Gate
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startTransitionLink(ch.id);
                          }}
                          className="p-1 hover:text-white text-slate-500 bg-slate-950/40 rounded transition-all cursor-pointer"
                          title="Add Transition Link"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChoiceNode(idx);
                          }}
                          className="p-1 hover:text-red-400 text-slate-500 bg-slate-950/40 rounded transition-all cursor-pointer"
                          title="Delete Gate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 flex flex-col gap-1.5">
                      <div className="flex justify-between">
                        <span>Branches: {ch.branches?.length || 0}</span>
                        <span className="font-mono text-slate-500">Else: {ch.defaultState || 'None'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transitions List */}
              {selectedWorkflow.transitions.length > 0 && (
                <div className="border-t border-slate-800/80 pt-6 flex flex-col gap-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transitions & Triggers</h3>
                  <div className="flex flex-col gap-2">
                    {selectedWorkflow.transitions.map((tr, idx) => (
                      <div
                        key={tr.id}
                        onClick={() => {
                          setSelectedTransitionIndex(idx);
                          setSelectedStateIndex(-1);
                          setSelectedChoiceNodeIndex(-1);
                        }}
                        className={`p-3 rounded-lg border text-xs flex justify-between items-center transition-all cursor-pointer ${
                          selectedTransitionIndex === idx
                            ? 'bg-sky-500/5 border-sky-500 text-white'
                            : 'bg-slate-900/40 border-slate-800/85 hover:bg-slate-800/50 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{tr.name}</span>
                          <span className="text-slate-500 font-mono text-[10px]">({tr.fromState} → {tr.toState})</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded">
                            {tr.useCustomCommand ? `Custom: ${tr.trigger}` : `Gen: ${tr.trigger}`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransition(idx);
                            }}
                            className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
            <Layers className="w-8 h-8 text-slate-700" />
            <span>Select a workflow from the left sidebar to edit states and transitions.</span>
          </div>
        )}
      </div>

      {/* Right Sidebar - Properties Inspector */}
      {selectedWorkflow && (selectedStateIndex >= 0 || selectedTransitionIndex >= 0 || selectedChoiceNodeIndex >= 0) && (
        <div className="w-85 border-l border-slate-800 bg-slate-950/40 p-5 flex flex-col gap-6 overflow-y-auto print-hide">
          {/* STATE INSPECTION */}
          {selectedStateIndex >= 0 && (
            <>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-sky-500" />
                  State Parameters
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">State Name</label>
                    <input
                      type="text"
                      value={selectedWorkflow.states[selectedStateIndex].name}
                      onChange={(e) => {
                        const states = [...selectedWorkflow.states];
                        const oldName = states[selectedStateIndex].name;
                        const newName = e.target.value;
                        states[selectedStateIndex].name = newName;

                        // Also sync transition dependencies
                        const transitions = selectedWorkflow.transitions.map(t => {
                          let updated = { ...t };
                          if (t.fromState === oldName) updated.fromState = newName;
                          if (t.toState === oldName) updated.toState = newName;
                          return updated;
                        });

                        handleUpdateSelectedWorkflow({ states, transitions });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWorkflow.states[selectedStateIndex].isInitial}
                        onChange={(e) => {
                          const states = selectedWorkflow.states.map((s, idx) => ({
                            ...s,
                            isInitial: idx === selectedStateIndex ? e.target.checked : false
                          }));
                          handleUpdateSelectedWorkflow({ states });
                        }}
                        className="rounded border-slate-800 text-sky-600 focus:ring-sky-500"
                      />
                      Is Initial State
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWorkflow.states[selectedStateIndex].isFinal}
                        onChange={(e) => {
                          const states = [...selectedWorkflow.states];
                          states[selectedStateIndex].isFinal = e.target.checked;
                          handleUpdateSelectedWorkflow({ states });
                        }}
                        className="rounded border-slate-800 text-sky-600 focus:ring-sky-500"
                      />
                      Is Final State
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Authorized Security Roles</label>
                    <input
                      type="text"
                      placeholder="Comma-separated roles"
                      value={selectedWorkflow.states[selectedStateIndex].allowedRoles.join(', ')}
                      onChange={(e) => {
                        const states = [...selectedWorkflow.states];
                        states[selectedStateIndex].allowedRoles = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        handleUpdateSelectedWorkflow({ states });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CHOICE NODE (DECISION GATE) INSPECTION */}
          {selectedChoiceNodeIndex >= 0 && (
            <>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <GitMerge className="w-4 h-4 text-amber-500" />
                  Decision Gate Settings
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Gate ID</label>
                    <input
                      type="text"
                      value={selectedWorkflow.choiceNodes[selectedChoiceNodeIndex].name}
                      onChange={(e) => {
                        const choiceNodes = [...selectedWorkflow.choiceNodes];
                        const oldId = choiceNodes[selectedChoiceNodeIndex].id;
                        const newName = e.target.value;
                        const newId = newName.toLowerCase().replace(/\s+/g, '_');
                        
                        choiceNodes[selectedChoiceNodeIndex].name = newName;
                        choiceNodes[selectedChoiceNodeIndex].id = newId;

                        // Sync transitions referencing this choice node
                        const transitions = selectedWorkflow.transitions.map(t => {
                          let updated = { ...t };
                          if (t.fromState === oldId) updated.fromState = newId;
                          if (t.toState === oldId) updated.toState = newId;
                          return updated;
                        });

                        handleUpdateSelectedWorkflow({ choiceNodes, transitions });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Default Target State (Else)</label>
                    <select
                      value={selectedWorkflow.choiceNodes[selectedChoiceNodeIndex].defaultState}
                      onChange={(e) => {
                        const choiceNodes = [...selectedWorkflow.choiceNodes];
                        choiceNodes[selectedChoiceNodeIndex].defaultState = e.target.value;
                        handleUpdateSelectedWorkflow({ choiceNodes });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white"
                    >
                      <option value="">-- Select Target State --</option>
                      {selectedWorkflow.states.map(s => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Branches Section */}
                  <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Conditional Branches</span>
                      <button
                        onClick={() => {
                          const choiceNodes = [...selectedWorkflow.choiceNodes];
                          const newBranch: WorkflowChoiceBranch = {
                            toState: selectedWorkflow.states[0]?.name || '',
                            conditions: []
                          };
                          choiceNodes[selectedChoiceNodeIndex].branches = [
                            ...(choiceNodes[selectedChoiceNodeIndex].branches || []),
                            newBranch
                          ];
                          handleUpdateSelectedWorkflow({ choiceNodes });
                        }}
                        className="p-1 hover:text-white text-slate-500 bg-slate-950/40 rounded transition-all cursor-pointer"
                        title="Add Conditional Branch"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {(selectedWorkflow.choiceNodes[selectedChoiceNodeIndex].branches || []).map((br, bIdx) => (
                        <div key={bIdx} className="bg-slate-950/50 border border-slate-850 p-3 rounded flex flex-col gap-2 text-[10px]">
                          <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                            <span className="font-mono text-amber-400">Branch #{bIdx + 1}</span>
                            <button
                              onClick={() => {
                                const choiceNodes = [...selectedWorkflow.choiceNodes];
                                choiceNodes[selectedChoiceNodeIndex].branches = choiceNodes[selectedChoiceNodeIndex].branches.filter((_, i) => i !== bIdx);
                                handleUpdateSelectedWorkflow({ choiceNodes });
                              }}
                              className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-slate-500 uppercase">Target State</label>
                            <select
                              value={br.toState}
                              onChange={(e) => {
                                const choiceNodes = [...selectedWorkflow.choiceNodes];
                                choiceNodes[selectedChoiceNodeIndex].branches[bIdx].toState = e.target.value;
                                handleUpdateSelectedWorkflow({ choiceNodes });
                              }}
                              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white"
                            >
                              {selectedWorkflow.states.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Branch Conditions */}
                          <div className="flex flex-col gap-1.5 mt-1.5">
                            <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase">
                              <span>Conditions</span>
                              <button
                                onClick={() => {
                                  const choiceNodes = [...selectedWorkflow.choiceNodes];
                                  choiceNodes[selectedChoiceNodeIndex].branches[bIdx].conditions.push({
                                    type: 'PropertyComparison',
                                    property: '',
                                    operator: 'Equal',
                                    value: ''
                                  });
                                  handleUpdateSelectedWorkflow({ choiceNodes });
                                }}
                                className="hover:text-white"
                              >
                                + Add Guard
                              </button>
                            </div>

                            {br.conditions.map((cond, cIdx) => (
                              <div key={cIdx} className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  placeholder="Prop"
                                  value={cond.property}
                                  onChange={(e) => {
                                    const choiceNodes = [...selectedWorkflow.choiceNodes];
                                    choiceNodes[selectedChoiceNodeIndex].branches[bIdx].conditions[cIdx].property = e.target.value;
                                    handleUpdateSelectedWorkflow({ choiceNodes });
                                  }}
                                  className="w-1/3 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                                />
                                <select
                                  value={cond.operator}
                                  onChange={(e) => {
                                    const choiceNodes = [...selectedWorkflow.choiceNodes];
                                    choiceNodes[selectedChoiceNodeIndex].branches[bIdx].conditions[cIdx].operator = e.target.value as any;
                                    handleUpdateSelectedWorkflow({ choiceNodes });
                                  }}
                                  className="w-1/3 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white text-[9px]"
                                >
                                  <option value="Equal">==</option>
                                  <option value="NotEqual">!=</option>
                                  <option value="LessThan">&lt;</option>
                                  <option value="LessThanOrEqual">&lt;=</option>
                                  <option value="GreaterThan">&gt;</option>
                                  <option value="GreaterThanOrEqual">&gt;=</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Val"
                                  value={cond.value}
                                  onChange={(e) => {
                                    const choiceNodes = [...selectedWorkflow.choiceNodes];
                                    choiceNodes[selectedChoiceNodeIndex].branches[bIdx].conditions[cIdx].value = e.target.value;
                                    handleUpdateSelectedWorkflow({ choiceNodes });
                                  }}
                                  className="w-1/3 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-white font-mono"
                                />
                                <button
                                  onClick={() => {
                                    const choiceNodes = [...selectedWorkflow.choiceNodes];
                                    choiceNodes[selectedChoiceNodeIndex].branches[bIdx].conditions = 
                                      choiceNodes[selectedChoiceNodeIndex].branches[bIdx].conditions.filter((_, i) => i !== cIdx);
                                    handleUpdateSelectedWorkflow({ choiceNodes });
                                  }}
                                  className="text-slate-500 hover:text-red-400"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TRANSITION INSPECTION */}
          {selectedTransitionIndex >= 0 && (
            <>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-sky-500" />
                  Transition Gate
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Transition Label</label>
                    <input
                      type="text"
                      value={selectedWorkflow.transitions[selectedTransitionIndex].name}
                      onChange={(e) => {
                        const transitions = [...selectedWorkflow.transitions];
                        transitions[selectedTransitionIndex].name = e.target.value;
                        handleUpdateSelectedWorkflow({ transitions });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWorkflow.transitions[selectedTransitionIndex].useCustomCommand}
                        onChange={(e) => {
                          const transitions = [...selectedWorkflow.transitions];
                          transitions[selectedTransitionIndex].useCustomCommand = e.target.checked;
                          handleUpdateSelectedWorkflow({ transitions });
                        }}
                        className="rounded border-slate-800 text-sky-600 focus:ring-sky-500"
                      />
                      Use Custom C# Command
                    </label>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Trigger Command Name</label>
                    <input
                      type="text"
                      value={selectedWorkflow.transitions[selectedTransitionIndex].trigger}
                      onChange={(e) => {
                        const transitions = [...selectedWorkflow.transitions];
                        transitions[selectedTransitionIndex].trigger = e.target.value;
                        handleUpdateSelectedWorkflow({ transitions });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Required Roles</label>
                    <input
                      type="text"
                      placeholder="Roles allowed to transition"
                      value={selectedWorkflow.transitions[selectedTransitionIndex].requiredRoles.join(', ')}
                      onChange={(e) => {
                        const transitions = [...selectedWorkflow.transitions];
                        transitions[selectedTransitionIndex].requiredRoles = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        handleUpdateSelectedWorkflow({ transitions });
                      }}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-white font-medium"
                    />
                  </div>

                  {/* Conditions List */}
                  <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Guard Conditions</span>
                      <button
                        onClick={() => {
                          const transitions = [...selectedWorkflow.transitions];
                          const conditions = [...transitions[selectedTransitionIndex].conditions, {
                            type: 'PropertyComparison',
                            property: '',
                            operator: 'Equal',
                            value: ''
                          } as WorkflowCondition];
                          transitions[selectedTransitionIndex].conditions = conditions;
                          handleUpdateSelectedWorkflow({ transitions });
                        }}
                        className="p-1 hover:text-white text-slate-500 bg-slate-950/40 rounded transition-all cursor-pointer"
                        title="Add Condition Guard"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      {selectedWorkflow.transitions[selectedTransitionIndex].conditions.map((cond, cIdx) => (
                        <div key={cIdx} className="bg-slate-950/50 border border-slate-800/60 p-2 rounded flex flex-col gap-1.5 text-[10px]">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-sky-400">Rule #{cIdx + 1}</span>
                            <button
                              onClick={() => {
                                const transitions = [...selectedWorkflow.transitions];
                                transitions[selectedTransitionIndex].conditions = transitions[selectedTransitionIndex].conditions.filter((_, i) => i !== cIdx);
                                handleUpdateSelectedWorkflow({ transitions });
                              }}
                              className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          <input
                            type="text"
                            placeholder="Property Name"
                            value={cond.property}
                            onChange={(e) => {
                              const transitions = [...selectedWorkflow.transitions];
                              transitions[selectedTransitionIndex].conditions[cIdx].property = e.target.value;
                              handleUpdateSelectedWorkflow({ transitions });
                            }}
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white font-mono"
                          />

                          <select
                            value={cond.operator}
                            onChange={(e) => {
                              const transitions = [...selectedWorkflow.transitions];
                              transitions[selectedTransitionIndex].conditions[cIdx].operator = e.target.value as any;
                              handleUpdateSelectedWorkflow({ transitions });
                            }}
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white"
                          >
                            <option value="Equal">==</option>
                            <option value="NotEqual">!=</option>
                            <option value="LessThan">&lt;</option>
                            <option value="LessThanOrEqual">&lt;=</option>
                            <option value="GreaterThan">&gt;</option>
                            <option value="GreaterThanOrEqual">&gt;=</option>
                          </select>

                          <input
                            type="text"
                            placeholder="Comparison Value"
                            value={cond.value}
                            onChange={(e) => {
                              const transitions = [...selectedWorkflow.transitions];
                              transitions[selectedTransitionIndex].conditions[cIdx].value = e.target.value;
                              handleUpdateSelectedWorkflow({ transitions });
                            }}
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions List */}
                  <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Automated Actions (DAG)</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const transitions = [...selectedWorkflow.transitions];
                            const actions = [...transitions[selectedTransitionIndex].actions, {
                              type: 'InternalApi',
                              requestType: 'NotifyUserCommand',
                              payloadTemplate: '{ "message": "Order approved" }'
                            } as WorkflowAction];
                            transitions[selectedTransitionIndex].actions = actions;
                            handleUpdateSelectedWorkflow({ transitions });
                          }}
                          className="px-1.5 py-0.5 hover:text-white text-slate-500 bg-slate-950/40 rounded transition-all text-[9px] font-mono cursor-pointer"
                          title="Add Internal MediatR Command Action"
                        >
                          + Internal
                        </button>
                        <button
                          onClick={() => {
                            const transitions = [...selectedWorkflow.transitions];
                            const actions = [...transitions[selectedTransitionIndex].actions, {
                              type: 'ExternalApi',
                              method: 'POST',
                              url: 'https://api.thirdparty.com',
                              headers: {},
                              bodyTemplate: '{}'
                            } as WorkflowAction];
                            transitions[selectedTransitionIndex].actions = actions;
                            handleUpdateSelectedWorkflow({ transitions });
                          }}
                          className="px-1.5 py-0.5 hover:text-white text-slate-500 bg-slate-950/40 rounded transition-all text-[9px] font-mono cursor-pointer"
                          title="Add External HTTP Action"
                        >
                          + External
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {selectedWorkflow.transitions[selectedTransitionIndex].actions.map((act, aIdx) => (
                        <div key={aIdx} className="bg-slate-950/50 border border-slate-800/60 p-2 rounded flex flex-col gap-1.5 text-[10px]">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-emerald-400">Action #{aIdx + 1} ({act.type})</span>
                            <button
                              onClick={() => {
                                const transitions = [...selectedWorkflow.transitions];
                                transitions[selectedTransitionIndex].actions = transitions[selectedTransitionIndex].actions.filter((_, i) => i !== aIdx);
                                handleUpdateSelectedWorkflow({ transitions });
                              }}
                              className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {act.type === 'InternalApi' ? (
                            <>
                              <input
                                type="text"
                                placeholder="Request Type"
                                value={act.requestType}
                                onChange={(e) => {
                                  const transitions = [...selectedWorkflow.transitions];
                                  const currentAct = transitions[selectedTransitionIndex].actions[aIdx] as InternalApiAction;
                                  currentAct.requestType = e.target.value;
                                  handleUpdateSelectedWorkflow({ transitions });
                                }}
                                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white font-mono"
                              />
                              <textarea
                                placeholder="Payload template (JSON)"
                                value={act.payloadTemplate}
                                onChange={(e) => {
                                  const transitions = [...selectedWorkflow.transitions];
                                  const currentAct = transitions[selectedTransitionIndex].actions[aIdx] as InternalApiAction;
                                  currentAct.payloadTemplate = e.target.value;
                                  handleUpdateSelectedWorkflow({ transitions });
                                }}
                                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white font-mono h-16 resize-none"
                              />
                            </>
                          ) : (
                            <>
                              <div className="flex gap-1.5">
                                <select
                                  value={act.method}
                                  onChange={(e) => {
                                    const transitions = [...selectedWorkflow.transitions];
                                    const currentAct = transitions[selectedTransitionIndex].actions[aIdx] as ExternalApiAction;
                                    currentAct.method = e.target.value;
                                    handleUpdateSelectedWorkflow({ transitions });
                                  }}
                                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white"
                                >
                                  <option value="GET">GET</option>
                                  <option value="POST">POST</option>
                                  <option value="PUT">PUT</option>
                                  <option value="DELETE">DELETE</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="HTTP URL"
                                  value={act.url}
                                  onChange={(e) => {
                                    const transitions = [...selectedWorkflow.transitions];
                                    const currentAct = transitions[selectedTransitionIndex].actions[aIdx] as ExternalApiAction;
                                    currentAct.url = e.target.value;
                                    handleUpdateSelectedWorkflow({ transitions });
                                  }}
                                  className="flex-1 px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white font-mono"
                                />
                              </div>
                              <textarea
                                placeholder="HTTP Body template (JSON)"
                                value={act.bodyTemplate}
                                onChange={(e) => {
                                  const transitions = [...selectedWorkflow.transitions];
                                  const currentAct = transitions[selectedTransitionIndex].actions[aIdx] as ExternalApiAction;
                                  currentAct.bodyTemplate = e.target.value;
                                  handleUpdateSelectedWorkflow({ transitions });
                                }}
                                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded focus:outline-none focus:border-sky-500 text-white font-mono h-16 resize-none"
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
