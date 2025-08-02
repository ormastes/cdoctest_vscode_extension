#include <gtest/gtest.h>
#include <string>

// Math Tests
TEST(MathTests, Addition) {
    EXPECT_EQ(4, 2 + 2);
}

TEST(MathTests, Subtraction) {
    EXPECT_EQ(2, 4 - 2);
}

TEST(MathTests, FAIL) {
    EXPECT_EQ(2, 1);  // This will fail
}

// String Tests
TEST(StringTests, Concatenation) {
    std::string result = "Hello" + std::string(" World");
    EXPECT_EQ("Hello World", result);
}

// Doctest style function
int add(int a, int b) {
    return a + b;
}

// Test for the add function
TEST(MathTests, AddFunction) {
    EXPECT_EQ(11, add(5, 6));
}