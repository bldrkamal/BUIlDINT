# Drawing Diagnostic Guide

## Expected Results for 4m x 4m Room with Partition

### Test Scenario (Verified)
- **Setup:** Perfect 4m x 4m square + 1 vertical partition down the middle
- **Expected Blocks:** 483 (with 5% wastage)
- **Wall Length (corrected):** 18.20m

### Your Current Result
- **Blocks:** 498
- **Difference:** +15 blocks (~3% more)

## Possible Causes

### 1. **Extra Wall Segments**
If you accidentally drew extra walls or the partition isn't exactly aligned, you'll get more blocks.

**How to check:**
- Count the walls: Should be exactly **5 walls**
  - Top, Right, Bottom, Left (4 outer walls)
  - Middle partition (1 inner wall)

### 2. **Gap in Walls**
If walls don't connect perfectly, the algorithm won't detect junctions properly.

**Expected junctions:** 6 total
- 4 corners (degree 2 each)
- 2 T-junctions where partition meets top/bottom (degree 3 each)

### 3. **Calculation Check**
To get 498 blocks:
- 498 blocks / 1.05 = 474 blocks (raw)
- 474 blocks × 0.1139 m²/block = 53.96 m² (assuming our block size)
- This suggests your total wall area is slightly different

## Recommended Action

**Option 1: Use the Eraser Tool**
Delete all walls and redraw carefully:
1. Draw the outer square (4m × 4m)
2. Draw ONE partition exactly from top to bottom in the middle

**Option 2: Check Your Drawing**
Can you tell me:
- How many walls does the sidebar show?
- What is the "Total Wall Area" shown in the estimate?
