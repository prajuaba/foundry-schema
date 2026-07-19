using System.Collections.Generic;

namespace Foundry.Schema.Compiler
{
    public record SchemaModel
    {
        public string Namespace { get; init; } = string.Empty;
        public List<Entity> Entities { get; init; } = new();
        public List<Enum> Enums { get; init; } = new();
        public List<DtoModel> Dtos { get; init; } = new();
        public List<CustomEndpoint> CustomEndpoints { get; init; } = new();
    }

    public record Entity
    {
        public string Name { get; init; } = string.Empty;
        public string? BaseClass { get; init; }
        public bool SoftDelete { get; init; }
        public bool Auditable { get; init; }
        public bool Partitioned { get; init; }
        public int ArchiveThresholdYears { get; init; } = 2;
        public bool RealTime { get; init; } = true;
        public List<string> RealTimeRoles { get; init; } = new();
        public List<Property> Properties { get; init; } = new();
        public List<Index> Indexes { get; init; } = new();
    }

    public record Property
    {
        public string Name { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public bool IsKey { get; init; }
        public bool IsEnum { get; init; }
        public List<string> Attributes { get; init; } = new();
    }

    public record Index
    {
        public List<string> Fields { get; init; } = new();
        public bool Unique { get; init; }
    }

    public record Enum
    {
        public string Name { get; init; } = string.Empty;
        public List<string> Values { get; init; } = new();
    }

    public record DtoModel
    {
        public string Name { get; init; } = string.Empty;
        public List<DtoProperty> Properties { get; init; } = new();
    }

    public record DtoProperty
    {
        public string Name { get; init; } = string.Empty;
        public string Type { get; init; } = string.Empty;
        public string? SourceEntity { get; init; }
        public string? SourceProperty { get; init; }
        public bool IsRequired { get; init; }
        public List<string> Attributes { get; init; } = new();
    }

    public record CustomEndpoint
    {
        public string Route { get; init; } = string.Empty;
        public string Method { get; init; } = string.Empty;
        public string RequestType { get; init; } = string.Empty;
        public List<string> Roles { get; init; } = new();
        public string OperationType { get; init; } = "Custom";
        public string? TargetEntity { get; init; }
        public string? FilterField { get; init; }
        public string? FilterOperator { get; init; }
        public string? FilterSourceValue { get; init; }
        public List<Assignment> Assignments { get; init; } = new();
    }

    public record Assignment
    {
        public string EntityProperty { get; init; } = string.Empty;
        public string SourceType { get; init; } = "RequestProperty";
        public string SourceValue { get; init; } = string.Empty;
    }
}