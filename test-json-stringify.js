// Test to verify JSON.stringify behavior with boolean values
const testOpenApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "Test API",
    version: "1.0.0"
  },
  paths: {
    "/test": {
      get: {
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        var1: { type: "boolean" },
                        var2: { type: "boolean" }
                      }
                    },
                    status: { type: "string" }
                  },
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

console.log("Original object:");
console.log(JSON.stringify(testOpenApiDoc, null, 2));
console.log("\nTypes in original:");
console.log("var1 type:", typeof testOpenApiDoc.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var1);
console.log("var2 type:", typeof testOpenApiDoc.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var2);

const stringified = JSON.stringify(testOpenApiDoc);
console.log("\nStringified:");
console.log(stringified);

const parsed = JSON.parse(stringified);
console.log("\nTypes after parse:");
console.log("var1 type:", typeof parsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var1);
console.log("var2 type:", typeof parsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var2);
console.log("var1 value:", parsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var1);
console.log("var2 value:", parsed.paths["/test"].get.responses["200"].content["application/json"].schema.example.data.var2);