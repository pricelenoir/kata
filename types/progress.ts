export interface QuestionAttempt {
  questionId: string;
  status: "correct" | "incorrect";
  attemptedAt: string; // ISO timestamp
  selectedIndex?: number; // for multiple-choice, which choice was picked
}

export interface ProgressState {
  version: 1;
  /** Keyed by questionId — latest attempt wins, no full history log */
  attempts: Record<string, QuestionAttempt>;
  streak: {
    current: number;
    longest: number;
    /** YYYY-MM-DD, local date */
    lastActiveDate: string;
  };
}
