/**
 * Index des tools write MCP
 * Ces tools nécessitent ENABLE_WRITE_TOOLS=true pour être activés
 */

export {
  attachDomainToolDef,
  attachDomainHandler,
  type AttachDomainInput,
  type AttachDomainOutput,
} from './attachDomain.js';

export {
  installSslToolDef,
  installSslHandler,
  type InstallSslInput,
  type InstallSslOutput,
} from './installSsl.js';

export {
  createDatabaseToolDef,
  createDatabaseHandler,
  type CreateDatabaseInput,
  type CreateDatabaseOutput,
} from './createDatabase.js';

export {
  createDatabaseDumpToolDef,
  createDatabaseDumpHandler,
  type CreateDatabaseDumpInput,
  type CreateDatabaseDumpOutput,
} from './createDatabaseDump.js';

export {
  restoreDatabaseDumpToolDef,
  restoreDatabaseDumpHandler,
  type RestoreDatabaseDumpInput,
  type RestoreDatabaseDumpOutput,
} from './restoreDatabaseDump.js';

export {
  installModuleToolDef,
  installModuleHandler,
  type InstallModuleInput,
  type InstallModuleOutput,
} from './installModule.js';

/**
 * Liste de toutes les définitions de tools write
 */
import { attachDomainToolDef } from './attachDomain.js';
import { installSslToolDef } from './installSsl.js';
import { createDatabaseToolDef } from './createDatabase.js';
import { createDatabaseDumpToolDef } from './createDatabaseDump.js';
import { restoreDatabaseDumpToolDef } from './restoreDatabaseDump.js';
import { installModuleToolDef } from './installModule.js';

export const writeToolDefs = [
  attachDomainToolDef,
  installSslToolDef,
  createDatabaseToolDef,
  createDatabaseDumpToolDef,
  restoreDatabaseDumpToolDef,
  installModuleToolDef,
];
