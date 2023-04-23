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
    result = `${dateTo.getSeconds() - dateFrom.getSeconds()} segundos`;
  } else if (MS_PER_MINUTE <= diff && diff < MS_PER_HOUR) {
    result = `${dateTo.getMinutes() - dateFrom.getMinutes()} minutos`;
  } else if (MS_PER_HOUR <= diff && diff < MS_PER_DAY) {
    result = `${dateTo.getHours() - dateFrom.getHours()} horas`;
  } else if (MS_PER_DAY <= diff && diff < MS_PER_MONTH) {
    if (dateFrom.getMonth() === dateTo.getMonth()) {
      result = `${dateTo.getDate() - dateFrom.getDate()} dias`;
    } else {
      result = `${
        dateTo.getDate() + (DAYS_AT_MONTH - dateFrom.getDate())
      } dias`;
    }
  } else {
    result = `${
      dateTo.getMonth() -
      dateFrom.getMonth() +
      12 * (dateTo.getFullYear() - dateFrom.getFullYear())
    } meses`;
  }
  return result;
}

export function evaluateBooleanFromLocalStorage(value) {
  return value === "true";
}
