// node --experimental-strip-types scripts/test-scope-clean.mjs
import assert from 'node:assert';
import { cleanScopeHtml } from '../apps/crm/services/scopeHtml.ts';

assert.equal(cleanScopeHtml('```html\n<p>Hi</p>\n```'), '<p>Hi</p>');
assert.equal(cleanScopeHtml('<p>a</p><script>alert(1)</script>'), '<p>a</p>');
assert.equal(cleanScopeHtml('<p onclick="evil()">a</p>'), '<p>a</p>');
assert.equal(cleanScopeHtml('<a href="javascript:evil()">x</a>'), '<a>x</a>');
assert.equal(cleanScopeHtml('<body><p>a</p></body>'), '<p>a</p>');
assert.equal(cleanScopeHtml(''), '');
assert.equal(cleanScopeHtml('<p style="font-weight:bold">2.1 Art / Mỹ thuật</p>'), '<p style="font-weight:bold">2.1 Art / Mỹ thuật</p>');

console.log('scope-clean OK');
