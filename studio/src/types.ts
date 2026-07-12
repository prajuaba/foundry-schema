import type { Node } from '@xyflow/react';

export interface Property {
  name: string;
  type: string;
  isKey: boolean;
  isEnum: boolean;
  attributes: string[];
}

export interface Index {
  fields: string[];
  unique: boolean;
}

export interface CachingConfig {
  enabled: boolean;
  ttlSeconds: number;
}

export interface Entity {
  name: string;
  baseClass?: string;
  softDelete: boolean;
  auditable: boolean;
  indexes: Index[];
  properties: Property[];
  
  // API Settings
  apiEnabledMethods?: string[];
  apiRoles?: Record<string, string[]>;
  apiCaching?: Record<string, CachingConfig>;
}

export interface Enum {
  name: string;
  values: string[];
}

export interface CustomEndpoint {
  route: string;
  method: string;
  requestType: string;
  roles: string[];
}

export type ClassNode = Node<{ entity: Entity }, 'classNode'>;
export type EnumNode = Node<{ enum: Enum }, 'enumNode'>;
export type AppNode = ClassNode | EnumNode;
