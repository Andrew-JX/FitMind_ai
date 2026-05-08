export interface AssistantDateRange {
  end_date: string;
  start_date: string;
}

export function createDefaultAssistantRange(): AssistantDateRange {
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
