const fs = require('fs');
const path = require('path');

const dirs = [
    'c:\\Users\\vaish\\Downloads\\cotton mills\\tce-mills\\client\\src\\pages',
    'c:\\Users\\vaish\\Downloads\\cotton mills\\tce-mills\\client\\src\\components'
];

function processFile(filePath) {
    if (!filePath.endsWith('.jsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Bump Lucide icon sizes
    // Match size={14}, size={16}, size={18}, size={20}
    const iconRegex = /size={(\d+)}/g;
    content = content.replace(iconRegex, (match, size) => {
        const s = parseInt(size);
        if (s <= 20) {
            changed = true;
            return `size={${s + 6}}`; // Bump small icons by 6px
        }
        if (s <= 24) {
            changed = true;
            return `size={32}`; // Bump 24 to 32
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated Icons: ${filePath}`);
    }
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else {
            processFile(fullPath);
        }
    });
}

dirs.forEach(walkDir);
