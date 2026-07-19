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
  apiBusinessRules?: Record<string, string[]>;

  // Real-Time Settings
  realTime?: boolean;
  realTimeRoles?: string[];
}

export interface Enum {
  name: string;
  values: string[];
}

export interface Assignment {
  entityProperty: string;
  sourceType: string;
  sourceValue: string;
}

export interface CustomEndpoint {
  route: string;
  method: string;
  requestType: string;
  roles: string[];
  
  // Visual Data Operation Config
  operationType: string;
  targetEntity?: string;
  filterField?: string;
  filterOperator?: string;
  filterSourceValue?: string;
  assignments: Assignment[];
  businessRules?: string[];
}

export interface DtoProperty {
  name: string;
  type: string;
  sourceEntity?: string;
  sourceProperty?: string;
  isRequired: boolean;
  attributes: string[];
}

export interface DtoModel {
  name: string;
  properties: DtoProperty[];
}

export type ClassNode = Node<{ entity: Entity }, 'classNode'>;
export type EnumNode = Node<{ enum: Enum }, 'enumNode'>;
export type AppNode = ClassNode | EnumNode;
