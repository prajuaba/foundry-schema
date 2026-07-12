import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EnumNode } from '../types';

export const UmlEnumNode: React.FC<NodeProps<EnumNode>> = ({ data, selected }) => {
  const { enum: enumData } = data;
  return (
    <div className={`min-w-[200px] rounded-none bg-slate-900 border-2 ${selected ? 'border-sky-500' : 'border-slate-700'}`}>
      {/* Header compartment */}
      <div className="border-b border-slate-700 p-2">
        <div className="text-center text-[10px] text-slate-500 uppercase tracking-wider">«Enum»</div>
        <div className="text-center font-bold text-white">{enumData.name}</div>
      </div>
      
      {/* Values compartment */}
      <div className="p-2">
        {enumData.values && enumData.values.length > 0 ? (
          <ul className="list-none text-xs text-slate-200 font-mono">
            {enumData.values.map((value, index) => (
              <li key={index} className="px-2 py-0.5">{value}</li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-xs text-slate-500 italic py-1">No values</div>
        )}
      </div>
      
      {/* Handles */}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
};