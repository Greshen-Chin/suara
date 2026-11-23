const fs = require('fs');

let css = fs.readFileSync('components/admin/Admin.module.css', 'utf8');

// Header pita
css = css.replace('.pita {\n  background: var(--tinta);', '.pita {\n  background: var(--pine-primary);');
css = css.replace('.pitaKerangka {\n  height: 2.0625rem;\n  background: var(--tinta);', '.pitaKerangka {\n  height: 2.0625rem;\n  background: var(--pine-primary);');

// Page dividers
css = css.replace('border-bottom: 6px solid var(--tinta);', 'border-bottom: 2px solid var(--pine-primary);');
css = css.replace('border-top: 3px solid var(--tinta);', 'border-top: 1px solid var(--garis-halus);');

// Filters & forms
css = css.replace(/border: var\(--tebal\) solid var\(--tinta\);/g, 'border: 1px solid var(--garis-halus); box-shadow: var(--bayangan-halus);');
css = css.replace(/border: 2px solid var\(--tinta\);/g, 'border: 1px solid #cbd5e1;');

// Table headers & rows
css = css.replace('border-bottom: 2px solid var(--tinta);', 'border-bottom: 2px solid var(--garis-halus);');
css = css.replace('border-top: 2px solid var(--tinta);', 'border-top: 1px solid var(--garis-halus);');

fs.writeFileSync('components/admin/Admin.module.css', css, 'utf8');
console.log('Patched Admin.module.css successfully.');
