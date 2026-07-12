import React from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export const OrthogonalEdge: React.FC<EdgeProps> = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0, // Sharp 90-degree corners
  });

  const markerEnd = data?.relationshipType || data?.type;
  
  let markerUrl = '';
  switch (markerEnd) {
    case 'Inheritance':
      markerUrl = 'url(#uml-inheritance)';
      break;
    case 'Composition':
      markerUrl = 'url(#uml-composition)';
      break;
    case 'Association':
      markerUrl = 'url(#uml-association)';
      break;
    default:
      markerUrl = 'url(#uml-association)';
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerUrl}
      style={{ strokeWidth: 2, stroke: '#475569' }}
    />
  );
};