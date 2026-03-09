import { handler as inferToolHandler } from "./tools/infer_tool/index.js";

async function testInferTool() {
  console.log("=".repeat(60));
  console.log("Testing rosetta_infer_tool Handler");
  console.log("=".repeat(60));

  const testInput = {
    description: "Takes a list of numbers and returns their sum",
  };

  console.log("\nInput:");
  console.log(JSON.stringify(testInput, null, 2));

  try {
    console.log("\nCalling handler...");
    const result = await inferToolHandler(testInput);

    console.log("\nRaw result structure:");
    console.log(JSON.stringify(result, null, 2));

    // Parse the actual tool definition from content
    if (result.content && result.content.length > 0) {
      const toolContent = result.content[0];
      console.log("\nContent type:", toolContent.type);

      const toolDefinition = JSON.parse(toolContent.text);
      console.log("\nParsed tool definition:");
      console.log(JSON.stringify(toolDefinition, null, 2));

      // Validate required fields
      console.log("\nValidation:");
      const requiredFields = [
        "tool_name",
        "purpose",
        "input_schema",
        "output_schema",
      ];
      const hasAllFields = requiredFields.every((field) =>
        toolDefinition.hasOwnProperty(field)
      );
      console.log(
        `✓ Has all required fields (${requiredFields.join(", ")}):`,
        hasAllFields
      );

      if (hasAllFields) {
        console.log(
          `✓ tool_name: "${toolDefinition.tool_name}" (type: ${typeof toolDefinition.tool_name})`
        );
        console.log(
          `✓ purpose: "${toolDefinition.purpose}" (type: ${typeof toolDefinition.purpose})`
        );
        console.log(
          `✓ input_schema: (type: ${typeof toolDefinition.input_schema})`
        );
        console.log(
          `✓ output_schema: (type: ${typeof toolDefinition.output_schema})`
        );

        // Validate schemas are objects
        const inputSchemaValid =
          typeof toolDefinition.input_schema === "object" &&
          toolDefinition.input_schema !== null;
        const outputSchemaValid =
          typeof toolDefinition.output_schema === "object" &&
          toolDefinition.output_schema !== null;
        console.log(`✓ input_schema is object: ${inputSchemaValid}`);
        console.log(`✓ output_schema is object: ${outputSchemaValid}`);
      }

      console.log("\n✅ Test PASSED: Handler executed successfully");
    }
  } catch (error) {
    console.error(
      "\n❌ Test FAILED:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testInferTool();
