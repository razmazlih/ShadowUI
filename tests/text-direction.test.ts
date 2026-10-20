import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textDirection} from '../lib/text-direction';
test('direction follows first strong letter across languages and neutral prefixes',()=>{
 assert.equal(textDirection('2026 — תכנון שבועי'),'rtl');
 assert.equal(textDirection('2026 — Weekly plan'),'ltr');
 assert.equal(textDirection('תכנון React'),'rtl');
 assert.equal(textDirection('React בעברית'),'ltr');
 assert.equal(textDirection('مرحبا'),'rtl');
 assert.equal(textDirection('123','rtl'),'rtl');
 assert.equal(textDirection(''),'ltr');
});
