/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosInstance } from 'axios';
import { oas30 } from 'openapi3-ts';

import { updateOpenapiInWso2AndCheck } from './wso2-v1';

// Mock FormData
const mockFormDataAppend = jest.fn();
const mockFormDataInstance = {
  append: mockFormDataAppend,
};

jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => mockFormDataInstance);
});

// Mock exponential-backoff
jest.mock('exponential-backoff', () => ({
  backOff: jest.fn((fn) => fn()),
}));

describe('WSO2 API Handler - Boolean Values Issue', () => {
  const mockAxios = {
    put: jest.fn(),
    get: jest.fn(),
  } as unknown as AxiosInstance;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAPI document serialization', () => {
    it('should preserve boolean types in JSON.stringify', () => {
      const openApiDoc: oas30.OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              var1: { type: 'boolean' },
                              var2: { type: 'boolean' },
                            },
                          },
                          status: { type: 'string' },
                        },
                        example: {
                          data: {
                            var1: true,
                            var2: false,
                          },
                          status: 'success',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Test original object types
      const exampleData = openApiDoc.paths['/test']?.get?.responses?.['200']?.content?.['application/json']?.schema?.example?.data;
      expect(typeof exampleData.var1).toBe('boolean');
      expect(typeof exampleData.var2).toBe('boolean');
      expect(exampleData.var1).toBe(true);
      expect(exampleData.var2).toBe(false);

      // Test JSON.stringify preserves types
      const jsonString = JSON.stringify(openApiDoc);
      expect(jsonString).toContain('"var1":true');
      expect(jsonString).toContain('"var2":false');
      expect(jsonString).not.toContain('"var1":"true"');
      expect(jsonString).not.toContain('"var2":"false"');

      // Test parsing back maintains types
      const parsed = JSON.parse(jsonString);
      const parsedExampleData = parsed.paths['/test']?.get?.responses?.['200']?.content?.['application/json']?.schema?.example?.data;
      expect(typeof parsedExampleData.var1).toBe('boolean');
      expect(typeof parsedExampleData.var2).toBe('boolean');
      expect(parsedExampleData.var1).toBe(true);
      expect(parsedExampleData.var2).toBe(false);
    });

    it('should preserve mixed types in OpenAPI examples', () => {
      const openApiDoc: oas30.OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      example: {
                        name: 'John Doe',
                        age: 30,
                        isActive: true,
                        isPremium: false,
                        score: 95.5,
                        tags: ['user', 'premium'],
                        metadata: {
                          verified: true,
                          lastLogin: null,
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const jsonString = JSON.stringify(openApiDoc);
      const parsed = JSON.parse(jsonString);
      const example = parsed.paths['/test']?.post?.requestBody?.content?.['application/json']?.schema?.example;

      // Verify all types are preserved
      expect(typeof example.name).toBe('string');
      expect(typeof example.age).toBe('number');
      expect(typeof example.isActive).toBe('boolean');
      expect(typeof example.isPremium).toBe('boolean');
      expect(typeof example.score).toBe('number');
      expect(Array.isArray(example.tags)).toBe(true);
      expect(typeof example.metadata.verified).toBe('boolean');
      expect(example.metadata.lastLogin).toBe(null);

      // Verify actual values
      expect(example.name).toBe('John Doe');
      expect(example.age).toBe(30);
      expect(example.isActive).toBe(true);
      expect(example.isPremium).toBe(false);
      expect(example.score).toBe(95.5);
      expect(example.metadata.verified).toBe(true);
    });
  });

  describe('updateOpenapiInWso2AndCheck function', () => {
    it('should try JSON upload first and fallback to FormData on failure', async () => {
      const testArgs = {
        openapiDocument: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/test': {
              get: {
                responses: {
                  '200': {
                    description: 'Success',
                    content: {
                      'application/json': {
                        schema: {
                          example: {
                            data: {
                              var1: true,
                              var2: false,
                            },
                            status: 'success',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        } as oas30.OpenAPIObject,
        apiDefinition: {
          name: 'test-api',
          version: '1.0.0',
          context: '/test',
        } as any,
        retryOptions: {
          checkRetries: { numOfAttempts: 3, delayFirstAttempt: false },
        },
        wso2Axios: mockAxios,
        wso2ApiId: 'test-api-id',
        wso2Tenant: 'test-tenant',
      };

      // Mock JSON upload to fail, then FormData to succeed
      mockAxios.put = jest.fn()
        .mockRejectedValueOnce(new Error('JSON upload failed'))
        .mockResolvedValueOnce({});
      mockAxios.get = jest.fn().mockResolvedValue({
        data: JSON.stringify(testArgs.openapiDocument),
      });

      await updateOpenapiInWso2AndCheck(testArgs);

      // Verify both PUT requests were made
      expect(mockAxios.put).toHaveBeenCalledTimes(2);
      
      // First call should be JSON
      expect(mockAxios.put).toHaveBeenNthCalledWith(1,
        '/api/am/publisher/v1/apis/test-api-id/swagger',
        testArgs.openapiDocument,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Second call should be FormData fallback
      expect(mockAxios.put).toHaveBeenNthCalledWith(2,
        '/api/am/publisher/v1/apis/test-api-id/swagger',
        mockFormDataInstance,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      // Verify FormData was used in fallback
      expect(mockFormDataAppend).toHaveBeenCalledWith(
        'apiDefinition',
        expect.stringContaining('"var1":true')
      );
    });

    it('should use JSON upload successfully when it works', async () => {
      const testArgs = {
        openapiDocument: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/test': {
              get: {
                responses: {
                  '200': {
                    description: 'Success',
                    content: {
                      'application/json': {
                        schema: {
                          example: {
                            data: {
                              var1: true,
                              var2: false,
                            },
                            status: 'success',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        } as oas30.OpenAPIObject,
        apiDefinition: {
          name: 'test-api',
          version: '1.0.0',
          context: '/test',
        } as any,
        retryOptions: {
          checkRetries: { numOfAttempts: 3, delayFirstAttempt: false },
        },
        wso2Axios: mockAxios,
        wso2ApiId: 'test-api-id',
        wso2Tenant: 'test-tenant',
      };

      // Mock successful JSON upload
      mockAxios.put = jest.fn().mockResolvedValue({});
      mockAxios.get = jest.fn().mockResolvedValue({
        data: JSON.stringify(testArgs.openapiDocument),
      });

      await updateOpenapiInWso2AndCheck(testArgs);

      // Verify only JSON PUT request was made
      expect(mockAxios.put).toHaveBeenCalledTimes(1);
      expect(mockAxios.put).toHaveBeenCalledWith(
        '/api/am/publisher/v1/apis/test-api-id/swagger',
        testArgs.openapiDocument,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Verify FormData was NOT used
      expect(mockFormDataAppend).not.toHaveBeenCalled();
    });

    it('should call FormData.append with stringified OpenAPI document', async () => {
      const testArgs = {
        openapiDocument: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/test': {
              get: {
                responses: {
                  '200': {
                    description: 'Success',
                    content: {
                      'application/json': {
                        schema: {
                          example: {
                            data: {
                              var1: true,
                              var2: false,
                            },
                            status: 'success',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        } as oas30.OpenAPIObject,
        apiDefinition: {
          name: 'test-api',
          version: '1.0.0',
          context: '/test',
        } as any,
        retryOptions: {
          checkRetries: { numOfAttempts: 3, delayFirstAttempt: false },
        },
        wso2Axios: mockAxios,
        wso2ApiId: 'test-api-id',
        wso2Tenant: 'test-tenant',
      };

      // Mock JSON upload to fail, FormData to succeed
      mockAxios.put = jest.fn()
        .mockRejectedValueOnce(new Error('JSON not supported'))
        .mockResolvedValueOnce({});
      mockAxios.get = jest.fn().mockResolvedValue({
        data: JSON.stringify(testArgs.openapiDocument),
      });

      await updateOpenapiInWso2AndCheck(testArgs);

      // Verify FormData.append was called with the correct JSON string
      expect(mockFormDataAppend).toHaveBeenCalledWith(
        'apiDefinition',
        expect.stringContaining('"var1":true')
      );
      expect(mockFormDataAppend).toHaveBeenCalledWith(
        'apiDefinition',
        expect.stringContaining('"var2":false')
      );

      // Verify the JSON string doesn't have stringified booleans
      const appendCall = mockFormDataAppend.mock.calls[0];
      const jsonStringPassedToFormData = appendCall[1];
      expect(jsonStringPassedToFormData).not.toContain('"var1":"true"');
      expect(jsonStringPassedToFormData).not.toContain('"var2":"false"');

      // Verify it's valid JSON with proper types
      const parsedFromFormData = JSON.parse(jsonStringPassedToFormData);
      const exampleData = parsedFromFormData.paths['/test']?.get?.responses?.['200']?.content?.['application/json']?.schema?.example?.data;
      expect(typeof exampleData.var1).toBe('boolean');
      expect(typeof exampleData.var2).toBe('boolean');
      expect(exampleData.var1).toBe(true);
      expect(exampleData.var2).toBe(false);
    });

    it('should handle complex OpenAPI document with nested boolean examples', async () => {
      const complexOpenApiDoc: oas30.OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Complex API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Users list',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                            isActive: { type: 'boolean' },
                            permissions: {
                              type: 'object',
                              properties: {
                                canRead: { type: 'boolean' },
                                canWrite: { type: 'boolean' },
                                canDelete: { type: 'boolean' },
                              },
                            },
                          },
                        },
                        example: [
                          {
                            id: 1,
                            name: 'User 1',
                            isActive: true,
                            permissions: {
                              canRead: true,
                              canWrite: false,
                              canDelete: false,
                            },
                          },
                          {
                            id: 2,
                            name: 'User 2',
                            isActive: false,
                            permissions: {
                              canRead: true,
                              canWrite: true,
                              canDelete: true,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          '/settings': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      example: {
                        notifications: {
                          email: true,
                          sms: false,
                          push: true,
                        },
                        privacy: {
                          profilePublic: false,
                          showEmail: false,
                          allowMessages: true,
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const testArgs = {
        openapiDocument: complexOpenApiDoc,
        apiDefinition: { name: 'complex-api', version: '1.0.0', context: '/complex' } as any,
        retryOptions: { checkRetries: { numOfAttempts: 3, delayFirstAttempt: false } },
        wso2Axios: mockAxios,
        wso2ApiId: 'complex-api-id',
        wso2Tenant: 'test-tenant',
      };

      // Mock successful JSON upload
      mockAxios.put = jest.fn().mockResolvedValue({});
      mockAxios.get = jest.fn().mockResolvedValue({
        data: JSON.stringify(complexOpenApiDoc),
      });

      await updateOpenapiInWso2AndCheck(testArgs);

      // Verify JSON upload was used (no FormData)
      expect(mockAxios.put).toHaveBeenCalledTimes(1);
      expect(mockAxios.put).toHaveBeenCalledWith(
        '/api/am/publisher/v1/apis/complex-api-id/swagger',
        complexOpenApiDoc,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect(mockFormDataAppend).not.toHaveBeenCalled();
    });

    it('should make correct axios calls for WSO2 API update', async () => {
      const testArgs = {
        openapiDocument: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        } as oas30.OpenAPIObject,
        apiDefinition: { name: 'test-api', version: '1.0.0', context: '/test' } as any,
        retryOptions: { checkRetries: { numOfAttempts: 3, delayFirstAttempt: false } },
        wso2Axios: mockAxios,
        wso2ApiId: 'test-api-id',
        wso2Tenant: 'test-tenant',
      };

      mockAxios.put = jest.fn().mockResolvedValue({});
      mockAxios.get = jest.fn().mockResolvedValue({
        data: JSON.stringify(testArgs.openapiDocument),
      });

      await updateOpenapiInWso2AndCheck(testArgs);

      // Verify PUT request was made with JSON first
      expect(mockAxios.put).toHaveBeenCalledWith(
        '/api/am/publisher/v1/apis/test-api-id/swagger',
        testArgs.openapiDocument,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Verify GET request was made to check the update
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/api/am/publisher/v1/apis/test-api-id/swagger',
        {
          responseType: 'text',
          transformResponse: [expect.any(Function)],
        }
      );
    });
  });

  describe('Regression tests for issue #73', () => {
    it('should reproduce the exact schema from issue #73', async () => {
      // This is the exact schema structure reported in the issue
      const responseBodySchema = {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              var1: {
                type: 'boolean',
                optional: true,
              },
              var2: {
                type: 'boolean',
                optional: true,
              },
            },
          },
          status: {
            type: 'string',
            enum: ['success'],
          },
        },
        example: {
          data: {
            var1: true,
            var2: false,
          },
          status: 'success',
        },
      };

      const openApiDoc: oas30.OpenAPIObject = {
        openapi: '3.0.0',
        info: { title: 'Issue 73 API', version: '1.0.0' },
        paths: {
          '/endpoint': {
            get: {
              responses: {
                '200': {
                  description: 'Success response',
                  content: {
                    'application/json': {
                      schema: responseBodySchema,
                    },
                  },
                },
              },
            },
          },
        },
      };

      const testArgs = {
        openapiDocument: openApiDoc,
        apiDefinition: { name: 'issue-73-api', version: '1.0.0', context: '/issue73' } as any,
        retryOptions: { checkRetries: { numOfAttempts: 3, delayFirstAttempt: false } },
        wso2Axios: mockAxios,
        wso2ApiId: 'issue-73-api-id',
        wso2Tenant: 'test-tenant',
      };

      // Test with successful JSON upload
      mockAxios.put = jest.fn().mockResolvedValue({});
      mockAxios.get = jest.fn().mockResolvedValue({
        data: JSON.stringify(openApiDoc),
      });

      await updateOpenapiInWso2AndCheck(testArgs);

      // Verify JSON upload was used with the OpenAPI object directly
      expect(mockAxios.put).toHaveBeenCalledWith(
        '/api/am/publisher/v1/apis/issue-73-api-id/swagger',
        openApiDoc,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Verify the original object has proper boolean values
      const exampleData = openApiDoc.paths['/endpoint']?.get?.responses?.['200']?.content?.['application/json']?.schema?.example;
      
      expect(exampleData.data.var1).toBe(true);
      expect(exampleData.data.var2).toBe(false);
      expect(exampleData.status).toBe('success');
      expect(typeof exampleData.data.var1).toBe('boolean');
      expect(typeof exampleData.data.var2).toBe('boolean');
    });
  });
});
