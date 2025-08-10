#include <gtest/gtest.h>
#include "../include/calculator.h"

class CalculatorTest : public ::testing::Test {
protected:
    Calculator calc;
};

TEST_F(CalculatorTest, AddPositiveNumbers) {
    EXPECT_EQ(calc.add(2, 3), 5);
    EXPECT_EQ(calc.add(10, 20), 30);
}

TEST_F(CalculatorTest, AddNegativeNumbers) {
    EXPECT_EQ(calc.add(-5, -3), -8);
    EXPECT_EQ(calc.add(-10, 5), -5);
}

TEST_F(CalculatorTest, SubtractNumbers) {
    EXPECT_EQ(calc.subtract(10, 5), 5);
    EXPECT_EQ(calc.subtract(3, 7), -4);
}

TEST_F(CalculatorTest, MultiplyNumbers) {
    EXPECT_EQ(calc.multiply(3, 4), 12);
    EXPECT_EQ(calc.multiply(-2, 5), -10);
    EXPECT_EQ(calc.multiply(0, 100), 0);
}

TEST_F(CalculatorTest, DivideNumbers) {
    EXPECT_DOUBLE_EQ(calc.divide(10, 2), 5.0);
    EXPECT_DOUBLE_EQ(calc.divide(7, 2), 3.5);
}

TEST_F(CalculatorTest, DivideByZeroThrows) {
    EXPECT_THROW(calc.divide(10, 0), std::invalid_argument);
}