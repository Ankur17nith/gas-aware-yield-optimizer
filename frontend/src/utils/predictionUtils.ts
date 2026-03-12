import type { Prediction } from '../types/prediction';

/**
 * Get a label color class based on prediction direction.
 */
export function getDirectionColor(direction: string): string {
  switch (direction) {
    case 'up':
      return '#22C55E';
    case 'down':
      return '#EF4444';
    default:
      return '#E5E7EB';
  }
}

/**
 * Get a confidence badge background.
 */
export function getConfidenceBg(confidence: string): string {
  switch (confidence) {
    case 'high':
      return 'rgba(34,197,94,0.15)';
    case 'medium':
      return 'rgba(234,179,8,0.15)';
    default:
      return 'rgba(239,68,68,0.15)';
  }
}

/**
 * Get a confidence text color.
 */
export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return '#22C55E';
    case 'medium':
      return '#EAB308';
    default:
      return '#EF4444';
  }
}

/**
 * Sort predictions by predicted change magnitude.
 */
export function sortByPredictedChange(predictions: Prediction[]): Prediction[] {
  return [...predictions].sort(
    (a, b) =>
      Math.abs(b.predicted_apy_30d - b.current_apy) -
      Math.abs(a.predicted_apy_30d - a.current_apy)
  );
}
