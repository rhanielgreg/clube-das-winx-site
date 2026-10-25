import { checkDatabaseReadiness } from '../lib/release-readiness.js';
const result=await checkDatabaseReadiness();
console.log(JSON.stringify(result,null,2));
process.exitCode=result.ready?0:1;
