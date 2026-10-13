// A review's score (owner's decision): the average of every answer given, the "Overall" stars and
// the four categories, not the "Overall" stars alone. Same formula as reviews.score in the database
// (migration 20261013130000_review_score.sql); used where reviews live in code (the sample page).

export type Ratings = {
  overall?: number | null;
  manager?: number | null;
  pay?: number | null;
  schedule?: number | null;
  environment?: number | null;
};

export function reviewScore(r: Ratings): number | null {
  const given = [r.overall, r.manager, r.pay, r.schedule, r.environment].filter((v): v is number => v != null);
  return given.length ? given.reduce((a, b) => a + b, 0) / given.length : null;
}
