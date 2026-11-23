## Eval 2026-11-23 · claude-sonnet-5-5 · effort high · prompt 2026-11-23.2

100 dishes (seed 1), 2 samples each. "fits" = free with confidence ≥ 0.8. New API spend this run: $1.67 (200 calls).

#### single run (claude-sonnet-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 87.9% | 19.0% | 9.5% | 71.4% |
| egg | 51 | 0 (0.0%) | 86.3% | 49.0% | 4.1% | 46.9% |
| fish | 6 | 0 (0.0%) | 66.7% | 89.4% | 0.0% | 10.6% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 95.9% | 0.0% | 4.1% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 69.5% | 0.0% | 30.5% |
| tree_nuts | 8 | 0 (0.0%) | 50.0% | 68.5% | 0.0% | 31.5% |
| soy | 65 | 0 (0.0%) | 80.0% | 17.1% | 5.7% | 77.1% |
| sesame | 22 | 0 (0.0%) | 54.5% | 51.3% | 0.0% | 48.7% |
| wheat | 59 | 0 (0.0%) | 94.9% | 31.7% | 4.9% | 61.0% |
| gluten | 59 | 0 (0.0%) | 94.9% | 24.4% | 4.9% | 65.9% |
| coconut | 8 | 1 (12.5%) | 25.0% | 83.7% | 0.0% | 16.3% |
| pork | 16 | 0 (0.0%) | 100.0% | 73.8% | 0.0% | 26.2% |
| alcohol | 20 | 0 (0.0%) | 40.0% | 27.5% | 2.5% | 62.5% |
| **all** | 380 | 1 (0.3%) | 82.4% | 61.7% | 1.5% | 35.8% |

#### 2 runs merged (claude-sonnet-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 87.9% | 19.0% | 9.5% | 71.4% |
| egg | 51 | 0 (0.0%) | 88.2% | 49.0% | 4.1% | 46.9% |
| fish | 6 | 0 (0.0%) | 83.3% | 88.3% | 0.0% | 11.7% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 95.9% | 0.0% | 4.1% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 67.4% | 0.0% | 32.6% |
| tree_nuts | 8 | 0 (0.0%) | 50.0% | 64.1% | 0.0% | 35.9% |
| soy | 65 | 0 (0.0%) | 80.0% | 17.1% | 11.4% | 71.4% |
| sesame | 22 | 0 (0.0%) | 59.1% | 47.4% | 0.0% | 52.6% |
| wheat | 59 | 0 (0.0%) | 94.9% | 26.8% | 7.3% | 63.4% |
| gluten | 59 | 0 (0.0%) | 94.9% | 22.0% | 7.3% | 68.3% |
| coconut | 8 | 1 (12.5%) | 25.0% | 80.4% | 0.0% | 19.6% |
| pork | 16 | 0 (0.0%) | 100.0% | 70.2% | 1.2% | 28.6% |
| alcohol | 20 | 0 (0.0%) | 40.0% | 23.8% | 2.5% | 68.8% |
| **all** | 380 | 1 (0.3%) | 83.2% | 59.3% | 2.1% | 37.9% |

#### 2 runs merged + keyword floor + consistency (shipped pipeline)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 87.9% | 19.0% | 9.5% | 71.4% |
| egg | 51 | 0 (0.0%) | 88.2% | 49.0% | 4.1% | 46.9% |
| fish | 6 | 0 (0.0%) | 83.3% | 88.3% | 0.0% | 11.7% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 95.9% | 0.0% | 4.1% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 67.4% | 0.0% | 32.6% |
| tree_nuts | 8 | 0 (0.0%) | 87.5% | 64.1% | 9.8% | 26.1% |
| soy | 65 | 0 (0.0%) | 80.0% | 17.1% | 11.4% | 71.4% |
| sesame | 22 | 0 (0.0%) | 59.1% | 47.4% | 0.0% | 52.6% |
| wheat | 59 | 0 (0.0%) | 94.9% | 26.8% | 12.2% | 58.5% |
| gluten | 59 | 0 (0.0%) | 94.9% | 22.0% | 12.2% | 63.4% |
| coconut | 8 | 1 (12.5%) | 25.0% | 80.4% | 0.0% | 19.6% |
| pork | 16 | 0 (0.0%) | 100.0% | 69.0% | 1.2% | 29.8% |
| alcohol | 20 | 0 (0.0%) | 40.0% | 23.8% | 2.5% | 68.8% |
| **all** | 380 | 1 (0.3%) | 83.9% | 59.2% | 3.5% | 36.6% |

#### False-safe cases in the shipped pipeline (1)
- Flourless Chocolate Torte — coconut (model: free @0.80)
