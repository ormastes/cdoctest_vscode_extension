@echo off
mkdir build
cd build
cmake ..
cmake --build .
echo.
echo Listing discovered tests:
ctest -N