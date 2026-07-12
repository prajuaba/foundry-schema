import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  type NodeTypes,
  type EdgeTypes
} from '@xyflow/react';
import { useStore } from '../store';
import UmlClassNode from './UmlClassNode';
import { UmlEnumNode } from './UmlEnumNode';
import { OrthogonalEdge } from './OrthogonalEdge';
import type { Property, Index, ClassNode, EnumNode } from '../types';
import { Play, Download, Code, Plus, Trash2, Check, Settings, Shield, Key, Sparkles } from 'lucide-react';

const nodeTypes: NodeTypes = {
  classNode: UmlClassNode,
  enumNode: UmlEnumNode,
};

const edgeTypes: EdgeTypes = {
  orthogonal: OrthogonalEdge,
};

// Frontend implementation of C# code generator to allow direct export from schema JSON keys (Capitalized)
const generateCsCode = (entity: any, namespace: string) => {
  const keyProperty = entity.Properties.find((p: any) => p.IsKey);
  const keyType = keyProperty?.Type || 'ObjectId';
  
  const interfaces = [];
  if (entity.BaseClass) {
    interfaces.push(entity.BaseClass);
  } else {
    interfaces.push('BaseEntity<' + keyType + '>');
  }
  interfaces.push('IVersionable');
  if (entity.SoftDelete) interfaces.push('ISoftDelete');
  
  const interfaceList = interfaces.join(', ');
  const propertiesLines: string[] = [];

  entity.Properties.forEach((prop: any) => {
    if (prop.IsKey) return;
    
    const type = prop.Type;
    const requiredKeyword = prop.Attributes.includes('Required') ? 'required ' : '';
    const initKeyword = 'get; init';
    
    const attributes: string[] = [];
    if (prop.Attributes.includes('UniqueIndex') || prop.Attributes.includes('Unique')) {
      attributes.push('[Indexed(Unique = true)]');
    } else if (prop.Attributes.includes('Index')) {
      attributes.push('[Indexed]');
    }
    
    if (prop.Attributes.includes('TextIndex')) attributes.push('[TextIndexed]');
    if (prop.Attributes.includes('Encrypt')) attributes.push('[SensitiveData(Protection = ProtectionType.Encrypt)]');
    if (prop.Attributes.includes('Mask')) attributes.push('[SensitiveData(Protection = ProtectionType.Mask)]');
    if (prop.Attributes.includes('MaskEmail')) attributes.push('[SensitiveData(Protection = ProtectionType.Mask, MaskingType = MaskingType.Email)]');

    const attrPrefix = attributes.length > 0 ? '    ' + attributes.join('\n    ') + '\n' : '';
    let defaultValue = '';
    if (type === 'string') defaultValue = ' = string.Empty;';
    else if (type === 'bool') defaultValue = ' = false;';
    else if (['int', 'decimal', 'double', 'float'].includes(type)) defaultValue = ' = 0;';
    else if (prop.IsEnum) defaultValue = ` = default(${type});`;

    propertiesLines.push(`${attrPrefix}    public ${requiredKeyword}${type} ${prop.Name} { ${initKeyword}; }${defaultValue}`);
  });

  if (entity.SoftDelete) {
    propertiesLines.push('    [Indexed]\n    public bool IsDeleted { get; init; } = false;');
    propertiesLines.push('    public DateTime? DeletedAt { get; init; }');
  }

  const propertiesBody = propertiesLines.length > 0 ? '\n' + propertiesLines.join('\n\n') + '\n' : '';

  return `using System;
using MongoDB.Bson;
using FoundryMongo.Domain.Entities;
using FoundryMongo.Domain.Filters;

namespace ${namespace};

public record ${entity.Name} : ${interfaceList}
{${propertiesBody}}`;
};

const generateEnumCode = (enumDef: any, namespace: string) => {
  const values = enumDef.Values.join(',\n    ');
  return `namespace ${namespace};

public enum ${enumDef.Name}
{
    ${values}
}`;
};

export const StudioWorkspace: React.FC = () => {
  const { 
    namespace, 
    nodes, 
    edges, 
    activeTool,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setActiveTool,
    setNamespace,
    addClassNode,
    addEnumNode,
    deleteNode,
    updateClassNode,
    updateEnumNode,
    updateProperty,
    addProperty,
    deleteProperty,
    addIndex,
    deleteIndex,
    updateIndex,
    exportToSchema,
    importFromSchema,
    customEndpoints,
    addCustomEndpoint,
    updateCustomEndpoint,
    deleteCustomEndpoint,
    exportToApiManifest
  } = useStore();

  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<'JSON' | 'C#'>('JSON');
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string>('./exported-pocos');
  const [manifestPath, setManifestPath] = useState<string>('../../samples/Foundry.Api.Sample/api-manifest.json');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [expandedPropIdx, setExpandedPropIdx] = useState<number | null>(null);

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.selected) || null;
  }, [nodes]);

  const classNodeSelected = useMemo(() => {
    return (selectedNode && selectedNode.type === 'classNode') ? (selectedNode as ClassNode) : null;
  }, [selectedNode]);

  const enumNodeSelected = useMemo(() => {
    return (selectedNode && selectedNode.type === 'enumNode') ? (selectedNode as EnumNode) : null;
  }, [selectedNode]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, _node: any) => {
    // Selection is handled automatically by React Flow state updates
  }, []);

  const handleCanvasClick = useCallback(() => {
    // Deselection is handled automatically by React Flow state updates
  }, []);

  const handleAddClass = useCallback(() => {
    const x = 200 + Math.random() * 100;
    const y = 150 + Math.random() * 100;
    addClassNode(x, y);
  }, [addClassNode]);

  const handleAddEnum = useCallback(() => {
    const x = 200 + Math.random() * 100;
    const y = 150 + Math.random() * 100;
    addEnumNode(x, y);
  }, [addEnumNode]);

  const schemaJson = useMemo(() => {
    return exportToSchema();
  }, [exportToSchema, nodes, edges, namespace]);

  const generatedCsFiles = useMemo(() => {
    const files: Record<string, string> = {};
    schemaJson.Entities.forEach((entity: any) => {
      if (entity.Name) {
        files[`${entity.Name}.cs`] = generateCsCode(entity, namespace);
      }
    });
    schemaJson.Enums.forEach((enumDef: any) => {
      if (enumDef.Name) {
        files[`${enumDef.Name}.cs`] = generateEnumCode(enumDef, namespace);
      }
    });
    return files;
  }, [schemaJson, namespace]);

  // Set default preview file
  const previewFiles = Object.keys(generatedCsFiles);
  if (previewFiles.length > 0 && !selectedPreviewFile) {
    setSelectedPreviewFile(previewFiles[0]);
  }

  const downloadPocos = () => {
    previewFiles.forEach(file => {
      const blob = new Blob([generatedCsFiles[file]], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      a.click();
    });
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(schemaJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
    a.click();
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('http://localhost:5100/api/ai/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Prompt: aiPrompt,
          CurrentSchema: schemaJson,
        }),
      });
      if (!response.ok) {
        throw new Error(`AI Request failed: ${response.statusText}`);
      }
      const updatedSchema = await response.json();
      const entities = updatedSchema.Entities || updatedSchema.entities;
      const enums = updatedSchema.Enums || updatedSchema.enums;
      if (updatedSchema && (entities || enums)) {
        importFromSchema(updatedSchema);
        setAiPrompt('');
      } else {
        throw new Error('AI returned an invalid schema structure.');
      }
    } catch (err: any) {
      setAiError(err.message || 'An error occurred.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveToWorkspace = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch('http://localhost:5100/api/save-pocos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Files: generatedCsFiles,
          OutputPath: outputPath,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save C# classes: ${response.statusText}`);
      }

      const manifestObj = exportToApiManifest();
      const manifestResponse = await fetch('http://localhost:5100/api/save-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Manifest: manifestObj,
          OutputPath: manifestPath,
        }),
      });
      if (!manifestResponse.ok) {
        throw new Error(`Failed to save API manifest: ${manifestResponse.statusText}`);
      }

      // Keep tests in sync as well
      await fetch('http://localhost:5100/api/save-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Manifest: manifestObj,
          OutputPath: '../../tests/Foundry.Api.Tests/api-manifest.json',
        }),
      });

      setSaveMessage('Saved successfully to workspace!');
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message || 'Failed to save'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-sky-500 animate-spin-slow" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Foundry.Schema.Studio
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">NAMESPACE:</span>
            <input
              type="text"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="px-3 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 w-64 text-sky-300"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => { setPreviewTab('JSON'); setShowPreviewModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-all font-medium"
            >
              <Code className="w-3.5 h-3.5" />
              Preview JSON
            </button>
            <button 
              onClick={() => { setPreviewTab('C#'); setShowPreviewModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-all font-medium"
            >
              <Play className="w-3.5 h-3.5" />
              Preview C# POCOs
            </button>
            <button 
              onClick={downloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs transition-all font-medium shadow-lg shadow-sky-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              Download Schema
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel - Toolbox */}
        <div className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 flex flex-col gap-6 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Editor Tools</h2>
            <div className="flex flex-col gap-1.5">
              {(['Select', 'Association', 'Composition', 'Inheritance'] as const).map(tool => (
                <button
                  key={tool}
                  onClick={() => setActiveTool(tool)}
                  className={`px-3 py-2 rounded text-left text-xs transition-all flex items-center justify-between ${
                    activeTool === tool 
                      ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold' 
                      : 'bg-slate-800/20 border border-transparent hover:bg-slate-800/40 text-slate-400'
                  }`}
                >
                  <span>{tool === 'Select' ? 'Pointer/Select' : `${tool} Link`}</span>
                  {activeTool === tool && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Add Elements</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAddClass}
                className="flex flex-col items-center justify-center p-3 bg-slate-800/40 hover:bg-slate-800 border border-slate-800 rounded transition-all group"
              >
                <Plus className="w-5 h-5 text-sky-400 mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">Class Node</span>
              </button>
              
              <button
                onClick={handleAddEnum}
                className="flex flex-col items-center justify-center p-3 bg-slate-800/40 hover:bg-slate-800 border border-slate-800 rounded transition-all group"
              >
                <Plus className="w-5 h-5 text-purple-400 mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">Enum Node</span>
              </button>
            </div>
          </div>

          <div className="mt-auto border-t border-slate-800 pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
              <span>AI Designer Assistant</span>
            </div>
            
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask AI to add Customer class, link composition, etc..."
              className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded text-xs focus:outline-none focus:border-sky-500 text-slate-350 resize-none h-20 placeholder:text-slate-600 font-sans"
            />

            {aiError && (
              <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded">
                {aiError}
              </div>
            )}

            <button
              onClick={handleAiSubmit}
              disabled={isAiLoading || !aiPrompt.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded text-xs font-semibold transition-all shadow-md shadow-sky-600/10 cursor-pointer"
            >
              {isAiLoading ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Thinking...
                </span>
              ) : (
                <>Submit Prompt</>
              )}
            </button>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onClick={handleCanvasClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            className="bg-slate-950"
          >
            <Background color="#1e293b" />
            <Controls className="bg-slate-900 border border-slate-800 text-white rounded-none" />
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'classNode') return '#38bdf8';
                if (node.type === 'enumNode') return '#c084fc';
                return '#64748b';
              }}
              className="bg-slate-900 border border-slate-800"
            />
            
            {/* Custom SVG marker definitions for sharp orthogonal arrowheads */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <marker 
                  id="uml-inheritance" 
                  viewBox="0 0 10 10" 
                  refX="8" 
                  refY="5" 
                  markerWidth="8" 
                  markerHeight="8" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 8 5 L 0 10 z" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                </marker>
                
                <marker 
                  id="uml-composition" 
                  viewBox="0 0 12 12" 
                  refX="10" 
                  refY="6" 
                  markerWidth="10" 
                  markerHeight="10" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 6 L 5 1 L 10 6 L 5 11 z" fill="#475569" stroke="#475569" strokeWidth="1.5" />
                </marker>
                
                <marker 
                  id="uml-association" 
                  viewBox="0 0 10 10" 
                  refX="8" 
                  refY="5" 
                  markerWidth="7" 
                  markerHeight="7" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="#475569" strokeWidth="1.5" />
                </marker>
              </defs>
            </svg>
          </ReactFlow>
        </div>

        {/* Right Panel - Property Inspector */}
        <div className="w-80 bg-slate-900/90 border-l border-slate-800 p-5 overflow-y-auto z-10 backdrop-blur-md flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Property Inspector</h2>
            {selectedNode && (
              <button 
                onClick={() => { deleteNode(selectedNode.id); }}
                className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                title="Delete node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {!selectedNode ? (
            <div className="flex flex-col gap-6">
              {/* Namespace Config */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-slate-500 font-mono block">C# NAMESPACE</label>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:border-sky-500 font-semibold"
                />
              </div>

              {/* Custom Endpoints Config */}
              <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">Custom Endpoints</h3>
                  <button 
                    onClick={addCustomEndpoint}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> ADD
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {customEndpoints.length === 0 ? (
                    <div className="text-center text-slate-600 text-xs py-6 italic border border-dashed border-slate-800 rounded">
                      No custom endpoints configured. Click ADD to add.
                    </div>
                  ) : (
                    customEndpoints.map((ep, idx) => (
                      <div key={idx} className="flex flex-col gap-2 p-2.5 bg-slate-950/40 border border-slate-800 rounded relative group">
                        <button
                          onClick={() => deleteCustomEndpoint(idx)}
                          className="absolute top-2 right-2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete endpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div>
                          <label className="text-[9px] text-slate-500 font-mono block">ROUTE PATH</label>
                          <input
                            type="text"
                            value={ep.route}
                            onChange={(e) => updateCustomEndpoint(idx, { route: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                            placeholder="/api/v1/checkout"
                          />
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[9px] text-slate-500 font-mono block">METHOD</label>
                            <select
                              value={ep.method}
                              onChange={(e) => updateCustomEndpoint(idx, { method: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                            </select>
                          </div>

                          <div className="flex-2">
                            <label className="text-[9px] text-slate-500 font-mono block">REQUEST TYPE (COMMAND)</label>
                            <input
                              type="text"
                              value={ep.requestType}
                              onChange={(e) => updateCustomEndpoint(idx, { requestType: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                              placeholder="PlaceOrderCommand"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] text-slate-500 font-mono block">ROLES (COMMA SEPARATED)</label>
                          <input
                            type="text"
                            value={ep.roles.join(', ')}
                            onChange={(e) => updateCustomEndpoint(idx, { roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                            placeholder="User, Admin"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : classNodeSelected ? (
            <div className="flex flex-col gap-5">
              {/* Class General Info */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-mono block mb-1">CLASS NAME</label>
                  <input
                    type="text"
                    value={classNodeSelected.data.entity.name}
                    onChange={(e) => updateClassNode(classNodeSelected.id, { name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:border-sky-500 font-semibold"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-950/40 p-2.5 border border-slate-800 rounded">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-medium">Soft Delete</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={classNodeSelected.data.entity.softDelete}
                    onChange={(e) => updateClassNode(classNodeSelected.id, { softDelete: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-950/40 p-2.5 border border-slate-800 rounded">
                  <div className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-medium">Auditable</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={classNodeSelected.data.entity.auditable}
                    onChange={(e) => updateClassNode(classNodeSelected.id, { auditable: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Properties Manager */}
              <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">Attributes</h3>
                  <button 
                    onClick={() => addProperty(classNodeSelected.id)}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                  >
                    <Plus className="w-3 h-3" /> ADD
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {classNodeSelected.data.entity.properties.map((prop: Property, idx: number) => {
                    const isExpanded = idx === expandedPropIdx;
                    
                    if (!isExpanded) {
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setExpandedPropIdx(idx)}
                          className="bg-slate-950/40 border border-slate-800 hover:border-slate-700 px-3 py-2 flex items-center justify-between rounded cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-slate-500 font-mono text-xs">+</span>
                            <span className="text-slate-200 font-medium text-xs truncate font-mono">
                              {prop.name || <span className="text-slate-650 italic">unnamed</span>}
                            </span>
                            <span className="text-slate-500 text-[10px] font-mono">: {prop.type}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {prop.isKey && <span className="text-[8px] bg-sky-500/10 text-sky-400 border border-sky-500/25 px-1 font-mono rounded">KEY</span>}
                            {prop.attributes.includes('Required') && <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/25 px-1 font-mono rounded">REQ</span>}
                            {prop.attributes.includes('Encrypt') && <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/25 px-1 font-mono rounded">ENC</span>}
                            
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                deleteProperty(classNodeSelected.id, idx); 
                                if (expandedPropIdx === idx) setExpandedPropIdx(null); 
                              }}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete attribute"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="bg-slate-950 border-2 border-sky-500/40 p-3.5 flex flex-col gap-2 rounded relative">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 mb-1">
                          <span className="text-[9px] font-bold text-sky-400 font-mono">EDITING ATTRIBUTE #{idx + 1}</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setExpandedPropIdx(null)}
                              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded text-[9px] font-bold"
                            >
                              Collapse
                            </button>
                            <button
                              onClick={() => { 
                                deleteProperty(classNodeSelected.id, idx); 
                                setExpandedPropIdx(null); 
                              }}
                              className="p-1 hover:bg-red-500/20 text-slate-450 hover:text-red-400 rounded transition-colors"
                              title="Delete attribute"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-slate-500 font-mono block mb-0.5">NAME</label>
                            <input
                              type="text"
                              value={prop.name}
                              onChange={(e) => updateProperty(classNodeSelected.id, idx, { name: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 font-mono block mb-0.5">TYPE</label>
                            <select
                              value={prop.type}
                              onChange={(e) => updateProperty(classNodeSelected.id, idx, { type: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                            >
                              <option value="string">string</option>
                              <option value="ObjectId">ObjectId</option>
                              <option value="int">int</option>
                              <option value="decimal">decimal</option>
                              <option value="bool">bool</option>
                              <option value="DateTime">DateTime</option>
                              {schemaJson.Enums.map((e: any) => (
                                <option key={e.Name} value={e.Name}>{e.Name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-1">
                          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prop.isKey}
                              onChange={(e) => updateProperty(classNodeSelected.id, idx, { isKey: e.target.checked })}
                              className="w-3.5 h-3.5 accent-sky-500"
                            />
                            Key
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prop.isEnum}
                              onChange={(e) => updateProperty(classNodeSelected.id, idx, { isEnum: e.target.checked })}
                              className="w-3.5 h-3.5 accent-sky-500"
                            />
                            Enum
                          </label>
                        </div>

                        {/* Traits list */}
                        <div className="mt-1 border-t border-slate-800 pt-1.5">
                          <span className="text-[9px] text-slate-500 font-mono block mb-1">TRAITS</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['Required', 'Index', 'Unique', 'TextIndex', 'Encrypt', 'Mask', 'MaskEmail'].map(attr => (
                              <button
                                key={attr}
                                onClick={() => {
                                  const newAttrs = prop.attributes.includes(attr)
                                    ? prop.attributes.filter(a => a !== attr)
                                    : [...prop.attributes, attr];
                                  updateProperty(classNodeSelected.id, idx, { attributes: newAttrs });
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${
                                  prop.attributes.includes(attr)
                                    ? 'bg-sky-500/20 text-sky-400 font-medium'
                                    : 'bg-slate-850 hover:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {attr}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Composite Indexes */}
              <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">Composite Indexes</h3>
                  <button 
                    onClick={() => addIndex(classNodeSelected.id)}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                  >
                    <Plus className="w-3 h-3" /> ADD
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {classNodeSelected.data.entity.indexes.map((idxObj: Index, idxIdx: number) => (
                    <div key={idxIdx} className="bg-slate-950/60 border border-slate-800 p-2.5 rounded relative group flex flex-col gap-1.5">
                      <button
                        onClick={() => deleteIndex(classNodeSelected.id, idxIdx)}
                        className="absolute top-2 right-2 p-1 hover:bg-red-500/20 text-slate-600 hover:text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div>
                        <label className="text-[9px] text-slate-500 font-mono block mb-0.5">FIELDS (comma-separated)</label>
                        <input
                          type="text"
                          value={idxObj.fields.join(', ')}
                          onChange={(e) => updateIndex(classNodeSelected.id, idxIdx, e.target.value.split(',').map(s => s.trim()).filter(Boolean), idxObj.unique)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                          placeholder="e.g. Field1, Field2"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer mt-0.5">
                        <input
                          type="checkbox"
                          checked={idxObj.unique}
                          onChange={(e) => updateIndex(classNodeSelected.id, idxIdx, idxObj.fields, e.target.checked)}
                          className="w-3.5 h-3.5 accent-sky-500"
                        />
                        Unique Constraint
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimal API Settings */}
              <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">Minimal API Settings</h3>
                </div>

                <div className="flex flex-col gap-3 bg-slate-950/45 border border-slate-800 p-3 rounded">
                  {["GET", "GET_BY_ID", "POST", "PUT", "DELETE"].map((verb) => {
                    const enabledMethods = classNodeSelected.data.entity.apiEnabledMethods || ['GET', 'POST', 'GET_BY_ID', 'PUT', 'DELETE'];
                    const isEnabled = enabledMethods.includes(verb);
                    const rolesObj = classNodeSelected.data.entity.apiRoles || {};
                    const rolesStr = (rolesObj[verb] || []).join(', ');
                    
                    const cacheObj = classNodeSelected.data.entity.apiCaching || {};
                    const cacheConfig = cacheObj[verb] || { enabled: false, ttlSeconds: 60 };

                    return (
                      <div key={verb} className="flex flex-col gap-2 border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
                        <label className="flex items-center justify-between text-xs text-white font-semibold cursor-pointer">
                          <span>{verb === 'GET_BY_ID' ? 'GET By ID (Single)' : verb === 'GET' ? 'GET (Search/List)' : verb}</span>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => {
                              const nextMethods = e.target.checked 
                                ? [...enabledMethods, verb]
                                : enabledMethods.filter(m => m !== verb);
                              updateClassNode(classNodeSelected.id, { apiEnabledMethods: nextMethods });
                            }}
                            className="w-4 h-4 accent-sky-500 cursor-pointer"
                          />
                        </label>

                        {isEnabled && (
                          <div className="pl-3 flex flex-col gap-1.5 border-l border-slate-800 mt-1">
                            <div>
                              <span className="text-[9px] text-slate-500 font-mono block">ROLES (COMMA SEPARATED)</span>
                              <input
                                type="text"
                                value={rolesStr}
                                onChange={(e) => {
                                  const nextRoles = { ...rolesObj };
                                  nextRoles[verb] = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  updateClassNode(classNodeSelected.id, { apiRoles: nextRoles });
                                }}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                                placeholder="e.g. Admin, User"
                              />
                            </div>

                            {(verb === 'GET' || verb === 'GET_BY_ID') && (
                              <div className="flex flex-col gap-1.5 mt-1">
                                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={cacheConfig.enabled}
                                    onChange={(e) => {
                                      const nextCaching = { ...cacheObj };
                                      nextCaching[verb] = { ...cacheConfig, enabled: e.target.checked };
                                      updateClassNode(classNodeSelected.id, { apiCaching: nextCaching });
                                    }}
                                    className="w-3.5 h-3.5 accent-sky-500"
                                  />
                                  Enable Query Cache
                                </label>
                                {cacheConfig.enabled && (
                                  <div>
                                    <span className="text-[9px] text-slate-500 font-mono block">CACHE TTL (SECONDS)</span>
                                    <input
                                      type="number"
                                      value={cacheConfig.ttlSeconds}
                                      onChange={(e) => {
                                        const nextCaching = { ...cacheObj };
                                        nextCaching[verb] = { ...cacheConfig, ttlSeconds: parseInt(e.target.value) || 60 };
                                        updateClassNode(classNodeSelected.id, { apiCaching: nextCaching });
                                      }}
                                      className="w-24 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : enumNodeSelected ? (
            // Enum Node properties
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-slate-500 font-mono block mb-1">ENUM NAME</label>
                <input
                  type="text"
                  value={enumNodeSelected.data.enum.name}
                  onChange={(e) => updateEnumNode(enumNodeSelected.id, { name: e.target.value, values: enumNodeSelected.data.enum.values })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:border-sky-500 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400">Values</h3>
                  <button 
                    onClick={() => {
                      const values = [...enumNodeSelected.data.enum.values, ''];
                      updateEnumNode(enumNodeSelected.id, { name: enumNodeSelected.data.enum.name, values });
                    }}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                  >
                    <Plus className="w-3 h-3" /> ADD
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {enumNodeSelected.data.enum.values.map((val: string, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const values = [...enumNodeSelected.data.enum.values];
                          values[idx] = e.target.value;
                          updateEnumNode(enumNodeSelected.id, { name: enumNodeSelected.data.enum.name, values });
                        }}
                        className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button 
                        onClick={() => {
                          const values = [...enumNodeSelected.data.enum.values];
                          values.splice(idx, 1);
                          updateEnumNode(enumNodeSelected.id, { name: enumNodeSelected.data.enum.name, values });
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Code / JSON Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="w-full max-w-4xl h-[80vh] bg-slate-900 border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg">Visual Output Preview</h3>
                <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded">
                  <button
                    onClick={() => setPreviewTab('JSON')}
                    className={`px-3 py-1 text-xs rounded transition-all ${
                      previewTab === 'JSON' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON Schema
                  </button>
                  <button
                    onClick={() => setPreviewTab('C#')}
                    className={`px-3 py-1 text-xs rounded transition-all ${
                      previewTab === 'C#' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    C# POCO classes
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* C# Files sidebar */}
              {previewTab === 'C#' && (
                <div className="w-64 border-r border-slate-800 bg-slate-950/40 p-4 overflow-y-auto flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-mono block mb-2 uppercase tracking-wider">Generated files</span>
                  {previewFiles.map(file => (
                    <button
                      key={file}
                      onClick={() => setSelectedPreviewFile(file)}
                      className={`px-3 py-2 rounded text-left text-xs font-mono transition-all ${
                        selectedPreviewFile === file 
                          ? 'bg-slate-800 text-white font-medium border border-slate-700' 
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      {file}
                    </button>
                  ))}
                </div>
              )}

              {/* Code viewer */}
              <div className="flex-1 p-6 overflow-auto bg-slate-950 font-mono text-sm text-slate-300 relative">
                {previewTab === 'C#' && selectedPreviewFile && (
                  <div className="absolute top-4 right-4 flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded shadow-xl z-20">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 font-mono block mb-0.5 uppercase">Output Dir</span>
                      <input
                        type="text"
                        value={outputPath}
                        onChange={(e) => setOutputPath(e.target.value)}
                        className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-sky-400 font-mono focus:outline-none focus:border-sky-500 w-36"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 font-mono block mb-0.5 uppercase">Manifest Path</span>
                      <input
                        type="text"
                        value={manifestPath}
                        onChange={(e) => setManifestPath(e.target.value)}
                        className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-sky-400 font-mono focus:outline-none focus:border-sky-500 w-48"
                      />
                    </div>
                    <button
                      onClick={handleSaveToWorkspace}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition-all shadow-md disabled:bg-slate-850 disabled:text-slate-500 cursor-pointer"
                    >
                      {isSaving ? 'Saving...' : 'Save to Workspace'}
                    </button>
                    <button
                      onClick={downloadPocos}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded text-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download All
                    </button>
                    {saveMessage && (
                      <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-800 p-2.5 rounded text-[10px] text-sky-400 shadow-2xl max-w-xs text-right whitespace-pre-wrap font-mono">
                        {saveMessage}
                      </div>
                    )}
                  </div>
                )}
                
                <pre className="whitespace-pre">
                  {previewTab === 'JSON' 
                    ? JSON.stringify(schemaJson, null, 2)
                    : generatedCsFiles[selectedPreviewFile] || '// No POCO classes generated yet.'
                  }
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};