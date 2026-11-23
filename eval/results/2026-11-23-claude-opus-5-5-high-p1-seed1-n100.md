## Eval 2026-11-23 · claude-opus-5-5 · effort high · prompt 2026-11-23.1

100 dishes (seed 1), 2 samples each. "fits" = free with confidence ≥ 0.8. New API spend this run: $4.18 (200 calls).

#### single run (claude-opus-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 91.4% | 26.2% | 9.5% | 57.1% |
| egg | 51 | 0 (0.0%) | 90.2% | 49.0% | 0.0% | 44.9% |
| fish | 6 | 0 (0.0%) | 66.7% | 90.4% | 0.0% | 8.5% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 92.8% | 0.0% | 5.2% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 72.6% | 0.0% | 24.2% |
| tree_nuts | 8 | 0 (0.0%) | 62.5% | 65.2% | 0.0% | 29.3% |
| soy | 65 | 1 (1.5%) | 56.9% | 22.9% | 5.7% | 65.7% |
| sesame | 22 | 0 (0.0%) | 72.7% | 47.4% | 0.0% | 43.6% |
| wheat | 59 | 0 (0.0%) | 94.9% | 29.3% | 4.9% | 56.1% |
| gluten | 59 | 0 (0.0%) | 94.9% | 26.8% | 4.9% | 56.1% |
| coconut | 8 | 1 (12.5%) | 12.5% | 79.3% | 0.0% | 15.2% |
| pork | 16 | 0 (0.0%) | 100.0% | 78.6% | 1.2% | 17.9% |
| alcohol | 20 | 6 (30.0%) | 20.0% | 77.5% | 1.3% | 18.8% |
| **all** | 380 | 8 (2.1%) | 79.5% | 66.1% | 1.3% | 27.8% |

#### 2 runs merged (claude-opus-5-5)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 91.4% | 23.8% | 9.5% | 57.1% |
| egg | 51 | 0 (0.0%) | 90.2% | 49.0% | 0.0% | 44.9% |
| fish | 6 | 0 (0.0%) | 66.7% | 87.2% | 0.0% | 9.6% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 90.7% | 0.0% | 6.2% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 68.4% | 0.0% | 28.4% |
| tree_nuts | 8 | 0 (0.0%) | 62.5% | 63.0% | 0.0% | 29.3% |
| soy | 65 | 1 (1.5%) | 66.2% | 22.9% | 5.7% | 65.7% |
| sesame | 22 | 0 (0.0%) | 72.7% | 46.2% | 0.0% | 44.9% |
| wheat | 59 | 0 (0.0%) | 94.9% | 29.3% | 4.9% | 58.5% |
| gluten | 59 | 0 (0.0%) | 94.9% | 22.0% | 4.9% | 58.5% |
| coconut | 8 | 0 (0.0%) | 50.0% | 78.3% | 0.0% | 16.3% |
| pork | 16 | 0 (0.0%) | 100.0% | 78.6% | 1.2% | 17.9% |
| alcohol | 20 | 5 (25.0%) | 25.0% | 73.8% | 1.3% | 22.5% |
| **all** | 380 | 6 (1.6%) | 82.1% | 64.0% | 1.3% | 29.2% |

#### 2 runs merged + keyword floor + consistency (shipped pipeline)
| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |
|---|---|---|---|---|---|---|
| milk | 58 | 0 (0.0%) | 91.4% | 23.8% | 9.5% | 57.1% |
| egg | 51 | 0 (0.0%) | 90.2% | 49.0% | 0.0% | 44.9% |
| fish | 6 | 0 (0.0%) | 66.7% | 87.2% | 0.0% | 9.6% |
| shellfish | 3 | 0 (0.0%) | 100.0% | 90.7% | 0.0% | 6.2% |
| peanuts | 5 | 0 (0.0%) | 100.0% | 68.4% | 0.0% | 28.4% |
| tree_nuts | 8 | 0 (0.0%) | 87.5% | 63.0% | 16.3% | 13.0% |
| soy | 65 | 1 (1.5%) | 66.2% | 22.9% | 5.7% | 65.7% |
| sesame | 22 | 0 (0.0%) | 72.7% | 46.2% | 0.0% | 44.9% |
| wheat | 59 | 0 (0.0%) | 94.9% | 29.3% | 9.8% | 53.7% |
| gluten | 59 | 0 (0.0%) | 94.9% | 22.0% | 9.8% | 53.7% |
| coconut | 8 | 0 (0.0%) | 50.0% | 78.3% | 0.0% | 16.3% |
| pork | 16 | 0 (0.0%) | 100.0% | 77.4% | 1.2% | 19.0% |
| alcohol | 20 | 5 (25.0%) | 25.0% | 73.8% | 1.3% | 22.5% |
| **all** | 380 | 6 (1.6%) | 82.6% | 63.9% | 3.4% | 27.3% |

#### False-safe cases in the shipped pipeline (6)
- Breakfast Protein Power Pack — alcohol (model: free @0.85)
- Moroccan Lentil Soup — soy (model: free @0.80)
- Moroccan Lentil Soup — alcohol (model: free @0.90)
- Pickled Red Onion — alcohol (model: free @0.80, "vinegar only, possibly red wine vinegar")
- Chicken Harissa Toastie — alcohol (model: free @0.85)
- Egg with Feta Wrap — alcohol (model: free @0.92)
