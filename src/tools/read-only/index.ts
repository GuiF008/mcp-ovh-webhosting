/**
 * Index des tools read-only MCP
 */

export {
  listServicesToolDef,
  listServicesHandler,
  type ListServicesInput,
  type ListServicesOutput,
} from './listServices.js';

export {
  getServiceToolDef,
  getServiceHandler,
  type GetServiceInput,
  type GetServiceOutput,
  type WebHostingService,
} from './getService.js';

export {
  getActiveConfigurationToolDef,
  getActiveConfigurationHandler,
  type GetActiveConfigurationInput,
  type GetActiveConfigurationOutput,
  type WebHostingConfiguration,
} from './getActiveConfiguration.js';

export {
  listDatabasesToolDef,
  listDatabasesHandler,
  type ListDatabasesInput,
  type ListDatabasesOutput,
} from './listDatabases.js';

export {
  listFtpUsersToolDef,
  listFtpUsersHandler,
  type ListFtpUsersInput,
  type ListFtpUsersOutput,
} from './listFtpUsers.js';

export {
  listModuleCatalogToolDef,
  listModuleCatalogHandler,
  type ListModuleCatalogInput,
  type ListModuleCatalogOutput,
} from './listModuleCatalog.js';

export {
  getModuleCatalogItemToolDef,
  getModuleCatalogItemHandler,
  type GetModuleCatalogItemInput,
  type GetModuleCatalogItemOutput,
  type ModuleCatalogItem,
} from './getModuleCatalogItem.js';

export {
  listDatabaseDumpsToolDef,
  listDatabaseDumpsHandler,
  type ListDatabaseDumpsInput,
  type ListDatabaseDumpsOutput,
} from './listDatabaseDumps.js';

/**
 * Liste de toutes les définitions de tools read-only
 */
import { listServicesToolDef } from './listServices.js';
import { getServiceToolDef } from './getService.js';
import { getActiveConfigurationToolDef } from './getActiveConfiguration.js';
import { listDatabasesToolDef } from './listDatabases.js';
import { listFtpUsersToolDef } from './listFtpUsers.js';
import { listModuleCatalogToolDef } from './listModuleCatalog.js';
import { getModuleCatalogItemToolDef } from './getModuleCatalogItem.js';
import { listDatabaseDumpsToolDef } from './listDatabaseDumps.js';

export const readOnlyToolDefs = [
  listServicesToolDef,
  getServiceToolDef,
  getActiveConfigurationToolDef,
  listDatabasesToolDef,
  listFtpUsersToolDef,
  listModuleCatalogToolDef,
  getModuleCatalogItemToolDef,
  listDatabaseDumpsToolDef,
];
