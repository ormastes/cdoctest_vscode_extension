const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcon() {
    const svgPath = path.join(__dirname, 'icon.svg');
    const pngPath = path.join(__dirname, 'icon.png');
    
    try {
        await sharp(svgPath)
            .resize(256, 256)
            .png()
            .toFile(pngPath);
        console.log('Successfully created icon.png (256x256)');
        
        // Also create 128x128 version
        await sharp(svgPath)
            .resize(128, 128)
            .png()
            .toFile(path.join(__dirname, 'icon-128.png'));
        console.log('Successfully created icon-128.png (128x128)');
        
    } catch (error) {
        console.error('Error converting icon:', error);
        process.exit(1);
    }
}

convertIcon();