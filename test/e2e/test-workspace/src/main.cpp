#include <iostream>
#include "../include/calculator.h"

int main() {
    Calculator calc;
    
    std::cout << "Calculator Demo" << std::endl;
    std::cout << "===============" << std::endl;
    std::cout << "5 + 3 = " << calc.add(5, 3) << std::endl;
    std::cout << "10 - 4 = " << calc.subtract(10, 4) << std::endl;
    std::cout << "6 * 7 = " << calc.multiply(6, 7) << std::endl;
    std::cout << "15 / 3 = " << calc.divide(15, 3) << std::endl;
    
    return 0;
}