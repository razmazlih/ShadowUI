import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAuthReturnTo,rememberAuthReturn,readAuthReturn} from '../lib/auth-return';
test('authentication returns only to local conversation routes',()=>{
 assert.equal(safeAuthReturnTo('/?conversation=abc-123&share=1'),'/?conversation=abc-123&share=1');
 assert.equal(safeAuthReturnTo('/conversations/abc-123?share=1'),'/conversations/abc-123?share=1');
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/auth','/?conversation=abc&share=1&redirect=https://evil.example','/?conversation=abc&share=1&share=1','/conversations/../auth','/conversations/%2e%2e','/?conversation=__proto__&share=1','/?conversation=abc&share=0'])assert.equal(safeAuthReturnTo(value),'/',value);
});
test('verification retains a validated conversation return in this session for one hour',()=>{
 const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 rememberAuthReturn(storage,'/?conversation=abc&share=1',100);
 assert.equal(readAuthReturn(storage,101),'/?conversation=abc&share=1');
 assert.equal(readAuthReturn(storage,3600100),'/');
 rememberAuthReturn(storage,'https://evil.example',200);
 assert.equal(readAuthReturn(storage,201),'/?conversation=abc&share=1');
});
