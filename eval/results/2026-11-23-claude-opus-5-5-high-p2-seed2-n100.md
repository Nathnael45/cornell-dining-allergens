## Eval 2026-11-23 · claude-opus-5-5 · effort high · prompt 2026-11-23.2

100 dishes (seed 2, held out from seed 1), 2 samples each. "fits" = free with confidence ≥ 0.8. New API spend this run: $4.33 (200 calls).

#### single run (claude-opus-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 67 | 0 (0.0%) | 86.6% | 39.4% | 0.0% | 51.5% |
| egg | 54 | 0 (0.0%) | 74.1% | 43.5% | 4.3% | 39.1% |
| fish | 5 | 0 (0.0%) | 100.0% | 81.1% | 0.0% | 15.8% |
| shellfish | 0 | 0 (—) | — | 88.0% | 0.0% | 8.0% |
| peanuts | 4 | 0 (0.0%) | 100.0% | 70.8% | 0.0% | 24.0% |
| tree_nuts | 5 | 0 (0.0%) | 40.0% | 57.9% | 2.1% | 30.5% |
| soy | 74 | 0 (0.0%) | 51.4% | 23.1% | 0.0% | 69.2% |
| sesame | 23 | 0 (0.0%) | 65.2% | 48.1% | 0.0% | 46.8% |
| wheat | 69 | 0 (0.0%) | 95.7% | 29.0% | 16.1% | 48.4% |
| gluten | 69 | 0 (0.0%) | 95.7% | 25.8% | 19.4% | 45.2% |
| coconut | 10 | 0 (0.0%) | 50.0% | 72.2% | 1.1% | 13.3% |
| pork | 17 | 1 (5.9%) | 88.2% | 73.5% | 0.0% | 15.7% |
| alcohol | 20 | 0 (0.0%) | 30.0% | 21.3% | 10.0% | 53.8% |
| **all** | 417 | 1 (0.2%) | 76.7% | 59.3% | 2.7% | 29.6% |

#### 2 runs merged (claude-opus-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 67 | 0 (0.0%) | 88.1% | 39.4% | 0.0% | 51.5% |
| egg | 54 | 0 (0.0%) | 77.8% | 41.3% | 6.5% | 39.1% |
| fish | 5 | 0 (0.0%) | 100.0% | 80.0% | 1.1% | 15.8% |
| shellfish | 0 | 0 (—) | — | 87.0% | 0.0% | 11.0% |
| peanuts | 4 | 0 (0.0%) | 100.0% | 65.6% | 0.0% | 28.1% |
| tree_nuts | 5 | 0 (0.0%) | 40.0% | 54.7% | 2.1% | 32.6% |
| soy | 74 | 0 (0.0%) | 52.7% | 15.4% | 0.0% | 73.1% |
| sesame | 23 | 0 (0.0%) | 69.6% | 40.3% | 0.0% | 48.1% |
| wheat | 69 | 0 (0.0%) | 95.7% | 22.6% | 19.4% | 48.4% |
| gluten | 69 | 0 (0.0%) | 95.7% | 16.1% | 22.6% | 45.2% |
| coconut | 10 | 0 (0.0%) | 60.0% | 70.0% | 1.1% | 17.8% |
| pork | 17 | 1 (5.9%) | 88.2% | 72.3% | 0.0% | 21.7% |
| alcohol | 20 | 0 (0.0%) | 45.0% | 18.8% | 12.5% | 53.8% |
| **all** | 417 | 1 (0.2%) | 78.9% | 56.1% | 3.4% | 31.8% |

#### 2 runs merged + keyword floor + consistency (shipped pipeline)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 67 | 0 (0.0%) | 88.1% | 39.4% | 0.0% | 51.5% |
| egg | 54 | 0 (0.0%) | 77.8% | 41.3% | 6.5% | 41.3% |
| fish | 5 | 0 (0.0%) | 100.0% | 80.0% | 1.1% | 15.8% |
| shellfish | 0 | 0 (—) | — | 87.0% | 0.0% | 11.0% |
| peanuts | 4 | 0 (0.0%) | 100.0% | 65.6% | 0.0% | 28.1% |
| tree_nuts | 5 | 0 (0.0%) | 100.0% | 54.7% | 16.8% | 17.9% |
| soy | 74 | 0 (0.0%) | 52.7% | 15.4% | 0.0% | 73.1% |
| sesame | 23 | 0 (0.0%) | 69.6% | 40.3% | 0.0% | 48.1% |
| wheat | 69 | 0 (0.0%) | 97.1% | 22.6% | 19.4% | 48.4% |
| gluten | 69 | 0 (0.0%) | 97.1% | 16.1% | 22.6% | 45.2% |
| coconut | 10 | 0 (0.0%) | 60.0% | 70.0% | 1.1% | 17.8% |
| pork | 17 | 1 (5.9%) | 88.2% | 71.1% | 0.0% | 24.1% |
| alcohol | 20 | 0 (0.0%) | 45.0% | 18.8% | 12.5% | 53.8% |
| **all** | 417 | 1 (0.2%) | 80.1% | 55.9% | 5.0% | 30.6% |

#### False-safe cases in the shipped pipeline (1)
- Godiva Chocolate Cheesecake — pork (model: free @0.80)
