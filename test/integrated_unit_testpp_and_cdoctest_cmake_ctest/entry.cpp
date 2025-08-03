extern __declspec(dllimport) int _main(int argc, char** argv);
int main(int argc, char** argv) {
    return _main(argc, argv);
}