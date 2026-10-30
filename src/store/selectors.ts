import type { PointOfInterest, RatingSummary, Review, ReviewTarget, Tour, Visit } from '../types';

export type RatingIndex = Map<string, RatingSummary>;

const key = (type: ReviewTarget, id: string) => `${type}:${id}`;

export function buildRatingIndex(reviews: Review[]): RatingIndex {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const k = key(r.targetType, r.targetId);
    const cur = acc.get(k) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    acc.set(k, cur);
  }
  const index: RatingIndex = new Map();
  acc.forEach((v, k) => index.set(k, { average: v.sum / v.count, count: v.count }));
  return index;
}

export function getRating(index: RatingIndex, type: ReviewTarget, id: string): RatingSummary {
  return index.get(key(type, id)) ?? { average: 0, count: 0 };
}

export const formatRating = (avg: number) => (avg ? avg.toFixed(1) : '—');

export function getTourPoints(tour: Tour, points: PointOfInterest[]): PointOfInterest[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  return tour.pointIds.map((id) => byId.get(id)).filter((p): p is PointOfInterest => !!p);
}

export function getToursForPoint(pointId: string, tours: Tour[]): Tour[] {
  return tours.filter((t) => t.pointIds.includes(pointId));
}

export function getReviewsFor(reviews: Review[], type: ReviewTarget, id: string): Review[] {
  return reviews
    .filter((r) => r.targetType === type && r.targetId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function visitedPointIds(visits: Visit[], userId: string | undefined): Set<string> {
  if (!userId) return new Set();
  return new Set(visits.filter((v) => v.userId === userId && v.pointId).map((v) => v.pointId as string));
}
