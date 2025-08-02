/**
 * Convert SVG to PNG using sharp
 * Run: npm install sharp
 * Then: node convert-icon.js
 */

const fs = require('fs');
const path = require('path');

console.log('To convert the SVG icon to PNG, please run:');
console.log('');
console.log('1. Install sharp (if not already installed):');
console.log('   npm install --save-dev sharp');
console.log('');
console.log('2. Create convert script in a new file (convert-icon-sharp.js):');
console.log('');

const convertScript = `
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcon() {
    const svgPath = path.join(__dirname, 'icon.svg');
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Convert to different sizes
    const sizes = [
        { size: 256, name: 'icon.png' },
        { size: 128, name: 'icon-128.png' },
        { size: 64, name: 'icon-64.png' },
        { size: 32, name: 'icon-32.png' }
    ];
    
    for (const { size, name } of sizes) {
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(__dirname, name));
        console.log(\`Created \${name} (\${size}x\${size})\`);
    }
    
    console.log('Icon conversion complete!');
}

convertIcon().catch(console.error);
`;

console.log(convertScript);
console.log('');
console.log('3. Run the conversion:');
console.log('   node images/convert-icon-sharp.js');
console.log('');
console.log('Alternative: Use an online converter like:');
console.log('- https://cloudconvert.com/svg-to-png');
console.log('- https://convertio.co/svg-png/');
console.log('- https://svgtopng.com/');