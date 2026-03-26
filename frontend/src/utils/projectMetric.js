/**
 * projectMetric.js
 *
 * Translates raw timeline indices (integers) to human-readable strings and back,
 * based on a project's `metric` field.
 *
 * Supported metrics (extensible):
 *   'days'   — index 0 = project start_date, index 1 = start_date + 1 day, …
 *   'hours'  — index 0 = project start_date midnight, index 1 = +1 hour, …
 *   'months' — index 0 = project start_date month, index 1 = +1 month, …
 *
 * All functions are pure — no React or network dependencies.
 */

import dayjs from "dayjs";

/**
 * Convert a raw index to a display string for the given project metric.
 *
 * @param {number} index       - raw integer index
 * @param {string} metric      - 'days' | 'hours' | 'months'
 * @param {string|null} startDate - project.start_date (ISO string "YYYY-MM-DD"), or null
 * @returns {string}
 */
export function indexToDisplay(index, metric, startDate) {
  if (!startDate) {
    return metricUnitLabel(metric, index);
  }

  const base = dayjs(startDate);

  switch (metric) {
    case "days":
      return base.add(index, "day").format("D. MMM YYYY");
    case "hours":
      return base.add(index, "hour").format("D. MMM HH:mm");
    case "months":
      return base.add(index, "month").format("MMM YYYY");
    default:
      return metricUnitLabel(metric, index);
  }
}

/**
 * Convert a raw index to a short display string (e.g. for tight UI space).
 *
 * @param {number} index
 * @param {string} metric
 * @param {string|null} startDate
 * @returns {string}
 */
export function indexToShortDisplay(index, metric, startDate) {
  if (!startDate) {
    return metricUnitLabel(metric, index);
  }

  const base = dayjs(startDate);

  switch (metric) {
    case "days":
      return base.add(index, "day").format("D. MMM");
    case "hours":
      return base.add(index, "hour").format("D.M. HH:mm");
    case "months":
      return base.add(index, "month").format("MMM YY");
    default:
      return metricUnitLabel(metric, index);
  }
}

/**
 * Compute the index for "right now" (wall-clock time) relative to project start.
 * Returns 0 if start_date is not set or today is before the project starts.
 *
 * @param {string} metric
 * @param {string|null} startDate
 * @returns {number}
 */
export function todayToIndex(metric, startDate) {
  if (!startDate) return 0;

  const base = dayjs(startDate).startOf("day");
  const now = dayjs();

  switch (metric) {
    case "days":
      return Math.max(0, now.startOf("day").diff(base, "day"));
    case "hours":
      return Math.max(0, now.diff(base, "hour"));
    case "months":
      return Math.max(0, now.startOf("month").diff(base.startOf("month"), "month"));
    default:
      return Math.max(0, now.startOf("day").diff(base, "day"));
  }
}

/**
 * Human-readable label for one unit step, used when start_date is absent.
 */
function metricUnitLabel(metric, index) {
  switch (metric) {
    case "hours":  return `Hour ${index}`;
    case "months": return `Month ${index}`;
    default:       return `Day ${index}`;
  }
}

/**
 * Returns the step label shown next to navigation arrows in the UI.
 * e.g. "day", "hour", "month"
 */
export function metricStepLabel(metric) {
  switch (metric) {
    case "hours":  return "hour";
    case "months": return "month";
    default:       return "day";
  }
}

/**
 * Format a demo index for the InventoryBar nav display, respecting both the
 * project's unit metric AND the schedule's chosen display format.
 *
 * @param {number} index
 * @param {string} projectMetric  - 'days' | 'hours' | 'months'
 * @param {string|null} startDate - ISO date string or null
 * @param {string} displayMetric  - 'date' | 'index' | 'week' | 'month'
 * @returns {string}
 */
export function indexToNavDisplay(index, projectMetric, startDate, displayMetric) {
  if (index === null || index === undefined) return "—";

  switch (displayMetric) {
    case "index":
      return String(index);

    case "week": {
      // Week number and day-within-week, derived from the unit metric
      if (projectMetric === "hours") {
        const day = Math.floor(index / 24);
        const week = Math.floor(day / 7) + 1;
        const dayInWeek = (day % 7) + 1;
        return `W${week} D${dayInWeek}`;
      }
      if (projectMetric === "months") {
        // Approximate: 1 month ≈ 4.3 weeks; just show month as a week-ish label
        return `M${index + 1}`;
      }
      // days (default)
      const week = Math.floor(index / 7) + 1;
      const dayInWeek = (index % 7) + 1;
      return `W${week} D${dayInWeek}`;
    }

    case "month": {
      if (!startDate) {
        if (projectMetric === "months") return `M${index + 1}`;
        const monthNum = Math.floor(index / (projectMetric === "hours" ? 720 : 30)) + 1;
        return `M${monthNum}`;
      }
      const base = dayjs(startDate);
      if (projectMetric === "hours")  return base.add(index, "hour").format("MMM YY");
      if (projectMetric === "months") return base.add(index, "month").format("MMM YY");
      return base.add(index, "day").format("MMM YY");
    }

    case "date":
    default:
      return indexToShortDisplay(index, projectMetric, startDate);
  }
}
