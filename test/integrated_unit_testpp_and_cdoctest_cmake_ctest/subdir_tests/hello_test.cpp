#include <UnitTest++/UnitTest++.h>
#include <UnitTest++/XmlTestReporter.h>
#include <iostream>
#include <string>
#include <fstream>

SUITE(SubMathTests) {
    TEST(Addition) {
        printf("Running test: %s\n", UnitTest::CurrentTest::Details()->testName);
        CHECK_EQUAL(4, 2 + 2);
    }

    TEST(Subtraction) {
        CHECK_EQUAL(2, 4 - 2);
    }
    TEST(FAIL) {
        CHECK_EQUAL(2, 1);
    }
}

/**
>>> %<< add(5, 6);
11
*/
int add(int a, int b) {
    return a + b;
}

int _main(int argc, char** argv)
{
    if (argc > 1 && std::string(argv[1]) == "GetTcList:") {
        UnitTest::TestList const& list = UnitTest::Test::GetTestList();
        const UnitTest::Test* test = list.GetHead();
        while (test != nullptr) {
            std::string fullTestName = std::string(test->m_details.suiteName) + "::" + test->m_details.testName;
            std::cout << fullTestName << ',' << test->m_details.filename << ',' << test->m_details.lineNumber << std::endl;
            test = test->m_nextTest;
        }
        return 0;
    }

    std::ofstream ofs("output.vsc");
    UnitTest::XmlTestReporter reporter(ofs);
    UnitTest::TestRunner runner(reporter);
    int result = -1;
    
    if (argc > 1 && std::string(argv[1]).compare(0, 3, "TC/") == 0) {
        std::string test_case = std::string(argv[1]).substr(3);
        printf("Running test case: %s\n", test_case.c_str());
        // Define a lambda that returns true only for the selected test
        auto testSelector = [test_case](const UnitTest::Test* test) -> bool {
            std::string fullTestName = std::string(test->m_details.suiteName) + "::" + test->m_details.testName;
            printf("Checking test: %s\n", fullTestName.c_str());
            printf("Test case: %s\n", test_case.c_str());
            return (fullTestName == test_case);
        };
        result = runner.RunTestsIf(UnitTest::Test::GetTestList(), nullptr, testSelector, 0);
    } else {
        result = runner.RunTestsIf(UnitTest::Test::GetTestList(), nullptr, UnitTest::True(), 0);
    }
    
    ofs.close();
    return result;
}
