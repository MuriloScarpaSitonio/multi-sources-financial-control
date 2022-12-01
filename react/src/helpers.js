export function getChoiceByLabel(label, choices) {
  for (const choice of choices) {
    if (choice.label === label) return choice;
  }
}

export function getChoiceByValue(value, choices) {
  for (const choice of choices) {
    if (choice.value === value) return choice;
  }
}

export function getDateDiffString(dateFrom, dateTo) {
  let result;
  const DAYS_AT_MONTH = new Date(
    dateTo.getFullYear(),
    dateTo.getMonth(),
    0
  ).getDate();
  const MS_PER_MINUTE = 60000;
  const MS_PER_HOUR = MS_PER_MINUTE * 60;
  const MS_PER_DAY = MS_PER_HOUR * 24;
  const MS_PER_MONTH = MS_PER_DAY * DAYS_AT_MONTH;
  let diff = dateTo - dateFrom;

  if (diff < MS_PER_MINUTE) {
    result = `${dateFrom.getSeconds() - dateTo.getSeconds()} segundos`;
  } else if (MS_PER_MINUTE <= diff && diff < MS_PER_HOUR) {
    result = `${dateFrom.getMinutes() - dateTo.getMinutes()} minutos`;
  } else if (MS_PER_HOUR <= diff && diff < MS_PER_DAY) {
    result = `${dateFrom.getHours() - dateTo.getHours()} horas`;
  } else if (MS_PER_DAY <= diff && diff < MS_PER_MONTH) {
    result = `${dateFrom.getDate() - dateTo.getDate()} dias`;
  } else {
    result = `${
      dateFrom.getMonth() -
      dateTo.getMonth() +
      12 * (dateFrom.getFullYear() - dateTo.getFullYear())
    } meses`;
  }
  return result;
}
