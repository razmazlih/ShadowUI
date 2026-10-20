import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';

/** Isolated legacy-provider regression harness. Never changes the real policy module.
 * Callers must replace global fetch before invoking the returned provider functions.
 * The temporary module has no network transport until a test explicitly supplies one.
 */
export function mockedPaidModule<T>(filename:string):T{
 const source=readFileSync(filename,'utf8');
 const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const localRequire=createRequire(filename),module={exports:{}},realFetch=globalThis.fetch;
 const mockedFetch:typeof fetch=(...args)=>{if(globalThis.fetch===realFetch)throw new Error('A mocked provider transport is required');return globalThis.fetch(...args);};
 const requireMock=(id:string)=>id==='./ai-policy'?{assertPaidAIAllowed(){}}:localRequire(id);
 new Function('require','module','exports','__filename','__dirname','fetch',javascript)(requireMock,module,module.exports,filename,path.dirname(filename),mockedFetch);
 return module.exports as T;
}
