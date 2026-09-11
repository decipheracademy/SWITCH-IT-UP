import type { PuzzleDefinition, ValidationIssue, ValidationResult } from "./PuzzleTypes";
import { isPlacementValid, type BoardShape } from "./PuzzleConstraints";
import { solve, countSolutions } from "./SudokuSolver";

/**
 * Validates an authored puzzle end-to-end. Nothing in PuzzleRepository
 * should be trusted blindly — this is what actually confirms a puzzle
 * is well-formed, that its givens don't already conflict, that it's
 * solvable, that the solution is unique, and that the declared
 * `solution` on the definition agrees with what the solver
 * independently finds (Build 02 spec §24).
 */
export function validatePuzzle(def: PuzzleDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];
  const shape: BoardShape = {
    size: def.size,
    boxRows: def.boxRows,
    boxCols: def.boxCols,
    diagonal: def.diagonal,
  };

  // 1. Dimensions.
  if (def.givens.length !== def.size) {
    issues.push({ code: "BAD_ROW_COUNT", message: `Expected ${def.size} rows, got ${def.givens.length}.` });
  }
  def.givens.forEach((row, r) => {
    if (row.length !== def.size) {
      issues.push({ code: "BAD_COL_COUNT", message: `Row ${r} has ${row.length} cols, expected ${def.size}.`, row: r });
    }
  });
  if (def.boxRows * def.boxCols !== def.size) {
    issues.push({
      code: "BAD_BOX_SHAPE",
      message: `boxRows(${def.boxRows}) * boxCols(${def.boxCols}) must equal size(${def.size}).`,
    });
  }

  // 2. Value range.
  def.givens.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v < 0 || v > def.size) {
        issues.push({ code: "VALUE_OUT_OF_RANGE", message: `Given at (${r},${c}) = ${v} is out of range.`, row: r, col: c });
      }
    })
  );

  // Bail early if dimensions are broken — conflict/solver checks below
  // assume a well-formed grid.
  const dimensionsOk = issues.length === 0;

  let solvable = false;
  let uniqueSolution = false;
  let solverSolution: number[][] | null = null;
  let solutionMatchesDeclared = false;

  if (dimensionsOk) {
    // 3-6. Given conflicts (row/col/box/diagonal), found by re-checking
    // each given against the rest of the board via the same
    // isPlacementValid the engine uses at runtime.
    for (let r = 0; r < def.size; r++) {
      for (let c = 0; c < def.size; c++) {
        const value = def.givens[r][c];
        if (value === 0) continue;
        const withoutSelf = def.givens.map((row) => row.slice());
        withoutSelf[r][c] = 0;
        if (!isPlacementValid(withoutSelf, r, c, value, shape)) {
          issues.push({
            code: "GIVEN_CONFLICT",
            message: `Given at (${r},${c}) = ${value} conflicts with another given.`,
            row: r,
            col: c,
          });
        }
      }
    }

    // 7. Solvability + 8. uniqueness, found independently by the solver.
    const solutionCount = countSolutions(def.givens, shape, 2);
    solvable = solutionCount >= 1;
    uniqueSolution = solutionCount === 1;
    if (!solvable) {
      issues.push({ code: "UNSOLVABLE", message: "No solution exists for the given clues under these rules." });
    } else if (!uniqueSolution) {
      issues.push({ code: "NOT_UNIQUE", message: "More than one solution exists for the given clues." });
    }

    solverSolution = solve(def.givens, shape);

    // 9. Declared solution matches solver.
    if (solverSolution) {
      solutionMatchesDeclared = def.solution.every((row, r) =>
        row.every((v, c) => v === solverSolution![r][c])
      );
      if (!solutionMatchesDeclared) {
        issues.push({
          code: "SOLUTION_MISMATCH",
          message: "The declared solution does not match the solver's independently-computed solution.",
        });
      }
    } else {
      issues.push({
        code: "NO_SOLVER_SOLUTION",
        message: "Solver found no solution to compare against the declared solution.",
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    solvable,
    uniqueSolution,
    solverSolution,
    solutionMatchesDeclared,
  };
}
