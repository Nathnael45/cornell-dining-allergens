## Eval 2026-11-23 · claude-sonnet-5-5 · effort high · prompt 2026-11-23.2

100 dishes (seed 2, held out from seed 1), 2 samples each. "fits" = free with confidence ≥ 0.8. New API spend this run: $1.70 (200 calls).

#### single run (claude-sonnet-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 67 | 0 (0.0%) | 80.6% | 42.4% | 0.0% | 57.6% |
| egg | 54 | 0 (0.0%) | 83.3% | 45.7% | 4.3% | 47.8% |
| fish | 5 | 0 (0.0%) | 100.0% | 80.0% | 1.1% | 18.9% |
| shellfish | 0 | 0 (—) | — | 95.0% | 0.0% | 5.0% |
| peanuts | 4 | 0 (0.0%) | 100.0% | 68.8% | 0.0% | 31.3% |
| tree_nuts | 5 | 0 (0.0%) | 40.0% | 60.0% | 2.1% | 37.9% |
| soy | 74 | 0 (0.0%) | 70.3% | 11.5% | 7.7% | 80.8% |
| sesame | 23 | 0 (0.0%) | 43.5% | 50.6% | 1.3% | 48.1% |
| wheat | 69 | 0 (0.0%) | 95.7% | 29.0% | 22.6% | 48.4% |
| gluten | 69 | 0 (0.0%) | 95.7% | 29.0% | 25.8% | 45.2% |
| coconut | 10 | 1 (10.0%) | 40.0% | 91.1% | 1.1% | 7.8% |
| pork | 17 | 1 (5.9%) | 88.2% | 74.7% | 0.0% | 22.9% |
| alcohol | 20 | 0 (0.0%) | 30.0% | 17.5% | 10.0% | 63.8% |
| **all** | 417 | 2 (0.5%) | 78.9% | 61.9% | 3.6% | 33.3% |

#### 2 runs merged (claude-sonnet-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 67 | 0 (0.0%) | 80.6% | 42.4% | 0.0% | 57.6% |
| egg | 54 | 0 (0.0%) | 85.2% | 43.5% | 4.3% | 50.0% |
| fish | 5 | 0 (0.0%) | 100.0% | 76.8% | 1.1% | 21.1% |
| shellfish | 0 | 0 (—) | — | 94.0% | 0.0% | 5.0% |
| peanuts | 4 | 0 (0.0%) | 100.0% | 64.6% | 0.0% | 34.4% |
| tree_nuts | 5 | 0 (0.0%) | 40.0% | 54.7% | 2.1% | 42.1% |
| soy | 74 | 0 (0.0%) | 75.7% | 7.7% | 7.7% | 84.6% |
| sesame | 23 | 0 (0.0%) | 47.8% | 48.1% | 1.3% | 50.6% |
| wheat | 69 | 0 (0.0%) | 95.7% | 25.8% | 22.6% | 51.6% |
| gluten | 69 | 0 (0.0%) | 95.7% | 25.8% | 25.8% | 48.4% |
| coconut | 10 | 1 (10.0%) | 40.0% | 87.8% | 1.1% | 11.1% |
| pork | 17 | 1 (5.9%) | 88.2% | 67.5% | 0.0% | 30.1% |
| alcohol | 20 | 0 (0.0%) | 35.0% | 15.0% | 10.0% | 68.8% |
| **all** | 417 | 2 (0.5%) | 80.6% | 58.6% | 3.6% | 36.5% |

#### 2 runs merged + keyword floor + consistency (shipped pipeline)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 67 | 0 (0.0%) | 80.6% | 42.4% | 0.0% | 57.6% |
| egg | 54 | 0 (0.0%) | 85.2% | 43.5% | 4.3% | 50.0% |
| fish | 5 | 0 (0.0%) | 100.0% | 76.8% | 1.1% | 21.1% |
| shellfish | 0 | 0 (—) | — | 94.0% | 0.0% | 5.0% |
| peanuts | 4 | 0 (0.0%) | 100.0% | 64.6% | 0.0% | 34.4% |
| tree_nuts | 5 | 0 (0.0%) | 80.0% | 54.7% | 8.4% | 35.8% |
| soy | 74 | 0 (0.0%) | 75.7% | 7.7% | 7.7% | 84.6% |
| sesame | 23 | 0 (0.0%) | 47.8% | 48.1% | 1.3% | 50.6% |
| wheat | 69 | 0 (0.0%) | 97.1% | 25.8% | 22.6% | 51.6% |
| gluten | 69 | 0 (0.0%) | 97.1% | 25.8% | 25.8% | 48.4% |
| coconut | 10 | 1 (10.0%) | 40.0% | 87.8% | 1.1% | 11.1% |
| pork | 17 | 1 (5.9%) | 88.2% | 67.5% | 0.0% | 30.1% |
| alcohol | 20 | 0 (0.0%) | 35.0% | 15.0% | 10.0% | 68.8% |
| **all** | 417 | 2 (0.5%) | 81.5% | 58.6% | 4.3% | 35.8% |

#### False-safe cases in the shipped pipeline (2)
- Godiva Chocolate Cheesecake — coconut (model: free @0.80)
- Godiva Chocolate Cheesecake — pork (model: free @0.90)
