#include <catch2/catch_test_macros.hpp>
#include <string>

// Math Tests
TEST_CASE("MathTests.Addition", "[math]") {
    REQUIRE(2 + 2 == 4);
}

TEST_CASE("MathTests.Subtraction", "[math]") {
    REQUIRE(4 - 2 == 2);
}

TEST_CASE("MathTests.FAIL", "[math]") {
    REQUIRE(1 == 2);  // This will fail
}

// String Tests
TEST_CASE("StringTests.Concatenation", "[string]") {
    std::string result = "Hello" + std::string(" World");
    REQUIRE(result == "Hello World");
}

// Function to test
int add(int a, int b) {
    return a + b;
}

// Test for the add function
TEST_CASE("MathTests.AddFunction", "[math]") {
    REQUIRE(add(5, 6) == 11);
}

// Catch2 supports sections for more complex test organization
TEST_CASE("MathTests.Sections", "[math]") {
    SECTION("positive numbers") {
        REQUIRE(1 + 1 == 2);
        REQUIRE(2 + 3 == 5);
    }
    
    SECTION("negative numbers") {
        REQUIRE(-1 + -1 == -2);
        REQUIRE(-2 + -3 == -5);
    }
}