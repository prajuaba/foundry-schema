import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Property, ClassNode } from '../types';

const UmlClassNode: React.FC<NodeProps<ClassNode>> = ({ data, selected }) => {
  const { entity } = data;

  const getVisibilitySymbol = (isPublic: boolean) => {
    return isPublic ? '+' : '-';
  };

  const getStereotype = () => {
    const hasKey = entity.properties.some(p => p.isKey);
    if (hasKey) return '«Entity»';
    return '«ValueObject»';
  };

  const getTraitBadges = () => {
    const badges = [];
    if (entity.softDelete) badges.push('[SoftDelete]');
    if (entity.auditable) badges.push('[Auditable]');
    return badges;
  };

  const getPropertyBadges = (property: Property) => {
    const badges = [];
    if (property.isKey) badges.push('[Key]');
    if (property.attributes.includes('UniqueIndex') || property.attributes.includes('Unique')) {
      badges.push('[Unique]');
    } else if (property.attributes.includes('Index')) {
      badges.push('[Index]');
    }
    if (property.attributes.includes('Encrypt')) badges.push('[Encrypt]');
    if (property.attributes.includes('Mask')) badges.push('[Mask]');
    if (property.attributes.includes('MaskEmail')) badges.push('[MaskEmail]');
    if (property.attributes.includes('Required')) badges.push('[Required]');
    return badges;
  };

  const defaultMethods = [
    '+ SaveAsync()',
    '+ UpdateAsync()',
    '+ DeleteAsync()'
  ];

  const methods = defaultMethods;

  return (
    <div 
      className={`rounded-none bg-slate-900 border-2 ${selected ? 'border-sky-500' : 'border-slate-700'} p-2 min-w-[200px]`}
    >
      {/* Header */}
      <div className="flex flex-col items-center mb-2">
        <div className="text-xs text-slate-400 mb-1">{getStereotype()}</div>
        <div className="font-bold text-white">{entity.name}</div>
        <div className="flex gap-1 mt-1">
          {getTraitBadges().map((badge, index) => (
            <span key={index} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-1 rounded">
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Attributes */}
      <div className="border-t border-slate-700 pt-2 mb-2">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Attributes</div>
        <div className="flex flex-col gap-1.5 text-xs">
          {entity.properties.map((prop, index) => (
            <div key={index} className="flex flex-col">
              <div className="flex justify-between items-center">
                <div className="flex gap-1 items-center">
                  <span className="text-slate-500 font-mono">{getVisibilitySymbol(true)}</span>
                  <span className="text-white font-medium">{prop.name}</span>
                </div>
                <span className="text-slate-400 font-mono text-[10px]">{prop.type}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {getPropertyBadges(prop).map((badge, badgeIndex) => (
                  <span key={badgeIndex} className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded-none border border-slate-800">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Methods */}
      <div className="border-t border-slate-700 pt-2">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Methods</div>
        <div className="flex flex-col gap-1 text-xs font-mono">
          {methods.map((method, index) => (
            <span key={index} className="text-slate-300">{method}</span>
          ))}
        </div>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
};

export default UmlClassNode;