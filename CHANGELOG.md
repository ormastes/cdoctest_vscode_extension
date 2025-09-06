# Change Log

All notable changes to the "cdoc-test" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.6.3] - 2024-12-06

### Added
- Support for recursive CTest file includes through `include()`, `subdirs()`, and `add_subdirectory()` commands
- `recursiveIncludeCTestFile()` function to handle nested CTestTestfile.cmake files without duplicates

### Fixed
- Test running spinner now stops properly when tests complete

## [Unreleased]

- Initial release