import { OpenAPIObject } from 'openapi3-ts/oas30';

import { Wso2ApiDefinition } from './types';
import { APIOperations } from './v1/types-swagger';

export const validateWso2ApiDefs = (apiDef: Wso2ApiDefinition): void => {
  if (apiDef.wso2Version !== 'v1') {
    throw new Error("wso2Version should always be 'v1' ('v2' not supported yet)");
  }
  if (!apiDef.context) {
    throw new Error('context is required (it is used in api url prefix)');
  }
  if (!apiDef.name) {
    throw new Error('name is required');
  }
  if (!apiDef.gatewayEnvironments || apiDef.gatewayEnvironments.length === 0) {
    throw new Error('gatewayEnvironments must have at least one element');
  }
  if (!apiDef.endpointConfig) {
    throw new Error('endpointConfig is required');
  }

  validateVisibility(apiDef);
};

const validateVisibility = (apiDef: Wso2ApiDefinition): void => {
  if (apiDef.visibility) {
    if (!['RESTRICTED', 'PRIVATE', 'PUBLIC'].includes(apiDef.visibility)) {
      throw new Error('visibility must be RESTRICTED, PRIVATE or PUBLIC');
    }
    if (apiDef.visibility === 'RESTRICTED') {
      if (!Array.isArray(apiDef.visibleRoles) || apiDef.visibleRoles.length === 0) {
        throw new Error('visibleRoles must be defined when visibility is RESTRICTED');
      }
    }
  }
  if (apiDef.accessControl) {
    if (!['RESTRICTED', 'PRIVATE'].includes(apiDef.accessControl)) {
      throw new Error('publisherVisibility must be RESTRICTED or PRIVATE');
    }
    if (apiDef.accessControl === 'RESTRICTED') {
      if (!Array.isArray(apiDef.accessControlRoles) || apiDef.accessControlRoles.length === 0) {
        throw new Error('accessControlRoles must be defined when accessControl is RESTRICTED');
      }
    }
  }
};

const defaultApiDef: Partial<Wso2ApiDefinition> = {
  securityScheme: ['oauth2'],
  lifeCycleStatus: 'CREATED',
  isDefaultVersion: true,
  enableStore: true,
  type: 'HTTP',
  transport: ['https'],
  policies: ['Unlimited'],
  apiThrottlingPolicy: 'Unlimited',
  maxTps: {
    production: 300,
    sandbox: 10,
  },
  endpointImplementationType: 'ENDPOINT',
  subscriptionAvailability: 'CURRENT_TENANT',
  subscriptionAvailableTenants: [],
};

export const applyDefaultsWso2ApiDefinition = (
  apiDef: Wso2ApiDefinition,
  openapiDocument: OpenAPIObject,
): Wso2ApiDefinition => {
  const apiDefr: Wso2ApiDefinition = {
    ...defaultApiDef,
    ...apiDef,
    tags: [...(apiDef.tags ?? []), 'cdk-practical-constructs'],
    businessInformation: apiDef.businessInformation ?? {
      businessOwnerEmail: openapiDocument.info.contact?.email,
      technicalOwnerEmail: openapiDocument.info.contact?.email,
      technicalOwner: openapiDocument.info.contact?.name,
      businessOwner: openapiDocument.info.contact?.name,
    },
    operations: wso2APIOperationsFromOpenapi(openapiDocument),
  };

  // If cors was defined only with "origins", use a default configuration for the rest of the definition
  // this is to make it easier to define an api with default cors configurations
  const corsConfig = apiDefr.corsConfiguration;
  if (corsConfig) {
    if (corsConfig.accessControlAllowOrigins) {
      corsConfig.accessControlAllowCredentials = corsConfig.accessControlAllowCredentials ?? false;
      // default WSO2 cors config
      corsConfig.accessControlAllowHeaders = corsConfig.accessControlAllowHeaders ?? [
        'Authorization',
        'Access-Control-Allow-Origin',
        'Content-Type',
        'SOAPAction',
      ];
      // default WSO2 cors config
      corsConfig.accessControlAllowMethods = corsConfig.accessControlAllowMethods ?? [
        'GET',
        'PUT',
        'POST',
        'DELETE',
        'PATCH',
        'OPTIONS',
      ];
      corsConfig.corsConfigurationEnabled =
        typeof corsConfig.corsConfigurationEnabled === 'boolean'
          ? corsConfig.corsConfigurationEnabled
          : true;
    }
  }
  apiDefr.corsConfiguration = corsConfig;

  return apiDefr;
};

const wso2APIOperationsFromOpenapi = (openapiDocument: OpenAPIObject): APIOperations[] => {
  const wso2Operations: APIOperations[] = [];

  // each path
  const pathNames = Object.keys(openapiDocument.paths);
  for (let i = 0; i < pathNames.length; i += 1) {
    const pathName = pathNames[i];
    const pathObj = openapiDocument.paths[pathName];
    // each verb
    const pathObjProps = Object.keys(pathObj);
    for (let j = 0; j < pathObjProps.length; j += 1) {
      const verbName = pathObjProps[j];
      if (
        ['get', 'put', 'post', 'options', 'head', 'delete', 'patch', 'trace'].includes(verbName)
      ) {
        const verbObj = pathObjProps[verbName as keyof typeof pathObjProps];
        const verbObjProps = Object.keys(verbObj);
        // look for x-auth-type attribute in verb props
        let authType = 'Any';
        let throttlingTier = 'Unlimited';
        for (let k = 0; k < verbObjProps.length; k += 1) {
          const verbPropName = verbObjProps[k];
          const verbPropValue = verbObj[verbPropName as keyof typeof verbObj] as string;
          if (verbPropName.toLowerCase() === 'x-auth-type') {
            authType = verbPropValue;
          }
          if (verbPropName.toLowerCase() === 'x-throttling-tier') {
            throttlingTier = verbPropValue;
          }
        }
        // eslint-disable-next-line fp/no-mutating-methods
        wso2Operations.push({
          target: pathName,
          verb: verbName,
          authType,
          throttlingPolicy: throttlingTier,
        });
      }
    }
  }

  return wso2Operations;
};
