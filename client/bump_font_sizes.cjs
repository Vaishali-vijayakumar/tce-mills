const fs = require('fs');
const path = require('path');

const dirs = [
    'c:\\Users\\vaish\\Downloads\\cotton mills\\tce-mills\\client\\src\\pages',
    'c:\\Users\\vaish\\Downloads\\cotton mills\\tce-mills\\client\\src\\components'
];

const sizeMap = {
    'text-xs': 'text-sm',
    'text-sm': 'text-base',
    'text-base': 'text-lg',
    'text-lg': 'text-xl',
    'text-xl': 'text-2xl',
    'text-2xl': 'text-3xl',
    'text-3xl': 'text-4xl'
};

function processFile(filePath) {
    if (!filePath.endsWith('.jsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Reverse sort keys to avoid partial matches (e.g. text-2xl vs text-xl)
    const keys = Object.keys(sizeMap).sort((a, b) => b.length - a.length);

    keys.forEach(key => {
        // Match only if it's a full class name (preceded by space/quote, followed by space/quote)
        const regex = new RegExp(`(?<=[\\s"'])${key}(?=[\\s"'])`, 'g');
        if (content.match(regex)) {
            content = content.replace(regex, sizeMap[key]);
            changed = true;
        }
    });

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated: ${filePath}`);
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
