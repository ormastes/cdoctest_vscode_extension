#!/bin/bash

# Convert SVG icon to PNG format for VS Code extension

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is not installed. Please install it first:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Convert icon.svg to icon.png at different sizes
echo "Converting icon.svg to PNG format..."

# Main extension icon (256x256)
convert -background none -density 300 -resize 256x256 icon.svg icon.png
echo "Created icon.png (256x256)"

# Create smaller versions if needed
convert -background none -density 300 -resize 128x128 icon.svg icon-128.png
echo "Created icon-128.png (128x128)"

convert -background none -density 300 -resize 64x64 icon.svg icon-64.png
echo "Created icon-64.png (64x64)"

convert -background none -density 300 -resize 32x32 icon.svg icon-32.png
echo "Created icon-32.png (32x32)"

echo "Icon conversion complete!"