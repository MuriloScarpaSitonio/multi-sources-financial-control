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
    if (dateTo.getMinutes() === dateFrom.getMinutes()) {
      result = `${dateTo.getSeconds() - dateFrom.getSeconds()} segundos`;
    } else {
      result = `${dateTo.getSeconds() - dateFrom.getSeconds() + 60} segundos`;
    }
  } else if (MS_PER_MINUTE <= diff && diff < MS_PER_HOUR) {
    if (dateTo.getHours() === dateFrom.getHours()) {
      result = `${dateTo.getMinutes() - dateFrom.getMinutes()} minutos`;
    } else {
      result = `${dateTo.getMinutes() - dateFrom.getMinutes() + 60} minutos`;
    }
  } else if (MS_PER_HOUR <= diff && diff < MS_PER_DAY) {
    if (dateTo.getDate() === dateFrom.getDate()) {
      //same day
      result = `${dateTo.getHours() - dateFrom.getHours()} horas`;
    } else {
      result = `${dateTo.getHours() - dateFrom.getHours() + 24} horas`;
    }
  } else if (MS_PER_DAY <= diff && diff < MS_PER_MONTH) {
    if (dateFrom.getMonth() === dateTo.getMonth()) {
      result = `${dateTo.getDate() - dateFrom.getDate()} dias`;
    } else {
      result = `${dateTo.getDate() - dateFrom.getDate() + DAYS_AT_MONTH} dias`;
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

export function stringToBoolean(value) {
  return value === "true";
}

export function setUserDataToLocalStorage(data) {
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem("user_" + key, value);
  }
}
