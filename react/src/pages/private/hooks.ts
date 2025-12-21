import { Dispatch, SetStateAction, useRef, useState } from "react";

type AggregatePeriod = "month" | "year";

type UseHistoricDateStateParams = {
  initialStartDate: Date;
  initialEndDate: Date;
};

type UseHistoricDateStateReturn = {
  startDate: Date;
  endDate: Date;
  aggregatePeriod: AggregatePeriod;
  handleAggregatePeriodChange: (newPeriod: AggregatePeriod) => void;
  handleStartDateChange: Dispatch<SetStateAction<Date>>;
  handleEndDateChange: Dispatch<SetStateAction<Date>>;
  // Also expose raw setters for cases where state is shared with other components
  setStartDate: Dispatch<SetStateAction<Date>>;
  setEndDate: Dispatch<SetStateAction<Date>>;
};

export const useHistoricDateState = ({
  initialStartDate,
  initialEndDate,
}: UseHistoricDateStateParams): UseHistoricDateStateReturn => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [aggregatePeriod, setAggregatePeriod] =
    useState<AggregatePeriod>("month");
  const hasUserChangedDates = useRef(false);

  const handleAggregatePeriodChange = (newPeriod: AggregatePeriod) => {
    if (newPeriod === "year" && !hasUserChangedDates.current) {
      setStartDate(new Date(2018, 0, 1));
      hasUserChangedDates.current = true;
    }
    setAggregatePeriod(newPeriod);
  };

  const handleStartDateChange: Dispatch<SetStateAction<Date>> = (date) => {
    hasUserChangedDates.current = true;
    setStartDate(date);
  };

  const handleEndDateChange: Dispatch<SetStateAction<Date>> = (date) => {
    hasUserChangedDates.current = true;
    setEndDate(date);
  };

  return {
    startDate,
    endDate,
    aggregatePeriod,
    handleAggregatePeriodChange,
    handleStartDateChange,
    handleEndDateChange,
    setStartDate,
    setEndDate,
  };
};

