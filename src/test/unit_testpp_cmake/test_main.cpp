#include <UnitTest++/UnitTest++.h>
#include <UnitTest++/XmlTestReporter.h>
#include <iostream>
#include <string>
#include <fstream>

SUITE(MathTests) {
    TEST(Addition) {
        CHECK_EQUAL(4, 2 + 2);
    }

    TEST(Subtraction) {
        CHECK_EQUAL(2, 4 - 2);
    }
    TEST(FAIL) {
        CHECK_EQUAL(2, 1);
    }
}

SUITE(StringTests) {
    TEST(Concatenation) {
        std::string result = "Hello" + std::string(" World");
        CHECK_EQUAL("Hello World", result);
    }
}

int main(int argc, char** argv)
{
    if (argc > 1 && std::string(argv[1]) == "--list-tests") {
        UnitTest::TestList const& list = UnitTest::Test::GetTestList();
        const UnitTest::Test* test = list.GetHead();
        while (test != nullptr) {
            std::string fullTestName = std::string(test->m_details.suiteName) + "::" + test->m_details.testName;
            std::cout << fullTestName << ',' << test->m_details.filename << ',' << test->m_details.lineNumber << std::endl;
            test = test->m_nextTest;
        }
        return 0;
    }

    std::ofstream ofs("test_results.txt");
    UnitTest::XmlTestReporter reporter(ofs);
    UnitTest::TestRunner runner(reporter);
    int result = -1;
    
    if (argc > 2 && std::string(argv[1]) == "--test") {
        std::string test_case = argv[2];
        // Define a lambda that returns true only for the selected test
        auto testSelector = [test_case](const UnitTest::Test* test) -> bool {
            std::string fullTestName = std::string(test->m_details.suiteName) + "::" + test->m_details.testName;
            return (fullTestName == test_case);
        };
        result = runner.RunTestsIf(UnitTest::Test::GetTestList(), nullptr, testSelector, 0);
    } else {
        result = runner.RunTestsIf(UnitTest::Test::GetTestList(), nullptr, UnitTest::True(), 0);
    }
    
    ofs.close();
    return result;
}
