using System.Collections.Generic;

namespace Foundry.Schema.Compiler
{
    public record SchemaModel
    {
        public string Namespace { get; init; } = string.Empty;
        public List<Entity> Entities { get; init; } = new();
        public List<Enum> Enums { get; init; } = new();
    }

    public record Entity
    {
        public string Name { get; init; } = string.Empty;
        public string? BaseClass { get; init; }
        public bool SoftDelete { get; init; }
        public bool Auditable { get; init; }
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
}