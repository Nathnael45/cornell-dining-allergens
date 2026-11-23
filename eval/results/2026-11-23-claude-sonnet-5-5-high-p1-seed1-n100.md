## Eval 2026-11-23 · claude-sonnet-5-5 · effort high · prompt 2026-11-23.1

100 dishes (seed 1), 2 samples each. "fits" = free with confidence ≥ 0.8. New API spend this run: $1.56 (197 calls).

#### single run (claude-sonnet-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 87.9% | 19.0% | 9.5% | 71.4% |
| egg | 51 | 0 (0.0%) | 88.2% | 49.0% | 2.0% | 46.9% |
| fish | 6 | 0 (0.0%) | 66.7% | 87.2% | 0.0% | 12.8% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 95.9% | 0.0% | 4.1% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 65.3% | 0.0% | 34.7% |
| tree_nuts | 8 | 0 (0.0%) | 50.0% | 66.3% | 0.0% | 32.6% |
| soy | 65 | 0 (0.0%) | 75.4% | 20.0% | 5.7% | 74.3% |
| sesame | 22 | 0 (0.0%) | 54.5% | 48.7% | 0.0% | 51.3% |
| wheat | 59 | 0 (0.0%) | 94.9% | 31.7% | 7.3% | 61.0% |
| gluten | 59 | 0 (0.0%) | 94.9% | 29.3% | 7.3% | 63.4% |
| coconut | 8 | 3 (37.5%) | 12.5% | 94.6% | 0.0% | 4.3% |
| pork | 16 | 0 (0.0%) | 100.0% | 79.8% | 0.0% | 20.2% |
| alcohol | 20 | 5 (25.0%) | 5.0% | 73.8% | 0.0% | 26.3% |
| **all** | 380 | 8 (2.1%) | 79.7% | 66.6% | 1.4% | 31.6% |

#### 2 runs merged (claude-sonnet-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 87.9% | 16.7% | 9.5% | 73.8% |
| egg | 51 | 0 (0.0%) | 88.2% | 46.9% | 4.1% | 49.0% |
| fish | 6 | 0 (0.0%) | 66.7% | 87.2% | 0.0% | 12.8% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 94.8% | 0.0% | 5.2% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 65.3% | 0.0% | 34.7% |
| tree_nuts | 8 | 0 (0.0%) | 50.0% | 62.0% | 0.0% | 37.0% |
| soy | 65 | 0 (0.0%) | 81.5% | 20.0% | 5.7% | 74.3% |
| sesame | 22 | 0 (0.0%) | 63.6% | 47.4% | 0.0% | 52.6% |
| wheat | 59 | 0 (0.0%) | 94.9% | 26.8% | 7.3% | 65.9% |
| gluten | 59 | 0 (0.0%) | 94.9% | 24.4% | 7.3% | 68.3% |
| coconut | 8 | 3 (37.5%) | 12.5% | 92.4% | 0.0% | 7.6% |
| pork | 16 | 0 (0.0%) | 100.0% | 70.2% | 0.0% | 28.6% |
| alcohol | 20 | 4 (20.0%) | 5.0% | 72.5% | 0.0% | 27.5% |
| **all** | 380 | 7 (1.8%) | 81.3% | 64.1% | 1.5% | 34.1% |

#### 2 runs merged + keyword floor + consistency (shipped pipeline)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 87.9% | 16.7% | 9.5% | 73.8% |
| egg | 51 | 0 (0.0%) | 88.2% | 46.9% | 4.1% | 49.0% |
| fish | 6 | 0 (0.0%) | 66.7% | 87.2% | 0.0% | 12.8% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 94.8% | 0.0% | 5.2% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 65.3% | 0.0% | 34.7% |
| tree_nuts | 8 | 0 (0.0%) | 87.5% | 62.0% | 7.6% | 29.3% |
| soy | 65 | 0 (0.0%) | 81.5% | 20.0% | 5.7% | 74.3% |
| sesame | 22 | 0 (0.0%) | 63.6% | 47.4% | 0.0% | 52.6% |
| wheat | 59 | 0 (0.0%) | 94.9% | 26.8% | 12.2% | 61.0% |
| gluten | 59 | 0 (0.0%) | 94.9% | 24.4% | 12.2% | 63.4% |
| coconut | 8 | 3 (37.5%) | 12.5% | 92.4% | 0.0% | 7.6% |
| pork | 16 | 0 (0.0%) | 100.0% | 70.2% | 0.0% | 28.6% |
| alcohol | 20 | 4 (20.0%) | 5.0% | 72.5% | 0.0% | 27.5% |
| **all** | 380 | 7 (1.8%) | 82.1% | 64.1% | 2.7% | 32.9% |

#### False-safe cases in the shipped pipeline (7)
- Flourless Chocolate Torte — coconut (model: free @0.85)
- Breakfast Protein Power Pack — alcohol (model: free @0.85)
- Tofu Breakfast Burrito — coconut (model: free @0.90)
- Route 20 Veggie Bagel Sandwich — coconut (model: free @0.80)
- Moroccan Lentil Soup — alcohol (model: free @0.88)
- Chicken Harissa Toastie — alcohol (model: free @0.80)
- Egg with Feta Wrap — alcohol (model: free @0.92)
