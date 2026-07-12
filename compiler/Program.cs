using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace Foundry.Schema.Compiler
{
    class Program
    {
        static void Main(string[] args)
        {
            string? inputPath = null;
            string? outputPath = null;

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--input" || args[i] == "-i")
                {
                    if (i + 1 < args.Length)
                        inputPath = args[++i];
                    else
                    {
                        Console.WriteLine("Error: --input requires a file path.");
                        PrintUsage();
                        return;
                    }
                }
                else if (args[i] == "--output" || args[i] == "-o")
                {
                    if (i + 1 < args.Length)
                        outputPath = args[++i];
                    else
                    {
                        Console.WriteLine("Error: --output requires a directory path.");
                        PrintUsage();
                        return;
                    }
                }
            }

            if (string.IsNullOrEmpty(inputPath) || string.IsNullOrEmpty(outputPath))
            {
                Console.WriteLine("Error: Both --input and --output are required.");
                PrintUsage();
                return;
            }

            if (!File.Exists(inputPath))
            {
                Console.WriteLine($"Error: Input file '{inputPath}' does not exist.");
                return;
            }

            try
            {
                var json = File.ReadAllText(inputPath);
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var schema = JsonSerializer.Deserialize<SchemaModel>(json, options);

                if (schema == null || string.IsNullOrEmpty(schema.Namespace))
                {
                    Console.WriteLine("Error: Schema is null or namespace is empty.");
                    return;
                }

                var generatedFiles = PocoGenerator.Generate(schema);

                Directory.CreateDirectory(outputPath);

                foreach (var file in generatedFiles)
                {
                    var filePath = Path.Combine(outputPath, $"{file.Key}.cs");
                    File.WriteAllText(filePath, file.Value);
                    Console.WriteLine($"Generated: {filePath}");
                }

                Console.WriteLine("Success: Files generated successfully.");
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"Error: Failed to deserialize JSON. {ex.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: An unexpected error occurred. {ex.Message}");
            }
        }

        static void PrintUsage()
        {
            Console.WriteLine("Usage: Foundry.Schema.Compiler --input <schema.json> --output <directory>");
            Console.WriteLine("  --input, -i     : Path to the JSON schema file");
            Console.WriteLine("  --output, -o    : Output directory path");
        }
    }
}