import * as fs from "node:fs";
import * as path from "node:path";
import {
  quicktype,
  InputData,
  JSONSchemaInput,
  FetchingJSONSchemaStore,
} from "quicktype-core";

async function main() {
  const schemasDir = path.resolve("schemas");
  const outputPath = path.resolve(
    "mobile/ios/Models/Generated/ProtocolModels.swift"
  );

  const schemaFiles = fs
    .readdirSync(schemasDir)
    .filter((f) => f.endsWith(".schema.json"));

  console.log(`Generating Swift models from ${schemaFiles.length} Rust JSON schemas...`);

  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

  for (const file of schemaFiles) {
    const fullPath = path.join(schemasDir, file);
    const schemaContent = fs.readFileSync(fullPath, "utf-8");
    const typeName = path.basename(file, ".schema.json").replace(/^[a-z]/, (c) => c.toUpperCase());
    await schemaInput.addSource({
      name: typeName,
      schema: schemaContent,
    });
  }

  const inputData = new InputData();
  inputData.addInput(schemaInput);

  const result = await quicktype({
    inputData,
    lang: "swift",
    rendererOptions: {
      "just-types": "false",
      density: "dense",
      "struct-or-class": "struct",
      sendable: "true",
    },
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.lines.join("\n"), "utf-8");

  console.log(`✓ Successfully updated Swift models: ${outputPath} (${result.lines.length} lines)`);
}

main().catch((err) => {
  console.error("Failed to generate Swift models:", err);
  process.exit(1);
});
