// Test to verify FormData behavior with JSON strings containing booleans
const FormData = require('form-data');

const testOpenApiDoc = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/test": {
      get: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  example: {
                    data: {
                      var1: true,
                      var2: false
                    },
                    status: "success"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

console.log("=== Original Object ===");
console.log("Boolean types:", typeof testOpenApiDoc.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var1);
console.log("Values:", testOpenApiDoc.paths["/test"].get.responses["200"].content["application/json"].schema.example.data);

console.log("\n=== JSON.stringify ===");
const jsonString = JSON.stringify(testOpenApiDoc);
console.log("JSON String:", jsonString.substring(0, 200) + "...");

console.log("\n=== Parsing back ===");
const parsed = JSON.parse(jsonString);
console.log("Boolean types after parse:", typeof parsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var1);
console.log("Values after parse:", parsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data);

console.log("\n=== FormData behavior ===");
const fdata = new FormData();
fdata.append('apiDefinition', jsonString);

// Simulate what happens when FormData gets the value back
console.log("FormData appended the JSON string.");

// Let's see what gets stored in FormData buffer
const boundary = fdata.getBoundary();
console.log("FormData boundary:", boundary);

// Get the buffer to see what's actually sent
fdata.getBuffer((err, buffer) => {
  if (err) {
    console.error("Error getting buffer:", err);
    return;
  }
  
  const bufferString = buffer.toString();
  console.log("FormData buffer length:", buffer.length);
  console.log("Buffer preview (first 500 chars):");
  console.log(bufferString.substring(0, 500));
  
  // Extract just the JSON part from the form data
  const jsonStart = bufferString.indexOf('{"openapi"');
  const jsonEnd = bufferString.lastIndexOf('}') + 1;
  
  if (jsonStart !== -1 && jsonEnd !== -1) {
    const extractedJson = bufferString.substring(jsonStart, jsonEnd);
    console.log("\n=== Extracted JSON from FormData ===");
    console.log("Extracted JSON preview:", extractedJson.substring(0, 200) + "...");
    
    try {
      const reparsed = JSON.parse(extractedJson);
      console.log("Boolean types after FormData extraction:", typeof reparsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var1);
      console.log("Values after FormData extraction:", reparsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data);
    } catch (parseError) {
      console.error("Error parsing extracted JSON:", parseError);
    }
  }
});