import type { CodingExercise, Language } from "@/types/coding-exercise";

// Synthetic exercises that exist only to test the judge end to end — every
// mode, every wire type, both languages. They never appear on the site, and
// their tests and solutions are public on purpose.

export interface Fixture {
  exercise: CodingExercise;
  solutions: Record<Language, string>;
}

const LIMITS = { timeMs: 2000, memoryMb: 256 };

export const FIXTURES: Fixture[] = [
  {
    exercise: {
      id: "fixture-function",
      title: "Fixture: function mode",
      category: "dsa",
      difficulty: "easy",
      mode: "function",
      prompt: "Sum of xs plus base.",
      limits: LIMITS,
      signature: {
        name: "sumWithBase",
        params: [
          { name: "xs", type: "int[]" },
          { name: "base", type: "long" },
        ],
        returns: "long",
      },
      examples: [
        { args: [[1, 2, 3], 10], expected: 16 },
        { args: [[], -5], expected: -5 },
        { args: [[2147483647, 2147483647], 0], expected: 4294967294 },
      ],
    },
    solutions: {
      cpp: `class Solution {
public:
    long long sumWithBase(vector<int>& xs, long long base) {
        long long s = base;
        for (int x : xs) s += x;
        cout << "debug: summed " << xs.size() << " values\\n";
        return s;
    }
};
`,
      rust: `impl Solution {
    pub fn sum_with_base(xs: Vec<i32>, base: i64) -> i64 {
        println!("debug: summed {} values", xs.len());
        xs.iter().map(|&x| x as i64).sum::<i64>() + base
    }
}
`,
    },
  },
  {
    exercise: {
      id: "fixture-strings",
      title: "Fixture: strings, bools, doubles",
      category: "dsa",
      difficulty: "easy",
      mode: "function",
      prompt: "Transpose a ragged grid of strings (missing cells become empty strings).",
      limits: LIMITS,
      signature: {
        name: "transpose",
        params: [{ name: "grid", type: "string[][]" }],
        returns: "string[][]",
      },
      examples: [
        { args: [[["a b", "c"], ["d\nnewline", "3:colon"]]], expected: [["a b", "d\nnewline"], ["c", "3:colon"]] },
        { args: [[["ünï", "x"], ["y"]]], expected: [["ünï", "y"], ["x", ""]] },
        { args: [[]], expected: [] },
      ],
    },
    solutions: {
      cpp: `class Solution {
public:
    vector<vector<string>> transpose(vector<vector<string>>& grid) {
        size_t cols = 0;
        for (auto& row : grid) cols = max(cols, row.size());
        vector<vector<string>> out(cols, vector<string>(grid.size()));
        for (size_t r = 0; r < grid.size(); ++r)
            for (size_t c = 0; c < grid[r].size(); ++c) out[c][r] = grid[r][c];
        return out;
    }
};
`,
      rust: `impl Solution {
    pub fn transpose(grid: Vec<Vec<String>>) -> Vec<Vec<String>> {
        let cols = grid.iter().map(|r| r.len()).max().unwrap_or(0);
        let mut out = vec![vec![String::new(); grid.len()]; cols];
        for (r, row) in grid.into_iter().enumerate() {
            for (c, cell) in row.into_iter().enumerate() {
                out[c][r] = cell;
            }
        }
        out
    }
}
`,
    },
  },
  {
    exercise: {
      id: "fixture-floats",
      title: "Fixture: doubles and bools",
      category: "dsa",
      difficulty: "easy",
      mode: "function",
      prompt: "Mean of the values whose flag is set.",
      limits: LIMITS,
      checker: { kind: "float", tolerance: 1e-9 },
      signature: {
        name: "maskedMean",
        params: [
          { name: "values", type: "double[]" },
          { name: "mask", type: "bool[]" },
        ],
        returns: "double",
      },
      examples: [
        { args: [[0.1, 0.2, 100], [true, true, false]], expected: 0.15 },
        { args: [[1e-300, 3e300], [false, true]], expected: 3e300 },
      ],
    },
    solutions: {
      cpp: `class Solution {
public:
    double maskedMean(vector<double>& values, vector<bool>& mask) {
        double sum = 0; int n = 0;
        for (size_t i = 0; i < values.size(); ++i) if (mask[i]) { sum += values[i]; ++n; }
        return sum / n;
    }
};
`,
      rust: `impl Solution {
    pub fn masked_mean(values: Vec<f64>, mask: Vec<bool>) -> f64 {
        let picked: Vec<f64> = values.iter().zip(&mask).filter(|&(_, &m)| m).map(|(&v, _)| v).collect();
        picked.iter().sum::<f64>() / picked.len() as f64
    }
}
`,
    },
  },
  {
    exercise: {
      id: "fixture-design",
      title: "Fixture: design mode",
      category: "dsa",
      difficulty: "easy",
      mode: "design",
      prompt: "A counter.",
      limits: LIMITS,
      signature: {
        className: "Counter",
        constructorParams: [{ name: "start", type: "long" }],
        methods: [
          { name: "add", params: [{ name: "delta", type: "int" }], returns: "long" },
          { name: "reset", params: [], returns: "void" },
          { name: "isZero", params: [], returns: "bool" },
        ],
      },
      examples: [
        {
          constructorArgs: [5],
          calls: [
            { method: "add", args: [3] },
            { method: "isZero", args: [] },
            { method: "reset", args: [] },
            { method: "isZero", args: [] },
            { method: "add", args: [-2] },
          ],
          expected: [8, false, null, true, -2],
        },
      ],
    },
    solutions: {
      cpp: `class Counter {
public:
    Counter(long long start) : value(start) {}
    long long add(int delta) { return value += delta; }
    void reset() { value = 0; }
    bool isZero() { return value == 0; }
private:
    long long value;
};
`,
      rust: `struct Counter {
    value: i64,
}

impl Counter {
    fn new(start: i64) -> Self {
        Counter { value: start }
    }
    fn add(&mut self, delta: i32) -> i64 {
        self.value += delta as i64;
        self.value
    }
    fn reset(&mut self) {
        self.value = 0;
    }
    fn is_zero(&self) -> bool {
        self.value == 0
    }
}
`,
    },
  },
  {
    exercise: {
      id: "fixture-stdio",
      title: "Fixture: stdio mode",
      category: "cpp",
      difficulty: "easy",
      mode: "stdio",
      prompt: "Print the sum of the integers on stdin.",
      limits: LIMITS,
      starterCode: { cpp: "", rust: "" },
      examples: [
        { stdin: "1 2 3\n", expected: "6\n" },
        { stdin: "", expected: "0\n" },
      ],
    },
    solutions: {
      cpp: `#include <iostream>
int main() {
    long long x, s = 0;
    while (std::cin >> x) s += x;
    std::cout << s << "\\n";
}
`,
      rust: `use std::io::Read;
fn main() {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    let s: i64 = input.split_whitespace().map(|t| t.parse::<i64>().unwrap()).sum();
    println!("{s}");
}
`,
    },
  },
];

/** A stdio exercise for hostile programs: each probe prints "contained" when
 * the sandbox held. Anything else is a failed containment check. */
export const PROBE: CodingExercise = {
  id: "fixture-probe",
  title: "Fixture: sandbox probe",
  category: "os",
  difficulty: "hard",
  mode: "stdio",
  prompt: "Try to escape.",
  limits: { timeMs: 1000, memoryMb: 128 },
  starterCode: { cpp: "", rust: "" },
  examples: [{ stdin: "", expected: "contained\n" }],
};
