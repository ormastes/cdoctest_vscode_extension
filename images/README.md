# Extension Images

This directory contains the visual assets for the cdoctest VS Code extension.

## Required Images

### 1. Extension Icon (`icon.png`)
- **Size**: 128x128 pixels (minimum), 256x256 pixels (recommended)
- **Format**: PNG with transparent background
- **Usage**: Displayed in the VS Code marketplace and extension sidebar
- **Design suggestions**: 
  - Should represent C++ testing
  - Consider including test tube, checkmark, or C++ logo elements
  - Use colors that stand out in both light and dark themes

### 2. Activity Bar Icon (`activity-icon.svg` or `activity-icon.png`)
- **Size**: 24x24 pixels (will be scaled)
- **Format**: SVG (preferred) or PNG with transparent background
- **Usage**: If you add a custom view to the activity bar
- **Design**: Simple, monochrome design that works in both themes

### 3. Test Explorer Icons (optional)
You can customize test explorer icons by adding:
- `test-pass.svg` - Icon for passed tests
- `test-fail.svg` - Icon for failed tests
- `test-skip.svg` - Icon for skipped tests
- `test-run.svg` - Icon for running tests

## Current Files
- `icon.svg` - Placeholder SVG icon (convert to PNG for production use)

## How to Update Icons

1. Replace the placeholder files with your actual designs
2. For the main icon, convert SVG to PNG:
   ```bash
   # Using ImageMagick
   convert -background none -size 256x256 icon.svg icon.png
   ```
3. Update package.json if you change file names or add new icons

## Icon Guidelines
- Use high contrast for visibility
- Ensure icons look good at small sizes
- Test in both light and dark VS Code themes
- Follow VS Code's design language