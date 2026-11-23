const fs = require('fs');

let wk = fs.readFileSync('components/landing/WilayahKontras.module.css', 'utf8');
wk = wk.replace('border-top: var(--tebal) solid var(--tinta);', 'border-top: 3px solid var(--pine-primary);');
fs.writeFileSync('components/landing/WilayahKontras.module.css', wk, 'utf8');

let ck = fs.readFileSync('components/landing/CaraKerja.module.css', 'utf8');
ck = ck.replace('border-top: var(--tebal) solid var(--tinta);', 'border-top: 2px solid var(--garis-halus);');
ck = ck.replace('border: var(--tebal) solid var(--biru-stempel);', 'border: 2px solid var(--pine-primary);');
ck = ck.replace('color: var(--biru-stempel);', 'color: var(--pine-primary);');
ck = ck.replace('border-left: 0.375rem solid var(--tinta);', 'border-left: 3px solid var(--leaf-green); border-radius: var(--radius);');
ck = ck.replace('background: var(--papan);', 'background: var(--mint);');
fs.writeFileSync('components/landing/CaraKerja.module.css', ck, 'utf8');

console.log('Patched landing components successfully.');
