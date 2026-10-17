const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('the home search field is the first home content and is wired to local results', () => {
  const home = app.slice(app.indexOf('function renderHome'), app.indexOf('function recentItems'));
  assert.match(home, /^\s*function renderHome\(\)\{[\s\S]*?return `\$\{homeSearch\(\)\}/);
  assert.match(app, /function homeSearch\(\)[\s\S]*?Domain\.searchLibrary\(data,query\)/);
  assert.match(app, /id="home-library-search"/);
  assert.match(app, /id="home-search-results" role="listbox"/);
  assert.match(app, /e\.target\.id==='home-library-search'\)\{homeSearchTerm=e\.target\.value;updateHomeSearchResults\(\);return\}/);
  assert.match(app, /homeSearchTerm&&\(e\.target\.id==='home-library-search'\|\|e\.target\.closest\?\.\('#home-search-results'\)\)/);
});

test('home search results open the matching game or record type', () => {
  assert.match(app, /data-action="open-library-search-result" data-type="\$\{esc\(item\.type\)\}" data-id="\$\{esc\(item\.id\)\}"/);
  assert.match(app, /function openLibrarySearchResult\(type,id\)/);
  for (const type of ['games', 'videos', 'articles', 'resources', 'versions']) {
    assert.ok(app.includes(`type==='${type}'`), `missing open action for ${type}`);
  }
});
