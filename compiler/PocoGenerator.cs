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

            // Generate DTOs
            if (schema.Dtos != null)
            {
                foreach (var dto in schema.Dtos)
                {
                    var dtoCode = GenerateDto(dto, schema.Namespace);
                    result[dto.Name] = dtoCode;
                }
            }

            // Generate Custom Endpoint Handlers
            if (schema.CustomEndpoints != null)
            {
                foreach (var ep in schema.CustomEndpoints)
                {
                    if (string.IsNullOrEmpty(ep.RequestType) || ep.RequestType.Equals("Void", StringComparison.OrdinalIgnoreCase))
                        continue;

                    var handlerCode = GenerateHandler(ep, schema.Namespace);
                    result[$"Handlers/{ep.RequestType}Handler"] = handlerCode;

                    if (ep.BusinessRules != null)
                    {
                        foreach (var rule in ep.BusinessRules)
                        {
                            if (string.IsNullOrWhiteSpace(rule)) continue;
                            result[$"Rules/{rule}"] = GenerateCustomEndpointRuleStub(rule, ep.RequestType, schema.Namespace);
                        }
                    }
                }
            }

            // Generate Entity-level CRUD Rules stubs
            if (schema.Entities != null)
            {
                foreach (var entity in schema.Entities)
                {
                    if (entity.ApiBusinessRules == null) continue;
                    foreach (var pair in entity.ApiBusinessRules)
                    {
                        var method = pair.Key;
                        var rules = pair.Value;
                        if (rules == null) continue;
                        foreach (var rule in rules)
                        {
                            if (string.IsNullOrWhiteSpace(rule)) continue;
                            result[$"Rules/{rule}"] = GenerateEntityRuleStub(rule, method, entity.Name, schema.Namespace);
                        }
                    }
                }
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
                foreach (var attr in prop.Attributes)
                {
                    if (attr == "UniqueIndex" || attr == "Unique")
                        attributes.Add("[Indexed(Unique = true)]");
                    else if (attr == "Index")
                        attributes.Add("[Indexed]");
                    else if (attr == "TextIndex")
                        attributes.Add("[TextIndexed]");
                    else if (attr == "Required")
                        attributes.Add("[Required]");
                    else if (attr == "Encrypt")
                        attributes.Add("[SensitiveData(Protection = ProtectionType.Encrypt)]");
                    else if (attr == "Mask")
                        attributes.Add("[SensitiveData(Protection = ProtectionType.Mask)]");
                    else if (attr == "MaskEmail")
                        attributes.Add("[SensitiveData(Protection = ProtectionType.Mask, MaskingType = MaskingType.Email)]");
                    else if (attr.StartsWith("MinLength(", StringComparison.OrdinalIgnoreCase))
                        attributes.Add($"[{attr}]");
                    else if (attr.StartsWith("MaxLength(", StringComparison.OrdinalIgnoreCase))
                        attributes.Add($"[{attr}]");
                    else if (attr.StartsWith("Range(", StringComparison.OrdinalIgnoreCase))
                        attributes.Add($"[{attr}]");
                    else if (attr.StartsWith("Regex(", StringComparison.OrdinalIgnoreCase))
                    {
                        var pattern = attr.Substring(6, attr.Length - 7);
                        attributes.Add($"[RegularExpression({pattern})]");
                    }
                    else if (attr.Equals("Email", StringComparison.OrdinalIgnoreCase))
                        attributes.Add("[EmailAddress]");
                    else if (attr.Equals("Url", StringComparison.OrdinalIgnoreCase))
                        attributes.Add("[Url]");
                    else if (attr.Equals("Phone", StringComparison.OrdinalIgnoreCase))
                        attributes.Add("[Phone]");
                }

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

            var partitionAttribute = entity.Partitioned
                ? $"[Partitioned({entity.ArchiveThresholdYears})]\n"
                : "";

            var realTimeAttribute = "";
            if (!entity.RealTime)
            {
                realTimeAttribute = "[RealTime(false)]\n";
            }
            else if (entity.RealTimeRoles != null && entity.RealTimeRoles.Count > 0)
            {
                var rolesList = string.Join(", ", entity.RealTimeRoles.Select(r => $"\"{r}\""));
                realTimeAttribute = $"[RealTime(true, new[] {{ {rolesList} }})]\n";
            }

            var needAttributes = entity.Partitioned || !entity.RealTime || (entity.RealTimeRoles != null && entity.RealTimeRoles.Count > 0);
            var extraImports = needAttributes
                ? "\nusing Foundry.Core.Attributes;"
                : "";

            return $@"using System;
using System.ComponentModel.DataAnnotations;
using MongoDB.Bson;
using Foundry.Core.Entities;{extraImports}

namespace {@namespace};

{partitionAttribute}{realTimeAttribute}public record {entity.Name} : {interfaceList}
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

        private static string GenerateDto(DtoModel dto, string @namespace)
        {
            var properties = new List<string>();
            foreach (var prop in dto.Properties)
            {
                var type = MapType(prop.Type);
                var requiredKeyword = prop.IsRequired ? "required " : "";
                var initKeyword = "get; init";

                var attributes = new List<string>();
                foreach (var attr in prop.Attributes)
                {
                    if (attr == "Required")
                        attributes.Add("[Required]");
                    else if (attr.StartsWith("MinLength(", StringComparison.OrdinalIgnoreCase))
                        attributes.Add($"[{attr}]");
                    else if (attr.StartsWith("MaxLength(", StringComparison.OrdinalIgnoreCase))
                        attributes.Add($"[{attr}]");
                    else if (attr.StartsWith("Range(", StringComparison.OrdinalIgnoreCase))
                        attributes.Add($"[{attr}]");
                    else if (attr.StartsWith("Regex(", StringComparison.OrdinalIgnoreCase))
                    {
                        var pattern = attr.Substring(6, attr.Length - 7);
                        attributes.Add($"[RegularExpression({pattern})]");
                    }
                    else if (attr.Equals("Email", StringComparison.OrdinalIgnoreCase))
                        attributes.Add("[EmailAddress]");
                    else if (attr.Equals("Url", StringComparison.OrdinalIgnoreCase))
                        attributes.Add("[Url]");
                    else if (attr.Equals("Phone", StringComparison.OrdinalIgnoreCase))
                        attributes.Add("[Phone]");
                }

                var attributeLines = string.Join("\n    ", attributes);
                var attributeLine = string.IsNullOrEmpty(attributeLines) ? "" : $"    {attributeLines}\n";

                var defaultValue = "";
                if (type == "string")
                    defaultValue = " = string.Empty;";
                else if (type == "bool")
                    defaultValue = " = false;";
                else if (type == "int" || type == "decimal" || type == "double" || type == "float")
                    defaultValue = " = 0;";

                properties.Add($"{attributeLine}    public {requiredKeyword}{type} {prop.Name} {{ {initKeyword}; }}{defaultValue}");
            }

            var propertyLines = string.Join("\n\n", properties);
            if (!string.IsNullOrEmpty(propertyLines))
                propertyLines = "\n" + propertyLines + "\n";

            return $@"using System;
using System.ComponentModel.DataAnnotations;
using MongoDB.Bson;

namespace {@namespace};

public record {dto.Name}
{{{propertyLines}}}";
        }

        private static string GenerateHandler(CustomEndpoint ep, string @namespace)
        {
            var handlerName = ep.RequestType + "Handler";
            var responseType = ep.Method.Equals("GET", StringComparison.OrdinalIgnoreCase) 
                ? ep.RequestType.Replace("Query", "Response").Replace("Request", "Response") 
                : "bool";
            
            var repoType = !string.IsNullOrEmpty(ep.TargetEntity) ? $"IRepository<{ep.TargetEntity}>" : null;

            var newResponseExpr = $"new {responseType}";
            var newDtoExpr = $"new {ep.TargetEntity}Dto";
            var newEntityExpr = $"new {ep.TargetEntity}";

            string body = "";
            if (ep.OperationType.Equals("Query", StringComparison.OrdinalIgnoreCase))
            {
                body = $@"        var items = await _repository.FindAsync(
            x => x.{ep.FilterField ?? "Id"} == request.{ep.FilterSourceValue ?? "Id"},
            cancellationToken: cancellationToken);

        return {newResponseExpr}
        {{
            // Auto-projected from {ep.TargetEntity} records
            Items = items.Select(x => {newDtoExpr}
            {{
                // Property mappings appear here
            }}).ToList()
        }};";
            }
            else if (ep.OperationType.Equals("Update", StringComparison.OrdinalIgnoreCase))
            {
                var assignmentsCode = "";
                if (ep.Assignments != null)
                {
                    assignmentsCode = string.Join("\n", ep.Assignments.Select(a => 
                        $"        entity.{a.EntityProperty} = request.{a.SourceValue};"));
                }

                body = $@"        var entity = await _repository.GetByIdAsync(request.{ep.FilterSourceValue ?? "Id"});
        if (entity == null)
        {{
            return false;
        }}

        // Apply visual assignments
{assignmentsCode}

        await _repository.UpdateAsync(entity);
        return true;";
            }
            else if (ep.OperationType.Equals("Insert", StringComparison.OrdinalIgnoreCase))
            {
                body = $@"        var entity = {newEntityExpr}
        {{
            // Auto-mapped from request payload properties
        }};

        await _repository.AddAsync(entity);
        return true;";
            }
            else
            {
                body = @"        // Write your custom MediatR query/command logic here
        throw new NotImplementedException(""Custom logic handler."");";
            }

            var fieldDeclaration = repoType != null ? $"    private readonly {repoType} _repository;\n" : "";
            
            var constructor = repoType != null 
                ? $@"    public {handlerName}({repoType} repository)
    {{
        _repository = repository;
    }}"
                : $@"    public {handlerName}()
    {{
    }}";

            return $@"using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using MongoDB.Bson;
using Foundry.Core.Entities;
using FoundryMongo.Repositories;
using {@namespace};

namespace {@namespace}.Handlers;

public class {handlerName} : IRequestHandler<{ep.RequestType}, {responseType}>
{{
{fieldDeclaration}
{constructor}

    public async Task<{responseType}> Handle({ep.RequestType} request, CancellationToken cancellationToken)
    {{
{body}
    }}
}}";
        }

        private static string GenerateCustomEndpointRuleStub(string ruleName, string requestType, string ns)
        {
            return $@"using System.Threading;
using System.Threading.Tasks;
using Foundry.Rules;

namespace {ns}.Rules;

/// <summary>
/// Custom business rule validator for {requestType}.
/// </summary>
public class {ruleName} : IBusinessRule<{ns}.{requestType}>
{{
    public Task<RuleResult> ValidateAsync({ns}.{requestType} request, CancellationToken ct)
    {{
        // TODO: Implement custom business policy validation logic
        return Task.FromResult(RuleResult.Success());
    }}
}}
";
        }

        private static string GenerateEntityRuleStub(string ruleName, string method, string entityName, string ns)
        {
            var requestType = method.ToUpperInvariant() switch
            {
                "POST" => $"InsertCommand<{ns}.{entityName}>",
                "PUT" => $"UpdateCommand<{ns}.{entityName}>",
                "DELETE" => $"DeleteCommand<{ns}.{entityName}>",
                "GET_BY_ID" => $"GetByIdQuery<{ns}.{entityName}>",
                "GET" => $"FindManyQuery<{ns}.{entityName}>",
                _ => "object"
            };

            return $@"using System.Threading;
using System.Threading.Tasks;
using Foundry.Rules;
using Foundry.Api.MediatR;

namespace {ns}.Rules;

/// <summary>
/// Entity CRUD business rule validator for {entityName} on {method}.
/// </summary>
public class {ruleName} : IBusinessRule<{requestType}>
{{
    public Task<RuleResult> ValidateAsync({requestType} request, CancellationToken ct)
    {{
        // TODO: Implement custom business policy validation logic
        return Task.FromResult(RuleResult.Success());
    }}
}}
";
        }
    }
}