using System;
using System.Collections.Generic;
using System.Linq;

namespace Foundry.Schema.Compiler
{
    public static class PocoGenerator
    {
        public static Dictionary<string, string> Generate(SchemaModel schema)
        {
            var result = new Dictionary<string, string>();

            // Generate enums
            foreach (var enumDef in schema.Enums)
            {
                var enumCode = GenerateEnum(enumDef, schema.Namespace);
                result[enumDef.Name] = enumCode;
            }

            // Generate entities
            foreach (var entity in schema.Entities)
            {
                var entityCode = GenerateEntity(entity, schema.Namespace);
                result[entity.Name] = entityCode;
            }

            return result;
        }

        private static string GenerateEnum(Enum enumDef, string @namespace)
        {
            var values = string.Join(",\n    ", enumDef.Values);
            return $@"namespace {@namespace};

public enum {enumDef.Name}
{{
    {values}
}}";
        }

        private static string GenerateEntity(Entity entity, string @namespace)
        {
            var keyProperty = entity.Properties.FirstOrDefault(p => p.IsKey);
            var keyType = keyProperty?.Type ?? "ObjectId";

            // Map ObjectId to C# type name
            if (keyType.Equals("ObjectId", StringComparison.OrdinalIgnoreCase))
                keyType = "ObjectId";

            var interfaces = new List<string>();
            if (!string.IsNullOrEmpty(entity.BaseClass))
                interfaces.Add(entity.BaseClass);
            else
                interfaces.Add("BaseEntity<" + keyType + ">");

            interfaces.Add("IVersionable");
            if (entity.SoftDelete)
                interfaces.Add("ISoftDelete");

            var interfaceList = string.Join(", ", interfaces);

            var properties = new List<string>();
            foreach (var prop in entity.Properties)
            {
                if (prop.IsKey)
                    continue;

                var type = MapType(prop.Type);
                var requiredKeyword = prop.Attributes.Contains("Required") ? "required " : "";
                var initKeyword = "get; init"; // default to get; init for records

                var attributes = new List<string>();
                if (prop.Attributes.Contains("UniqueIndex") || prop.Attributes.Contains("Unique"))
                    attributes.Add("[Indexed(Unique = true)]");
                else if (prop.Attributes.Contains("Index"))
                    attributes.Add("[Indexed]");
                
                if (prop.Attributes.Contains("TextIndex"))
                    attributes.Add("[TextIndexed]");
                if (prop.Attributes.Contains("Encrypt"))
                    attributes.Add("[SensitiveData(Protection = ProtectionType.Encrypt)]");
                if (prop.Attributes.Contains("Mask"))
                    attributes.Add("[SensitiveData(Protection = ProtectionType.Mask)]");
                if (prop.Attributes.Contains("MaskEmail"))
                    attributes.Add("[SensitiveData(Protection = ProtectionType.Mask, MaskingType = MaskingType.Email)]");

                var attributeLines = string.Join("\n    ", attributes);
                var attributeLine = string.IsNullOrEmpty(attributeLines) ? "" : $"    {attributeLines}\n";

                var defaultValue = "";
                if (type == "string")
                    defaultValue = " = string.Empty;";
                else if (type == "bool")
                    defaultValue = " = false;";
                else if (type == "int" || type == "decimal" || type == "double" || type == "float")
                    defaultValue = " = 0;";
                else if (prop.IsEnum)
                    defaultValue = $" = default({type});";

                properties.Add($"{attributeLine}    public {requiredKeyword}{type} {prop.Name} {{ {initKeyword}; }}{defaultValue}");
            }

            if (entity.SoftDelete)
            {
                properties.Add("    [Indexed]\n    public bool IsDeleted { get; init; } = false;");
                properties.Add("    public DateTime? DeletedAt { get; init; }");
            }

            var propertyLines = string.Join("\n\n", properties);
            if (!string.IsNullOrEmpty(propertyLines))
                propertyLines = "\n" + propertyLines + "\n";

            return $@"using System;
using MongoDB.Bson;
using FoundryMongo.Domain.Entities;
using FoundryMongo.Domain.Filters;

namespace {@namespace};

public record {entity.Name} : {interfaceList}
{{{propertyLines}}}";
        }

        private static string MapType(string schemaType)
        {
            return schemaType.ToLowerInvariant() switch
            {
                "string" => "string",
                "int" => "int",
                "decimal" => "decimal",
                "double" => "double",
                "float" => "float",
                "bool" => "bool",
                "datetime" => "DateTime",
                "guid" => "Guid",
                "objectid" => "ObjectId",
                _ => schemaType
            };
        }
    }
}