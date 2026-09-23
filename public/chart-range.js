const earliestChartYear = 1958;

// Convert the two form values into the inclusive list of charts to load.
export function yearsInRange(startValue, endValue, currentYear = new Date().getFullYear()) {
  if (String(startValue).trim() === "" || String(endValue).trim() === "") {
    throw new Error("Choose both a starting year and an ending year.");
  }
  const startYear = Number(startValue);
  const endYear = Number(endValue);

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new Error("Choose both a starting year and an ending year.");
  }
  if (startYear < earliestChartYear || endYear > currentYear) {
    throw new Error(`Choose years from ${earliestChartYear} through ${currentYear}.`);
  }
  if (startYear > endYear) {
    throw new Error("The starting year must be before or equal to the ending year.");
  }

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
}

export function yearRangeLabel(years) {
  return years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`;
}
